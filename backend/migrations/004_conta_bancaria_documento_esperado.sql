-- Migration 004: tabelas de configuração por empresa
-- conta_bancaria: contas bancárias cadastradas para a empresa
-- documento_esperado: template de documentos mensais esperados

CREATE TABLE IF NOT EXISTS gestao_docs.conta_bancaria (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id  uuid NOT NULL REFERENCES gestao_docs.empresa(id) ON DELETE CASCADE,
    banco       varchar NOT NULL,
    agencia     varchar,
    conta       varchar NOT NULL,
    tipo        varchar DEFAULT 'corrente'
                  CHECK (tipo IN ('corrente', 'poupanca', 'investimento')),
    cnpj        varchar,
    ativo       boolean DEFAULT true,
    criado_em   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conta_bancaria_empresa
    ON gestao_docs.conta_bancaria(empresa_id);

ALTER TABLE gestao_docs.conta_bancaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_conta_bancaria"
    ON gestao_docs.conta_bancaria
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


CREATE TABLE IF NOT EXISTS gestao_docs.documento_esperado (
    id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id         uuid NOT NULL REFERENCES gestao_docs.empresa(id) ON DELETE CASCADE,
    conta_bancaria_id  uuid REFERENCES gestao_docs.conta_bancaria(id) ON DELETE SET NULL,
    tipo               varchar NOT NULL,
    descricao          varchar NOT NULL,
    frequencia         varchar DEFAULT 'mensal'
                         CHECK (frequencia IN ('mensal', 'trimestral', 'semestral', 'anual')),
    ativo              boolean DEFAULT true,
    criado_em          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documento_esperado_empresa
    ON gestao_docs.documento_esperado(empresa_id);

ALTER TABLE gestao_docs.documento_esperado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_documento_esperado"
    ON gestao_docs.documento_esperado
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
