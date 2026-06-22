# NIT — Contexto Técnico
**Última atualização: 22/06/2026**

---

## 1. O que é o NIT

**NIT (Núcleo Inteligente de Tráfego)** é uma plataforma de gestão operacional de trânsito que substituiu um processo manual de edição e reenvio de relatórios via WhatsApp. Surgiu como ferramenta individual e evoluiu para uma plataforma colaborativa em tempo real com Firebase, backend Python e integração com Google Sheets.

**Não é um sistema para técnicos de manutenção.** Foco: operação de trânsito enquanto o semáforo está quebrado.

**Visão de futuro:** tornar o NIT indispensável como núcleo de inteligência — integrando agentes, supervisores, técnicos e gestores com dados, dashboards, KPIs e automação de ponta.

---

## 2. Arquitetura

```
Relatório Bruto → Parser → Cards → Firebase → Backend → Planilha → Power BI
```

| Camada | Tecnologia | Local |
|--------|------------|-------|
| Frontend | Vanilla JS — GitHub Pages | `index.html` (~4200 linhas — monólito) |
| Backend | FastAPI + Python — Railway | `nit-backend` |
| Banco | Firebase Realtime Database | `nit-operacional` |
| Planilha | Google Sheets | ID: `192OVycIIw7kCmo7F3E-bafF6GGSNAYkOT-vgNb_i8jc` |
| Dashboard | Power BI | consome a planilha |

**Backend já implementado — não recriar:**
- `routes/export.py` — endpoint `/api/v1/exportar`
- `services/sheets_integration.py` — append, update, herança, coluna N
- Cron no Railway — exportação a cada 5 minutos
- Cursor no Firebase — `/meta/ultimaExportacao/{clienteId}`
- `append_heranca_diaria()` — nova linha por dia de plantão

---

## 3. Regras de Negócio (DEFINITIVAS)

### 3.1 Classificação statusFromSecao

```javascript
statusFromSecao(secao, card) {
    if (secao === 'NORMALIZADO') return 'NORMALIZADO';
    if (card.fim && card.fim.trim()) return 'NORMALIZADO';
    const end = (card.endereco || '').toLowerCase();
    const obs = (card.observacoes || '').toLowerCase();
    if (end.includes('pgv'))                          return 'SEM_NECESSIDADE';
    if (/\bentre\b/i.test(end))                       return 'SEM_NECESSIDADE';
    if (/\bpr[oó]x\.?\b/i.test(end))                 return 'SEM_NECESSIDADE';
    if (/veiculares?\s+funcionando/i.test(obs))       return 'SEM_NECESSIDADE';
    return 'PENDENTE';
}
```

> ⚠️ `includes('entre')` causa falso positivo em "PRESIDENTE" e "MONTEVERDE". Usar sempre `\bentre\b`.

### 3.2 Despacho — Coluna N da planilha

| Ação | Coluna do card | Valor na planilha |
|------|----------------|-------------------|
| Via Livre | `coluna-vl` | `VIA LIVRE` |
| AMC | `coluna-amc` | `AMC` |
| Sem despacho | `coluna-espera` | `PENDENTE` |

### 3.3 Emoji de status no relatório final

| totalAtivos | Emoji header | Emoji pendentes |
|-------------|--------------|-----------------|
| `=== 0` | `🟢🟢` | `✅` |
| `1–5` | `🟡🟡` | `⚠️` |
| `>= 6` | `🔴🔴` | `🚨` |

`totalAtivos` = espera + vl + amc + semNecessidade.

### 3.4 Herança entre dias (Opção 1 — múltiplas linhas)

- Frontend grava `ts_dataReferencia` quando `dataReferencia` muda
- Backend detecta e chama `append_heranca_diaria()` — nova linha por dia
- `DATA_INICIO` é imutável; `ID_OCORRENCIA` permanece o mesmo

### 3.5 Ordenação da coluna Normalizados

- Mais recente no topo, por `data_fim + hora_fim` convertidos para timestamp real (`_parseFim`)
- `localeCompare` não pode ser usado — formato `DD/MM/YYYY` não é ordenável lexicograficamente

---

## 4. Módulos principais (`index.html`)

| Módulo | Função | Status |
|--------|--------|--------|
| `NitFirebase` | Conexão Firebase | ✅ |
| `NitLogin` | Login operador (nome + turno) | ✅ |
| `NitData` | Helper `hoje()` — substituto do `NitDateFilter` removido | ✅ |
| `NitLogger` | Logging estruturado + replay | ✅ |
| `NitProcessamento` | Metadados do último processamento + guard `_verificado` | ✅ |
| `NitViradaDia` | Compatível com NitProcessamento, não restaura relatórios | ✅ |
| `Semaforo` | ❤️ Parser, herança, despacho, UI | ✅ (com bugs B2–B4) |
| `NitNormalizar` | Modal normalização com data/hora obrigatórios | ✅ |
| `NitCardDetails` | Modal detalhes do card | ✅ |
| `NitBuscaGlobal` | Busca global Ctrl+K | ✅ |
| `NitSidebar` | Sidebar colapsável | ✅ |
| `NitNormalizados` | Coluna normalizados colapsável | ✅ |
| `NitLazy` | Lazy render de cards | ✅ |

---

## 5. O que NÃO pode ser tocado

| Item | Motivo |
|------|--------|
| `_reprocessar()` | Lógica de herança — quebra se mexer |
| `_payloadFirebase()` | Estrutura dos dados no Firebase |
| `append_heranca_diaria()` | Backend — exportação para planilha |
| `statusFromSecao()` | Exceto adição de novos critérios documentados em 3.1 |
| Qualquer lógica com `ts_dataReferencia` | Gatilho da herança |
| `_montar_linha_nova()` | Backend — mapeamento para planilha |
| `export.py` | Backend — lógica de exportação |
| `sheets_integration.py` | Backend — integração Google Sheets |
| Cursor Firebase | `/meta/ultimaExportacao` — gerencia estado |

---

## 6. Estado atual — o que funciona e o que não funciona

### ✅ Funcionando
- Login, parser, despacho, herança cross-day
- Encerrar operação, despacho com apoio, VT opcional
- Relatório WhatsApp (exibe apenas VT, não equipe)
- Busca global (Ctrl+K) com aviso quando vazio
- Normalização com modal data/hora obrigatórios
- Ordenação de normalizados por timestamp real
- Firebase listener com child_added/changed/removed
- Integração Google Sheets via cron Railway
- Botão "Encerrar Operação" no modal correto
- `NitDateFilter` removido; `NitData.hoje()` preservado como helper

### 🔴 Bugs críticos ativos

| # | Bug | Localização |
|---|-----|-------------|
| B1 | Modal relatório com botões errados — "Copiar" e "Fechar" não funcionam | HTML `modal-relatorio` |
| B2 | Contadores mostram total geral em vez de cards do dia atual | `_atualizarPainelAgora()` |
| B3 | Cards de dias anteriores visíveis no Kanban — sem filtro visual | `atualizarPainel()` |
| B4 | Busca por coluna mostra cards de dias anteriores | `inicializarBuscasPorColuna()` |

### 🟡 Backend aguardando frontend

| # | Tarefa | Arquivo |
|---|--------|---------|
| 17 | Coluna O (Tempo de Atendimento) sobrescrita | `sheets_integration.py` |
| 18 | Observações deletadas ao normalizar | `sheets_integration.py` |

---

## 7. Próximos passos (ordem de execução)

### Fase 1 — Correções imediatas (frontend — conclui o frontend)

| Ordem | Tarefa |
|-------|--------|
| 1 | B1 — Corrigir modal-relatorio (botões Copiar/Fechar) |
| 2 | B2 — Contadores filtrar por `NitData.hoje()` |
| 3 | B3 — Filtro visual ocultar cards de dias anteriores |
| 4 | B4 — Busca por coluna filtrar por data |

### Fase 2 — Módulo pendente (frontend)

| Ordem | Tarefa |
|-------|--------|
| 5 | #33 — Modal despacho exibir informações do card (código, endereço, problema, início) |

### Fase 3 — Backend (inicia após frontend concluído)

| Ordem | Tarefa |
|-------|--------|
| 6 | #18 — Observações deletadas na planilha |
| 7 | #17 — Coluna O (Tempo de Atendimento) |
| 8 | #25 — Alinhar saídas Firebase / planilha / relatório |

### Fase 4 — Refatoração do monólito (primeira oportunidade viável)

O `index.html` é um monólito de ~4200 linhas. Toda correção deve ser cirúrgica até que seja viável aplicar a refatoração gradual: extrair CSS, remover `onclick` inline, separar módulos JS, eliminar `?.` e arrow functions para compatibilidade máxima.

---

## 8. Código de referência para as correções imediatas

### B1 — Modal relatório (HTML correto)

```html
<div id="modal-relatorio" class="modal-overlay">
    <div class="modal-container">
        <div class="modal-header">Relatório Semafórico</div>
        <div class="modal-body">
            <textarea id="modal-relatorio-texto" class="mono-font" readonly rows="15"
                style="width:100%;border:none;resize:none;background:var(--color-bg);color:var(--color-text-primary);font-size:13px;line-height:1.6;padding:8px;"></textarea>
        </div>
        <div class="modal-footer">
            <button id="btn-modal-copiar" class="btn btn-primario">Copiar</button>
            <button id="btn-modal-fechar" class="btn btn-secundario">Fechar</button>
        </div>
    </div>
</div>
```

### B2 — Contadores filtrados por data

Substituir o bloco de contadores em `_atualizarPainelAgora()`:

```javascript
const hoje = NitData.hoje();
const filtrarPorHoje = sel =>
    Array.from(document.querySelectorAll(sel))
         .filter(c => c.dataset.datareferencia === hoje).length;

const total = {
    espera:         filtrarPorHoje('#coluna-espera .kanban-card'),
    semNecessidade: filtrarPorHoje('#coluna-sem-necessidade .kanban-card'),
    vl:             filtrarPorHoje('#coluna-vl .kanban-card'),
    amc:            filtrarPorHoje('#coluna-amc .kanban-card'),
    normalizados:   Array.from(DOM.colunaNormalizados.querySelectorAll('.kanban-card'))
                        .filter(c => c.dataset.datareferencia === hoje).length,
};
```

### B3 — Filtro visual (adicionar ao final de `_atualizarPainelAgora()`)

```javascript
// Filtro visual — oculta cards de dias anteriores
const _hoje = NitData.hoje();
document.querySelectorAll('#tab-semaforo .kanban-card').forEach(c => {
    c.style.display = c.dataset.datareferencia === _hoje ? '' : 'none';
});
```

### B4 — Busca por coluna respeitando data

```javascript
function inicializarBuscasPorColuna() {
    document.querySelectorAll('.kanban-search').forEach(input => {
        const colunaId = input.dataset.coluna;
        if (!colunaId) return;
        input.addEventListener('input', () => {
            const q       = input.value.toLowerCase();
            const hoje    = NitData.hoje();
            const container = document.querySelector(`#${colunaId} .kanban-cards-container`);
            if (!container) return;
            container.querySelectorAll('.kanban-card').forEach(c => {
                if (c.dataset.datareferencia !== hoje) { c.style.display = 'none'; return; }
                const match = (c.dataset.codigo   || '').toLowerCase().includes(q)
                           || (c.dataset.endereco || '').toLowerCase().includes(q)
                           || (c.dataset.problema || '').toLowerCase().includes(q);
                c.style.display = match ? '' : 'none';
            });
        });
    });
}
```

---

## 9. Histórico de versões

| Data | O que mudou |
|------|-------------|
| 16/06 | Parser, observações, INVESTIGANDO/IMPROCEDENTE, NitProcessamento |
| 17/06 | Alerta 🚨, guard `_verificado`, CSS órfão, PRÓX., ordenação normalizados |
| 18/06 | Glassmorphism, card-fim, consolidação backlog |
| 19/06 | #19–#27, filtro data, virada do dia, login, remoção NitDateFilter |
| 20/06 | #22 busca global, #23 veiculares, #30 equipe opcional |
| 21/06 | #31 apoio múltiplo, #34 encerrar operação, #35 relatório só VT |
| 22/06 | Patch #27 aplicado (NitDateFilter removido, NitData criado) — aguardando validação B1–B4 |
