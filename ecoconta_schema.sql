-- =============================================================================
-- ECOCONTA DATABASE SCHEMA
-- Engenharia de Dados Sênior | SQLite 3
-- Foco: Tradução de kWh residencial em insights financeiros e ecológicos.
-- Pilares: Onboarding, Inventário Ágil, Gamificação & Simulação "E Se?"
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Configurações Globais da Sessão SQLite
-- -----------------------------------------------------------------------------
-- Garante a integridade referencial nativa do SQLite para todas as tabelas.
PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- 1. TABELA: residencias
-- -----------------------------------------------------------------------------
-- Ponto de entrada do Onboarding. Modela o local de consumo do usuário.
CREATE TABLE IF NOT EXISTS residencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL CHECK(length(trim(nome)) > 0),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. TABELA: contas_energia
-- -----------------------------------------------------------------------------
-- Registra o histórico mensal de faturamento (Passo 1 do Onboarding).
-- Permite entender a flutuação tarifária real por residência.
CREATE TABLE IF NOT EXISTS contas_energia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    residencia_id INTEGER NOT NULL,
    mes_referencia TEXT NOT NULL CHECK(mes_referencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
    consumo_kwh REAL NOT NULL CHECK(consumo_kwh > 0),
    valor_reais REAL NOT NULL CHECK(valor_reais >= 0),
    dias_faturamento INTEGER DEFAULT 30 CHECK(dias_faturamento >= 1 AND dias_faturamento <= 100),
    -- Coluna Gerada (Stored): Calcula o custo real do kWh com impostos e bandeiras inclusos.
    -- Evita divisão por zero e armazena o valor fisicamente para otimizar agregação de séries temporais.
    tarifa_calculada REAL GENERATED ALWAYS AS (
        CASE WHEN consumo_kwh > 0 THEN valor_reais / consumo_kwh ELSE 0.0 END
    ) STORED,
    
    FOREIGN KEY (residencia_id) REFERENCES residencias(id) ON DELETE CASCADE,
    -- Garante que não haverá duplicidade de fatura para a mesma residência no mesmo mês
    UNIQUE(residencia_id, mes_referencia)
);

-- -----------------------------------------------------------------------------
-- 3. TABELA: presets_eletrodomesticos
-- -----------------------------------------------------------------------------
-- Catálogo global de presets para o "Inventário Ágil". 
-- Poupa o usuário do atrito de pesquisar a potência técnica em manuais.
CREATE TABLE IF NOT EXISTS presets_eletrodomesticos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT NOT NULL CHECK(length(trim(categoria)) > 0),
    nome_comercial TEXT NOT NULL CHECK(length(trim(nome_comercial)) > 0),
    potencia_watts INTEGER NOT NULL CHECK(potencia_watts > 0)
);

-- -----------------------------------------------------------------------------
-- 4. TABELA: inventario_usuario
-- -----------------------------------------------------------------------------
-- Aparelhos cadastrados pelo usuário (Passos 2 e 3 do Onboarding).
-- Dá suporte à granularidade do consumo doméstico real.
CREATE TABLE IF NOT EXISTS inventario_usuario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    residencia_id INTEGER NOT NULL,
    preset_id INTEGER NULL, -- Opcional, permite aparelhos customizados fora do catálogo
    nome_personalizado TEXT NOT NULL CHECK(length(trim(nome_personalizado)) > 0),
    potencia_utilizada INTEGER NOT NULL CHECK(potencia_utilizada > 0),
    horas_dia REAL NOT NULL CHECK(horas_dia >= 0.0 AND horas_dia <= 24.0),
    dias_mes INTEGER DEFAULT 30 CHECK(dias_mes >= 1 AND dias_mes <= 31),
    
    FOREIGN KEY (residencia_id) REFERENCES residencias(id) ON DELETE CASCADE,
    FOREIGN KEY (preset_id) REFERENCES presets_eletrodomesticos(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- 5. TABELA: metas_economia
-- -----------------------------------------------------------------------------
-- Suporte à gamificação. Define os alvos de economia por residência.
CREATE TABLE IF NOT EXISTS metas_economia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    residencia_id INTEGER NOT NULL,
    porcentagem_meta REAL NOT NULL CHECK(porcentagem_meta > 0.0 AND porcentagem_meta < 100.0),
    ativa INTEGER DEFAULT 1 CHECK(ativa IN (0, 1)),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (residencia_id) REFERENCES residencias(id) ON DELETE CASCADE
);

-- =============================================================================
-- ÍNDICES PARA OTIMIZAÇÃO DE PERFORMANCE (INDEXING STRATEGY)
-- =============================================================================
-- Desenvolvido estrategicamente para consultas de alta frequência e buscas compostas.

-- Otimiza listagem e ordenação cronológica das faturas de energia
CREATE INDEX IF NOT EXISTS idx_contas_energia_busca 
ON contas_energia(residencia_id, mes_referencia);

-- Acelera o carregamento do inventário da casa do usuário nas telas principais
CREATE INDEX IF NOT EXISTS idx_inventario_usuario_residencia 
ON inventario_usuario(residencia_id);

-- Otimiza a catalogação rápida de presets por categoria (Ex: carregar todos os "Ar Condicionado")
CREATE INDEX IF NOT EXISTS idx_presets_categoria 
ON presets_eletrodomesticos(categoria);

-- Facilita busca por metas ativas por residência
CREATE INDEX IF NOT EXISTS idx_metas_ativas 
ON metas_economia(residencia_id) 
WHERE ativa = 1;


-- =============================================================================
-- VIEWS ANALÍTICAS DE NEGÓCIO (INSIGHTS FINANCEIROS & ECOLÓGICOS)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. VIEW: v_consumo_projetado_aparelhos
-- -----------------------------------------------------------------------------
-- Projeta o consumo individual de cada aparelho em kWh, seu custo financeiro estimado 
-- (baseado na tarifa média da residência) e sua pegada de carbono ecológica correspondente.
-- * Nota Ecológica: Fator de emissão do SIN brasileiro (Sistema Interligado Nacional) 
--   médio estimado em 0.09 kgCO2e por kWh consumido.
CREATE VIEW IF NOT EXISTS v_consumo_projetado_aparelhos AS
WITH tarifa_atual AS (
    -- Busca a tarifa calculada mais recente de cada residência
    SELECT 
        residencia_id,
        tarifa_calculada,
        dias_faturamento
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
    -- Cálculo do consumo mensal projetado (kWh)
    ROUND(((inv.potencia_utilizada * inv.horas_dia * COALESCE(ta.dias_faturamento, inv.dias_mes)) / 1000.0), 2) AS consumo_projetado_kwh,
    -- Estimativa financeira utilizando a tarifa real mais recente da residência (padrão R$ 0.85 caso não tenha conta)
    ROUND(((inv.potencia_utilizada * inv.horas_dia * COALESCE(ta.dias_faturamento, inv.dias_mes)) / 1000.0) * COALESCE(ta.tarifa_calculada, 0.85), 2) AS custo_projetado_reais,
    -- Pegada de carbono (kg CO2 equivalente)
    ROUND(((inv.potencia_utilizada * inv.horas_dia * COALESCE(ta.dias_faturamento, inv.dias_mes)) / 1000.0) * 0.09, 3) AS pegada_carbono_kg_co2
FROM inventario_usuario inv
JOIN residencias r ON inv.residencia_id = r.id
LEFT JOIN tarifa_atual ta ON inv.residencia_id = ta.residencia_id;

-- -----------------------------------------------------------------------------
-- B. VIEW: v_diagnostico_faturamento
-- -----------------------------------------------------------------------------
-- Cruza a conta de energia oficial com o inventário levantado. 
-- Mostra a acurácia do inventário do usuário e ajuda a identificar "fantasmas de consumo".
CREATE VIEW IF NOT EXISTS v_diagnostico_faturamento AS
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
    -- Desvio entre o faturado real e o estimado pelo inventário do usuário
    ROUND(c.consumo_kwh - COALESCE(i.total_kwh_projetado, 0.0), 2) AS desvio_kwh,
    -- Percentual do consumo real mapeado no inventário (acurácia do inventário)
    ROUND((COALESCE(i.total_kwh_projetado, 0.0) / c.consumo_kwh) * 100, 1) AS percentual_mapeado
FROM contas_energia c
JOIN residencias r ON c.residencia_id = r.id
LEFT JOIN consumo_inventario_por_mes i ON c.residencia_id = i.residencia_id AND c.mes_referencia = i.mes_referencia;

-- -----------------------------------------------------------------------------
-- C. VIEW: v_simulador_modo_e_se
-- -----------------------------------------------------------------------------
-- Motor lógico de simulação para o modo "E se?".
-- Fornece insights de economia financeira e ecológica para reduções padrão de uso (10%, 20% e 30%).
CREATE VIEW IF NOT EXISTS v_simulador_modo_e_se AS
SELECT 
    inventario_id,
    residencia_id,
    residencia_nome,
    nome_personalizado,
    consumo_projetado_kwh,
    custo_projetado_reais,
    pegada_carbono_kg_co2,
    
    -- Cenário 1: Redução de 10% do uso diário
    ROUND(custo_projetado_reais * 0.10, 2) AS economia_financeira_10pct,
    ROUND(pegada_carbono_kg_co2 * 0.10, 3) AS economia_co2_10pct,
    
    -- Cenário 2: Redução de 20% do uso diário
    ROUND(custo_projetado_reais * 0.20, 2) AS economia_financeira_20pct,
    ROUND(pegada_carbono_kg_co2 * 0.20, 3) AS economia_co2_20pct,
    
    -- Cenário 3: Redução de 30% do uso diário
    ROUND(custo_projetado_reais * 0.30, 2) AS economia_financeira_30pct,
    ROUND(pegada_carbono_kg_co2 * 0.30, 3) AS economia_co2_30pct
FROM v_consumo_projetado_aparelhos;


-- =============================================================================
-- DATA SEEDING (POPULAÇÃO INICIAL DE PRESETS E CASO DE TESTE)
-- =============================================================================

-- 1. Presets do Catálogo Oficial do Ecoconta (Inventário Ágil)
INSERT INTO presets_eletrodomesticos (categoria, nome_comercial, potencia_watts) VALUES
('Chuveiro', 'Elétrico Tradicional Multitemperaturas', 5500),
('Chuveiro', 'Elétrico Super Turbo Potente', 7500),
('Ar Condicionado', 'Split Inverter 9000 BTUs', 800),
('Ar Condicionado', 'Split Inverter 12000 BTUs', 1080),
('Ar Condicionado', 'Convencional 9000 BTUs', 1000),
('Geladeira', 'Frost Free Duplex Moderna', 120),  -- Potência média equivalente
('Geladeira', 'Standard 1 Porta Compacta', 80),
('Cozinha', 'Forno Micro-ondas Grande', 1200),
('Cozinha', 'Fritadeira Air Fryer', 1500),
('Cuidados Pessoais', 'Secador de Cabelo Profissional', 2000),
('Entretenimento', 'Smart TV LED 50"', 100),
('Lavanderia', 'Máquina de Lavar Roupas 12kg', 800),
('Iluminação', 'Lâmpada LED Eficiente', 9),
('Escritório', 'Computador Desktop Gamer', 350),
('Escritório', 'Notebook de Trabalho', 65);

-- 2. Registro de Demonstração (Onboarding Simulado de Exemplo)
-- Cadastro da primeira residência
INSERT INTO residencias (nome) VALUES ('Apartamento Centro');

-- Cadastro de histórico de contas (Passo 1 do Onboarding)
-- R$ 200,00 por 235 kWh -> Tarifa Calculada aprox. R$ 0.85/kWh
INSERT INTO contas_energia (residencia_id, mes_referencia, consumo_kwh, valor_reais)
VALUES (1, '2026-04', 235.0, 200.00);

-- Cadastro do Inventário do usuário (Passo 2 e 3 do Onboarding)
-- Associa os aparelhos criados na residência (id=1)
INSERT INTO inventario_usuario (residencia_id, preset_id, nome_personalizado, potencia_utilizada, horas_dia, dias_mes) VALUES
-- Chuveiro elétrico tradicional usado por 40 min por dia (0.66 h)
(1, 1, 'Chuveiro do Banheiro Social', 5500, 0.67, 30),
-- Geladeira Frost Free duplex ligada 24h (potência média considerada pelo preset)
(1, 6, 'Geladeira da Cozinha', 120, 24.0, 30),
-- Ar condicionado inverter ligado 8h por noite
(1, 3, 'Ar Condicionado do Quarto', 800, 8.0, 30),
-- Smart TV LED ligada 5h por dia
(1, 11, 'Televisão da Sala', 100, 5.0, 30),
-- 8 lâmpadas LED eficientes ligadas 6h por dia (soma de 72W de potência total)
(1, 13, 'Lâmpadas LED do Apê (x8)', 72, 6.0, 30);

-- Cadastro da Meta de Economia (Gamificação)
-- Usuário estabeleceu meta de 15% de redução
INSERT INTO metas_economia (residencia_id, porcentagem_meta, ativa) 
VALUES (1, 15.0, 1);
