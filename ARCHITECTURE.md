# ARCHITECTURE.md

## NIT — Arquitetura do Sistema

> **Status:** documentação inicial consolidada a partir da auditoria do código atual.
>
> **Fonte de verdade:** código e configuração atualmente versionados no repositório.
>
> **Princípio:** esta documentação descreve o comportamento comprovado. Comportamentos ainda não confirmados são marcados como `VALIDAR` e não devem ser tratados como requisitos.

---

## 1. Objetivo

O NIT é um sistema operacional web para acompanhamento e tratamento de ocorrências de trânsito, com foco principal em ocorrências semafóricas, operação de recursos e continuidade entre plantões.

A arquitetura atual é composta por:

- frontend web estático;
- Firebase como persistência operacional;
- módulos de operação semafórica;
- módulo independente de Reboques;
- backend separado para processamento e exportação;
- Google Sheets como destino de dados exportados.

O sistema atual não deve ser entendido como uma aplicação monolítica tradicional. Ele possui módulos com responsabilidades diferentes e diferentes ciclos de vida operacional.

---

# 2. Visão arquitetural

```text
                              NIT
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
         SEMÁFOROS          CENTRAL          REBOQUES
              │                │                │
              │          ┌─────┼─────┐          │
              │          │     │     │          │
              │       Despacho Apoio Rendição    │
              │                              ┌───┴────┐
              │                              │        │
              │                         Reboquistas Eventos
              │
              ▼
          /kanban
              │
              ├── estado atual
              ├── histórico
              └── continuidade
              │
              ▼
           Firebase
              │
              ▼
       Backend separado
              │
              ├── FastAPI
              ├── processamento
              └── exportação
              │
              ▼
        Google Sheets
```

---

# 3. Camadas

## 3.1 Frontend

Arquivos principais identificados:

```text
index.html
nit.css
nit.js
reboques.js
reboques.css
supervisor.html
```

O frontend concentra atualmente:

- interface;
- entrada de dados;
- parsing de relatórios;
- regras operacionais;
- gerenciamento de estado local;
- sincronização com Firebase;
- atualização da interface;
- continuidade/herança;
- operações de Central;
- operação de Reboques.

O frontend é, portanto, mais do que uma camada visual: parte relevante das regras de negócio atualmente está implementada nele.

---

## 3.2 Firebase

O Firebase funciona como persistência operacional do sistema.

Principais áreas identificadas:

```text
/kanban
/meta
/reboques
/reboques_config
/usuarios_autorizados
/historico
```

Os caminhos e usos devem ser considerados conforme o comportamento atualmente implementado. Não se deve presumir que todos os caminhos possuem o mesmo papel ou o mesmo ciclo de vida.

### `/kanban`

É o principal estado persistente das ocorrências semafóricas.

Modelo conceitual:

```text
/kanban/{eventoId}
    ├── dados da ocorrência
    ├── estado atual
    ├── dados operacionais
    ├── normalização
    ├── identidade
    └── histórico
```

### `/kanban/{eventoId}/historico`

Registra ações operacionais relacionadas à ocorrência.

Exemplos:

```text
despacho
apoio
rendição
encerramento
```

O histórico funciona como trilha de eventos, enquanto o nó principal mantém o estado atual.

---

# 4. Domínio Semafórico

O fluxo principal é:

```text
Relatório CEMOB
      │
      ▼
Parser
      │
      ▼
Ocorrências
      │
      ▼
Identificação por eventoId
      │
      ▼
Firebase /kanban
      │
      ▼
Kanban
      │
      ├── Central
      │    ├── Despacho
      │    ├── Apoio
      │    └── Rendição
      │
      ├── Normalização
      │
      └── Continuidade / Herança
```

---

# 5. Identidade das ocorrências

A identidade forte de uma ocorrência é:

```text
eventoId = codigo + início
```

Consequências:

- `codigo` sozinho não identifica necessariamente uma ocorrência;
- o mesmo código pode aparecer em ocorrências diferentes;
- mesmo código com horários de início diferentes pode representar eventos distintos;
- ocorrências herdadas preservam sua identidade;
- o backend utiliza esse identificador como `ID_OCORRENCIA` na exportação.

O `eventoId` é um contrato arquitetural importante.

---

# 6. Estado da ocorrência × estado operacional

O sistema possui duas dimensões que não devem ser confundidas.

## Estado da ocorrência

Exemplos:

```text
PENDENTE
NORMALIZADO
SEM_NECESSIDADE
```

## Estado operacional

Representado principalmente pela posição no Kanban e pelos campos operacionais:

```text
espera
VIA LIVRE
AMC
apoio
rendição
encerramento
```

Portanto:

```text
NORMALIZAR uma ocorrência
```

não significa:

```text
ENCERRAR uma operação
```

Esses são eventos conceitualmente diferentes.

---

# 7. `coluna` e `colunaN`

## `coluna`

Representa a posição operacional atual da ocorrência no Kanban.

## `colunaN`

Representa a trajetória operacional construída ao longo do atendimento.

Exemplo conceitual:

```text
coluna:
VIA LIVRE

colunaN:
VIA LIVRE → AMC → VIA LIVRE
```

A trajetória pode ser derivada a partir do histórico quando necessário.

`coluna` e `colunaN` não devem ser tratados como sinônimos.

---

# 8. Central

A Central opera sobre uma ocorrência já existente no Kanban.

Fluxo:

```text
Card
 │
 ▼
NitCentral.abrir()
 │
 ▼
Modal Central
 │
 ├── Despacho
 ├── Apoio
 ├── Rendição
 └── Normalização
```

---

## 8.1 Despacho

O despacho:

- exige equipe, salvo situações específicas como `sn`;
- registra histórico;
- atualiza estado operacional atual;
- atualiza equipe e viatura;
- atualiza coluna;
- registra timestamps;
- pode alimentar `colunaN`;
- atualiza aprendizado de recursos.

Existe uma implementação antiga/alternativa de despacho no frontend e endpoints de compatibilidade no backend.

Esses componentes são considerados **LEGADO/COMPATIBILIDADE** até que seus consumidores sejam formalmente validados.

---

## 8.2 Apoio

O apoio:

- registra uma ação no histórico;
- associa equipe/viatura de apoio;
- atualiza `colunaN`;
- não substitui automaticamente o despacho principal;
- não deve ser confundido com uma nova ocorrência.

O estado de apoio é complementar ao estado operacional principal.

---

## 8.3 Rendição

A rendição possui dois modos:

```text
IMEDIATA
AGENDADA
```

A rendição agendada registra:

```text
tipo
sub
equipe
vt
horaAgendada
tsRegistro
operador
```

O sistema atual não executa automaticamente a rendição no horário agendado.

A execução permanece dependente da ação do operador.

---

# 9. Normalização

A normalização representa o encerramento da ocorrência semafórica do ponto de vista do ciclo da falha.

Fluxo:

```text
PENDENTE
   │
   │ data + hora de fim
   ▼
NORMALIZADO
```

Dados relevantes:

```text
data_fim
hora_fim
ts_norm
status
coluna
operador
```

Os tempos possuem significados diferentes:

```text
inicio
    = início da ocorrência

data_fim + hora_fim
    = fim operacional da ocorrência

ts_norm
    = momento em que a normalização foi registrada
```

Não devem ser tratados como o mesmo timestamp.

---

# 10. Continuidade entre plantões

A continuidade ocorre principalmente durante o reprocessamento de relatórios.

Fluxo conceitual:

```text
Novo relatório
      │
      ▼
eventoId existe?
      │
 ┌────┴────┐
 │         │
SIM       NÃO
 │         │
 ▼         ▼
Atualiza   procura ocorrência
           pelo código
               │
               ▼
        existe pendência
        não normalizada?
               │
          ┌────┴────┐
         SIM        NÃO
          │          │
          ▼          ▼
       Herda      Nova ocorrência
```

Regras observadas:

- correspondência exata por `eventoId` tem prioridade;
- o código pode ser usado como chave auxiliar de continuidade;
- ocorrência normalizada não é candidata normal à herança;
- herança preserva a identidade da ocorrência;
- a `dataReferencia` pode ser atualizada;
- reincidência pode gerar nova ocorrência.

---

# 11. Virada de dia e processamento

`NitProcessamento` possui responsabilidade diferente da lógica de herança.

Ele mantém informações de processamento em:

```text
localStorage
```

e replica metadados no Firebase.

Sua função principal é identificar possível lacuna entre processamentos e orientar o operador.

O sistema atual:

- não consulta WhatsApp automaticamente;
- não recupera sozinho um relatório externo;
- depende da confirmação/processamento pelo operador.

A continuidade efetiva da ocorrência ocorre no reprocessamento do relatório.

---

# 12. Persistência local

O frontend utiliza `localStorage` para metadados relacionados ao processamento.

Entre os dados identificados:

```text
nit-ultimo-processamento-v1
nit-historico-relatorios-v1
```

O histórico local mantém uma quantidade limitada de relatórios para rastreabilidade/reprocessamento.

Isso não substitui o Firebase como persistência operacional principal.

---

# 13. Backend

O backend está em repositório separado:

```text
CrissTiano07/nit-backend
```

Componentes principais auditados:

```text
main.py
routes/export.py
processar_relatorio.py
cron_export.py
services/sheets_integration.py
config/clientes.json
```

---

# 14. Responsabilidade do backend

O backend não é atualmente o responsável por decidir a identidade operacional das ocorrências.

A divisão observada é:

```text
Frontend
   │
   ├── interpreta relatório
   ├── identifica ocorrência
   ├── resolve continuidade
   └── grava estado no Firebase
          │
          ▼
       Firebase
          │
          ▼
       Backend
          │
          ├── lê estado
          ├── processa exportação
          └── grava Google Sheets
```

Essa separação é importante.

O backend deve ser tratado como consumidor do estado operacional já resolvido, salvo futuras decisões arquiteturais que alterem explicitamente essa responsabilidade.

---

# 15. Exportação

O fluxo atual é:

```text
Firebase /kanban
      │
      ▼
routes/export.py
      │
      ├── novas ocorrências
      ├── normalizações
      ├── heranças
      └── sincronização de colunaN
      │
      ▼
sheets_integration.py
      │
      ▼
Google Sheets
```

A configuração de cliente define:

```text
ocorrencias_node = /kanban
coluna_id_ocorrencia = R
```

O identificador da ocorrência é exportado para:

```text
ID_OCORRENCIA
```

na coluna R.

---

# 16. Cursor de exportação

A exportação utiliza metadados de cursor para evitar reprocessamento indiscriminado.

Para o cliente atualmente configurado são utilizados campos relacionados a:

```text
ultimo_ts
ultima_atualizacao
ultimo_dataReferencia
```

Esses cursores permitem separar:

- novas ocorrências;
- atualizações de normalização;
- heranças entre datas.

---

# 17. Herança no Google Sheets

Quando uma ocorrência é herdada para outro plantão:

```text
mesmo eventoId
+
nova dataReferencia
```

pode resultar em uma nova linha no Sheets.

A identidade da ocorrência continua sendo a mesma:

```text
ID_OCORRENCIA = eventoId
```

A linha mais recente do mesmo identificador é utilizada para determinadas atualizações.

Isso permite representar a continuidade do evento entre plantões sem alterar sua identidade.

---

# 18. Reboques

Reboques constitui um domínio operacional independente do Kanban semafórico.

Estrutura conceitual:

```text
/reboques/plantao_ativo
    │
    ├── reboquistas
    │
    └── eventos
```

O módulo possui seu próprio estado, ciclo de vida e interface.

Não deve ser tratado como uma extensão do `/kanban`.

---

# 19. Modelo de Reboques

Um reboquista possui, entre outros dados:

```text
nome
vt
placa
plantao
smart
status
eventoId
ocorrencia
ordem
```

Estados principais:

```text
DISPONÍVEL
     │
     ▼
ATUANDO
     │
     ▼
DISPONÍVEL
```

O `eventoId` do reboquista representa o evento operacional atual ao qual ele está vinculado.

---

# 20. Relação Reboquista ↔ Evento

Existe relacionamento bidirecional:

```text
reboquista.eventoId
        ↕
evento.reboquistas
```

Essa relação deve permanecer consistente.

Ao transferir um reboquista para outro evento, o vínculo anterior é removido antes/como parte da nova alocação.

---

# 21. Ciclo de vida do evento de Reboques

```text
Evento criado
      │
      ▼
Aguardando / sem reboquista
      │
      ▼
Alocação
      │
      ▼
Atendimento
      │
      ▼
Finalização
      │
      ▼
Evento removido do estado ativo
```

O código atual não estabelece, neste módulo, um histórico persistente equivalente ao histórico operacional do Semáforo.

Essa questão permanece:

```text
VALIDAR:
eventos finalizados devem ser arquivados?
```

---

# 22. Relatórios e WhatsApp

Reboques possui funções para:

- gerar relatório do estado atual;
- montar mensagens;
- copiar conteúdo para uso no WhatsApp.

Essas funções trabalham principalmente com o snapshot atual do plantão.

---

# 23. Autenticação

A aplicação utiliza autenticação Firebase.

Após o login, módulos operacionais podem iniciar seus listeners e carregar estado.

O acesso autorizado também possui dados persistidos em:

```text
/usuarios_autorizados
```

A autenticação deve ser considerada infraestrutura transversal aos módulos, e não uma regra específica do domínio semafórico ou de Reboques.

---

# 24. Fluxo geral de dados

O sistema pode ser resumido em quatro grandes movimentos:

```text
ENTRADA
   │
   ├── Relatório CEMOB
   ├── Operador
   └── Relatório de Reboques
   │
   ▼
PROCESSAMENTO
   │
   ├── Parser
   ├── Identidade
   ├── Regras
   └── Estado
   │
   ▼
PERSISTÊNCIA
   │
   ├── Firebase
   └── localStorage
   │
   ▼
CONSUMO
   │
   ├── Kanban
   ├── Central
   ├── Reboques
   ├── Relatórios
   └── Google Sheets
```

---

# 25. Responsabilidades por componente

| Componente | Responsabilidade principal |
|---|---|
| `index.html` | estrutura da aplicação |
| `nit.css` | apresentação principal |
| `nit.js` | operação semafórica e estado associado |
| `reboques.js` | domínio operacional de Reboques |
| `reboques.css` | apresentação de Reboques |
| `supervisor.html` | interface específica de supervisão |
| Firebase | persistência operacional |
| `main.py` | entrada da API backend |
| `routes/export.py` | orquestração da exportação |
| `sheets_integration.py` | tradução para Google Sheets |
| `cron_export.py` | execução batch da exportação |
| `processar_relatorio.py` | processamento estruturado de relatório |

---

# 26. Infraestrutura atual e histórico

O código contém referências históricas a Railway.

Essas referências **não devem ser interpretadas como infraestrutura atual**.

No momento desta documentação:

```text
Railway
= referência histórica/legada

Render
= possibilidade futura, não infraestrutura confirmada

Scheduler do cron
= ainda não documentado como execução operacional atual
```

O `cron_export.py` é um processo batch que executa a exportação e termina. A existência do arquivo não comprova, por si só, que exista um scheduler atualmente executando-o.

---

# 27. Componentes legados ou alternativos

Foram encontrados componentes que não representam claramente o fluxo principal atual:

```text
NitNormalizar
modal antigo de despacho
/api/v1/despacho
/api/v1/normalizar
referências históricas de Railway
routes/config.py
```

Eles não devem ser removidos sem investigação de consumidores.

Classificação atual:

```text
LEGADO / COMPATIBILIDADE
```

até que a dependência seja comprovadamente inexistente.

---

# 28. Contratos arquiteturais confirmados

Os seguintes princípios devem ser preservados durante alterações futuras:

1. `eventoId` é a identidade forte da ocorrência.
2. `codigo` não substitui `eventoId`.
3. Normalização e encerramento operacional são conceitos diferentes.
4. `coluna` e `colunaN` possuem significados diferentes.
5. O estado atual e o histórico possuem responsabilidades distintas.
6. A continuidade/herança é resolvida no domínio semafórico antes da exportação.
7. O backend de exportação consome o estado resolvido do Firebase.
8. Google Sheets é destino de exportação, não o estado operacional primário.
9. Reboques possui domínio e persistência operacional independentes.
10. Relações bidirecionais de Reboques devem permanecer consistentes.
11. Código legado não deve ser removido sem verificar consumidores.
12. Documentação deve descrever o código atual; decisões novas devem ser registradas explicitamente.

---

# 29. Questões arquiteturais ainda abertas

Estas questões não devem ser transformadas em requisitos até serem validadas:

### Q-001 — Reversão de normalização

O reprocessamento atualmente não apresenta uma regra explícita de retorno automático de:

```text
NORMALIZADO → PENDENTE
```

**Status:** VALIDAR.

### Q-002 — Histórico de Reboques

Eventos finalizados são removidos do estado ativo.

**Status:** VALIDAR se existe necessidade operacional de arquivamento permanente.

### Q-003 — Limpeza de plantão

O módulo Reboques possui operação de limpeza do plantão ativo.

**Status:** VALIDAR permissões, pré-condições e expectativa operacional.

### Q-004 — Scheduler da exportação

Existe `cron_export.py`, mas o mecanismo atual de agendamento não está estabelecido nesta documentação.

**Status:** VALIDAR infraestrutura de execução.

### Q-005 — Componentes legados

Implementações alternativas de despacho/normalização e endpoints de compatibilidade ainda existem.

**Status:** VALIDAR consumidores antes de qualquer remoção.

---

# 30. Regra para futuras alterações

Qualquer alteração significativa deve começar respondendo:

```text
1. Qual domínio está sendo alterado?
2. Qual entidade está envolvida?
3. Qual é sua identidade?
4. Qual estado está sendo alterado?
5. Onde esse estado é persistido?
6. Existe histórico?
7. Existem consumidores?
8. Existe exportação?
9. Existe continuidade entre plantões?
10. Existe documentação que precisa ser atualizada?
```

Uma alteração não deve ser feita apenas porque uma função parece ser o local mais conveniente.

---

# 31. Relação com a documentação do projeto

A arquitetura será detalhada por outros documentos:

```text
ARCHITECTURE.md
    │
    ├── visão estrutural
    │
    ├── DATA-MODEL.md
    │       └── entidades e persistência
    │
    ├── BUSINESS-RULES.md
    │       └── regras de negócio
    │
    ├── WORKFLOW.md
    │       └── fluxos operacionais
    │
    ├── DECISIONS.md
    │       └── decisões arquiteturais
    │
    ├── AI-INSTRUCTIONS.md
    │       └── protocolo de trabalho da IA
    │
    └── TODO.md
            └── questões e tarefas abertas
```

`ARCHITECTURE.md` não deve absorver todos os detalhes desses documentos.

---

# 32. Status desta documentação

```text
AUDITORIA DOS CICLOS 1–8     CONCLUÍDA
ARQUITETURA CONSOLIDADA       CONCLUÍDA
MODELO DE DADOS               PRÓXIMA ETAPA
REGRAS DE NEGÓCIO             POSTERIOR
WORKFLOWS                     POSTERIOR
PROTOCOLO PARA IA             POSTERIOR
ALTERAÇÕES DE CÓDIGO          NÃO INICIADAS
```

---

## Princípio final

> **O NIT deve evoluir a partir do comportamento real do sistema, com mudanças deliberadas e rastreáveis.**

> **Nenhuma IA deve presumir que uma função, arquivo ou endpoint representa sozinho uma regra de negócio. A regra deve ser entendida no contexto de identidade, estado, persistência, histórico, consumidores e fluxo operacional.**
