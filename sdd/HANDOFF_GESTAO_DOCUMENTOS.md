# HANDOFF: Gestão de Documentos Contábeis

> Registro do que ficou pronto e do que vem depois. Um arquivo por feature — cada etapa nova entra como seção no topo.

## Ficha da feature

| Campo | Valor |
|---|---|
| **Objetivo** | Sistema web para escritório contábil (Gélamo Contábil) receber, classificar e controlar documentos de empresas clientes, com IA lendo e categorizando cada arquivo, alertas de divergência e histórico de exclusões. |
| **Status** | 🔨 em andamento |
| **Feito** | Login + dashboard · Upload com IA · Multi-upload com fila · Detecção de duplicatas · Alerta empresa errada · Soft-delete · Fila de revisão · Relatórios · Visão anual · Checklist mensal · Configuração automática tipos esperados · `conta_bancaria` + `documento_esperado` · Importação de contas · Inativar/reativar contas · `controle_inicio` · Detecção empresa errada via banco+conta · "Aguardando Aprovação" (renomeação todo frontend) · Botões resolução de duplicatas · Fix "+ Enviar mais" (previewState + scroll) · Fix Aguardando Aprovação vazia: Promise.all sem .catch corrigido + Link→a href em todos os pontos de navegação (`53b3883`) · Backend refatorado para Vercel: pytesseract removido, Claude Vision para imagens/PDFs escaneados, `vercel.json` + `api/index.py` criados, APScheduler desativado em serverless (`ed18f14`) |
| **Falta** | **[BLOQUEADO]** Deploy backend no Vercel — conta bloqueada por 2FA sem app configurado, aguardando suporte Vercel · Testar "+ Enviar mais" e "Aguardando Aprovação" após deploy `53b3883` · Atualizar `NEXT_PUBLIC_API_URL` no frontend Vercel para nova URL do backend após deploy · Testar detecção OFX (fix `d7c603f` pendente de teste) · Verificar/cadastrar conta Itaú `0143/48871-6` ("HOOP Matriz") · Separação nota_fiscal entrada/saída · Notificações por e-mail |
| **Pronto quando** | Escritório consegue cadastrar empresa nova, importar contas, subir documentos, receber alertas de empresa errada (por CNPJ e por banco+conta), excluir com histórico, ver checklist mensal e visão anual com `controle_inicio` respeitado, e gerenciar a fila de espera com roteamento automático. |

---

## Eventos

- 2026-11-17 — Investigação root cause dos dois bugs persistentes. Fix `53b3883`: Promise.all sem .catch em carregarDados (Aguardando Aprovação vazia em silêncio), Link→a href no banner ArquivosRevisaoStep, indicador de scan lento (15s). Fix `ed18f14`: pytesseract removido do backend, Claude Vision adicionado para imagens/PDFs escaneados, arquivos Vercel criados (`backend/api/index.py`, `backend/vercel.json`). Deploy backend bloqueado: conta Vercel com 2FA sem app configurado — aguardando suporte.
- 2026-11-16 — Fila Global renomeada para "Aguardando Aprovação" em todo frontend; botões de resolução de duplicatas adicionados à tela de resultado; três fixes de UX no fluxo de upload (scroll, preview modal, router.refresh). Commits `7cd6f5f`, `da5663f`, `1522b82`, `c3678f3`.
- 2026-11-15 — Próxima sessão: desenvolver tela Fila de Espera (menu + gerenciamento de documentos `aguardando_roteamento`) e Automação (roteamento/processamento automático de documentos).
- 2026-11-15 — Novas tabelas `conta_bancaria` e `documento_esperado` adicionadas ao schema `gestao_docs`; Configurações migrada para usar essas tabelas; controle_inicio adicionado à tabela empresa.
- 2026-11-15 — Detecção empresa errada via banco+conta: 4 iterações de fix. Causa raiz identificada nos logs: PDF extrai conta como "agência/número" (ex: `0143/11810-7`), mas BD armazena só o número (`11810-7`). Fix `d7c603f` enviado, aguarda teste.
- 2026-11-11 — Configuração automática de tipos esperados implementada.
- 2026-11-11 — Verificado: Vercel já rodava o build novo. Telas de revisão e relatórios já existiam.
- 2026-11-09 — SQL de constraint pendente de execução pela usuária no Supabase SQL Editor.
- 2026-11-09 — Decidido: duplicata vai apenas para `relatorio_erro`, não para `fila_revisao`.

---

## 2026-11-17 — Fixes root cause + migração backend para Vercel (bloqueada aguardando suporte)

### O que foi feito

**Fix root cause "Aguardando Aprovação" vazia (commit `53b3883`)**
- Causa raiz: `carregarDados()` em `fila-global/page.tsx` usava `Promise.all([fetch1, fetch2]).then(...)` sem `.catch()`. Qualquer erro de rede rejeitava a Promise inteira → `setDocs` nunca chamado → tela exibia vazia sem nenhum aviso.
- Fix: `.catch(() => null)` em cada fetch; quando retorna `null`, exibe tela de erro explícita com botão "Tentar novamente".
- Fix adicional: `<Link href="/dashboard/fila-global">` esquecido no banner da `ArquivosRevisaoStep` (linha 917 de `UploadForm.tsx`) trocado por `<a href>` para forçar full-page reload (router cache do Next.js servia versão antiga).
- Fix adicional: indicador de scan lento — após 15s de processamento aparece aviso amarelo "⏳ Aguarde, o servidor está sendo iniciado" (explica cold start do Railway ao usuário).

**Migração backend para Vercel (commit `ed18f14`)**
- `backend/app/services/extractor.py`: pytesseract e pdf2image removidos (exigiam binários de sistema); imagens e PDFs escaneados retornam `""` para sinalizar visão ao classifier; `needs_vision()` e `get_image_bytes_for_vision()` adicionados; TIFF/BMP convertidos para PNG via Pillow antes do envio.
- `backend/app/services/providers/claude_provider.py`: método `_classify_vision()` adicionado — envia imagens como `type: "image"` e PDFs escaneados como `type: "document"` diretamente para Anthropic Vision API (claude-haiku-5-5); texto permanece igual quando há conteúdo extraível.
- `backend/app/services/providers/base.py`, `openai_provider.py`, `gemini_provider.py`, `classifier.py`: parâmetro `file_bytes: bytes | None = None` propagado pela cadeia.
- `backend/app/api/routes/upload.py`: ambas as chamadas de `classify_document` passam `file_bytes=content`.
- `backend/app/main.py`: APScheduler só inicia quando `VERCEL != "1"` (compatível com Railway); endpoints `POST /cron/monitor` e `POST /cron/report` adicionados para Vercel Cron Jobs.
- `backend/requirements.txt`: `pytesseract` removido.
- `backend/api/index.py` (novo): entry point `@vercel/python` que importa `app` do `app.main`.
- `backend/vercel.json` (novo): builds, routes e crons (`*/5 * * * *` para monitor, `0 10 * * 1-5` para relatório diário).

**Status do deploy backend**
- Código enviado ao GitHub (`ed18f14`). Deploy no Vercel bloqueado: conta com 2FA habilitado sem app autenticador configurado. Suporte Vercel acionado. Railway continua como backend ativo enquanto isso.

### Casos e testes em aberto

- **"Aguardando Aprovação" (fix `53b3883`)** — após recuperar acesso Vercel e confirmar deploy, acessar a tela via sidebar. Deve mostrar documentos com status `aguardando_roteamento`. Se fetch falhar, deve aparecer tela de erro vermelha (não lista vazia).
- **"Enviar Mais" (fix `53b3883`)** — fazer upload completo, clicar "+ Enviar mais", selecionar arquivo, clicar "Analisar". Se demorar > 15s, deve aparecer aviso amarelo. Deve chegar até a tela de resultado.
- **Backend Vercel** — após recuperar acesso: criar projeto separado no Vercel apontando para pasta `backend/`, configurar variáveis de ambiente (ver próximos passos), atualizar `NEXT_PUBLIC_API_URL` no frontend.

### Pendências

**🐛 Bug fix:**
- Deploy backend Vercel bloqueado por 2FA da conta — aguardando suporte Vercel para liberar acesso.
- Fixes `53b3883` deployados no frontend mas não testados pela usuária ainda.
- Fix `d7c603f` (strip agência/conta no scan — herdado): upload extrato Itaú `0143/11810-7` na empresa_id `4067047c-0168-4281-b66d-ee4945fe9669` ainda não testado.

**✨ Feature improvement:**
- Separar `nota_fiscal` em `nota_fiscal_entrada` e `nota_fiscal_saida`
- Notificações por e-mail (deferido pela usuária)
- Cron jobs do backend no Vercel precisam de plano Pro para monitor a cada 5min (free: mínimo 1x/dia)

### Próximos passos

1. **Recuperar acesso à conta Vercel** — aguardar suporte ou usar `vercel login` pela CLI (email magic link, sem 2FA). Pronto quando: acesso ao dashboard Vercel confirmado.
2. **Criar projeto backend no Vercel** — "Add New → Project" → repo `gestao-documentos` → Root Directory: `backend` → Framework: Other. Variáveis obrigatórias: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CLASSIFIER_PROVIDER=claude`. Pronto quando: deploy mostra "Ready" e `/health` retorna `{"status":"ok","serverless":true}`.
3. **Atualizar NEXT_PUBLIC_API_URL no frontend** — no painel do projeto frontend no Vercel, trocar valor para a URL do novo backend (ex: `gestao-docs-backend.vercel.app`). Pronto quando: upload de arquivo pelo frontend usa a nova URL sem erro CORS.
4. **Testar "+ Enviar mais" e "Aguardando Aprovação"** — ver "Casos e testes em aberto" acima.
5. **Desligar Railway** — apenas após confirmar que backend Vercel está estável. Pronto quando: 1 semana sem erros no Vercel.

### Alertas

- **Vercel free timeout = 10s** — scan de IA pode ultrapassar; se houver timeout 504, considerar upgrade para Pro ($20/mês) ou manter Railway como backend.
- **Railway continua ativo** — não desligar até backend Vercel testado e estável.
- **APScheduler desativado no Vercel** — monitor do Google Drive e relatório diário não rodam automaticamente; precisam dos cron jobs (`/cron/monitor` e `/cron/report`) ou de serviço externo (UptimeRobot, GitHub Actions).
- **RLS obrigatório** — frontend nunca acessa Supabase diretamente.
- **Rota `fila-global`** — URL permanece `/dashboard/fila-global`; só o label mudou para "Aguardando Aprovação".

### Onde está o trabalho

- **Projeto local:** `D:\OneDrive\ISABELLA\CURSOS\IA\PROJETO\Gestao_Documentos\`
- **Repositório:** `https://github.com/Projetos-Gelamo/gestao-documentos` · branch `master`
- **Último commit:** `ed18f14` — feat: migrar backend para Vercel — remover pytesseract, adicionar Claude Vision
- **Backend ativo (Railway):** `https://gestao-documentos-production.up.railway.app`
- **Frontend (Vercel):** `https://gestao-documentos-henna.vercel.app`
- **Backend Vercel:** ainda não criado (bloqueado por 2FA)
- **Banco:** Supabase · schema `gestao_docs`

---

## 2026-11-16 — Renomeação Aguardando Aprovação, resolução de duplicatas e fixes de UX no upload

### O que foi feito

**Renomeação "Fila Global" → "Aguardando Aprovação" (commit `7cd6f5f`)**
- `frontend/src/app/dashboard/NavLinks.tsx` — label atualizado
- `frontend/src/app/dashboard/empresas/[id]/upload/UploadForm.tsx` — todas as ocorrências (labels, chips de resumo, link, label na array de cfg)
- `frontend/src/app/dashboard/fila-global/page.tsx` — título na tela de loading

**Botões de resolução de duplicatas na tela de resultado (commit `da5663f`)**
- `UploadForm.tsx` — função `handleResolverDuplicata(docId, originalId, acao)` com três ações:
  - `"excluir"` → `DELETE /documentos/{docId}` → status vira `"excluido"` na tela
  - `"substituir"` → `POST /documentos/{docId}/substituir/{originalId}` → status vira `"classificado"`
  - `"manter"` → `POST /documentos/{docId}/manter-duplicata` → status vira `"classificado"`
- `ResultadoRow` recebe prop `onResolverDuplicata`; quando `status === "duplicata"`, mostra botões "🗑 Excluir novo", "🔄 Substituir original", "✓ Manter os 2" com loading individual
- `backend/app/api/routes/documents.py` — endpoint `POST /{documento_id}/manter-duplicata` adicionado (os outros dois já existiam)
- Status `"excluido"` adicionado ao mapa de chips de resumo

**Fix "+ Enviar mais" não seguia o processo (commits `1522b82`, `c3678f3`)**

Sintoma 1 (commit `1522b82`): após clicar "+ Enviar mais", o form resetava para o step 1 mas o scroll ficava no fundo — o usuário não via a tela de seleção e achava que o botão não reagia.
- Fix: `window.scrollTo({ top: 0, behavior: "smooth" })` no final de `resetar()`

Sintoma 2 (commit `c3678f3`): com o scroll corrigido, o usuário ainda relatou que "seleciona o arquivo mas o processo não segue". Causa raiz: se o usuário clicava em "Ver" para abrir preview e enquanto o fetch estava pendente clicava em "+ Enviar mais", o fetch resolvia depois do `resetar()` e chamava `setPreviewState(...)` — o `PreviewModal` (position: fixed, z-index 9999) aparecia por cima do step 1, cobrindo o botão "Analisar". O usuário clicava no backdrop e fechava o modal sem perceber que era o modal.
- Fix: `resetar()` agora também chama `setPreviewState(null)`, `setPreviewLoading(null)` e `inputRef.current.value = ""`
- Fix adicional: `PreviewModal` só é renderizado quando `step === "resultado"` (guard no JSX), prevenindo aparição em qualquer outro step mesmo em race conditions futuras

**Fix "Aguardando Aprovação" vazia (commit `1522b82`)**
- `frontend/src/app/dashboard/fila-global/page.tsx` — adicionado `useRouter` + `router.refresh()` no mount para invalidar cache de rota Next.js (a tela podia servir cache de 30s com a lista vazia)
- Botão "↺ Recarregar" adicionado ao cabeçalho da tela

### Casos e testes em aberto

- **Fix `c3678f3` (previewState + "+ Enviar mais")** — push feito, deploy Vercel em andamento no momento do handoff. Fluxo para testar: fazer upload de um arquivo → ver o resultado → clicar "Ver" em algum resultado → (opcional) clicar "+ Enviar mais" enquanto o preview carrega → confirmar que a segunda sequência de upload chega até a tela de resultado normalmente.
- **Fix `d7c603f` (strip agência/conta — herdado da sessão anterior)** — fazer upload de `Extrato Mensal Consolidado Banco Itaú Filial Mês 07-2026.pdf` na empresa errada (empresa_id `4067047c-0168-4281-b66d-ee4945fe9669`). Deve exibir card com `pertence: false` e sugestão de empresa certa.

### Pendências

**🐛 Bug fix** — o que ficou quebrado, parcial ou com comportamento errado:

- Fix `c3678f3` (PreviewModal bloqueando upload) enviado mas aguarda teste da usuária na versão deployada.
- Fix `d7c603f` (normalização agência/conta no scan) enviado em sessão anterior mas ainda não testado. Upload de extrato Itaú `0143/11810-7` na empresa errada deve gerar alerta; não foi confirmado.
- Conta Itaú `0143/48871-6` ("HOOP Matriz"): banco não extraído pelo classificador (`banco=None`) e conta provavelmente não cadastrada em `conta_bancaria` de outra empresa → sem alerta mesmo com fix. Verificar no Supabase: `SELECT * FROM gestao_docs.conta_bancaria WHERE conta LIKE '%48871%';`

**✨ Feature improvement** — incremento planejado:

- Separar `nota_fiscal` em `nota_fiscal_entrada` e `nota_fiscal_saida` nos tipos e no classificador
- Notificações por e-mail para documentos não reconhecidos (deferido pela usuária)

### Próximos passos

1. **Confirmar deploy do commit `c3678f3`** — Vercel mostra "Ready" no dashboard. Pronto quando: status do deploy = "Ready" com SHA `c3678f3`.
2. **Testar "+ Enviar mais" (fix `c3678f3`)** — fazer dois uploads seguidos sem navegar. Pronto quando: segundo upload chega até a tela de resultado com arquivos processados.
3. **Testar detecção banco+conta (fix `d7c603f`)** — upload do extrato Itaú (`Extrato Mensal Consolidado Banco Itaú Filial Mês 07-2026.pdf`) na empresa errada (empresa_id `4067047c-0168-4281-b66d-ee4945fe9669`). Pronto quando: card aparece com fundo vermelho e sugestão de empresa certa.
4. **Verificar conta HOOP Matriz** — no Supabase SQL Editor: `SELECT * FROM gestao_docs.conta_bancaria WHERE conta LIKE '%48871%';` Se não existir, cadastrar pela tela de Configurações antes de testar.

### Alertas — o que não quebrar

- **RLS obrigatório** — frontend nunca acessa Supabase diretamente; fluxo sempre Next.js → Railway API → Supabase service_role.
- **Soft-delete** — exclusão marca `excluido_em`/`excluido_por` e remove do Storage; nunca hard-delete direto no banco.
- **Duas tabelas de configuração coexistem:** `tipo_documento_esperado` (checklist/configuracao-automatica) e `documento_esperado` (visão anual/Configurações). Não misturar as rotas.
- **Rota `fila-global`** — a URL do menu e do link de resultado continua sendo `/dashboard/fila-global` (só o label visível mudou para "Aguardando Aprovação").
- **Fora de escopo agora:** notificações por e-mail, separação NF entrada/saída.

### Onde está o trabalho

- **Projeto local:** `D:\OneDrive\ISABELLA\CURSOS\IA\PROJETO\Gestao_Documentos\`
- **Repositório:** `https://github.com/Projetos-Gelamo/gestao-documentos` · branch `master`
- **Último commit:** `c3678f3` — fix: resetar() limpa previewState e PreviewModal só aparece no step resultado
- **Backend (Railway):** `https://gestao-documentos-production.up.railway.app`
- **Frontend (Vercel):** `https://gestao-documentos-henna.vercel.app`
- **Banco:** Supabase · schema `gestao_docs`

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
