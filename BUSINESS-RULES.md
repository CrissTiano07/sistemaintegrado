# BUSINESS-RULES.md — NIT

> Regras de negócio e contratos consolidados a partir da auditoria dos ciclos 1–8.
>
> Este documento separa explicitamente **contratos que devem ser preservados**, **comportamentos confirmados pelo código** e **pontos ainda sujeitos a validação**. Encontrar um comportamento no código não basta, por si só, para transformá-lo em regra normativa.

## 1. Convenções

| Estado | Significado |
|---|---|
| 🔵 CONTRATO | Regra consolidada que deve ser preservada |
| 🟢 CONFIRMADO | Comportamento sustentado pelo código e fluxo auditado |
| 🟡 VALIDAR | Comportamento observado cuja intenção/regra ainda precisa ser confirmada |
| 🟠 LEGADO | Existe no código, mas não representa o fluxo principal atual |
| 🔴 CONFLITO | Código, documentação ou componentes apresentam comportamentos incompatíveis |

Ao modificar o sistema, **não converter automaticamente 🟢 em 🔵**. Contratos são decisões de preservação; comportamentos confirmados descrevem o sistema atual.

---

# 2. Identidade da ocorrência

## BR-ID-001 — `eventoId` identifica a ocorrência
**Estado:** 🔵 CONTRATO

A identidade forte da ocorrência semafórica é `eventoId`.

Conceitualmente:

```text
eventoId = codigo + inicio
```

Alterações não devem substituir essa identidade por `codigo` isoladamente.

## BR-ID-002 — `codigo` sozinho não identifica uma ocorrência
**Estado:** 🔵 CONTRATO

O mesmo código pode aparecer em momentos diferentes e representar ocorrências distintas.

```text
codigo = chave auxiliar
eventoId = identidade forte
```

## BR-ID-003 — Mesmo código + início diferente pode representar novo evento
**Estado:** 🟢 CONFIRMADO

O fluxo de reprocessamento/reincidência permite que o mesmo `codigo` produza outro `eventoId` quando o início é diferente.

## BR-ID-004 — Herança preserva identidade
**Estado:** 🔵 CONTRATO

Quando uma ocorrência é reconhecida como continuidade/herança, seu `eventoId` é preservado.

## BR-ID-005 — `ID_OCORRENCIA` exportado corresponde a `eventoId`
**Estado:** 🟢 CONFIRMADO

A exportação não deve substituir `eventoId` por `codigo`.

---

# 3. Estado da ocorrência × estado operacional

## BR-OP-001 — As duas dimensões são diferentes
**Estado:** 🔵 CONTRATO

O estado da falha/ocorrência e o estado da operação não são sinônimos.

```text
OCORRÊNCIA
├── estado da ocorrência
│   ├── PENDENTE
│   ├── NORMALIZADO
│   └── SEM_NECESSIDADE
│
└── estado operacional
    ├── espera
    ├── despacho
    ├── apoio
    ├── rendição
    └── encerramento
```

## BR-OP-002 — Encerrar operação não significa normalizar ocorrência
**Estado:** 🔵 CONTRATO

O encerramento operacional encerra a atuação/equipe naquele ciclo. A normalização representa o encerramento técnico da ocorrência.

Uma implementação não deve tratar essas ações como equivalentes.

## BR-OP-003 — `coluna` e `colunaN` possuem significados diferentes
**Estado:** 🔵 CONTRATO

- `coluna`: posição operacional atual no Kanban.
- `colunaN`: trajetória operacional construída ao longo da ocorrência.

Não substituir um pelo outro.

## BR-OP-004 — `sub` e `pl` não são sinônimos
**Estado:** 🔵 CONTRATO

No modelo auditado:

```text
sub = natureza operacional (vl | amc | sn)
pl  = condição simplificada usada pelo estado
```

Alterações devem preservar a diferença semântica entre os campos.

---

# 4. Despacho

## BR-DES-001 — Despacho altera o estado operacional
**Estado:** 🟢 CONFIRMADO

O despacho atualiza o snapshot da ocorrência e registra a ação no histórico.

## BR-DES-002 — Primeiro despacho deve permanecer identificável
**Estado:** 🔵 CONTRATO

`tsFirstDispatch` representa o primeiro despacho.

Se já existe, novos despachos/rendições não devem sobrescrevê-lo.

## BR-DES-003 — `tsDespacho` representa o marco operacional atual
**Estado:** 🟢 CONFIRMADO

`tsDespacho` não significa necessariamente “primeiro despacho”. Ele pode ser atualizado por nova assunção operacional, inclusive rendição.

```text
tsFirstDispatch = primeiro despacho
tsDespacho      = despacho/assunção operacional atual
```

## BR-DES-004 — Chegada e despacho são marcos temporais distintos
**Estado:** 🟢 CONFIRMADO

`tsChegada` não deve ser tratado automaticamente como equivalente a `tsDespacho`.

---

# 5. Apoio

## BR-APO-001 — Apoio não substitui a equipe principal
**Estado:** 🟢 CONFIRMADO

O despacho principal utiliza:

```text
equipe
viatura
```

O apoio utiliza:

```text
equipeApoio
viaturaApoio
```

Registrar apoio não deve, por si só, apagar/substituir a equipe principal.

## BR-APO-002 — Apoio participa da trajetória operacional
**Estado:** 🟢 CONFIRMADO

Apoio gera registro histórico e influencia a derivação de `colunaN`.

---

# 6. Rendição

## BR-REN-001 — Rendição pressupõe operação em andamento
**Estado:** 🟢 CONFIRMADO

A interface/fluxo auditado só disponibiliza rendição após despacho.

## BR-REN-002 — Rendição troca a responsabilidade operacional
**Estado:** 🟢 CONFIRMADO

Na execução, a nova equipe passa a ocupar os campos principais:

```text
equipe
viatura
sub
```

A rendição também atualiza `tsDespacho`, recalcula `colunaN` e move o card para a coluna operacional correspondente.

## BR-REN-003 — Rendição pode ser Via Livre ou AMC
**Estado:** 🟢 CONFIRMADO

Tipos observados:

```text
vl
amc
```

## BR-REN-004 — Equipe que entra é obrigatória
**Estado:** 🟢 CONFIRMADO

A rendição não deve ser executada sem equipe de entrada válida.

## BR-REN-005 — Rendição pode ser imediata ou agendada
**Estado:** 🟢 CONFIRMADO

Os dois caminhos pertencem ao fluxo atual.

## BR-REN-006 — Agendar não altera imediatamente o estado operacional
**Estado:** 🟢 CONFIRMADO

O compromisso é persistido em:

```text
/kanban/{eventoId}/agendamento
```

mas a equipe/coluna corrente não deve ser alterada apenas pelo agendamento.

## BR-REN-007 — Hora agendada e hora real são conceitos diferentes
**Estado:** 🟢 CONFIRMADO

A execução pode ocorrer em horário diferente do inicialmente programado. O timestamp histórico deve representar a execução efetiva informada.

## BR-REN-008 — Executar rendição remove o agendamento correspondente
**Estado:** 🟢 CONFIRMADO

Após execução, o agendamento deixa de representar compromisso pendente.

## BR-REN-009 — Cancelar agendamento não altera a operação atual
**Estado:** 🟢 CONFIRMADO

Cancelar compromisso futuro não equivale a executar uma rendição.

## BR-REN-010 — Executor automático de rendição agendada
**Estado:** 🟡 VALIDAR

A auditoria encontrou persistência do agendamento, mas não encontrou executor automático. Não assumir que exista scheduler operacional para isso.

---

# 7. Histórico operacional

## BR-HIS-001 — Ações operacionais relevantes são registradas no histórico
**Estado:** 🟢 CONFIRMADO

Despacho, apoio e rendição possuem eventos históricos observados.

## BR-HIS-002 — Histórico é append-only
**Estado:** 🔵 CONTRATO

Persistência:

```text
/kanban/{eventoId}/historico/{pushKey}
```

Novos eventos devem ser acrescentados sem sobrescrever eventos anteriores.

## BR-HIS-003 — Estado atual permanece no nó principal
**Estado:** 🔵 CONTRATO

O sistema mantém:

```text
snapshot atual + histórico
```

O histórico não substitui a necessidade de um estado corrente.

## BR-HIS-004 — `colunaN` é derivável da trajetória histórica
**Estado:** 🟢 CONFIRMADO

Regra observada:

```text
despacho → inicia/reinicia segmento
apoio    → acrescenta tipo ao segmento
rendição → fecha segmento e inicia outro
```

## BR-HIS-005 — Histórico pode auxiliar reconstrução de estado legado
**Estado:** 🟢 CONFIRMADO

Compatibilidade com registros antigos não deve ser removida sem verificar consumidores e dados existentes.

---

# 8. Normalização

## BR-NOR-001 — Data e hora de fim são obrigatórias na normalização manual
**Estado:** 🟢 CONFIRMADO

A Central valida os dois campos antes de concluir a ação.

## BR-NOR-002 — Momento operacional de fim e momento do registro são distintos
**Estado:** 🔵 CONTRATO

```text
data_fim = data operacional do fim
hora_fim = hora operacional do fim
ts_norm  = momento do registro da normalização
```

Não substituir `data_fim`/`hora_fim` por `Date.now()` indiscriminadamente.

## BR-NOR-003 — Normalização move a ocorrência para Normalizados
**Estado:** 🟢 CONFIRMADO

O estado auditado recebe:

```text
status = "NORMALIZADO"
coluna = "coluna-normalizados"
```

além de `data_fim`, `hora_fim`, `ts_norm`, observações e operador.

## BR-NOR-004 — Normalização pode acrescentar observação sem destruir a anterior
**Estado:** 🟢 CONFIRMADO

Quando não há nova observação, o fluxo pode preservar a já existente.

## BR-NOR-005 — Ocorrência pode nascer normalizada
**Estado:** 🟢 CONFIRMADO

Se o relatório recebido já contém `Fim`, o parser pode classificar a ocorrência como `NORMALIZADO` e persistir os dados de fim desde sua criação.

Isso é diferente da normalização manual posterior.

## BR-NOR-006 — Ocorrência normalizada não participa da herança
**Estado:** 🔵 CONTRATO

No fluxo de continuidade auditado, apenas ocorrência não normalizada é candidata à herança.

## BR-NOR-007 — NORMALIZADO → PENDENTE
**Estado:** 🟡 VALIDAR

A auditoria não comprovou uma regra que “desfaça” a normalização. Não implementar essa transição como comportamento esperado sem decisão explícita.

---

# 9. Classificação inicial da ocorrência

## BR-CLA-001 — O parser pode produzir estados diferentes antes de ação manual
**Estado:** 🟢 CONFIRMADO

O fluxo auditado reconhece, entre outros:

```text
Fim preenchido
→ NORMALIZADO

indicadores de sem necessidade
→ SEM_NECESSIDADE

caso contrário / necessidade ativa
→ PENDENTE
```

## BR-CLA-002 — Classificação automática não deve inventar informação ausente
**Estado:** 🔵 CONTRATO

O sistema é assistido pelo operador: pode detectar condições a partir do relatório recebido, mas não deve fabricar dados operacionais que não estejam presentes.

---

# 10. Continuidade, herança e reincidência

## BR-CON-001 — Resolver primeiro por `eventoId`
**Estado:** 🟢 CONFIRMADO

A identidade forte tem prioridade.

## BR-CON-002 — `codigo` pode ser usado como chave auxiliar
**Estado:** 🟢 CONFIRMADO

Quando não há correspondência exata por `eventoId`, o código pode participar da tentativa de continuidade/herança.

## BR-CON-003 — Somente ocorrência não normalizada é candidata à herança
**Estado:** 🔵 CONTRATO

Normalizados não devem ser reabertos implicitamente pelo mecanismo de herança.

## BR-CON-004 — Herança mantém identidade
**Estado:** 🔵 CONTRATO

Continuidade não deve criar novo `eventoId` para a mesma ocorrência herdada.

## BR-CON-005 — Herança atualiza `dataReferencia`
**Estado:** 🟢 CONFIRMADO

A data do plantão atual pode mudar sem alterar o início real da ocorrência.

## BR-CON-006 — Mesmo código pode representar reincidência
**Estado:** 🟢 CONFIRMADO

Código repetido não prova continuidade.

## BR-CON-007 — Detecção de lacuna não substitui decisão do operador
**Estado:** 🔵 CONTRATO

O sistema pode indicar possível lacuna, mas o operador continua responsável por obter/conferir/processar o relatório externo.

## BR-CON-008 — O sistema não lê WhatsApp automaticamente
**Estado:** 🟢 CONFIRMADO

Não assumir integração automática com a fonte externa quando ela não existe.

---

# 11. Exportação

## BR-EXP-001 — `/kanban` é a origem operacional da exportação
**Estado:** 🟢 CONFIRMADO

Google Sheets não é o estado operacional primário.

## BR-EXP-002 — Frontend resolve identidade/estado antes do backend
**Estado:** 🔵 CONTRATO

O backend recebe o estado resolvido; não deve recriar arbitrariamente a identidade da ocorrência.

## BR-EXP-003 — `eventoId` é exportado como `ID_OCORRENCIA`
**Estado:** 🟢 CONFIRMADO

Essa correspondência deve permanecer consistente.

## BR-EXP-004 — Normalização usa `ts_norm`
**Estado:** 🟢 CONFIRMADO

O timestamp de registro da normalização possui função própria na exportação.

## BR-EXP-005 — Herança pode gerar nova linha no Sheets
**Estado:** 🟢 CONFIRMADO

Continuidade da identidade não significa necessariamente atualização da mesma linha física em todos os plantões.

## BR-EXP-006 — Atualização considera a linha mais recente do mesmo `eventoId`
**Estado:** 🟢 CONFIRMADO

## BR-EXP-007 — `colunaN` tem prioridade quando disponível
**Estado:** 🟢 CONFIRMADO

Fallback/reconstrução não deve substituir uma `colunaN` válida sem motivo.

## BR-EXP-008 — Google Sheets é destino de exportação
**Estado:** 🔵 CONTRATO

O frontend fala com a API; não precisa conhecer a implementação interna da planilha.

## BR-EXP-009 — Scheduler atual de `cron_export.py`
**Estado:** 🟡 VALIDAR

A existência do código não comprova que exista scheduler ativo em produção.

---

# 12. Reboques

## BR-REB-001 — Reboques é domínio operacional separado
**Estado:** 🔵 CONTRATO

O módulo usa:

```text
/reboques/plantao_ativo
```

e não altera o `/kanban` do Semáforo.

## BR-REB-002 — `status` do reboquista representa estado do recurso
**Estado:** 🔵 CONTRATO

Estados observados:

```text
DISPONÍVEL ↔ ATUANDO
```

Não confundir esse `status` com estado de ocorrência semafórica.

## BR-REB-003 — Evento pode existir sem reboquista
**Estado:** 🟢 CONFIRMADO

Uma ocorrência de reboque pode aguardar designação.

## BR-REB-004 — Evento pode ter zero, um ou vários reboquistas
**Estado:** 🟢 CONFIRMADO

## BR-REB-005 — Relação evento ↔ reboquista é bidirecional
**Estado:** 🔵 CONTRATO

O vínculo existe nos dois lados:

```text
reboquista.eventoId
evento.reboquistas
```

Alterações de alocação/transferência devem manter os dois lados consistentes.

## BR-REB-006 — Transferência remove vínculo anterior
**Estado:** 🟢 CONFIRMADO

Um reboquista movido para outro evento deixa de pertencer ao anterior.

## BR-REB-007 — Finalização individual libera o recurso
**Estado:** 🟢 CONFIRMADO

A finalização observada:

```text
remove do evento
status = disponível
eventoId = ""
ocorrencia = ""
recalcula ordem
```

## BR-REB-008 — Finalização do evento atualmente remove o evento ativo
**Estado:** 🟡 VALIDAR

O código auditado libera os vinculados e remove `/eventos/{evId}`. Não transformar isso em regra permanente até confirmar a intenção operacional.

## BR-REB-009 — Histórico permanente de eventos de Reboques
**Estado:** 🟡 VALIDAR

Não foi encontrado histórico persistente após finalização.

## BR-REB-010 — “Limpar Plantão” remove o conjunto operacional
**Estado:** 🟡 VALIDAR

O comportamento existe, mas sua permanência como regra de negócio precisa validação.

## BR-REB-011 — Drag & Drop pode representar operação de negócio
**Estado:** 🟢 CONFIRMADO

Reordenar, alocar e transferir podem gravar alterações reais no Firebase. Não tratar todo drag & drop como mudança puramente visual.

---

# 13. Componentes legados e compatibilidade

Os itens abaixo **não são regras de negócio**, mas impõem uma regra de manutenção: não remover sem provar ausência de consumidores.

| Componente | Estado |
|---|---|
| `NitNormalizar` | 🟠 possível implementação legada/alternativa |
| modal antigo de despacho | 🟠 implementação alternativa |
| `/api/v1/despacho` | 🟠 compatibilidade/legado |
| `/api/v1/normalizar` | 🟠 compatibilidade/legado |
| referências a Railway | 🟠 infraestrutura histórica |
| `routes/config.py` | 🟠 aparentemente não registrado |
| `NitCentral` | 🟢 fluxo principal atual |
| `routes/export.py` | 🟢 fluxo principal de exportação |

### Regra de manutenção

**Nada marcado como legado deve ser apagado apenas porque parece antigo.**

Antes de remover:

1. localizar consumidores;
2. verificar listeners/handlers;
3. verificar chamadas de API;
4. verificar dados históricos;
5. confirmar que o fluxo principal não depende do componente;
6. só então propor remoção.

---

# 14. Regras de segurança para mudanças

Qualquer alteração funcional deve preservar, até decisão explícita em contrário:

1. identidade forte por `eventoId`;
2. distinção entre `eventoId` e `codigo`;
3. distinção entre estado da ocorrência e estado operacional;
4. distinção entre normalização e encerramento operacional;
5. histórico append-only;
6. separação entre `coluna` e `colunaN`;
7. preservação de `tsFirstDispatch`;
8. significado operacional de `tsDespacho`;
9. continuidade sem herdar ocorrências normalizadas;
10. consistência bidirecional de Reboques;
11. separação operacional entre Semáforo e Reboques;
12. ausência de remoção automática de legado sem auditoria de consumidores.

---

# 15. Questões abertas

Estas questões permanecem fora do conjunto de contratos até validação:

```text
VALIDAR:
- NORMALIZADO pode voltar a PENDENTE?
- Evento finalizado de Reboques deve ser removido ou arquivado?
- Deve existir histórico permanente de Reboques?
- Qual deve ser a persistência entre plantões de Reboques?
- Existe/será necessário executor automático de rendições agendadas?
- Qual infraestrutura deve executar cron_export.py?
```

Uma IA ou desenvolvedor não deve responder essas perguntas por inferência a partir do comportamento atual.

---

# 16. Protocolo para nova regra

Antes de acrescentar uma regra a este documento:

```text
1. localizar o domínio
2. localizar o fluxo
3. localizar o estado
4. localizar a persistência
5. localizar consumidores
6. verificar histórico
7. confrontar documentação
8. classificar evidência
9. se for decisão nova, registrar decisão/ADR
10. somente então atualizar BUSINESS-RULES.md
```

A regra fundamental é:

```text
"O código atualmente faz X"
            ≠
"O sistema deve fazer X"
```

---

# 17. Documentos relacionados

- `ARCHITECTURE.md` — arquitetura e responsabilidades.
- `DATA-MODEL.md` — entidades, campos, IDs e relações.
- `WORKFLOW.md` — **próxima etapa do plano**; fluxos operacionais ponta a ponta.
- `CONTEXT.MD` — visão curta de entrada, a ser revisada após os documentos estruturais.
- `DECISIONS.md` / ADRs — decisões arquiteturais.
- `AI-INSTRUCTIONS.md` — protocolo de atuação de agentes de IA.
- `TODO.md` — questões abertas, investigações e próximas ações.

---

**Status:** regras e contratos consolidados a partir da auditoria disponível.  
**Próxima etapa:** `WORKFLOW.md`.
