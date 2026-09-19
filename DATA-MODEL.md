# DATA-MODEL.md — NIT

> Modelo de dados observado no sistema atual.
>
> Este documento descreve entidades, identidades, estados, relações e persistência comprovados na auditoria dos ciclos 1–8. Ele **não transforma automaticamente comportamento existente em regra de negócio**. Regras normativas pertencem a `BUSINESS-RULES.md`; decisões arquiteturais, a ADRs/`DECISIONS.md`.

## 1. Escopo

O NIT possui dois domínios operacionais persistidos separadamente:

1. **Semáforo / ocorrências** — estado operacional principal em `/kanban`.
2. **Reboques** — estado do plantão em `/reboques/plantao_ativo`.

Os domínios não compartilham estado operacional.

---

## 2. Princípios do modelo

### 2.1 Identidade da ocorrência

`eventoId` é a identidade forte da ocorrência no domínio Semáforo.

Conceitualmente:

```text
eventoId = codigo + inicio
```

`codigo` sozinho não identifica de forma suficiente uma ocorrência. O mesmo código pode reaparecer com outro início e representar outro evento.

```text
eventoId
└── identidade forte

codigo
└── chave auxiliar para continuidade/herança

reincidente
└── indica nova ocorrência com mesmo código
```

Na exportação, `eventoId` corresponde a `ID_OCORRENCIA`.

### 2.2 Estado da ocorrência e estado operacional são dimensões distintas

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

Encerramento operacional não deve ser confundido com normalização da ocorrência.

### 2.3 Snapshot atual + histórico

O modelo do `/kanban` combina:

- um **snapshot** no nó principal da ocorrência;
- um **histórico append-only** de ações operacionais.

O snapshot responde “qual é o estado atual?”. O histórico registra “como chegamos aqui?”.

---

## 3. Ocorrência Semafórica

### 3.1 Persistência principal

```text
/kanban/{eventoId}
```

Campos comprovadamente relevantes ao modelo auditado incluem:

```text
eventoId
codigo
inicio
dataReferencia
status
coluna
colunaN

equipe
viatura
sub
pl

tsFirstDispatch
tsDespacho

equipeApoio
viaturaApoio

data_fim
hora_fim
observacoes
ts_norm
operador

historico/
agendamento/
```

Nem todos os campos precisam existir simultaneamente; alguns aparecem conforme o ciclo operacional.

### 3.2 `dataReferencia` ≠ `inicio`

São conceitos diferentes:

- `dataReferencia`: data do plantão/relatório em processamento;
- `inicio`: início real da ocorrência.

Uma ocorrência herdada pode manter seu início original e receber nova `dataReferencia`.

---

## 4. Estado atual da operação

O snapshot operacional pode conter:

```text
equipe
viatura
sub
pl
coluna
tsDespacho
tsFirstDispatch
operador
colunaN
```

### `coluna`

Representa a **posição operacional atual** da ocorrência no Kanban.

### `colunaN`

Representa a **trajetória operacional derivada** do histórico.

Exemplo conceitual:

```text
coluna  = VIA LIVRE
colunaN = VIA LIVRE → AMC → VIA LIVRE
```

A derivação observada percorre o histórico cronologicamente:

- despacho inicia/reinicia segmento;
- apoio acrescenta tipo ao segmento;
- rendição fecha o segmento atual e inicia outro;
- `vl` corresponde a Via Livre;
- `amc` corresponde a AMC.

---

## 5. Histórico operacional

Persistência:

```text
/kanban/{eventoId}/historico/{pushKey}
```

Os registros usam chaves `push`, permitindo múltiplos eventos sem sobrescrever os anteriores.

Modelo observado para despacho:

```text
{
  tipo: "despacho",
  sub: "...",
  equipe: "...",
  vt: "...",
  ts: <timestamp>,
  operador: "..."
}
```

O histórico também recebe eventos de apoio e rendição.

### Relação snapshot ↔ histórico

```text
/kanban/{eventoId}
├── snapshot atual
└── historico/
    ├── {pushKey}: despacho
    ├── {pushKey}: apoio
    ├── {pushKey}: rendição
    └── ...
```

`colunaN` pode ser reconstruída a partir desse histórico.

---

## 6. Despacho

O despacho atualiza o snapshot e acrescenta um evento ao histórico.

Campos do estado associados ao despacho:

```text
equipe
viatura
sub
pl
coluna
tsDespacho
tsFirstDispatch
operador
colunaN
```

### Timestamps

`tsFirstDispatch` registra o primeiro despacho e não é substituído pelos despachos posteriores.

`tsDespacho` representa o timestamp operacional corrente. Ele pode ser atualizado posteriormente, inclusive por rendição.

Portanto:

```text
tsFirstDispatch = primeiro despacho
tsDespacho      = assunção/despacho operacional atual
```

---

## 7. Apoio

Apoio não substitui diretamente a equipe principal.

```text
operação principal     apoio
------------------     ----------------
equipe                 equipeApoio
viatura                viaturaApoio
```

O apoio também gera registro histórico e participa da derivação de `colunaN`.

---

## 8. Rendição

Rendição pressupõe operação já despachada.

Dados conceituais observados:

```text
tipo     = vl | amc
equipe   = equipe que entra
viatura  = VT que entra
horario  = usado quando agendada
```

### 8.1 Execução imediata

Quando executada, a rendição:

- gera evento histórico `tipo: "rendição"`;
- atualiza `equipe`;
- atualiza `viatura`;
- atualiza `sub`;
- atualiza `tsDespacho`;
- recalcula `colunaN`;
- altera a coluna operacional.

Modelo histórico observado:

```text
{
  tipo: "rendição",
  sub: "...",
  equipe: "...",
  vt: "...",
  ts: <tsExec>,
  operador: "..."
}
```

### 8.2 Agendamento

Persistência:

```text
/kanban/{eventoId}/agendamento
```

O agendamento registra um compromisso futuro e **não altera imediatamente** o estado operacional.

`horaAgendada` e hora efetivamente realizada são conceitos diferentes. Na execução, a hora real é convertida em `tsExec`; o evento histórico é criado e o agendamento é removido.

A auditoria não encontrou executor automático para rendições agendadas.

---

## 9. Normalização

Normalização altera a dimensão de estado da ocorrência.

Persistência no snapshot:

```text
coluna: "coluna-normalizados"
status: "NORMALIZADO"
data_fim
hora_fim
observacoes
ts_norm
operador
```

### Três tempos que não devem ser confundidos

```text
data_fim  = data operacional do encerramento
hora_fim  = hora operacional do encerramento
ts_norm   = momento em que o sistema registrou a normalização
```

`data_fim` e `hora_fim` são informados operacionalmente e podem representar momento anterior ao registro no sistema.

---

## 10. Continuidade, herança e reincidência

A resolução observada prioriza a identidade forte:

```text
novo relatório
   ↓
procura eventoId exato
   ↓
se necessário, usa codigo como chave auxiliar
   ↓
continuidade/herança ou reincidência
```

Quando há herança:

- a identidade da ocorrência é preservada;
- `dataReferencia` é atualizada;
- somente ocorrência não normalizada é candidata à herança.

Ocorrência normalizada não é herdada pelo fluxo auditado.

Mesmo código com início diferente pode resultar em nova ocorrência/reincidência.

---

## 11. Exportação

Origem operacional:

```text
/kanban
```

Fluxo:

```text
Firebase /kanban
      ↓
frontend resolve estado/identidade
      ↓ HTTP
FastAPI
      ↓
Google Sheets
```

O backend recebe o estado já resolvido; não recria a identidade da ocorrência.

Relações comprovadas:

```text
eventoId       → ID_OCORRENCIA
dataReferencia → DATA DO PLANTÃO
inicio         → DATA/HORA DE INÍCIO
ts_norm        → normalização
colunaN        → trajetória operacional exportável
```

A linha mais recente do mesmo `eventoId` é usada para atualização. Herança pode gerar nova linha no Sheets.

---

## 12. Recursos/equipes

O domínio operacional consulta recursos/equipes para auxiliar preenchimentos como equipe, VT e tipo. Esses dados são auxiliares ao estado da ocorrência; não substituem a identidade nem o histórico do evento.

A estrutura detalhada desse cadastro não foi suficientemente consolidada na auditoria para ser especificada além do que foi comprovado.

---

## 13. Domínio Reboques

Reboques possui persistência independente:

```text
/reboques/plantao_ativo/
├── reboquistas/
└── eventos/

/reboques_config
```

Não altera `/kanban`.

### 13.1 Reboquista

Modelo observado:

```text
reboquista
├── nome
├── vt
├── placa
├── plantao
├── smart
├── status
├── eventoId
├── ocorrencia
└── ordem
```

Estados principais:

```text
DISPONÍVEL
   ↓ alocação
ATUANDO
   ↓ finalização
DISPONÍVEL
```

`status` aqui representa o estado do **recurso**, não o estado de uma ocorrência semafórica.

### 13.2 Evento de reboque

Cada evento recebe ID próprio (`evt-...`) e é persistido em:

```text
/reboques/plantao_ativo/eventos/{evId}
```

Um evento pode possuir zero, um ou vários reboquistas.

A auditoria confirmou que um evento pode existir sem reboquista designado.

### 13.3 Relação bidirecional

O vínculo é armazenado nos dois lados:

```text
reboquista.eventoId
        ↕
evento.reboquistas
```

Exemplo:

```text
/reboquistas/reb123
eventoId: evt456

/eventos/evt456
reboquistas:
  reb123: "JOÃO"
  reb789: "PEDRO"
```

Transferir um reboquista exige remover o vínculo anterior e atualizar ambos os lados.

### 13.4 Finalização

Finalização individual:

```text
remove reboquista do evento
status = disponível
eventoId = ""
ocorrencia = ""
recalcula ordem
```

Finalização do evento:

```text
libera vinculados
remove /eventos/{evId}
```

No modelo auditado, evento finalizado é removido do conjunto ativo; não foi encontrado histórico permanente de eventos de reboque.

---

## 14. Fronteiras de persistência

```text
Firebase
│
├── /kanban
│   └── ocorrências semafóricas
│       ├── snapshot atual
│       ├── historico
│       └── agendamento
│
└── /reboques/plantao_ativo
    ├── reboquistas
    └── eventos
```

Google Sheets funciona como destino de exportação do domínio Semáforo, não como estado operacional primário.

---

## 15. Questões ainda abertas

Os itens abaixo não devem ser tratados como fatos resolvidos:

1. **NORMALIZADO → PENDENTE:** comportamento/regra não comprovado na auditoria.
2. **Histórico permanente de Reboques:** não encontrado.
3. **Persistência entre plantões de Reboques:** regra operacional ainda precisa validação.
4. **Scheduler de `cron_export.py`:** existência do código confirmada, infraestrutura ativa não confirmada.
5. **Estrutura completa do cadastro de recursos/equipes:** não suficientemente detalhada para congelar neste modelo.

---

## 16. Regras de manutenção deste documento

Ao alterar o modelo de dados:

1. localizar entidade e fluxo afetados;
2. verificar persistência Firebase;
3. verificar histórico e consumidores;
4. verificar impacto na exportação;
5. preservar distinção entre identidade, estado da ocorrência e estado operacional;
6. não remover componente marcado como legado apenas por parecer antigo;
7. registrar dúvidas como `VALIDAR`;
8. atualizar este documento somente após validar a alteração.

---

## 17. Documentos relacionados

- `ARCHITECTURE.md` — estrutura e responsabilidades dos componentes.
- `BUSINESS-RULES.md` — próximo documento; regras que devem ser preservadas.
- `WORKFLOW.md` — fluxos operacionais ponta a ponta.
- `CONTEXT.MD` — visão curta para entrada de novas sessões/agentes.
- `DECISIONS.md` / ADRs — decisões arquiteturais e suas justificativas.
- `AI-INSTRUCTIONS.md` — protocolo de trabalho de agentes de IA no repositório.

---

**Status:** modelo consolidado a partir da auditoria disponível.  
**Próxima etapa do plano:** `BUSINESS-RULES.md`.
