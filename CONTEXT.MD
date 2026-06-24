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
index.html     ~530 linhas   HTML + Firebase config inline
nit.css       ~1200 linhas   Todo CSS (design system com CSS vars)
nit.js        ~2560 linhas   Toda lógica JS
supervisor.html              View mobile — em planejamento
```

**Módulos JS (ordem em nit.js):**
`NitFirebase` → `NitLogin` → `NitData` → `AppState` → `DOM` → utilitários →
`NitLogger` → `Semaforo` → `inicializarApp` → `NitNormalizar` → `NitSidebar` →
`NitLazy` → `NitCardDetails` → `NitBuscaGlobal` → `NitLogout` →
`NitNormalizados` → `inicializarBuscasPorColuna` → `NitViradaDia` → `NitProcessamento`

---

## 3. Funções Protegidas — NÃO TOCAR SEM APROVAÇÃO EXPLÍCITA

```
_reprocessar()           lógica de herança entre plantões
_payloadFirebase()       estrutura canônica de gravação Firebase
statusFromSecao()        regras de classificação de status
append_heranca_diaria()  backend: herança diária (export.py)
_montar_linha_nova()     backend: linha na planilha (sheets_integration.py)
```

**`statusFromSecao` — regras vigentes:**
```javascript
if (secao === 'NORMALIZADO') return 'NORMALIZADO';
if (card.fim?.trim()) return 'NORMALIZADO';
const end = (card.endereco || '').toLowerCase();
if (end.includes('pgv')) return 'SEM_NECESSIDADE';
if (/\bentre\b/i.test(end)) return 'SEM_NECESSIDADE';
if (/\bpr[oó]x\.?\b/i.test(end)) return 'SEM_NECESSIDADE';
if (/veiculares?\s+funcionando/i.test(obs)) return 'SEM_NECESSIDADE';
return 'PENDENTE';
```

---

## 4. Arquitetura de Card — Estado Atual

**`Semaforo._buildBodyHTML(d)`** — método único e compartilhado de renderização.
Chamado por `_renderCardBody` (criação) e `child_changed` (sync Firebase).

**Hierarquia visual do body:**
```
1. card-address       endereço — sempre primeiro
2. card-inicio        ⏳ DD/MM HH:MM — pendente SEM despacho
3. card-despacho-tipo 🟠 VIA LIVRE / 🔵 AMC
   card-equipe        VT: 145 Equipe: Júnior (uma linha por equipe)
   card-ts-despacho   ⏱ HH:MM — hora de início da operação
4. card-obs           observação (itálico, borda esquerda)
5. card-fim           ✅ DD/MM/YYYY HH:MM — normalizado
```

**Regra crítica Firebase:** campos com `null` são deletados.
Em `child_changed` usar `dados[k] != null ? dados[k] : ''` para limpar dataset.

---

## 5. Próxima Arquitetura — Decisões Fechadas (Não Implementadas)

### 5.1 Card → Display Passivo
- Remove footer com botões de ação completamente
- Card inteiro clicável → abre Central da Ocorrência
- Distinção clique/drag: medir delta de posição no `mousedown`/`mouseup`
- Drag & drop mantido para mudança de coluna entre estados
- Normalizar: **exclusivamente no modal** — sem exceção no card

### 5.2 Central da Ocorrência (substitui modal de detalhes + despacho)
Estrutura em abas:
```
[Despacho] [Apoio] [Rendição] [Normalizar]
+ seção fixa de Histórico imutável
```
- Abas Apoio e Rendição: **desabilitadas** quando não há despacho ativo
- Aba Rendição: preview ao vivo da Coluna N resultante antes de confirmar
- Dois tempos explícitos e hierarquizados:
  - `⏱ Registro (SLA Total):` desde `inicio` do card
  - `⏱ Atendimento (Operação):` desde `tsFirstDispatch`

### 5.3 Firebase — Histórico de Despacho
```
/kanban/{eventoId}/historico/{pushKey}:
  { tipo: 'despacho'|'apoio'|'rendição'|'encerramento',
    equipe, vt, sub, ts, operador }

/kanban/{eventoId}/tsFirstDispatch: timestamp (imutável, gravado uma vez)
```
- **Array proibido** — usar push keys para evitar colisão multi-operador
- `tsFirstDispatch`: campo separado no nó raiz, nunca sobrescrito
- Migração graceful: cards sem `historico` usam campos legados (`equipe`, `viatura`, `sub`, `tsDespacho`)

### 5.4 Coluna N — Derivação do Histórico
```
Via Livre = recurso humano/viatura. NÃO é estado de via ou tráfego.

Algoritmo (percorrer historico por ts):
  despacho   → inicia segmento com tipo
  apoio      → adiciona ao segmento atual (operador: +)
  rendição   → fecha segmento, inicia novo
  encerramento → fecha segmento

Montar string: segmentos separados por ' → ', tipos por ' + '

Exemplos:
  [despacho VL]                    → "VIA LIVRE"
  [despacho VL, apoio AMC]         → "VIA LIVRE + AMC"
  [despacho VL, rendição VL]       → "VIA LIVRE → VIA LIVRE"
  [despacho VL, apoio AMC, rendição AMC] → "VIA LIVRE + AMC → AMC"
```
- Coluna N **nunca armazenada** — sempre derivada do histórico
- Planilha é **destino final** — append-only, nunca lida de volta

### 5.5 Rendição + NitViradaDia
Rendição no final de turno deve ser reconhecida por `NitViradaDia`.
A equipe que entrou na rendição pertence ao turno novo — herança entre plantões
deve preservar a equipe atual do histórico, não a equipe original do card.

---

## 6. Backend — Pendências

| # | Bug | Arquivo | Status |
|---|-----|---------|--------|
| 17 | Coluna O (Tempo Atendimento) sobrescrita | sheets_integration.py | PENDENTE |
| 18 | Observações deletadas ao normalizar | sheets_integration.py | PENDENTE |

**Plano de correção #17/#18:**
- Antes de escrever coluna O: verificar se célula já tem valor → só escreve uma vez
- Antes de escrever observações: ler valor atual → só sobrescreve se novo valor não for vazio
- Implementar idempotência por `eventoId`: verificar se linha existe antes de inserir

**Schema JSON de mapeamento (a implementar):**
```json
{ "sheet": "BancoFalhas", "key_column": "A", "fields": [
  { "firebase": "observacoes", "col": "K", "write": "if_not_empty" },
  { "firebase": "ts_norm",     "col": "O", "write": "once" }
]}
```

**Proteção Railway free tier:**
- Rate limiting: `slowapi` — máximo N requests/IP/minuto
- Circuit breaker no frontend: 3 falhas consecutivas → pausa 60s

---

## 7. Módulo Semáforo — Status

**CONCLUÍDO:** Firebase sync, renderização, despacho, apoio, observações,
tempos, relatório WhatsApp, normalização, busca, login, drag & drop,
virada de dia, herança entre plantões, layout responsivo.

**PENDENTE BACKEND:** Bug #17, Bug #18, schema de mapeamento, idempotência.

**PENDENTE FRONTEND:** Central da Ocorrência, histórico de despacho,
card passivo, rendição, tsFirstDispatch, coluna N derivada.

---

## 8. Prompt Universal

```
Você é fullstack sênior em JS, HTML, CSS, Firebase, Railway,
Google Sheets, Python e FastAPI.
Leia CONTEXT.md. Respeite as seções 3 (protegidas) e 5 (decisões fechadas).
Módulo Semáforo display está concluído — não refatore sem motivo claro.
Próximas implementações seguem a arquitetura da seção 5.
```
