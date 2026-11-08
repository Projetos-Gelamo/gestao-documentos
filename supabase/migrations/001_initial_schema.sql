-- =============================================================================
-- Gestão de Documentos — Schema inicial
-- Aplicar no SQL Editor do Supabase ou via CLI: supabase db push
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS gestao_docs;

-- ---------------------------------------------------------------------------
-- Configuração do sistema
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.configuracao_sistema (
    id              SERIAL PRIMARY KEY,
    modo_ficticio   BOOLEAN NOT NULL DEFAULT true  -- true = dados fictícios ativos
);
INSERT INTO gestao_docs.configuracao_sistema (modo_ficticio) VALUES (true);

-- ---------------------------------------------------------------------------
-- Empresa
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.empresa (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo           TEXT NOT NULL UNIQUE,
    cnpj             TEXT NOT NULL UNIQUE,
    nome             TEXT NOT NULL,
    folder_id_drive  TEXT,
    last_checked_at  TIMESTAMPTZ,
    is_fictional     BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Tipos de documento esperados por empresa
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.tipo_documento_esperado (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES gestao_docs.empresa(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL,
    periodicidade   TEXT NOT NULL DEFAULT 'mensal'
                        CHECK (periodicidade IN ('mensal','trimestral','anual','avulso')),
    UNIQUE (empresa_id, tipo)
);

-- ---------------------------------------------------------------------------
-- Documento
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.documento (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES gestao_docs.empresa(id),
    file_id_drive   TEXT NOT NULL UNIQUE,
    nome_arquivo    TEXT NOT NULL,
    tipo            TEXT,
    mes_referencia  TEXT,          -- formato YYYY-MM
    status          TEXT NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente','classificado','pasta_errada',
                                          'em_revisao','revisado','nao_reconhecido')),
    cnpj_extraido   TEXT,
    confianca       NUMERIC(4,3),
    is_fictional    BOOLEAN NOT NULL DEFAULT false,
    detectado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    classificado_em TIMESTAMPTZ
);

CREATE INDEX idx_documento_empresa_id  ON gestao_docs.documento (empresa_id);
CREATE INDEX idx_documento_status      ON gestao_docs.documento (status);
CREATE INDEX idx_documento_mes         ON gestao_docs.documento (mes_referencia);

-- ---------------------------------------------------------------------------
-- Funcionário
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.funcionario (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nome    TEXT NOT NULL,
    email   TEXT NOT NULL UNIQUE,
    perfil  TEXT NOT NULL DEFAULT 'funcionario'
                CHECK (perfil IN ('funcionario','gestor'))
);

-- ---------------------------------------------------------------------------
-- Carteira: funcionário ↔ empresa
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.funcionario_empresa (
    funcionario_id  UUID NOT NULL REFERENCES gestao_docs.funcionario(id) ON DELETE CASCADE,
    empresa_id      UUID NOT NULL REFERENCES gestao_docs.empresa(id) ON DELETE CASCADE,
    PRIMARY KEY (funcionario_id, empresa_id)
);

-- ---------------------------------------------------------------------------
-- Fila de revisão
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.fila_revisao (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id    UUID NOT NULL REFERENCES gestao_docs.documento(id) ON DELETE CASCADE,
    funcionario_id  UUID REFERENCES gestao_docs.funcionario(id),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolvido_em    TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Relatório de erro
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.relatorio_erro (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    empresa_id      UUID REFERENCES gestao_docs.empresa(id),
    documento_id    UUID REFERENCES gestao_docs.documento(id),
    tipo_erro       TEXT NOT NULL
                        CHECK (tipo_erro IN ('pasta_errada','pendente_revisao')),
    notificado_em   TIMESTAMPTZ
);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

ALTER TABLE gestao_docs.empresa               ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao_docs.documento             ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao_docs.fila_revisao          ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao_docs.funcionario           ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao_docs.funcionario_empresa   ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao_docs.relatorio_erro        ENABLE ROW LEVEL SECURITY;

-- Funcionário vê somente empresas da sua carteira
CREATE POLICY "funcionario_ve_propria_carteira"
ON gestao_docs.empresa FOR SELECT
USING (
    id IN (
        SELECT fe.empresa_id
        FROM gestao_docs.funcionario_empresa fe
        JOIN gestao_docs.funcionario f ON f.id = fe.funcionario_id
        WHERE f.user_id = auth.uid()
    )
);

-- Gestor vê todas as empresas
CREATE POLICY "gestor_ve_todas_empresas"
ON gestao_docs.empresa FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM gestao_docs.funcionario
        WHERE user_id = auth.uid() AND perfil = 'gestor'
    )
);

-- Documento: funcionário vê somente os das empresas da sua carteira
CREATE POLICY "funcionario_ve_documentos_carteira"
ON gestao_docs.documento FOR SELECT
USING (
    empresa_id IN (
        SELECT fe.empresa_id
        FROM gestao_docs.funcionario_empresa fe
        JOIN gestao_docs.funcionario f ON f.id = fe.funcionario_id
        WHERE f.user_id = auth.uid()
    )
);

-- Documento: gestor vê todos
CREATE POLICY "gestor_ve_todos_documentos"
ON gestao_docs.documento FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM gestao_docs.funcionario
        WHERE user_id = auth.uid() AND perfil = 'gestor'
    )
);

-- Filtro de modo (fictício/real) aplicado a tudo
CREATE POLICY "filtro_modo_documento"
ON gestao_docs.documento FOR ALL
USING (
    is_fictional = (SELECT modo_ficticio FROM gestao_docs.configuracao_sistema LIMIT 1)
);

CREATE POLICY "filtro_modo_empresa"
ON gestao_docs.empresa FOR ALL
USING (
    is_fictional = (SELECT modo_ficticio FROM gestao_docs.configuracao_sistema LIMIT 1)
);

-- Fila de revisão: funcionário vê itens das suas empresas
CREATE POLICY "funcionario_ve_fila_revisao"
ON gestao_docs.fila_revisao FOR SELECT
USING (
    documento_id IN (
        SELECT d.id FROM gestao_docs.documento d
        JOIN gestao_docs.funcionario_empresa fe ON fe.empresa_id = d.empresa_id
        JOIN gestao_docs.funcionario f ON f.id = fe.funcionario_id
        WHERE f.user_id = auth.uid()
    )
);

-- Relatório de erro: gestor vê tudo; funcionário vê somente das suas empresas
CREATE POLICY "gestor_ve_relatorios"
ON gestao_docs.relatorio_erro FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM gestao_docs.funcionario
        WHERE user_id = auth.uid() AND perfil = 'gestor'
    )
);

CREATE POLICY "funcionario_ve_relatorios_carteira"
ON gestao_docs.relatorio_erro FOR SELECT
USING (
    empresa_id IN (
        SELECT fe.empresa_id
        FROM gestao_docs.funcionario_empresa fe
        JOIN gestao_docs.funcionario f ON f.id = fe.funcionario_id
        WHERE f.user_id = auth.uid()
    )
);

-- =============================================================================
-- Dados fictícios iniciais (3 empresas de teste)
-- =============================================================================

INSERT INTO gestao_docs.empresa (codigo, cnpj, nome, is_fictional) VALUES
    ('EMP001', '11111111000191', 'Alpha Comércio Ltda',          true),
    ('EMP002', '22222222000182', 'Beta Serviços S.A.',            true),
    ('EMP003', '33333333000173', 'Gamma Indústria e Comércio ME', true);

INSERT INTO gestao_docs.tipo_documento_esperado (empresa_id, tipo, periodicidade)
SELECT id, unnest(ARRAY['extrato_bancario','nota_fiscal','guia_pagamento','folha_pagamento']), 'mensal'
FROM gestao_docs.empresa WHERE is_fictional = true;
