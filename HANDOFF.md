# HANDOFF.md — NIT

> Ponto de retomada do trabalho. Leia depois de `CONTEXT.MD` e `AI-INSTRUCTIONS.md`.
> Atualizado em: **13/10/2026**.
> Este arquivo registra **estado e próximos passos**. Regras ficam em `BUSINESS-RULES.md` / `CONTRATO-ENTRADA-CEMOB.md`; pendências detalhadas, em `TODO.md`.

---

## 1. Estado da produção

| Item | Situação |
|---|---|
| Versão em produção | **v13** — repositório `sistemaintegrado` (GitHub Pages), Firebase `nit-operacional` |
| Contingência | **v10** — repositório `nit-nucleo-inteligencia-trafego`, usada só em pane não reversível imediata. **[VALIDAR]** se usa o mesmo Firebase antes de oficializar (ver TODO-017) |
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

## 3. Defeitos conhecidos do motor (detectados, não corrigidos)

| Teste | Defeito | Efeito para o operador | Causa no código |
|---|---|---|---|
| T10b, T06, T12 | **Herança só por código** | duas falhas do mesmo semáforo viram uma; painel fica 1 abaixo do CEMOB | `_reprocessar()` → `cardHerdado` (pega o 1º pendente do mesmo código) |
| T08, T09 | **Normalizado que volta sem Fim é ignorado** | painel mostra normalizada; CEMOB diz pendente | `_reprocessar()` não trata `existente.normalizado && status PENDENTE` |
| T13, T14 | **Ocorrência que sai do relatório continua no painel** | painel acima do CEMOB | não há reconciliação de ausentes |
| T02, T20 | **`eventoId` com `Date.now()` sem Início** | identidade muda a cada processamento | `gerarEventoId()` (nit.js) |
| T15–T18 | Guardião / decisão humana / reversão | — | não implementados (TODO-021 a 024) |

Hoje a conferência v2 **mostra** todos esses casos ao operador. A correção das causas exige plano próprio e aprovação.

---

## 4. Próximos passos (ordem sugerida)

1. **Corrigir `cardHerdado` (T10b).** Diagnóstico de 21/09 + T10b provam a causa. Auditoria de impacto operacional (equipe/VT/histórico) já feita no diagnóstico. Rodar a bateria antes/depois.
2. **Decidir o conflito documental `NORMALIZADO → PENDENTE`:** `BUSINESS-RULES` BR-NOR-007 diz CONTRATO; `AI-INSTRUCTIONS` §6.3/§9 diz VALIDAR. Sem essa decisão, T08/T09 não podem ser corrigidos.
3. **`eventoId` sem Início (T02/T20).** Havia correção em laboratório (44/44 testes, conversa no ChatGPT) **não recuperada**; refazer a partir do caso real (SCNs 584/1118).
4. TODO-031 (aviso de virada depende do navegador) e TODO-032 (sinal de herança dura 3 s).
5. TODO-017: publicação segura — conferir se a v10 compartilha o Firebase.

Fora do motor, registrados para depois: duração na planilha ignora troca de dia (13/09 07:28 → 14/09 08:35 gravado como 01:07:00); retenção/limpeza do `/kanban` (exige decisão/ADR; limpeza manual continua); botão "Copiar alerta" para enviar ao CEMOB.

---

## 5. Decisões e fatos confirmados com o responsável

- Relatório CEMOB conta por dia de calendário (00:01 → 00:00); hoje não há turno de madrugada.
- Último turno encerra 21:30; plantão da manhã começa 05:30.
- "Sem necessidade" **não** é encerrado: continua em monitoramento e participa da herança.
- Normalizado de dia anterior não tem mais valor operacional para identidade.
- Planilha é **saída**; OPERANDO_CRUZAMENTO é preenchida ao arrastar o card.
- Prioridade: o motor funcionar sem bloquear a operação; erros não podem ser silenciosos.

---

## 6. Como retomar com uma IA (qualquer plano / fornecedor)

1. Envie: `CONTEXT.MD`, `AI-INSTRUCTIONS.md`, este `HANDOFF.md` e os arquivos do problema (normalmente `nit.js` e o relatório CEMOB envolvido).
2. Exija o protocolo do `AI-INSTRUCTIONS.md`: ler → localizar → plano (objetivo, arquivos, riscos, validação) → **aprovação explícita** → mudança mínima → validação → documentação.
3. Antes de publicar: `cd testes && npm test`. Resumo pior que a linha de base = não publicar.
4. Publique com mensagem de commit descritiva e guarde o `nit.js` anterior para rollback.

Documentos citados em conversas anteriores **que não existem no repositório**: `TESTES-ACEITACAO-CEMOB.md`, `AUDITOR-INTEGRIDADE-NIT-v1.0.md`, `ADR-008`, `ADR-009`, pasta `docs/adr/`. Não presuma o conteúdo deles.
