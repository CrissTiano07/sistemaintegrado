# WORKFLOW.md — NIT

> Fluxos operacionais do sistema conforme auditados nos ciclos 1–8.
>
> Este documento descreve **como o sistema se movimenta**. Estrutura técnica pertence a `ARCHITECTURE.md`, entidades e campos a `DATA-MODEL.md`, e contratos a `BUSINESS-RULES.md`.

# 1. Visão geral

O NIT possui dois grandes fluxos operacionais independentes:

```text
MUNDO A — SEMÁFORO

CEMOB
  ↓
Parser / processamento
  ↓
Ocorrência
  ↓
Kanban / Firebase
  ↓
Central
  ├── Despacho
  ├── Apoio
  ├── Rendição
  └── Normalização
  ↓
Continuidade / Herança
  ↓
Exportação
  ↓
Google Sheets
```

```text
MUNDO B — REBOQUES

Plantão
  ↓
Reboquistas
  ↓
Eventos
  ↓
Alocação
  ↓
Atendimento
  ↓
Finalização
```

Os dois mundos não compartilham o mesmo estado operacional.

---

# 2. Fluxo 1 — CEMOB → ocorrência → Kanban

## Objetivo

Transformar o relatório recebido em ocorrências operacionais, sem duplicar eventos existentes e preservando continuidade quando aplicável.

## Fluxo

```text
Relatório CEMOB
      ↓
colar relatório bruto
      ↓
Processar
      ↓
parser
      ↓
extrair ocorrências
      ↓
classificar estado
      ↓
resolver identidade
      ↓
comparar com estado existente
      ↓
criar / atualizar cards
      ↓
Firebase /kanban
      ↓
renderizar Kanban
      ↓
atualizar contadores
```

## Classificação inicial

O parser pode produzir:

```text
tem Fim
   ↓
NORMALIZADO

indicadores de sem necessidade
   ↓
SEM_NECESSIDADE

necessidade ativa / demais casos aplicáveis
   ↓
PENDENTE
```

Uma ocorrência pode, portanto, entrar no sistema já normalizada.

## Identidade

A resolução não deve considerar `codigo` isoladamente como identidade.

```text
codigo + inicio
      ↓
   eventoId
```

No reprocessamento:

```text
novo item
   ↓
existe eventoId exato?
   ├── SIM → atualizar ocorrência correspondente
   └── NÃO
        ↓
     avaliar continuidade pelo código
        ↓
     herança ou nova ocorrência/reincidência
```

## Resultado

O `/kanban/{eventoId}` passa a representar o snapshot atual da ocorrência.

---

# 3. Fluxo 2 — Ocorrência → Despacho

## Entrada

O operador seleciona uma ocorrência no Kanban.

O caminho principal auditado é:

```text
card
  ↓
Semaforo.handleKanbanBoardClick()
  ↓
NitCentral.abrir(card)
  ↓
Central da Ocorrência
```

A Central carrega identificação, estado e histórico da ocorrência.

## Despacho

```text
Central
  ↓
aba Despacho
  ↓
selecionar tipo
  ├── Via Livre
  ├── AMC
  └── Sem necessidade
  ↓
informar equipe / VT quando aplicável
  ↓
confirmarDespacho()
  ↓
registrar histórico
  ↓
atualizar snapshot
  ↓
recalcular colunaN
  ↓
renderizar novo estado
```

O histórico é gravado em:

```text
/kanban/{eventoId}/historico/{pushKey}
```

e o snapshot recebe os campos operacionais atuais.

## Timestamps

No primeiro despacho:

```text
tsFirstDispatch ausente
      ↓
tsFirstDispatch = agora
```

Nos próximos eventos operacionais, ele permanece preservado.

`tsDespacho` representa a assunção operacional atual e pode mudar posteriormente.

## Compatibilidade

Existe implementação antiga de despacho em `Semaforo` e endpoint `/api/v1/despacho`. Eles permanecem como legado/compatibilidade até prova de ausência de consumidores.

---

# 4. Fluxo 3 — Apoio

## Pré-condição

A ocorrência já está em operação.

## Fluxo

```text
Central
  ↓
Apoio
  ↓
informar equipe de apoio
  ↓
informar VT
  ↓
confirmarApoio()
  ↓
registrar evento "apoio" no histórico
  ↓
atualizar equipeApoio / viaturaApoio
  ↓
recalcular colunaN
  ↓
manter equipe principal
```

O apoio não substitui automaticamente:

```text
equipe
viatura
```

Ele acrescenta:

```text
equipeApoio
viaturaApoio
```

O formulário pode permanecer disponível para novos apoios.

---

# 5. Fluxo 4 — Rendição

Rendição possui dois caminhos.

```text
RENDiÇÃO
├── imediata
└── agendada
```

## 5.1 Rendição imediata

```text
Central
  ↓
Rendição
  ↓
selecionar tipo (VL ou AMC)
  ↓
informar equipe que entra
  ↓
informar VT
  ↓
confirmar
  ↓
ler histórico
  ↓
registrar "rendição"
  ↓
trocar equipe/VT/sub atuais
  ↓
limpar apoio corrente quando previsto
  ↓
tsDespacho = momento da rendição
  ↓
recalcular colunaN
  ↓
mover card para coluna correspondente
```

A rendição representa mudança de responsabilidade operacional.

## 5.2 Rendição agendada

```text
Central
  ↓
Rendição
  ↓
informar equipe / VT / tipo
  ↓
informar horário
  ↓
agendar
  ↓
/kanban/{eventoId}/agendamento
```

Nesse momento:

```text
agendamento criado
      ↓
estado operacional atual NÃO muda
```

## 5.3 Execução do agendamento

```text
agendamento pendente
      ↓
operador executa
      ↓
hora real da execução
      ↓
evento "rendição" no histórico
      ↓
atualiza snapshot
      ↓
remove agendamento
```

A auditoria não encontrou executor automático para esses agendamentos.

## 5.4 Cancelamento

```text
agendamento
  ↓
cancelar
  ↓
remove compromisso
  ↓
estado operacional permanece
```

---

# 6. Fluxo 5 — Normalização

A normalização encerra tecnicamente a ocorrência.

O caminho principal atual é a Central:

```text
NitCentral.confirmarNormalizar()
```

Existe também `NitNormalizar`, tratado como implementação alternativa/legada.

## Fluxo manual

```text
Central
  ↓
Normalizar
  ↓
informar/validar data de fim
  ↓
informar/validar hora de fim
  ↓
observação opcional
  ↓
obter eventoId
  ↓
confirmar
  ↓
Firebase
  ↓
status = NORMALIZADO
coluna = coluna-normalizados
data_fim
hora_fim
ts_norm
observacoes
operador
  ↓
Kanban / contadores
```

## Temporalidade

```text
data_fim + hora_fim
        ↓
momento operacional em que a falha terminou

ts_norm
        ↓
momento em que a normalização foi registrada
```

Esses tempos podem ser diferentes.

## Normalização originada no relatório

Existe ainda o caminho:

```text
CEMOB
  ↓
relatório contém Fim
  ↓
parser
  ↓
status = NORMALIZADO
  ↓
card nasce normalizado
```

Esse fluxo não é a mesma coisa que o operador normalizar manualmente uma ocorrência pendente.

---

# 7. Encerramento operacional

Encerrar operação e normalizar são ações diferentes.

```text
operação em andamento
      ↓
Encerrar Operação
      ↓
encerra atuação operacional/equipe
      ↓
registra encerramento
```

Isso não implica necessariamente:

```text
status = NORMALIZADO
```

A ocorrência pode continuar existindo sem aquela operação ativa.

---

# 8. Fluxo 6 — Continuidade / Herança / Virada de dia

Há dois papéis diferentes:

```text
_reprocessar()
     ↓
executa continuidade/herança operacional

NitProcessamento
     ↓
detecta/rastreia possível lacuna
```

`NitViradaDia` não restaura relatórios automaticamente.

## 8.1 Continuidade

```text
novo relatório
      ↓
processar
      ↓
buscar eventoId exato
      ↓
se necessário, avaliar codigo
      ↓
ocorrência anterior ainda não normalizada?
      ├── SIM → candidata à herança
      └── NÃO → não herdar
```

## 8.2 Herança

Quando reconhecida:

```text
ocorrência anterior
      ↓
preserva eventoId
preserva início real
preserva estado operacional pertinente
      ↓
atualiza dataReferencia
      ↓
continua no novo processamento/plantão
```

Uma ocorrência normalizada não é herdada.

## 8.3 Reincidência

```text
mesmo codigo
   +
novo inicio
      ↓
pode representar nova ocorrência
      ↓
novo eventoId
```

## 8.4 Lacuna de processamento

```text
NitProcessamento.verificar()
      ↓
detecta possível relatório ausente
      ↓
orienta operador
      ↓
operador obtém relatório externo
      ↓
cola/processa relatório
```

O sistema não lê WhatsApp automaticamente nem inventa o relatório ausente.

---

# 9. Fluxo 7 — Firebase → FastAPI → Google Sheets

## Papel dos componentes

```text
Frontend
   ↓
Firebase RTDB
   ↓
estado operacional vivo

Frontend / processo de exportação
   ↓ HTTP
FastAPI
   ↓
serviço de integração
   ↓
Google Sheets
```

Google Sheets é destino de consolidação/exportação, não o estado operacional principal.

## Fluxo conceitual

```text
/kanban
  ↓
selecionar dados exportáveis
  ↓
identidade/estado já resolvidos
  ↓
API
  ↓
routes/export.py
  ↓
services/sheets_integration.py
  ↓
Google Sheets
```

A exportação auditada contempla pelo menos:

```text
1. novas ocorrências
2. normalizações
3. herança/continuidade
4. atualização/deduplicação por eventoId
5. colunaN
```

## Identidade na exportação

```text
eventoId
   ↓
ID_OCORRENCIA
```

O backend não deve reconstruir arbitrariamente a identidade.

## Atualização

Quando já existem registros do mesmo evento:

```text
eventoId
  ↓
localizar linha mais recente correspondente
  ↓
atualizar campos aplicáveis
```

Herança pode produzir nova linha de plantão preservando a identidade da ocorrência.

## Modo de teste

O exportador possui modo observado:

```text
DRY_RUN=true
      ↓
Firebase → simulação
      ↓
sem escrita no Google Sheets
```

e:

```text
DRY_RUN=false
      ↓
Firebase → Google Sheets
```

## Infraestrutura

`cron_export.py` existe como processo batch, mas a auditoria não confirmou scheduler atualmente ativo.

Referências antigas a Railway não representam infraestrutura atual confirmada.

---

# 10. Fluxo 8 — Reboques

Reboques é um domínio independente do Semáforo.

## Inicialização

```text
DOMContentLoaded
      ↓
aguardar Firebase
      ↓
onAuthStateChanged()
      ↓
usuário autenticado?
   ┌──┴──┐
  SIM   NÃO
   ↓     ↓
inicializar  destruir
```

Após inicializado, listeners acompanham:

```text
/reboques/plantao_ativo/reboquistas
/reboques/plantao_ativo/eventos
```

e alterações provocam novo render.

## 10.1 Plantão

```text
dados do plantão
      ↓
parser
      ↓
reboquistas
      ↓
Firebase
      ↓
lista de disponíveis/atuando
```

Estados:

```text
DISPONÍVEL
   ↓ acionamento/alocação
ATUANDO
   ↓ finalização
DISPONÍVEL
```

## 10.2 Criação de evento

```text
nova ocorrência
      ↓
criar evento evt-...
      ↓
/reboques/plantao_ativo/eventos/{evId}
      ↓
selecionar zero, um ou vários reboquistas
```

Evento sem reboquista é válido no modelo atual e representa atendimento aguardando designação.

## 10.3 Alocação

```text
evento
  ↓
selecionar reboquista
  ↓
reboquista.status = atuando
reboquista.eventoId = evId
reboquista.ocorrencia = descrição
  ↓
evento.reboquistas recebe vínculo
```

O relacionamento é mantido nos dois lados.

## 10.4 Transferência

```text
Reboquista X → Evento A
      ↓
mover para Evento B
      ↓
remover X do Evento A
      ↓
adicionar X ao Evento B
      ↓
atualizar eventoId/ocorrencia do reboquista
```

## 10.5 Finalização individual

```text
reboquista atuando
      ↓
finalizarAtendimento()
      ↓
remove do evento
      ↓
status = disponível
eventoId = ""
ocorrencia = ""
      ↓
recalcular ordem
```

## 10.6 Finalização do evento

Comportamento atual observado:

```text
evento
  ↓
finalizarEvento()
  ↓
liberar reboquistas vinculados
  ↓
remover /eventos/{evId}
```

A auditoria não encontrou arquivamento/histórico permanente desse evento. Essa característica permanece `VALIDAR`, não contrato definitivo.

## 10.7 Drag & Drop

Drag & Drop pode executar operações reais:

```text
Disponíveis → reordenar
Disponível → Atuando → abrir acionamento
Reboquista → Evento → alocar/transferir
```

Portanto, não é apenas apresentação visual.

## 10.8 Relatório

O relatório é snapshot do plantão ativo:

```text
plantão ativo
  ↓
reboquistas + eventos atuais
  ↓
RELATÓRIO DE REBOQUES
  ├── data
  ├── disponíveis
  ├── atuando
  ├── total
  ├── em atendimento
  └── disponíveis
```

Não foi identificado uso de histórico permanente para produzir esse relatório.

## 10.9 WhatsApp

```text
estado atual
  ↓
montar mensagem
  ↓
Clipboard
  ↓
operador cola no WhatsApp
```

O sistema gera o texto; o envio continua sendo ação do operador.

---

# 11. Ciclo completo da ocorrência semafórica

O fluxo principal pode ser resumido como:

```text
RELATÓRIO CEMOB
      ↓
PARSER
      ↓
IDENTIDADE
      ↓
OCORRÊNCIA
      ↓
KANBAN / FIREBASE
      ↓
┌──────────────────────────────┐
│ CICLO OPERACIONAL            │
│                              │
│ Despacho                     │
│    ↓                         │
│ Apoio (0..N)                 │
│    ↓                         │
│ Rendição (0..N)              │
│    ↓                         │
│ Encerramento operacional (?) │
└──────────────────────────────┘
      ↓
NORMALIZAÇÃO
      ↓
CONTINUIDADE/HERANÇA
(se ainda aberta entre relatórios/plantões)
      ↓
EXPORTAÇÃO
      ↓
GOOGLE SHEETS
```

A ordem acima é uma visão didática. Apoios e rendições podem se repetir, e normalização pode ocorrer sem todos os eventos operacionais intermediários.

---

# 12. Ciclo de estado e ciclo operacional

É importante visualizar os dois eixos separadamente:

```text
CICLO DA OCORRÊNCIA
PENDENTE
   ↓
NORMALIZADO

ou

SEM_NECESSIDADE
```

```text
CICLO OPERACIONAL
sem despacho
   ↓
despacho
   ↓
apoio
   ↓
rendição
   ↓
apoio / nova rendição
   ↓
encerramento operacional
```

Um eixo não deve ser usado como substituto do outro.

---

# 13. Compatibilidade e caminhos alternativos

A auditoria encontrou caminhos que coexistem com o fluxo principal:

```text
NitCentral                  → principal atual
NitNormalizar               → alternativa/legado
modal antigo de despacho    → alternativa/legado
/api/v1/despacho            → compatibilidade/legado
/api/v1/normalizar          → compatibilidade/legado
routes/export.py            → principal de exportação
```

Nenhum caminho legado deve ser removido durante manutenção apenas por parecer redundante. Primeiro é necessário provar ausência de consumidores.

---

# 14. Como usar este documento ao alterar um fluxo

Antes de modificar um fluxo:

```text
1. localizar o fluxo neste WORKFLOW.md
2. consultar BUSINESS-RULES.md
3. consultar DATA-MODEL.md
4. identificar persistência afetada
5. identificar histórico afetado
6. identificar consumidores/exportação
7. verificar caminhos legados
8. implementar
9. testar fluxo completo
10. atualizar documentação se o comportamento aprovado mudou
```

Não validar uma mudança apenas pela tela. O fluxo pode atravessar DOM, Firebase, histórico, backend e exportação.

---

# 15. Pontos que permanecem abertos

```text
VALIDAR
├── NORMALIZADO pode retornar a PENDENTE?
├── executor automático para rendição agendada?
├── scheduler atual de cron_export.py?
├── evento finalizado de Reboques deve ser arquivado?
├── histórico permanente de Reboques?
└── persistência de Reboques entre plantões?
```

Esses pontos não devem ser resolvidos por inferência.

---

# 16. Documentos relacionados

- `ARCHITECTURE.md` — como os componentes estão organizados.
- `DATA-MODEL.md` — entidades, campos, IDs e relações.
- `BUSINESS-RULES.md` — contratos e regras que não podem ser quebrados.
- `CONTEXT.MD` — próxima etapa estrutural do plano: revisão da porta de entrada da IA.
- `DECISIONS.md` / `docs/adr/` — decisões arquiteturais.
- `AI-INSTRUCTIONS.md` — protocolo de atuação de IA.
- `TODO.md` — pendências e investigações.

---

**Status:** fluxos 1–8 consolidados a partir da auditoria disponível.

**Checkpoint documental:**

```text
ARCHITECTURE.md     ✓
DATA-MODEL.md       ✓
BUSINESS-RULES.md   ✓
WORKFLOW.md         ✓
```

**Próxima etapa do plano:** revisar e reconstruir `CONTEXT.MD` como documento curto de entrada, apoiado pelos quatro documentos estruturais já consolidados.
