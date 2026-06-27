# NIT — Núcleo de Inteligência de Tráfego · CONTEXT.md
> Fullstack sênior. Leia antes de qualquer mudança. Max 200 linhas.

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

## 2. Arquivos Frontend

```
index.html   ~675 linhas   HTML estrutural + Firebase config (carrega nit.css e nit.js externos)
nit.css     ~1600 linhas   Todo CSS incluindo Central da Ocorrência
nit.js      ~3200 linhas   Toda lógica JS
```

**Módulos JS (ordem em nit.js):**
`NitFirebase` → `NitLogin` → `NitData` → `AppState` → `DOM` → utilitários →
`NitLogger` → `Semaforo` → `inicializarApp` → `NitNormalizar` → `NitSidebar` →
`NitLazy` → `NitCardDetails` → `NitBuscaGlobal` → `NitLogout` →
`NitNormalizados` → `inicializarBuscasPorColuna` → `NitViradaDia` →
`NitProcessamento` → **`NitRecursos`** → **`NitCentral`**

---

## 3. Funções Protegidas — NÃO TOCAR SEM APROVAÇÃO EXPLÍCITA

```
_reprocessar()           lógica de herança entre plantões
_payloadFirebase()       estrutura canônica de gravação Firebase
statusFromSecao()        regras de classificação de status
append_heranca_diaria()  backend: herança diária (export.py)
_montar_linha_nova()     backend: linha na planilha (sheets_integration.py)
```

---

## 4. Arquitetura de Card — Estado Atual

**`Semaforo._buildBodyHTML(d)`** — método único. Sanitizador `_sv()` em todos os campos.

**Hierarquia visual do body:**
```
1. card-address       endereço
2. card-inicio        ⏳ DD/MM HH:MM — pendente SEM despacho
3. inicioRef          ⏳ opaco — normalizado SEM fim (fallback)
4. card-despacho-tipo 🟠/🔵 + card-equipe + card-ts-despacho
5. card-obs           observação
6. card-fim           ✅ DD/MM/YYYY HH:MM
```

**`child_changed`** usa `_buildBodyHTML(el.dataset)` — fonte única de renderização.

---

## 5. Próxima Arquitetura — Decisões Fechadas

### 5.1 Central da Ocorrência (IMPLEMENTADA — pendente fixes)
Modal acessível via botão `ℹ️`. Abas: Despacho | Apoio | Rendição | Normalizar.
Histórico via **push keys Firebase** (append-only, collision-safe).
`tsFirstDispatch` imutável no nó raiz do card.

**Header da Central — FIX PENDENTE:**
```
Hierarquia correta:
  072                              [✕]
  R. JUSTINIANO & AV. BEZERRA
  FALHA DE EQUIPAMENTO
  ─────────────────────────────
  🔵 AMC em operação              ← status operacional separado
  ─────────────────────────────
  ⏱ Registro  106h00m | ⏱ Operação 2h12m
```
Badge AMC/VL NÃO pertence à identidade do semáforo.
Pertence ao status operacional — faixa própria entre identidade e timers.

**SLA thresholds — FIX PENDENTE:**
- SLA Total:  verde <4h · âmbar 4–8h · vermelho >8h (com pulse)
- Operação:   verde <1h · âmbar 1–2h · vermelho >2h (limites próprios)

### 5.2 NitRecursos (IMPLEMENTADO)
Banco de equipes/viaturas em `/recursos/equipes` no Firebase.
Auto-fill VT + tipo ao selecionar equipe. Aprendizado automático de novos nomes.
Compartilhado entre módulos (Semáforo, Reboques, etc).

### 5.3 Firebase — Histórico de Despacho
```
/kanban/{eventoId}/historico/{pushKey}:
  { tipo: 'despacho'|'apoio'|'rendição', equipe, vt, sub, ts, operador }
/kanban/{eventoId}/tsFirstDispatch: timestamp (imutável)
```

### 5.4 Coluna N — Derivação do Histórico
```
Via Livre = recurso humano/viatura. NÃO é estado de via ou tráfego.
Algoritmo: despacho→segmento, apoio→+, rendição→→
Exemplos: [VL, apoio AMC] → "VIA LIVRE + AMC"
          [VL, rendição AMC] → "VIA LIVRE → AMC"
```

### 5.5 Card Passivo + Drag & Drop (PENDENTE)
Card inteiro clicável → abre Central. Distinção clique/drag por delta posição.
Normalizar exclusivamente no modal.

---

## 6. Auth — Firebase Auth com Google

Login com Google + whitelist `/usuarios_autorizados/{email_key}`.
Email key: substituir `.` e `@` por `|`. Ex: `user|gmail|com`.
`onAuthStateChanged` → `_verificarAutorizacao()` → `_concluirLogin()`.
`inicializarListenerFirebase()` só após auth confirmada.

---

## 7. Backend — Estado

**Bugs resolvidos:** #17 (coluna O write-once), #18 (obs if_not_empty),
status M sempre NORMALIZADO, cursor `_int()` helper, herança duplicada,
fallback APPEND removido.

**`clientes.json`:** `"plantonista": "plantonista"` (lê campo Firebase).

**Firebase Rules:**
```json
"kanban": { ".read": "auth != null", ".write": "auth != null",
  ".indexOn": ["ts","ts_norm","ts_dataReferencia","status","coluna","codigo"] }
"usuarios_autorizados": { ".read": "auth != null", ".write": false }
```

---

## 8. Fixes Deployados (prontos nos outputs desta sessão)

| Fix | Arquivo |
|-----|---------|
| Login Google + whitelist | nit.js + index.html |
| Listener Firebase após auth | nit.js |
| NitCentral (Despacho/Apoio/Rendição/Normalizar) | nit.js + index.html |
| NitRecursos banco de equipes | nit.js + index.html |
| Auto-fill VT + aprendizado | nit.js |
| SLA alert states (verde/âmbar/vermelho) | nit.js + nit.css |
| Timeline vertical histórico | nit.js + nit.css |
| CSS Central refatorado (escopo isolado) | nit.css |
| VANDALISMO em TIPOS | nit.js |
| Reincidente por dataReferencia | nit.js |
| child_changed usa _buildBodyHTML | nit.js |
| Sanitizador _sv em _buildBodyHTML | nit.js |
| ordenarNormalizados em atualizarPainel | nit.js |
| extrairPlantonista do cabeçalho CEMOB | nit.js |

## 9. Pendente Próxima Sessão

1. **Header da Central** — separar identidade do semáforo do status operacional
2. **SLA operação** — thresholds próprios (1h/2h)
3. **Card passivo** — card 100% clicável, drag&drop mantido
4. **Ctrl+K conflito** — trocar atalho para outro não conflitante
5. **Bug 1 datas início** — confirmar se relatório mesmo plantão causa perda

---

## 10. Prompt Universal

```
Você é fullstack sênior em JS, HTML, CSS, Firebase, Railway,
Google Sheets, Python e FastAPI.
Leia CONTEXT.md. Respeite seção 3 (protegidas).
Frontend: nit.js + nit.css externos ao index.html (~675L).
Outputs desta sessão contêm versão mais recente dos 3 arquivos.
Próximas implementações: seção 9 deste CONTEXT.md.
```
