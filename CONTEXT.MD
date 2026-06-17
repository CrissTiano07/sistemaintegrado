# NIT — Contexto Técnico (Última atualização: 16/06/2026)

extrairDadosDaLinha — Extração de Observações (CORRETO)

// Versão corrigida — captura observações mesmo sem "Obs:" explícito
// Usa fallback robusto e descarta conteúdo sem valor semântico
// Localização: index.html → Semaforo.extrairDadosDaLinha()


## 📌 1. O que é o NIT

Sistema de **gestão operacional de trânsito** para agentes que operam cruzamentos com semáforos inoperantes.

**Público-alvo:** Agentes de trânsito, supervisores e operadores de central.  
**Não é para técnicos de manutenção semafórica.**

---

## 🏗️ 2. Arquitetura

### Fluxo de Dados
Relatório Bruto → Parser → Cards → Firebase → Backend → Planilha → Power BI


| Camada | Tecnologia | Repositório / Local |
|--------|------------|---------------------|
| **Frontend** | Vanilla JS (GitHub Pages) | `index.html` |
| **Backend** | FastAPI (Python) no Railway | `nit-backend` |
| **Banco** | Firebase Realtime Database | `nit-operacional` |
| **Planilha** | Google Sheets | ID: `192OVycIIw7kCmo7F3E-bafF6GGSNAYkOT-vgNb_i8jc` |
| **Dashboard** | Power BI (consome a planilha) | — |

### Backend (já implementado — NÃO criar do zero)

| Componente | Arquivo | Função | Status |
|------------|---------|--------|--------|
| Exportação | `routes/export.py` | Endpoint `/api/v1/exportar` + lógica de exportação | ✅ Implementado |
| Integração Sheets | `services/sheets_integration.py` | Append, update, herança, coluna N | ✅ Implementado |
| Cron | Railway | Executa exportação a cada 5 minutos | ✅ Configurado |
| Cursor | Firebase | `/meta/ultimaExportacao/{clienteId}` | ✅ Implementado |
| Herança | `append_heranca_diaria()` | Nova linha por dia de plantão | ✅ Implementado |

**O que o backend JÁ FAZ:**
- ✅ Exporta novas ocorrências (append)
- ✅ Atualiza normalizados (update)
- ✅ Herança entre dias (`ts_dataReferencia` → `append_heranca_diaria`)
- ✅ Despacho (coluna N)

**O que NÃO precisa ser criado:**
- ❌ Novo endpoint `/api/v1/exportar` (já existe)
- ❌ Novo worker `cron_export.py` (já existe)
- ❌ Nova Service Account (já configurada)

---

## 🧠 3. Regras de Negócio (DEFINITIVAS)

### 3.1 Classificação: SEM_NECESSIDADE

| Critério | Condição | Prioridade |
|----------|----------|------------|
| **PGV** | `endereco.includes('pgv')` | 1 |
| **Entre** | `/\bentre\b/i.test(endereco)` | 1 |

> ⚠️ Observações como "Investigando" ou "Aguardando" **não alteram** esta classificação.  
> ⚠️ A regra **não pode** ser `includes('entre')` — isso gera falso positivo em "PRESIDENTE" e "MONTEVERDE". Use `\bentre\b`.

### 3.2 Classificação: NORMALIZADO

| Critério | Condição | Prioridade |
|----------|----------|------------|
| **Seção do relatório** | `secao === 'NORMALIZADO'` | 1 |
| **Campo Fim preenchido** | `card.fim && card.fim.trim()` | 2 |

### 3.3 Classificação: PENDENTE

Qualquer ocorrência que não se encaixe em SEM_NECESSIDADE ou NORMALIZADO.

### 3.4 Herança (Opção 1 — múltiplas linhas)

- `ts_dataReferencia` é gravado no Firebase
- Backend detecta e chama `append_heranca_diaria()`
- **Nova linha** na planilha por dia de plantão
- `DATA_INICIO` permanece imutável
- `ID_OCORRENCIA` permanece o mesmo

### 3.5 Despacho (Coluna N — OPERANDO_CRUZAMENTO)

| Ação | Coluna do Card | Valor na planilha (coluna N) |
|------|----------------|------------------------------|
| Despachar Via Livre | `coluna-vl` | `VIA LIVRE` |
| Despachar AMC | `coluna-amc` | `AMC` |
| Sem despacho | `coluna-espera` | `PENDENTE` |

---

## 📂 4. Módulos Principais (`index.html`)

| Módulo | Função | Localização no arquivo | Status |
|--------|--------|------------------------|--------|
| `NitFirebase` | Conexão e operações com Firebase | Início do script | ✅ |
| `NitLogin` | Login do operador (nome + turno) | Após NitFirebase | ✅ |
| `NitDateFilter` | Filtro de data no Kanban | Após NitLogin | ✅ |
| `NitLogger` | Logging estruturado + replay | Antes de Semaforo | ✅ |
| `NitProcessamento` | Metadados do último processamento + verificação de turno | Antes de Semaforo | ✅ |
| `NitViradaDia` | Versão compatível com NitProcessamento (não restaura relatórios) | Antes de Semaforo | ✅ |
| `Semaforo` | ❤️ CORAÇÃO DO SISTEMA — parser, herança, despacho, UI | Central | ✅ |
| `NitNormalizar` | Modal de normalização com data/hora | Após Semaforo | ✅ |
| `NitCardDetails` | Modal de detalhes do card | Após Semaforo | ✅ |
| `NitBuscaGlobal` | Busca global (Ctrl+K) | Após Semaforo | ✅ |
| `NitSidebar` | Sidebar colapsável | Após Semaforo | ✅ |
| `NitNormalizados` | Coluna normalizados colapsável | Após Semaforo | ✅ |
| `NitLazy` | Lazy render de cards | Após Semaforo | ✅ |
---

## 🔒 5. O que NÃO PODE SER TOCADO (SEGURANÇA)

### ❌ Proibido alterar:

| Item | Motivo |
|------|--------|
| `_reprocessar()` | Lógica de herança — quebra se mexer |
| `append_heranca_diaria()` | Backend — exportação para planilha |
| `statusFromSecao()` | **Exceto correção de `entre` para `\bentre\b`** |
| Qualquer lógica com `ts_dataReferencia` | Gatilho da herança |
| `_payloadFirebase()` | Estrutura dos dados no Firebase |
| `_montar_linha_nova()` | Backend — mapeamento para planilha |
| `export.py` | Backend — lógica de exportação |
| `sheets_integration.py` | Backend — integração com Google Sheets |
| Cursor no Firebase | `/meta/ultimaExportacao` — gerencia estado |

### ✅ Permitido:

- Adicionar novos módulos
- Modificar UI (CSS, modais)
- Melhorar logging
- Adicionar validações



---

## 📋 6. Entregas Pendentes (prioridade)

| # | Tarefa | Descrição | Status |
|---|--------|-----------|--------|
| 1 | **Corrigir `includes('entre')`** | Substituir por `\bentre\b` em `statusFromSecao` | ✅ FEITO |
| 2 | **Corrigir INVESTIGANDO no relatório** | Mapear `INVESTIGANDO` → `INVESTIGANDO` (não `INVEST`) | ✅ FEITO |
| 3 | **Corrigir IMPROCEDENTE no relatório** | Mapear `IMPROCEDENTE` → `IMPROCEDENTE` (não `IMPROC`) | ✅ FEITO |
| 4 | **Observações vazias** | Revisar `_fraseTecnica()` e `criarElementoCard()` | ✅ FEITO |
| 5 | **NitUltimoProcessamento** | Registrar metadados do último processamento no Firebase | ✅ FEITO |
| 6 | **Modal de verificação** | Exibir modal com info do último processamento | ✅ FEITO |
| 7 | **Botões do modal** | "Processar pendente" e "Já verifiquei" | ✅ FEITO |


## 🧪 7. Como Testar

### Teste 1 — Login
1. Acesse a página
2. Preencha Nome e Turno
3. Clique em Entrar → deve liberar acesso

### Teste 2 — Processar Relatório
1. Cole um relatório bruto na textarea
2. Clique em Processar
3. Verifique se os cards foram criados nas colunas corretas

### Teste 3 — Despacho
1. Clique no ícone de avião em um card
2. Preencha Equipe e Viatura
3. Confirme o despacho
4. Verifique a coluna N na planilha

### Teste 4 — Herança (virada de dia)
1. Processe um relatório com data de ontem
2. Simule a virada (ou mude a data do sistema)
3. Loge novamente
4. Verifique se o modal de virada aparece

---


## 📌 8. Código de Referência

### statusFromSecao (CORRETO)

```javascript
statusFromSecao(secao, card) {
    if (secao === 'NORMALIZADO') return 'NORMALIZADO';
    if (card.fim && card.fim.trim()) return 'NORMALIZADO';
    const end = (card.endereco || '').toLowerCase();
    if (end.includes('pgv')) return 'SEM_NECESSIDADE';
    if (/\bentre\b/i.test(end)) return 'SEM_NECESSIDADE';
    return 'PENDENTE';
}



9. Prompt Universal para Assistente
"Leia o arquivo CONTEXT.md na raiz do repositório. Ele contém o contexto completo do sistema NIT.

Identifique a próxima tarefa pendente na seção 6. Respeite as regras de segurança da seção 5.

Implemente a solução, seguindo o padrão do código existente.

Entregue:
1. Código modificado
2. Instruções de onde colocar
3. Como testar

Se tiver dúvida, consulte o contexto primeiro. Se precisar de mais informações, me pergunte."

📅 10. Últimas Atualizações
| Data | O que mudou |
|------|-------------|
| 16/06/2026 | Corrigido `includes('entre')` → `\bentre\b` |
| 16/06/2026 | Versão estável restaurada (login funcionando) |
| 16/06/2026 | Criado este `CONTEXT.md` para gestão de conhecimento |
| 16/06/2026 | Corrigido relatório final: `INVESTIGANDO` e `IMPROCEDENTE` completos |
| 16/06/2026 | Implementado `NitProcessamento` com modal de verificação de turno |
| 16/06/2026 | Substituído `NitViradaDia` antigo pela versão compatível com `NitProcessamento` |
| 16/06/2026 | Corrigido parser: observações vazias (fallback para `Obs:` explícito + guardas multiline) |

---


## 🐛 12. Problemas Conhecidos (RESOLVIDOS)

### 12.1 ✅ Observações Vazias no Kanban — RESOLVIDO
**Sintoma:** Ao processar relatórios, a maioria dos cards ficava com observação vazia, mesmo quando o relatório continha "Obs:" ou "Observação:".

**Causa:** O regex `_obsMatch` falhava quando não havia `Obs:` explícito, e o fallback removia datas mas podia ficar vazio.

**Solução:** 
1. Melhorado o `extrairDadosDaLinha()` para capturar `Obs:` com variações (`*Obs:`, `Obs.`, `Obs*`)
2. Fallback aprimorado para remover datas e descartar conteúdo sem valor semântico
3. Adicionada guarda em `_parsearRelatorio()` para ignorar metadados de plantão (`PLANTONISTA`, `PLANTÃO`, `TÉCNICOS`, `CEMOB`)

**Status:** ✅ RESOLVIDO em 16/06/2026

### 12.2 ✅ Observações com Quebra de Linha — RESOLVIDO
**Sintoma:** Observações que ocupavam múltiplas linhas no relatório bruto não eram capturadas completamente.

**Causa:** O acúmulo de linhas já funcionava, mas capturava metadados do plantão.

**Solução:** Adicionada guarda no `_parsearRelatorio()` para ignorar linhas com `PLANTONISTA`, `PLANTÃO`, `TÉCNICOS`, `CEMOB`.

**Status:** ✅ RESOLVIDO em 16/06/2026

### 12.3 ✅ Relatório Final com Texto Cortado — RESOLVIDO
**Sintoma:** No relatório final, `INVESTIGANDO` aparecia como `INVEST` e `IMPROCEDENTE` como `IMPROC`.

**Solução:** Substituído o mapeamento no `gerarPreviewRelatorio()` para usar mapa explícito com os nomes completos.

**Status:** ✅ RESOLVIDO em 16/06/2026

--------------------------------


### 1. Salve o arquivo

```bash
# No seu repositório local
cd ~/caminho/para/sistemaintegrado
touch CONTEXT.md
# Cole o conteúdo acima
git add CONTEXT.md
git commit -m "docs: adiciona CONTEXT.md para gestão de conhecimento"
git push origin main
2. Use o prompt universal
Agora, sempre que chamar um assistente, use:

"Leia o arquivo CONTEXT.md na raiz do repositório. Ele contém o contexto completo do sistema NIT. Identifique a próxima tarefa pendente e implemente."

3. Mantenha atualizado
Após cada implementação, atualize:

Data na seção 1

Status na seção 6

Seção 10 com o que foi feito

