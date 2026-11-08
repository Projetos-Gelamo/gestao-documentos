# DEFINE: Gestão de Documentos de Clientes

> Sistema que monitora pastas no Google Drive, classifica automaticamente os documentos recebidos por tipo, mês e empresa, detecta erros de localização e mantém o controle de pendências por empresa e por mês.

## Metadata

| Attribute | Value |
|---|---|
| **Feature** | GESTAO_DOCUMENTOS |
| **Date** | 2026-11-06 |
| **Author** | SDD Define by RDD |
| **Status** | Ready for Design |
| **Clarity Score** | 14/15 |

---

## Problem Statement

O escritório contábil com ~150 funcionários não tem visibilidade automatizada sobre documentos recebidos de clientes: ninguém sabe com precisão o que ainda falta, erros de pasta errada são descobertos tardiamente, e identificar cada arquivo consome tempo manual — tudo isso porque o sistema atual é baseado em pastas no Google Drive sem nenhuma camada de leitura ou controle.

---

## Target Users

| User | Role | Pain Point |
|---|---|---|
| Funcionário do escritório | Responsável pela carteira de clientes | Perde tempo identificando documentos manualmente; descobre erros de pasta tarde; não tem visão clara do que ainda falta por empresa e por mês |
| Gestor do escritório | Supervisão da equipe e dos clientes | Não tem visão consolidada de pendências e erros; depende de verificação manual para saber o status geral da operação |

---

## Goals

| Priority | Goal |
|---|---|
| **MUST** | Monitorar as pastas do Google Drive e classificar automaticamente cada documento novo (tipo, mês de referência, empresa via CNPJ) em até 5 minutos |
| **MUST** | Detectar e alertar quando um documento estiver na pasta errada (CNPJ do documento não bate com a empresa da pasta) |
| **MUST** | Manter a lista de documentos pendentes por empresa e por mês, calculada com base na lista configurada de tipos esperados de cada empresa |
| **MUST** | Enviar documentos não reconhecidos para a fila de revisão humana sem descartá-los |
| **MUST** | Enviar relatório diário de erros por e-mail e como notificação no painel para gestores e para o funcionário responsável pela empresa com erro |
| **MUST** | Cadastro de empresas com código, CNPJ, nome e lista configurável de tipos de documento esperados por mês |
| **MUST** | Módulo de privacidade: cada funcionário vê apenas as empresas da sua carteira |
| **MUST** | Botão de alternância dados fictícios / dados reais, com isolamento completo entre os dois modos |
| **SHOULD** | Tema claro e escuro no painel web |
| **COULD** | Contas bancárias no cadastro de empresas (adiado para v2, útil para identificar extratos) |

---

## Success Criteria

- [ ] Um arquivo salvo em pasta monitorada no Drive aparece classificado no painel em até 5 minutos
- [ ] Documentos com CNPJ que não corresponde à pasta geram alerta visível no painel e constam no relatório diário
- [ ] A lista de pendências por empresa e por mês é calculada automaticamente, sem ação manual
- [ ] Arquivos não reconhecidos aparecem na fila de revisão humana e não são descartados
- [ ] O relatório diário chega por e-mail e como notificação no painel para gestores e para o funcionário responsável pela empresa com erro
- [ ] O modo fictício processa apenas dados fictícios; o modo real não exibe nem processa dados fictícios
- [ ] Cada funcionário autenticado vê somente as empresas da sua carteira

---

## Acceptance Tests

| ID | Pattern | Critério (EARS) | Gate |
|---|---|---|---|
| AT-001 | Event-driven | **When** um novo arquivo chega em uma pasta monitorada do Drive, the system **shall** classificar o documento (tipo, mês de referência, empresa via CNPJ) em até 5 minutos e registrá-lo com status `classificado` | manual-ux |
| AT-002 | Event-driven | **When** o CNPJ extraído de um documento não corresponde ao CNPJ da empresa associada à pasta, the system **shall** marcar o documento como `pasta errada`, exibir alerta visível no painel e incluí-lo no próximo relatório diário | manual-ux |
| AT-003 | Event-driven | **When** o classificador não consegue identificar tipo, mês de referência ou empresa de um arquivo, the system **shall** adicioná-lo à fila de revisão humana com status `pendente revisão` e não descartá-lo | manual-ux |
| AT-004 | State-driven | **While** um documento tem status `pendente revisão`, the system **shall** exibi-lo para o funcionário responsável no painel de revisão e permitir a classificação manual de tipo, mês e empresa | manual-ux |
| AT-005 | Event-driven | **When** um revisor humano submete a classificação de um documento na fila de revisão, the system **shall** atualizar o status do documento para `classificado` e removê-lo da fila de pendentes | manual-ux |
| AT-006 | Event-driven | **When** o horário do relatório diário é atingido, the system **shall** enviar e-mail e criar notificação no painel para cada gestor e para cada funcionário com documentos em estado `pasta errada` ou `pendente revisão` na sua carteira | manual-ux |
| AT-007 | Event-driven | **When** um funcionário autenticado acessa o painel, the system **shall** exibir apenas as empresas da carteira desse funcionário e não expor dados de outras carteiras | manual-ux |
| AT-008 | State-driven | **While** o modo fictício está ativo, the system **shall** processar e exibir apenas dados de empresas fictícias e não ler, gravar ou exibir dados de empresas reais | manual-ux |
| AT-009 | Event-driven | **When** uma empresa é cadastrada com lista de tipos de documentos esperados, the system **shall** usar essa lista para calcular os documentos pendentes daquela empresa a cada mês | manual-ux |
| AT-010 | Unwanted | **If** a API do Google Drive se tornar indisponível, **then** the system **shall** enfileirar os trabalhos de processamento pendentes e retomar a classificação quando a conexão for restaurada, sem descartar arquivos | manual-ux |
| AT-011 | Unwanted | **If** um arquivo com conteúdo e nome idênticos ao de um documento já classificado chegar na mesma pasta da mesma empresa, **then** the system **shall** detectar a duplicidade e não criar um registro duplicado | manual-ux |

---

## Clarifications

### Session 2026-11-06

- [x] (UX flow / Integrations) Como o relatório diário de erros é entregue? → Aparece no painel como notificação E é enviado por e-mail; integrado em Goals, Success Criteria e AT-006
- [x] (NFRs) Qual é o tempo máximo aceitável para classificação após chegada do arquivo? → Até 5 minutos; integrado em Goals, Success Criteria e AT-001
- [x] (Data model) Os tipos de documento esperados são iguais para todas as empresas ou cada uma tem sua lista? → Cada empresa tem sua própria lista configurável no cadastro; integrado em Goals, Success Criteria, AT-009 e Data Model

---

## Verify Gate

```yaml
verify_gate:
  kind: manual-ux
  cmd: "N/A (manual-ux)"
  pass_when: "checklist signed"
  threshold: "—"
  manual_fallback: |
    1. Abri o painel, salvei um arquivo de extrato fictício na pasta da empresa fictícia no Drive
       e, em até 5 minutos, vi o documento aparecer classificado como "extrato" com o mês e a
       empresa corretos.
    2. Salvei um arquivo na pasta da empresa A com o CNPJ da empresa B no conteúdo e vi o alerta
       de "pasta errada" no painel e o documento incluído no relatório do dia.
    3. Salvei um arquivo que o sistema não conseguiu identificar e vi ele aparecer na fila de
       revisão humana — sem desaparecer nem ser descartado.
    4. Fiz login com um funcionário da carteira A e confirmei que apenas as empresas dessa carteira
       aparecem no painel; as empresas da carteira B não estão visíveis.
    5. Com o modo fictício ativo, salvei um documento e confirmei que nenhum dado real foi afetado;
       desativei o modo e confirmei que os dados fictícios não aparecem na visão real.
```

---

## Out of Scope

- Controle de obrigações fiscais e contábeis
- Recebimento ou padronização dos canais de chegada de documentos (WhatsApp, e-mail, sistema do cliente)
- Contas bancárias no cadastro de empresas (adiado para v2)
- Envio de documentos para o cliente
- Gestão de versões ou histórico de revisões de um mesmo documento
- Integração com outros sistemas externos além do Google Drive e Supabase

---

## Constraints

| Type | Constraint | Impact |
|---|---|---|
| Technical | Armazenamento de arquivos obrigatoriamente no Google Drive (v1) | Sistema depende da API do Google Drive para monitoramento de pastas |
| Technical | Banco de dados obrigatoriamente no Supabase, em schema dedicado | Schema isolado; usar Row Level Security para controle de privacidade por carteira |
| Technical | Qualidade variável de documentos escaneados | Classificador pode não reconhecer arquivos de baixa resolução; esses vão para a fila de revisão |
| Technical | Sem amostras reais de documentos disponíveis nesta fase | Classificador precisará ser calibrado com exemplos reais na fase de Build |
| Data | Primeira versão usa apenas 3 empresas fictícias | Dados reais de clientes só entram após validação completa com dados fictícios |
| Data | Modo fictício e modo real devem ser completamente isolados | Nenhuma escrita, leitura ou exibição cruzada entre os dois modos |
| Timeline | N/A | — |
| Resource | ~150 funcionários sem mudança de rotina | Adoção depende de zero atrito operacional — sistema age no arquivo já salvo |

---

## Technical Context

| Aspect | Value | Notes |
|---|---|---|
| **Deployment Location** | Web app (painel) + serviço de background (monitor do Drive) | O monitor roda independente do painel; ambos conectados ao Supabase |
| **KB Domains** | Google Drive API, Supabase RLS, classificação de documentos (OCR/LLM), envio de e-mail | Domínios principais a cobrir no Design |
| **IaC Impact** | New resources | Schema Supabase novo; credenciais Google Drive API; provedor de e-mail transacional |
| **LLM Prompts** | true | O classificador precisa identificar tipo de documento, mês de referência e CNPJ a partir do conteúdo de PDFs e imagens — isso implica uso de LLM ou pipeline OCR + modelo de classificação |

---

## Assumptions

| ID | Assumption | If Wrong, Impact | Validated? |
|---|---|---|---|
| A-001 | As pastas do Google Drive estão organizadas uma por empresa e podem ser mapeadas para o CNPJ da empresa no cadastro | Sem o mapeamento pasta-CNPJ, o sistema não consegue detectar pasta errada | No — validar na fase de Design |
| A-002 | O classificador consegue extrair CNPJ e tipo de documento de PDFs e imagens com qualidade suficiente para os tipos comuns (extrato, NF, guia, contrato) | Baixa taxa de reconhecimento aumenta o volume da fila de revisão humana | No — validar com amostras reais na fase de Build |
| A-003 | Funcionários se autenticam no painel web; a associação funcionário-carteira é gerenciada por um gestor dentro do próprio sistema | Se a autenticação vier de um IdP externo, o Design precisará de integração adicional | No — validar na fase de Design |
| A-004 | O horário de envio do relatório diário é configurável (padrão: uma vez ao dia em horário comercial) | Horário fixo pode não atender todos os turnos do escritório | No — confirmar no Design |

---

## Data Model Notes

Entidades principais identificadas (detalhamento no Design):

| Entidade | Campos-chave |
|---|---|
| `empresa` | id, codigo, cnpj, nome, folder_id_drive |
| `tipo_documento_esperado` | empresa_id, tipo, periodicidade (mensal / específico) |
| `documento` | id, empresa_id, file_id_drive, tipo, mes_referencia, status (classificado / nao_reconhecido / pasta_errada / em_revisao / confirmado), detectado_em, classificado_em |
| `fila_revisao` | id, documento_id, funcionario_id, criado_em, resolvido_em |
| `funcionario` | id, nome, email, perfil (funcionario / gestor) |
| `funcionario_empresa` | funcionario_id, empresa_id |
| `relatorio_erro` | id, data, empresa_id, documento_id, tipo_erro (pasta_errada / pendente_revisao) |

---

## Clarity Score Breakdown

| Element | Score (0-3) | Notes |
|---|---:|---|
| Problem | 3 | Específico: escritório contábil, 150 funcionários, três dores concretas, contexto Drive+Supabase |
| Users | 3 | Dois usuários com papéis e dores distintas claramente definidos |
| Goals | 3 | Priorizados (MUST/SHOULD/COULD), concretos e sem ambiguidade de escopo |
| Success | 2 | Maioria observável/mensurável; horário do relatório e SLA de revisão humana ficam como TBD para o Design |
| Scope | 3 | In/out of scope explícito; YAGNI aplicado; nenhuma ambiguidade de fronteira |
| **Total** | **14/15** | Acima do mínimo de 12 para prosseguir |

---

## Open Questions

- Qual provedor de e-mail transacional será usado para o relatório diário? (SendGrid, SMTP próprio, Resend etc.) — decisão de implementação, não bloqueia o Design.
- O revisor humano pode corrigir a pasta de um documento classificado como `pasta_errada` diretamente pelo painel, ou apenas reclassifica o tipo/mês? — detalhe de UX flow a definir no Design.
- Qual é o horário padrão de envio do relatório diário? — configuração a definir no Design.

---

## Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-06 | SDD Define by RDD | Versão inicial a partir de BRAINSTORM_GESTAO_DOCUMENTOS.md |

---

## Next Step

Execute o **SDD Design by RDD**.
