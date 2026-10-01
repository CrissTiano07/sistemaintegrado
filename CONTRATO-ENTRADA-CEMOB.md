# CONTRATO-ENTRADA-CEMOB.md — NIT

> Contrato de entrada do relatório CEMOB para o motor de processamento do NIT.
>
> Este documento define **o que o NIT pode esperar da fonte**, **quais variações pode absorver**, **quais mudanças representam enriquecimento**, **quais exigem diagnóstico/reconciliação** e **como o sistema deve se comportar quando não puder decidir com segurança**.
>
> Este contrato não descreve todo o formato textual do relatório CEMOB nem pretende antecipar todas as anomalias possíveis.

---

# 1. Objetivo

Estabelecer uma fronteira segura entre:

```text
RELATÓRIO CEMOB
      ↓
PARSER
      ↓
INTERPRETAÇÃO
      ↓
GUARDIÃO
      ↓
ESTADO PROJETADO
      ↓
PERSISTÊNCIA
```

O objetivo não é exigir que a fonte seja perfeita.

O objetivo é garantir que variações, erros humanos ou retificações não provoquem silenciosamente:

```text
perda de ocorrência
duplicidade
nova identidade indevida
herança indevida
contagem falsa
reescrita de histórico
corrupção do estado operacional
```

---

# 2. Princípio fundamental

O relatório CEMOB é uma **fonte operacional externa sujeita a evolução e correção humana**.

Portanto:

```text
mudança no relatório
        ≠
automaticamente nova ocorrência
```

e:

```text
mudança no relatório
        ≠
automaticamente erro
```

Toda mudança deve ser interpretada conforme sua natureza.

As classes básicas deste contrato são:

```text
ESPERADO
TOLERADO
ESTABILIDADE
ENRIQUECIMENTO
CONTRADIÇÃO
RETIFICAÇÃO
INCONCLUSIVO
```

---

# 3. Identidade

A identidade forte utilizada pelo NIT é conceitualmente:

```text
eventoId = codigo + inicio
```

Onde:

```text
codigo
→ identifica o equipamento/SCN como chave auxiliar

inicio
→ participa da identidade temporal da ocorrência

eventoId
→ identidade forte da ocorrência no NIT
```

O mesmo `codigo` pode representar ocorrências diferentes em momentos diferentes.

Portanto:

```text
mesmo codigo
≠
necessariamente mesma ocorrência
```

Ao mesmo tempo:

```text
inicio diferente recebido posteriormente
≠
necessariamente nova ocorrência
```

Uma alteração de campo que participa da identidade pode representar retificação da fonte e deve ser avaliada antes da criação de nova identidade.

---

# 4. Entrada esperada

Uma ocorrência CEMOB deve fornecer informação suficiente para que o parser reconheça sua representação operacional.

Entre os elementos já utilizados pelo NIT estão:

```text
codigo
inicio
fim, quando informado
estado/natureza apresentada pela fonte
demais campos reconhecidos pelo parser atual
```

Este contrato não congela neste momento todo o layout textual do relatório.

A ausência ou alteração de um campo deve ser avaliada segundo as classes definidas nas seções seguintes.

---

# 5. Variação tolerada

Variações exclusivamente representacionais que não alteram o significado da ocorrência devem ser absorvidas pelo parser quando já fizerem parte das tolerâncias reconhecidas.

Exemplos conceituais:

```text
espaços adicionais
hífens
variações equivalentes de formatação
outras normalizações textuais já previstas
```

Fluxo:

```text
variação de representação
      ↓
parser normaliza
      ↓
mesmo significado
      ↓
processamento normal
```

Essas situações não precisam gerar Caso de Integridade quando forem absorvidas com segurança.

O contrato não autoriza criar novas tolerâncias por inferência durante a execução.

---

# 6. Estabilidade

Quando um campo estrutural reaparece com o mesmo valor:

```text
valor A
   ↓
valor A
```

temos **estabilidade**.

Exemplo:

```text
Relatório 1
SCN 835
Início: X

Relatório 2
SCN 835
Início: X
```

Nas sequências reais analisadas, ocorrências pendentes atravessaram relatórios sucessivos e mudança de dia preservando seus inícios originais.

Estabilidade reforça a continuidade da representação, mas não substitui as demais regras de identidade e estado.

---

# 7. Enriquecimento

Enriquecimento ocorre quando informação anteriormente ausente passa a ser fornecida posteriormente.

Forma geral:

```text
NULL → valor
```

Exemplo real estudado:

```text
SCN 685

primeira representação
Início: ausente

        ↓

representação posterior
Início: 13:37
```

A ausência inicial não deve obrigar o NIT a descartar a ocorrência operacional.

Fluxo conceitual aprovado:

```text
685 chega sem Início
      ↓
NIT não bloqueia
      ↓
cria/atualiza representação operacional provisória
      ↓
Guardião sinaliza ausência
      ↓
relatório posterior fornece 13:37
      ↓
identidade provisória é consolidada
      ↓
NÃO criar segunda ocorrência
```

Portanto:

> **Informação ausente que posteriormente aparece pode enriquecer a mesma ocorrência.**

O mecanismo físico da identidade provisória será definido durante a implementação.

---

# 8. Normalização recebida diretamente da fonte

Uma ocorrência pode aparecer no relatório já contendo `Fim`, mesmo que o NIT não tenha processado anteriormente uma versão pendente dela.

Caso observado:

```text
SCN 663
      ↓
não estava no relatório anterior processado
      ↓
aparece posteriormente já normalizado
```

Portanto:

```text
NORMALIZADO recebido
      ↓
NÃO exigir existência anterior como PENDENTE
```

O parser pode criar a ocorrência diretamente como normalizada quando a entrada possuir informação suficiente para isso.

---

# 9. Evolução de classificação sem mudança de identidade

Informações descritivas ou classificatórias podem evoluir enquanto a ocorrência permanece a mesma.

Caso observado:

```text
SCN 044

INVESTIGANDO
      ↓
FURTO

Início permaneceu:
21/09/2026 06:10
```

A mudança de classificação, isoladamente, não implica nova ocorrência.

O NIT deve distinguir:

```text
mudança de atributo
        ×
mudança de identidade
```

---

# 10. Normalização preservando início

Casos observados demonstraram:

```text
PENDENTE
Início: X

      ↓

NORMALIZADO
Início: X
Fim: Y
```

Os SCNs 142 e 379 preservaram o mesmo início ao serem normalizados.

Essa é uma transição esperada:

```text
PENDENTE
   ↓
NORMALIZADO
```

sem alteração da identidade da ocorrência.

---

# 11. Contradição

Contradição ocorre quando informação estrutural anteriormente conhecida reaparece com valor incompatível.

Forma geral:

```text
valor A → valor B
```

Exemplos conceituais:

```text
Início A → Início B
Fim A    → Fim B
```

Uma contradição não deve ser interpretada automaticamente como:

```text
nova ocorrência
```

nem automaticamente como:

```text
retificação
```

nem automaticamente como:

```text
continuidade
```

Fluxo:

```text
contradição
      ↓
Guardião
      ↓
preservar estado conhecido
      ↓
diagnosticar
      ↓
projetar consequências
      ↓
decisão quando necessária
```

---

# 12. Alteração de Início

`inicio` participa da identidade forte.

Por isso:

```text
Início A → Início B
```

é uma alteração estrutural relevante.

Entretanto, os casos estudados demonstraram que a fonte pode corrigir informação posteriormente.

Logo:

```text
mesmo codigo + inicio diferente
```

pode significar:

```text
REINCIDÊNCIA REAL
ou
RETIFICAÇÃO
ou
CONTRADIÇÃO AINDA INCONCLUSIVA
```

O NIT não deve decidir silenciosamente entre essas alternativas quando já houver ocorrência conhecida potencialmente relacionada.

---

# 13. Caso 468/790 — retificação tardia

Foi estudada a seguinte classe de comportamento:

```text
aberto: Início 08:20
        ↓
Início 08:20
        ↓
Início 08:20
        ↓
Início 06:10 + Fim 08:17
```

A representação final modifica retrospectivamente o início ao mesmo tempo em que informa o encerramento.

Esse comportamento é compatível com **retificação da mesma ocorrência**.

A solução aprovada conceitualmente é preservar:

```text
ocorrência operacional
eventoId estável
estado operacional existente
histórico
```

e tratar a nova informação como nova evidência CEMOB da mesma ocorrência após reconciliação.

Não deve ser criado silenciosamente um segundo evento apenas porque a representação final corrigiu o início.

---

# 14. Retificação por remoção de valor

Outra classe relevante é:

```text
valor → NULL
```

Exemplo:

```text
VERSÃO ANTERIOR

Início: 10:00
Fim:    10:40
Estado: NORMALIZADO

        ↓

NOVA VERSÃO

Início: 10:00
Fim:    ausente
```

A fonte pode ter informado `Fim` incorretamente e posteriormente removido esse valor.

Isso representa **possível retificação**.

O NIT não deve:

```text
criar automaticamente nova ocorrência
apagar automaticamente a ocorrência existente
reabrir silenciosamente
ignorar silenciosamente a contradição
```

Deve iniciar reconciliação.

---

# 15. NORMALIZADO → PENDENTE

Uma ocorrência normalizada pode retornar a pendente quando a nova evidência for confirmada como retificação da mesma ocorrência.

Fluxo:

```text
NORMALIZADO
      ↓
nova versão sem Fim
      ↓
Guardião detecta contradição
      ↓
preserva estado conhecido
      ↓
projeta consequências
      ↓
operador decide
```

Opções conceituais:

```text
[ VOLTAR PARA PENDENTE ]

[ MANTER NORMALIZADA ]

[ NÃO SEI — DEIXAR PARA REVISÃO ]
```

Quando confirmada a volta:

```text
mesmo eventoId
mesmo card
histórico preservado
estado da ocorrência → PENDENTE
```

Isso não constitui herança.

Também não reativa automaticamente equipe, VT, despacho, apoio ou rendição anteriores.

---

# 16. Consequência numérica da decisão

Quando uma anomalia exigir decisão humana, o NIT deve apresentar o resultado numérico projetado antes da aplicação.

O operador utiliza como referência os totais do relatório CEMOB.

Portanto, a interface deve responder:

```text
COMO O NIT FICARÁ SE EU ESCOLHER ISSO?
```

Exemplo:

```text
ANTES

Ocorrências:    24
Pendentes:       3
Normalizados:   21
```

```text
SE VOLTAR PARA PENDENTE

Ocorrências:    24 → 24
Pendentes:       3 → 4
Normalizados:   21 → 20
```

Essa informação auxilia a comparação consciente com a fonte.

---

# 17. Inconclusivo

O contrato reconhece explicitamente que nem toda entrada futura será previamente conhecida.

Quando o sistema não puder determinar com segurança se a situação representa:

```text
continuidade
reincidência
retificação
erro da fonte
ou outra classe
```

o estado é:

```text
INCONCLUSIVO
```

O comportamento obrigatório é:

```text
detectar
→ preservar
→ explicar
→ impedir alteração estrutural perigosa
→ solicitar revisão quando necessária
```

Não é permitido:

```text
não sei
→ escolher silenciosamente uma interpretação
```

---

# 18. Guardião

O Guardião atua entre interpretação e persistência nos casos protegidos.

```text
ENTRADA
   ↓
PARSER
   ↓
INTERPRETAÇÃO
   ↓
ESTADO PROJETADO
   ↓
GUARDIÃO
   ↓
   ├── consistente
   │      ↓
   │   processamento normal
   │
   └── problema
          ↓
       diagnóstico
          ↓
       consequência
          ↓
       decisão/revisão
          ↓
       persistência segura
```

O Guardião não substitui o parser.

Também não substitui o operador em decisões que dependem de informação externa ou interpretação não determinística.

---

# 19. Comparação de integridade

Comparar somente totais não é suficiente.

O diagnóstico deve ser capaz de comparar conceitualmente:

```text
A — eventos extraídos do bruto
B — estado anterior
C — estado projetado/posterior
```

Além de:

```text
total CEMOB
      ×
total NIT
```

deve ser possível verificar conjuntos:

```text
expectedEventIds
representedEventIds

missing    = expected - represented
unexpected = represented - expected
```

Isso permite detectar situações como:

```text
27 == 27
```

mas com ocorrências diferentes compondo cada conjunto.

---

# 20. Continuidade

Nas amostras analisadas, ocorrências pendentes preservaram seu início original entre relatórios sucessivos, inclusive atravessando mudança de dia.

Portanto, continuidade normal é compatível com:

```text
mesmo codigo
+
mesmo inicio
      ↓
mesmo eventoId
```

Quando necessário, `codigo` pode participar como chave auxiliar.

Ele não deve substituir a identidade forte.

---

# 21. Herança

Somente ocorrência não normalizada é candidata ao mecanismo de herança.

```text
PENDENTE
   ↓
pode participar da continuidade/herança
```

```text
NORMALIZADO
   ↓
NÃO participa da herança
```

Uma ocorrência normalizada que retorna a pendente por retificação utiliza **reconciliação**, não herança.

---

# 22. Reincidência

Uma reincidência real representa nova ocorrência.

```text
mesmo codigo
+
novo inicio legítimo
      ↓
novo eventoId
      ↓
novo estado operacional
```

Ela não deve herdar automaticamente:

```text
equipe
VT
despacho
chegada
apoio
rendição
agendamento
histórico operacional
```

O desafio do Guardião é impedir que uma retificação seja confundida com reincidência e que uma reincidência seja confundida com continuidade.

---

# 23. Ausência de campo crítico

A ausência de informação não deve ser tratada de maneira uniforme.

Pode representar:

```text
campo ainda não informado
retificação
erro da fonte
formato inesperado
```

Exemplo conhecido:

```text
Início ausente
→ pode admitir representação provisória
→ enriquecimento posterior
```

Exemplo diferente:

```text
Fim anteriormente existente → ausente
→ possível retificação
→ reconciliação
```

Portanto:

```text
NULL
```

não possui significado único fora do contexto temporal da ocorrência.

---

# 24. Estado anterior importa

A mesma entrada pode exigir tratamento diferente dependendo do estado já conhecido.

Exemplo:

```text
Fim ausente
```

Em ocorrência que nunca teve `Fim`:

```text
pode ser PENDENTE normal
```

Em ocorrência anteriormente normalizada com `Fim`:

```text
é contradição relevante
→ possível retificação
```

Logo, a interpretação correta depende de:

```text
ENTRADA ATUAL
+
ESTADO ANTERIOR
```

e não apenas da entrada isolada.

---

# 25. Registro de Integridade

Quando o Guardião encontrar situação relevante que exija decisão humana, deve existir Caso de Integridade.

Conceitualmente:

```text
CASO DE INTEGRIDADE
├── ocorrência relacionada
├── situação detectada
├── estado anterior relevante
├── nova evidência
├── diagnóstico
├── consequência projetada
├── decisão
├── resultado
└── eventual reversão
```

O schema físico ainda não está definido.

Variações triviais absorvidas pelo parser não precisam gerar caso.

---

# 26. Decisão humana

Decisão humana é recurso de reconciliação, não substituto para o motor.

O operador pode decidir o estado de um caso quando o Guardião identificar uma situação que não deve ser resolvida automaticamente.

Entretanto:

```text
operador decidiu X
```

não significa:

```text
todo caso semelhante futuro = X
```

Produção gera evidência.

Mudanças no motor exigem investigação, validação e testes.

---

# 27. Recuperabilidade

Uma decisão humana pode estar errada.

Nos casos protegidos, o NIT deve buscar permitir correção pelo próprio sistema, sem tornar a exclusão manual no Firebase o procedimento operacional normal.

Fluxo:

```text
decisão
   ↓
aplicação
   ↓
operador identifica erro
   ↓
NIT avalia fatos posteriores
```

Se não houver conflito:

```text
reversão segura
```

Se houver fatos posteriores relevantes:

```text
não restaurar snapshot cegamente
→ preservar fatos
→ nova reconciliação
```

A decisão anterior deve permanecer auditável.

---

# 28. Caixa-preta de decisão

Para diagnóstico, o NIT deve ser capaz de explicar como tratou uma ocorrência.

Informações conceitualmente relevantes:

```text
codigo
inicio recebido
eventoId recebido
correspondência exata
candidatos de mesmo codigo
estado dos candidatos
anomalias detectadas
decisão tomada
eventoId de destino
resultado projetado
resultado aplicado
```

Exemplo:

```text
codigo: 123
eventoId recebido: 123_210920260815

exactMatch: false

sameCodeCandidates:
- 123_200920261230

decision:
REVIEW_REQUIRED

reason:
mesmo codigo encontrado com identidade diferente

result:
nenhuma alteração estrutural aplicada automaticamente
```

---

# 29. Matriz resumida

| Entrada / mudança | Classe | Tratamento conceitual |
|---|---|---|
| valor → mesmo valor | ESTABILIDADE | seguir processamento |
| NULL → valor | ENRIQUECIMENTO | consolidar quando seguro |
| variação textual equivalente | TOLERADO | parser absorve |
| PENDENTE + Fim novo | EVOLUÇÃO ESPERADA | NORMALIZADO |
| classificação A → B com identidade preservada | EVOLUÇÃO | atualizar atributo |
| valor A → valor B estrutural | CONTRADIÇÃO | Guardião |
| valor → NULL estrutural | RETIFICAÇÃO POSSÍVEL | Guardião |
| Início ausente → Início informado | ENRIQUECIMENTO | mesma ocorrência quando reconciliável |
| NORMALIZADO → Fim ausente | RETIFICAÇÃO POSSÍVEL | decisão/reconciliação |
| mesmo código + novo início legítimo | REINCIDÊNCIA | novo eventoId |
| caso não classificável | INCONCLUSIVO | preservar e revisar |

A matriz não substitui análise temporal do estado anterior.

---

# 30. Invariantes da entrada

Independentemente da anomalia encontrada, o processamento protegido deve preservar:

### INV-CEMOB-01 — Não perder silenciosamente ocorrência esperada

```text
entrada representável
→ deve permanecer identificável no resultado
```

### INV-CEMOB-02 — Não duplicar silenciosamente

Uma retificação não deve produzir segundo card da mesma ocorrência.

### INV-CEMOB-03 — Não colapsar reincidência real

Uma nova ocorrência legítima não deve herdar silenciosamente identidade operacional anterior.

### INV-CEMOB-04 — Não reescrever histórico

Correção da fonte não apaga fatos operacionais registrados.

### INV-CEMOB-05 — Não transferir estado operacional sem regra

Equipe, VT, despacho, apoio, rendição e histórico não devem migrar automaticamente entre identidades distintas.

### INV-CEMOB-06 — Não decidir o desconhecido silenciosamente

Caso inconclusivo deve permanecer observável.

### INV-CEMOB-07 — Contagem não basta

Integridade deve considerar membros/conjuntos, não somente totais.

### INV-CEMOB-08 — Decisão humana deve mostrar consequência

O operador deve conhecer o efeito projetado antes de confirmar uma reconciliação relevante.

### INV-CEMOB-09 — Decisão humana relevante deve ser auditável

Detecção, decisão, resultado e eventual reversão devem permanecer rastreáveis.

---

# 31. Critério para a entrega atual

Este contrato não exige prever todos os erros humanos possíveis.

A entrega é considerada segura quando uma anomalia não conhecida não consegue produzir silenciosamente:

```text
duplicidade
perda
identidade indevida
herança indevida
contagem falsa não explicada
apagamento de histórico
corrupção estrutural
```

Os pilares são:

```text
INTEGRIDADE
OBSERVABILIDADE
RECUPERABILIDADE
FALHA SEGURA
INTUITIVIDADE
```

---

# 32. Fora do escopo desta versão

Não é requisito desta entrega:

```text
catalogar todo erro humano possível
autocorrigir toda contradição
usar IA para decidir ocorrências
aprender automaticamente com decisões humanas
criar motor probabilístico
eliminar completamente revisão humana
redesenhar o parser inteiro
remover cardHerdado sem investigação específica
migrar banco de dados
```

Esses temas podem ser avaliados posteriormente.

---

# 33. Relação com os testes

Este contrato deve ser convertido em casos de teste.

No mínimo:

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
DECISÃO HUMANA
CANCELAMENTO
REVERSÃO SEGURA
REVERSÃO COM FATOS POSTERIORES
CASO INCONCLUSIVO
```

Cada teste deve verificar não apenas contagem, mas também:

```text
eventoId
quantidade de cards
estado
histórico
estado operacional
resultado projetado
persistência
```

---

# 34. Relação com o diagnóstico de divergência

O documento `NIT_DIAGNOSTICO_DIVERGENCIA_CEMOB_...` permanece como registro histórico da investigação que originou esta frente.

Ele não deve ser utilizado isoladamente como especificação funcional atual.

A precedência para implementação passa a ser:

```text
BUSINESS-RULES.md
      +
WORKFLOW.md
      +
DATA-MODEL.md
      +
CONTRATO-ENTRADA-CEMOB.md
      ↓
TESTES
      ↓
IMPLEMENTAÇÃO
```

Hipóteses ainda não comprovadas no diagnóstico original permanecem hipóteses, salvo quando posteriormente validadas e incorporadas aos contratos.

---

# 35. Regra para evolução deste contrato

Um caso novo encontrado em produção deve seguir:

```text
CASO REAL
   ↓
registrar evidência
   ↓
investigar
   ↓
classificar
   ↓
validar comportamento correto
   ↓
criar teste
   ↓
alterar contrato, se necessário
   ↓
alterar motor
```

Nunca:

```text
caso novo
→ improvisar regra em produção
```

---

# 36. Documentos relacionados

- `BUSINESS-RULES.md` — contratos funcionais.
- `WORKFLOW.md` — fluxos operacionais.
- `DATA-MODEL.md` — identidade, estado, persistência e relações.
- `NIT_DIAGNOSTICO_DIVERGENCIA_CEMOB_...` — investigação histórica.
- `TODO.md` — linha de execução da entrega.
- `AI-INSTRUCTIONS.md` — governança para agentes de IA.
- `DECISIONS.md` / ADRs — decisões arquiteturais.

---

**Status:** contrato inicial consolidado a partir das evidências e decisões validadas na investigação CEMOB.

**Escopo:** congelado para a entrega atual.

**Próximo passo:** consolidar o `TODO.md` e transformar este contrato em testes de aceitação antes da alteração funcional do motor.
