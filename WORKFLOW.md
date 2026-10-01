# WORKFLOW.md — NIT

> Fluxos operacionais do sistema conforme auditados nos ciclos 1–8 e atualizados pelas decisões validadas para integridade e reconciliação do processamento CEMOB.
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
Guardião / validação de integridade
  ↓
Estado projetado
  ↓
Confirmação / reconciliação quando necessária
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

# 2. Fluxo 1 — CEMOB → Guardião → ocorrência → Kanban

## Objetivo

Transformar o relatório recebido em ocorrências operacionais, sem duplicar eventos existentes, preservando continuidade quando aplicável e impedindo que inconsistências não compreendidas provoquem silenciosamente dano estrutural.

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
construir estado projetado
      ↓
Guardião / invariantes
      ↓
      ├── consistente
      │      ↓
      │   prévia do resultado
      │      ↓
      │   confirmar processamento
      │
      └── divergência / contradição
             ↓
          diagnosticar
             ↓
          mostrar impacto projetado
             ↓
          decisão humana quando necessária
             ↓
          reconciliação / revisão
      ↓
persistir
      ↓
Firebase /kanban
      ↓
renderizar Kanban
      ↓
atualizar contadores
```

O princípio do fluxo protegido é:

```text
interpretar
→ projetar
→ validar
→ explicar
→ decidir quando necessário
→ persistir
```

e não:

```text
interpretar
→ persistir
→ descobrir depois que houve problema
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
   ├── SIM → avaliar atualização da ocorrência
   └── NÃO
        ↓
      avaliar continuidade pelo código
        ↓
      continuidade?
      reincidência?
      retificação?
      contradição?
```

A ausência de correspondência exata não autoriza automaticamente a criação de novo evento nem a herança por código.

Quando os dados recebidos contradizem uma ocorrência conhecida, o Guardião deve impedir que a ambiguidade seja resolvida silenciosamente de forma estruturalmente perigosa.

## Prévia de processamento

Antes da persistência protegida, o NIT deve apresentar ao operador o resultado projetado usando os mesmos indicadores que ele já utiliza para conferir o relatório CEMOB.

Exemplo:

```text
RELATÓRIO CEMOB

Ocorrências de Apagados/Piscantes   (24)

Pendentes                            (4)
Furtos                               (...)
Outros motivos                       (...)
Investigando                         (...)

Normalizados                         (20)
```

```text
NIT — APÓS PROCESSAR

Ocorrências                          24
Pendentes                             4
Normalizados                         20
```

O objetivo é permitir o fluxo mental:

```text
olhar CEMOB
→ olhar NIT
→ comparar
→ entender diferença, se houver
→ decidir
```

A prévia não substitui os invariantes automáticos.

## Resultado

Somente após as validações aplicáveis e a confirmação necessária, `/kanban/{eventoId}` passa a representar o novo snapshot persistido da ocorrência.

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
RENDIÇÃO
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

# 7. Fluxo 5A — Reconciliação de retificação

Reconciliação é um fluxo distinto de normalização, herança e reincidência.

Ela ocorre quando uma nova representação CEMOB contradiz informação anteriormente consolidada e o sistema não pode tratar a mudança silenciosamente com segurança.

## Exemplo — `NORMALIZADO → PENDENTE`

```text
ESTADO CONHECIDO

SCN 123
Início: 10:00
Fim:    10:40
Estado: NORMALIZADO

        ↓ novo relatório

SCN 123
Início: 10:00
Fim:    ausente
```

O desaparecimento de `Fim` pode representar retificação da fonte.

O fluxo deve ser:

```text
contradição detectada
      ↓
NÃO criar novo eventoId
NÃO criar segundo card
NÃO apagar histórico
      ↓
criar diagnóstico
      ↓
calcular consequências possíveis
      ↓
mostrar ao operador
```

Exemplo:

```text
O QUE MUDOU

Fim 10:40 foi retirado do relatório.

O QUE ISSO PODE SIGNIFICAR

O relatório pode ter sido corrigido.

O QUE O NIT FEZ

Nada foi apagado.
Nenhuma nova ocorrência foi criada.

O QUE ACONTECE SE VOLTAR PARA PENDENTE

Ocorrências:    24 → 24
Pendentes:       3 → 4
Normalizados:   21 → 20

[ VOLTAR PARA PENDENTE ]

[ MANTER NORMALIZADA ]

[ NÃO SEI — DEIXAR PARA REVISÃO ]
```

## Confirmação

Quando o operador confirma que a nova informação é uma retificação da mesma ocorrência:

```text
mesmo eventoId
      ↓
mesmo card
      ↓
representação CEMOB reconciliada
      ↓
estado da ocorrência atualizado
      ↓
histórico operacional preservado
```

A reconciliação não deve reativar automaticamente equipe, VT, despacho, apoio, rendição ou outro estado operacional anterior.

## Registro

Uma reconciliação que exige decisão humana deve gerar Registro de Integridade contendo, no mínimo conceitual:

```text
detecção
situação encontrada
decisão
resultado
eventual reversão
```

O schema físico pertence ao `DATA-MODEL.md`/implementação correspondente.

---

# 8. Fluxo 5B — Recuperação de decisão humana

Uma decisão tomada durante reconciliação pode posteriormente ser reconhecida como incorreta.

O procedimento normal não deve ser:

```text
erro
→ abrir Firebase
→ apagar nó
→ reprocessar
```

Para casos protegidos, o fluxo desejado é:

```text
decisão aplicada
      ↓
operador identifica erro
      ↓
solicita correção/desfazer
      ↓
NIT verifica se houve fatos posteriores
      ↓
      ├── NÃO
      │    ↓
      │ reversão segura
      │
      └── SIM
           ↓
        não restaurar snapshot cegamente
           ↓
        preservar fatos posteriores
           ↓
        nova reconciliação
```

## Reversão segura

Quando nenhuma informação operacional posterior seria perdida:

```text
estado atual
      ↓
calcular estado após desfazer
      ↓
mostrar impacto
      ↓
confirmar
      ↓
aplicar correção
      ↓
registrar reversão
```

A decisão original permanece no histórico.

## Reversão não segura

Se após a decisão ocorreram fatos como:

```text
despacho
chegada
apoio
rendição
outro evento operacional relevante
```

o NIT não deve restaurar cegamente um snapshot anterior.

Deve explicar o bloqueio e encaminhar para reconciliação preservando os fatos posteriores.

---

# 9. Encerramento operacional

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

# 10. Fluxo 6 — Continuidade / Herança / Reincidência / Retificação

Há papéis diferentes:

```text
_reprocessar()
     ↓
executa atualmente continuidade/herança operacional

NitProcessamento
     ↓
detecta/rastreia possível lacuna

Guardião
     ↓
protege integridade e encaminha contradições
```

`NitViradaDia` não restaura relatórios automaticamente.

## 10.1 Continuidade

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
      ├── SIM → pode ser candidata à herança
      └── NÃO → não herdar
```

A avaliação não deve colapsar silenciosamente identidades incompatíveis.

## 10.2 Herança

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

## 10.3 Reincidência

```text
mesmo codigo
   +
novo inicio
      ↓
pode representar nova ocorrência
      ↓
novo eventoId
```

`Pode representar` não significa `sempre representa`.

Quando já existe ocorrência conhecida e a nova informação contradiz sua representação anterior, o Guardião deve considerar a possibilidade de retificação antes de permitir criação silenciosa de outra identidade.

## 10.4 Retificação

Retificação representa correção da representação CEMOB de uma ocorrência já conhecida.

Exemplos conceituais:

```text
NULL → valor
= enriquecimento

valor → mesmo valor
= estabilidade

valor A → valor B
= contradição a avaliar

valor → NULL
= possível retificação
```

Uma contradição relevante deve seguir:

```text
detectar
→ preservar
→ diagnosticar
→ projetar consequência
→ decidir quando necessário
→ reconciliar
→ registrar
```

e não:

```text
contradição
→ criar silenciosamente outro evento
```

## 10.5 Lacuna de processamento

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

# 11. Fluxo 7 — Firebase → FastAPI → Google Sheets

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

# 12. Fluxo 8 — Reboques

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

## 12.1 Plantão

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

## 12.2 Criação de evento

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

## 12.3 Alocação

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

## 12.4 Transferência

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

## 12.5 Finalização individual

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

## 12.6 Finalização do evento

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

## 12.7 Drag & Drop

Drag & Drop pode executar operações reais:

```text
Disponíveis → reordenar
Disponível → Atuando → abrir acionamento
Reboquista → Evento → alocar/transferir
```

Portanto, não é apenas apresentação visual.

## 12.8 Relatório

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

## 12.9 WhatsApp

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

# 13. Ciclo completo da ocorrência semafórica

O fluxo principal pode ser resumido como:

```text
RELATÓRIO CEMOB
      ↓
PARSER
      ↓
IDENTIDADE
      ↓
ESTADO PROJETADO
      ↓
GUARDIÃO
      ↓
PRÉVIA / RECONCILIAÇÃO
      ↓
PERSISTÊNCIA
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

A ordem acima é uma visão didática. Apoios e rendições podem se repetir, normalização pode ocorrer sem todos os eventos operacionais intermediários e uma ocorrência normalizada pode retornar a pendente exclusivamente por reconciliação explícita de retificação.

---

# 14. Ciclo de estado e ciclo operacional

É importante visualizar os dois eixos separadamente:

```text
CICLO DA OCORRÊNCIA

PENDENTE
   ↓
NORMALIZADO
   ↑
   └── reconciliação explícita de retificação

ou

SEM_NECESSIDADE
```

A seta de retorno não representa herança automática.

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

# 15. Registro de Integridade

O Guardião deve manter rastreabilidade dos casos em que não foi seguro tratar silenciosamente uma entrada.

Fluxo conceitual:

```text
Guardião detecta situação relevante
      ↓
criar Caso de Integridade
      ↓
registrar diagnóstico
      ↓
registrar decisão humana, quando houver
      ↓
registrar resultado
      ↓
registrar eventual reversão
```

O Registro de Integridade:

- não substitui o histórico operacional;
- não altera automaticamente regras do motor;
- não precisa registrar ruídos de formatação absorvidos normalmente;
- serve como evidência para auditoria, recuperação e evolução futura.

Produção alimenta o ciclo:

```text
caso real
→ evidência
→ investigação
→ validação
→ teste de regressão
→ eventual mudança futura
```

---

# 16. Compatibilidade e caminhos alternativos

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

# 17. Como usar este documento ao alterar um fluxo

Antes de modificar um fluxo:

```text
1. localizar o fluxo neste WORKFLOW.md
2. consultar BUSINESS-RULES.md
3. consultar DATA-MODEL.md
4. identificar persistência afetada
5. identificar histórico afetado
6. identificar consumidores/exportação
7. verificar caminhos legados
8. apresentar plano
9. obter aprovação explícita
10. implementar
11. testar fluxo completo
12. atualizar documentação se o comportamento aprovado mudou
```

Não validar uma mudança apenas pela tela. O fluxo pode atravessar DOM, Firebase, histórico, backend e exportação.

---

# 18. Pontos que permanecem abertos

```text
VALIDAR
├── executor automático para rendição agendada?
├── scheduler atual de cron_export.py?
├── evento finalizado de Reboques deve ser arquivado?
├── histórico permanente de Reboques?
└── persistência de Reboques entre plantões?
```

`NORMALIZADO → PENDENTE` não permanece aberto.

O comportamento aprovado é:

```text
NORMALIZADO
      ↓
nova evidência contraditória
      ↓
Guardião
      ↓
reconciliação explícita
      ↓
decisão humana quando necessária
      ↓
mesmo eventoId / histórico preservado
      ↓
PENDENTE
```

Esses pontos ainda abertos não devem ser resolvidos por inferência.

---

# 19. Critério da entrega atual

A entrega destinada à expansão do NIT para o novo turno não exige que todas as anomalias possíveis sejam previamente conhecidas.

Exige que uma anomalia não tratada não consiga produzir silenciosamente:

```text
segundo card indevido
nova identidade indevida
perda de ocorrência
contagem falsa não explicada
apagamento de histórico
corrupção estrutural
```

Os pilares da entrega são:

```text
INTEGRIDADE
OBSERVABILIDADE
RECUPERABILIDADE
FALHA SEGURA
OPERAÇÃO INTUITIVA
```

O caminho de validação previsto é:

```text
testes históricos/sintéticos
      ↓
simulação sem persistência
      ↓
modo sombra
      ↓
teste controlado no turno atual
      ↓
liberação do novo turno
```

Funcionalidades adicionais que não sejam necessárias para satisfazer esses critérios ficam fora do escopo desta entrega.

---

# 20. Documentos relacionados

- `ARCHITECTURE.md` — como os componentes estão organizados.
- `DATA-MODEL.md` — entidades, campos, IDs e relações.
- `BUSINESS-RULES.md` — contratos e regras que não podem ser quebrados.
- `CONTEXT.MD` — visão curta de entrada e estado geral.
- `DECISIONS.md` / `docs/adr/` — decisões arquiteturais.
- `AI-INSTRUCTIONS.md` — protocolo de atuação de IA.
- `TODO.md` — pendências e investigações.
- Contrato de Entrada CEMOB — tolerâncias, validações e casos adversos da entrada.

---

**Status:** fluxos 1–8 consolidados a partir da auditoria disponível; fluxo de integridade/reconciliação consolidado conceitualmente para a entrega atual.

**Checkpoint documental:**

```text
ARCHITECTURE.md     ✓
DATA-MODEL.md       ✓
BUSINESS-RULES.md   ✓ atualizado
WORKFLOW.md         ✓ atualizado
```

**Próxima etapa da entrega:** atualizar `DATA-MODEL.md` apenas no nível necessário para suportar reconciliação, recuperabilidade e Registro de Integridade, sem antecipar implementação ou ampliar o escopo.
