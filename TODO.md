# TODO.md — NIT

Registro controlado de questões abertas, investigações, pendências e melhorias já identificadas.

> Este arquivo não é um depósito de ideias. Um item só entra aqui quando existe evidência, dúvida concreta, risco conhecido ou trabalho necessário derivado do sistema auditado.

---

# 1. Como usar este arquivo

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

## Regra adicional da entrega atual

Durante a preparação para o novo turno:

```text
NOVO PROBLEMA
     ↓
é bloqueante para operação segura?
     ├── SIM → tratar na entrega
     └── NÃO → registrar e continuar
```

A meta não é produzir o NIT definitivo.

A meta é produzir uma versão suficientemente:

```text
ÍNTEGRA
OBSERVÁVEL
RECUPERÁVEL
SEGURA EM FALHA
INTUITIVA
```

para operar no novo turno.

---

# 2. Objetivo operacional atual

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

A margem de segurança adotada é:

```text
anomalia conhecida
→ comportamento correto testado

anomalia desconhecida
→ falha segura e observável
```

---

# 3. Bloqueantes da entrega — Integridade CEMOB

## TODO-020 — Transformar o Contrato de Entrada CEMOB em testes de aceitação

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / testes  
**Prioridade:** BLOQUEANTE

### Origem

Contrato de Entrada CEMOB consolidado após investigação com relatórios reais.

### Trabalho necessário

Converter as classes aprovadas em cenários reproduzíveis:

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
REVERSÃO
CASO INCONCLUSIVO
```

Incluir os casos reais já estudados, quando aplicáveis:

```text
685
468/790
1430
normalizado direto
continuidade entre relatórios
continuidade entre dias
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

Não validar apenas:

```text
totalBruto == totalNIT
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
apagamento de histórico
```

### Caso desconhecido

```text
não reconheceu
      ↓
NÃO improvisar
      ↓
preservar
      ↓
explicar
      ↓
revisão
```

### Critério de conclusão

Os testes bloqueantes do Contrato de Entrada passam e casos desconhecidos falham de maneira segura e observável.

---

## TODO-022 — Implementar prévia antes da persistência

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / interface / integridade  
**Prioridade:** BLOQUEANTE

### Objetivo

Antes da confirmação do processamento protegido, mostrar ao operador como ficará o resultado.

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

Quando houver divergência, a interface deve responder imediatamente:

```text
O QUE MUDOU?

POR QUE O NIT ESTÁ ALERTANDO?

O QUE O NIT VAI FAZER?

COMO OS NÚMEROS FICARÃO?
```

### Princípio de UX

O operador já possui o hábito:

```text
olhar CEMOB
→ olhar NIT
→ comparar
```

O NIT deve aproveitar esse comportamento, não criar outro modelo mental desnecessário.

### Critério de conclusão

O operador consegue comparar CEMOB × NIT antes da persistência e compreender uma divergência sem precisar investigar o Firebase.

---

## TODO-023 — Implementar reconciliação mínima

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / integridade  
**Prioridade:** BLOQUEANTE

### Casos mínimos

Suportar as decisões aprovadas para:

```text
retificação de Início
enriquecimento de Início ausente
Fim removido
NORMALIZADO → PENDENTE
caso inconclusivo
```

### Regra

Reconciliação deve preservar, quando confirmada a mesma ocorrência:

```text
eventoId
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

Opções conceituais:

```text
[ VOLTAR PARA PENDENTE ]

[ MANTER NORMALIZADA ]

[ NÃO SEI — DEIXAR PARA REVISÃO ]
```

### Critério de conclusão

Uma contradição relevante pode ser resolvida sem criar nova identidade indevida, perder histórico ou exigir edição manual do Firebase.

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

### Reversão segura

Se nenhuma informação posterior relevante seria perdida:

```text
decisão aplicada
      ↓
operador identifica erro
      ↓
DESFAZER
      ↓
mostrar consequência
      ↓
confirmar
      ↓
corrigir
```

### Reversão não segura

Se houver fatos posteriores:

```text
despacho
chegada
apoio
rendição
outro fato operacional relevante
```

então:

```text
NÃO restaurar snapshot cegamente
      ↓
preservar fatos posteriores
      ↓
explicar
      ↓
nova reconciliação
```

### Critério de conclusão

Erro recuperável comum não exige desenvolvedor nem edição manual do Firebase.

---

## TODO-025 — Registro mínimo de Integridade

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / auditoria  
**Prioridade:** NECESSÁRIO — IMPLEMENTAÇÃO MÍNIMA

### Objetivo

Registrar os casos em que o Guardião detectou situação relevante.

### Registrar conceitualmente

```text
detecção
ocorrência relacionada
problema encontrado
estado anterior relevante
nova evidência
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

Variações triviais absorvidas normalmente pelo parser não precisam gerar Caso de Integridade.

---

## TODO-026 — Validar processamento completo Bruto × NIT

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / integridade  
**Origem:** evolução do TODO-018  
**Prioridade:** BLOQUEANTE

### Objetivo

Comparar não apenas totais, mas também composição.

Verificar:

```text
expectedEventIds
representedEventIds

missing    = expected - represented
unexpected = represented - expected
```

Cobrir explicitamente:

```text
Bruto N → NIT N

Bruto N → NIT N-1

Bruto N → NIT N+1

N == N
mas membros diferentes

desaparecimento

reaparecimento

herança legítima

normalização
```

### Caso histórico relacionado

A ocorrência 1430 foi retirada de um relatório bruto completo sem ser normalizada.

Resultado observado:

```text
Bruto:   12
Kanban:  13
Monitor: 13
```

Quando reapareceu com a mesma identidade, não houve duplicação.

### Critério de conclusão

Nenhuma divergência estrutural conhecida passa silenciosamente.

---

# 4. Publicação segura e continuidade operacional

## TODO-017 — Implantar publicação segura e rollback operacional

**Estado:** [PENDENTE]  
**Domínio:** engenharia / publicação  
**Prioridade:** BLOQUEANTE ANTES DA PUBLICAÇÃO

### Origem

Incidente de sintaxe em `nit.js` que impediu a inicialização do NIT e o login.

### Decisão aprovada

Publicação segura passa a ser padrão permanente de manutenção.

Antes da próxima publicação destinada ao novo turno, estabelecer proteção mínima que impeça uma atualização defeituosa de interromper a operação sem recuperação acessível.

### Trabalho necessário

Mapear o processo real de:

```text
publicação
carregamento de arquivos
cache
dependências do Firebase
```

Validar automaticamente a sintaxe dos arquivos JavaScript antes de publicar.

Falha:

```text
→ bloqueia publicação
```

Definir e executar teste mínimo em ambiente separado:

```text
carregamento
login
Kanban
processamento
geração de relatório
```

sem modificar dados operacionais reais.

Identificar e preservar a última versão estável.

Ensaiar rollback e confirmar que o operador consegue voltar a trabalhar.

Verificar compatibilidade de dados entre:

```text
versão nova
×
versão de rollback
```

### Contingência

Após a proteção mínima, avaliar acesso de contingência independente de eventual falha de `nit.js`.

Isso não deve atrasar a entrega mínima se rollback confiável já garantir continuidade suficiente.

### Critério de conclusão

Uma atualização com erro de sintaxe não chega à produção.

Um rollback ensaiado restaura as funções essenciais sem intervenção do operador no código ou no Firebase.

### Restrição

Não alterar o motor semafórico para implementar o processo de publicação.

---

# 5. Validação para liberação

## TODO-027 — Executar modo sombra

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / validação  
**Prioridade:** BLOQUEANTE

### Objetivo

Executar o novo fluxo com relatórios reais antes de entregar plenamente suas novas decisões à operação.

Comparar:

```text
resultado atual
      ×
resultado projetado pelo Guardião
```

Registrar divergências.

### Objetivo do modo sombra

Responder:

```text
o Guardião está detectando o que deveria?

está produzindo falsos positivos?

está interpretando corretamente os casos normais?

há alguma interferência operacional inesperada?
```

### Critério de conclusão

O comportamento projetado demonstra estabilidade suficiente para teste operacional controlado.

---

## TODO-028 — Teste controlado no turno atual

**Estado:** [PENDENTE]  
**Domínio:** operação  
**Prioridade:** BLOQUEANTE

### Pré-condição

```text
testes de aceitação
      ↓
Guardião
      ↓
modo sombra
      ↓
aprovados em nível suficiente
```

### Execução

```text
produção controlada
      ↓
turno atual
      ↓
relatórios reais
      ↓
observar
      ↓
corrigir somente bloqueantes
```

### Regra

Não transformar toda nova observação em requisito de liberação.

Pergunta:

```text
isso ameaça:

integridade?
recuperabilidade?
falha segura?
continuidade operacional?
```

Se não:

```text
registrar
→ continuar
```

---

## TODO-029 — Liberar novo turno

**Estado:** [PENDENTE]  
**Domínio:** operação  
**Prioridade:** MARCO DA ENTREGA

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

### Princípio

O critério não é:

```text
"Nunca acontecerá algo inesperado."
```

É:

```text
"Algo inesperado não consegue destruir silenciosamente
a integridade da operação."
```

---

# 6. Reboques — pendências não bloqueantes da entrega atual

## TODO-002 — Definir política de histórico permanente de Reboques

**Estado:** [DECIDIR]  
**Domínio:** Reboques  
**Prioridade atual:** NÃO BLOQUEANTE

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
A.
finalizado
→ removido do estado operacional
→ sem histórico permanente
```

ou:

```text
B.
finalizado
→ removido do ativo
→ persistido em histórico
```

### Impacto

Afeta:

```text
auditoria operacional
relatórios históricos
rastreabilidade
modelo de dados
política de retenção
possível exportação futura
```

### Após decisão

Se houver histórico permanente, definir estrutura de dados antes da implementação.

---

## TODO-003 — Definir persistência de Reboques entre plantões

**Estado:** [VALIDAR]  
**Domínio:** Reboques  
**Prioridade atual:** NÃO BLOQUEANTE

### Questão

Definir quais dados devem sobreviver à troca de plantão.

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

Relaciona-se diretamente ao TODO-002 e ao comportamento de Limpar Plantão.

---

## TODO-004 — Formalizar semântica e segurança de Limpar Plantão

**Estado:** [DECIDIR]  
**Domínio:** Reboques  
**Prioridade atual:** NÃO BLOQUEANTE

### Evidência atual

A operação atua sobre:

```text
/reboques/plantao_ativo
```

e possui efeito destrutivo sobre o estado operacional do plantão.

### Definir

```text
quando a ação é permitida
quem pode executá-la
se deve haver confirmação reforçada
se dados precisam ser arquivados antes
relação com troca de plantão
relação com histórico permanente
```

### Regra temporária

Não tratar Limpar Plantão como operação trivial de interface.

---

# 7. Exportação e infraestrutura

## TODO-005 — Definir executor de cron_export.py

**Estado:** [DECIDIR]  
**Domínio:** Backend / infraestrutura  
**Prioridade atual:** NÃO BLOQUEANTE

### Evidência atual

`cron_export.py` existe.

Isso não comprova scheduler ativo.

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
ADR, se necessário
```

---

## TODO-006 — Verificar ambiente real de execução da exportação

**Estado:** [INVESTIGAR]  
**Domínio:** Backend / infraestrutura  
**Prioridade atual:** NÃO BLOQUEANTE

### Objetivo

Antes de documentar deploy atual, verificar evidência concreta de:

```text
serviço atualmente hospedado
configuração de ambiente
secrets necessários
mecanismo de execução
logs disponíveis
processo de deploy
```

### Regra

Não reintroduzir Railway como infraestrutura atual apenas porque existem referências antigas no repositório.

---

# 8. Rendição agendada

## TODO-007 — Decidir executor para rendições agendadas

**Estado:** [DECIDIR]  
**Domínio:** Semáforo / Central  
**Prioridade atual:** NÃO BLOQUEANTE

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

B. execução automática no horário programado

C. lembrete automático + confirmação manual
```

### Atenção

Não adicionar scheduler apenas porque existe campo de horário.

---

# 9. Legado e compatibilidade

## TODO-008 — Confirmar consumidores de /api/v1/despacho

**Estado:** [INVESTIGAR]  
**Domínio:** Backend  
**Prioridade atual:** NÃO BLOQUEANTE

### Evidência atual

O endpoint existe, mas o fluxo principal auditado utiliza `NitCentral` com persistência operacional no Firebase.

### Investigar

```text
chamadas no frontend atual
chamadas externas
scripts
integrações antigas
documentação
logs, se disponíveis
```

### Resultado esperado

Classificar definitivamente como:

```text
ATUAL
COMPATIBILIDADE NECESSÁRIA
REMOVÍVEL
```

Não remover antes disso.

---

## TODO-009 — Confirmar consumidores de /api/v1/normalizar

**Estado:** [INVESTIGAR]  
**Domínio:** Backend  
**Prioridade atual:** NÃO BLOQUEANTE

Aplicar o mesmo procedimento do TODO-008.

---

## TODO-010 — Definir destino de NitNormalizar

**Estado:** [INVESTIGAR]  
**Domínio:** Semáforo  
**Prioridade atual:** NÃO BLOQUEANTE

### Evidência atual

`NitCentral.confirmarNormalizar()` representa o caminho principal identificado.

`NitNormalizar` permanece como implementação alternativa/legada.

### Investigar

```text
referências
listeners
inicialização
caminhos ainda acessíveis pela interface
dependências indiretas
```

### Só depois decidir

```text
manter
isolar
deprecar
remover
```

---

## TODO-011 — Verificar modal antigo de despacho

**Estado:** [INVESTIGAR]  
**Domínio:** Semáforo  
**Prioridade atual:** NÃO BLOQUEANTE

Confirmar se ainda existe consumidor operacional do fluxo antigo antes de qualquer remoção.

---

## TODO-012 — Verificar routes/config.py

**Estado:** [INVESTIGAR]  
**Domínio:** Backend  
**Prioridade atual:** NÃO BLOQUEANTE

### Evidência atual

Foi identificado como aparentemente não registrado no fluxo principal auditado.

### Investigar

```text
importações
registro de router
consumidores externos
finalidade histórica
possibilidade real de remoção
```

---

# 10. Modelo de dados ainda não totalmente consolidado

## TODO-013 — Consolidar schema de Recursos/Equipes

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / recursos  
**Prioridade atual:** NÃO BLOQUEANTE

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

# 11. Interface — ajuste já identificado

## TODO-019 — Refinar mensagem do alerta de integridade do Plano A

**Estado:** [PENDENTE]  
**Domínio:** Semáforo / interface  
**Prioridade atual:** NÃO BLOQUEANTE

### Origem

Texto de alerta aprovado em discussão, ainda não aplicado no arquivo de referência.

### Ajuste previsto

Apresentar:

```text
Processamento incompleto — X de Y ocorrências processadas
```

Identificar a ocorrência não processada com:

```text
código
endereço
```

e orientar a conferência de:

```text
datas
horários de início
horários de fim
alterações/formato do texto
```

### Critério de conclusão

Mensagem conferida visualmente, sem mudança no cálculo, na identidade ou no processamento.

O TODO-022 poderá absorver ou substituir esse alerta quando a nova prévia for implementada. Não duplicar interfaces sem necessidade.

---

# 12. Validação documental

## TODO-014 — Fazer revisão cruzada final da documentação

**Estado:** [PENDENTE]  
**Domínio:** documentação  
**Prioridade atual:** ANTES DA PUBLICAÇÃO DO NOVO TURNO

### Revisar

```text
CONTEXT.MD
ARCHITECTURE.md
DATA-MODEL.md
BUSINESS-RULES.md
WORKFLOW.md
CONTRATO-ENTRADA-CEMOB.md
DECISIONS.md
docs/adr/
AI-INSTRUCTIONS.md
TODO.md
```

### Objetivo

Detectar:

```text
contradições
duplicações desnecessárias
regra descrita como contrato em um arquivo e VALIDAR em outro
nomes divergentes
referências quebradas
informação histórica tratada como atual
```

### Restrição

Essa revisão é documental.

Não alterar comportamento do código para fazê-lo combinar com documentação incorreta.

### Momento

A revisão não bloqueia o início dos testes de aceitação.

Deve ser concluída antes da publicação destinada ao novo turno.

---

## TODO-015 — Validar links e caminhos internos da documentação

**Estado:** [PENDENTE]  
**Domínio:** documentação  
**Prioridade atual:** ANTES DA PUBLICAÇÃO

Após os arquivos serem colocados no repositório, verificar:

```text
links de DECISIONS.md → docs/adr/
nomes exatos dos arquivos
case-sensitive paths
referências cruzadas
CONTRATO-ENTRADA-CEMOB.md
```

---

# 13. Baseline de regressão

## TODO-016 — Estabelecer baseline de validação antes da próxima feature

**Estado:** [PENDENTE]  
**Domínio:** engenharia

O objetivo original permanece válido, mas a execução deve ser integrada aos testes da entrega atual.

### Cobrir, conforme possível

#### SEMÁFORO

```text
processamento CEMOB
identidade/reprocessamento
despacho
apoio
rendição
normalização
continuidade/herança
exportação DRY_RUN
```

#### REBOQUES

```text
carga de plantão
criação de evento
alocação
transferência
finalização individual
finalização de evento
relatório
```

### Objetivo

Criar referência de regressão para futuras mudanças assistidas por IA.

### Relação com TODO-020

O TODO-020 trata especificamente dos testes de aceitação necessários à integridade CEMOB.

O TODO-016 permanece mais amplo e não deve obrigar a conclusão de toda a suíte de Reboques para liberar o novo turno do Semáforo.

---

# 14. Itens resolvidos

## TODO-001 — Definir comportamento NORMALIZADO → PENDENTE

**Estado:** RESOLVIDO

A questão deixou de ser pendência ativa.

### Decisão consolidada

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
mesmo eventoId
histórico preservado
      ↓
PENDENTE
```

### Regras associadas

```text
não é herança automática
não cria silenciosamente novo eventoId
não apaga histórico
não reativa automaticamente estado operacional anterior
```

### Documentação

Decisão consolidada em:

```text
BUSINESS-RULES.md
WORKFLOW.md
DATA-MODEL.md
CONTRATO-ENTRADA-CEMOB.md
```

O item pode ser removido definitivamente do TODO após commit/versionamento dos documentos atualizados.

---

## TODO-018 — Detectar ocorrências excedentes no Kanban em relação ao bruto

**Estado:** ABSORVIDO PELO TODO-026

### Evidência histórica preservada

Em teste controlado com relatórios completos consecutivos em 23/09/2026, a ocorrência 1430 foi retirada de um relatório bruto completo sem ser normalizada.

Após o processamento:

```text
Bruto:   12
Kanban:  13
Monitor: 13
```

Quando 1430 reapareceu com a mesma identidade, não houve duplicação.

### Evolução

O problema deixa de ser tratado apenas como:

```text
detectar excedente
```

e passa a integrar a verificação bidirecional:

```text
expectedEventIds
representedEventIds

missing
unexpected
```

implementada/testada no TODO-026.

---

# 15. Itens explicitamente fora do TODO atual

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

Também não transformar a entrega atual em:

```text
motor de IA
sistema probabilístico
autocorreção universal
observabilidade corporativa completa
redesenho integral do banco
```

Esses itens podem futuramente virar propostas, mas não são pendências derivadas da entrega atual.

---

# 16. Ordem operacional atual

Esta é a linha de entrega vigente:

```text
1. CONTRATO DE ENTRADA                     ✓

2. TESTES DE ACEITAÇÃO
   TODO-020

3. GUARDIÃO MÍNIMO
   TODO-021

4. PRÉVIA DE PROCESSAMENTO
   TODO-022

5. RECONCILIAÇÃO
   TODO-023

6. RECUPERAÇÃO MÍNIMA
   TODO-024

7. REGISTRO DE INTEGRIDADE
   TODO-025

8. VALIDAÇÃO BRUTO × NIT
   TODO-026

9. PUBLICAÇÃO SEGURA / ROLLBACK
   TODO-017

10. MODO SOMBRA
    TODO-027

11. TESTE CONTROLADO NO TURNO ATUAL
    TODO-028

12. REVISÃO DOCUMENTAL FINAL
    TODO-014 / TODO-015

13. LIBERAÇÃO DO NOVO TURNO
    TODO-029
```

Essa ordem representa prioridade operacional.

Ela não elimina as demais pendências.

---

# 17. Critério para interromper a linha de entrega

Durante a execução dos TODOs bloqueantes, uma descoberta nova só deve interromper a sequência quando houver evidência de risco para:

```text
integridade
recuperabilidade
falha segura
continuidade operacional
```

Caso contrário:

```text
descoberta
   ↓
registrar
   ↓
classificar
   ↓
TODO futuro
   ↓
continuar entrega
```

Isso evita que o projeto volte a um ciclo infinito de investigação.

---

# 18. Critério para adicionar novo TODO

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
Prioridade:

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

# 19. Critério de liberação do novo turno

A liberação não exige:

```text
zero bugs
zero erro humano
zero situação desconhecida
100% das pendências históricas resolvidas
```

Exige evidência suficiente de:

```text
CASO NORMAL
→ processa corretamente

CASO CONHECIDO ADVERSO
→ comportamento testado

CASO DESCONHECIDO
→ falha segura

DIVERGÊNCIA
→ observável e explicável

DECISÃO HUMANA
→ consequência explícita

DECISÃO ERRADA RECUPERÁVEL
→ correção acessível

ALTERAÇÃO PERIGOSA
→ não ocorre silenciosamente

FALHA DE PUBLICAÇÃO
→ rollback disponível
```

Esse é o critério operacional de segurança para expansão do NIT.

---

# 20. Critério de conclusão da fase documental

A memória técnica estrutural está suficientemente consolidada quando os documentos necessários à entrega estiverem versionados e coerentes:

```text
ARCHITECTURE.md                ✓
DATA-MODEL.md                  ✓
BUSINESS-RULES.md              ✓
WORKFLOW.md                    ✓
CONTEXT.MD                     ✓
DECISIONS.md                   ✓
docs/adr/                      ✓
AI-INSTRUCTIONS.md             ✓
TODO.md                        ✓
CONTRATO-ENTRADA-CEMOB.md      ✓
```

Permanecem:

```text
REVISÃO CRUZADA                ← antes da publicação
VALIDAÇÃO DE LINKS             ← antes da publicação
BASELINE / TESTES              ← execução
```

A fase atual deixa de ser predominantemente documental.

---

# 21. Fluxo de desenvolvimento a partir daqui

```text
CONTRATO
   ↓
TESTE
   ↓
PLANO
   ↓
APROVAÇÃO
   ↓
IMPLEMENTAÇÃO MÍNIMA
   ↓
TESTE
   ↓
MODO SOMBRA
   ↓
OPERAÇÃO CONTROLADA
   ↓
VALIDAÇÃO
   ↓
DOCUMENTAÇÃO DO QUE MUDOU
```

Não inverter:

```text
IMPLEMENTAR
→ descobrir regra depois
```

---

# 22. Próximo marco

```text
TODO-020
      ↓
TRANSFORMAR O CONTRATO DE ENTRADA CEMOB
EM TESTES DE ACEITAÇÃO
```

A partir desse ponto, a investigação acumulada começa a ser convertida em proteção executável.

---

**Status:** TODO consolidado em 01/10/2026 com preservação das pendências da auditoria anterior e incorporação da linha de entrega para expansão segura do NIT ao novo turno.

**Escopo da entrega atual:** congelado.

**Próximo passo:** `TODO-020 — Testes de Aceitação do Contrato de Entrada CEMOB`.
