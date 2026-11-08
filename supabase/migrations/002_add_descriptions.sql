-- =============================================================================
-- Descrições em português para tabelas e colunas
-- Rodar no SQL Editor do Supabase após a migration 001
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tabela: configuracao_sistema
-- ---------------------------------------------------------------------------
COMMENT ON TABLE gestao_docs.configuracao_sistema IS 'Configurações globais do sistema. Apenas um registro.';
COMMENT ON COLUMN gestao_docs.configuracao_sistema.modo_ficticio IS 'Quando verdadeiro, o sistema processa apenas empresas fictícias de teste. Quando falso, processa empresas reais.';

-- ---------------------------------------------------------------------------
-- Tabela: empresa
-- ---------------------------------------------------------------------------
COMMENT ON TABLE gestao_docs.empresa IS 'Empresas clientes do escritório de contabilidade monitoradas pelo sistema.';
COMMENT ON COLUMN gestao_docs.empresa.id IS 'Identificador único da empresa (UUID gerado automaticamente).';
COMMENT ON COLUMN gestao_docs.empresa.codigo IS 'Código interno da empresa no escritório (ex: EMP001). Deve ser único.';
COMMENT ON COLUMN gestao_docs.empresa.cnpj IS 'CNPJ da empresa (somente números, sem pontos ou traços). Deve ser único.';
COMMENT ON COLUMN gestao_docs.empresa.nome IS 'Razão social ou nome fantasia da empresa.';
COMMENT ON COLUMN gestao_docs.empresa.folder_id_drive IS 'ID da pasta no Google Drive monitorada para esta empresa.';
COMMENT ON COLUMN gestao_docs.empresa.last_checked_at IS 'Data e hora da última verificação de novos arquivos no Drive para esta empresa.';
COMMENT ON COLUMN gestao_docs.empresa.is_fictional IS 'Indica se é uma empresa fictícia de teste (true) ou uma empresa real (false).';
COMMENT ON COLUMN gestao_docs.empresa.created_at IS 'Data e hora em que a empresa foi cadastrada no sistema.';

-- ---------------------------------------------------------------------------
-- Tabela: tipo_documento_esperado
-- ---------------------------------------------------------------------------
COMMENT ON TABLE gestao_docs.tipo_documento_esperado IS 'Lista de tipos de documentos que cada empresa deve enviar por período. Usada para calcular pendências.';
COMMENT ON COLUMN gestao_docs.tipo_documento_esperado.id IS 'Identificador único do registro.';
COMMENT ON COLUMN gestao_docs.tipo_documento_esperado.empresa_id IS 'Empresa à qual este tipo de documento pertence.';
COMMENT ON COLUMN gestao_docs.tipo_documento_esperado.tipo IS 'Nome do tipo de documento esperado (ex: extrato_bancario, nota_fiscal, guia_pagamento).';
COMMENT ON COLUMN gestao_docs.tipo_documento_esperado.periodicidade IS 'Com que frequência este documento é esperado: mensal, trimestral, anual ou avulso.';

-- ---------------------------------------------------------------------------
-- Tabela: documento
-- ---------------------------------------------------------------------------
COMMENT ON TABLE gestao_docs.documento IS 'Registros de todos os documentos detectados nas pastas monitoradas do Google Drive.';
COMMENT ON COLUMN gestao_docs.documento.id IS 'Identificador único do documento (UUID gerado automaticamente).';
COMMENT ON COLUMN gestao_docs.documento.empresa_id IS 'Empresa à qual este documento pertence (determinada pela pasta onde foi encontrado).';
COMMENT ON COLUMN gestao_docs.documento.file_id_drive IS 'ID único do arquivo no Google Drive. Usado para evitar registros duplicados.';
COMMENT ON COLUMN gestao_docs.documento.nome_arquivo IS 'Nome original do arquivo no Google Drive.';
COMMENT ON COLUMN gestao_docs.documento.tipo IS 'Tipo do documento identificado pelo classificador (ex: extrato_bancario, nota_fiscal). Nulo se ainda não classificado.';
COMMENT ON COLUMN gestao_docs.documento.mes_referencia IS 'Mês de referência do documento no formato YYYY-MM (ex: 2024-03). Nulo se não identificado.';
COMMENT ON COLUMN gestao_docs.documento.status IS 'Situação atual do documento: pendente, classificado, pasta_errada, em_revisao, revisado ou nao_reconhecido.';
COMMENT ON COLUMN gestao_docs.documento.cnpj_extraido IS 'CNPJ encontrado no conteúdo do documento pelo classificador (somente números).';
COMMENT ON COLUMN gestao_docs.documento.confianca IS 'Nível de confiança da classificação automática, de 0 a 1. Abaixo de 0.7 vai para revisão humana.';
COMMENT ON COLUMN gestao_docs.documento.is_fictional IS 'Indica se este documento pertence a uma empresa fictícia (true) ou real (false).';
COMMENT ON COLUMN gestao_docs.documento.detectado_em IS 'Data e hora em que o arquivo foi detectado na pasta do Drive.';
COMMENT ON COLUMN gestao_docs.documento.classificado_em IS 'Data e hora em que o documento foi classificado (automático ou manual). Nulo se ainda pendente.';

-- ---------------------------------------------------------------------------
-- Tabela: funcionario
-- ---------------------------------------------------------------------------
COMMENT ON TABLE gestao_docs.funcionario IS 'Funcionários do escritório de contabilidade com acesso ao sistema.';
COMMENT ON COLUMN gestao_docs.funcionario.id IS 'Identificador único do funcionário.';
COMMENT ON COLUMN gestao_docs.funcionario.user_id IS 'ID do usuário no Supabase Auth. Vincula o funcionário à conta de login.';
COMMENT ON COLUMN gestao_docs.funcionario.nome IS 'Nome completo do funcionário.';
COMMENT ON COLUMN gestao_docs.funcionario.email IS 'E-mail do funcionário. Usado para envio do relatório diário de erros.';
COMMENT ON COLUMN gestao_docs.funcionario.perfil IS 'Nível de acesso: funcionario (vê apenas sua carteira) ou gestor (vê todas as empresas).';

-- ---------------------------------------------------------------------------
-- Tabela: funcionario_empresa (carteira)
-- ---------------------------------------------------------------------------
COMMENT ON TABLE gestao_docs.funcionario_empresa IS 'Carteira de cada funcionário: quais empresas estão sob sua responsabilidade. Controla o que cada um pode ver no painel.';
COMMENT ON COLUMN gestao_docs.funcionario_empresa.funcionario_id IS 'Funcionário responsável.';
COMMENT ON COLUMN gestao_docs.funcionario_empresa.empresa_id IS 'Empresa que faz parte da carteira deste funcionário.';

-- ---------------------------------------------------------------------------
-- Tabela: fila_revisao
-- ---------------------------------------------------------------------------
COMMENT ON TABLE gestao_docs.fila_revisao IS 'Fila de documentos que o classificador automático não conseguiu identificar com confiança suficiente e precisam de revisão humana.';
COMMENT ON COLUMN gestao_docs.fila_revisao.id IS 'Identificador único do item na fila.';
COMMENT ON COLUMN gestao_docs.fila_revisao.documento_id IS 'Documento que aguarda revisão.';
COMMENT ON COLUMN gestao_docs.fila_revisao.funcionario_id IS 'Funcionário que realizou a revisão. Nulo enquanto o item ainda não foi atendido.';
COMMENT ON COLUMN gestao_docs.fila_revisao.criado_em IS 'Data e hora em que o documento entrou na fila de revisão.';
COMMENT ON COLUMN gestao_docs.fila_revisao.resolvido_em IS 'Data e hora em que a revisão foi concluída. Nulo enquanto pendente.';

-- ---------------------------------------------------------------------------
-- Tabela: relatorio_erro
-- ---------------------------------------------------------------------------
COMMENT ON TABLE gestao_docs.relatorio_erro IS 'Registro dos erros detectados diariamente: documentos na pasta errada ou pendentes de revisão há mais de 24h.';
COMMENT ON COLUMN gestao_docs.relatorio_erro.id IS 'Identificador único do registro de erro.';
COMMENT ON COLUMN gestao_docs.relatorio_erro.data IS 'Data e hora em que o erro foi registrado.';
COMMENT ON COLUMN gestao_docs.relatorio_erro.empresa_id IS 'Empresa relacionada ao erro. Pode ser nulo para erros globais.';
COMMENT ON COLUMN gestao_docs.relatorio_erro.documento_id IS 'Documento relacionado ao erro. Pode ser nulo quando o erro é de pendência geral.';
COMMENT ON COLUMN gestao_docs.relatorio_erro.tipo_erro IS 'Tipo do erro: pasta_errada (CNPJ não corresponde à pasta) ou pendente_revisao (documento aguarda revisão há mais de 24h).';
COMMENT ON COLUMN gestao_docs.relatorio_erro.notificado_em IS 'Data e hora em que o relatório foi enviado por e-mail e notificação. Nulo se ainda não enviado.';
