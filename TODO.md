# ATUALIZAÇÃO DO TODO — ENTREGA DO NOVO TURNO

## Objetivo operacional atual

Liberar o NIT para operação no novo turno com proteção suficiente para que uma anomalia conhecida ou desconhecida não produza silenciosamente:

```text
perda de ocorrência
duplicidade
identidade indevida
herança indevida
contagem falsa não explicada
apagamento de histórico
corrupção estrutural
```

Não é requisito eliminar todos os erros possíveis antes da liberação.

---

# BLOQUEANTES DA ENTREGA

## TODO-020 — Transformar o Contrato de Entrada CEMOB em testes de aceitação

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / testes  
**Prioridade:** BLOQUEANTE

### Origem

Contrato de Entrada CEMOB consolidado após investigação com relatórios reais.

### Trabalho necessário

Converter as classes já aprovadas em cenários reproduzíveis:

```text
ESTABILIDADE
ENRIQUECIMENTO
NORMALIZAÇÃO
NORMALIZADO DIRETO
MUDANÇA DE CLASSIFICAÇÃO
INÍCIO AUSENTE → INFORMADO
INÍCIO A → INÍCIO B
FIM → AUSENTE
NORMALIZADO → PENDENTE
REINCIDÊNCIA REAL
REPROCESSAMENTO DO MESMO BRUTO
CASO INCONCLUSIVO
```

Incluir os casos reais já estudados, quando aplicáveis:

```text
685
468/790
1430
normalizado direto
continuidade entre relatórios/dias
```

### Cada teste deve verificar

```text
quantidade esperada
eventoId
quantidade de cards
estado
histórico
estado operacional
resultado projetado
persistência
```

### Critério de conclusão

Existe suíte suficiente para demonstrar os contratos necessários à liberação do novo turno.

---

## TODO-021 — Implementar Guardião mínimo de integridade

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / processamento  
**Prioridade:** BLOQUEANTE

### Objetivo

Inserir proteção entre interpretação e persistência:

```text
PARSER
  ↓
INTERPRETAÇÃO
  ↓
ESTADO PROJETADO
  ↓
GUARDIÃO
  ↓
PERSISTÊNCIA
```

### Primeira versão deve

```text
DETECTAR
COMPARAR
EXPLICAR
PROJETAR CONSEQUÊNCIA
BLOQUEAR ALTERAÇÃO PERIGOSA
ENCAMINHAR RECONCILIAÇÃO
```

Não precisa resolver automaticamente todas as anomalias.

### Invariantes mínimos

O Guardião não pode permitir silenciosamente:

```text
N → N-1 indevido
N → N+1 indevido
duplicidade
colapso de reincidência
nova identidade por retificação
transferência indevida de estado operacional
```

### Critério de conclusão

Os testes bloqueantes do Contrato de Entrada passam e casos desconhecidos falham de maneira segura e observável.

---

## TODO-022 — Implementar prévia antes da persistência

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / interface / integridade  
**Prioridade:** BLOQUEANTE

### Objetivo

Antes da confirmação do processamento, mostrar ao operador como ficará o resultado.

A referência visual deve acompanhar a forma como o operador já confere o relatório CEMOB:

```text
Ocorrências de Apagados/Piscantes
Pendentes
Furtos
Outros motivos
Investigando
Normalizados
```

Exemplo:

```text
CEMOB

Ocorrências:    24
Pendentes:       4
Normalizados:   20

NIT APÓS PROCESSAR

Ocorrências:    24
Pendentes:       4
Normalizados:   20
```

Quando houver divergência, responder imediatamente:

```text
O QUE MUDOU?
POR QUÊ?
O QUE O NIT VAI FAZER?
COMO OS NÚMEROS FICARÃO?
```

### Critério de conclusão

O operador consegue comparar CEMOB × NIT antes da persistência e compreender uma divergência sem precisar investigar o Firebase.

---

## TODO-023 — Implementar reconciliação mínima

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / integridade  
**Prioridade:** BLOQUEANTE

### Casos mínimos

Suportar as decisões já aprovadas para:

```text
retificação de Início
enriquecimento de Início ausente
Fim removido
NORMALIZADO → PENDENTE
caso inconclusivo
```

### Regra

Reconciliação deve preservar:

```text
eventoId quando confirmada mesma ocorrência
card
histórico operacional
fatos operacionais existentes
```

e não criar silenciosamente segunda ocorrência.

### Decisão humana

Quando necessária, mostrar consequência antes da aplicação.

Exemplo:

```text
SE VOLTAR PARA PENDENTE

Ocorrências:    24 → 24
Pendentes:       3 → 4
Normalizados:   21 → 20
```

Deve existir opção de não decidir imediatamente:

```text
[ NÃO SEI — DEIXAR PARA REVISÃO ]
```

---

## TODO-024 — Recuperação mínima de decisão incorreta

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / integridade  
**Prioridade:** BLOQUEANTE PARA AUTONOMIA OPERACIONAL

### Objetivo

Reduzir a necessidade de:

```text
abrir Firebase
→ localizar nó
→ excluir manualmente
→ reprocessar
```

### Comportamento

Se a decisão puder ser revertida sem destruir fatos posteriores:

```text
DESFAZER
→ mostrar consequência
→ confirmar
→ corrigir
```

Se existirem fatos posteriores:

```text
NÃO restaurar snapshot cegamente
→ explicar
→ preservar fatos
→ nova reconciliação
```

### Critério de conclusão

Erro recuperável comum não exige desenvolvedor nem edição manual do Firebase.

---

## TODO-025 — Registro mínimo de Integridade

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / auditoria  
**Prioridade:** NECESSÁRIO, IMPLEMENTAÇÃO MÍNIMA

### Registrar

```text
detecção
ocorrência relacionada
problema encontrado
decisão
resultado
eventual reversão
```

### Restrição

Não transformar esta entrega em projeto completo de observabilidade.

Implementar apenas o necessário para:

```text
auditoria
diagnóstico
recuperação
evolução posterior
```

---

## TODO-026 — Validar processamento completo Bruto × NIT

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / integridade  
**Origem:** evolução do TODO-018  
**Prioridade:** BLOQUEANTE

### Verificar

Não apenas:

```text
totalBruto == totalNIT
```

mas:

```text
expectedEventIds
representedEventIds

missing
unexpected
```

Cobrir explicitamente:

```text
Bruto N → NIT N
Bruto N → NIT N-1
Bruto N → NIT N+1
N == N com membros diferentes
desaparecimento
reaparecimento
herança legítima
normalização
```

### Critério de conclusão

Nenhuma divergência estrutural conhecida passa silenciosamente.

---

# PROTEÇÃO DA PUBLICAÇÃO

## TODO-017 — Implantar publicação segura e rollback operacional

**Estado:** [PENDENTE]  
**Prioridade:** BLOQUEANTE ANTES DA PUBLICAÇÃO

Mantém-se o conteúdo já aprovado.

Antes da versão destinada ao novo turno:

```text
validar sintaxe
→ teste mínimo
→ publicar
→ smoke test
→ rollback disponível
```

Funções essenciais para smoke test:

```text
carregamento
login
processamento
Kanban
relatório
```

Uma falha de publicação não pode transformar um problema de software em paralisação operacional.

---

# VALIDAÇÃO PARA LIBERAÇÃO

## TODO-027 — Executar modo sombra

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / validação  
**Prioridade:** BLOQUEANTE

Executar o novo fluxo com relatórios reais sem permitir inicialmente que decisões novas alterem o estado operacional real.

Comparar:

```text
resultado atual
×
resultado projetado pelo Guardião
```

Registrar divergências.

---

## TODO-028 — Teste controlado no turno atual

**Estado:** [PENDENTE]  
**Domínio:** operação  
**Prioridade:** BLOQUEANTE

Após aprovação dos testes e modo sombra:

```text
produção controlada
→ seu turno
→ relatórios reais
→ observar
→ corrigir somente bloqueantes
```

Não transformar toda nova observação em requisito de liberação.

---

## TODO-029 — Liberar novo turno

**Estado:** [PENDENTE]  
**Domínio:** operação

### Critério de liberação

Liberar quando houver evidência suficiente de que:

```text
anomalia conhecida
→ tratamento correto

anomalia desconhecida
→ falha segura

divergência
→ visível e explicada

decisão humana
→ consequência visível

erro humano recuperável
→ correção operacional disponível

falha de publicação
→ rollback disponível
```

Não exigir ausência absoluta de bugs.

---

# NÃO BLOQUEANTES DA ENTREGA ATUAL

Permanecem registrados, mas não entram no caminho crítico:

```text
TODO-002 — histórico permanente de Reboques
TODO-003 — persistência de Reboques entre plantões
TODO-004 — Limpar Plantão
TODO-005 — executor cron_export.py
TODO-006 — ambiente da exportação
TODO-007 — rendição agendada
TODO-008 — /api/v1/despacho
TODO-009 — /api/v1/normalizar
TODO-010 — NitNormalizar
TODO-011 — modal antigo
TODO-012 — routes/config.py
TODO-013 — Recursos/Equipes
TODO-019 — refinamento textual do alerta
```

Eles não são descartados.

Apenas não podem atrasar a liberação do novo turno sem nova evidência de impacto bloqueante.

---

# ITENS RESOLVIDOS

## TODO-001 — NORMALIZADO → PENDENTE

**RESOLVIDO. REMOVER DO TODO ativo.**

Decisão consolidada:

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

Não constitui herança automática.

Documentado em:

```text
BUSINESS-RULES.md
WORKFLOW.md
DATA-MODEL.md
CONTRATO-ENTRADA-CEMOB.md
```

---

# DOCUMENTAÇÃO

## TODO-014 / TODO-015 — revisão cruzada e referências

Continuam necessários, mas deixam de bloquear o início dos testes.

Executar revisão final antes da publicação destinada ao novo turno.

O `CONTRATO-ENTRADA-CEMOB.md` passa a integrar a revisão.

---

# ORDEM OPERACIONAL ATUAL

```text
1. CONTRATO DE ENTRADA                     ✓
2. TESTES DE ACEITAÇÃO                     TODO-020
3. GUARDIÃO MÍNIMO                         TODO-021
4. PRÉVIA                                  TODO-022
5. RECONCILIAÇÃO                           TODO-023
6. RECUPERAÇÃO MÍNIMA                      TODO-024
7. REGISTRO DE INTEGRIDADE                 TODO-025
8. BRUTO × NIT                             TODO-026
9. PUBLICAÇÃO SEGURA / ROLLBACK             TODO-017
10. MODO SOMBRA                            TODO-027
11. TESTE NO TURNO ATUAL                   TODO-028
12. REVISÃO DOCUMENTAL FINAL               TODO-014/015
13. LIBERAÇÃO DO NOVO TURNO                TODO-029
```

Essa é a linha de entrega.

Qualquer nova necessidade encontrada durante esse percurso deve responder:

> **Ela impede integridade, recuperabilidade, falha segura ou continuidade operacional?**

Se não impedir, registrar para depois e continuar a entrega.

---

# CRITÉRIO DE CONTROLE DE ESCOPO

Durante esta fase:

```text
NOVO PROBLEMA
     ↓
é bloqueante para a operação segura?
     ├── SIM → tratar
     └── NÃO → registrar e continuar
```

A meta não é produzir o NIT definitivo.

A meta é produzir uma versão suficientemente segura, observável, recuperável e intuitiva para operar no novo turno.
