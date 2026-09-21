# CONTEXT.MD — Sistema Integrado NIT

> Porta de entrada técnica para pessoas e agentes de IA.
>
> Leia este arquivo primeiro. Ele é deliberadamente curto. Para detalhes, siga os documentos especializados indicados abaixo.

## 1. O que é este projeto

O NIT é um sistema operacional de apoio ao Núcleo de Inteligência de Tráfego.

O sistema possui dois domínios principais:

```text
SEMÁFOROS
CEMOB → parser → ocorrência → Kanban → Central
                               ├── despacho
                               ├── apoio
                               ├── rendição
                               └── normalização
                               ↓
                    continuidade / herança
                               ↓
                          exportação
```

```text
REBOQUES
plantão → reboquistas → eventos → alocação → atendimento → finalização
```

Os dois domínios possuem modelos operacionais independentes.

---

## 2. Arquitetura em uma frase

```text
Frontend → Firebase RTDB → Backend FastAPI → Google Sheets
```

Com uma distinção importante:

- **Firebase** é o estado operacional persistente.
- **Google Sheets** é destino de exportação/consolidação.
- O fluxo operacional atual de despacho/apoio/rendição grava diretamente no Firebase.
- O backend participa principalmente do processamento/exportação para Sheets.
- Referências antigas a **Railway** não representam infraestrutura atual confirmada.
- A infraestrutura atual do processo agendado de exportação ainda precisa ser definida/documentada.

Consulte `ARCHITECTURE.md` antes de alterar arquitetura ou integração.

---

## 3. Contratos essenciais

Estas distinções não podem ser ignoradas:

```text
eventoId ≠ codigo
normalização ≠ encerramento operacional
coluna ≠ colunaN
estado da ocorrência ≠ estado operacional
tsFirstDispatch ≠ tsDespacho
Semáforo ≠ Reboques
```

### Identidade

```text
eventoId = identidade forte da ocorrência
codigo   = chave auxiliar para continuidade/herança
```

Mesmo código não significa necessariamente mesma ocorrência.

Ocorrência herdada preserva `eventoId`.

Ocorrência normalizada não participa da herança no fluxo consolidado.

### Estado

O modelo combina:

```text
/kanban/{eventoId}
├── snapshot atual
└── historico/
    └── eventos append-only
```

O snapshot informa o estado atual; o histórico preserva a trajetória operacional.

Consulte `DATA-MODEL.md` e `BUSINESS-RULES.md` antes de alterar campos, identidade, persistência ou regras.

---

## 4. Fluxo principal atual

No domínio Semáforo:

```text
Relatório CEMOB
      ↓
Processar
      ↓
Parser
      ↓
resolver identidade
      ↓
/kanban
      ↓
Kanban
      ↓
NitCentral
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

`NitCentral` é o caminho operacional principal atual para despacho e ações relacionadas à ocorrência.

Existem implementações/endpoints antigos ou alternativos que permanecem no código por compatibilidade. Eles **não devem ser removidos por inferência**.

Consulte `WORKFLOW.md` antes de alterar um fluxo operacional.

---

## 5. Reboques

Reboques utiliza estado próprio:

```text
/reboques/plantao_ativo/
├── reboquistas/
└── eventos/
```

e não compartilha o `/kanban` do Semáforo.

Um reboquista possui estado de recurso (`DISPONÍVEL` / `ATUANDO`) e pode estar associado a um evento. A relação evento ↔ reboquista é mantida nos dois lados e deve permanecer consistente.

Pontos ainda não decididos incluem histórico permanente e política de persistência entre plantões.

---

## 6. Componentes que exigem cautela

A auditoria encontrou componentes existentes que não representam necessariamente o fluxo principal:

```text
NitNormalizar
modal antigo de despacho
/api/v1/despacho
/api/v1/normalizar
routes/config.py
referências a Railway
```

Regra:

> Não apagar, substituir ou “simplificar” um componente apenas porque parece legado. Primeiro prove que não possui consumidores.

O fluxo principal identificado inclui `NitCentral` e, na exportação, `routes/export.py`.

---

## 7. Questões ainda abertas

Não invente resposta para estes pontos:

```text
VALIDAR
├── NORMALIZADO pode retornar a PENDENTE?
├── deve existir executor automático para rendição agendada?
├── quem executa/agendará cron_export.py?
├── evento finalizado de Reboques deve ser removido ou arquivado?
├── deve existir histórico permanente de Reboques?
└── qual deve ser a persistência de Reboques entre plantões?
```

Comportamento observado não deve ser automaticamente transformado em regra definitiva.

---

## 8. Como trabalhar neste repositório

Antes de editar:

```text
1. encontre o domínio
2. encontre o fluxo
3. encontre o estado
4. encontre a persistência
5. encontre consumidores
6. verifique histórico
7. verifique documentação
8. apresente o plano
9. aguarde aprovação
10. implemente
11. valide
12. atualize a documentação
```

Não altere código com base apenas em nome de função, comentário antigo ou aparente duplicação.

Não invente dados operacionais ausentes. O sistema é assistido pelo operador.

### Governança de alterações

> Acesso técnico de escrita ao repositório não constitui autorização para modificá-lo.

Qualquer agente de IA, independentemente da ferramenta utilizada, deve seguir o protocolo estabelecido em `AI-INSTRUCTIONS.md`: analisar, apresentar o plano, obter aprovação explícita para o escopo proposto, alterar, validar e documentar.

---

## 9. Mapa da documentação

Leia somente o necessário para a tarefa:

```text
CONTEXT.MD
└── entrada rápida / estado geral

ARCHITECTURE.md
└── componentes, responsabilidades e integrações

DATA-MODEL.md
└── entidades, IDs, campos, relações e persistência

BUSINESS-RULES.md
└── contratos, regras confirmadas e pontos VALIDAR

WORKFLOW.md
└── fluxos operacionais ponta a ponta

DECISIONS.md
└── índice das decisões arquiteturais

docs/adr/
└── contexto, decisão e consequências de cada ADR

AI-INSTRUCTIONS.md
└── protocolo detalhado para agentes de IA

TODO.md
└── questões abertas, investigações e próximas ações
```

Os quatro documentos estruturais consolidados são:

```text
ARCHITECTURE.md
DATA-MODEL.md
BUSINESS-RULES.md
WORKFLOW.md
```

---

## 10. Regra documental

A documentação deve refletir o sistema validado, não obrigar o código a obedecer informação histórica desatualizada.

Sempre diferencie:

```text
"O código atualmente faz X."
```

de:

```text
"O sistema deve fazer X."
```

O primeiro é evidência de comportamento.

O segundo exige contrato ou decisão explícita.

---

## 11. Estado documental atual

```text
Auditoria dos ciclos 1–8       ✓
Matriz de evidências           ✓
ARCHITECTURE.md                ✓
DATA-MODEL.md                  ✓
BUSINESS-RULES.md              ✓
WORKFLOW.md                    ✓
CONTEXT.MD revisado            ✓

DECISIONS.md + ADRs            ← próxima etapa
AI-INSTRUCTIONS.md             pendente
TODO.md                        pendente
```

Até que uma decisão seja formalizada, questões marcadas `VALIDAR` permanecem abertas.

---

**Próximo passo documental:** construir `DECISIONS.md` e os ADRs a partir das decisões arquiteturais já consolidadas, sem transformar comportamentos meramente observados em decisões retroativas.
