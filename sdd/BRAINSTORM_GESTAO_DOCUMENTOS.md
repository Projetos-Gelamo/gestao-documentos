# BRAINSTORM: Gestão de Documentos de Clientes

> Sessão exploratória para clarificar a intenção e a abordagem antes da captura de requisitos

## Metadata

| Atributo | Valor |
|---|---|
| Feature | GESTAO_DOCUMENTOS |
| Data | 2026-11-06 |
| Autor | brainstorm-agent |
| Status | Handoff Ready |

## Initial Idea

**Raw Input:**
> Quero criar um sistema de gestão dos documentos que os clientes mandam para o escritório.
> Como é hoje: pedimos os documentos por WhatsApp e e-mail; quando chegam, alguém salva numa pasta do servidor do escritório (uma pasta por cliente) e depois abre para ver se está certo.
> O que quero: um cadastro de empresas com código do cliente, CNPJ, nome e contas bancárias; cada pasta ligada à empresa pelo CNPJ, não só pelo código; um leitor que identifica o tipo de cada documento (extrato, nota fiscal, guia, contrato…), o mês e a empresa, e avisa quando o documento estiver na pasta errada; a lista do que falta por empresa e por mês; o que o leitor não reconhecer vai para uma fila de revisão humana; um relatório de erros todo dia, para nenhum erro passar calado; um módulo de privacidade e tela clara e escura.
> Os dados ficam no Supabase, num schema só deste projeto.
> Nesta primeira versão vou usar 3 empresas fictícias, com pastas no meu próprio Google Drive. Quero um botão para ligar e desligar os dados fictícios; os dados reais só entram depois de tudo testado.
> O controle de obrigações fica fora deste projeto por enquanto.

**Context Gathered (Provided):**
- Escritório contábil com aproximadamente 150 funcionários
- Cada funcionário tem sua própria carteira de clientes; os documentos chegam diretamente para o responsável pela empresa
- Canais de chegada: WhatsApp, e-mail, acesso direto ao sistema do cliente, e documentos físicos escaneados
- Arquivos são salvos manualmente em pastas no Google Drive, organizadas por cliente
- Não há padronização atual no momento de entrada dos documentos no sistema
- Primeira versão utiliza 3 empresas fictícias no Google Drive
- Dados persistidos no Supabase em schema dedicado

**Context Gathered (Inferred):**
- O volume de documentos por mês é significativo dado o porte do escritório (150 funcionários, múltiplos clientes cada)
- A qualidade dos arquivos escaneados pode variar, afetando a classificação automática

**Technical Context Observed:**

| Aspecto | Observação | Implicação |
|---|---|---|
| Armazenamento de arquivos | Google Drive (fornecido pelo usuário) | Sistema depende da API do Google Drive para monitoramento |
| Banco de dados | Supabase, schema dedicado | Schema isolado; usar Row Level Security para privacidade por carteira |
| Localização do projeto | D:\OneDrive\ISABELLA\CURSOS\IA\PROJETO\Gestao_Documentos | Projeto local no Windows |
| Padrões existentes | N/A — projeto novo | Sem legado a considerar |

## Discovery Questions & Answers

| # | Pergunta | Resposta | Impacto |
|---|---|---|---|
| 1 | Qual é o maior problema que acontece hoje? | Os três juntos: não saber o que falta, pasta errada descoberta tarde, identificação manual lenta | Define as três prioridades do sistema: controle de pendências, validação de localização, classificação automática |
| 2 | Quem vai usar o sistema no dia a dia? | A equipe inteira (~150 funcionários), cada um com sua carteira de clientes | Necessário módulo de privacidade; cada funcionário vê apenas suas empresas |
| 3 | Como os documentos chegam hoje e onde devem continuar chegando? | Múltiplos canais (WhatsApp, e-mail, sistema do cliente, físicos escaneados); salvos manualmente na pasta do cliente no Drive | O sistema deve agir *após* o arquivo chegar na pasta, não controlar o recebimento |
| 4 | Como saber que o sistema deu certo? | Todas as opções: classificação automática, lista diária de pendências, erros de pasta detectados automaticamente, relatório consolidado para gestão | Sistema precisa cobrir todas as dimensões; nenhuma pode ser sacrificada no MVP |

## Sample Data Inventory

| Tipo | Localização | Qtd | Notas |
|---|---|---:|---|
| Arquivos de entrada | N/A | 0 | Nenhuma amostra disponível nesta sessão |
| Exemplos de saída | N/A | 0 | N/A |
| Ground truth | N/A | 0 | N/A |
| Código relacionado | N/A | 0 | Projeto novo, sem base de código existente |

**Como as amostras serão usadas:**
- Nenhuma amostra disponível. Na fase de Define ou Build, amostras reais de PDFs e imagens escaneadas serão necessárias para calibrar o classificador de documentos.

## Approaches Explored

### Approach A: Drive Vigiado — Recomendada

**Descrição:** O sistema monitora as pastas do Google Drive em segundo plano. O funcionário continua com o fluxo atual — salva o arquivo na pasta do cliente — e o sistema lê, classifica e valida automaticamente após o arquivo chegar. Um painel web centraliza: cadastro de empresas, fila de revisão humana, lista de pendências por empresa/mês e relatório diário de erros.

**Prós:**
- Os 150 funcionários não mudam nada na rotina; adoção quase zero
- O sistema trabalha de forma assíncrona, sem bloquear o fluxo de trabalho
- Funciona com qualquer canal de entrada (WhatsApp, e-mail, físico escaneado), pois age no arquivo já salvo

**Contras:**
- Erros de pasta errada são detectados *após* o arquivo já estar no lugar errado
- Depende da disponibilidade e estabilidade da API do Google Drive
- Arquivos escaneados de baixa qualidade podem dificultar a classificação automática

**Por que é recomendada:** Elimina a resistência de adoção em um escritório de 150 pessoas. Nenhuma mudança de hábito é exigida. O problema mais custoso não é detectar erros na entrada, mas sim *não detectá-los nunca* — o que esta abordagem resolve.

---

### Approach B: Portal de Envio pelo Sistema

**Descrição:** O funcionário acessa um sistema próprio e faz o upload por ali. O sistema classifica na hora e alerta se algo está errado *antes* de salvar, só então guardando no Drive.

**Prós:**
- Erros são detectados na entrada, antes de serem persistidos
- Maior controle sobre o fluxo de chegada

**Contras:**
- Muda completamente a rotina de 150 funcionários; alta resistência de adoção
- Mais complexo de construir; não suporta nativamente os canais existentes (WhatsApp, físico)

---

### Approach C: Classificação Assistida

**Descrição:** Arquivos vão para o Drive normalmente. O funcionário abre o painel, vê os arquivos novos sem classificação e confirma o que o sistema sugeriu. O sistema não decide sozinho — apenas sugere.

**Prós:**
- Mais simples de construir; humano sempre no controle

**Contras:**
- Não economiza tempo de forma significativa
- Não escala com 150 pessoas
- A classificação ainda é essencialmente manual

## Selected Approach

| Atributo | Valor |
|---|---|
| Escolhida | Approach A — Drive Vigiado |
| Confirmação | Confirmado em conversa (2026-11-06) |
| Raciocínio | Menor impacto na rotina de 150 funcionários; o sistema resolve o problema sem exigir mudança de comportamento da equipe |

## Key Decisions Made

| # | Decisão | Racional | Alternativa Rejeitada |
|---|---|---|---|
| 1 | Entrada de documentos pelo Drive (não pelo sistema) | Manter a rotina atual de 150 funcionários inalterada | Portal de envio obrigatório pelo sistema |
| 2 | Relatório diário de erros enviado para gestores E para o funcionário responsável pela empresa | Gestão acompanha o todo; funcionário resolve o caso específico | Enviar apenas para gestão |
| 3 | Classificação automática com fila de revisão humana para não reconhecidos | Equilibra automação com controle; erros não passam sem ser vistos | Classificação 100% manual ou 100% automática sem revisão |
| 4 | Botão de alternância dados fictícios/reais | Permite testar com segurança sem risco aos dados reais de clientes | Testar diretamente com dados reais |
| 5 | Pastas ligadas à empresa pelo CNPJ, não só pelo código | CNPJ é o identificador oficial e consta nos documentos; facilita a validação cruzada | Vínculo só pelo código interno do cliente |

## Features Removed (YAGNI)

| Feature Sugerida | Motivo do Adiamento | Pode Adicionar Depois? |
|---|---|---|
| Contas bancárias no cadastro de empresas | Útil para identificar extratos na classificação, mas o leitor pode funcionar sem isso na v1; adicionar depois de validar a classificação básica | Sim |
| Controle de obrigações | Explicitamente fora do escopo pelo usuário | Sim — projeto separado |

*Revisão YAGNI executada. Nenhum outro corte responsável foi identificado além dos itens acima.*

## Incremental Validations

| Seção | Apresentada | Feedback do Usuário | Ajustado? |
|---|---|---|---|
| Checkpoint 1 — Conceito, componentes e responsabilidades | Sim | Ajuste: relatório diário de erros deve ir para gestores E para o funcionário responsável pela empresa com erro | Sim |
| Checkpoint 2 — Fluxo de dados, tratamento de erros e dependências | Sim | Confirmado sem ajustes | Não |

## Suggested Requirements for /define

### Problem Statement (Draft)

O escritório contábil precisa de um sistema que monitore automaticamente as pastas do Google Drive, classifique os documentos recebidos por tipo, mês e empresa (via CNPJ), detecte erros de pasta errada e mantenha uma lista atualizada de pendências por empresa e por mês — eliminando a verificação manual e garantindo que nenhum erro passe sem ser reportado.

### Target Users (Draft)

| Usuário | Dor Principal |
|---|---|
| Funcionário do escritório (responsável pela carteira) | Perde tempo identificando documentos manualmente; descobre erros de pasta tarde; não tem visão clara do que ainda falta por empresa |
| Gestor do escritório | Não tem visão consolidada de pendências e erros; depende de verificação manual para saber o status geral |

### Success Criteria (Draft)

- [ ] Um arquivo salvo na pasta do cliente no Drive é classificado automaticamente em menos de X minutos (tempo a definir em testes)
- [ ] Documentos em pasta errada geram alerta visível no painel e aparecem no relatório diário
- [ ] A lista de pendências por empresa e por mês está disponível no painel sem nenhuma ação manual
- [ ] Arquivos não reconhecidos aparecem na fila de revisão humana e não são perdidos
- [ ] O relatório diário de erros chega para gestores e para o funcionário responsável pela empresa com erro
- [ ] O botão de alternância fictício/real funciona sem risco de misturar dados
- [ ] Cada funcionário vê apenas as empresas da sua carteira (TBD: regra de acesso a definir em Define)

### Constraints Identified

- Armazenamento de arquivos obrigatoriamente no Google Drive (versão 1)
- Banco de dados obrigatoriamente no Supabase, em schema dedicado a este projeto
- Primeira versão limitada a 3 empresas fictícias para validação
- Dados reais de clientes só entram após validação completa com dados fictícios
- Sistema deve suportar documentos chegando por múltiplos canais (WhatsApp, e-mail, físico escaneado, sistema do cliente) — todos convergem para a pasta no Drive
- Qualidade de arquivos escaneados é variável (limitação conhecida para o classificador)
- Sem amostras reais disponíveis nesta fase — classificador precisará ser calibrado com exemplos reais na fase de Build (TBD)

### Out of Scope (Confirmed)

- Controle de obrigações fiscais e contábeis
- Recebimento ou padronização do canal de chegada dos documentos (WhatsApp, e-mail etc.)
- Contas bancárias no cadastro de empresas (adiado para v2)
- Qualquer funcionalidade de envio de documentos para o cliente

## Session Summary

| Métrica | Valor |
|---|---:|
| Perguntas de Descoberta Respondidas | 4 |
| Abordagens Exploradas | 3 |
| Features Removidas / Adiadas (YAGNI) | 2 |
| Validações Concluídas | 2 |

## Next Step

Execute o **SDD Define by RDD**.
