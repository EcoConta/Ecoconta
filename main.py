import os
import io
import re
import sqlite3
import datetime
import hashlib
from contextlib import contextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException, status, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pypdf

# -----------------------------------------------------------------------------
# CONFIGURAÇÕES DE AMBIENTE
# -----------------------------------------------------------------------------
DB_PATH = "ecoconta.db"
SCHEMA_PATH = "ecoconta_schema.sql"

# -----------------------------------------------------------------------------
# INICIALIZAÇÃO AUTOMÁTICA DO BANCO DE DADOS (ENGINEERING BEST PRACTICE)
# -----------------------------------------------------------------------------
def init_db():
    """
    Verifica se a estrutura do banco de dados já existe.
    Caso contrário, executa de forma idempotente o script SQL de modelagem analítica.
    """
    schema_exists = False
    if os.path.exists(DB_PATH):
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='residencias';")
                if cursor.fetchone():
                    schema_exists = True
        except sqlite3.Error:
            pass

    if not schema_exists:
        print("🛠️ Inicializando o banco de dados a partir do ecoconta_schema.sql...")
        if os.path.exists(SCHEMA_PATH):
            try:
                with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
                    schema_sql = f.read()
                with sqlite3.connect(DB_PATH) as conn:
                    # Executa todo o script de modelagem, views e data seeding
                    conn.executescript(schema_sql)
                print("✅ Banco de dados inicializado com sucesso com presets e testes!")
            except Exception as e:
                print(f"❌ Erro ao ler ou executar o schema SQL: {e}")
        else:
            print(f"⚠️ Alerta: Arquivo '{SCHEMA_PATH}' não encontrado no diretório atual.")
    else:
        print("⚡ Banco de dados já estruturado e pronto para operação.")

def migrate_db():
    """
    Executa migrações incrementais no banco SQLite de forma segura.
    Garante que colunas extras sejam criadas e as views analíticas sejam atualizadas com as novas regras de negócio.
    """
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Verificar se a tabela usuarios existe, senão cria
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios';")
            if not cursor.fetchone():
                print("🛠️ Aplicando migração: Criando tabela 'usuarios'...")
                cursor.execute("""
                CREATE TABLE usuarios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL CHECK(length(trim(nome)) > 0),
                    email TEXT NOT NULL UNIQUE CHECK(email LIKE '%_@__%.__%'),
                    senha_hash TEXT NOT NULL CHECK(length(senha_hash) > 0),
                    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)
                conn.commit()
                print("✅ Tabela 'usuarios' criada com sucesso.")

            # Verificar se a coluna usuario_id existe em residencias
            cursor.execute("PRAGMA table_info(residencias);")
            res_cols = [row[1] for row in cursor.fetchall()]
            if "usuario_id" not in res_cols:
                print("🛠️ Aplicando migração: Adicionando coluna 'usuario_id' em 'residencias'...")
                cursor.execute("ALTER TABLE residencias ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;")
                conn.commit()
                print("✅ Coluna 'usuario_id' adicionada com sucesso em 'residencias'.")
            
            # Verificar se a coluna dias_faturamento existe na tabela contas_energia
            cursor.execute("PRAGMA table_info(contas_energia);")
            columns = [row[1] for row in cursor.fetchall()]
            
            if "dias_faturamento" not in columns:
                print("🛠️ Aplicando migração: Adicionando 'dias_faturamento' em 'contas_energia'...")
                cursor.execute("ALTER TABLE contas_energia ADD COLUMN dias_faturamento INTEGER DEFAULT 30 CHECK(dias_faturamento >= 1 AND dias_faturamento <= 100);")
                conn.commit()
                print("✅ Coluna 'dias_faturamento' adicionada com sucesso.")
            
            # Recriar as views analíticas para refletir a calibragem dinâmica de dias faturados
            print("🔄 Atualizando Views analíticas para suporte a dias de faturamento dinâmicos...")
            cursor.execute("DROP VIEW IF EXISTS v_simulador_modo_e_se;")
            cursor.execute("DROP VIEW IF EXISTS v_diagnostico_faturamento;")
            cursor.execute("DROP VIEW IF EXISTS v_consumo_projetado_aparelhos;")
            
            # 1. v_consumo_projetado_aparelhos (Tarifa mais recente da distribuidora)
            cursor.execute("""
            CREATE VIEW v_consumo_projetado_aparelhos AS
            WITH tarifa_atual AS (
                SELECT 
                    residencia_id,
                    tarifa_calculada,
                    dias_faturamento,
                    mes_referencia
                FROM contas_energia
                WHERE (residencia_id, mes_referencia) IN (
                    SELECT residencia_id, MAX(mes_referencia)
                    FROM contas_energia
                    GROUP BY residencia_id
                )
            )
            SELECT 
                inv.id AS inventario_id,
                inv.residencia_id,
                r.nome AS residencia_nome,
                inv.nome_personalizado,
                inv.potencia_utilizada,
                inv.horas_dia,
                COALESCE(ta.dias_faturamento, inv.dias_mes) AS dias_mes,
                ROUND(((inv.potencia_utilizada * inv.horas_dia * COALESCE(ta.dias_faturamento, inv.dias_mes)) / 1000.0), 2) AS consumo_projetado_kwh,
                ROUND(((inv.potencia_utilizada * inv.horas_dia * COALESCE(ta.dias_faturamento, inv.dias_mes)) / 1000.0) * COALESCE(ta.tarifa_calculada, 0.85), 2) AS custo_projetado_reais,
                ROUND(((inv.potencia_utilizada * inv.horas_dia * COALESCE(ta.dias_faturamento, inv.dias_mes)) / 1000.0) * 0.09, 3) AS pegada_carbono_kg_co2
            FROM inventario_usuario inv
            JOIN residencias r ON inv.residencia_id = r.id
            LEFT JOIN tarifa_atual ta ON inv.residencia_id = ta.residencia_id;
            """)
            
            # 2. v_diagnostico_faturamento (Auditoria Cruzada Mapeada com Dias da Fatura Real)
            cursor.execute("""
            CREATE VIEW v_diagnostico_faturamento AS
            WITH consumo_inventario_por_mes AS (
                SELECT 
                    inv.residencia_id,
                    c.mes_referencia,
                    SUM(ROUND(((inv.potencia_utilizada * inv.horas_dia * COALESCE(c.dias_faturamento, 30)) / 1000.0), 2)) AS total_kwh_projetado,
                    SUM(ROUND(((inv.potencia_utilizada * inv.horas_dia * COALESCE(c.dias_faturamento, 30)) / 1000.0) * c.tarifa_calculada, 2)) AS total_reais_projetado
                FROM inventario_usuario inv
                JOIN contas_energia c ON inv.residencia_id = c.residencia_id
                GROUP BY inv.residencia_id, c.mes_referencia
            )
            SELECT 
                c.residencia_id,
                r.nome AS residencia_nome,
                c.mes_referencia,
                c.consumo_kwh AS consumo_real_kwh,
                c.valor_reais AS valor_real_reais,
                COALESCE(i.total_kwh_projetado, 0.0) AS consumo_inventariado_kwh,
                COALESCE(i.total_reais_projetado, 0.0) AS valor_inventariado_reais,
                ROUND(c.consumo_kwh - COALESCE(i.total_kwh_projetado, 0.0), 2) AS desvio_kwh,
                ROUND((COALESCE(i.total_kwh_projetado, 0.0) / c.consumo_kwh) * 100, 1) AS percentual_mapeado
            FROM contas_energia c
            JOIN residencias r ON c.residencia_id = r.id
            LEFT JOIN consumo_inventario_por_mes i ON c.residencia_id = i.residencia_id AND c.mes_referencia = i.mes_referencia;
            """)
            
            # 3. v_simulador_modo_e_se (Baseado na View A)
            cursor.execute("""
            CREATE VIEW v_simulador_modo_e_se AS
            SELECT 
                inventario_id,
                residencia_id,
                residencia_nome,
                nome_personalizado,
                consumo_projetado_kwh,
                custo_projetado_reais,
                pegada_carbono_kg_co2,
                ROUND(custo_projetado_reais * 0.10, 2) AS economia_financeira_10pct,
                ROUND(pegada_carbono_kg_co2 * 0.10, 3) AS economia_co2_10pct,
                ROUND(custo_projetado_reais * 0.20, 2) AS economia_financeira_20pct,
                ROUND(pegada_carbono_kg_co2 * 0.20, 3) AS economia_co2_20pct,
                ROUND(custo_projetado_reais * 0.30, 2) AS economia_financeira_30pct,
                ROUND(pegada_carbono_kg_co2 * 0.30, 3) AS economia_co2_30pct
            FROM v_consumo_projetado_aparelhos;
            """)
            
            conn.commit()
            print("✅ Views analíticas atualizadas com sucesso!")
    except Exception as e:
        print(f"❌ Erro ao aplicar migrações de views: {e}")

# Executa na carga do módulo
init_db()
migrate_db()

# -----------------------------------------------------------------------------
# GERENCIAMENTO DE CONEXÃO COM CONTEXT MANAGER E SQLITE ROW FACTORY
# -----------------------------------------------------------------------------
@contextmanager
def get_db_connection():
    """
    Gerenciador de contexto seguro para conexões SQLite.
    Garante o isolamento de transações, a ativação de chaves estrangeiras (PRAGMA)
    e o mapeamento de tuplas para dicionários usando sqlite3.Row.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Permite acesso às colunas por nome
    
    # Ativa explicitamente a validação de chaves estrangeiras no SQLite 3
    conn.execute("PRAGMA foreign_keys = ON;")
    
    try:
        yield conn
        conn.commit()  # Efetiva a transação se não houver erro
    except sqlite3.IntegrityError as e:
        conn.rollback()
        # Captura quebras de restrições relacionais e validações do banco (CHECK/UNIQUE)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Falha de validação ou restrição de integridade do banco: {str(e)}"
        )
    except sqlite3.Error as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno de banco de dados SQLite: {str(e)}"
        )
    finally:
        conn.close()

# -----------------------------------------------------------------------------
# MODELOS DE ENTRADA (PYDANTIC SCHEMAS - V2)
# -----------------------------------------------------------------------------
class UsuarioCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100, description="Nome do usuário")
    email: str = Field(..., min_length=3, max_length=100, description="Email de cadastro")
    senha: str = Field(..., min_length=4, max_length=100, description="Senha em texto cru")

class UsuarioLogin(BaseModel):
    email: str = Field(..., description="Email de login")
    senha: str = Field(..., description="Senha de login")

class ResidenciaCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100, description="Nome identificador da residência")
    usuario_id: Optional[int] = Field(None, description="ID do usuário proprietário")

class ContaEnergiaCreate(BaseModel):
    residencia_id: int = Field(..., description="ID da residência associada")
    mes_referencia: str = Field(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="Mês de referência (formato YYYY-MM)")
    consumo_kwh: float = Field(..., gt=0.0, description="Consumo total do mês em kWh")
    valor_reais: float = Field(..., ge=0.0, description="Valor pago na conta em R$")
    dias_faturamento: int = Field(30, ge=1, le=100, description="Dias do ciclo de faturamento")

class ItemInventarioCreate(BaseModel):
    residencia_id: int = Field(..., description="ID da residência associada")
    preset_id: Optional[int] = Field(None, description="ID opcional do preset de eletrodomésticos")
    nome_personalizado: str = Field(..., min_length=1, max_length=100, description="Apelido/Nome do aparelho")
    potencia_utilizada: int = Field(..., gt=0, description="Potência do aparelho em Watts")
    horas_dia: float = Field(..., ge=0.0, le=24.0, description="Tempo médio de uso diário em horas")
    dias_mes: int = Field(30, ge=1, le=31, description="Dias ativos no mês")

class MetaCreate(BaseModel):
    residencia_id: int = Field(..., description="ID da residência associada")
    porcentagem_meta: float = Field(..., gt=0.0, lt=100.0, description="Alvo percentual de economia (ex: 15.0)")

# -----------------------------------------------------------------------------
# CONFIGURAÇÃO DA APLICAÇÃO FASTAPI & MIDDLEWARE CORS
# -----------------------------------------------------------------------------
app = FastAPI(
    title="Ecoconta API",
    description="Back-end de alto desempenho em FastAPI e SQLite para insights ecológicos e financeiros de consumo elétrico.",
    version="1.1.0"
)

# Liberação completa de CORS para permitir que aplicações React locais se comuniquem
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# FUNÇÃO AUXILIAR DE VALIDAÇÃO DE EXISTÊNCIA (404 SAFETY NET)
# -----------------------------------------------------------------------------
def verificar_residencia_existe(residencia_id: int):
    """
    Valida a existência de uma residência no banco para evitar órfãos silenciosos.
    Lança HTTPException 404 se ausente.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM residencias WHERE id = ?", (residencia_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Residência com ID {residencia_id} não encontrada no Ecoconta."
            )

# -----------------------------------------------------------------------------
# ROTAS DA API: AUTENTICAÇÃO E CONTROLE DE ACESSO
# -----------------------------------------------------------------------------

@app.post("/auth/cadastrar", status_code=status.HTTP_201_CREATED)
def cadastrar_usuario(usuario: UsuarioCreate):
    """
    Cadastra um novo usuário no sistema. 
    Se for o primeiro usuário cadastrado ou se houver residências sem proprietário, 
    atribui a residência de semente (demo) a ele automaticamente.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Verifica se o email já existe
        cursor.execute("SELECT id FROM usuarios WHERE email = ?;", (usuario.email.strip().lower(),))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O e-mail informado já está cadastrado."
            )
        
        # Criptografa a senha usando SHA-256
        senha_hash = hashlib.sha256(usuario.senha.encode("utf-8")).hexdigest()
        
        cursor.execute(
            """
            INSERT INTO usuarios (nome, email, senha_hash)
            VALUES (?, ?, ?)
            RETURNING id, nome, email, criado_em;
            """,
            (usuario.nome.strip(), usuario.email.strip().lower(), senha_hash)
        )
        row_usuario = cursor.fetchone()
        novo_id = row_usuario["id"]
        
        # Se houver residências sem usuário cadastrado, fazemos o claim!
        cursor.execute("SELECT id FROM residencias WHERE usuario_id IS NULL;")
        residencias_orfãs = cursor.fetchall()
        if len(residencias_orfãs) > 0:
            print(f"📦 Atribuindo {len(residencias_orfãs)} residência(s) órfã(s) de semente ao novo usuário ID {novo_id}...")
            cursor.execute("UPDATE residencias SET usuario_id = ? WHERE usuario_id IS NULL;", (novo_id,))
            
        return {
            "id": row_usuario["id"],
            "nome": row_usuario["nome"],
            "email": row_usuario["email"]
        }

@app.post("/auth/login", status_code=status.HTTP_200_OK)
def login_usuario(usuario: UsuarioLogin):
    """
    Autentica o usuário validando o e-mail e hash da senha.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        senha_hash = hashlib.sha256(usuario.senha.encode("utf-8")).hexdigest()
        
        cursor.execute(
            "SELECT id, nome, email FROM usuarios WHERE email = ? AND senha_hash = ?;",
            (usuario.email.strip().lower(), senha_hash)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="E-mail ou senha incorretos."
            )
            
        return dict(row)

# -----------------------------------------------------------------------------
# ROTAS DA API: CADASTRO E CONTROLE (OPERATIONS)
# -----------------------------------------------------------------------------

@app.get("/residencias", status_code=status.HTTP_200_OK)
def listar_residencias(usuario_id: Optional[int] = None):
    """
    Retorna uma lista resumida das residências filtradas por usuario_id.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if usuario_id is not None:
            cursor.execute(
                "SELECT id, nome, criado_em, usuario_id FROM residencias WHERE usuario_id = ? ORDER BY criado_em DESC;",
                (usuario_id,)
            )
        else:
            cursor.execute(
                "SELECT id, nome, criado_em, usuario_id FROM residencias ORDER BY criado_em DESC;"
            )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

@app.post("/residencias", status_code=status.HTTP_201_CREATED)
def criar_residencia(residencia: ResidenciaCreate):
    """
    Cadastra uma nova residência vinculada ao usuário logado.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO residencias (nome, usuario_id) VALUES (?, ?) RETURNING id, nome, criado_em, usuario_id;",
            (residencia.nome, residencia.usuario_id)
        )
        row = cursor.fetchone()
        return dict(row)

@app.delete("/residencias/{id}", status_code=status.HTTP_200_OK)
def deletar_residencia(id: int):
    """
    Remove uma residência e todos os seus dados associados (contas, inventário, metas) em cascata.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nome FROM residencias WHERE id = ?;", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Residência com ID {id} não encontrada."
            )
        nome_residencia = row["nome"]
        cursor.execute("DELETE FROM residencias WHERE id = ?;", (id,))
        return {"mensagem": f"Residência '{nome_residencia}' e todos os seus dados associados foram removidos do Ecoconta."}

@app.post("/contas", status_code=status.HTTP_201_CREATED)
def cadastrar_conta(conta: ContaEnergiaCreate):
    """
    Insere ou atualiza (Upsert) o histórico financeiro de faturamento elétrico mensal de uma residência.
    Se já houver uma fatura para o mesmo mês, sobrescreve os dados com os novos valores de forma limpa.
    """
    verificar_residencia_existe(conta.residencia_id)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Verifica se a fatura já existe para esta competência
        cursor.execute(
            "SELECT id FROM contas_energia WHERE residencia_id = ? AND mes_referencia = ?;",
            (conta.residencia_id, conta.mes_referencia)
        )
        row_existente = cursor.fetchone()
        
        if row_existente:
            # Upsert: Já existe, fazemos UPDATE
            cursor.execute(
                """
                UPDATE contas_energia 
                SET consumo_kwh = ?, valor_reais = ?, dias_faturamento = ?
                WHERE id = ?
                RETURNING id, residencia_id, mes_referencia, consumo_kwh, valor_reais, dias_faturamento, tarifa_calculada;
                """,
                (conta.consumo_kwh, conta.valor_reais, conta.dias_faturamento, row_existente["id"])
            )
        else:
            # Já não existe, fazemos INSERT normal
            cursor.execute(
                """
                INSERT INTO contas_energia (residencia_id, mes_referencia, consumo_kwh, valor_reais, dias_faturamento)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id, residencia_id, mes_referencia, consumo_kwh, valor_reais, dias_faturamento, tarifa_calculada;
                """,
                (conta.residencia_id, conta.mes_referencia, conta.consumo_kwh, conta.valor_reais, conta.dias_faturamento)
            )
            
        row = cursor.fetchone()
        return dict(row)

@app.delete("/contas/{id}", status_code=status.HTTP_200_OK)
def deletar_conta(id: int):
    """
    Remove uma fatura de faturamento elétrico mensal cadastrada no sistema.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM contas_energia WHERE id = ?;", (id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fatura com ID {id} não encontrada no Ecoconta."
            )
        cursor.execute("DELETE FROM contas_energia WHERE id = ?;", (id,))
        return {"mensagem": f"Fatura {id} deletada com sucesso do Ecoconta."}

@app.post("/contas/parse-pdf", status_code=status.HTTP_200_OK)
async def parse_fatura_pdf(file: UploadFile = File(...)):
    """
    Recebe um arquivo PDF de fatura de energia, extrai seu texto e aplica expressões regulares
    para capturar dinamicamente o Mês de Referência, Consumo (kWh) e Valor Total (R$).
    Adicionalmente, extrai a tabela completa de histórico de consumo de até 13 meses (Cemig / Enel).
    Oferece tratamento gracioso e fallbacks para layouts não suportados.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de arquivo inválido. Apenas faturas digitais em PDF são suportadas."
        )

    try:
        contents = await file.read()
        pdf_file = io.BytesIO(contents)
        reader = pypdf.PdfReader(pdf_file)
        
        texto_cru = ""
        for page in reader.pages:
            texto_cru += page.extract_text() or ""
        
        # --- 1. Extração do Histórico Completo de Faturamento (Cemig / Enel) ---
        MESES_PT = {
            "JAN": "01", "FEV": "02", "MAR": "03", "ABR": "04", "MAI": "05", "JUN": "06",
            "JUL": "07", "AGO": "08", "SET": "09", "OUT": "10", "NOV": "11", "DEZ": "12"
        }
        
        historico_pdf = []
        # Captura padrões do tipo "MAI/26  114,000  32" ou "ABR/26  171  31"
        pattern_historico = re.compile(
            r"\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s*/\s*([0-9]{2})\b[^\d]*(\d+(?:[.,]\d+)?)\s+(\d{1,2})\b",
            re.IGNORECASE
        )
        
        matches = pattern_historico.findall(texto_cru)
        for m in matches:
            mes_nome = m[0].upper()
            ano_2d = m[1]
            consumo_str = m[2]
            dias_str = m[3]
            
            mes_num = MESES_PT.get(mes_nome, "01")
            ano_completo = f"20{ano_2d}"
            mes_ref_item = f"{ano_completo}-{mes_num}"
            
            # Limpa consumo considerando os 3 decimais da Cemig (ex: 114,000 -> 114)
            try:
                if consumo_str.endswith(",000") or consumo_str.endswith(".000"):
                    consumo_val = float(consumo_str[:-4].replace(".", "").replace(",", ""))
                else:
                    val_correto = consumo_str.replace(".", "").replace(",", ".")
                    consumo_val = float(val_correto)
            except ValueError:
                consumo_val = 150.0
                
            try:
                dias_val = int(dias_str)
            except ValueError:
                dias_val = 30
                
            # Evita duplicidade
            if not any(item["mes_referencia"] == mes_ref_item for item in historico_pdf):
                historico_pdf.append({
                    "mes_referencia": mes_ref_item,
                    "consumo_kwh": consumo_val,
                    "dias_faturamento": dias_val
                })
        
        # --- 2. Definição do Mês Ativo, Consumo (kWh) e Dias de Ciclo ---
        mes_ref = None
        kwh = None
        dias_faturamento = None
        
        # Se extraímos a tabela histórica com sucesso, a primeira linha (mais recente) é o mês da fatura!
        if historico_pdf:
            mes_ref = historico_pdf[0]["mes_referencia"]
            kwh = historico_pdf[0]["consumo_kwh"]
            dias_faturamento = historico_pdf[0]["dias_faturamento"]
            print(f"🎯 Extraído com sucesso da tabela CEMIG: {mes_ref} -> {kwh} kWh em {dias_faturamento} dias.")
        
        # --- Fallback 1: Se a tabela Cemig falhou, usa regex tradicional para Mês de Referência ---
        if not mes_ref:
            # Prioridade 1: Âncoras estritas
            match_ancora = re.search(
                r"(?:ref|referencia|competencia|mes/ano|mes\s+ref|ref\.)[^\d]*(0[1-9]|1[0-2])\s*/\s*(20[2-9][0-9]|[2-9][0-9])\b",
                texto_cru,
                re.IGNORECASE
            )
            if match_ancora:
                mes = match_ancora.group(1)
                ano = match_ancora.group(2)
                ano_completo = ano if len(ano) == 4 else f"20{ano}"
                mes_ref = f"{ano_completo}-{mes}"
                
            # Prioridade 2: Vencimento
            if not mes_ref:
                match_venc = re.search(
                    r"(?:vencimento|vence|venc)[^\d]*[0-3]?\d\s*/\s*(0[1-9]|1[0-2])\s*/\s*(20[2-9][0-9]|[2-9][0-9])\b",
                    texto_cru,
                    re.IGNORECASE
                )
                if match_venc:
                    mes = match_venc.group(1)
                    ano = match_venc.group(2)
                    ano_completo = ano if len(ano) == 4 else f"20{ano}"
                    mes_ref = f"{ano_completo}-{mes}"
                    
            # Prioridade 3: Data genérica
            if not mes_ref:
                match_mes_completo = re.search(r"\b(0[1-9]|1[0-2])/(20[2-9][0-9])\b", texto_cru)
                if match_mes_completo:
                    mes_ref = f"{match_mes_completo.group(2)}-{match_mes_completo.group(1)}"
                else:
                    match_mes_curto = re.search(r"\b(0[1-9]|1[0-2])/([2-9][0-9])\b", texto_cru)
                    if match_mes_curto:
                        mes_ref = f"20{match_mes_curto.group(2)}-{match_mes_curto.group(1)}"

        # --- Fallback 2: Se a tabela Cemig falhou, usa regex tradicional para Consumo (kWh) ---
        if not kwh:
            # Prioridade 1: Energia faturada
            match_kwh_estrito = re.search(
                r"(?:energia\s+ativa\s+faturada|consumo\s+faturado|faturado|energia\s+faturada)[^\d]*(\d+(?:[.,]\d+)?)\s*(?:kwh|kwh/h|kwh)\b",
                texto_cru,
                re.IGNORECASE
            )
            if match_kwh_estrito:
                try:
                    kwh = float(match_kwh_estrito.group(1).replace(",", "."))
                except ValueError:
                    pass
            
            # Prioridade 2: Consumo ativo medido
            if not kwh:
                match_kwh_medio = re.search(
                    r"(?:consumo|medido|leitura)[^\d]*(\d+(?:[.,]\d+)?)\s*(?:kwh|kwh/h|kwh)\b",
                    texto_cru,
                    re.IGNORECASE
                )
                if match_kwh_medio:
                    try:
                        kwh = float(match_kwh_medio.group(1).replace(",", "."))
                    except ValueError:
                        pass
            
            # Prioridade 3: Alternativa genérica
            if not kwh:
                match_kwh_alt = re.search(r"(\d+(?:[.,]\d+)?)\s*kwh", texto_cru, re.IGNORECASE)
                if match_kwh_alt:
                    try:
                        kwh = float(match_kwh_alt.group(1).replace(",", "."))
                    except ValueError:
                        pass

        # --- Fallback 2B: Se a tabela Cemig falhou, usa regex tradicional para Dias ---
        if not dias_faturamento:
            match_dias = re.search(
                r"(?:nº\s*de\s*dias|dias\s*faturados|periodo\s*faturado|periodo|faturamento)[^\d]*([2-3]\d)\s*(?:dias|dia)?\b",
                texto_cru,
                re.IGNORECASE
            )
            if match_dias:
                try:
                    dias_faturamento = int(match_dias.group(1))
                except ValueError:
                    pass
            else:
                match_dias_alt = re.search(r"\b([2-3]\d)\s*(?:dias|dia)\b", texto_cru, re.IGNORECASE)
                if match_dias_alt:
                    try:
                        dias_faturamento = int(match_dias_alt.group(1))
                    except ValueError:
                        pass

        # --- 3. Regex Valor Pago (R$) (Sempre executado na fatura) ---
        valor = None
        match_val = re.search(r"(?:total|a pagar|pagar|valor|pagamento|fatura)[^\d]*r\$?\s*(\d+(?:[.,]\d{2}))", texto_cru, re.IGNORECASE)
        if match_val:
            try:
                valor = float(match_val.group(1).replace(".", "").replace(",", "."))
            except ValueError:
                pass
        else:
            match_val_alt = re.search(r"r\$?\s*(\d+(?:[.,]\d{2}))", texto_cru, re.IGNORECASE)
            if match_val_alt:
                try:
                    valor = float(match_val_alt.group(1).replace(".", "").replace(",", "."))
                except ValueError:
                    pass

        # Valida se a varredura automática foi 100% bem-sucedida
        parser_sucesso = (mes_ref is not None) and (kwh is not None) and (valor is not None)
        
        # Fallbacks amigáveis de segurança
        if not mes_ref:
            mes_ref = datetime.date.today().strftime("%Y-%m")
            
        return {
            "mes_referencia": mes_ref,
            "consumo_kwh": kwh or 150.0,
            "valor_reais": valor or 120.00,
            "dias_faturamento": dias_faturamento or 30,
            "parser_sucesso": parser_sucesso,
            "historico_pdf": historico_pdf
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro crítico no processamento do PDF: {str(e)}"
        )

@app.post("/inventario", status_code=status.HTTP_201_CREATED)
def adicionar_item_inventario(item: ItemInventarioCreate):
    """
    Adiciona um eletrodoméstico específico ao inventário doméstico de uma residência (Passo 2 e 3 Onboarding).
    """
    verificar_residencia_existe(item.residencia_id)

    if item.preset_id is not None:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM presets_eletrodomesticos WHERE id = ?;", (item.preset_id,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"O preset de eletrodoméstico com ID {item.preset_id} não existe no catálogo global."
                )

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO inventario_usuario (residencia_id, preset_id, nome_personalizado, potencia_utilizada, horas_dia, dias_mes)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id, residencia_id, preset_id, nome_personalizado, potencia_utilizada, horas_dia, dias_mes;
            """,
            (item.residencia_id, item.preset_id, item.nome_personalizado, item.potencia_utilizada, item.horas_dia, item.dias_mes)
        )
        row = cursor.fetchone()
        return dict(row)

@app.post("/metas", status_code=status.HTTP_201_CREATED)
def cadastrar_meta(meta: MetaCreate):
    """
    Define um novo objetivo percentual de redução e economia para fins de gamificação do sistema.
    """
    verificar_residencia_existe(meta.residencia_id)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Inativa metas anteriores
        cursor.execute("UPDATE metas_economia SET ativa = 0 WHERE residencia_id = ?;", (meta.residencia_id,))
        
        cursor.execute(
            """
            INSERT INTO metas_economia (residencia_id, porcentagem_meta, ativa)
            VALUES (?, ?, 1)
            RETURNING id, residencia_id, porcentagem_meta, ativa, criado_em;
            """,
            (meta.residencia_id, meta.porcentagem_meta)
        )
        row = cursor.fetchone()
        return dict(row)

@app.get("/presets", status_code=status.HTTP_200_OK)
def obter_presets(categoria: Optional[str] = None):
    """
    Retorna o catálogo global de presets pré-cadastrados (Inventário Ágil).
    Permite filtrar por categoria (ex: 'Chuveiro', 'Ar Condicionado').
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if categoria:
            cursor.execute(
                "SELECT id, categoria, nome_comercial, potencia_watts FROM presets_eletrodomesticos WHERE categoria = ? ORDER BY nome_comercial ASC;",
                (categoria,)
            )
        else:
            cursor.execute(
                "SELECT id, categoria, nome_comercial, potencia_watts FROM presets_eletrodomesticos ORDER BY categoria ASC, nome_comercial ASC;"
            )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


# -----------------------------------------------------------------------------
# ROTAS ANALÍTICAS: INSIGHTS FINANCEIROS & ECOLÓGICOS (SQLITE VIEWS)
# -----------------------------------------------------------------------------

@app.get("/residencias/{id}/diagnostico", status_code=status.HTTP_200_OK)
def obter_diagnostico_faturamento(id: int):
    """
    Consome a View 'v_diagnostico_faturamento' cruzando as contas de energia reais 
    com a projeção agregada do inventário mapeado para expor desvios e precisão cadastral.
    """
    verificar_residencia_existe(id)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT 
                c.id AS conta_id,
                c.dias_faturamento,
                v.residencia_id,
                v.residencia_nome,
                v.mes_referencia,
                v.consumo_real_kwh,
                v.valor_real_reais,
                v.consumo_inventariado_kwh,
                v.valor_inventariado_reais,
                v.desvio_kwh,
                v.percentual_mapeado
            FROM v_diagnostico_faturamento v
            JOIN contas_energia c ON v.residencia_id = c.residencia_id AND v.mes_referencia = c.mes_referencia
            WHERE v.residencia_id = ?
            ORDER BY v.mes_referencia DESC;
            """,
            (id,)
        )
        rows = cursor.fetchall()
        
        if not rows:
            return {
                "residencia_id": id,
                "historico_analitico": [],
                "aviso": "Nenhuma fatura de energia cadastrada ainda para esta residência."
            }
            
        return {
            "residencia_id": id,
            "historico_analitico": [dict(row) for row in rows]
        }

@app.get("/residencias/{id}/consumo-aparelhos", status_code=status.HTTP_200_OK)
def obter_consumo_projetado_aparelhos(id: int, mes_referencia: Optional[str] = None):
    """
    Consulta o consumo dos aparelhos. Caso seja informado o parâmetro mes_referencia,
    a tarifa aplicada flutuará de acordo com os impostos e bandeiras cadastrados na fatura daquele mês específico.
    Caso seja omitido, utiliza a tarifa da conta faturada mais recente por padrão (View v_consumo_projetado_aparelhos).
    """
    verificar_residencia_existe(id)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Se foi solicitado um mês histórico específico
        if mes_referencia:
            # Verifica se existe fatura cadastrada para o mês
            cursor.execute(
                "SELECT tarifa_calculada, dias_faturamento FROM contas_energia WHERE residencia_id = ? AND mes_referencia = ?;",
                (id, mes_referencia)
            )
            row_conta = cursor.fetchone()
            
            # Fallback de tarifa padrão se não houver fatura salva naquele mês específico
            tarifa = row_conta["tarifa_calculada"] if row_conta else 0.85
            dias = row_conta["dias_faturamento"] if (row_conta and row_conta["dias_faturamento"]) else 30
            
            cursor.execute(
                """
                SELECT 
                    id AS inventario_id,
                    nome_personalizado,
                    potencia_utilizada,
                    horas_dia,
                    ? AS dias_mes,
                    ROUND(((potencia_utilizada * horas_dia * ?) / 1000.0), 2) AS consumo_projetado_kwh,
                    ROUND(((potencia_utilizada * horas_dia * ?) / 1000.0) * ?, 2) AS custo_projetado_reais,
                    ROUND(((potencia_utilizada * horas_dia * ?) / 1000.0) * 0.09, 3) AS pegada_carbono_kg_co2
                FROM inventario_usuario
                WHERE residencia_id = ?
                ORDER BY consumo_projetado_kwh DESC;
                """,
                (dias, dias, dias, tarifa, dias, id)
            )
        else:
            # Comportamento padrão por View (Tarifa mais recente)
            cursor.execute(
                """
                SELECT 
                    inventario_id,
                    nome_personalizado,
                    potencia_utilizada,
                    horas_dia,
                    dias_mes,
                    consumo_projetado_kwh,
                    custo_projetado_reais,
                    pegada_carbono_kg_co2
                FROM v_consumo_projetado_aparelhos
                WHERE residencia_id = ?
                ORDER BY consumo_projetado_kwh DESC;
                """,
                (id,)
            )
            
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

@app.get("/residencias/{id}/simulador-e-se", status_code=status.HTTP_200_OK)
def obter_simulacao_e_se(id: int):
    """
    Consome a View 'v_simulador_modo_e_se' servindo como o motor lógico do modo simulador 'E se?'.
    Projeta instantaneamente economias físicas, financeiras e ecológicas em três faixas de redução: 10%, 20% e 30%.
    """
    verificar_residencia_existe(id)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT 
                inventario_id,
                nome_personalizado,
                consumo_projetado_kwh,
                custo_projetado_reais,
                pegada_carbono_kg_co2,
                economia_financeira_10pct,
                economia_co2_10pct,
                economia_financeira_20pct,
                economia_co2_20pct,
                economia_financeira_30pct,
                economia_co2_30pct
            FROM v_simulador_modo_e_se
            WHERE residencia_id = ?
            ORDER BY consumo_projetado_kwh DESC;
            """,
            (id,)
        )
        rows = cursor.fetchall()
        
        aparelhos = [dict(row) for row in rows]
        
        consolidado = {
            "total_atual_reais": round(sum(a["custo_projetado_reais"] for a in aparelhos), 2),
            "total_atual_co2": round(sum(a["pegada_carbono_kg_co2"] for a in aparelhos), 3),
            "economia_10pct": {
                "financeira": round(sum(a["economia_financeira_10pct"] for a in aparelhos), 2),
                "co2": round(sum(a["economia_co2_10pct"] for a in aparelhos), 3)
            },
            "economia_20pct": {
                "financeira": round(sum(a["economia_financeira_20pct"] for a in aparelhos), 2),
                "co2": round(sum(a["economia_co2_20pct"] for a in aparelhos), 3)
            },
            "economia_30pct": {
                "financeira": round(sum(a["economia_financeira_30pct"] for a in aparelhos), 2),
                "co2": round(sum(a["economia_co2_30pct"] for a in aparelhos), 3)
            }
        }
        
        return {
            "residencia_id": id,
            "simulacao_aparelhos": aparelhos,
            "consolidado_simulacao": consolidado
        }

# -----------------------------------------------------------------------------
# EXECUÇÃO DO SERVIDOR DE DESENVOLVIMENTO
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    # Inicializa o servidor local na porta 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
