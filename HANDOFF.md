# HANDOFF.md — NIT

> Ponto de retomada do trabalho. Leia depois de `CONTEXT.MD` e `AI-INSTRUCTIONS.md`.
> Atualizado em: **14/10/2026**.
> Este arquivo registra **estado e próximos passos**. Regras ficam em `BUSINESS-RULES.md` / `CONTRATO-ENTRADA-CEMOB.md`; pendências detalhadas, em `TODO.md`.

---

## 1. Estado da produção

| Item | Situação |
|---|---|
| Versão em produção | **v13** — repositório `sistemaintegrado` (GitHub Pages), Firebase `nit-operacional` |
| Contingência | **v10** — repositório `nit-nucleo-inteligencia-trafego`, outro link. **Sem Firebase e sem nenhuma integração com a v13** (só frontend, localStorage). Usada só em pane. Retomar o que foi feito nela é tarefa pós-entrega (prioridade após a 1ª entrega) |
| `nit.js` | carregado por `index.html` como `nit.js?v=20261012` |
| Exportação para planilha | funcionando; o exportador real **não é** o documentado (cursores `meta/ultimaExportacao/cliente_b` parados desde 10/07/2026) — TODO-005/006 |

---

## 2. Entregue em 09–12/10/2026

**Aviso de data do plantão (TODO-030).** Antes de gravar, se a data do cabeçalho do relatório ≠ hoje, o NIT avisa. Confirmar processa como antes; Cancelar não grava nada. Origem: incidente de 09/10, cabeçalho `13/09/2026` escondeu 26 cards.

**Conferência pós-processamento v2 (TODO-026).** Depois de processar, compara relatório × painel e informa, sem alterar nada:

```text
no relatório, fora do painel       → outra ocorrência do mesmo semáforo ocupa o lugar (cardHerdado)
início diferente do painel          → o NIT manteve o início antigo
sem data/hora de início             → identidade provisória
no painel, fora do relatório        → caso 1430
situação diferente                  → normalizado que volta pendente (ou o inverso)
registradas com outra data          → não aparecem no painel de hoje
```

Mensagens no formato do CEMOB: `🚦 código 🚦 endereço ● problema ● Início` + "O NIT identificou que… Verifique… no relatório".

**Bateria de testes (`testes/`).** Ver `testes/LEIA-ME.md`. Linha de base: `PASSOU 8 · PARCIAL 3 · FALHOU 7 · NÃO IMPLEMENTADO 4`.

---

## 2b. NIT 13.1 — em laboratório (14/10/2026), NÃO publicado

Regra aprovada: **um semáforo, uma pendência** (BUSINESS-RULES BR-CON-010 a 018). Implementação em laboratório:

- `_classificarLinhas` (somente leitura): decide cada linha olhando o relatório inteiro e os cards, em ordem de horário.
- `_cargaInicial` e `_reprocessar` aplicam essa classificação (substitui `cardHerdado`); conferência reclassifica o estado gravado.
- Correção de horário mantém a chave do card (`inicio`, `inicioAnterior`, `aliases/{id}`); sem início → ID fixo `codigo_SIddmmaaaa`.
- Testes: `testes/bateria-13-1.js` (29 cenários integrados), `testes/classificacao-13-1.js` (32 verificações), `testes/bateria.js` atualizada.
- Achado com relatório real (09/10, semáforo 323): o motor atual perde a pendência quando a anterior ainda está pendente e a reincidência chega no mesmo relatório. A conferência v2 (produção) já detecta; a 13.1 corrige.
- BR-CON-017 decidida em 15/10/2026 (retificação com fim no mesmo card, CONTRATO §13; T07 passa).
- 16/10/2026: homologação com dois operadores (projeto `nit-homologacao`, repositório `nit-homologacao`, GitHub Pages) — 4 testes passaram: sincronização, correção de horário, reincidência sem perda (caso 323), processamento simultâneo.
- 16/10/2026: indicador de gravação (Mudança 6) em laboratório — "✓ Tudo salvo" / "⏳ aguardando envio" / "⚠️ Semáforo X não foi salvo"; aviso ao fechar a aba com fila; último relatório do dia guardado no computador com botão "Recuperar". Bateria `testes/bateria-gravacao.js` (7/7).
- Pendente: teste de gravação na homologação (desligar a rede); botões da 13.2; revisão de todos os textos de alerta.
- 16/10/2026 (noite): análise dos relatórios reais e da planilha. Corrigido em laboratório: (1) causa e problema corrigidos não chegavam à tela do outro operador; (2) causas fora da lista fixa viravam "N/I" (MODERNIZAÇÃO, ABALROAMENTO, ACOMPANHAMENTO) — agora vale a causa escrita pela fonte; (3) relatório de saída: normalizado mostra início e fim ("16/10 07:14 às 10:46"; dias diferentes: "15/10 14:00 às 16/10 00:01"). Bateria `testes/bateria-causa.js` (4/4, inclui os relatórios reais de 16/10).
- Incidente 16/10/2026: a fonte trocou o 973 por 025 (erro humano) e o operador precisou apagar o kanban para continuar. Na 13.1 isso não bloqueia (a conferência mostra os dois; nada é decidido sozinho); a 13.2 dá ao operador o "Retirar do painel".
- Planilha (pós-entrega): causa congelada na primeira versão; linhas duplicadas quando a fonte corrige a data do início (602, 291, 1103, 887 em 16/10); 887 de 13/10 três vezes; duração > 24 h exibida como "01/01 02:14".
- Registrado a pedido do responsável (tratar em momento oportuno): **relatório de saída** — normalizados aparecem com "Desde" (início) e sem o horário de fim; toast curto demais e aviso de horário corrigido duplicado.
- Achado (16/10/2026): as regras do Firebase não têm o nó `recursos/` — a gravação de `recursos/equipes` (aprendizado automático de equipes) é recusada em produção, em silêncio. Avaliar na 13.3 junto com as regras de `usuarios_autorizados`.

## 3. Defeitos conhecidos do motor (detectados, não corrigidos)

| Teste | Defeito | Efeito para o operador | Causa no código |
|---|---|---|---|
| T10b, T06, T12 | **Herança só por código** | duas falhas do mesmo semáforo viram uma; painel fica 1 abaixo do CEMOB | `_reprocessar()` → `cardHerdado` (pega o 1º pendente do mesmo código) |
| T08, T09 | **Normalizado que volta sem Fim é ignorado** | painel mostra normalizada; CEMOB diz pendente | `_reprocessar()` não trata `existente.normalizado && status PENDENTE` |
| T13, T14 | **Ocorrência que sai do relatório continua no painel** | painel acima do CEMOB | não há reconciliação de ausentes |
| T02, T20 | **`eventoId` com `Date.now()` sem Início** | identidade muda a cada processamento | `gerarEventoId()` (nit.js) |
| T15–T18 | Guardião / decisão humana / reversão | — | não implementados (TODO-021 a 024) |

Hoje a conferência v2 **mostra** todos esses casos ao operador. Na 13.1 (laboratório): T06, T10b, T12, T02, T20 corrigidos; T08/T09 e T13/T14 ficam sinalizados por regra (decisão humana na 13.2); T07 corrigido (BR-CON-017).

---

## 4. Próximos passos (ordem sugerida)

1. **Corrigir `cardHerdado` (T10b).** Diagnóstico de 21/09 + T10b provam a causa. Auditoria de impacto operacional (equipe/VT/histórico) já feita no diagnóstico. Rodar a bateria antes/depois.
2. **Decidir o conflito documental `NORMALIZADO → PENDENTE`:** `BUSINESS-RULES` BR-NOR-007 diz CONTRATO; `AI-INSTRUCTIONS` §6.3/§9 diz VALIDAR. Sem essa decisão, T08/T09 não podem ser corrigidos.
3. **`eventoId` sem Início (T02/T20).** Havia correção em laboratório (44/44 testes, conversa no ChatGPT) **não recuperada**; refazer a partir do caso real (SCNs 584/1118).
4. TODO-031 (aviso de virada depende do navegador) e TODO-032 (sinal de herança dura 3 s).
5. TODO-017: a v10 não tem Firebase (confirmado 14/10/2026); resta definir o procedimento de volta da contingência (pós-entrega).

Fora do motor, registrados para depois: duração na planilha ignora troca de dia (13/09 07:28 → 14/09 08:35 gravado como 01:07:00); retenção/limpeza do `/kanban` (exige decisão/ADR; limpeza manual continua); botão "Copiar alerta" para enviar ao CEMOB.

---

## 5. Decisões e fatos confirmados com o responsável

- Relatório CEMOB conta por dia de calendário (00:01 → 00:00); hoje não há turno de madrugada.
- Último turno encerra 21:30; plantão da manhã começa 05:30.
- "Sem necessidade" **não** é encerrado: continua em monitoramento e participa da herança.
- Normalizado de dia anterior não tem mais valor operacional para identidade.
- Planilha é **saída**; OPERANDO_CRUZAMENTO é preenchida ao arrastar o card.
- Prioridade: o motor funcionar sem bloquear a operação; erros não podem ser silenciosos.
- 14/10/2026: um semáforo tem no máximo uma pendência; reincidência exige fim da anterior; marca REINC pela data do relatório; sobreposição não cria reincidência; normalizado que volta sem fim só por decisão humana; legado preservado e sinalizado.
- Critérios universais: C1 proteger o já processado · C2 não criar erro novo · C3 operador desfaz a própria ação · C4 o NIT nunca para · C5 alerta proporcional ao impacto.
- Planilha e contingência v10: tratadas depois da entrega.

---

## 6. Como retomar com uma IA (qualquer plano / fornecedor)

1. Envie: `CONTEXT.MD`, `AI-INSTRUCTIONS.md`, este `HANDOFF.md` e os arquivos do problema (normalmente `nit.js` e o relatório CEMOB envolvido).
2. Exija o protocolo do `AI-INSTRUCTIONS.md`: ler → localizar → plano (objetivo, arquivos, riscos, validação) → **aprovação explícita** → mudança mínima → validação → documentação.
3. Antes de publicar: `cd testes && npm test`. Resumo pior que a linha de base = não publicar.
4. Publique com mensagem de commit descritiva e guarde o `nit.js` anterior para rollback.

Documentos citados em conversas anteriores **que não existem no repositório**: `TESTES-ACEITACAO-CEMOB.md`, `AUDITOR-INTEGRIDADE-NIT-v1.0.md`, `ADR-008`, `ADR-009`, pasta `docs/adr/`. Não presuma o conteúdo deles.


## 13.2 — Mensagens do NIT (laboratório, 17/10/2026)

- Catálogo validado: `MENSAGENS.md` (NIT-01..34; acréscimos da implementação na seção 4b, a validar).
- `NitDecisoes`: cards âmbar no topo (MANTER / TIRAR / REABRIR / 📋 PERGUNTAR), confirmação com totais e DESFAZER.
  TIRAR não apaga: grava `retirado` no card; DESFAZER limpa. Decisões em `decisoes/{NIT-xx}`, perguntas em `perguntas/{sig}` (mesmo nó `kanban`, sem regra nova).
- Conferência continua só leitura; ganhou a detecção "fim antes do início" (NIT-13). `_classificarLinhas` inalterada.
- `NitGravacao`: textos NIT-30..34; NIT-34 para PERMISSION_DENIED em kanban/meta/historico/relatorios/auditoria. Botão "Recuperar último relatório" removido.
- Harness: `push()` do Firebase falso não resolve mais com a própria referência (travava a promessa); `controle.codigoRecusa`.
- Limitação conhecida: os cards de decisão vêm do último relatório processado **naquela janela**; se o outro operador processa um relatório mais novo, a lista desta janela só se atualiza quando ela processar também (decisões e perguntas do outro operador já aparecem na hora).

### Estado em 17/10/2026 02:00 — homologação funcional 13.2 (132homolog3)
- Cristiano subiu e testou h1→h4 com dois operadores: funcionando. Coluna ⚠ DECIDIR, recolher/expandir (DECIDIR e SEM NECESSIDADE), NIT-02 com destaque no CANCELAR.
- Pendências antes de produção:
  1. Bateria de estresse "sentir na pele": todas as situações, sequências longas, dois operadores, rede ruim, relatórios reais do dia.
  2. Defeito do motor (13.1): fim corrigido pela fonte não atualiza card já normalizado (468: 09:30 → 10:30). Precisa de autorização; proposta: fim novo + fimAnterior + etiqueta "⟲ fim corrigido".
  3. Etapa visual separada (auditoria de UI 17/10): card neutro com borda âmbar, botões em 3 níveis, título menor, DECIDIR mais larga, contraste WCAG AA medido, prints 1366/1600/1920, estética console.
  4. Validar acréscimos de texto da seção 4b do MENSAGENS.md.
  5. Limitação: lista de decisões de uma janela não se atualiza quando outro operador processa relatório mais novo.
- Depois: publicação (autorização), 13.3 (usuários + regras Firebase), planilha, contingência v10.


### 18/10/2026 — fim corrigido + bateria de estresse
- Autorizado e feito: fim corrigido pela fonte atualiza card normalizado (mesmo início), guarda `fimAnterior`, etiqueta "⟲ fim corrigido". Fim antes do início não é aplicado (NIT-13 avisa).
- Bateria de estresse (`testes/bateria-estresse.js` + `estresse-mundo.js`): dia simulado 06:00→02:00 com dois operadores + sequências aleatórias com cliques e rede. Regras R1–R10 a cada passo; falha grava semente/sequência em `estresse-falhas.json`. `SEMENTES=4,11 node bateria-estresse.js 0 30` reproduz.
- Defeitos achados e corrigidos: (1) DESFAZER do REABRIR apagava o fim de card que nasceu normalizado; (2) REABRIR criava 2 pendentes quando o semáforo já tinha outra pendência (agora o botão não aparece).
- Comportamento correto confirmado: pendência cujo fim só saiu no relatório de ontem (depois do último relatório processado) → o relatório de hoje não a fecha → NIT-10 pergunta.
- 19/10: autorizados e feitos — linha sem início não apaga início conhecido (BR-CON-020); id sem início não colide (BR-CON-021); NIT-11 MANTER esquecido quando a fonte devolve o fim (BR-DEC-001).
- `testes/gerar-turno.js`: gera turno de 15 relatórios + roteiro com resultado esperado (homologação manual).

### 19/10/2026 — anotações da homologação manual (corrigir em lote ao fim dos testes)
1. NIT-10 (não veio): trocar MANTER/TIRAR por botões de ESTADO DO SEMÁFORO.
   - Estava pendente: [PENDENTE] · [NORMALIZOU] · [EXCLUIR] · 📋 PERGUNTAR. Estava normalizado: [NORMALIZADO] · [EXCLUIR] · 📋.
   - NORMALIZOU abre a janela de normalizar existente (hora do fim informada pelo operador).
   - EXCLUIR = retirar (soft) + DESFAZER; confirmação "✓ {cod} EXCLUÍDO DO PAINEL."
2. Regra do Cristiano: **o relatório é a verdade; ação manual só destrava.** Normalização manual (NORMALIZOU)
   é refeita pelo relatório: se o relatório seguinte ainda traz a linha aberta, o card volta a pendente sozinho
   (aviso ℹ); se traz o fim, o fim do relatório substitui o manual. (Diferente do BR-NOR-007, que vale para
   normalização que veio DO relatório.)
3. EXCLUIR: avaliar limpeza dos cards excluídos (retirados) no dia seguinte — hoje ficam no banco ocultos
   (necessário para DESFAZER, auditoria e para não ressuscitar card quebrado com gravação atrasada de outro operador).
4. NIT-12 (veio 2 vezes) vira AZUL ℹ: não conta em "esperam sua resposta", não acende "RELATÓRIO ALTERADO!".
   Texto: "ℹ {cod} VEIO 2 VEZES · Pendente às {h1} e às {h2}. Nada a fazer: o NIT ficou com {h1}. Some quando a fonte corrigir."
   Pergunta (opcional): "O {cod} aparece 2 vezes como pendente ({h1} e {h2}). O início certo é {h1} ou {h2}?"
5. **Diário consultável (prioridade logo após os testes):** os avisos ℹ somem em 8 s e o operador não viu.
   Criar um "📜 O QUE MUDOU" por processamento, consultável a qualquer hora: novos, normalizados,
   apagou de novo, resolvidos, início/fim corrigidos pela fonte, erros da fonte (não veio, 2 vezes,
   sem início, horário não fecha) e decisões do operador (quem, quando, DESFAZER). Gravar em
   `auditoria/` (regra já existe) para os dois operadores verem. Pedido do Cristiano: dá controle ao operador.
6. Relatório de saída repete o erro da fonte (108 "08:00 às 07:40"). Avaliar marcar "⚠ a confirmar"
   enquanto o NIT-13 estiver aberto.
7. NIT-11 sem REABRIR (já há outra pendência) precisa EXPLICAR no card, não esconder em silêncio:
   linha extra "Já existe outra pendência do {cod}, a das {h}. Por isso não dá para reabrir esta."
   Pergunta: "O {cod} aparece pendente às {h_antiga} e às {h_nova}. A das {h_antiga} não normalizou às {fim}?"
8. NIT-11 deixar claro que é a MESMA ocorrência "desnormalizada", não reincidência:
   "⚠ 110 VOLTOU ATRÁS" · "Mesma ocorrência (início 08:10). Normalizou às 09:50 e agora veio de novo como pendente. Não é uma nova falha."
9. Relatório de saída: enquanto houver decisão aberta (NIT-11/NIT-13), marcar a linha "⚠ a confirmar"
   (ex.: 110 sai normalizado enquanto a fonte diz pendente). Junta com o item 6.
10. Ao clicar "Ver Relatório" com decisão aberta: aviso SEM bloquear —
    "⚠ 110 ainda espera a fonte. O relatório pode sair diferente do da fonte. [ESPERAR] [GERAR ASSIM MESMO]";
    gerando assim mesmo, a linha sai "⚠ a confirmar" (itens 6 e 9).
11. Coluna ⚠ DECIDIR compartilhada: hoje cada janela monta a sua lista ao processar (o estado PERGUNTADO,
    decisões e EXCLUIR já sincronizam na hora). Fazer a lista vir do último relatório processado por QUALQUER
    operador (gravado no banco), para o B ver os cards sem precisar processar. Resolve a limitação conhecida.
12. Cards ficam estreitos quando a ⚠ DECIDIR aparece (7 colunas). Boa prática (Trello/Jira/painéis de operação):
    a) coluna VAZIA recolhe sozinha para a faixa de 36px (VIA LIVRE/AMC/SEM NECESSIDADE com 0) e abre sozinha quando chega card;
    b) largura mínima de coluna (~230px) — se faltar espaço, rolagem lateral em vez de espremer;
    c) ⚠ DECIDIR recolhe sozinha quando só restam perguntas já feitas (só ⏳ ESPERANDO A FONTE), mostrando o número.

### 20/10/2026 — lote da homologação aplicado no laboratório (132homolog6)
Feitos: 1 (botões do não veio), 4 (NIT-12 azul), 5 (📜 O QUE MUDOU em auditoria/{ddmmaaaa}), 7 e 8 (NIT-11 "VOLTOU ATRÁS" + explicação sem REABRIR),
10 (lembrete ao gerar relatório, sem marcar o relatório — item 6/9 recusado pelo Cristiano: "polui"), 11 (DECIDIR compartilhada via meta/decisoes_ativas),
12 (colunas vazias recolhem sozinhas, largura mínima 230px, DECIDIR recolhe quando só há perguntas feitas), 3 (excluídos apagados no dia seguinte).
Extra achado no estresse: DESFAZER depois que o relatório do outro operador já mudou o card sobrescrevia o estado → agora "ℹ {cod} JÁ FOI ATUALIZADO PELO RELATÓRIO. Nada a desfazer."
PENDENTE de decisão: item 2 (relatório refaz normalização manual) — aguardando resposta sobre a planilha e o vai-e-volta.
Testes: 13.2 29/29 · 13.1 33 · classificação 33 · causa 4 · bateria 18 (+4 N/I) · gravação 6 · estresse 210 sementes + dia simulado sem quebra.

### 20/10/2026 — mudanças após o teste do 132homolog6 (132homolog7)
- Colunas: o recolher automático foi RETIRADO (Cristiano: "pode ser feito manualmente. Melhor apenas deslizar as colunas"). Todas recolhem à mão; título da recolhida no alto; DECIDIR chega e as outras deslizam (minmax 230px). Item 12a/12c revogados.
- Item 2 resolvido: normalização manual provisória (BR-DEC-002, NIT-17, etiqueta ✋). Desenho respondido com "bom." — tratado como aprovação.
- Bug achado: janela de normalizar sugeria a data de AMANHÃ depois das 21h (data em UTC) → agora data local.
- Testes: 13.2 31/31 · 13.1 32 + C14 (relatório real, pulado sem o arquivo) · classificação 33 · causa 3 + K4 (pulado sem os arquivos) · bateria 18 (+4 N/I) · gravação 6 · estresse 210 sementes + dia simulado (5290 passos, 2916 relatórios, 765 cliques) sem quebra · roteiro manual `gerar-mudancas.js` conferido.

### 20/10/2026 — etapa visual da 13.2 (132homolog8)
Critérios: auditoria de UI 17/10 (item 3 acima) + medição axe/WCAG 2.2 AA (Cristiano: sem precisar do arquivo da auditoria).
- Cards de decisão: fundo neutro + borda de cor (âmbar decide, azul só para saber); título na cor do nível.
- Botões em 3 níveis: respostas (contorno claro, 36px) · EXCLUIR (contorno vermelho) · 📋 PERGUNTAR (texto, linha própria). DESFAZER com contorno.
- ⚠ DECIDIR mais larga: minmax(300px, 1.3fr).
- Fonte mínima 12px em todo o nit.css (67 declarações de 8,5–11,5px) e nos estilos inline do index.
- Contraste: "Ver Relatório" e demais .btn-primario 3,67:1 → #2563eb 5,2:1. Campo do relatório com aria-label.
- Alvos: checkbox 18px, seta de recolher 24px, contadores Ocorrências/Pendentes/Normalizados em caixa normal (não cortam).
- Medição: axe 0 violações em 1366/1600/1920 (antes: 2 — contraste e campo sem rótulo); 0 textos < 12px (antes: 42).
- Testes: todas as baterias iguais (13.2 31/31…), roteiro gerar-mudancas conferido.
- 20/10 13:46: Cristiano testou o 132homolog8 na homologação — passou. Vai testar com relatórios reais na empresa; decide a produção à noite.
- 20/10 22:52: teste real (dia tranquilo) — contagens bateram. Regras do Firebase de produção conferidas (meta e auditoria liberados). Pacote producao-13.2 pronto (= 132homolog8 + index de produção com ?v=20261020-132; volta/ = commit 33fbec4). Aguardando "autorizo".
- Depois da produção (13.2.1): hierarquia visual do 📜 O QUE MUDOU; não gravar "Nada mudou."; retenção do auditoria/ (dias a definir pelo Cristiano, sugestão 7).
