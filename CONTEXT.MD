# NIT — Núcleo de Inteligência de Tráfego · CONTEXT.md
> Fullstack sênior. Leia antes de qualquer mudança. Max 200 linhas.
> Atualizado: 28/06/2026

---

## 1. Stack & Repositórios

| Camada | Tecnologia | URL/Referência |
|--------|-----------|----------------|
| Frontend | Vanilla JS + HTML + CSS | github.com/CrissTiano07/sistemaintegrado |
| Deploy frontend | GitHub Pages | crisstiano07.github.io/sistemaintegrado/ |
| Backend | FastAPI + Python | github.com/CrissTiano07/nit-backend |
| Deploy backend | Railway | nit-backend-production-f09b.up.railway.app |
| Realtime DB | Firebase RTDB | nit-operacional-default-rtdb.firebaseio.com |
| Planilha | Google Sheets | ID: `192OVycIIw7kCmo7F3E-bafF6GGSNAYkOT-vgNb_i8jc` aba `BancoFalhas` |

---

## 2. Arquivos

```
Frontend
  index.html            ~735L   HTML estrutural + Firebase config
  nit.css              ~1910L   Todo CSS
  nit.js               ~3490L   Toda lógica JS

Backend (Railway)
  routes/export.py       ~306L  Cron + endpoint manual de exportação
  services/sheets_integration.py ~498L  Integração Google Sheets
```

**Módulos JS:** `NitFirebase → NitLogin → NitData → AppState → DOM → NitLogger → Semaforo → inicializarApp → NitNormalizar → NitSidebar → NitLazy → NitCardDetails → NitBuscaGlobal → NitLogout → NitNormalizados → inicializarBuscasPorColuna → NitViradaDia → NitProcessamento → NitRecursos → NitCentral`

---

## 3. Funções Protegidas — NÃO TOCAR SEM APROVAÇÃO EXPLÍCITA

```
_reprocessar()           lógica de herança entre plantões
_payloadFirebase()       estrutura canônica de gravação Firebase
statusFromSecao()        regras de classificação de status
append_heranca_diaria()  backend: herança diária (sheets_integration.py)
_montar_linha_nova()     backend: linha na planilha (sheets_integration.py)
```

---

## 4. Arquitetura de Card — Estado Atual

**`Semaforo._buildBodyHTML(d)`** — método único. Sanitizador `_sv()`.

**Formato despacho:** `🔵 AMC · Raimundo · VT 222` (linha única)
Com apoio: `🔵 AMC · Raimundo · VT 222 + José · VT 300`

**Hierarquia visual do body:**
```
1. card-address       endereço
2. card-inicio        ⏳ DD/MM — pendente SEM despacho
3. card-despacho-tipo 🟠/🔵 + equipe · VT (linha única)
4. card-ts-despacho   hora de início da operação
5. card-agendamento   ⏰ Rendição VL 14:30 · Equipe · VT (âmbar, se agendado)
6. card-obs           observação
7. card-fim           ✅ DD/MM/YYYY HH:MM
```

**Dataset flat do agendamento:** `agendamentohora` · `agendamentoequipe` · `agendamentosub` · `agendamentovt`
Mapeado em `child_added`, `child_changed` e `criarElementoCard`.

---

## 5. Central da Ocorrência — Arquitetura

**Header — 3 zonas:**
```
Zona 1: código + endereço + tipo
────────────────────────────────
Zona 2: 🔵 AMC · Raimundo · VT 222  (status operacional rico)
        ⏰ banner âmbar se rendição agendada
────────────────────────────────
Zona 3: [SLA card] ⏱ Registro 1h51m | ⏱ Operação 0h32m
```

**Timers:**
- REGISTRO: `_parseBR(card.dataset.inicio)` — data do relatório CEMOB
- OPERAÇÃO: `parseInt(card.dataset.tsdespacho)` — despacho ATUAL (resetado em rendições)
- Thresholds Registro: verde <4h · âmbar 4–8h · vermelho >8h
- Thresholds Operação: verde <1h · âmbar 1–2h · vermelho >2h

**Tabs:** 4 pills — DESPACHO | APOIO | RENDIÇÃO | ╱ | NORMALIZAR (verde)

**Rendição — 2 estados no painel:**
- Estado A (agendamento pendente): painel de execução com hora real editável + Coluna N preview
- Estado B (sem agendamento): form de nova rendição ou agendamento

**Histórico:** colapsado por padrão. Header clicável → max-height 300ms ease-out.
Badge "Último: Rendição · 07:50" derivado de `_atualizarUltimo()`.

**colunaN derivado async:** `confirmarApoio` e `confirmarRendicao` leem historico
do Firebase ANTES de gravar — elimina dependência de elemento DOM desatualizado.

**Atalho busca global:** `Ctrl+Shift+K`

---

## 6. Sincronização Multi-Operador

**`child_changed`** campos sincronizados:
```js
['equipe','viatura','pl','sub','status','observacoes','inicio','endereco',
 'tsDespacho','tsFirstDispatch','equipeApoio','viaturaApoio',
 'data_fim','hora_fim','fim','coluna']
+ agendamento (objeto aninhado → 4 campos flat)
```

**Modal refresh em tempo real:** `child_changed` chama `_renderHeader + _iniciarTimers`
se `NitCentral._card === el`. Modal sempre reflete estado Firebase.

**Comportamentos aceitos (last-write-wins):**
- Despacho simultâneo: card converge, historico registra ambos (push keys)
- `_reprocessar` simultâneo: janela de inconsistência transitória, convergência garantida
- `ServerValue.TIMESTAMP` no drag-and-drop

**Safari:** `dataTransfer.setData('text/plain', id)` + `effectAllowed = 'move'` no `dragstart`.

---

## 7. Coluna N — Fluxo Completo

**Frontend** grava `colunaN` no Firebase em todo `confirmar*`:
- Despacho: computado local (`'VIA LIVRE'` / `'AMC'`)
- Apoio/Rendição: lê historico Firebase async → `_derivarColunaN(hist, eventoExtra)`

**Backend Section 4** (`export.py`): prioridade `colunaN` do Firebase →
derivado do historico via `_derivar_coluna_n()` → fallback `sub_map` simples.
Retorna transição mais recente: `"VIA LIVRE → AMC"` (não a cadeia histórica toda).

**Planilha:** coluna N atualizada em cards ativos a cada ciclo do cron.
Na normalização: `update_ocorrencia_normalizada` grava colunaN se presente.

---

## 8. Backend — Estado Estável (28/06/2026)

**Cron estável.** Planilha sendo alimentada corretamente.

**Bugs resolvidos nesta sessão:**
- `append_heranca_diaria` implementada (faltava em sheets_integration.py)
- `get_cursor/update_cursor` com `ultimo_dataReferencia`
- `calcular_tempo_atendimento` aceita `DD/MM/YYYY` + extrai `inicio` composto do Firebase
- `executar_exportacao` sem `return resultado` (causava `NoneType.get()` no cron)
- Section 4: filtra normalizados, prioriza `colunaN`, deriva do historico

**Campos Firebase:** `inicio` "DD/MM/YYYY HH:MM" · `tsDespacho` ms (atual) · `tsFirstDispatch` ms (imutável) · `colunaN` string · `agendamento` objeto · `data_fim` · `hora_fim` · `ts_norm`

**`_montar_linha_nova` — coluna N (L.124):**
```python
dados.get("colunaN") or sub_map.get(sub, fb("operando_cruzamento"))
```

---

## 9. CSS — Padrão de Cores Dark Mode

```
--color-text-primary:   #f8faff    títulos, valores críticos
--color-text-secondary: #b0c8e8    texto de apoio
--color-text-tertiary:  #94a3b8    metadados, timestamps (WCAG AA 5.2:1)
```

`#64748b` — decorativo puro (chevrons, separadores, títulos uppercase 9px).
`color-mix()` tem fallbacks `rgba()` para browsers sem suporte.

---

## 10. Dead Code — Limpar em Sessão Dedicada

```
abrirModalDespacho()    substituído pela Central (modal antigo no HTML)
handleNormalizarClick() substituído pela aba Normalizar da Central
CSS btn-card-action.*   .dispatch, .edit, .complete (classes removidas do template)
```

---

## 11. Pendente Próxima Sessão

1. **Campo texto/chat no topo do modal** — substituir o círculo (status badge)
   por área de texto colaborativa (comentários do operador em tempo real)
2. **Bug 1 datas início** — confirmar se relatório mesmo plantão causa perda de tsInicio
3. **Auto-execução rendição agendada** — listener/polling no horário
4. **Modal horizontal (futuro)** — grid 3 colunas quando dados forem suficientes
5. **Ranking quebras (futuro)** — endpoint FastAPI, mínimo 30 dias de dados
6. **Limpeza dead code** — seção 10

---

## 12. Prompt Universal

```
Você é fullstack sênior em JS, HTML, CSS, Firebase, Railway,
Google Sheets, Python e FastAPI.
Leia CONTEXT.md. Respeite seção 3 (protegidas).
Frontend: nit.js (~3490L) + nit.css (~1910L) + index.html (~735L).
Backend: routes/export.py (~306L) + services/sheets_integration.py (~498L).
Outputs desta sessão contêm versão mais recente de todos os arquivos.
Próximas implementações: seção 11 deste CONTEXT.md.
```
