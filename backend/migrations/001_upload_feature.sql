-- Migration: adiciona suporte a upload direto + controle de documentos esperados
-- Execute no SQL Editor do Supabase (gestao_docs schema)

-- 1. Torna arquivo_id_drive opcional (documentos enviados por upload não têm ID do Drive)
DO $$
BEGIN
  ALTER TABLE gestao_docs.documento ALTER COLUMN arquivo_id_drive DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Adiciona colunas de upload e extração na tabela documento
ALTER TABLE gestao_docs.documento
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS banco TEXT,
  ADD COLUMN IF NOT EXISTS conta TEXT;

-- 3. Adiciona detalhes de banco/conta/descrição na tabela tipo_documento_esperado
ALTER TABLE gestao_docs.tipo_documento_esperado
  ADD COLUMN IF NOT EXISTS banco TEXT,
  ADD COLUMN IF NOT EXISTS conta TEXT,
  ADD COLUMN IF NOT EXISTS agencia TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT;
