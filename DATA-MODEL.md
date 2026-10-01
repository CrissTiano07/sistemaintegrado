# DATA-MODEL.md — NIT

> Modelo de dados observado no sistema atual e conceitos de dados aprovados para a camada de integridade/reconciliação.
>
> Este documento descreve entidades, identidades, estados, relações e persistência comprovados na auditoria dos ciclos 1–8. Ele **não transforma automaticamente comportamento existente em regra de negócio**. Regras normativas pertencem a `BUSINESS-RULES.md`; decisões arquiteturais, a ADRs/`DECISIONS.md`.
>
> Estruturas aprovadas apenas em nível conceitual são explicitamente identificadas como tal. Sua presença neste documento não determina antecipadamente caminho Firebase, nomes finais de campos ou schema físico.

## 1. Escopo

O NIT possui dois domínios operacionais persistidos separadamente:

1. **Semáforo / ocorrências** — estado operacional principal em `/kanban`.
2. **Reboques** — estado do plantão em `/reboques/plantao_ativo`.

Os domínios não compartilham estado operacional.

A evolução do Semáforo passa também a reconhecer conceitualmente informações de **integridade/reconciliação**, sem que sua persistência física esteja definida neste momento.

---

## 2. Princípios do modelo

### 2.1 Identidade da ocorrência

`eventoId` é a identidade forte da ocorrência no domínio Semáforo.

Conceitualmente:

```text id="gzhm5g"
eventoId = codigo + inicio
```

`codigo` sozinho não identifica de forma suficiente uma ocorrência. O mesmo código pode reaparecer com outro início e representar outro evento.

```text id="qq4shc"
eventoId
└── identidade forte

codigo
└── chave auxiliar para continuidade/herança/reconciliação

reincidente
└── indica nova ocorrência com mesmo código
```

Na exportação, `eventoId` corresponde a `ID_OCORRENCIA`.

Uma nova representação CEMOB incompatível com dados anteriores não implica automaticamente novo `eventoId`. Antes disso, pode ser necessário determinar se existe continuidade, reincidência ou retificação.

### 2.2 Estado da ocorrência e estado operacional são dimensões distintas

```text id="95zz1g"
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

Uma reconciliação do estado da ocorrência também não implica, por si só, restauração ou reativação do estado operacional.

### 2.3 Snapshot atual + histórico

O modelo do `/kanban` combina:

- um **snapshot** no nó principal da ocorrência;
- um **histórico append-only** de ações operacionais.

O snapshot responde:

```text id="7p4xnn"
"qual é o estado atual?"
```

O histórico responde:

```text id="atjnve"
"como chegamos aqui operacionalmente?"
```

### 2.4 Integridade é uma dimensão distinta do histórico operacional

O modelo passa a reconhecer conceitualmente uma terceira necessidade:

```text id="ayckgn"
OCORRÊNCIA
├── snapshot atual
├── histórico operacional
└── evidência de integridade/reconciliação
```

Essas três dimensões possuem responsabilidades diferentes:

```text id="t2vvkl"
SNAPSHOT
→ estado atual

HISTÓRICO OPERACIONAL
→ fatos operacionais ocorridos

INTEGRIDADE / RECONCILIAÇÃO
→ anomalias detectadas, decisões e correções
```

O Registro de Integridade **não deve ser confundido com o histórico operacional**.

Sua persistência física ainda não está definida.

---

## 3. Ocorrência Semafórica

### 3.1 Persistência principal

```text id="13epd0"
/kanban/{eventoId}
```

Campos comprovadamente relevantes ao modelo auditado incluem:

```text id="52tzsi"
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

Nenhum campo físico adicional para Guardião/Registro de Integridade é congelado nesta seção antes da implementação.

### 3.2 `dataReferencia` ≠ `inicio`

São conceitos diferentes:

- `dataReferencia`: data do plantão/relatório em processamento;
- `inicio`: início real da ocorrência.

Uma ocorrência herdada pode manter seu início original e receber nova `dataReferencia`.

### 3.3 Identidade operacional estável durante reconciliação

Quando uma nova representação CEMOB for identificada como possível retificação de uma ocorrência existente, a identidade operacional conhecida deve permanecer protegida enquanto a contradição é reconciliada.

Conceitualmente:

```text id="r51z1a"
ocorrência conhecida
eventoId = X

        ↓

nova representação incompatível

        ↓

reconciliação

        ↓

se confirmada como mesma ocorrência:
eventoId continua X
```

Não se cria nova identidade apenas porque um campo usado originalmente na composição da identidade apareceu posteriormente corrigido na fonte.

O tratamento físico dessa situação deve ser definido durante a implementação sem violar o contrato de identidade.

---

## 4. Estado atual da operação

O snapshot operacional pode conter:

```text id="6y1gme"
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

```text id="cmn9y9"
coluna  = VIA LIVRE
colunaN = VIA LIVRE → AMC → VIA LIVRE
```

A derivação observada percorre o histórico cronologicamente:

- despacho inicia/reinicia segmento;
- apoio acrescenta tipo ao segmento;
- rendição fecha o segmento atual e inicia outro;
- `vl` corresponde a Via Livre;
- `amc` corresponde a AMC.

Uma alteração reconciliada do estado da ocorrência não reescreve automaticamente esses fatos operacionais.

---

## 5. Histórico operacional

Persistência:

```text id="91ur70"
/kanban/{eventoId}/historico/{pushKey}
```

Os registros usam chaves `push`, permitindo múltiplos eventos sem sobrescrever os anteriores.

Modelo observado para despacho:

```text id="o8qso5"
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

```text id="w7s9xy"
/kanban/{eventoId}
├── snapshot atual
└── historico/
    ├── {pushKey}: despacho
    ├── {pushKey}: apoio
    ├── {pushKey}: rendição
    └── ...
```

`colunaN` pode ser reconstruída a partir desse histórico.

Uma retificação ou reversão não deve apagar silenciosamente fatos históricos já registrados.

---

## 6. Despacho

O despacho atualiza o snapshot e acrescenta um evento ao histórico.

Campos do estado associados ao despacho:

```text id="smp2cj"
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

```text id="wt1un6"
tsFirstDispatch = primeiro despacho
tsDespacho      = assunção/despacho operacional atual
```

---

## 7. Apoio

Apoio não substitui diretamente a equipe principal.

```text id="0i8ss6"
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

```text id="3kzbkh"
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

```text id="ryu5y7"
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

```text id="10wr3i"
/kanban/{eventoId}/agendamento
```

O agendamento registra um compromisso futuro e **não altera imediatamente** o estado operacional.

`horaAgendada` e hora efetivamente realizada são conceitos diferentes. Na execução, a hora real é convertida em `tsExec`; o evento histórico é criado e o agendamento é removido.

A auditoria não encontrou executor automático para rendições agendadas.

---

## 9. Normalização

Normalização altera a dimensão de estado da ocorrência.

Persistência no snapshot:

```text id="v0yfbj"
coluna: "coluna-normalizados"
status: "NORMALIZADO"
data_fim
hora_fim
observacoes
ts_norm
operador
```

### Três tempos que não devem ser confundidos

```text id="r4rkrv"
data_fim = data operacional do encerramento
hora_fim = hora operacional do encerramento
ts_norm  = momento em que o sistema registrou a normalização
```

`data_fim` e `hora_fim` são informados operacionalmente e podem representar momento anterior ao registro no sistema.

### 9.1 Reconciliação `NORMALIZADO → PENDENTE`

`NORMALIZADO → PENDENTE` passa a ser uma transição válida exclusivamente quando resultar de reconciliação explícita de retificação.

Exemplo:

```text id="pxn1n2"
VERSÃO RECEBIDA 1

inicio    = 10:00
hora_fim  = 10:40
status    = NORMALIZADO

        ↓

VERSÃO RECEBIDA 2

inicio    = 10:00
hora_fim  = ausente
```

A segunda representação não apaga automaticamente a primeira.

Antes da persistência da mudança:

```text id="q0i3m3"
detectar contradição
→ preservar estado conhecido
→ projetar consequência
→ decisão humana quando necessária
→ reconciliar
```

Quando confirmada a retificação:

```text id="o93ycm"
mesmo eventoId
histórico operacional preservado
status = PENDENTE
dados de normalização reconciliados
```

A forma física exata de representar dados anteriores e atuais da fonte ainda não é congelada neste documento.

---

## 10. Continuidade, herança, reincidência e retificação

A resolução deve distinguir quatro conceitos:

```text id="ss5fn8"
CONTINUIDADE
→ mesma ocorrência permanece ativa

HERANÇA
→ continuidade entre processamento/plantão

REINCIDÊNCIA
→ nova ocorrência do mesmo código

RETIFICAÇÃO
→ nova representação da mesma ocorrência
```

A resolução observada atualmente prioriza a identidade forte:

```text id="agzc0v"
novo relatório
   ↓
procura eventoId exato
   ↓
se necessário, usa codigo como chave auxiliar
```

Com o Guardião, a ausência de correspondência exata deve permitir avaliar:

```text id="k1vt6w"
continuidade?
herança?
reincidência?
retificação?
contradição não resolvida?
```

Quando há herança:

- a identidade da ocorrência é preservada;
- `dataReferencia` é atualizada;
- somente ocorrência não normalizada é candidata à herança.

Ocorrência normalizada **não é herdada**.

Isso não impede que uma ocorrência normalizada seja posteriormente reconciliada como pendente. São mecanismos distintos.

Mesmo código com início diferente **pode** resultar em nova ocorrência/reincidência, mas uma alteração contraditória da fonte não deve criar automaticamente novo evento antes da avaliação de integridade.

---

## 11. Registro de Integridade — modelo conceitual

**Estado:** conceito aprovado; schema físico ainda não definido.

O NIT deve ser capaz de preservar informação sobre situações relevantes detectadas pelo Guardião.

Conceitualmente:

```text id="p84l8b"
CASO DE INTEGRIDADE

├── identificação do caso
├── ocorrência relacionada
├── detecção
├── evidência recebida
├── estado conhecido
├── estado projetado
├── diagnóstico
├── decisão humana
├── consequência aplicada
└── reversão, quando houver
```

Essa estrutura é **conceitual**.

Este documento ainda não determina:

```text id="42hq0c"
/integridade/{id}
```

nem qualquer outro caminho físico específico.

### 11.1 Relação com ocorrência

Quando existir ocorrência identificável, o Caso de Integridade deve permitir associação inequívoca com ela.

Conceitualmente:

```text id="l8v21k"
Caso de Integridade
        ↓
     eventoId
        ↓
Ocorrência Semafórica
```

A relação não transforma o Caso de Integridade em parte do histórico operacional.

### 11.2 Evidência

Um Caso de Integridade deve ser capaz de representar informação suficiente para responder:

```text id="e2o5t7"
O que o NIT conhecia?

O que chegou depois?

O que mudou?

O que o NIT projetou?

O que foi decidido?

Qual foi o resultado?
```

Não é necessário congelar agora quais campos físicos responderão a cada pergunta.

### 11.3 Decisão

Quando houver decisão humana, deve ser possível associá-la conceitualmente a:

```text id="jxw7f5"
decisão
operador
momento
resultado
```

### 11.4 Reversão

Uma reversão não elimina conceitualmente a decisão anterior.

```text id="x59j3l"
DECISÃO A
   ↓
aplicada
   ↓
REVERSÃO
   ↓
DECISÃO B / estado corrigido
```

O modelo deve permitir auditoria dessa sequência.

### 11.5 Casos que não precisam virar Registro de Integridade

Variações absorvidas normalmente pelo parser e que não representam risco estrutural não precisam gerar Caso de Integridade.

Exemplos conceituais:

```text id="81rvp0"
espaços extras
variações toleradas de hífen
formatação equivalente
outras normalizações de entrada já previstas
```

O Registro de Integridade existe para situações relevantes, não para produzir ruído de auditoria.

---

## 12. Estado projetado

**Estado:** conceito aprovado; persistência não obrigatória.

Antes de uma alteração protegida ser persistida, o NIT deve ser capaz de representar temporariamente seu resultado projetado.

Conceitualmente:

```text id="ktmk7m"
ESTADO ATUAL
      +
ENTRADA CEMOB
      ↓
ESTADO PROJETADO
```

O estado projetado permite calcular, entre outros:

```text id="2s3pge"
Ocorrências
Pendentes
Normalizados
```

e comparar:

```text id="t88kzj"
ANTES
  ×
DEPOIS
```

O estado projetado pode existir apenas em memória durante o processamento. Este documento não exige persistência no Firebase.

---

## 13. Recuperabilidade

**Estado:** conceito aprovado; mecanismo físico a definir na implementação.

Uma decisão humana protegida deve possuir informação suficiente para permitir correção posterior quando tecnicamente seguro.

Isso não significa armazenar obrigatoriamente uma cópia completa de todo `/kanban`.

A necessidade conceitual é:

```text id="5pq7hy"
estado antes
+
decisão
+
alteração aplicada
+
fatos posteriores relevantes
      ↓
avaliar se reversão é segura
```

### Reversão segura

Quando nenhum fato posterior seria destruído:

```text id="8x9lgc"
decisão
→ correção
→ novo estado
→ registro da reversão
```

### Reversão não segura

Quando existem fatos posteriores:

```text id="n41w4e"
decisão
→ novos fatos operacionais
→ tentativa de desfazer
→ NÃO restaurar snapshot cegamente
→ reconciliar
```

O modelo físico necessário para suportar esse comportamento será definido durante a implementação e os testes de aceitação.

---

## 14. Exportação

Origem operacional:

```text id="ibah2g"
/kanban
```

Fluxo:

```text id="61fcyc"
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

```text id="c6oh2p"
eventoId       → ID_OCORRENCIA
dataReferencia → DATA DO PLANTÃO
inicio         → DATA/HORA DE INÍCIO
ts_norm        → normalização
colunaN        → trajetória operacional exportável
```

A linha mais recente do mesmo `eventoId` é usada para atualização. Herança pode gerar nova linha no Sheets.

O Registro de Integridade não é definido, neste momento, como conteúdo exportável para Google Sheets.

---

## 15. Recursos/equipes

O domínio operacional consulta recursos/equipes para auxiliar preenchimentos como equipe, VT e tipo. Esses dados são auxiliares ao estado da ocorrência; não substituem a identidade nem o histórico do evento.

A estrutura detalhada desse cadastro não foi suficientemente consolidada na auditoria para ser especificada além do que foi comprovado.

---

## 16. Domínio Reboques

Reboques possui persistência independente:

```text id="5y75wn"
/reboques/plantao_ativo/
├── reboquistas/
└── eventos/

/reboques_config
```

Não altera `/kanban`.

### 16.1 Reboquista

Modelo observado:

```text id="9ly14m"
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

```text id="vrpnwr"
DISPONÍVEL
   ↓ alocação
ATUANDO
   ↓ finalização
DISPONÍVEL
```

`status` aqui representa o estado do **recurso**, não o estado de uma ocorrência semafórica.

### 16.2 Evento de reboque

Cada evento recebe ID próprio (`evt-...`) e é persistido em:

```text id="6bzsdg"
/reboques/plantao_ativo/eventos/{evId}
```

Um evento pode possuir zero, um ou vários reboquistas.

A auditoria confirmou que um evento pode existir sem reboquista designado.

### 16.3 Relação bidirecional

O vínculo é armazenado nos dois lados:

```text id="c7ufle"
reboquista.eventoId
        ↕
evento.reboquistas
```

Exemplo:

```text id="wpf4b8"
/reboquistas/reb123
eventoId: evt456

/eventos/evt456
reboquistas:
  reb123: "JOÃO"
  reb789: "PEDRO"
```

Transferir um reboquista exige remover o vínculo anterior e atualizar ambos os lados.

### 16.4 Finalização

Finalização individual:

```text id="0g0rqa"
remove reboquista do evento
status = disponível
eventoId = ""
ocorrencia = ""
recalcula ordem
```

Finalização do evento:

```text id="vlxsc0"
libera vinculados
remove /eventos/{evId}
```

No modelo auditado, evento finalizado é removido do conjunto ativo; não foi encontrado histórico permanente de eventos de reboque.

---

## 17. Fronteiras de persistência

### Persistência comprovada atualmente

```text id="c4iy56"
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

### Conceitos aprovados sem persistência física congelada

```text id="41tqdt"
Guardião
├── estado projetado
└── Caso de Integridade
    ├── detecção
    ├── evidência
    ├── decisão
    ├── consequência
    └── reversão
```

Esses conceitos não devem ser interpretados como novos caminhos Firebase até que a implementação correspondente seja aprovada.

---

## 18. Questões ainda abertas

Os itens abaixo não devem ser tratados como fatos resolvidos:

1. **Histórico permanente de Reboques:** não encontrado.
2. **Persistência entre plantões de Reboques:** regra operacional ainda precisa validação.
3. **Scheduler de `cron_export.py`:** existência do código confirmada, infraestrutura ativa não confirmada.
4. **Estrutura completa do cadastro de recursos/equipes:** não suficientemente detalhada para congelar neste modelo.
5. **Schema físico do Registro de Integridade:** deliberadamente não definido nesta etapa.
6. **Representação física das versões/retificações CEMOB:** deliberadamente não definida antes da implementação/testes.

`NORMALIZADO → PENDENTE` não permanece como questão aberta.

Está aprovado como:

```text id="v3h3n9"
NORMALIZADO
      ↓
contradição relevante da fonte
      ↓
reconciliação explícita
      ↓
decisão humana quando necessária
      ↓
mesma ocorrência / mesmo eventoId
      ↓
PENDENTE
```

Isso não altera a regra de que ocorrência normalizada não participa da herança.

---

## 19. Regras de manutenção deste documento

Ao alterar o modelo de dados:

1. localizar entidade e fluxo afetados;
2. verificar persistência Firebase;
3. verificar histórico e consumidores;
4. verificar impacto na exportação;
5. preservar distinção entre identidade, estado da ocorrência e estado operacional;
6. preservar distinção entre histórico operacional e Registro de Integridade;
7. não remover componente marcado como legado apenas por parecer antigo;
8. registrar dúvidas como `VALIDAR`;
9. não congelar schema físico antes de necessidade comprovada;
10. atualizar este documento somente após validar a alteração.

---

## 20. Documentos relacionados

- `ARCHITECTURE.md` — estrutura e responsabilidades dos componentes.
- `BUSINESS-RULES.md` — contratos e regras que devem ser preservados.
- `WORKFLOW.md` — fluxos operacionais ponta a ponta.
- `CONTEXT.MD` — visão curta para entrada de novas sessões/agentes.
- `DECISIONS.md` / ADRs — decisões arquiteturais e suas justificativas.
- `AI-INSTRUCTIONS.md` — protocolo de trabalho de agentes de IA no repositório.
- `TODO.md` — pendências, implementação e validação.
- Contrato de Entrada CEMOB — tolerâncias, validações e casos adversos da entrada.

---

**Status:** modelo atual consolidado a partir da auditoria disponível; conceitos de integridade, reconciliação, estado projetado e recuperabilidade aprovados sem congelamento prematuro de schema físico.

**Próxima etapa da entrega:** atualizar o Contrato de Entrada CEMOB e, em seguida, consolidar o `TODO.md` com a linha de chegada da implementação/testes.
