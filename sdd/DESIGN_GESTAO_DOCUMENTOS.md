# DESIGN: Gestão de Documentos de Clientes

> Technical design for implementing the document management system for an accounting firm

## Metadata

| Attribute | Value |
|---|---|
| **Feature** | GESTAO_DOCUMENTOS |
| **Date** | 2026-11-07 |
| **Author** | SDD Design by RDD |
| **BRAINSTORM** | `sdd/BRAINSTORM_GESTAO_DOCUMENTOS.md` |
| **DEFINE** | `sdd/DEFINE_GESTAO_DOCUMENTOS.md` |
| **UX REVIEW** | N/A |
| **LLM Prompts** | true |
| **Status** | Ready for Build |

---

## Architecture Overview

```text
  Google Drive API              AI Provider (configurável)
        │                        Claude / OpenAI / Gemini
        │  poll a cada 2 min              │
        ▼                                 ▼
┌─────────────────────────────────────────────────────┐
│              Python FastAPI Backend                  │
│                                                     │
│  ┌─────────────────┐      ┌───────────────────────┐ │
│  │  Drive Monitor  │─────▶│  Text Extractor       │ │
│  │  (APScheduler)  │      │  (pdfplumber / OCR)   │ │
│  └─────────────────┘      └───────────┬───────────┘ │
│                                       │             │
│                            ┌──────────▼──────────┐  │
│                            │  Classifier Service  │  │
│                            │  (adapter pattern)   │  │
│                            └──────────┬──────────┘  │
│                                       │             │
│  ┌─────────────────┐                  │             │
│  │  Daily Report   │                  │             │
│  │  + Email Sender │                  │             │
│  └────────┬────────┘                  │             │
└───────────┼───────────────────────────┼─────────────┘
            │                           │
            ▼                           ▼
     Email Service              Supabase (gestao_docs)
     (configurável)             PostgreSQL + RLS + Auth
                                         │
                                         ▼
                               ┌──────────────────────┐
                               │   Next.js Frontend   │
                               │   (Vercel)           │
                               │  · Dashboard         │
                               │  · Empresas          │
                               │  · Fila de Revisão   │
                               │  · Relatórios        │
                               │  · Configurações     │
                               └──────────────────────┘
```

---

## Components

| Component | Purpose | Technology / Pattern | Inputs | Outputs | Dependencies |
|---|---|---|---|---|---|
| **Drive Monitor** | Detecta arquivos novos nas pastas monitoradas a cada 2 minutos | Python, APScheduler, Google Drive API v3 | Lista de pastas cadastradas no Supabase | Arquivos novos para processamento | Supabase, Google Drive API |
| **Text Extractor** | Extrai texto de PDFs e imagens para o classificador | pdfplumber (PDF com texto), pytesseract (PDF/imagem escaneada) | Arquivo binário (PDF, PNG, JPG, TIFF) | Texto extraído (string) | — |
| **Classifier Service** | Identifica tipo de documento, mês de referência e CNPJ; roteia para revisão humana quando confiança < 0.7 | Adapter pattern — interface única, múltiplos provedores LLM | Texto extraído + nome do arquivo | ClassificationResult (tipo, mes_referencia, cnpj, confiança) | AI Provider (configurável), Text Extractor |
| **Daily Report Service** | Gera o relatório diário de erros e dispara notificações (in-app + e-mail) | Python, APScheduler (cron diário), template de e-mail | Registros de erro do dia na tabela `relatorio_erro` | Notificação in-app no Supabase + e-mail enviado | Supabase, Email Service |
| **Supabase (gestao_docs)** | Persistência, autenticação e controle de acesso por carteira | PostgreSQL, schema `gestao_docs`, RLS, Supabase Auth | Leituras/escritas dos serviços e do frontend | Dados filtrados por políticas RLS | — |
| **Next.js Frontend** | Interface web para o painel, revisão humana, relatórios, cadastro e configurações | Next.js 15, TypeScript, Supabase SSR, Tailwind CSS | Interações do usuário, dados do Supabase | Telas renderizadas; ações via API do FastAPI backend | Supabase |

---

## Key Decisions

### Decision 1: Pilha — Python (FastAPI) + Next.js

| Attribute | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-11-07 |
| **Source** | Escolha explícita do usuário (clarificação técnica) |

**Context:** O sistema combina processamento pesado de documentos com IA (ponto forte do Python) e uma interface web rápida de desenvolver (ponto forte do Next.js com Supabase).

**Choice:** Backend em Python com FastAPI; frontend em Next.js com Supabase SSR.

**Rationale:** Python tem o melhor ecossistema para leitura de PDF, OCR e integração com provedores de IA (Claude, OpenAI, Gemini). Next.js tem integração nativa com Supabase Auth e facilita o deploy na Vercel.

**Alternatives Rejected:**
1. Next.js full-stack (TypeScript puro) — SDK de IA e bibliotecas de PDF são mais limitadas em JavaScript.
2. Python + React (sem Next.js) — React puro exigiria mais trabalho manual para autenticação e roteamento.

**Consequences:**
- Dois serviços para hospedar (FastAPI + Next.js).
- Comunicação via HTTP entre frontend e backend para operações que não passam direto pelo Supabase.

---

### Decision 2: Monitoramento do Drive por polling (2 minutos)

| Attribute | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-11-07 |
| **Source** | Recomendação técnica — sem objeção do usuário |

**Context:** O DEFINE exige classificação em até 5 minutos. Existem duas abordagens: polling periódico ou webhook (notificação em tempo real do Google).

**Choice:** Polling a cada 2 minutos com APScheduler dentro do FastAPI.

**Rationale:** Polling cobre o prazo de 5 minutos com folga (máximo de 2 min de espera + processamento). Não exige endereço público na internet desde o início, simplificando o ambiente de desenvolvimento e os primeiros testes com dados fictícios.

**Alternatives Rejected:**
1. Google Drive Push Notifications (webhook) — exige endpoint HTTPS público desde o primeiro dia; adiciona complexidade ao setup inicial sem benefício relevante para o volume e prazo definidos.

**Consequences:**
- Latência máxima de ~2 min entre chegada do arquivo e início da classificação.
- O serviço FastAPI deve ficar em execução contínua (não pode ser serverless sem estado).

---

### Decision 3: Provedor de IA configurável (Adapter Pattern)

| Attribute | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-11-07 |
| **Source** | Escolha explícita do usuário (clarificação técnica) |

**Context:** O classificador de documentos usa IA, mas o usuário ainda não decidiu qual provedor (Claude, OpenAI ou Gemini).

**Choice:** Interface abstrata `DocumentClassifier` com implementações separadas por provedor; o provedor ativo é selecionado pela variável de ambiente `CLASSIFIER_PROVIDER`.

**Rationale:** Permite trocar ou testar provedores sem alterar código — apenas muda-se a configuração. A interface garante que todos os provedores devolvem o mesmo formato de resposta.

**Alternatives Rejected:**
1. Escolher um provedor fixo agora — bloqueia experimentação e obriga refatoração futura.

**Consequences:**
- Três arquivos de provider a manter (`claude_provider.py`, `openai_provider.py`, `gemini_provider.py`).
- O prompt de classificação precisa funcionar bem em todos os três provedores.

---

### Decision 4: Extração de texto em duas etapas (PDF → OCR fallback)

| Attribute | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-11-07 |
| **Source** | Constraint do DEFINE (qualidade variável de documentos escaneados) |

**Context:** Documentos chegam como PDFs com texto embutido (exportados de sistemas) e como imagens escaneadas (documentos físicos). A abordagem de extração afeta a qualidade da classificação.

**Choice:** Tentar `pdfplumber` primeiro (rápido, preciso para PDFs com texto); se o texto retornado for vazio ou muito curto (< 50 chars), acionar `pytesseract` (OCR para imagens e PDFs escaneados).

**Rationale:** Evita OCR desnecessário em PDFs com texto — OCR é mais lento e sujeito a erros. O fallback automático garante cobertura para documentos escaneados sem intervenção manual.

**Alternatives Rejected:**
1. Sempre usar OCR — lento e desnecessário para PDFs gerados digitalmente.
2. Enviar o arquivo binário direto para o LLM (visão) — mais caro por token e dependente do provedor suportar imagens.

**Consequences:**
- Documentos escaneados de baixa qualidade ainda podem resultar em texto ilegível → vão para a fila de revisão humana (comportamento esperado pelo DEFINE).

---

### Decision 5: Isolamento fictício/real via coluna `is_fictional` + RLS

| Attribute | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-11-07 |
| **Source** | DEFINE — AT-008 e constraint de segurança |

**Context:** A v1 opera com dados fictícios; dados reais só entram depois. O sistema precisa de um botão que alterne entre os dois modos sem risco de mistura.

**Choice:** Todas as tabelas com dados de negócio têm coluna `is_fictional BOOLEAN`. O modo ativo é armazenado na tabela `configuracao_sistema`. Políticas RLS filtram os dados pelo modo ativo da sessão.

**Rationale:** A separação acontece no banco de dados — não no código da aplicação — eliminando o risco de um bug de código expor dados reais no modo fictício.

**Alternatives Rejected:**
1. Schemas separados (ficticio / real) — mais seguro, porém duplica migrations, RLS e toda a lógica de acesso; impraticável para um time pequeno.

**Consequences:**
- Toda query de negócio precisa incluir o filtro `is_fictional` (garantido pela RLS).
- A migração para dados reais é feita inserindo empresas com `is_fictional = false` e ativando o modo real.

---

## File Manifest

| # | File | Action | Purpose | Agent / Owner | Dependencies |
|---:|---|---|---|---|---|
| 1 | `backend/requirements.txt` | Create | Dependências Python: fastapi, uvicorn, apscheduler, pdfplumber, pytesseract, Pillow, anthropic, openai, google-generativeai, supabase, google-api-python-client, python-dotenv, resend | (general) | — |
| 2 | `backend/.env.example` | Create | Template de variáveis de ambiente (nunca commitar o `.env` real) | (general) | — |
| 3 | `backend/app/main.py` | Create | Ponto de entrada FastAPI; registra rotas; inicializa o scheduler APScheduler com os jobs de monitor e relatório | (general) | 4, 10, 14 |
| 4 | `backend/app/core/config.py` | Create | Leitura de todas as variáveis de ambiente via `pydantic-settings`; expõe objeto `settings` global | (general) | — |
| 5 | `backend/app/core/supabase.py` | Create | Cliente Supabase assíncrono; singleton reutilizável em todos os serviços | (general) | 4 |
| 6 | `backend/app/core/drive.py` | Create | Wrapper da Google Drive API v3: autenticação via Service Account, listagem de arquivos novos por pasta, download de conteúdo | (general) | 4 |
| 7 | `backend/app/services/extractor.py` | Create | Extração de texto: pdfplumber para PDFs com texto; pytesseract como fallback para imagens e PDFs escaneados | (general) | 1 |
| 8 | `backend/app/services/providers/base.py` | Create | Classe abstrata `DocumentClassifier` com método `classify(text, filename) → ClassificationResult`; define o contrato que todos os provedores devem implementar | (general) | — |
| 9 | `backend/app/services/providers/claude_provider.py` | Create | Adapter Claude (Anthropic SDK); implementa `DocumentClassifier`; chama API com o prompt de classificação; parseia JSON de resposta | (general) | 8, 21 |
| 10 | `backend/app/services/providers/openai_provider.py` | Create | Adapter OpenAI; implementa `DocumentClassifier` | (general) | 8, 21 |
| 11 | `backend/app/services/providers/gemini_provider.py` | Create | Adapter Google Gemini; implementa `DocumentClassifier` | (general) | 8, 21 |
| 12 | `backend/app/services/classifier.py` | Create | Factory que instancia o provider correto com base em `settings.CLASSIFIER_PROVIDER`; orquestra extração → classificação → roteamento (classified / wrong_folder / review_queue) | (general) | 7, 8, 9, 10, 11 |
| 13 | `backend/app/services/monitor.py` | Create | Job de monitoramento: lista arquivos novos no Drive, registra `documento` como `detectado`, dispara `classifier.py`, persiste resultado no Supabase, detecta duplicatas pelo `file_id_drive` | (general) | 5, 6, 12 |
| 14 | `backend/app/services/report.py` | Create | Job diário: agrega erros do dia na tabela `relatorio_erro`; cria notificações in-app no Supabase; aciona `email_service.py` | (general) | 5, 15 |
| 15 | `backend/app/services/email_service.py` | Create | Envio de e-mail via provedor configurável (`EMAIL_PROVIDER`: resend / smtp); recebe destinatários e corpo do relatório | (general) | 4 |
| 16 | `backend/app/api/routes/companies.py` | Create | CRUD de empresas e lista de tipos de documentos esperados; endpoint para associar empresa a pasta do Drive | (general) | 5 |
| 17 | `backend/app/api/routes/documents.py` | Create | Listagem de documentos por empresa/mês; endpoint para atualizar status manualmente | (general) | 5 |
| 18 | `backend/app/api/routes/review.py` | Create | Fila de revisão: listar pendentes, submeter classificação manual, marcar como resolvido | (general) | 5 |
| 19 | `backend/app/api/routes/reports.py` | Create | Listagem de relatórios de erro por data/empresa | (general) | 5 |
| 20 | `backend/app/models/schemas.py` | Create | Modelos Pydantic para todas as entidades: Empresa, TipoDocumentoEsperado, Documento, FilaRevisao, RelatorioErro, ClassificationResult, Funcionario | (general) | — |
| 21 | `backend/app/prompts/classify_document.txt` | Create | Template do prompt de classificação: instrução para o LLM extrair tipo, mês de referência e CNPJ do texto fornecido e retornar JSON estruturado | (general) | — |
| 22 | `backend/tests/test_classifier.py` | Create | Testes unitários do Classifier: mock do provider, roteamento por confiança, detecção de pasta errada | (general) | 12, 20 |
| 23 | `backend/tests/test_monitor.py` | Create | Testes unitários do Monitor: detecção de arquivo novo, deduplicação por `file_id_drive`, comportamento com Drive API indisponível | (general) | 13 |
| 24 | `backend/tests/test_extractor.py` | Create | Testes unitários do Extractor: PDF com texto, PDF escaneado (fallback OCR), arquivo corrompido | (general) | 7 |
| 25 | `supabase/migrations/001_initial_schema.sql` | Create | Schema completo `gestao_docs`: todas as tabelas, constraints, índices, políticas RLS e funções auxiliares | (general) | — |
| 26 | `frontend/package.json` | Create | Dependências Node: next, react, typescript, @supabase/ssr, @supabase/supabase-js, tailwindcss | (general) | — |
| 27 | `frontend/next.config.ts` | Create | Configuração Next.js: variáveis de ambiente públicas, rewrites para o FastAPI backend | (general) | — |
| 28 | `frontend/src/lib/supabase/client.ts` | Create | Supabase client para componentes de browser (Client Components) | (general) | 26 |
| 29 | `frontend/src/lib/supabase/server.ts` | Create | Supabase client para Server Components e API Routes com suporte a cookies | (general) | 26 |
| 30 | `frontend/src/types/database.ts` | Create | Tipos TypeScript gerados a partir do schema Supabase (via `supabase gen types`) | (general) | 25 |
| 31 | `frontend/src/app/layout.tsx` | Create | Layout raiz: provider de tema claro/escuro, Supabase Auth listener | (general) | 28, 29 |
| 32 | `frontend/src/app/(auth)/login/page.tsx` | Create | Tela de login com Supabase Auth (e-mail + senha); redireciona para `/dashboard` após autenticação | (general) | 29 |
| 33 | `frontend/src/app/dashboard/layout.tsx` | Create | Layout do painel: sidebar com navegação, indicador do modo fictício/real, botão de alternância | (general) | 29 |
| 34 | `frontend/src/app/dashboard/page.tsx` | Create | Visão geral: contadores de documentos classificados, pendências e erros do dia | (general) | 29, 30 |
| 35 | `frontend/src/app/dashboard/empresas/page.tsx` | Create | Lista de empresas da carteira do funcionário autenticado | (general) | 29, 30 |
| 36 | `frontend/src/app/dashboard/empresas/[id]/page.tsx` | Create | Detalhe da empresa: documentos recebidos no mês, lista de pendências, alertas de pasta errada | (general) | 29, 30 |
| 37 | `frontend/src/app/dashboard/revisao/page.tsx` | Create | Fila de revisão humana: lista de documentos não reconhecidos, formulário de classificação manual | (general) | 29, 30 |
| 38 | `frontend/src/app/dashboard/relatorios/page.tsx` | Create | Relatórios de erros: lista por data, filtro por empresa, download | (general) | 29, 30 |
| 39 | `frontend/src/app/dashboard/configuracoes/page.tsx` | Create | Configurações: alternância fictício/real, horário do relatório diário, cadastro de empresas e tipos esperados | (general) | 29, 30 |

**Total Files:** 39

### Agent Assignment Rationale

| Agent / Owner | Files Assigned | Why |
|---|---|---|
| (general) | 1–39 | Projeto novo sem catálogo de agentes especializados cadastrado |

**Agent Discovery:** Not available — projeto greenfield, sem catálogo de agentes no repositório.

---

## Code Patterns

### Pattern 1: Interface do Classificador (Python)

```python
# backend/app/services/providers/base.py
from abc import ABC, abstractmethod
from pydantic import BaseModel

class ClassificationResult(BaseModel):
    doc_type: str | None
    mes_referencia: str | None   # formato YYYY-MM
    cnpj: str | None
    confidence: float            # 0.0 – 1.0
    raw_response: str

class DocumentClassifier(ABC):
    @abstractmethod
    async def classify(
        self, text: str, filename: str
    ) -> ClassificationResult:
        """Recebe texto extraído + nome do arquivo; retorna classificação."""
        ...
```

### Pattern 2: Job de Monitoramento do Drive (Python)

```python
# backend/app/services/monitor.py (trecho)
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job("interval", minutes=2, id="drive_monitor")
async def run_monitor():
    folders = await supabase_client.get_monitored_folders()
    for folder in folders:
        new_files = await drive_service.list_new_files(
            folder_id=folder.drive_folder_id,
            since=folder.last_checked_at,
        )
        for file_meta in new_files:
            if await supabase_client.document_exists(file_meta.id):
                continue  # deduplicação
            await process_file(file_meta, folder.empresa_id)
        await supabase_client.update_last_checked(folder.id)
```

### Pattern 3: Política RLS para Privacidade por Carteira (SQL)

```sql
-- Funcionário vê apenas documentos das empresas da sua carteira
CREATE POLICY "funcionario_ve_propria_carteira"
ON gestao_docs.documento
FOR SELECT
USING (
  empresa_id IN (
    SELECT empresa_id FROM gestao_docs.funcionario_empresa
    WHERE funcionario_id = (
      SELECT id FROM gestao_docs.funcionario
      WHERE user_id = auth.uid()
    )
  )
);

-- Filtro de modo fictício/real (aplicado em todas as tabelas de negócio)
CREATE POLICY "filtro_modo_ativo"
ON gestao_docs.documento
FOR ALL
USING (
  is_fictional = (
    SELECT modo_ficticio FROM gestao_docs.configuracao_sistema LIMIT 1
  )
);
```

### Pattern 4: Server Component com Supabase (TypeScript)

```typescript
// frontend/src/app/dashboard/empresas/page.tsx (trecho)
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function EmpresasPage() {
  const supabase = await createSupabaseServerClient();
  const { data: empresas } = await supabase
    .schema("gestao_docs")
    .from("empresa")
    .select("id, codigo, cnpj, nome")
    .order("nome");

  return <EmpresasList empresas={empresas ?? []} />;
}
```

---

## LLM Prompts

### Inventory

| # | Path / Runtime | Type | Consumer | Output Shape |
|---|---|---|---|---|
| LP-001 | `backend/app/prompts/classify_document.txt` | one-shot | `backend/app/services/classifier.py` | `{ doc_type, mes_referencia, cnpj, confidence }` |

### LP-001: Classificador de Documentos

| Attribute | Value |
|---|---|
| **Purpose** | Identificar tipo de documento, mês de referência e CNPJ a partir do texto extraído do arquivo |
| **Type** | one-shot — uma chamada por arquivo; a resposta não dispara novo ciclo |
| **Consumer** | `backend/app/services/classifier.py` → método `classify()` |
| **Tone / Audience** | N/A — saída estruturada (JSON), sem tom conversacional |
| **Input shape** | `{ filename: str, text: str }` — texto extraído (máx. ~4 000 chars); nome do arquivo para contexto adicional |
| **Output shape** | JSON: `{ "doc_type": str\|null, "mes_referencia": str\|null (YYYY-MM), "cnpj": str\|null, "confidence": float (0–1) }` |
| **Approved fallback** | Se `confidence < 0.7` ou se a resposta não for JSON válido → `doc_type = null`; documento vai para fila de revisão humana com status `nao_reconhecido` |
| **Reference material** | Lista de tipos esperados injetada no prompt em runtime: extrato, nota_fiscal, guia_pagamento, contrato, recibo, outros |
| **Settled decisions** | Provedor e modelo: TBD (configurável via `CLASSIFIER_PROVIDER`); não fixar no prompt |
| **Failure behavior** | Em erro de API ou timeout → salvar documento como `nao_reconhecido`; adicionar à fila de revisão; registrar log de erro com `file_id_drive` |

---

## Data Flow

```text
1. APScheduler dispara job a cada 2 minutos
   │
   ▼
2. Drive Monitor lista arquivos novos na pasta da empresa
   │  (filtro: modificados após `last_checked_at`)
   ▼
3. Verifica duplicata: `file_id_drive` já existe em `documento`?
   │  Sim → ignora (AT-011)
   │  Não → continua
   ▼
4. Registra `documento` com status `detectado` no Supabase
   │
   ▼
5. Text Extractor tenta pdfplumber
   │  Texto suficiente (≥ 50 chars) → usa resultado
   │  Texto insuficiente → aciona pytesseract (OCR)
   ▼
6. Classifier recebe (texto, filename) → chama AI Provider
   │
   ▼
7. AI Provider retorna ClassificationResult (tipo, mês, cnpj, confiança)
   │
   ├─ confiança ≥ 0.7 e cnpj bate com pasta → status `classificado`
   │   Atualiza documento; remove da lista de pendências
   │
   ├─ confiança ≥ 0.7 mas cnpj diverge da pasta → status `pasta_errada`
   │   Registra em `relatorio_erro`; cria alerta in-app (AT-002)
   │
   └─ confiança < 0.7 ou resposta inválida → status `nao_reconhecido`
       Insere em `fila_revisao` atribuída ao funcionário da carteira (AT-003)
   │
   ▼
8. Daily Report Job (cron, uma vez por dia)
   │
   ├─ Agrega registros de `relatorio_erro` do dia
   ├─ Cria notificação in-app no Supabase para cada destinatário
   └─ Email Service envia e-mail para gestores + funcionário responsável (AT-006)
   │
   ▼
9. Funcionário acessa painel Next.js
   ├─ Dashboard: contadores de classificados / pendentes / erros
   ├─ Fila de revisão: classifica documentos manualmente (AT-004 / AT-005)
   └─ Relatórios: consulta histórico de erros
```

**Fluxo de erro — Drive API indisponível:**

```text
Drive API retorna erro 5xx ou timeout
   │
   ▼
Monitor captura exceção → loga erro estruturado
   │
   ▼
Job não atualiza `last_checked_at` da pasta
   │
   ▼
Na próxima execução (2 min), re-tenta listar arquivos
desde o mesmo `last_checked_at` → nenhum arquivo é perdido (AT-010)
```

---

## Integration Points

| External System | Integration Type | Authentication | Direction | Failure / Retry |
|---|---|---|---|---|
| Google Drive API v3 | REST SDK (`google-api-python-client`) | Service Account JSON (nunca OAuth do usuário) | out (leitura de arquivos e metadados) | Retry exponencial até 3 tentativas; após falha, job não avança `last_checked_at` |
| Supabase (PostgreSQL + Auth) | SDK Python (`supabase-py`) + SDK JS (`@supabase/ssr`) | JWT (Supabase Auth); Service Role Key apenas no backend | bidirectional | Retry 1x; falha persistente → log + alerta operacional |
| AI Provider (Claude / OpenAI / Gemini) | REST SDK (específico por provider) | API Key via variável de ambiente | out (request de classificação) | Timeout 30s; em falha → documento vai para fila de revisão sem retry |
| Email Service (Resend / SMTP) | REST SDK ou SMTP | API Key ou credenciais SMTP via variável de ambiente | out (envio de relatório) | Retry 2x; em falha → notificação in-app ainda é criada; log de erro |

---

## Testing Strategy

| Test Type | Scope / Requirement | Files | Tools | Pass Signal |
|---|---|---|---|---|
| Unit | Classifier: roteamento por confiança, detecção de cnpj divergente, fallback por JSON inválido | `backend/tests/test_classifier.py` | pytest, unittest.mock | pytest exit 0 |
| Unit | Monitor: deduplicação por file_id_drive, comportamento sem arquivo novo, Drive API indisponível | `backend/tests/test_monitor.py` | pytest, unittest.mock | pytest exit 0 |
| Unit | Extractor: PDF com texto, PDF escaneado (mock OCR), arquivo corrompido | `backend/tests/test_extractor.py` | pytest | pytest exit 0 |
| E2E / Verify Gate | Fluxo completo: arquivo novo no Drive → classificado no painel em ≤ 5 min | Manual (ver checklist Verify Gate no DEFINE) | Checklist humano | Checklist assinado (5 de 5 passos) |

---

## Error Handling

| Error Type | Detection | Handling Strategy | Retry? | Observability |
|---|---|---|---|---|
| Drive API indisponível | Exceção HTTP 5xx ou timeout | Não avança `last_checked_at`; arquivo reprocessado na próxima rodada | Sim — próximo ciclo de 2 min (AT-010) | Log estruturado: `{"event": "drive_api_error", "folder_id": ..., "attempt": N}` |
| Arquivo duplicado | `file_id_drive` já presente em `documento` | Silenciosamente ignorado | Não | Log de debug: `{"event": "duplicate_skipped", "file_id": ...}` |
| Extração de texto vazia | `len(text) < 50` após pdfplumber | Fallback para OCR (pytesseract) | N/A — tentativa automática | Log: `{"event": "ocr_fallback", "filename": ...}` |
| AI Provider timeout / erro | Exceção SDK ou status ≥ 400 | Documento salvo como `nao_reconhecido`; inserido na fila de revisão | Não | Log de erro: `{"event": "classifier_error", "file_id": ..., "provider": ...}` |
| JSON inválido do LLM | Parse error no retorno | Confidence = 0 → fila de revisão | Não | Log: `{"event": "classifier_bad_json", "raw": ...}` |
| Supabase indisponível | Exceção SDK | Retry 1x após 5s; em falha, log crítico | Sim — 1 retry | Log crítico: `{"event": "supabase_error", "operation": ...}` |
| Email service falhou | Exceção SDK ou status ≥ 400 | Retry 2x; notificação in-app ainda criada | Sim — 2 retries | Log: `{"event": "email_error", "recipients": ..., "attempt": N}` |
| Arquivo de tipo não suportado | Extensão fora de {pdf, png, jpg, tiff, jpeg} | Documento salvo como `nao_reconhecido`; fila de revisão | Não | Log: `{"event": "unsupported_format", "filename": ...}` |

---

## Configuration

| Config Key | Type | Source / Default | Sensitive? | Description |
|---|---|---|---|---|
| `SUPABASE_URL` | string | `.env` / obrigatório | Não | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | string | `.env` / obrigatório | **Sim** | Chave de serviço do Supabase (backend apenas; nunca expor ao frontend) |
| `NEXT_PUBLIC_SUPABASE_URL` | string | `.env` / obrigatório | Não | URL pública para o cliente Next.js |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | string | `.env` / obrigatório | Não | Chave anon pública para o cliente Next.js |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | string (JSON) | `.env` / obrigatório | **Sim** | Credenciais da Service Account do Google Drive |
| `CLASSIFIER_PROVIDER` | string | `.env` / `claude` | Não | Provedor ativo: `claude`, `openai` ou `gemini` |
| `ANTHROPIC_API_KEY` | string | `.env` / condicional | **Sim** | Obrigatório se `CLASSIFIER_PROVIDER=claude` |
| `OPENAI_API_KEY` | string | `.env` / condicional | **Sim** | Obrigatório se `CLASSIFIER_PROVIDER=openai` |
| `GEMINI_API_KEY` | string | `.env` / condicional | **Sim** | Obrigatório se `CLASSIFIER_PROVIDER=gemini` |
| `CLASSIFIER_CONFIDENCE_THRESHOLD` | float | `.env` / `0.7` | Não | Confiança mínima para classificação automática |
| `DRIVE_POLL_INTERVAL_MINUTES` | int | `.env` / `2` | Não | Intervalo de polling do Drive em minutos |
| `EMAIL_PROVIDER` | string | `.env` / `resend` | Não | Provedor de e-mail: `resend` ou `smtp` |
| `EMAIL_API_KEY` | string | `.env` / condicional | **Sim** | API Key do Resend (se `EMAIL_PROVIDER=resend`) |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | string | `.env` / condicional | **Sim** | Credenciais SMTP (se `EMAIL_PROVIDER=smtp`) |
| `DAILY_REPORT_CRON` | string (cron) | `.env` / `0 7 * * 1-5` | Não | Horário do relatório diário (padrão: 7h dias úteis) |

---

## Security Considerations

- **Supabase Service Role Key** fica apenas no backend Python; nunca enviada ao frontend nem exposta em variáveis `NEXT_PUBLIC_*`.
- **RLS obrigatória**: todas as tabelas de negócio têm políticas de leitura por carteira; a Service Role Key do backend bypassa RLS intencionalmente — cada escrita do backend já valida o `empresa_id` antes.
- **Google Drive usa Service Account** (autenticação servidor-a-servidor): sem OAuth do usuário final, sem tokens armazenados no banco, sem risco de expiração de sessão interativa.
- **Chaves de API de IA** armazenadas exclusivamente em variáveis de ambiente do servidor; nunca aparecem em logs, respostas de API ou código-fonte.
- **Isolamento fictício/real via RLS**: a política `filtro_modo_ativo` é aplicada no banco — um bug no código da aplicação não consegue misturar os dois modos.
- **Validação de entrada**: endpoints FastAPI validam payloads com Pydantic; campos de CNPJ são validados por regex antes de qualquer consulta ao banco.
- **JWT do Supabase Auth**: o frontend envia o token JWT em cada requisição ao FastAPI; o backend valida o token usando a chave pública do Supabase antes de processar qualquer operação de escrita.
- **PII / dados de clientes**: CNPJs e nomes de empresas são dados sensíveis; não aparecem em logs de debug; logs de erro registram apenas IDs internos.

---

## Observability

| Aspect | Implementation | Signal / Why |
|---|---|---|
| Logging | JSON estruturado via `logging` Python + handler customizado; nível INFO em produção, DEBUG em desenvolvimento | Rastrear erros por `file_id_drive`, `empresa_id` e `event` sem expor dados sensíveis |
| Métricas | Contadores Supabase: `documento.status` agregado por dia e empresa; consultados pelo dashboard | Mede taxa de classificação automática vs. revisão humana — ligado ao critério de sucesso |
| Alertas operacionais | Se Drive API falhar 3 vezes consecutivas → entrada em `relatorio_erro` com `tipo_erro = 'sistema'` → relatório diário inclui o alerta | Garante que falhas do monitor não passem invisíveis (ligado ao DEFINE: "nenhum erro passa calado") |
| Tracing | N/A na v1 — volume e complexidade não justificam distributed tracing; adicionar se o sistema escalar para múltiplos workers | — |

---

## Requirements Traceability

| Requirement / AT | Design Element | Test / Gate |
|---|---|---|
| MUST: Classificar em ≤ 5 min | Drive Monitor (poll 2 min) + Classifier | test_monitor.py + manual-ux AT-001 |
| MUST: Detectar pasta errada | `monitor.py` — validação cnpj vs. pasta; tabela `relatorio_erro` | test_monitor.py + manual-ux AT-002 |
| MUST: Lista de pendências | Consulta Supabase: `tipo_documento_esperado` vs. `documento.status` | manual-ux AT-009 |
| MUST: Fila de revisão humana | `fila_revisao` table + `review.py` routes + tela `/revisao` | test_classifier.py + manual-ux AT-003/004/005 |
| MUST: Relatório diário (painel + e-mail) | `report.py` + `email_service.py` + notificação in-app | manual-ux AT-006 |
| MUST: Cadastro de empresas | `companies.py` routes + tabelas `empresa` e `tipo_documento_esperado` | manual-ux AT-009 |
| MUST: Privacidade por carteira | RLS policy `funcionario_ve_propria_carteira` | manual-ux AT-007 |
| MUST: Alternância fictício/real | `is_fictional` + RLS `filtro_modo_ativo` + toggle em `/configuracoes` | manual-ux AT-008 |
| AT-010: Drive API indisponível | Error handling em `monitor.py`; `last_checked_at` não avança em falha | test_monitor.py |
| AT-011: Duplicata | `UNIQUE` constraint em `documento.file_id_drive` + check em `monitor.py` | test_monitor.py |

---

## Risks and Mitigations

| Risk | Impact | Mitigation | Residual Risk |
|---|---|---|---|
| Baixa acurácia do classificador em documentos escaneados de baixa qualidade | Alto volume na fila de revisão humana | OCR fallback; threshold de confiança configurável; fila de revisão como rede de segurança | Documentos muito degradados sempre precisarão de revisão manual |
| Google Drive API rate limit (100 requests/100s por usuário) | Monitor bloqueado temporariamente | Backoff exponencial; processar arquivos em lotes; reduzir frequência de poll se necessário | Picos de chegada simultânea de muitos arquivos podem causar atraso além de 5 min |
| Provedor de IA fora do ar | Todos os novos arquivos vão para revisão humana | Arquitetura configurável permite trocar de provedor rapidamente; fila de revisão absorve a falha sem perda | Volume na fila pode aumentar durante outage prolongado |
| Mistura acidental de dados fictícios e reais | Comprometimento de dados de clientes | Isolamento via RLS no banco — não depende do código da aplicação | Baixo — a política RLS é a última linha de defesa |
| Escaneados físicos com CNPJ ilegível | Documento vai para revisão sem nenhuma sugestão útil | Pré-processamento de imagem (contraste, deskew) antes do OCR | Documentos muito danificados fisicamente não têm solução automática |

---

## Advisor Ledger

None — no formal external design review.

---

## Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-07 | SDD Design by RDD | Versão inicial a partir de DEFINE_GESTAO_DOCUMENTOS.md |

---

## Next Step

Execute o **SDD Build by RDD**.
