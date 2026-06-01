CREATE DATABASE IF NOT EXISTS ecoconta;
USE ecoconta;

-- -----------------------------------------------------------------------------
-- 1. TABELA: usuarios
-- -----------------------------------------------------------------------------
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_nome_usuario CHECK (LENGTH(TRIM(nome)) > 0),
    CONSTRAINT chk_email_usuario CHECK (email LIKE '%_@__%.__%'),
    CONSTRAINT chk_senha_usuario CHECK (LENGTH(senha_hash) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. TABELA: residencias
-- -----------------------------------------------------------------------------
CREATE TABLE residencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    usuario_id INT DEFAULT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_nome_residencia CHECK (LENGTH(TRIM(nome)) > 0),
    CONSTRAINT fk_residencia_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. TABELA: contas_energia
-- -----------------------------------------------------------------------------
CREATE TABLE contas_energia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    residencia_id INT NOT NULL,
    mes_referencia VARCHAR(7) NOT NULL, -- Formato YYYY-MM
    consumo_kwh DECIMAL(10, 2) NOT NULL,
    valor_reais DECIMAL(10, 2) NOT NULL,
    dias_faturamento INT DEFAULT 30,
    -- Coluna Gerada (Stored): Calcula a tarifa real com impostos inclusos
    tarifa_calculada DECIMAL(10, 4) GENERATED ALWAYS AS (
        CASE WHEN consumo_kwh > 0 THEN valor_reais / consumo_kwh ELSE 0.0 END
    ) STORED,
    
    CONSTRAINT fk_residencia_conta FOREIGN KEY (residencia_id) REFERENCES residencias(id) ON DELETE CASCADE,
    CONSTRAINT uq_residencia_mes UNIQUE (residencia_id, mes_referencia),
    CONSTRAINT chk_mes_referencia CHECK (mes_referencia REGEXP '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT chk_consumo_kwh CHECK (consumo_kwh > 0),
    CONSTRAINT chk_valor_reais CHECK (valor_reais >= 0),
    CONSTRAINT chk_dias_faturamento CHECK (dias_faturamento >= 1 AND dias_faturamento <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. TABELA: presets_eletrodomesticos
-- -----------------------------------------------------------------------------
CREATE TABLE presets_eletrodomesticos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    categoria VARCHAR(100) NOT NULL,
    nome_comercial VARCHAR(100) NOT NULL,
    potencia_watts INT NOT NULL,
    CONSTRAINT chk_categoria CHECK (LENGTH(TRIM(categoria)) > 0),
    CONSTRAINT chk_nome_comercial CHECK (LENGTH(TRIM(nome_comercial)) > 0),
    CONSTRAINT chk_potencia CHECK (potencia_watts > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. TABELA: inventario_usuario
-- -----------------------------------------------------------------------------
CREATE TABLE inventario_usuario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    residencia_id INT NOT NULL,
    preset_id INT NULL,
    nome_personalizado VARCHAR(100) NOT NULL,
    potencia_utilizada INT NOT NULL,
    horas_dia DECIMAL(4, 2) NOT NULL,
    dias_mes INT DEFAULT 30,
    
    CONSTRAINT fk_residencia_inventario FOREIGN KEY (residencia_id) REFERENCES residencias(id) ON DELETE CASCADE,
    CONSTRAINT fk_preset_inventario FOREIGN KEY (preset_id) REFERENCES presets_eletrodomesticos(id) ON DELETE SET NULL,
    CONSTRAINT chk_nome_pers CHECK (LENGTH(TRIM(nome_personalizado)) > 0),
    CONSTRAINT chk_potencia_ut CHECK (potencia_utilizada > 0),
    CONSTRAINT chk_horas_dia CHECK (horas_dia >= 0.0 AND horas_dia <= 24.0),
    CONSTRAINT chk_dias_mes CHECK (dias_mes >= 1 AND dias_mes <= 31)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. TABELA: metas_economia
-- -----------------------------------------------------------------------------
CREATE TABLE metas_economia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    residencia_id INT NOT NULL,
    porcentagem_meta DECIMAL(5, 2) NOT NULL,
    ativa TINYINT DEFAULT 1,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_residencia_meta FOREIGN KEY (residencia_id) REFERENCES residencias(id) ON DELETE CASCADE,
    CONSTRAINT chk_meta CHECK (porcentagem_meta > 0.0 AND porcentagem_meta < 100.0),
    CONSTRAINT chk_ativa CHECK (ativa IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ÍNDICES PARA OTIMIZAÇÃO DE PERFORMANCE (INDEXING STRATEGY)
-- =============================================================================
CREATE INDEX idx_contas_energia_busca ON contas_energia(residencia_id, mes_referencia);
CREATE INDEX idx_inventario_usuario_residencia ON inventario_usuario(residencia_id);
CREATE INDEX idx_presets_categoria ON presets_eletrodomesticos(categoria);


-- =============================================================================
-- VIEWS ANALÍTICAS DE NEGÓCIO (INSIGHTS FINANCEIROS & ECOLÓGICOS)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. VIEW: v_consumo_projetado_aparelhos
-- -----------------------------------------------------------------------------
CREATE VIEW v_consumo_projetado_aparelhos AS
WITH tarifa_atual AS (
    SELECT 
        ce.residencia_id,
        ce.tarifa_calculada,
        ce.dias_faturamento,
        ce.mes_referencia
    FROM contas_energia ce
    INNER JOIN (
        SELECT residencia_id, MAX(mes_referencia) AS max_mes
        FROM contas_energia
        GROUP BY residencia_id
    ) max_ce ON ce.residencia_id = max_ce.residencia_id AND ce.mes_referencia = max_ce.max_mes
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
INNER JOIN residencias r ON inv.residencia_id = r.id
LEFT JOIN tarifa_atual ta ON inv.residencia_id = ta.residencia_id;

-- -----------------------------------------------------------------------------
-- B. VIEW: v_diagnostico_faturamento
-- -----------------------------------------------------------------------------
CREATE VIEW v_diagnostico_faturamento AS
WITH consumo_inventario_por_mes AS (
    SELECT 
        inv.residencia_id,
        c.mes_referencia,
        SUM(ROUND(((inv.potencia_utilizada * inv.horas_dia * COALESCE(c.dias_faturamento, 30)) / 1000.0), 2)) AS total_kwh_projetado,
        SUM(ROUND(((inv.potencia_utilizada * inv.horas_dia * COALESCE(c.dias_faturamento, 30)) / 1000.0) * c.tarifa_calculada, 2)) AS total_reais_projetado
    FROM inventario_usuario inv
    INNER JOIN contas_energia c ON inv.residencia_id = c.residencia_id
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
INNER JOIN residencias r ON c.residencia_id = r.id
LEFT JOIN consumo_inventario_por_mes i ON c.residencia_id = i.residencia_id AND c.mes_referencia = i.mes_referencia;

-- -----------------------------------------------------------------------------
-- C. VIEW: v_simulador_modo_e_se
-- -----------------------------------------------------------------------------
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


-- 1. Presets do Catálogo Oficial do Ecoconta (Inventário Ágil)
INSERT INTO presets_eletrodomesticos (categoria, nome_comercial, potencia_watts) VALUES
('Chuveiro', 'Elétrico Tradicional Multitemperaturas', 5500),
('Chuveiro', 'Elétrico Super Turbo Potente', 7500),
('Ar Condicionado', 'Split Inverter 9000 BTUs', 800),
('Ar Condicionado', 'Split Inverter 12000 BTUs', 1080),
('Ar Condicionado', 'Convencional 9000 BTUs', 1000),
('Geladeira', 'Frost Free Duplex Moderna', 120),
('Geladeira', 'Standard 1 Porta Compacta', 80),
('Cozinha', 'Forno Micro-ondas Grande', 1200),
('Cozinha', 'Fritadeira Air Fryer', 1500),
('Cuidados Pessoais', 'Secador de Cabelo Profissional', 2000),
('Entretenimento', 'Smart TV LED 50"', 100),
('Lavanderia', 'Máquina de Lavar Roupas 12kg', 800),
('Iluminação', 'Lâmpada LED Eficiente', 9),
('Escritório', 'Computador Desktop Gamer', 350),
('Escritório', 'Notebook de Trabalho', 65);

-- 2. Registro de Demonstração (Onboarding de Exemplo Inicial)
-- Cadastro da primeira residência (sem usuário vinculado inicialmente para claiming)
INSERT INTO residencias (nome, usuario_id) VALUES ('Apartamento Centro', NULL);

-- Cadastro de histórico de contas (Passo 1 do Onboarding)
INSERT INTO contas_energia (residencia_id, mes_referencia, consumo_kwh, valor_reais, dias_faturamento)
VALUES (1, '2026-04', 235.0, 200.00, 31);

-- Cadastro do Inventário do usuário (Passo 2 e 3 do Onboarding)
INSERT INTO inventario_usuario (residencia_id, preset_id, nome_personalizado, potencia_utilizada, horas_dia, dias_mes) VALUES
(1, 1, 'Chuveiro do Banheiro Social', 5500, 0.67, 30),
(1, 6, 'Geladeira da Cozinha', 120, 24.0, 30),
(1, 3, 'Ar Condicionado do Quarto', 800, 8.0, 30),
(1, 11, 'Televisão da Sala', 100, 5.0, 30),
(1, 13, 'Lâmpadas LED do Apê (x8)', 72, 6.0, 30);

-- Cadastro da Meta de Economia (Gamificação)
INSERT INTO metas_economia (residencia_id, porcentagem_meta, ativa) 
VALUES (1, 15.0, 1);
