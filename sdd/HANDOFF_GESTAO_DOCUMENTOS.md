# HANDOFF: Gestão de Documentos Contábeis

> Registro do que ficou pronto e do que vem depois. Um arquivo por feature — cada etapa nova entra como seção no topo.

## Ficha da feature

| Campo | Valor |
|---|---|
| **Objetivo** | Sistema web para escritório contábil (Gélamo Contábil) receber, classificar e controlar documentos de empresas clientes, com IA lendo e categorizando cada arquivo, alertas de divergência e histórico de exclusões. |
| **Status** | 🔨 em andamento |
| **Feito** | Login + dashboard (identidade visual Gélamo) · Upload com IA · Multi-upload com fila · Detecção de duplicatas · Alerta empresa errada (CNPJ divergente) · Soft-delete com histórico · Fila de revisão · Tela relatórios · Visão anual · Checklist mensal · Configuração automática de tipos esperados · Novas tabelas `conta_bancaria` + `documento_esperado` · Importação de contas por planilha (com deduplicação por `banco+conta+descricao`) · Inativar/reativar contas bancárias · `controle_inicio` por empresa (meses anteriores não contam como pendência) · Detecção empresa errada via banco+conta no scan (fix `d7c603f` + sufixo OFX) · Fila Global (menu + tela + sugestão por banco+conta + auto-rotear) |
| **Falta** | Testar detecção OFX (sufixo conta) · Separação nota_fiscal entrada/saída · Notificações por e-mail |
| **Pronto quando** | Escritório consegue cadastrar empresa nova, importar contas, subir documentos, receber alertas de empresa errada (por CNPJ e por banco+conta), excluir com histórico, ver checklist mensal e visão anual com `controle_inicio` respeitado, e gerenciar a fila de espera com roteamento automático. |

---

## Eventos

- 2026-11-15 — Próxima sessão: desenvolver tela Fila de Espera (menu + gerenciamento de documentos `aguardando_roteamento`) e Automação (roteamento/processamento automático de documentos).
- 2026-11-15 — Novas tabelas `conta_bancaria` e `documento_esperado` adicionadas ao schema `gestao_docs`; Configurações migrada para usar essas tabelas; controle_inicio adicionado à tabela empresa.
- 2026-11-15 — Detecção empresa errada via banco+conta: 4 iterações de fix. Causa raiz identificada nos logs: PDF extrai conta como "agência/número" (ex: `0143/11810-7`), mas BD armazena só o número (`11810-7`). Fix `d7c603f` enviado, aguarda teste.
- 2026-11-11 — Configuração automática de tipos esperados implementada.
- 2026-11-11 — Verificado: Vercel já rodava o build novo. Telas de revisão e relatórios já existiam.
- 2026-11-09 — SQL de constraint pendente de execução pela usuária no Supabase SQL Editor.
- 2026-11-09 — Decidido: duplicata vai apenas para `relatorio_erro`, não para `fila_revisao`.

---

## 2026-11-15 — Importação de contas, controle_inicio e detecção empresa errada via banco+conta

### O que foi feito

**Novas tabelas no Supabase (schema `gestao_docs`):**
- `conta_bancaria` — cadastro das contas bancárias por empresa (banco, conta, descricao, ativo, empresa_id)
- `documento_esperado` — documentos esperados vinculados a conta_bancaria (tipo, frequencia, ativo, empresa_id, conta_bancaria_id)
- Coluna `controle_inicio CITEXT` adicionada à tabela `empresa` (formato YYYY-MM)

**Fix: deduplicação na importação de contas por planilha (`backend/app/api/routes/configuracoes.py`):**
- Chave de deduplicação era `(empresa_id, conta)` → passava a considerar só `(empresa_id, conta, descricao)` para permitir contas com mesmo número mas descrições diferentes (ex: BB RENDE FÁCIL vs Aplicação)
- `descricao` adicionada ao modelo `ContaPreviewItem` e ao endpoint `preview_importar_contas` (lê coluna F da planilha)
- Frontend `ConfiguracoesClient.tsx`: tipo `PreviewItem` ganhou campo `descricao`, payload de confirmar envia `descricao: i.descricao`
- Commits: `36c7d29`, `8389e48`

**Feature: inativar/reativar contas bancárias (`configuracoes.py` + `ConfiguracoesClient.tsx`):**
- PUT `/empresas/{empresa_id}/contas/{conta_id}` atualiza campo `ativo` e faz cascade para `documento_esperado`
- UI: botão "Inativar"/"Reativar" em cada card de conta; contas inativas com `opacity: 0.7`; contas inativas filtradas do dropdown "Conta vinculada"
- Commit: `8389e48`

**Feature: `controle_inicio` por empresa (`tipos_esperados.py` + `ConfiguracoesClient.tsx` + `AnnualView.tsx`):**
- Backend: meses antes de `controle_inicio` retornam `aplicavel: false` na visão anual; os demais retornam `aplicavel: true`
- Frontend: `AnnualView.tsx` renderiza "—" para meses inaplicáveis; totais e contadores só contam meses aplicáveis
- Configurações: input `<input type="month">` + botão Salvar no topo da aba da empresa
- Schema: `EmpresaBase` e `EmpresaUpdate` receberam `controle_inicio: str | None`
- Commits: `7ad5c37`, `811b58c`

**Fix: detecção de empresa errada via banco+conta no upload (`backend/app/api/routes/upload.py`):**

Contexto: upload de extrato de outra empresa não gerava alerta quando o PDF não tinha CNPJ legível. A detecção dependia só de CNPJ; agora tenta também pelo banco+conta cadastrado em `conta_bancaria` de outras empresas.

4 iterações:
1. `fcc7d77` — primeiro fix (join `empresa:empresa_id(nome)` no Supabase) — falhou silenciosamente, join não suportado assim no cliente Python
2. `459d0d5` — removeu join, usou `emp_nome_map` derivado de `empresas_cache`, adicionou fallback conta-only (`|{c}`)
3. `9a3f8da` — adicionou logging diagnóstico para Railway logs
4. `d7c603f` (**atual, pendente de teste**) — causa raiz: PDF extrai conta como `"0143/11810-7"` (agência/número), normalizando para `"0143118107"`, mas BD armazena `"11810-7"` → `"118107"`. Fix: se `/` presente na conta extraída, tenta também só os dígitos após o `"/"` como fallback.

Logs diagnósticos usados (já removidos em `d7c603f`):
```
SCAN CONTA: banco='Itaú' conta='0143/11810-7' c='0143118107' map_keys=['itaú|118107', '|118107', ...]  match=None
```

### Casos e testes em aberto

- **Teste principal pendente:** fazer upload do extrato `Extrato Mensal Consolidado Banco Itaú Filial Mês 07-2026.pdf` na empresa errada (empresa_id `4067047c-0168-4281-b66d-ee4945fe9669`, "Hospital de Olhos Oeste" ou similar). Deve exibir o card com fundo vermelho/aviso de empresa incorreta após o fix `d7c603f`.
- Conta envolvida: Itaú agência `0143`, conta `11810-7` — pertence a outra empresa cadastrada no sistema.
- Segunda conta não testada: Itaú `0143/48871-6` (extrato "HOOP Matriz") — banco não foi extraído pelo classificador (campo `banco=None`); o fallback conta-only `|0143488716` também não bateu, pois essa conta aparentemente não está cadastrada na `conta_bancaria` de outra empresa.

### Pendências

**🐛 Bug fix** — o que ficou quebrado, parcial ou com comportamento errado:

- Fix `d7c603f` (strip agência) ainda não testado — pode estar certo, mas o upload de teste não foi feito após o deploy.
- Conta Itaú `0143/48871-6` ("HOOP Matriz"): banco não extraído pelo classificador (`banco=None`) e conta não está em `conta_bancaria` de outra empresa no BD — sem alerta mesmo com fix. Precisa verificar se essa conta deveria estar cadastrada.

**✨ Feature improvement** — incremento planejado:

- Separar `nota_fiscal` em `nota_fiscal_entrada` e `nota_fiscal_saida` nos tipos e no classificador
- Notificações por e-mail para documentos não reconhecidos (deferido pela usuária)

### Próximos passos

1. **Confirmar deploy Railway do fix `d7c603f`** — aguardar ~2 min após push; Railway mostra "Deploy succeeded" no dashboard.
2. **Testar detecção banco+conta** — fazer upload de `Extrato Mensal Consolidado Banco Itaú Filial Mês 07-2026.pdf` na empresa errada (empresa_id `4067047c-0168-4281-b66d-ee4945fe9669`). Pronto quando: card aparece com `pertence: false` (fundo vermelho) e botão "→ Enviar para [empresa certa]".
3. **Verificar conta HOOP Matriz** — conferir no Supabase se conta Itaú `0143/48871-6` está cadastrada em `conta_bancaria` de alguma empresa. SQL: `SELECT * FROM gestao_docs.conta_bancaria WHERE conta LIKE '%48871%';`. Se não estiver, cadastrá-la pela tela de Configurações antes de testar.
4. **Se bug persistir:** verificar Railway logs, linha `SCAN CONTA:` — se não aparecer é porque os logs de debug foram removidos. Pode adicionar temporariamente um `logger.info("SCAN debug: c_full=%s c_sem_ag=%s keys=%s", c_full, c_sem_ag, list(conta_empresa_map.keys())[:10])` para diagnosticar.

### Alertas — o que não quebrar

- **RLS obrigatório em todas as tabelas Supabase** — Frontend nunca acessa Supabase diretamente. Fluxo sempre: Next.js → Railway API → Supabase com service_role key.
- **Soft-delete, não hard-delete** — exclusão marca `excluido_em`/`excluido_por`, remove do Storage, mantém registro.
- **Duas tabelas de configuração coexistem:** `tipo_documento_esperado` (tabela antiga, usada por checklist/configuracao-automatica) e `documento_esperado` (tabela nova, usada por visão anual e Configurações). Não misturar as rotas.
- **Auto-create de documento_esperado:** criar `conta_bancaria` automaticamente cria `documento_esperado` do tipo `extrato_bancario` mensal vinculado.
- **Cascade ativo:** inativar `conta_bancaria` → faz cascade de `ativo=false` para todos os `documento_esperado` vinculados.
- **Fora de escopo agora:** notificações por e-mail, separação NF entrada/saída.

### Onde está o trabalho

- **Projeto local:** `D:\OneDrive\ISABELLA\CURSOS\IA\PROJETO\Gestao_Documentos\`
- **Repositório:** `https://github.com/Projetos-Gelamo/gestao-documentos` · branch `master`
- **Último commit:** `d7c603f` — fix normalizar agencia/conta no scan
- **Backend (Railway):** `https://gestao-documentos-production.up.railway.app`
- **Frontend (Vercel):** `https://gestao-documentos-henna.vercel.app`
- **Banco:** Supabase · schema `gestao_docs` · tabelas relevantes: `empresa`, `conta_bancaria`, `documento_esperado`, `documento`, `fila_revisao`, `relatorio_erro`, `tipo_documento_esperado`

---

## 2026-11-11 — Fila de revisão, relatórios, configuração automática e correções de deploy

> Sessão anterior — resumo das entregas.

- Configuração automática de tipos esperados implementada: `POST /empresas/{id}/configuracao-automatica` + botão "✨ Gerar automaticamente" em `TiposEsperadosSection.tsx`
- Verificado que Vercel já rodava build novo (design split-screen visível)
- Telas de revisão e relatórios já existiam e funcionavam — confirmadas nesta sessão
- SQL de constraint ainda pendente (ver seção 2026-11-09)

---

## 2026-11-09 — Fila de revisão, relatórios e correções de deploy

> Sessão anterior — resumo das entregas.

- `empresa_errada` e `nao_reconhecido` entram em `fila_revisao`; `duplicata` só em `relatorio_erro`
- Push de redeploy Vercel (`4e4313c`) para retomar build com UploadForm multi-upload
- SQL de constraint `documento_status_check` passado à usuária para executar no Supabase SQL Editor

---

## 2026-11-09 — Identidade visual, multi-upload, exclusão e detecção de problemas

> Sessão anterior — resumo das entregas.

- Login redesenhado: split-screen com painel navy + painel branco
- Multi-upload com fila sequencial, drag-and-drop, barra de progresso dourada
- Detecção de duplicatas e alerta empresa errada por CNPJ
- Soft-delete com histórico e toggle "Ver histórico de exclusões"
- 24 arquivos de teste gerados em `docs_teste\`
