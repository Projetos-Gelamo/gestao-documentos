# HANDOFF: Gestão de Documentos Contábeis

> Registro do que ficou pronto e do que vem depois. Um arquivo por feature — cada etapa nova entra como seção no topo.

## Ficha da feature

| Campo | Valor |
|---|---|
| **Objetivo** | Sistema web para escritório contábil (Gélamo Contábil) receber, classificar e controlar documentos de empresas clientes, com IA lendo e categorizando cada arquivo, alertas de divergência e histórico de exclusões. |
| **Status** | 🔨 em andamento |
| **Feito** | Login + dashboard (identidade visual Gélamo) · Upload com IA (classificação, CNPJ, banco, conta, mês) · Multi-upload com fila e timeline · Detecção de duplicatas · Alerta empresa errada (CNPJ divergente) · Soft-delete com histórico · Fila de revisão e relatório de erro para nao_reconhecido, empresa_errada, duplicata · Visão anual · Checklist mensal · Configuração de tipos esperados por empresa · Tela fila de revisão · Tela relatórios · Configuração automática de tipos esperados (botão "✨ Gerar automaticamente" na aba da empresa) |
| **Falta** | Separação nota_fiscal entrada/saída · Notificações por e-mail · SQL constraint pendente de execução pela usuária |
| **Pronto quando** | Escritório consegue cadastrar empresa nova, subir documentos, receber alertas de empresa errada e duplicata, excluir com histórico, ver checklist mensal completo, e a configuração de documentos esperados é gerada automaticamente após os primeiros uploads. |

---

## Eventos

- 2026-11-11 — Configuração automática de tipos esperados implementada (backend `POST /empresas/{id}/configuracao-automatica` + botão "✨ Gerar automaticamente" em TiposEsperadosSection.tsx).
- 2026-11-11 — Verificado: Vercel já rodava o build novo (design split-screen visível). Telas de revisão e relatórios já existiam e funcionavam — só estavam pendentes de confirmação.
- 2026-11-11 — SQL de constraint ainda pendente de execução pela usuária no Supabase SQL Editor.
- 2026-11-09 — Constraint `documento_status_check` no Supabase não incluía os novos status (`empresa_errada`, `duplicata`, `excluido`). SQL de correção passado para usuária executar no SQL Editor.
- 2026-11-09 — Vercel estava rodando build antigo (sem multi-upload). Push de redeploy feito (`4e4313c`), aguardando build terminar.
- 2026-11-09 — Decidido: duplicata vai apenas para `relatorio_erro`, não para `fila_revisao`.

---

## 2026-11-09 — Fila de revisão, relatórios e correções de deploy

### O que foi feito

**Backend (`backend/app/api/routes/upload.py` — commit `30a99ba`):**
- `empresa_errada` agora também entra na `fila_revisao` (antes só `nao_reconhecido` entrava)
- Criada entrada em `relatorio_erro` para os três status de atenção: `nao_reconhecido` (tipo_erro=`pendente_revisao`), `empresa_errada` (tipo_erro=`pasta_errada`) e `duplicata` (tipo_erro=`pasta_errada`)
- `duplicata` vai apenas para `relatorio_erro`, não para `fila_revisao` (decisão explícita da usuária)

**Banco de dados — SQL pendente de execução pela usuária:**
```sql
-- Corrigir constraint que bloqueia novos status
ALTER TABLE gestao_docs.documento
  DROP CONSTRAINT IF EXISTS documento_status_check;
ALTER TABLE gestao_docs.documento
  ADD CONSTRAINT documento_status_check
  CHECK (status IN (
    'pendente', 'classificado', 'pasta_errada', 'em_revisao',
    'revisado', 'nao_reconhecido', 'duplicata', 'empresa_errada', 'excluido'
  ));

-- Colunas de soft-delete (se ainda não executado)
ALTER TABLE gestao_docs.documento
  ADD COLUMN IF NOT EXISTS excluido_em  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS excluido_por TEXT;
```

**Frontend (commit `4e4313c`):**
- Push de redeploy para o Vercel retomar build com UploadForm multi-upload (versão anterior do Vercel estava rodando código antigo sem `multiple` no input)

**Feature proposta e detalhada (ainda não implementada):**
- Configuração automática de tipos de documentos esperados: após primeiros uploads, botão "Gerar configuração automática" analisa documentos classificados e cria entradas em `tipo_documento_esperado` automaticamente (extrato BB → `extrato_bancario · mensal`, NF → `nota_fiscal · mensal`, etc.)

### Casos e testes em aberto

- Empresa de teste: **Alpha Comércio Ltda** (CNPJ `11.111.111/0001-91`, empresa_id no Supabase — buscar em `gestao_docs.empresa`)
- Empresa de teste: **Beta Serviços S.A.** (CNPJ `22.222.222/0001-82`)
- Empresa de teste: **Gamma Indústria e Comércio ME** (CNPJ `33.333.333/0001-73`)
- Arquivos de teste em: `D:\OneDrive\ISABELLA\CURSOS\IA\PROJETO\Gestao_Documentos\docs_teste\`
  - 24 arquivos: extratos BB/Itaú/Santander × 3 empresas × PDF+XLSX, NF-e × 3 empresas × XML+PDF
  - Mês de referência nos extratos: `2026-10`; nas NFs geradas: `2024-10` (bug no gerador — não afeta o sistema)
- Teste de empresa errada: enviar `extrato_itau_alpha.pdf` na empresa Beta → deve mostrar 🚨 e criar entrada em `fila_revisao` e `relatorio_erro`
- Teste de duplicata: enviar mesmo arquivo duas vezes → segundo fica como `duplicata`, vai para `relatorio_erro` apenas

### Pendências

**🐛 Bug fix** — o que ficou quebrado, parcial ou com comportamento errado:

- Constraint `documento_status_check` no banco bloqueia inserção de `empresa_errada`, `duplicata` e `excluido` — SQL de correção passado à usuária, ainda não confirmada execução
- Vercel rodando build antigo sem multi-upload — push de redeploy feito (`4e4313c`), build em andamento
- NFs dos arquivos de teste com mês `2024-10` (deveria ser `2026-10`) — afeta apenas os arquivos de teste, não o sistema

**✨ Feature improvement** — incremento planejado:

- Configuração automática de tipos esperados: botão "Gerar configuração automática" na página da empresa → analisa documentos já classificados → cria entradas em `gestao_docs.tipo_documento_esperado` → mostra prévia para confirmação antes de salvar
- Separar `nota_fiscal` em `nota_fiscal_entrada` e `nota_fiscal_saida` nos tipos e no classificador
- Tela de fila de revisão no frontend (backend já popula `fila_revisao`, mas não há página para ver)
- Tela de relatórios no frontend (backend já popula `relatorio_erro`, mas não há página para ver)
- Notificações por e-mail para documentos não reconhecidos (SendGrid/Resend/SMTP — deferido pela usuária)

### Próximos passos

1. **Confirmar execução do SQL de constraint** — Supabase SQL Editor. Pronto quando: upload de `extrato_banco_do_brasil_beta.pdf` na empresa Alpha não retorna erro 23514.
2. **Confirmar redeploy Vercel** — acessar `https://gestao-documentos-henna.vercel.app`, abrir tela de upload de qualquer empresa. Pronto quando: botão diz "Enviar X arquivo(s)" (não "Analisar e salvar") e é possível selecionar múltiplos arquivos com Ctrl+clique.
3. **Implementar configuração automática de tipos esperados** — novo endpoint `POST /empresas/{id}/configuracao-automatica` + botão no frontend na página da empresa. Pronto quando: após enviar extrato BB, Itaú e Santander da Alpha, clicar no botão e ver os 3 itens de extrato criados em `tipo_documento_esperado`.
4. **Criar tela de fila de revisão** — rota `/dashboard/revisao` ou `/dashboard/empresas/{id}/revisao`. Pronto quando: documentos com status `nao_reconhecido` e `empresa_errada` aparecem listados com botões de ação.
5. **Criar tela de relatórios** — rota `/dashboard/relatorios`. Pronto quando: registros de `relatorio_erro` aparecem agrupados por tipo e empresa.

### Alertas — o que não quebrar

- **RLS obrigatório em todas as tabelas Supabase** — decisão explícita da usuária desde o início. Frontend nunca acessa Supabase diretamente. Fluxo sempre: Next.js → Railway API → Supabase com service_role key.
- **Soft-delete, não hard-delete** — exclusão de documento marca `excluido_em`/`excluido_por` e remove arquivo do Storage, mas mantém o registro no banco para histórico.
- **Fila de revisão**: `nao_reconhecido` e `empresa_errada` entram na fila. `duplicata` vai apenas para `relatorio_erro`.
- **Fora de escopo agora:** notificações por e-mail, separação NF entrada/saída, gestão de usuários/funcionários.

### Onde está o trabalho

- **Projeto local:** `D:\OneDrive\ISABELLA\CURSOS\IA\PROJETO\Gestao_Documentos\`
- **Repositório:** `https://github.com/Projetos-Gelamo/gestao-documentos` · branch `master`
- **Backend (Railway):** `https://gestao-documentos-production.up.railway.app`
- **Frontend (Vercel):** `https://gestao-documentos-henna.vercel.app`
- **Banco:** Supabase · schema `gestao_docs` · tabelas: `empresa`, `documento`, `fila_revisao`, `relatorio_erro`, `tipo_documento_esperado`, `checklist_mensal`
- **Arquivos de teste:** `D:\OneDrive\ISABELLA\CURSOS\IA\PROJETO\Gestao_Documentos\docs_teste\`

---

## 2026-11-09 — Identidade visual, multi-upload, exclusão e detecção de problemas

> Sessão anterior. Resumo das entregas.

- Login redesenhado: split-screen (painel esquerdo navy com "G" lettermark, painel direito branco com formulário)
- Dashboard: topbar com "GÉLAMO CONTÁBIL" em dourado, sidebar com "OPERAÇÃO CONTÁBIL", fundo bege `#f0ede8`
- Multi-upload com fila sequencial (UploadForm.tsx reescrito) — input `multiple`, drag-and-drop, barra de progresso dourada, ícones ⏳/⚙️/✓/🚨/⚠
- Detecção de duplicatas: consulta prévia antes de inserir; segundo upload do mesmo documento vira `duplicata`
- Alerta empresa errada: CNPJ extraído do documento comparado com CNPJ da empresa destino; confiança ≥ 80% e divergência → `empresa_errada` com caixa vermelha no frontend
- Soft-delete com histórico: endpoint `DELETE /documentos/{id}`, marca `excluido_em`/`excluido_por`, remove do Storage, DocumentosTable.tsx com botão 🗑, confirmação inline, toggle "Ver histórico de exclusões"
- Arquivos de teste gerados: 24 PDFs/XLSXs/XMLs em `docs_teste\` com CNPJs das 3 empresas
