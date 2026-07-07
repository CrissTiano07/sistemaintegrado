/* ============================================================================
   NIT — Módulo Reboques  ·  reboques.js  ·  v2026.07.04
   ----------------------------------------------------------------------------
   Módulo isolado do sistema NIT (sistemaintegrado). Integra-se ao index.html
   existente como nova aba. NÃO toca em nit.js / nit.css e NÃO lê/escreve fora
   dos paths /reboques/* e /reboques_config/* no Firebase RTDB.

   API pública:
     NitReboques.inicializar(db)  → chamar dentro do onAuthStateChanged
     NitReboques.destruir()       → remove listeners Firebase (cleanup)
   ============================================================================ */
const NitReboques = (() => {
    'use strict';

    // ── Constantes ──────────────────────────────────────────────────────────
    const PATH_BASE        = 'reboques/plantao_ativo';
    const PATH_REBOQUISTAS = PATH_BASE + '/reboquistas';
    const PATH_EVENTOS     = PATH_BASE + '/eventos';
    const PATH_CONFIG      = 'reboques_config';

    // ── Estado interno ──────────────────────────────────────────────────────
    const S = {
        db:            null,
        inicializado:  false,
        uiBound:       false,
        reboquistas:   {},          // espelho local do snapshot Firebase
        eventos:       {},
        refs:          { reboquistas: null, eventos: null },
        draggedId:     null,        // id do card em arrasto
        isDragging:    false,       // adia re-render durante drag ativo
        pendingRender: false,
        multi:         { ids: [], travado: false },  // sessão de acionamento
        editandoEventoId: null,     // painel de acionamento em modo edição
    };

    // ── Cache de DOM ────────────────────────────────────────────────────────
    const D = {};
    const IDS = [
        'tab-reboques',
        'nit-reboque-bruto-input', 'nit-reboque-btn-processar',
        'nit-reboque-count-disponiveis', 'nit-reboque-count-atuando', 'nit-reboque-count-total',
        'nit-reboque-btn-adicionar', 'nit-reboque-btn-relatorio', 'nit-reboque-btn-limpar',
        'nit-reboques-disponiveis', 'nit-reboques-atuando',
        'nit-reboque-col-count-disponiveis', 'nit-reboque-col-count-atuando',
        'nit-reboques-eventos', 'nit-reboque-eventos-count',
        // painel de acionamento
        'nit-reboque-acionamento', 'nit-reboque-acion-titulo',
        'nit-reboque-acion-tags', 'nit-reboque-acion-dropzone',
        'nit-reboque-acion-tipo', 'nit-reboque-acion-endereco',
        'nit-reboque-acion-horario', 'nit-reboque-acion-obs',
        'nit-reboque-acion-btn-outro', 'nit-reboque-acion-btn-confirmar', 'nit-reboque-acion-btn-cancelar',
        // modal edição de reboquista
        'nit-reboque-modal-edicao', 'nit-reboque-edit-titulo', 'nit-reboque-edit-id',
        'nit-reboque-edit-nome', 'nit-reboque-edit-vt', 'nit-reboque-edit-placa',
        'nit-reboque-edit-plantao', 'nit-reboque-edit-smart',
        'nit-reboque-edit-btn-salvar', 'nit-reboque-edit-btn-cancelar',
        // modal relatório
        'nit-reboque-modal-relatorio', 'nit-reboque-relatorio-texto',
        'nit-reboque-relatorio-btn-copiar', 'nit-reboque-relatorio-btn-fechar',
    ];
    function _cacheDOM() {
        let ok = true;
        IDS.forEach(id => {
            const key = id.replace(/^nit-reboques?-?/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase()) || 'tab';
            D[key] = document.getElementById(id);
            if (!D[key]) { console.warn('[NitReboques] elemento ausente:', id); ok = false; }
        });
        D.tab = document.getElementById('tab-reboques');
        return ok;
    }

    // ── Utils ───────────────────────────────────────────────────────────────
    function esc(v) {
        return String(v ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function toast(msg, tipo) {
        if (typeof window.showToast === 'function') { window.showToast(msg, tipo); }
        else { console.log(`[NitReboques][${tipo || 'info'}] ${msg}`); }
    }
    function agoraHHMM() {
        return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    function hojeISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function hojeBR() {
        return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '.');
    }
    function novoId(prefixo) {
        return `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }
    function copiarTexto(texto) {
        const fallback = () => {
            try {
                const ta = document.createElement('textarea');
                ta.value = texto;
                ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                return ok;
            } catch (e) { return false; }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(texto).then(() => true).catch(() => fallback());
        }
        return Promise.resolve(fallback());
    }
    function maxOrdem(coll) {
        let m = -1;
        Object.values(coll || {}).forEach(r => { if (typeof r.ordem === 'number' && r.ordem > m) m = r.ordem; });
        return m;
    }

    // ── Init / Destroy ──────────────────────────────────────────────────────
    function inicializar(db) {
        if (S.inicializado) { console.warn('[NitReboques] já inicializado — ignorando.'); return; }
        if (!db) { console.error('[NitReboques] inicializar(db) requer firebase.database().'); return; }
        S.db = db;
        if (!_cacheDOM() && !D.tab) { console.error('[NitReboques] markup da aba não encontrado no index.html.'); return; }
        if (!S.uiBound) { _bindUI(); _bindTabsFallback(); S.uiBound = true; }
        _iniciarListeners();
        S.inicializado = true;
        console.log('[NitReboques] módulo inicializado.');
    }

    function destruir() {
        if (S.refs.reboquistas) S.refs.reboquistas.off();
        if (S.refs.eventos)     S.refs.eventos.off();
        S.refs = { reboquistas: null, eventos: null };
        S.inicializado = false;
    }

    // ── Firebase: listeners e render adiado ─────────────────────────────────
    function _iniciarListeners() {
        S.refs.reboquistas = S.db.ref(PATH_REBOQUISTAS);
        S.refs.eventos     = S.db.ref(PATH_EVENTOS);
        S.refs.reboquistas.on('value', snap => { S.reboquistas = snap.val() || {}; _render(); },
            err => { console.error('[NitReboques] listener reboquistas:', err); toast('Erro ao sincronizar reboquistas.', 'error'); });
        S.refs.eventos.on('value', snap => { S.eventos = snap.val() || {}; _render(); },
            err => { console.error('[NitReboques] listener eventos:', err); toast('Erro ao sincronizar eventos.', 'error'); });
    }

    function _render() {
        if (S.isDragging) { S.pendingRender = true; return; }
        _renderKanban();
        _renderEventos();
    }

    // ── Render: Kanban ──────────────────────────────────────────────────────
    function _ordenados(status) {
        return Object.entries(S.reboquistas)
            .filter(([, r]) => r && r.status === status)
            .sort((a, b) => (a[1].ordem ?? 0) - (b[1].ordem ?? 0) || String(a[1].nome).localeCompare(String(b[1].nome)));
    }

    function _cardReboquistaHTML(id, r) {
        const atuando  = r.status === 'atuando';
        const tagLabel = atuando ? 'Atuando' : 'Disponível';
        const ocorrenciaHTML = atuando && r.ocorrencia
            ? `<div class="nit-reboque-ocorrencia" title="${esc(r.ocorrencia)}"><i class="fas fa-info-circle"></i> ${esc(r.ocorrencia)}</div>`
            : '';
        const acaoPrincipal = atuando
            ? `<button class="nit-reboque-acao js-finalizar" title="Finalizar atendimento"><i class="fas fa-check-circle"></i></button>`
            : `<button class="nit-reboque-acao js-acionar" title="Acionar reboquista"><i class="fas fa-sign-out-alt"></i></button>`;
        return `
        <div class="nit-reboque-card" draggable="true" data-id="${esc(id)}" data-status="${esc(r.status)}">
            <div class="nit-reboque-card-header">
                <strong>${esc(r.nome || 'N/I')}</strong>
                <span class="nit-reboque-status-tag ${atuando ? 'atuando' : 'disponivel'}">${tagLabel}</span>
            </div>
            <div class="nit-reboque-card-info">
                <div class="nit-reboque-info-line"><i class="fas fa-truck"></i><span class="nit-reboque-mono">VT ${esc(r.vt || 'N/I')} · ${esc(r.placa || 'N/I')}</span></div>
                <div class="nit-reboque-info-line"><i class="far fa-clock"></i>Plantão até ${esc(r.plantao || 'N/I')}</div>
                <div class="nit-reboque-info-line"><i class="fas fa-mobile-alt"></i><span class="nit-reboque-mono">${esc(r.smart || 'N/I')}</span></div>
            </div>
            ${ocorrenciaHTML}
            <div class="nit-reboque-card-footer">
                <button class="nit-reboque-acao js-editar" title="Editar reboquista"><i class="fas fa-user-edit"></i></button>
                <button class="nit-reboque-acao js-remover" title="Remover reboquista"><i class="fas fa-trash-alt"></i></button>
                <span class="nit-reboque-spacer"></span>
                ${acaoPrincipal}
            </div>
        </div>`;
    }

    function _renderKanban() {
        const disp = _ordenados('disponivel');
        const atua = _ordenados('atuando');
        D.disponiveis.innerHTML = disp.length
            ? disp.map(([id, r]) => _cardReboquistaHTML(id, r)).join('')
            : `<div class="nit-reboque-vazio">Cole a lista do plantão para começar.</div>`;
        D.atuando.innerHTML = atua.length
            ? atua.map(([id, r]) => _cardReboquistaHTML(id, r)).join('')
            : `<div class="nit-reboque-vazio">Nenhum reboquista em atendimento.</div>`;
        D.colCountDisponiveis.textContent = disp.length;
        D.colCountAtuando.textContent    = atua.length;
        D.countDisponiveis.textContent   = disp.length;
        D.countAtuando.textContent       = atua.length;
        D.countTotal.textContent         = disp.length + atua.length;
    }

    // ── Render: Eventos ─────────────────────────────────────────────────────
    function _cardEventoHTML(id, ev) {
        const reboquistas = ev.reboquistas || {};
        const nomes = Object.entries(reboquistas);
        const tagsHTML = nomes.length
            ? nomes.map(([rid, nome]) => `<span class="nit-reboque-evento-tag">${esc(nome)}</span>`).join('')
            : `<span class="nit-reboque-evento-tag vazio">Arraste reboquistas aqui</span>`;
        return `
        <div class="nit-reboque-evento-card" data-evento-id="${esc(id)}">
            <div class="nit-reboque-evento-header">
                <strong>${esc(ev.tipo || 'EVENTO')}</strong>
                <span class="nit-reboque-evento-hora nit-reboque-mono">${esc(ev.criado || '')}</span>
            </div>
            <div class="nit-reboque-evento-body">
                <div class="nit-reboque-info-line"><i class="fas fa-map-marker-alt"></i>${esc(ev.endereco || '')}</div>
                ${ev.horario ? `<div class="nit-reboque-info-line"><i class="far fa-clock"></i>${esc(ev.horario)}</div>` : ''}
                ${ev.obs ? `<div class="nit-reboque-info-line"><i class="fas fa-comment-dots"></i>${esc(ev.obs)}</div>` : ''}
            </div>
            <div class="nit-reboque-evento-tags">${tagsHTML}</div>
            <div class="nit-reboque-card-footer">
                <button class="nit-reboque-acao js-ev-editar" title="Editar evento"><i class="fas fa-pencil-alt"></i></button>
                <button class="nit-reboque-acao js-ev-relatorio" title="Copiar relatório do evento"><i class="fab fa-whatsapp"></i></button>
                <span class="nit-reboque-spacer"></span>
                <button class="nit-reboque-acao js-ev-finalizar" title="Finalizar evento (libera reboquistas)"><i class="fas fa-check-circle"></i></button>
                <button class="nit-reboque-acao js-ev-remover" title="Cancelar evento"><i class="fas fa-ban"></i></button>
            </div>
        </div>`;
    }

    function _renderEventos() {
        const lista = Object.entries(S.eventos)
            .sort((a, b) => String(b[1].criadoTs || '').localeCompare(String(a[1].criadoTs || '')));
        D.eventos.innerHTML = lista.length
            ? lista.map(([id, ev]) => _cardEventoHTML(id, ev)).join('')
            : `<div class="nit-reboque-vazio">Nenhuma ocorrência em andamento.</div>`;
        D.eventosCount.textContent = lista.length;
    }

    // ── Parser do plantão (portado 1:1 da v10.0) ────────────────────────────
    function _extrairBloco(bloco) {
        const linhas = bloco.split('\n').map(l => l.trim()).filter(l => l !== '');
        if (linhas.length === 0) return null;
        if (!/VT|Plantão|Smart/i.test(bloco)) return null;

        const data = { nome: '', vt: 'N/I', placa: 'N/I', plantao: 'N/I', smart: 'N/I' };

        const linhaNome = linhas.find(linha => {
            const temVT           = /VT\s+\d+/i.test(linha);
            const temEmoji        = /🚨/.test(linha);
            const temPlantao      = /Plantão/i.test(linha);
            const temSmart        = /Smart/i.test(linha);
            const temVistoriador  = /VISTORIADOR/i.test(linha);
            const temAssumirHoras = /ASSUMIR.*HORAS/i.test(linha);
            return !temVT && !temEmoji && !temPlantao && !temSmart && !temVistoriador && !temAssumirHoras && linha.length > 2;
        });
        if (!linhaNome) return null;
        data.nome = linhaNome.trim().toUpperCase();

        linhas.forEach(linha => {
            const plantaoMatch = linha.match(/Plantão até\s+(?:às\s+)?([\d:]+\s*h?r?s?)/i);
            if (plantaoMatch) data.plantao = plantaoMatch[1].trim();

            const smartMatch = linha.match(/Smart:\s*\(?(\d{2})\)?\s*([\d\s.-]+)/i);
            if (smartMatch) data.smart = `(${smartMatch[1]}) ${smartMatch[2].trim()}`;

            const vtPlacaMatch = linha.match(/VT\s+([\w\d]+)\s*🚨?\s*([A-Z0-9]+)?/i);
            if (vtPlacaMatch) {
                data.vt    = vtPlacaMatch[1] ? vtPlacaMatch[1].trim() : 'N/I';
                data.placa = vtPlacaMatch[2] ? vtPlacaMatch[2].trim().replace(/\s/g, '') : 'N/I';
            }
        });
        return data;
    }

    function _nomeExiste(nome) {
        return Object.values(S.reboquistas).some(r => r && r.nome === nome);
    }

    function processarPlantao() {
        const bruto = D.brutoInput.value.trim();
        if (!bruto) { toast('Insira a lista de reboquistas para processar.', 'warning'); return; }

        const blocos = bruto.split(/\n\s*\n/).filter(b => b.trim() !== '');
        const updates = {};
        let ordem = maxOrdem(S.reboquistas);
        let novos = 0;

        blocos.forEach(bloco => {
            const dados = _extrairBloco(bloco);
            if (dados && dados.nome && !_nomeExiste(dados.nome)) {
                const id = novoId('reb');
                updates[`${PATH_REBOQUISTAS}/${id}`] = {
                    ...dados, status: 'disponivel', eventoId: '', ocorrencia: '', ordem: ++ordem,
                };
                S.reboquistas[id] = updates[`${PATH_REBOQUISTAS}/${id}`]; // dedupe intra-lote
                novos++;
            }
        });

        if (novos === 0) { toast('Nenhum novo reboquista encontrado ou já existem no painel.', 'info'); return; }

        updates[`${PATH_CONFIG}/data`] = hojeISO();
        S.db.ref().update(updates)
            .then(() => { toast(`${novos} reboquista(s) processado(s)!`, 'success'); D.brutoInput.value = ''; })
            .catch(err => { console.error(err); toast('Falha ao gravar no Firebase.', 'error'); });
    }

    // ── CRUD de reboquista ──────────────────────────────────────────────────
    function abrirEdicao(id) {
        S.editId = id || '';
        D.editTitulo.textContent = id ? 'Editar Reboquista' : 'Adicionar Reboquista';
        const r = id ? (S.reboquistas[id] || {}) : {};
        D.editId.value      = S.editId;
        D.editNome.value    = r.nome    || '';
        D.editVt.value      = r.vt      || '';
        D.editPlaca.value   = r.placa   || '';
        D.editPlantao.value = r.plantao || '';
        D.editSmart.value   = r.smart   || '';
        _abrirModal(D.modalEdicao);
        D.editNome.focus();
    }

    function salvarEdicao() {
        const id = D.editId.value;
        const dados = {
            nome:    D.editNome.value.trim().toUpperCase(),
            vt:      D.editVt.value.trim() || 'N/I',
            placa:   D.editPlaca.value.trim().toUpperCase() || 'N/I',
            plantao: D.editPlantao.value.trim() || 'N/I',
            smart:   D.editSmart.value.trim() || 'N/I',
        };
        if (!dados.nome) { toast('O nome do reboquista é obrigatório.', 'error'); return; }

        const updates = {};
        if (id && S.reboquistas[id]) {
            const nomeAntigo = S.reboquistas[id].nome;
            Object.entries(dados).forEach(([k, v]) => { updates[`${PATH_REBOQUISTAS}/${id}/${k}`] = v; });
            // renomeia o snapshot de nome dentro dos eventos vinculados
            if (nomeAntigo !== dados.nome) {
                Object.entries(S.eventos).forEach(([evId, ev]) => {
                    if (ev.reboquistas && ev.reboquistas[id]) {
                        updates[`${PATH_EVENTOS}/${evId}/reboquistas/${id}`] = dados.nome;
                    }
                });
            }
            toast('Dados do reboquista atualizados!', 'success');
        } else {
            if (_nomeExiste(dados.nome)) { toast('Um reboquista com este nome já existe.', 'error'); return; }
            const novo = novoId('reb');
            updates[`${PATH_REBOQUISTAS}/${novo}`] = {
                ...dados, status: 'disponivel', eventoId: '', ocorrencia: '', ordem: maxOrdem(S.reboquistas) + 1,
            };
            toast('Reboquista adicionado com sucesso!', 'success');
        }
        S.db.ref().update(updates).catch(err => { console.error(err); toast('Falha ao gravar no Firebase.', 'error'); });
        _fecharModal(D.modalEdicao);
    }

    function removerReboquista(id) {
        const r = S.reboquistas[id];
        if (!r) return;
        if (!confirm(`Tem certeza que deseja remover o reboquista ${r.nome}?`)) return;
        const updates = {};
        if (r.status === 'atuando' && r.eventoId) {
            updates[`${PATH_EVENTOS}/${r.eventoId}/reboquistas/${id}`] = null;
        }
        updates[`${PATH_REBOQUISTAS}/${id}`] = null;
        S.db.ref().update(updates)
            .then(() => toast('Reboquista removido.', 'success'))
            .catch(err => { console.error(err); toast('Falha ao remover.', 'error'); });
    }

    // ── Acionamento (painel lateral, suporta multi) ─────────────────────────
    function abrirAcionamento(id) {
        const r = S.reboquistas[id];
        if (!r) return;
        if (r.status === 'atuando') { toast(`${r.nome} já está em atendimento.`, 'error'); return; }

        // painel já aberto em modo acionamento → só adiciona à sessão
        if (_acionamentoAberto() && !S.editandoEventoId) { _adicionarAoAcionamento(id); return; }

        _resetAcionamento();
        S.multi.ids = [id];
        _renderTagsAcionamento();
        D.acionHorario.value = agoraHHMM();
        D.acionamento.classList.add('aberto');
        D.acionTipo.focus();
    }

    function _acionamentoAberto() { return D.acionamento.classList.contains('aberto'); }

    function _adicionarAoAcionamento(id) {
        const r = S.reboquistas[id];
        if (!r) return;
        if (r.status === 'atuando') { toast(`${r.nome} já está em atendimento.`, 'error'); return; }
        if (S.multi.ids.includes(id)) { toast(`${r.nome} já está neste acionamento.`, 'info'); return; }
        S.multi.ids.push(id);
        _renderTagsAcionamento();
        toast(`${r.nome} adicionado ao acionamento.`, 'info');
    }

    function _renderTagsAcionamento() {
        D.acionTags.innerHTML = S.multi.ids
            .map(id => {
                const r = S.reboquistas[id] || {};
                return `<span class="nit-reboque-evento-tag">${esc(r.nome || '?')}<button class="nit-reboque-tag-x" data-id="${esc(id)}" title="Remover do acionamento">&times;</button></span>`;
            })
            .join('') || `<span class="nit-reboque-evento-tag vazio">Arraste ou acione cards para incluir</span>`;
    }

    function _resetAcionamento() {
        S.multi = { ids: [], travado: false };
        S.editandoEventoId = null;
        D.acionTitulo.textContent = 'Acionamento de Reboque';
        D.acionTipo.value = ''; D.acionEndereco.value = ''; D.acionHorario.value = ''; D.acionObs.value = '';
        [D.acionTipo, D.acionEndereco, D.acionHorario, D.acionObs].forEach(el => el.disabled = false);
        D.acionDropzone.style.display = '';
        D.acionBtnOutro.style.display = '';
        D.acionBtnConfirmar.innerHTML = '<i class="fas fa-paper-plane"></i> Finalizar e Copiar';
        _renderTagsAcionamento();
    }

    function _lerEventoDoForm() {
        return {
            tipo:     D.acionTipo.value.trim().toUpperCase(),
            endereco: D.acionEndereco.value.trim().toUpperCase(),
            horario:  D.acionHorario.value.trim(),
            obs:      D.acionObs.value.trim(),
        };
    }

    function acionarOutro() {
        if (S.multi.ids.length === 0) { toast('Acione o primeiro reboquista antes de adicionar outros.', 'warning'); return; }
        const ev = _lerEventoDoForm();
        if (!ev.tipo || !ev.endereco) { toast('Tipo de Evento e Endereço são obrigatórios.', 'warning'); return; }
        S.multi.travado = true;
        [D.acionTipo, D.acionEndereco, D.acionHorario, D.acionObs].forEach(el => el.disabled = true);
        toast('Arraste outro reboquista para a área de tags ou finalize o acionamento.', 'info');
    }

    function confirmarAcionamento() {
        // modo edição de evento existente
        if (S.editandoEventoId) { _salvarEdicaoEvento(); return; }

        if (S.multi.ids.length === 0) { toast('Nenhum reboquista foi acionado.', 'error'); return; }
        const ev = _lerEventoDoForm();
        if (!ev.tipo || !ev.endereco) { toast('Tipo de Evento e Endereço são obrigatórios.', 'warning'); return; }

        const evId = novoId('evt');
        const ocorrencia = `${ev.tipo} @ ${ev.endereco}`;
        const snapshotNomes = {};
        S.multi.ids.forEach(id => { snapshotNomes[id] = (S.reboquistas[id] || {}).nome || '?'; });

        const updates = {};
        updates[`${PATH_EVENTOS}/${evId}`] = {
            ...ev, criado: agoraHHMM(), criadoTs: String(Date.now()), reboquistas: snapshotNomes,
        };
        let ordem = maxOrdem(S.reboquistas);
        S.multi.ids.forEach(id => {
            updates[`${PATH_REBOQUISTAS}/${id}/status`]     = 'atuando';
            updates[`${PATH_REBOQUISTAS}/${id}/eventoId`]   = evId;
            updates[`${PATH_REBOQUISTAS}/${id}/ocorrencia`] = ocorrencia;
            updates[`${PATH_REBOQUISTAS}/${id}/ordem`]      = ++ordem;
        });

        const nomes = Object.values(snapshotNomes).join(', ');
        let msg = `*${ev.tipo}* enviado para: *${nomes}*\n*Endereço:* ${ev.endereco}`;
        if (ev.horario) msg += `\n*Horário:* ${ev.horario}`;

        S.db.ref().update(updates)
            .then(() => copiarTexto(msg))
            .then(ok => toast(ok ? 'Acionamento registrado e mensagem copiada!' : 'Acionamento registrado (falha ao copiar).', ok ? 'success' : 'warning'))
            .catch(err => { console.error(err); toast('Falha ao gravar acionamento.', 'error'); });

        D.acionamento.classList.remove('aberto');
        _resetAcionamento();
    }

    // ── Edição de evento (reusa o painel de acionamento) ────────────────────
    function abrirEdicaoEvento(evId) {
        const ev = S.eventos[evId];
        if (!ev) return;
        _resetAcionamento();
        S.editandoEventoId = evId;
        D.acionTitulo.textContent = 'Editar Evento';
        D.acionTipo.value = ev.tipo || ''; D.acionEndereco.value = ev.endereco || '';
        D.acionHorario.value = ev.horario || ''; D.acionObs.value = ev.obs || '';
        D.acionDropzone.style.display = 'none';
        D.acionBtnOutro.style.display = 'none';
        D.acionBtnConfirmar.innerHTML = '<i class="fas fa-save"></i> Salvar Evento';
        D.acionamento.classList.add('aberto');
    }

    function _salvarEdicaoEvento() {
        const evId = S.editandoEventoId;
        const ev = _lerEventoDoForm();
        if (!ev.tipo || !ev.endereco) { toast('Tipo e Endereço não podem ser vazios.', 'error'); return; }
        const ocorrencia = `${ev.tipo} @ ${ev.endereco}`;
        const updates = {};
        updates[`${PATH_EVENTOS}/${evId}/tipo`]     = ev.tipo;
        updates[`${PATH_EVENTOS}/${evId}/endereco`] = ev.endereco;
        updates[`${PATH_EVENTOS}/${evId}/horario`]  = ev.horario;
        updates[`${PATH_EVENTOS}/${evId}/obs`]      = ev.obs;
        Object.entries(S.reboquistas).forEach(([rid, r]) => {
            if (r && r.eventoId === evId) updates[`${PATH_REBOQUISTAS}/${rid}/ocorrencia`] = ocorrencia;
        });
        S.db.ref().update(updates)
            .then(() => toast('Evento atualizado!', 'success'))
            .catch(err => { console.error(err); toast('Falha ao salvar evento.', 'error'); });
        D.acionamento.classList.remove('aberto');
        _resetAcionamento();
    }

    // ── Finalizações e alocação ─────────────────────────────────────────────
    function finalizarAtendimento(id) {
        const r = S.reboquistas[id];
        if (!r) return;
        const updates = {};
        if (r.eventoId) updates[`${PATH_EVENTOS}/${r.eventoId}/reboquistas/${id}`] = null;
        updates[`${PATH_REBOQUISTAS}/${id}/status`]     = 'disponivel';
        updates[`${PATH_REBOQUISTAS}/${id}/eventoId`]   = '';
        updates[`${PATH_REBOQUISTAS}/${id}/ocorrencia`] = '';
        updates[`${PATH_REBOQUISTAS}/${id}/ordem`]      = maxOrdem(S.reboquistas) + 1;
        S.db.ref().update(updates)
            .then(() => toast(`${r.nome} está disponível.`, 'info'))
            .catch(err => { console.error(err); toast('Falha ao finalizar atendimento.', 'error'); });
    }

    function _liberarVinculados(evId, updates) {
        Object.entries(S.reboquistas).forEach(([rid, r]) => {
            if (r && r.eventoId === evId) {
                updates[`${PATH_REBOQUISTAS}/${rid}/status`]     = 'disponivel';
                updates[`${PATH_REBOQUISTAS}/${rid}/eventoId`]   = '';
                updates[`${PATH_REBOQUISTAS}/${rid}/ocorrencia`] = '';
            }
        });
    }

    function finalizarEvento(evId) {
        const ev = S.eventos[evId];
        if (!ev) return;
        const updates = {};
        _liberarVinculados(evId, updates);
        updates[`${PATH_EVENTOS}/${evId}`] = null;
        S.db.ref().update(updates)
            .then(() => toast(`Evento ${ev.tipo} finalizado — reboquistas liberados.`, 'success'))
            .catch(err => { console.error(err); toast('Falha ao finalizar evento.', 'error'); });
    }

    function removerEvento(evId) {
        const ev = S.eventos[evId];
        if (!ev) return;
        if (!confirm(`Cancelar o evento ${ev.tipo} @ ${ev.endereco}?`)) return;
        const updates = {};
        _liberarVinculados(evId, updates);
        updates[`${PATH_EVENTOS}/${evId}`] = null;
        S.db.ref().update(updates)
            .then(() => toast('Evento cancelado.', 'success'))
            .catch(err => { console.error(err); toast('Falha ao cancelar evento.', 'error'); });
    }

    function _alocarAoEvento(rebId, evId) {
        const r = S.reboquistas[rebId];
        const ev = S.eventos[evId];
        if (!r || !ev) return;
        if (r.eventoId === evId) { toast(`${r.nome} já está neste evento.`, 'info'); return; }
        const updates = {};
        if (r.eventoId) updates[`${PATH_EVENTOS}/${r.eventoId}/reboquistas/${rebId}`] = null;
        updates[`${PATH_EVENTOS}/${evId}/reboquistas/${rebId}`] = r.nome;
        updates[`${PATH_REBOQUISTAS}/${rebId}/status`]     = 'atuando';
        updates[`${PATH_REBOQUISTAS}/${rebId}/eventoId`]   = evId;
        updates[`${PATH_REBOQUISTAS}/${rebId}/ocorrencia`] = `${ev.tipo} @ ${ev.endereco}`;
        S.db.ref().update(updates)
            .then(() => toast(`${r.nome} alocado a ${ev.tipo}.`, 'success'))
            .catch(err => { console.error(err); toast('Falha ao alocar reboquista.', 'error'); });
    }

    // ── Relatórios ──────────────────────────────────────────────────────────
    function copiarRelatorioEvento(evId) {
        const ev = S.eventos[evId];
        if (!ev) return;
        let txt = `*${ev.tipo}*\n*Endereço:* ${ev.endereco}`;
        if (ev.horario) txt += `\n*Horário:* ${ev.horario}`;
        if (ev.obs)     txt += `\n*Obs:* ${ev.obs}`;
        const nomes = Object.entries(ev.reboquistas || {});
        if (nomes.length) {
            txt += `\n\n*Reboquistas acionados:*`;
            nomes.forEach(([rid, nome]) => {
                const r = S.reboquistas[rid] || {};
                txt += `\n- ${nome} (VT: ${r.vt || 'N/I'})`;
            });
        }
        copiarTexto(txt).then(ok => toast(ok ? 'Relatório do evento copiado!' : 'Falha ao copiar.', ok ? 'success' : 'error'));
    }

    function gerarRelatorioFrota() {
        const disp = _ordenados('disponivel');
        const atua = _ordenados('atuando');
        let texto = `*RELATÓRIO DE STATUS DA FROTA DE REBOQUES*\n*Data:* ${hojeBR()}\n\n`;
        texto += `*Resumo da Frota:*\n`
               + `- 🟢 *Disponíveis:* ${disp.length}\n`
               + `- 🟡 *Em Atendimento:* ${atua.length}\n`
               + `- 🚛 *Total:* ${disp.length + atua.length}\n\n`;

        if (atua.length > 0) {
            const grupos = {};
            atua.forEach(([id, r]) => {
                const ev = r.eventoId ? S.eventos[r.eventoId] : null;
                const titulo = ev ? `${ev.tipo} @ ${ev.endereco}`
                                  : (r.ocorrencia || 'EVENTO NÃO ESPECIFICADO');
                (grupos[titulo] = grupos[titulo] || []).push(r);
            });
            texto += `---\n\n🟡 *OCORRÊNCIAS EM ATENDIMENTO (${Object.keys(grupos).length}):*\n\n`;
            Object.entries(grupos).forEach(([titulo, lista]) => {
                texto += `*${titulo}*\n`;
                lista.forEach(r => {
                    texto += `- *Reboquista:* ${r.nome} (VT: ${r.vt || 'N/I'})\n`
                           + `- *Contato:* ${r.smart || 'N/I'}\n\n`;
                });
            });
        } else {
            texto += `---\n\n*Todos os reboquistas estão disponíveis.*`;
        }

        D.relatorioTexto.value = texto.trim();
        _abrirModal(D.modalRelatorio);
    }

    // ── Limpar plantão ──────────────────────────────────────────────────────
    function limparPlantao() {
        if (!confirm('Tem certeza que deseja limpar TODOS os dados de Reboques e Eventos deste plantão?')) return;
        S.db.ref(PATH_BASE).remove()
            .then(() => toast('Painel de reboques e eventos limpo!', 'success'))
            .catch(err => { console.error(err); toast('Falha ao limpar plantão.', 'error'); });
    }

    // ── Modais ──────────────────────────────────────────────────────────────
    function _abrirModal(el)  { el.classList.add('aberto'); }
    function _fecharModal(el) { el.classList.remove('aberto'); }

    // ── Drag-and-drop ───────────────────────────────────────────────────────
    function _onDragStart(e) {
        const card = e.target.closest('.nit-reboque-card');
        if (!card) return;
        S.draggedId = card.dataset.id;
        S.isDragging = true;
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', S.draggedId); } catch (_) {}
        setTimeout(() => card.classList.add('arrastando'), 0);
    }

    function _onDragEnd() {
        S.isDragging = false;
        S.draggedId = null;
        document.querySelectorAll('.nit-reboque-card.arrastando').forEach(c => c.classList.remove('arrastando'));
        document.querySelectorAll('.nit-reboque-dropzone-ativa').forEach(c => c.classList.remove('nit-reboque-dropzone-ativa'));
        if (S.pendingRender) { S.pendingRender = false; _render(); }
    }

    function _onDragOver(e) {
        const alvo = e.target.closest('#nit-reboques-disponiveis, #nit-reboques-atuando, .nit-reboque-evento-card, #nit-reboque-acion-dropzone');
        if (!alvo) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        alvo.classList.add('nit-reboque-dropzone-ativa');
    }

    function _onDragLeave(e) {
        const alvo = e.target.closest('#nit-reboques-disponiveis, #nit-reboques-atuando, .nit-reboque-evento-card, #nit-reboque-acion-dropzone');
        if (alvo) alvo.classList.remove('nit-reboque-dropzone-ativa');
    }

    function _ordemNaPosicao(container, y, status) {
        // calcula ordem fracionária entre os vizinhos do ponto de soltura
        const cards = [...container.querySelectorAll('.nit-reboque-card:not(.arrastando)')];
        let anterior = null, proximo = null;
        for (const c of cards) {
            const box = c.getBoundingClientRect();
            if (y < box.top + box.height / 2) { proximo = c; break; }
            anterior = c;
        }
        const ord = el => (S.reboquistas[el.dataset.id] || {}).ordem ?? 0;
        if (!anterior && !proximo) return maxOrdem(S.reboquistas) + 1;
        if (!anterior) return ord(proximo) - 1;
        if (!proximo)  return ord(anterior) + 1;
        return (ord(anterior) + ord(proximo)) / 2;
    }

    function _onDrop(e) {
        const id = S.draggedId;
        if (!id || !S.reboquistas[id]) return;
        e.preventDefault();
        const r = S.reboquistas[id];

        const dzAcionamento = e.target.closest('#nit-reboque-acion-dropzone');
        const eventoCard    = e.target.closest('.nit-reboque-evento-card');
        const colDisp       = e.target.closest('#nit-reboques-disponiveis');
        const colAtua       = e.target.closest('#nit-reboques-atuando');

        if (dzAcionamento && _acionamentoAberto() && !S.editandoEventoId) {
            _adicionarAoAcionamento(id);
            return;
        }
        if (eventoCard) {
            _alocarAoEvento(id, eventoCard.dataset.eventoId);
            return;
        }
        if (colDisp) {
            if (r.status === 'atuando') { finalizarAtendimento(id); return; }
            // reordenação dentro da coluna
            const ordem = _ordemNaPosicao(colDisp, e.clientY, 'disponivel');
            S.reboquistas[id].ordem = ordem;           // otimista
            _renderKanban();
            S.db.ref(`${PATH_REBOQUISTAS}/${id}/ordem`).set(ordem)
                .catch(err => console.error('[NitReboques] ordem:', err));
            return;
        }
        if (colAtua) {
            if (r.status === 'disponivel') { abrirAcionamento(id); return; }  // atuar exige evento
            const ordem = _ordemNaPosicao(colAtua, e.clientY, 'atuando');
            S.reboquistas[id].ordem = ordem;
            _renderKanban();
            S.db.ref(`${PATH_REBOQUISTAS}/${id}/ordem`).set(ordem)
                .catch(err => console.error('[NitReboques] ordem:', err));
        }
    }

    // ── Bind de UI (event delegation) ───────────────────────────────────────
    function _bindUI() {
        D.btnProcessar.addEventListener('click', processarPlantao);
        D.btnAdicionar.addEventListener('click', () => abrirEdicao(null));
        D.btnRelatorio.addEventListener('click', gerarRelatorioFrota);
        D.btnLimpar.addEventListener('click', limparPlantao);

        // painel de acionamento
        D.acionBtnOutro.addEventListener('click', acionarOutro);
        D.acionBtnConfirmar.addEventListener('click', confirmarAcionamento);
        D.acionBtnCancelar.addEventListener('click', () => { D.acionamento.classList.remove('aberto'); _resetAcionamento(); });
        D.acionTags.addEventListener('click', e => {
            const x = e.target.closest('.nit-reboque-tag-x');
            if (!x) return;
            S.multi.ids = S.multi.ids.filter(i => i !== x.dataset.id);
            _renderTagsAcionamento();
        });

        // modal edição de reboquista
        D.editBtnSalvar.addEventListener('click', salvarEdicao);
        D.editBtnCancelar.addEventListener('click', () => _fecharModal(D.modalEdicao));
        D.modalEdicao.addEventListener('click', e => { if (e.target === D.modalEdicao) _fecharModal(D.modalEdicao); });

        // modal relatório
        D.relatorioBtnCopiar.addEventListener('click', () => {
            copiarTexto(D.relatorioTexto.value).then(ok => toast(ok ? 'Relatório copiado!' : 'Falha ao copiar.', ok ? 'success' : 'error'));
        });
        D.relatorioBtnFechar.addEventListener('click', () => _fecharModal(D.modalRelatorio));
        D.modalRelatorio.addEventListener('click', e => { if (e.target === D.modalRelatorio) _fecharModal(D.modalRelatorio); });

        // ESC fecha modais e painel de acionamento
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape' || !S.inicializado) return;
            _fecharModal(D.modalEdicao);
            _fecharModal(D.modalRelatorio);
            if (_acionamentoAberto()) { D.acionamento.classList.remove('aberto'); _resetAcionamento(); }
        });

        // delegation nos cards do kanban
        D.tab.addEventListener('click', e => {
            const card = e.target.closest('.nit-reboque-card');
            if (card) {
                const id = card.dataset.id;
                if (e.target.closest('.js-acionar'))        { abrirAcionamento(id); return; }
                if (e.target.closest('.js-finalizar'))      { finalizarAtendimento(id); return; }
                if (e.target.closest('.js-editar'))         { abrirEdicao(id); return; }
                if (e.target.closest('.js-remover'))        { removerReboquista(id); return; }
            }
            const evCard = e.target.closest('.nit-reboque-evento-card');
            if (evCard) {
                const evId = evCard.dataset.eventoId;
                if (e.target.closest('.js-ev-editar'))      { abrirEdicaoEvento(evId); return; }
                if (e.target.closest('.js-ev-relatorio'))   { copiarRelatorioEvento(evId); return; }
                if (e.target.closest('.js-ev-finalizar'))   { finalizarEvento(evId); return; }
                if (e.target.closest('.js-ev-remover'))     { removerEvento(evId); return; }
            }
        });

        // drag-and-drop (delegation na aba inteira + painel de acionamento)
        D.tab.addEventListener('dragstart', _onDragStart);
        D.tab.addEventListener('dragend',   _onDragEnd);
        D.tab.addEventListener('dragover',  _onDragOver);
        D.tab.addEventListener('dragleave', _onDragLeave);
        D.tab.addEventListener('drop',      _onDrop);
    }

    // ── Fallback do mecanismo de abas ───────────────────────────────────────
    // O sistema atual (v13.0) tem apenas a aba Semáforo. Este handler delegado é
    // idempotente: se o nit.js também tratar o clique nas .tab-button, as duas
    // rotinas aplicam o mesmo estado final (classes .active), sem conflito.
    function _bindTabsFallback() {
        const nav = document.querySelector('.tab-navigation');
        if (!nav) return;
        nav.addEventListener('click', e => {
            const btn = e.target.closest('.tab-button[data-tab]');
            if (!btn) return;
            const alvo = document.getElementById(btn.dataset.tab);
            if (!alvo) return;
            document.querySelectorAll('.tab-button[data-tab]').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t === alvo));
        });
    }

    // ── Bootstrap automático ────────────────────────────────────────────────
    // Zero edição de JS no index.html / nit.js: o módulo registra o SEU PRÓPRIO
    // onAuthStateChanged (múltiplos observers são suportados pelo Firebase) e
    // aguarda a inicialização do app feita no <head> (handler de DOMContentLoaded).
    function _bootstrap() {
        let tentativas = 0;
        const esperarFirebase = () => {
            const fb = window.firebase;
            if (fb && fb.apps && fb.apps.length) {
                fb.auth().onAuthStateChanged(user => {
                    if (user) inicializar(fb.database());
                    else destruir();
                });
                return;
            }
            if (++tentativas > 100) { console.error('[NitReboques] Firebase não inicializou — módulo inativo.'); return; }
            setTimeout(esperarFirebase, 200);
        };
        esperarFirebase();
    }
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', _bootstrap);
    } else {
        _bootstrap();
    }

    // ── API pública ─────────────────────────────────────────────────────────
    return { inicializar, destruir };
})();
