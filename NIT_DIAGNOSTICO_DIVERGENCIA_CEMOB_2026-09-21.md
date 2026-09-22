# NIT --- Diagnóstico de Divergência no Processamento CEMOB

**Data:** 21/09/2026\
**Status:** investigação documentada --- sem alteração funcional em
produção\
**Escopo:** divergência ocasional entre relatório bruto CEMOB e
relatório processado pelo NIT.

## 1. Objetivo

Registrar fatos observados, evidências no código, evidências
operacionais, hipóteses ainda não comprovadas, riscos, decisões de
segurança, proposta de autodiagnóstico e próximos passos.

**Este documento não autoriza alteração de código nem autocorreção em
produção.**

## 2. Problema observado

Em alguns processamentos, a quantidade de ocorrências apresentada pelo
NIT diverge do relatório bruto do CEMOB.

Recuperação manual historicamente eficaz:

1.  comparar bruto e processado;
2.  localizar a ocorrência ausente;
3.  excluir manualmente o registro problemático do Firebase;
4.  reprocessar o mesmo bruto;
5.  a contagem volta a coincidir.

Isso é evidência importante, mas não prova sozinho a causa raiz.

## 3. Pipeline auditado

``` text
BRUTO → PARSER → EVENTOS EXTRAÍDOS → IDENTIDADE/eventoId
      → COMPARAÇÃO COM ESTADO → REPROCESSAMENTO
      → FIREBASE → KANBAN/DOM → CONTADORES/RELATÓRIO
```

Comparar apenas totais finais é insuficiente.

## 4. Identidade

O código utiliza conceitualmente:

``` text
eventoId = codigo + inicio
```

`inicio` é extraído diretamente do relatório. A documentação estabelece
`eventoId` como identidade forte e `codigo` apenas como chave auxiliar.
O mesmo código pode ter outra ocorrência em outro momento.

## 5. Achado no `_reprocessar()`

Quando o `eventoId` recebido não existe, o código procura um card não
normalizado com o mesmo código.

``` text
eventoId existe?
├─ SIM → atualiza ocorrência existente
└─ NÃO
   └─ mesmo código ainda pendente?
      ├─ SIM → cardHerdado / preserva eventoId anterior
      └─ NÃO → cria novo evento
```

No caminho de herança pendente, o novo `eventoId` pode não ser criado.

Mecanismo suspeito:

``` text
Estado: SCN 123 + início A → eventoId A → pendente
Novo:   SCN 123 + início B → eventoId B
                         ↓
eventoId B não existe
                         ↓
encontra A pelo mesmo código
                         ↓
herda A; B não é criado
```

Esse mecanismo é capaz de produzir N → N-1.

**Classificação:** hipótese causal forte e mecanismo demonstrável no
código; ainda não provado como causa dos incidentes históricos
observados.

## 6. Evidência operacional CEMOB

Foram analisados três relatórios sucessivos: 20/09/2026, primeiro
relatório de 21/09/2026 e relatório posterior de 21/09/2026.

As ocorrências 835, 836 e 512 permaneceram pendentes e conservaram
exatamente seus inícios originais, inclusive atravessando a mudança de
dia.

O 044 mudou de `INVESTIGANDO` para `FURTO` mantendo
`Início: 21/09/2026 06:10`.

142 e 379 conservaram o mesmo início ao serem normalizados.

663 apareceu somente no relatório posterior e já normalizado. Portanto,
não se pode pressupor que todo normalizado tenha aparecido antes como
pendente em relatório processado.

## 7. Teste conceitual

Usando somente `codigo + inicio`, sem depender do fallback por mesmo
código, a sequência reproduziu:

``` text
20/09             → 12 ocorrências
21/09 — primeiro  →  8 ocorrências
21/09 — seguinte  → 10 ocorrências
```

Foram preservadas as continuidades e transições observadas.

**Interpretação:** para essa sequência real, o fallback por código não
foi necessário. Isso não prova que possa ser removido com segurança em
todos os cenários.

## 8. Auditoria de impacto operacional

`eventoId` é também raiz do estado operacional:

``` text
kanban/{eventoId}
├── dados da ocorrência
├── equipe / viatura
├── sub / coluna
├── tsDespacho / tsFirstDispatch / tsChegada
├── equipeApoio / viaturaApoio
├── agendamento
├── colunaN
└── historico/
    ├── despacho
    ├── apoio
    └── rendição
```

Se uma continuidade real virar indevidamente novo `eventoId`, pode se
separar de equipe, VT, despacho, chegada, apoio, rendição, agendamento e
histórico.

Se uma reincidência real for tratada como continuidade, pode herdar
identidade operacional da ocorrência anterior.

Regra conceitual:

``` text
CONTINUIDADE REAL
→ preservar eventoId e estado operacional

REINCIDÊNCIA REAL
→ novo eventoId e novo estado operacional
→ não herdar automaticamente equipe/VT/apoio/rendição
```

## 9. Risco da exclusão manual

A exclusão manual continua útil como pista diagnóstica, mas não deve
virar autocorreção.

Como o histórico está sob `kanban/{eventoId}/historico`, excluir o nó
inteiro pode remover informações operacionais vinculadas à ocorrência.

**Decisão:** futura correção deve privilegiar reconciliação segura, não
destruição.

## 10. Estado do diagnóstico

### Confirmado

-   `eventoId` deriva de código + início;
-   continuidades observadas no CEMOB preservaram o início;
-   existe fallback por código em `_reprocessar()`;
-   ele pode preservar eventoId anterior mesmo recebendo eventoId
    diferente;
-   nesse caminho o novo evento pode deixar de ser criado;
-   `eventoId` ancora dados operacionais críticos;
-   comparar apenas totais não garante integridade.

### Ainda não provado no incidente real

> O fallback `mesmo código pendente → cardHerdado` causou as
> divergências historicamente observadas.

### Evidência desejada

-   relatório anterior;
-   bruto que gerou divergência;
-   processado divergente;
-   ocorrência problemática;
-   estado Firebase, se disponível;
-   registro removido para recuperar o processamento.

## 11. Estratégia para fechar a causa

``` text
RELATÓRIO ANTERIOR
→ ESTADO ANTERIOR
→ RELATÓRIO PROBLEMÁTICO
→ eventoId DO PARSER
→ DECISÃO DO _reprocessar()
→ FIREBASE/DOM
→ RELATÓRIO DIVERGENTE
```

Assinatura esperada:

``` text
novo eventoId entrou
→ sem correspondência exata
→ havia mesmo código pendente com outro eventoId
→ cardHerdado escolhido
→ novo eventoId não criado
→ ocorrência ausente
```

## 12. Proposta --- Diagnóstico de Integridade

Já há base suficiente para projetar uma camada observacional de
autodiagnóstico, sem corrigir ou excluir dados.

Comparar:

``` text
A — eventos extraídos do bruto
B — estado antes do processamento
C — estado depois do processamento
```

Não apenas:

``` text
total bruto == total processado
```

Mas conjuntos:

``` text
expectedEventIds
representedEventIds

missing    = expected - represented
unexpected = represented - expected
```

Isso detecta inclusive `27 == 27` com membros diferentes.

## 13. Caixa-preta de decisões

Registrar por ocorrência:

``` text
codigo
inicio
eventoId recebido
exactMatch
sameCodeCandidates
status dos candidatos
decisão tomada
eventoId de destino
resultado final
```

Exemplo:

``` text
codigo: 123
eventoId recebido: 123_210920260815
exactMatch: false
sameCodeCandidates: [123_200920261230]
decision: INHERIT_BY_CODE
targetEventoId: 123_200920261230
resultado: eventoId recebido não representado
```

## 14. Limites da primeira versão

``` text
DETECTAR   → SIM
COMPARAR   → SIM
EXPLICAR   → SIM
REGISTRAR  → SIM
ALERTAR    → SIM

ALTERAR    → NÃO
EXCLUIR    → NÃO
MIGRAR     → NÃO
RECRIAR    → NÃO
CORRIGIR   → NÃO
```

Exemplo ao operador:

``` text
⚠ Divergência detectada após processamento

CEMOB: 27
NIT:   26

1 ocorrência não está representada.

SCN: 123
Início: 21/09/2026 08:15

Foi encontrada ocorrência anterior do mesmo SCN
com identidade diferente.

[Ver diagnóstico]
```

## 15. Níveis conceituais

``` text
NÍVEL 0 — CONSISTENTE
NÍVEL 1 — DIVERGÊNCIA EXPLICÁVEL
NÍVEL 2 — CONFLITO OPERACIONAL
NÍVEL 3 — INCONCLUSIVO
```

Autocorreção futura deverá ser projetada e validada separadamente.

## 16. Decisões de segurança

1.  Não alterar ainda `_reprocessar()`.
2.  Não remover ainda `cardHerdado`.
3.  Não automatizar exclusões no Firebase.
4.  Não transferir estado operacional entre identidades sem regra
    comprovada.
5.  Aguardar incidente real para fechar a cadeia causal.
6.  É aceitável projetar instrumentação diagnóstica antes da correção.
7.  A instrumentação inicial deve ser observacional e não destrutiva.
8.  Alterações em produção continuam sujeitas à governança do projeto.

## 17. Próximo passo

Projetar o contrato técnico do **Diagnóstico de Integridade do
Processamento**:

``` text
desenho
→ auditoria de riscos
→ aprovação explícita
→ instrumentação observacional
→ captura de incidente real
→ confirmação/refutação da hipótese
→ proposta de correção
→ testes de regressão
→ eventual alteração de produção
```

## 18. Estado consolidado

``` text
PROBLEMA OBSERVADO             [CONFIRMADO]
MECANISMO SUSPEITO NO CÓDIGO   [CONFIRMADO]
COMPATIBILIDADE COM O SINTOMA  [FORTE]
SEMÂNTICA CEMOB NA AMOSTRA     [CONFIRMADA]
TESTE COM RELATÓRIOS REAIS     [APROVADO]
IMPACTO OPERACIONAL            [AUDITADO]
CAUSA DO INCIDENTE HISTÓRICO   [AINDA NÃO PROVADA]
ALTERAÇÃO DE PRODUÇÃO          [BLOQUEADA]
AUTODIAGNÓSTICO OBSERVACIONAL  [VIÁVEL / A PROJETAR]
```

## 19. Princípio orientador

> **Primeiro tornar a divergência observável e explicável. Depois provar
> a causa. Só então corrigir.**

Essa abordagem protege simultaneamente a integridade da contagem e o
estado operacional do NIT.
