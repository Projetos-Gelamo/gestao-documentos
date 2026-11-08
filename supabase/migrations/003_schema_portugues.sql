-- =============================================================================
-- Gestão de Documentos — Schema em português (substitui 001 e 002)
-- Aplique no SQL Editor do Supabase:
--   1. Cole e execute todo o conteúdo abaixo
-- =============================================================================

-- Remove o schema anterior e recria do zero
DROP SCHEMA IF EXISTS gestao_docs CASCADE;
CREATE SCHEMA gestao_docs;

-- ---------------------------------------------------------------------------
-- configuracao_sistema
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.configuracao_sistema (
    id              SERIAL PRIMARY KEY,
    modo_ficticio   BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE  gestao_docs.configuracao_sistema           IS 'Configurações globais do sistema. Apenas um registro.';
COMMENT ON COLUMN gestao_docs.configuracao_sistema.modo_ficticio IS 'Quando verdadeiro, o sistema processa apenas empresas fictícias de teste. Quando falso, processa empresas reais.';

INSERT INTO gestao_docs.configuracao_sistema (modo_ficticio) VALUES (true);

-- ---------------------------------------------------------------------------
-- empresa
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.empresa (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo                  TEXT        NOT NULL UNIQUE,
    cnpj                    TEXT        NOT NULL UNIQUE,
    nome                    TEXT        NOT NULL,
    pasta_id_drive          TEXT,
    ultima_verificacao_em   TIMESTAMPTZ,
    ficticio                BOOLEAN     NOT NULL DEFAULT false,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  gestao_docs.empresa                           IS 'Empresas clientes do escritório de contabilidade monitoradas pelo sistema.';
COMMENT ON COLUMN gestao_docs.empresa.id                       IS 'Identificador único da empresa (UUID gerado automaticamente).';
COMMENT ON COLUMN gestao_docs.empresa.codigo                   IS 'Código interno da empresa no escritório (ex: EMP001). Deve ser único.';
COMMENT ON COLUMN gestao_docs.empresa.cnpj                     IS 'CNPJ da empresa (somente números, sem pontos ou traços). Deve ser único.';
COMMENT ON COLUMN gestao_docs.empresa.nome                     IS 'Razão social ou nome fantasia da empresa.';
COMMENT ON COLUMN gestao_docs.empresa.pasta_id_drive           IS 'ID da pasta no Google Drive monitorada para esta empresa.';
COMMENT ON COLUMN gestao_docs.empresa.ultima_verificacao_em    IS 'Data e hora da última verificação de novos arquivos no Drive para esta empresa.';
COMMENT ON COLUMN gestao_docs.empresa.ficticio                 IS 'Indica se é uma empresa fictícia de teste (true) ou uma empresa real (false).';
COMMENT ON COLUMN gestao_docs.empresa.criado_em                IS 'Data e hora em que a empresa foi cadastrada no sistema.';

-- ---------------------------------------------------------------------------
-- tipo_documento_esperado
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.tipo_documento_esperado (
    id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID  NOT NULL REFERENCES gestao_docs.empresa(id) ON DELETE CASCADE,
    tipo            TEXT  NOT NULL,
    periodicidade   TEXT  NOT NULL DEFAULT 'mensal'
                              CHECK (periodicidade IN ('mensal','trimestral','anual','avulso')),
    UNIQUE (empresa_id, tipo)
);

COMMENT ON TABLE  gestao_docs.tipo_documento_esperado              IS 'Lista de tipos de documentos que cada empresa deve enviar por período. Usada para calcular pendências.';
COMMENT ON COLUMN gestao_docs.tipo_documento_esperado.id           IS 'Identificador único do registro.';
COMMENT ON COLUMN gestao_docs.tipo_documento_esperado.empresa_id   IS 'Empresa à qual este tipo de documento pertence.';
COMMENT ON COLUMN gestao_docs.tipo_documento_esperado.tipo         IS 'Nome do tipo de documento esperado (ex: extrato_bancario, nota_fiscal, guia_pagamento).';
COMMENT ON COLUMN gestao_docs.tipo_documento_esperado.periodicidade IS 'Com que frequência este documento é esperado: mensal, trimestral, anual ou avulso.';

-- ---------------------------------------------------------------------------
-- documento
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.documento (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id       UUID        NOT NULL REFERENCES gestao_docs.empresa(id),
    arquivo_id_drive TEXT        NOT NULL UNIQUE,
    nome_arquivo     TEXT        NOT NULL,
    tipo             TEXT,
    mes_referencia   TEXT,
    status           TEXT        NOT NULL DEFAULT 'pendente'
                                     CHECK (status IN ('pendente','classificado','pasta_errada',
                                                       'em_revisao','revisado','nao_reconhecido')),
    cnpj_extraido    TEXT,
    confianca        NUMERIC(4,3),
    ficticio         BOOLEAN     NOT NULL DEFAULT false,
    detectado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    classificado_em  TIMESTAMPTZ
);

COMMENT ON TABLE  gestao_docs.documento                   IS 'Registros de todos os documentos detectados nas pastas monitoradas do Google Drive.';
COMMENT ON COLUMN gestao_docs.documento.id                IS 'Identificador único do documento (UUID gerado automaticamente).';
COMMENT ON COLUMN gestao_docs.documento.empresa_id        IS 'Empresa à qual este documento pertence (determinada pela pasta onde foi encontrado).';
COMMENT ON COLUMN gestao_docs.documento.arquivo_id_drive  IS 'ID único do arquivo no Google Drive. Usado para evitar registros duplicados.';
COMMENT ON COLUMN gestao_docs.documento.nome_arquivo      IS 'Nome original do arquivo no Google Drive.';
COMMENT ON COLUMN gestao_docs.documento.tipo              IS 'Tipo do documento identificado pelo classificador (ex: extrato_bancario, nota_fiscal). Nulo se ainda não classificado.';
COMMENT ON COLUMN gestao_docs.documento.mes_referencia    IS 'Mês de referência do documento no formato YYYY-MM (ex: 2024-03). Nulo se não identificado.';
COMMENT ON COLUMN gestao_docs.documento.status            IS 'Situação atual do documento: pendente, classificado, pasta_errada, em_revisao, revisado ou nao_reconhecido.';
COMMENT ON COLUMN gestao_docs.documento.cnpj_extraido     IS 'CNPJ encontrado no conteúdo do documento pelo classificador (somente números).';
COMMENT ON COLUMN gestao_docs.documento.confianca         IS 'Nível de confiança da classificação automática, de 0 a 1. Abaixo de 0.7 vai para revisão humana.';
COMMENT ON COLUMN gestao_docs.documento.ficticio          IS 'Indica se este documento pertence a uma empresa fictícia (true) ou real (false).';
COMMENT ON COLUMN gestao_docs.documento.detectado_em      IS 'Data e hora em que o arquivo foi detectado na pasta do Drive.';
COMMENT ON COLUMN gestao_docs.documento.classificado_em   IS 'Data e hora em que o documento foi classificado (automático ou manual). Nulo se ainda pendente.';

CREATE INDEX idx_documento_empresa_id ON gestao_docs.documento (empresa_id);
CREATE INDEX idx_documento_status     ON gestao_docs.documento (status);
CREATE INDEX idx_documento_mes        ON gestao_docs.documento (mes_referencia);

-- ---------------------------------------------------------------------------
-- funcionario
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.funcionario (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    perfil      TEXT NOT NULL DEFAULT 'funcionario'
                    CHECK (perfil IN ('funcionario','gestor'))
);

COMMENT ON TABLE  gestao_docs.funcionario            IS 'Funcionários do escritório de contabilidade com acesso ao sistema.';
COMMENT ON COLUMN gestao_docs.funcionario.id         IS 'Identificador único do funcionário.';
COMMENT ON COLUMN gestao_docs.funcionario.usuario_id IS 'ID do usuário no Supabase Auth. Vincula o funcionário à conta de login.';
COMMENT ON COLUMN gestao_docs.funcionario.nome       IS 'Nome completo do funcionário.';
COMMENT ON COLUMN gestao_docs.funcionario.email      IS 'E-mail do funcionário. Usado para envio do relatório diário de erros.';
COMMENT ON COLUMN gestao_docs.funcionario.perfil     IS 'Nível de acesso: funcionario (vê apenas sua carteira) ou gestor (vê todas as empresas).';

-- ---------------------------------------------------------------------------
-- funcionario_empresa  (carteira)
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.funcionario_empresa (
    funcionario_id  UUID NOT NULL REFERENCES gestao_docs.funcionario(id) ON DELETE CASCADE,
    empresa_id      UUID NOT NULL REFERENCES gestao_docs.empresa(id)     ON DELETE CASCADE,
    PRIMARY KEY (funcionario_id, empresa_id)
);

COMMENT ON TABLE  gestao_docs.funcionario_empresa              IS 'Carteira de cada funcionário: quais empresas estão sob sua responsabilidade. Controla o que cada um pode ver no painel.';
COMMENT ON COLUMN gestao_docs.funcionario_empresa.funcionario_id IS 'Funcionário responsável.';
COMMENT ON COLUMN gestao_docs.funcionario_empresa.empresa_id   IS 'Empresa que faz parte da carteira deste funcionário.';

-- ---------------------------------------------------------------------------
-- fila_revisao
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.fila_revisao (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id    UUID        NOT NULL REFERENCES gestao_docs.documento(id) ON DELETE CASCADE,
    funcionario_id  UUID        REFERENCES gestao_docs.funcionario(id),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolvido_em    TIMESTAMPTZ
);

COMMENT ON TABLE  gestao_docs.fila_revisao              IS 'Fila de documentos que o classificador automático não conseguiu identificar com confiança suficiente e precisam de revisão humana.';
COMMENT ON COLUMN gestao_docs.fila_revisao.id           IS 'Identificador único do item na fila.';
COMMENT ON COLUMN gestao_docs.fila_revisao.documento_id IS 'Documento que aguarda revisão.';
COMMENT ON COLUMN gestao_docs.fila_revisao.funcionario_id IS 'Funcionário que realizou a revisão. Nulo enquanto o item ainda não foi atendido.';
COMMENT ON COLUMN gestao_docs.fila_revisao.criado_em    IS 'Data e hora em que o documento entrou na fila de revisão.';
COMMENT ON COLUMN gestao_docs.fila_revisao.resolvido_em IS 'Data e hora em que a revisão foi concluída. Nulo enquanto pendente.';

-- ---------------------------------------------------------------------------
-- relatorio_erro
-- ---------------------------------------------------------------------------
CREATE TABLE gestao_docs.relatorio_erro (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    data            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    empresa_id      UUID        REFERENCES gestao_docs.empresa(id),
    documento_id    UUID        REFERENCES gestao_docs.documento(id),
    tipo_erro       TEXT        NOT NULL
                                    CHECK (tipo_erro IN ('pasta_errada','pendente_revisao')),
    notificado_em   TIMESTAMPTZ
);

COMMENT ON TABLE  gestao_docs.relatorio_erro               IS 'Registro dos erros detectados diariamente: documentos na pasta errada ou pendentes de revisão há mais de 24h.';
COMMENT ON COLUMN gestao_docs.relatorio_erro.id            IS 'Identificador único do registro de erro.';
COMMENT ON COLUMN gestao_docs.relatorio_erro.data          IS 'Data e hora em que o erro foi registrado.';
COMMENT ON COLUMN gestao_docs.relatorio_erro.empresa_id    IS 'Empresa relacionada ao erro. Pode ser nulo para erros globais.';
COMMENT ON COLUMN gestao_docs.relatorio_erro.documento_id  IS 'Documento relacionado ao erro. Pode ser nulo quando o erro é de pendência geral.';
COMMENT ON COLUMN gestao_docs.relatorio_erro.tipo_erro     IS 'Tipo do erro: pasta_errada (CNPJ não corresponde à pasta) ou pendente_revisao (documento aguarda revisão há mais de 24h).';
COMMENT ON COLUMN gestao_docs.relatorio_erro.notificado_em IS 'Data e hora em que o relatório foi enviado por e-mail e notificação. Nulo se ainda não enviado.';

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
        WHERE f.usuario_id = auth.uid()
    )
);

-- Gestor vê todas as empresas
CREATE POLICY "gestor_ve_todas_empresas"
ON gestao_docs.empresa FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM gestao_docs.funcionario
        WHERE usuario_id = auth.uid() AND perfil = 'gestor'
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
        WHERE f.usuario_id = auth.uid()
    )
);

-- Documento: gestor vê todos
CREATE POLICY "gestor_ve_todos_documentos"
ON gestao_docs.documento FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM gestao_docs.funcionario
        WHERE usuario_id = auth.uid() AND perfil = 'gestor'
    )
);

-- Filtro de modo (fictício/real) aplicado a tudo
CREATE POLICY "filtro_modo_documento"
ON gestao_docs.documento FOR ALL
USING (
    ficticio = (SELECT modo_ficticio FROM gestao_docs.configuracao_sistema LIMIT 1)
);

CREATE POLICY "filtro_modo_empresa"
ON gestao_docs.empresa FOR ALL
USING (
    ficticio = (SELECT modo_ficticio FROM gestao_docs.configuracao_sistema LIMIT 1)
);

-- Fila de revisão: funcionário vê itens das suas empresas
CREATE POLICY "funcionario_ve_fila_revisao"
ON gestao_docs.fila_revisao FOR SELECT
USING (
    documento_id IN (
        SELECT d.id FROM gestao_docs.documento d
        JOIN gestao_docs.funcionario_empresa fe ON fe.empresa_id = d.empresa_id
        JOIN gestao_docs.funcionario f ON f.id = fe.funcionario_id
        WHERE f.usuario_id = auth.uid()
    )
);

-- Relatório de erro: gestor vê tudo; funcionário vê somente das suas empresas
CREATE POLICY "gestor_ve_relatorios"
ON gestao_docs.relatorio_erro FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM gestao_docs.funcionario
        WHERE usuario_id = auth.uid() AND perfil = 'gestor'
    )
);

CREATE POLICY "funcionario_ve_relatorios_carteira"
ON gestao_docs.relatorio_erro FOR SELECT
USING (
    empresa_id IN (
        SELECT fe.empresa_id
        FROM gestao_docs.funcionario_empresa fe
        JOIN gestao_docs.funcionario f ON f.id = fe.funcionario_id
        WHERE f.usuario_id = auth.uid()
    )
);

-- =============================================================================
-- Dados fictícios iniciais (3 empresas de teste)
-- =============================================================================

INSERT INTO gestao_docs.empresa (codigo, cnpj, nome, ficticio) VALUES
    ('EMP001', '11111111000191', 'Alpha Comércio Ltda',          true),
    ('EMP002', '22222222000182', 'Beta Serviços S.A.',            true),
    ('EMP003', '33333333000173', 'Gamma Indústria e Comércio ME', true);

INSERT INTO gestao_docs.tipo_documento_esperado (empresa_id, tipo, periodicidade)
SELECT id, unnest(ARRAY['extrato_bancario','nota_fiscal','guia_pagamento','folha_pagamento']), 'mensal'
FROM gestao_docs.empresa WHERE ficticio = true;
