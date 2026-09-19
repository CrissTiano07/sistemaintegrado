# TODO.md — NIT

> Registro controlado de questões abertas, investigações, pendências e melhorias já identificadas.
>
> Este arquivo **não é um depósito de ideias**. Um item só entra aqui quando existe evidência, dúvida concreta, risco conhecido ou trabalho necessário derivado do sistema auditado.

## 1. Como usar este arquivo

Estados:

```text
[VALIDAR]     intenção/regra ainda precisa ser confirmada
[INVESTIGAR] evidência técnica ainda insuficiente
[DECIDIR]    evidência existe, mas falta decisão consciente
[PENDENTE]   trabalho necessário já identificado
```

Ao resolver um item:

1. registrar a conclusão no documento correto;
2. criar ADR se houver decisão arquitetural significativa;
3. atualizar código/testes somente após aprovação quando necessário;
4. remover o item deste arquivo quando ele deixar de ser pendência.

---

# 2. Prioridade alta — decisões que bloqueiam mudanças seguras

## TODO-001 — Definir comportamento `NORMALIZADO → PENDENTE`

**Estado:** `[DECIDIR]`  
**Domínio:** Semáforo  
**Origem:** auditoria de continuidade/reprocessamento

### Evidência atual

A auditoria confirmou:

```text
ocorrência NORMALIZADA
→ não é candidata à herança
```

Não foi localizada promoção automática explícita:

```text
NORMALIZADO → PENDENTE
```

### Decisão necessária

Determinar se uma ocorrência já normalizada pode voltar a pendente quando um relatório posterior apresentar novamente necessidade ativa para o mesmo contexto.

### Não fazer antes da decisão

Não implementar reabertura automática por inferência.

### Após decisão

Atualizar, conforme aplicável:

```text
BUSINESS-RULES.md
WORKFLOW.md
DATA-MODEL.md
novo ADR, se arquiteturalmente relevante
testes de reprocessamento
```

---

## TODO-002 — Definir política de histórico permanente de Reboques

**Estado:** `[DECIDIR]`  
**Domínio:** Reboques

### Evidência atual

No fluxo auditado:

```text
finalizarEvento()
→ libera recursos
→ remove evento do conjunto ativo
```

Não foi encontrado histórico permanente do evento após a finalização.

### Decisão necessária

Escolher conscientemente entre:

```text
A. finalizado = removido do estado operacional sem histórico permanente

ou

B. finalizado = removido do ativo + persistido em histórico
```

### Impacto

Afeta:

- auditoria operacional;
- relatórios históricos;
- rastreabilidade;
- modelo de dados;
- política de retenção;
- possível exportação futura.

### Após decisão

Se houver histórico permanente, definir estrutura de dados antes da implementação.

---

## TODO-003 — Definir persistência de Reboques entre plantões

**Estado:** `[VALIDAR]`  
**Domínio:** Reboques

### Questão

Ainda precisa ser definido quais dados devem sobreviver à troca de plantão.

Verificar especialmente:

```text
reboquistas
eventos ativos
ordem
vínculos
configurações
dados finalizados
```

### Dependência

Relaciona-se diretamente ao TODO-002 e ao comportamento de `Limpar Plantão`.

---

## TODO-004 — Formalizar semântica e segurança de `Limpar Plantão`

**Estado:** `[DECIDIR]`  
**Domínio:** Reboques

### Evidência atual

A operação atua sobre:

```text
/reboques/plantao_ativo
```

e possui efeito destrutivo sobre o estado operacional do plantão.

### Definir

- quando a ação é permitida;
- quem pode executá-la;
- se deve haver confirmação reforçada;
- se dados precisam ser arquivados antes;
- relação com troca de plantão;
- relação com histórico permanente.

### Regra temporária

Não tratar `Limpar Plantão` como operação trivial de interface.

---

# 3. Exportação e infraestrutura

## TODO-005 — Definir executor de `cron_export.py`

**Estado:** `[DECIDIR]`  
**Domínio:** Backend / infraestrutura

### Evidência atual

`cron_export.py` existe.

Isso **não comprova** scheduler ativo.

Referências históricas a Railway não representam infraestrutura atual confirmada.

### Definir

```text
QUEM executa?
QUANDO executa?
EM QUAL infraestrutura?
COM QUAL frequência?
COM QUAL logging?
COM QUAL monitoramento?
COMO falhas são detectadas?
COMO retries são tratados?
```

### Requisito existente

Preservar possibilidade de validação:

```text
DRY_RUN=true
```

antes de escrita real no Google Sheets.

### Após decisão

Registrar infraestrutura real em:

```text
ARCHITECTURE.md
WORKFLOW.md
novo ADR, se necessário
```

---

## TODO-006 — Verificar ambiente real de execução da exportação

**Estado:** `[INVESTIGAR]`  
**Domínio:** Backend / infraestrutura

### Objetivo

Antes de documentar deploy atual, verificar evidência concreta de:

- serviço atualmente hospedado;
- configuração de ambiente;
- secrets necessários;
- mecanismo de execução;
- logs disponíveis;
- processo de deploy.

### Regra

Não reintroduzir Railway como infraestrutura atual apenas porque existem referências antigas no repositório.

---

# 4. Rendição agendada

## TODO-007 — Decidir executor para rendições agendadas

**Estado:** `[DECIDIR]`  
**Domínio:** Semáforo / Central

### Evidência atual

A auditoria confirmou:

```text
agendamento
→ persistido em /kanban/{eventoId}/agendamento
```

e:

```text
execução manual
→ histórico
→ atualização do snapshot
→ remoção do agendamento
```

Não foi encontrado executor automático.

### Decisão necessária

Determinar se o comportamento desejado é:

```text
A. execução sempre manual

ou

B. execução automática no horário programado

ou

C. lembrete automático + confirmação manual
```

### Atenção

Não adicionar scheduler apenas porque existe campo de horário.

---

# 5. Legado e compatibilidade

## TODO-008 — Confirmar consumidores de `/api/v1/despacho`

**Estado:** `[INVESTIGAR]`  
**Domínio:** Backend

### Evidência atual

O endpoint existe, mas o fluxo principal auditado utiliza `NitCentral` com persistência operacional no Firebase.

### Investigar

- chamadas no frontend atual;
- chamadas externas;
- scripts;
- integrações antigas;
- documentação;
- logs, se disponíveis.

### Resultado esperado

Classificar definitivamente como:

```text
ATUAL
COMPATIBILIDADE NECESSÁRIA
REMOVÍVEL
```

Não remover antes disso.

---

## TODO-009 — Confirmar consumidores de `/api/v1/normalizar`

**Estado:** `[INVESTIGAR]`  
**Domínio:** Backend

Aplicar o mesmo procedimento do TODO-008.

---

## TODO-010 — Definir destino de `NitNormalizar`

**Estado:** `[INVESTIGAR]`  
**Domínio:** Semáforo

### Evidência atual

`NitCentral.confirmarNormalizar()` representa o caminho principal identificado.

`NitNormalizar` permanece como implementação alternativa/legada.

### Investigar

- referências;
- listeners;
- inicialização;
- caminhos ainda acessíveis pela interface;
- dependências indiretas.

### Só depois decidir

```text
manter
isolar
deprecar
remover
```

---

## TODO-011 — Verificar modal antigo de despacho

**Estado:** `[INVESTIGAR]`  
**Domínio:** Semáforo

Confirmar se ainda existe consumidor operacional do fluxo antigo antes de qualquer remoção.

---

## TODO-012 — Verificar `routes/config.py`

**Estado:** `[INVESTIGAR]`  
**Domínio:** Backend

### Evidência atual

Foi identificado como aparentemente não registrado no fluxo principal auditado.

### Investigar

- importações;
- registro de router;
- consumidores externos;
- finalidade histórica;
- possibilidade real de remoção.

---

# 6. Modelo de dados ainda não totalmente consolidado

## TODO-013 — Consolidar schema de Recursos/Equipes

**Estado:** `[PENDENTE]`  
**Domínio:** Semáforo / recursos

### Evidência atual

`NitRecursos` mantém/aprende combinações operacionais de equipe, VT e tipo.

A auditoria não consolidou o schema completo a ponto de congelá-lo no `DATA-MODEL.md`.

### Trabalho necessário

Mapear:

```text
paths Firebase
campos
IDs/chaves
regras de atualização
autofill
consumidores
retenção
relação com despacho/apoio/rendição
```

Depois atualizar `DATA-MODEL.md`.

---

# 7. Validação documental

## TODO-014 — Fazer revisão cruzada final da documentação

**Estado:** `[PENDENTE]`  
**Domínio:** documentação

Agora que a sequência foi construída, executar uma revisão cruzada entre:

```text
CONTEXT.MD
ARCHITECTURE.md
DATA-MODEL.md
BUSINESS-RULES.md
WORKFLOW.md
DECISIONS.md
docs/adr/
AI-INSTRUCTIONS.md
TODO.md
```

### Objetivo

Detectar:

- contradições;
- duplicações desnecessárias;
- regra descrita como contrato em um arquivo e `VALIDAR` em outro;
- nomes divergentes;
- referências quebradas;
- informação histórica tratada como atual.

### Restrição

Essa revisão é documental. Não alterar comportamento do código para fazê-lo “combinar” com documentação incorreta.

---

## TODO-015 — Validar links e caminhos internos da documentação

**Estado:** `[PENDENTE]`

Após os arquivos serem colocados no repositório, verificar:

```text
links de DECISIONS.md → docs/adr/
nomes exatos dos arquivos
case-sensitive paths
referências cruzadas
```

---

# 8. Preparação para retomada segura do desenvolvimento

## TODO-016 — Estabelecer baseline de validação antes da próxima feature

**Estado:** `[PENDENTE]`  
**Domínio:** engenharia

Antes de iniciar novas funcionalidades, registrar quais verificações mínimas provam que o sistema atual continua funcionando.

Cobrir, conforme possível:

```text
SEMÁFORO
- processamento CEMOB
- identidade/reprocessamento
- despacho
- apoio
- rendição
- normalização
- continuidade/herança
- exportação DRY_RUN

REBOQUES
- carga de plantão
- criação de evento
- alocação
- transferência
- finalização individual
- finalização de evento
- relatório
```

### Objetivo

Criar uma referência de regressão para futuras mudanças assistidas por IA.

---

# 9. Itens explicitamente fora do TODO atual

Não adicionar sem evidência/decisão:

```text
reescrever frontend em framework novo
trocar Firebase
trocar FastAPI
substituir Google Sheets
unificar Semáforo e Reboques
criar microserviços
refatorar tudoAqui/nit.js apenas por tamanho
migrar infraestrutura apenas por preferência tecnológica
remover todo código legado
```

Esses itens podem futuramente virar propostas, mas não são pendências derivadas da auditoria atual.

---

# 10. Ordem recomendada para atacar as pendências

A ordem abaixo é de dependência técnica, não de urgência operacional:

```text
1. TODO-014 — revisão cruzada documental
2. TODO-015 — links/caminhos
3. TODO-016 — baseline de validação
4. TODO-001 — NORMALIZADO → PENDENTE
5. TODO-002/003/004 — política de Reboques
6. TODO-005/006 — exportação e infraestrutura
7. TODO-007 — rendição agendada
8. TODO-008..012 — legado/compatibilidade
9. TODO-013 — schema Recursos/Equipes
```

Questões de negócio (`DECIDIR`) não devem ser resolvidas apenas por análise técnica.

---

# 11. Critério para adicionar novo TODO

Antes de acrescentar item, responder:

```text
Existe evidência concreta?
Existe pergunta objetiva?
Existe impacto identificável?
Existe ação de validação/investigação possível?
```

Se a resposta for não, o item provavelmente ainda é apenas uma ideia.

Formato recomendado:

```text
## TODO-XXX — Título

Estado:
Domínio:
Origem:

Evidência atual:
...

Pergunta/ação:
...

Impacto:
...

Critério de conclusão:
...
```

---

# 12. Critério de conclusão da fase documental

A construção inicial da memória técnica está concluída quando os arquivos estiverem versionados no repositório e a revisão cruzada final tiver sido realizada.

```text
ARCHITECTURE.md      ✓
DATA-MODEL.md        ✓
BUSINESS-RULES.md    ✓
WORKFLOW.md          ✓
CONTEXT.MD           ✓
DECISIONS.md         ✓
docs/adr/            ✓
AI-INSTRUCTIONS.md   ✓
TODO.md              ✓

REVISÃO CRUZADA      ← pendente
BASELINE             ← pendente
```

A partir daí, o NIT pode voltar ao ciclo normal de desenvolvimento usando:

```text
CONTEXT.MD
      ↓
AI-INSTRUCTIONS.md
      ↓
documento específico
      ↓
código
      ↓
plano
      ↓
aprovação
      ↓
implementação
      ↓
validação
      ↓
documentação
```

---

**Status:** TODO inicial consolidado exclusivamente a partir das pendências e questões abertas identificadas na auditoria dos ciclos 1–8.

**Próximo marco:** revisão cruzada final da documentação antes de retomar alterações funcionais no código.
