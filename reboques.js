/* ============================================================================
   NIT — Módulo Reboques  ·  reboques.js  ·  v2026.07.08
   Recursos: Viaturas (VIA LIVRE) + Reboquistas (REBOQUES) + Ocorrências
   ============================================================================ */
const NitReboques = (() => {
    'use strict';

    const PATH_BASE        = 'reboques/plantao_ativo';
    const PATH_REBOQUISTAS = PATH_BASE + '/reboquistas';
    const PATH_VIATURAS    = PATH_BASE + '/viaturas';
    const PATH_EVENTOS     = PATH_BASE + '/eventos';
    const PATH_CONFIG      = 'reboques_config';

    const S = {
        db: null, inicializado: false, uiBound: false,
        reboquistas: {}, viaturas: {}, eventos: {},
        refs: { reboquistas: null, viaturas: null, eventos: null },
        draggedId: null, draggedTipo: null,
        isDragging: false, pendingRender: false,
        multi: { reboquistaIds: [], viaturaIds: [] },
        editandoEventoId: null,
        buscaEventos: '',
    };

    /* ── Utils ────────────────────────────────────────────────────────────── */
    const g   = id => document.getElementById(id);
    const esc = v  => String(v ?? '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    function toast(msg, tipo) {
        typeof window.showToast === 'function'
            ? window.showToast(msg, tipo)
            : console.log(`[NitReboques][${tipo||'info'}] ${msg}`);
    }
    const agoraHHMM = () => new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const hojeISO   = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
    const hojeBR    = () => new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}).replace(/\//g,'.');
    const novoId    = pre => `${pre}-${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
    const maxOrdem  = coll => Object.values(coll||{}).reduce((m,r)=>(typeof r?.ordem==='number'&&r.ordem>m?r.ordem:m),-1);
    function copiarTexto(txt) {
        if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(txt).then(()=>true).catch(()=>_fbCopy(txt));
        return Promise.resolve(_fbCopy(txt));
    }
    function _fbCopy(txt) {
        try { const t=document.createElement('textarea'); t.value=txt; t.style.cssText='position:fixed;opacity:0'; document.body.appendChild(t); t.select(); const ok=document.execCommand('copy'); document.body.removeChild(t); return ok; } catch { return false; }
    }
    const _abrirModal  = el => el?.classList.add('aberto');
    const _fecharModal = el => el?.classList.remove('aberto');

    /* ── Ícones SVG (outline 24×24, stroke-width 2) ────────────────────────── */
    const I = {
        edit:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
        trash:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
        check:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        dispatch:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
        ban:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
        pencil:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="2" x2="22" y2="6"/><path d="M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z"/></svg>`,
        copy:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        send:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
        plus:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        // info-line icons (menores)
        clock:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        phone:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
        users:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        mappin:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
        radio:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`,
        info:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
        comment: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        truck:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
        car:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v4"/><circle cx="18" cy="17" r="3"/><circle cx="10" cy="17" r="3"/></svg>`,
        save:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    };



    /* ── Init / Destroy ───────────────────────────────────────────────────── */
    function inicializar(db) {
        if (S.inicializado) return;
        if (!db) { console.error('[NitReboques] db inválido'); return; }
        if (!g('tab-reboques')) { console.error('[NitReboques] markup ausente'); return; }
        S.db = db;
        if (!S.uiBound) { _bindUI(); _bindTabsFallback(); S.uiBound = true; }
        _iniciarListeners();
        S.inicializado = true;
        console.log('[NitReboques] módulo inicializado.');
    }
    function destruir() {
        Object.values(S.refs).forEach(r => r?.off());
        S.refs = { reboquistas: null, viaturas: null, eventos: null };
        S.inicializado = false;
    }

    /* ── Firebase ─────────────────────────────────────────────────────────── */
    function _iniciarListeners() {
        const err = tipo => e => { console.error(`[NitReboques] listener ${tipo}:`, e); toast(`Erro ao sincronizar ${tipo}.`,'error'); };
        S.refs.reboquistas = S.db.ref(PATH_REBOQUISTAS);
        S.refs.viaturas    = S.db.ref(PATH_VIATURAS);
        S.refs.eventos     = S.db.ref(PATH_EVENTOS);
        S.refs.reboquistas.on('value', s => { S.reboquistas = s.val()||{}; _render(); }, err('reboquistas'));
        S.refs.viaturas   .on('value', s => { S.viaturas    = s.val()||{}; _render(); }, err('viaturas'));
        S.refs.eventos    .on('value', s => { S.eventos     = s.val()||{}; _render(); }, err('eventos'));
    }
    function _render() {
        if (S.isDragging) { S.pendingRender = true; return; }
        _renderViaLivre();
        _renderReboques();
        _renderEventos();
        _atualizarBalanco();
    }

    /* ── Parser v2 (resiliente) ───────────────────────────────────────────── */

    // Pré-processa o texto bruto em blocos:
    // • normaliza \r\n → \n
    // • "//" inline → separador de bloco (padrão do WhatsApp AMC)
    // • "---" como separador alternativo
    // • múltiplas linhas em branco colapsam para uma
    function _splitBlocos(bruto) {
        return bruto
            .replace(/\r\n?/g, '\n')                 // normaliza line endings
            .replace(/\/\//g, '\n\n')                // // → separador de bloco
            .replace(/^-{3,}\s*$/gm, '\n')           // --- como separador
            .replace(/\n{3,}/g, '\n\n')              // colapsa linhas em branco múltiplas
            .split(/\n\s*\n/)
            .map(b => b.trim())
            .filter(b => b.length > 0);
    }

    // Descarta linhas de ruído: saudações, emojis soltos, datas, horários soltos
    function _isRuido(linha) {
        const l = linha.trim();
        if (!l || l.length < 2) return true;
        if (/^(boa\s+(?:tarde|noite|manh[ãa])|bom\s+dia|ol[aá]\b|oi\b|ok\b|obrigad)/i.test(l)) return true;
        // menos de 3 letras na linha (emojis, pontuação, números soltos)
        if ((l.match(/[a-zA-ZÀ-ÿ]/g) || []).length < 3) return true;
        // data pura: 08/07, 08/07/2026, 08-07
        if (/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(l)) return true;
        return false;
    }

    // Normaliza representação de horário → "18:00hs" ou "18hs"
    // Aceita ponto-e-vírgula como separador (00;00 → 00:00)
    function _normHorario(raw) {
        const s = raw.trim().replace(/\s+/g, '').replace(/;/g, ':');
        if (/^\d{1,2}:\d{2}/.test(s)) return s.replace(/h.*$/i, '').trim() + 'hs';
        return s.replace(/h.*$/i, '').trim() + 'hs';
    }

    // Formata telefone: "85999999999" → "(85) 99999-9999"
    function _normTelefone(ddd, num) {
        const n = num.replace(/\D/g, '');
        const fmt = n.length >= 9
            ? n.replace(/(\d{4,5})(\d{4})$/, '$1-$2')
            : n;
        return `(${ddd.replace(/\D/g,'')}) ${fmt}`;
    }

    // Detecta linhas que são endereços/locais e NÃO nomes de agentes
    function _ehEndereco(linha) {
        const l = linha.trim();
        if (/^(av\.?|avenida|rua|r\.\s|bairro|estr\.?|rodovia|rod\.?|alameda|al\.?|pra[çc]a|travessa|trav\.?|viela|via\s+\w)/i.test(l)) return true;
        if (/\b(com\s+av|x\s+av|e\s+av|esquina|cruzamento|br[\s\-]\d{2,3})\b/i.test(l)) return true;
        if (/^rota\b/i.test(l)) return true;
        if (/\bkm\s*\d+/i.test(l)) return true;
        return false;
    }

    // Detecta se a primeira linha é uma viatura (começa com "VT" + qualquer separador)
    function _extrairBloco(bloco) {
        const linhas = bloco.split('\n').map(l => l.trim()).filter(l => l);
        if (!linhas.length) return null;
        const primeira = linhas[0];

        // VT-first: "VT 211", "VT: 211", "VT-211", "VT.211", "VT211"
        if (/^VT[\s\-:\.]*[\dA-Z]/i.test(primeira)) {
            // 🚨 na primeira linha = formato de reboque avulso ("VT 176 🚨 PML 3117 EM MANUTENÇÃO")
            // → encaminha para _parseReboquista, que retorna null (sem nome = bloco descartado)
            // Viaturas nunca têm 🚨 na linha do VT
            if (primeira.includes('🚨')) return _parseReboquista(linhas);
            return _parseViatura(linhas);
        }

        // Reboquista: contém linha com VT+número, Plantão, ou palavra-chave de contato
        const temVT      = linhas.some(l => /VT[\s\-:\.]*\d+/i.test(l));
        const temPlantao = linhas.some(l => /plant[aã]o|at[eé]\s+[àa]?s?\s*\d/i.test(l));
        const temContato = linhas.some(l => /(?:smart|celular|tel[ef]\.?|fone|whats(?:app)?|zap|contato)\s*[:\-]/i.test(l));
        if (temVT || temPlantao || temContato) return _parseReboquista(linhas);
        return null;
    }

    function _parseViatura(linhas) {
        const lPrimClean = linhas[0].replace(/[\u{1F000}-\u{1FFFF}]/gu, ' ');

        // Extrai só o número da VT
        const vtNumM = lPrimClean.match(/VT[\s\-:\.]*(\d+)/i);
        const vtNum  = vtNumM ? vtNumM[1] : '';

        // Detecta MT VL (motorista via livre sem VT)
        const vtTudo = lPrimClean.replace(/^VT[\s\-:\.']*/i, '').trim().toUpperCase();
        const ehVL   = !vtNum && /^(MT\.?\s*V\.?L\.?|MT\.?\s*VIA\s*LIVRE|MOTO\s*VIA\s*LIVRE|MOTORISTA\s*VIA\s*LIVRE|MTVL|VIA\s*LIVRE)$/.test(vtTudo);
        const vt     = ehVL ? 'MT VL' : (vtNum || 'N/I');

        // Placa inline (ex: "VT 176 PML3117")
        let placaInline = '', notaInline = '';
        if (vtNumM) {
            const apos   = lPrimClean.slice(vtNumM.index + vtNumM[0].length).trim();
            const placaM = apos.match(/^([A-Z]{2,3}\s*[\dA-Z]{3,7})/i);
            if (placaM) { placaInline = placaM[1].replace(/\s/g,'').toUpperCase(); notaInline = apos.slice(placaM[0].length).trim(); }
            else { notaInline = apos; }
        }

        // ── Fix 1: QTH/QRU em linhas separadas sem separador ───────────────
        // "QTH\nav a x av f" → "QTH: av a x av f"
        const linhasResto = [];
        for (let i = 1; i < linhas.length; i++) {
            const l = linhas[i];
            if (/^Q[\.\s]*[RT][\.\s]*[UH]\s*$/i.test(l) && i + 1 < linhas.length) {
                linhasResto.push(l.trim() + ': ' + linhas[i + 1].trim());
                i++;
            } else {
                linhasResto.push(l);
            }
        }

        // ── Fix 2: extrai QRU/QTH dos labels (inclui nota inline) ──────────
        let qru = notaInline, qth = '';
        linhasResto.forEach(l => {
            const qruM = l.match(/^Q[\.\s]*R[\.\s]*[UQ][\.\s]*[:\-\s]+(.+)/i);
            if (qruM) qru = qruM[1].trim();
            const qthM = l.match(/^(?:Q[\.\s]*T[\.\s]*H|LOCAL|ENDERE[ÇC]O)[\.\s]*[:\-\s]+(.+)/i);
            if (qthM) qth = qthM[1].trim();
        });

        // ── Fix 2b: endereço implícito (sem label) → QTH ───────────────────
        if (!qth) {
            const endImpl = linhasResto.find(l =>
                !_isRuido(l) &&
                !/^Q[\.\s]*[RT]/i.test(l) &&
                _ehEndereco(l)
            );
            if (endImpl) qth = endImpl;
        }

        // ── Fix 3: equipe inclui MT VL; exclui ruído, labels e endereços ───
        const equipeLinhas = linhasResto.filter(l => {
            if (_isRuido(l)) return false;
            if (/^(Q[\.\s]*[RT][\.\s]*[UH]|LOCAL|ENDERE[ÇC]O|MISS[AÃ]O|EQUIPE\s*:)/i.test(l)) return false;
            if (_ehEndereco(l)) return false;
            return true;
        });
        const equipe = equipeLinhas.join(' / ').replace(/\s{2,}/g, ' ').trim();

        const status = (qru || qth) ? 'atuando' : 'disponivel';
        return { tipoRecurso: 'viatura', vt, placa: placaInline, equipe, qru, qth, status };
    }

    function _parseReboquista(linhas) {
        // Linha do nome: exclui todas as linhas com padrões conhecidos
        const linhaNome = linhas.find(l => {
            if (_isRuido(l)) return false;
            if (/VT[\s\-:\.]*[\d\w]+/i.test(l)) return false;       // linha de VT
            if (/[🚨🔴🟡🟢]/u.test(l)) return false;                  // emojis de status
            if (/plant[aã]o|at[eé]\s+[àa]?s?\s*\d/i.test(l)) return false; // plantão
            if (/(?:smart|celular|tel[ef]\.?|fone|whats(?:app)?|zap|contato)\s*[:\-]/i.test(l)) return false; // contato (exige : ou -)
            if (/vistoriador|assumir.*hora|central|supervis/i.test(l)) return false; // papéis/funções
            if (/^(Q[\.\s]*[RT][\.\s]*[UH]|LOCAL|ENDERE[ÇC]O)/i.test(l)) return false; // QRU/QTH
            if (/^\d+$/.test(l)) return false;                         // linha só com números
            if (l.length < 3) return false;
            return true;
        });
        if (!linhaNome) return null;

        const dados = {
            tipoRecurso: 'reboquista',
            nome: linhaNome.trim().toUpperCase().replace(/\s+/g, ' '),
            vt: 'N/I', placa: 'N/I', plantao: 'N/I', smart: 'N/I',
        };

        linhas.forEach(l => {
            // ── Plantão ─────────────────────────────────────────────────────
            // Aceita: "Plantão até às 18hrs", "Plantao ate 18:00hs", "Plantão: 18h",
            //         "Plantão 18hrs", "Plantão at 18hs", "00;00" (ponto-e-vírgula)
            const pm = l.match(/plant[aã]o\s*[:\-]?\s*(?:at[eé]?\s+)?(?:[àas]+\s*)?([\d:;]+\s*h[ro]?[sa]?)/i)
                    || l.match(/at[eé]?\s+[àas]?\s*([\d:;]+\s*h[ro]?[sa]?)/i);
            if (pm) dados.plantao = _normHorario(pm[1]);

            // ── Contato ──────────────────────────────────────────────────────
            // Aceita: Smart, Celular, Tel, Fone, Whatsapp, Zap, Contato
            // Formatos: "(85) 99999-9999", "85 99999-9999", "85999999999"
            const sm = l.match(/(?:smart|celular|tel[ef]\.?|fone|whats(?:app)?|zap|contato)\s*[:\-]?\s*\(?\s*(\d{2})\s*\)?\s*[\s.\-]?([\d\s.\-]{8,})/i);
            if (sm) dados.smart = _normTelefone(sm[1], sm[2]);

            // Telefone "nu" (sem palavra-chave): linha que só tem número com DDD
            if (!sm) {
                const tel = l.match(/^\(?\s*(\d{2})\s*\)?\s*[\s.\-]?(9?\d{4}[\s.\-]?\d{4})\s*$/);
                if (tel) dados.smart = _normTelefone(tel[1], tel[2]);
            }

            // ── VT + placa ───────────────────────────────────────────────────
            // Strip de emojis (🚨 sem flag u corromperia), aceita espaço na placa
            // Aceita: "VT 193 🚨 ABC1234", "VT 078 🚨 ORS 8092", "VT:193 ABC1234"
            // Placa: padrão antigo ABC1234, espaçado ORS 8092, Mercosul ABC1A23
            const lSem = l.replace(/[\u{1F000}-\u{1FFFF}]/gu, ' ');
            const vm = lSem.match(/VT[\s\-:\.]*(\d+)\s*[\s\/\-]*([A-Z]{2,3}\s*[\dA-Z]{3,7})?/i);
            if (vm) {
                dados.vt    = vm[1].trim();
                dados.placa = vm[2]?.replace(/\s/g, '').toUpperCase() || 'N/I';
            }
        });

        return dados;
    }

    function processarPlantao() {
        const bruto = g('nit-rb-bruto')?.value.trim();
        if (!bruto) { toast('Insira o relatório de plantão.','warning'); return; }
        const blocos = _splitBlocos(bruto);
        const updates = {}; let novosV=0, novosR=0;
        let ordV = maxOrdem(S.viaturas), ordR = maxOrdem(S.reboquistas);
        const vtExiste  = vt   => Object.values(S.viaturas   ).some(v => v?.vt   === vt);
        const nomExiste = nome => Object.values(S.reboquistas ).some(r => r?.nome === nome);

        blocos.forEach(bloco => {
            const d = _extrairBloco(bloco);
            if (!d) return;
            if (d.tipoRecurso === 'viatura' && !vtExiste(d.vt)) {
                const id = novoId('vt');
                updates[`${PATH_VIATURAS}/${id}`] = { vt:d.vt, placa:d.placa||'', equipe:d.equipe, qru:d.qru, qth:d.qth, status:d.status, eventoId:'', ordem:++ordV };
                S.viaturas[id] = updates[`${PATH_VIATURAS}/${id}`];
                novosV++;
            } else if (d.tipoRecurso === 'reboquista' && !nomExiste(d.nome)) {
                const id = novoId('reb');
                updates[`${PATH_REBOQUISTAS}/${id}`] = { nome:d.nome, vt:d.vt, placa:d.placa, plantao:d.plantao, smart:d.smart, status:'disponivel', eventoId:'', ocorrencia:'', ordem:++ordR };
                S.reboquistas[id] = updates[`${PATH_REBOQUISTAS}/${id}`];
                novosR++;
            }
        });
        if (!novosV && !novosR) { toast('Nenhum recurso novo encontrado.','info'); return; }
        updates[`${PATH_CONFIG}/data`] = hojeISO();
        S.db.ref().update(updates)
            .then(() => { toast(`Processado: ${novosV} viatura(s), ${novosR} reboquista(s).`,'success'); if (g('nit-rb-bruto')) g('nit-rb-bruto').value=''; _fecharModal(g('nit-reboque-modal-processar')); })
            .catch(e => { console.error(e); toast('Falha ao gravar no Firebase.','error'); });
    }

    /* ── Render ───────────────────────────────────────────────────────────── */
    function _cardViaturaHTML(id, v) {
        const atuando  = v.status === 'atuando';
        const tagLabel = atuando ? 'Atuando' : 'Disponível';
        const tagClass = atuando ? 'atuando' : 'disponivel';
        return `
        <div class="nit-reboque-card" draggable="true" data-id="${esc(id)}" data-tipo="viatura" data-status="${esc(v.status)}">
            <div class="nit-reboque-card-header">
                <strong class="nit-reboque-mono">VT ${esc(v.vt||'N/I')}${v.placa ? ` · ${esc(v.placa)}` : ''}</strong>
                <span class="nit-reboque-status-tag ${tagClass}">${tagLabel}</span>
            </div>
            <div class="nit-reboque-card-info">
                <div class="nit-reboque-info-line"><i class="fas fa-users"></i>${esc(v.equipe||'Equipe não informada')}</div>
                ${v.qru ? `<div class="nit-reboque-info-line"><i class="fas fa-broadcast-tower"></i>${esc(v.qru)}</div>` : ''}
                ${v.qth ? `<div class="nit-reboque-info-line"><i class="fas fa-map-marker-alt"></i>${esc(v.qth)}</div>` : ''}
            </div>
            <div class="nit-reboque-card-footer">
                <button class="nit-reboque-acao js-vt-editar" title="Editar viatura"><i class="fas fa-edit"></i></button>
                <button class="nit-reboque-acao js-vt-remover" title="Remover viatura"><i class="fas fa-trash-alt"></i></button>
                <span class="nit-reboque-spacer"></span>
                ${atuando
                    ? `<button class="nit-reboque-acao js-vt-finalizar" title="Marcar como disponível"><i class="fas fa-check-circle"></i></button>`
                    : `<button class="nit-reboque-acao js-vt-acionar" title="Vincular a ocorrência"><i class="fas fa-sign-out-alt"></i></button>`}
            </div>
        </div>`;
    }

    function _cardReboquistaHTML(id, r) {
        const atuando  = r.status === 'atuando';
        const tagLabel = atuando ? 'Atuando' : 'Disponível';
        const tagClass = atuando ? 'atuando' : 'disponivel';
        return `
        <div class="nit-reboque-card" draggable="true" data-id="${esc(id)}" data-tipo="reboquista" data-status="${esc(r.status)}">
            <div class="nit-reboque-card-header">
                <strong>${esc(r.nome||'N/I')}</strong>
                <span class="nit-reboque-status-tag ${tagClass}">${tagLabel}</span>
            </div>
            <div class="nit-reboque-card-info">
                <div class="nit-reboque-info-line">${I.truck}<span class="nit-reboque-mono">VT ${esc(r.vt||'N/I')} · ${esc(r.placa||'N/I')}</span></div>
                <div class="nit-reboque-info-line">${I.clock}Plantão até ${esc(r.plantao||'N/I')}</div>
                <div class="nit-reboque-info-line">${I.phone}<span class="nit-reboque-mono">${esc(r.smart||'N/I')}</span></div>
                ${atuando && r.ocorrencia ? `<div class="nit-reboque-ocorrencia" title="${esc(r.ocorrencia)}">${I.info} ${esc(r.ocorrencia)}</div>` : ''}
            </div>
            <div class="nit-reboque-card-footer">
                <button class="nit-reboque-acao js-editar" title="Editar reboquista">${I.edit}</button>
                <button class="nit-reboque-acao js-remover" title="Remover reboquista">${I.trash}</button>
                <span class="nit-reboque-spacer"></span>
                ${atuando
                    ? `<button class="nit-reboque-acao js-finalizar" title="Finalizar atendimento">${I.check}</button>`
                    : `<button class="nit-reboque-acao js-acionar" title="Vincular a ocorrência">${I.dispatch}</button>`}
            </div>
        </div>`;
    }

    function _cardEventoHTML(id, ev) {
        const rebs  = Object.entries(ev.reboquistas||{});
        const viats = Object.entries(ev.viaturas||{});
        const rebTagsHTML = rebs.length
            ? rebs.map(([,n]) => `<span class="nit-reboque-evento-tag reboque">${esc(n)}</span>`).join('')
            : `<span class="nit-reboque-evento-tag vazio">Nenhum reboque</span>`;
        const vtTagsHTML = viats.length
            ? viats.map(([,n]) => `<span class="nit-reboque-evento-tag viatura">${esc(n)}</span>`).join('')
            : `<span class="nit-reboque-evento-tag vazio">Nenhuma viatura</span>`;
        return `
        <div class="nit-reboque-evento-card" data-evento-id="${esc(id)}">
            <div class="nit-reboque-evento-header">
                <strong>${esc(ev.tipo||'EVENTO')}</strong>
                <span class="nit-reboque-evento-hora nit-reboque-mono">${esc(ev.criado||'')}</span>
            </div>
            <div class="nit-reboque-card-info">
                <div class="nit-reboque-info-line"><i class="fas fa-map-marker-alt"></i>${esc(ev.endereco||'')}</div>
                ${ev.horario?`<div class="nit-reboque-info-line"><i class="far fa-clock"></i>${esc(ev.horario)}</div>`:''}
                ${ev.obs?`<div class="nit-reboque-info-line"><i class="fas fa-comment-dots"></i>${esc(ev.obs)}</div>`:''}
            </div>
            <div class="nit-reboque-evento-secao"><span class="nit-reboque-evento-secao-label">${I.truck} Reboques</span><div class="nit-reboque-evento-tags">${rebTagsHTML}</div></div>
            <div class="nit-reboque-evento-secao"><span class="nit-reboque-evento-secao-label">${I.car} Viaturas</span><div class="nit-reboque-evento-tags">${vtTagsHTML}</div></div>
            <div class="nit-reboque-card-footer">
                <button class="nit-reboque-acao js-ev-editar"    title="Editar">${I.pencil}</button>
                <button class="nit-reboque-acao js-ev-relatorio" title="Copiar relatório">${I.copy}</button>
                <span class="nit-reboque-spacer"></span>
                <button class="nit-reboque-acao js-ev-finalizar" title="Finalizar e liberar recursos">${I.check}</button>
                <button class="nit-reboque-acao js-ev-remover"   title="Cancelar ocorrência">${I.ban}</button>
            </div>
        </div>`;
    }

    function _sorted(coll) {
        return Object.entries(coll).filter(([,v])=>v).sort((a,b)=>(a[1].ordem??0)-(b[1].ordem??0)||(String(a[1].vt||a[1].nome).localeCompare(String(b[1].vt||b[1].nome))));
    }

    function _renderViaLivre() {
        const c = g('nit-reboques-vialivre');
        if (!c) return;
        const lista = _sorted(S.viaturas);
        c.innerHTML = lista.length ? lista.map(([id,v])=>_cardViaturaHTML(id,v)).join('') : `<div class="nit-reboque-vazio">Nenhuma viatura em serviço.</div>`;
        if (g('nit-reboque-col-count-vialivre')) g('nit-reboque-col-count-vialivre').textContent = lista.length;
    }

    function _renderReboques() {
        const c = g('nit-reboques-reboques');
        if (!c) return;
        const lista = _sorted(S.reboquistas);
        c.innerHTML = lista.length ? lista.map(([id,r])=>_cardReboquistaHTML(id,r)).join('') : `<div class="nit-reboque-vazio">Nenhum reboquista em serviço.</div>`;
        if (g('nit-reboque-col-count-reboques')) g('nit-reboque-col-count-reboques').textContent = lista.length;
    }

    function _renderEventos() {
        const c = g('nit-reboques-eventos');
        if (!c) return;
        const busca = S.buscaEventos.toLowerCase();
        let lista = Object.entries(S.eventos).filter(([,e])=>e).sort((a,b)=>String(b[1].criadoTs||'').localeCompare(String(a[1].criadoTs||'')));
        if (busca) lista = lista.filter(([,e]) =>
            [e.tipo,e.endereco,e.obs,...Object.values(e.reboquistas||{}),...Object.values(e.viaturas||{})].some(v=>String(v||'').toLowerCase().includes(busca))
        );
        c.innerHTML = lista.length ? lista.map(([id,ev])=>_cardEventoHTML(id,ev)).join('') : `<div class="nit-reboque-vazio">${busca?'Nenhuma ocorrência encontrada.':'Nenhuma ocorrência em andamento.'}</div>`;
        if (g('nit-reboque-eventos-count')) g('nit-reboque-eventos-count').textContent = Object.keys(S.eventos).length;
    }

    function _atualizarBalanco() {
        const vl = Object.values(S.viaturas).filter(v=>v?.status==='disponivel').length;
        const vq = Object.values(S.viaturas).filter(v=>v?.status==='atuando').length;
        const rd = Object.values(S.reboquistas).filter(r=>r?.status==='disponivel').length;
        const ra = Object.values(S.reboquistas).filter(r=>r?.status==='atuando').length;
        const set = (id,val) => { const el=g(id); if(el) el.textContent=val; };
        set('nit-reboque-bal-vt-disp',vl); set('nit-reboque-bal-vt-atua',vq); set('nit-reboque-bal-vt-total',vl+vq);
        set('nit-reboque-bal-reb-disp',rd); set('nit-reboque-bal-reb-atua',ra); set('nit-reboque-bal-reb-total',rd+ra);
    }

    /* ── CRUD Viatura ─────────────────────────────────────────────────────── */
    function abrirEdicaoViatura(id) {
        const v = id ? (S.viaturas[id]||{}) : {};
        const titulo = g('nit-reboque-viatura-titulo');
        if (titulo) titulo.innerHTML = `<i class="fas fa-car-side"></i> ${id?'Editar':'Adicionar'} Viatura`;
        if (g('nit-reboque-viatura-id'))     g('nit-reboque-viatura-id').value    = id||'';
        if (g('nit-reboque-viatura-vt'))     g('nit-reboque-viatura-vt').value    = v.vt||'';
        if (g('nit-reboque-viatura-equipe')) g('nit-reboque-viatura-equipe').value = v.equipe||'';
        if (g('nit-reboque-viatura-qru'))    g('nit-reboque-viatura-qru').value   = v.qru||'';
        if (g('nit-reboque-viatura-qth'))    g('nit-reboque-viatura-qth').value   = v.qth||'';
        if (g('nit-reboque-viatura-status')) g('nit-reboque-viatura-status').value = v.status||'disponivel';
        _abrirModal(g('nit-reboque-modal-viatura'));
        g('nit-reboque-viatura-vt')?.focus();
    }

    function salvarViatura() {
        const id  = g('nit-reboque-viatura-id')?.value||'';
        const vt  = g('nit-reboque-viatura-vt')?.value.trim().toUpperCase()||'';
        if (!vt) { toast('O número da VT é obrigatório.','error'); return; }
        const dados = {
            vt, equipe: g('nit-reboque-viatura-equipe')?.value.trim()||'',
            qru: g('nit-reboque-viatura-qru')?.value.trim()||'',
            qth: g('nit-reboque-viatura-qth')?.value.trim()||'',
            status: g('nit-reboque-viatura-status')?.value||'disponivel',
        };
        const updates = {};
        if (id && S.viaturas[id]) {
            Object.entries(dados).forEach(([k,v])=>{ updates[`${PATH_VIATURAS}/${id}/${k}`]=v; });
            // atualiza snapshot nos eventos vinculados
            const label = `VT ${dados.vt}${dados.equipe?' — '+dados.equipe:''}`;
            Object.entries(S.eventos).forEach(([evId,ev])=>{ if(ev?.viaturas?.[id]) updates[`${PATH_EVENTOS}/${evId}/viaturas/${id}`]=label; });
            toast('Viatura atualizada!','success');
        } else {
            const vtExiste = Object.values(S.viaturas).some(v=>v?.vt===dados.vt);
            if (vtExiste) { toast(`VT ${dados.vt} já está cadastrada.`,'error'); return; }
            const novoVtId = novoId('vt');
            updates[`${PATH_VIATURAS}/${novoVtId}`] = { ...dados, eventoId:'', ordem: maxOrdem(S.viaturas)+1 };
            toast('Viatura adicionada!','success');
        }
        S.db.ref().update(updates).catch(e=>{console.error(e);toast('Falha ao gravar.','error');});
        _fecharModal(g('nit-reboque-modal-viatura'));
    }

    function removerViatura(id) {
        const v = S.viaturas[id]; if (!v) return;
        if (!confirm(`Remover VT ${v.vt} (${v.equipe||'sem equipe'})?`)) return;
        const updates = {};
        if (v.eventoId) updates[`${PATH_EVENTOS}/${v.eventoId}/viaturas/${id}`] = null;
        updates[`${PATH_VIATURAS}/${id}`] = null;
        S.db.ref().update(updates).then(()=>toast('Viatura removida.','success')).catch(e=>{console.error(e);toast('Falha ao remover.','error');});
    }

    /* ── CRUD Reboquista ──────────────────────────────────────────────────── */
    function abrirEdicaoReboquista(id) {
        const r = id ? (S.reboquistas[id]||{}) : {};
        const titulo = g('nit-reboque-edit-titulo');
        if (titulo) titulo.innerHTML = `<i class="fas fa-user-edit"></i> ${id?'Editar':'Adicionar'} Reboquista`;
        if (g('nit-reboque-edit-id'))      g('nit-reboque-edit-id').value      = id||'';
        if (g('nit-reboque-edit-nome'))    g('nit-reboque-edit-nome').value    = r.nome||'';
        if (g('nit-reboque-edit-vt'))      g('nit-reboque-edit-vt').value      = r.vt||'';
        if (g('nit-reboque-edit-placa'))   g('nit-reboque-edit-placa').value   = r.placa||'';
        if (g('nit-reboque-edit-plantao')) g('nit-reboque-edit-plantao').value = r.plantao||'';
        if (g('nit-reboque-edit-smart'))   g('nit-reboque-edit-smart').value   = r.smart||'';
        _abrirModal(g('nit-reboque-modal-edicao'));
        g('nit-reboque-edit-nome')?.focus();
    }

    function salvarReboquista() {
        const id    = g('nit-reboque-edit-id')?.value||'';
        const dados = {
            nome:    g('nit-reboque-edit-nome')?.value.trim().toUpperCase()||'',
            vt:      g('nit-reboque-edit-vt')?.value.trim()||'N/I',
            placa:   g('nit-reboque-edit-placa')?.value.trim().toUpperCase()||'N/I',
            plantao: g('nit-reboque-edit-plantao')?.value.trim()||'N/I',
            smart:   g('nit-reboque-edit-smart')?.value.trim()||'N/I',
        };
        if (!dados.nome) { toast('O nome é obrigatório.','error'); return; }
        const updates = {};
        if (id && S.reboquistas[id]) {
            const nomeAntigo = S.reboquistas[id].nome;
            Object.entries(dados).forEach(([k,v])=>{ updates[`${PATH_REBOQUISTAS}/${id}/${k}`]=v; });
            if (nomeAntigo !== dados.nome)
                Object.entries(S.eventos).forEach(([evId,ev])=>{ if(ev?.reboquistas?.[id]) updates[`${PATH_EVENTOS}/${evId}/reboquistas/${id}`]=dados.nome; });
            toast('Reboquista atualizado!','success');
        } else {
            if (Object.values(S.reboquistas).some(r=>r?.nome===dados.nome)) { toast('Nome já cadastrado.','error'); return; }
            const nid = novoId('reb');
            updates[`${PATH_REBOQUISTAS}/${nid}`] = { ...dados, status:'disponivel', eventoId:'', ocorrencia:'', ordem: maxOrdem(S.reboquistas)+1 };
            toast('Reboquista adicionado!','success');
        }
        S.db.ref().update(updates).catch(e=>{console.error(e);toast('Falha ao gravar.','error');});
        _fecharModal(g('nit-reboque-modal-edicao'));
    }

    function removerReboquista(id) {
        const r = S.reboquistas[id]; if (!r) return;
        if (!confirm(`Remover reboquista ${r.nome}?`)) return;
        const updates = {};
        if (r.eventoId) updates[`${PATH_EVENTOS}/${r.eventoId}/reboquistas/${id}`] = null;
        updates[`${PATH_REBOQUISTAS}/${id}`] = null;
        S.db.ref().update(updates).then(()=>toast('Reboquista removido.','success')).catch(e=>{console.error(e);toast('Falha ao remover.','error');});
    }

    /* ── Acionamento ──────────────────────────────────────────────────────── */
    function _acionamentoAberto() { return g('nit-reboque-acionamento')?.classList.contains('aberto'); }

    function _resetAcionamento() {
        S.multi = { reboquistaIds:[], viaturaIds:[] };
        S.editandoEventoId = null;
        const t = g('nit-reboque-acion-titulo');
        if (t) t.innerHTML = '<i class="fas fa-bullhorn"></i> Registrar Ocorrência';
        ['nit-reboque-acion-tipo','nit-reboque-acion-endereco','nit-reboque-acion-horario','nit-reboque-acion-obs']
            .forEach(id => { const el=g(id); if(el){el.value='';el.disabled=false;} });
        _renderTagsAcionamento();
    }

    function _renderTagsAcionamento() {
        const trR = g('nit-reboque-acion-tags-reboques');
        const trV = g('nit-reboque-acion-tags-viaturas');
        if (trR) trR.innerHTML = S.multi.reboquistaIds.map(id => {
            const r = S.reboquistas[id]||{};
            return `<span class="nit-reboque-evento-tag reboque">${esc(r.nome||'?')}<button class="nit-reboque-tag-x" data-id="${esc(id)}" data-tipo="reboquista">&times;</button></span>`;
        }).join('') || '';
        if (trV) trV.innerHTML = S.multi.viaturaIds.map(id => {
            const v = S.viaturas[id]||{};
            return `<span class="nit-reboque-evento-tag viatura">VT ${esc(v.vt||'?')}<button class="nit-reboque-tag-x" data-id="${esc(id)}" data-tipo="viatura">&times;</button></span>`;
        }).join('') || '';
    }

    function abrirAcionamento(id, tipo) {
        if (_acionamentoAberto() && !S.editandoEventoId) { _adicionarRecurso(id, tipo); return; }
        _resetAcionamento();
        _adicionarRecurso(id, tipo);
        if (g('nit-reboque-acion-horario')) g('nit-reboque-acion-horario').value = agoraHHMM();
        g('nit-reboque-acionamento')?.classList.add('aberto');
        g('nit-reboque-acion-tipo')?.focus();
    }

    function abrirNovaOcorrencia() {
        _resetAcionamento();
        if (g('nit-reboque-acion-horario')) g('nit-reboque-acion-horario').value = agoraHHMM();
        g('nit-reboque-acionamento')?.classList.add('aberto');
        g('nit-reboque-acion-tipo')?.focus();
    }

    function _adicionarRecurso(id, tipo) {
        if (tipo === 'reboquista') {
            const r = S.reboquistas[id]; if (!r) return;
            if (r.status === 'atuando') { toast(`${r.nome} já está em atendimento.`,'info'); return; }
            if (S.multi.reboquistaIds.includes(id)) { toast(`${r.nome} já está neste acionamento.`,'info'); return; }
            S.multi.reboquistaIds.push(id);
        } else {
            const v = S.viaturas[id]; if (!v) return;
            if (S.multi.viaturaIds.includes(id)) { toast(`VT ${v.vt} já está neste acionamento.`,'info'); return; }
            S.multi.viaturaIds.push(id);
        }
        _renderTagsAcionamento();
    }

    function confirmarAcionamento() {
        if (S.editandoEventoId) { _salvarEdicaoEvento(); return; }
        const tipo     = g('nit-reboque-acion-tipo')?.value.trim().toUpperCase()||'';
        const endereco = g('nit-reboque-acion-endereco')?.value.trim().toUpperCase()||'';
        if (!tipo || !endereco) { toast('Tipo e Endereço são obrigatórios.','warning'); return; }
        if (!S.multi.reboquistaIds.length && !S.multi.viaturaIds.length) { toast('Adicione ao menos um recurso.','warning'); return; }
        const horario = g('nit-reboque-acion-horario')?.value||'';
        const obs     = g('nit-reboque-acion-obs')?.value.trim()||'';
        const ocorrencia = `${tipo} @ ${endereco}`;
        const evId = novoId('evt');
        const snapRebs  = {}; S.multi.reboquistaIds.forEach(id=>{ snapRebs[id]  = S.reboquistas[id]?.nome||'?'; });
        const snapViats = {}; S.multi.viaturaIds.forEach(id=>{
            const v=S.viaturas[id]||{}; snapViats[id]=`VT ${v.vt||'?'}${v.equipe?' — '+v.equipe:''}`;
        });
        const updates = {};
        updates[`${PATH_EVENTOS}/${evId}`] = { tipo, endereco, horario, obs, criado: agoraHHMM(), criadoTs: String(Date.now()), reboquistas: snapRebs, viaturas: snapViats };
        S.multi.reboquistaIds.forEach(id => {
            updates[`${PATH_REBOQUISTAS}/${id}/status`]     = 'atuando';
            updates[`${PATH_REBOQUISTAS}/${id}/eventoId`]   = evId;
            updates[`${PATH_REBOQUISTAS}/${id}/ocorrencia`] = ocorrencia;
        });
        S.multi.viaturaIds.forEach(id => {
            updates[`${PATH_VIATURAS}/${id}/status`]   = 'atuando';
            updates[`${PATH_VIATURAS}/${id}/eventoId`] = evId;
            updates[`${PATH_VIATURAS}/${id}/qru`]      = tipo;
            updates[`${PATH_VIATURAS}/${id}/qth`]      = endereco;
        });
        const nomesR = Object.values(snapRebs).join(', ');
        const nomesV = Object.values(snapViats).map(l=>l.split(' — ')[0]).join(', ');
        let msg = `*${tipo}*\n*Local:* ${endereco}`;
        if (horario) msg += `\n*Horário:* ${horario}`;
        if (nomesR)  msg += `\n*Reboque(s):* ${nomesR}`;
        if (nomesV)  msg += `\n*VT(s):* ${nomesV}`;
        S.db.ref().update(updates)
            .then(() => copiarTexto(msg))
            .then(ok => toast(ok?'Ocorrência registrada e mensagem copiada!':'Registrada (falha ao copiar).', ok?'success':'warning'))
            .catch(e=>{console.error(e);toast('Falha ao registrar ocorrência.','error');});
        g('nit-reboque-acionamento')?.classList.remove('aberto');
        _resetAcionamento();
    }

    /* ── Edição de evento (reusa o painel de acionamento) ─────────────────── */
    function abrirEdicaoEvento(evId) {
        const ev = S.eventos[evId]; if (!ev) return;
        _resetAcionamento();
        S.editandoEventoId = evId;
        const t = g('nit-reboque-acion-titulo');
        if (t) t.innerHTML = '<i class="fas fa-pencil-alt"></i> Editar Ocorrência';
        if (g('nit-reboque-acion-tipo'))     g('nit-reboque-acion-tipo').value     = ev.tipo||'';
        if (g('nit-reboque-acion-endereco')) g('nit-reboque-acion-endereco').value = ev.endereco||'';
        if (g('nit-reboque-acion-horario'))  g('nit-reboque-acion-horario').value  = ev.horario||'';
        if (g('nit-reboque-acion-obs'))      g('nit-reboque-acion-obs').value      = ev.obs||'';
        g('nit-reboque-acionamento')?.classList.add('aberto');
    }

    function _salvarEdicaoEvento() {
        const evId = S.editandoEventoId;
        const tipo     = g('nit-reboque-acion-tipo')?.value.trim().toUpperCase()||'';
        const endereco = g('nit-reboque-acion-endereco')?.value.trim().toUpperCase()||'';
        if (!tipo || !endereco) { toast('Tipo e Endereço são obrigatórios.','error'); return; }
        const ocorrencia = `${tipo} @ ${endereco}`;
        const updates = {};
        updates[`${PATH_EVENTOS}/${evId}/tipo`]     = tipo;
        updates[`${PATH_EVENTOS}/${evId}/endereco`] = endereco;
        updates[`${PATH_EVENTOS}/${evId}/horario`]  = g('nit-reboque-acion-horario')?.value||'';
        updates[`${PATH_EVENTOS}/${evId}/obs`]      = g('nit-reboque-acion-obs')?.value.trim()||'';
        Object.entries(S.reboquistas).forEach(([rid,r])=>{ if(r?.eventoId===evId) updates[`${PATH_REBOQUISTAS}/${rid}/ocorrencia`]=ocorrencia; });
        Object.entries(S.viaturas).forEach(([vid,v])=>{ if(v?.eventoId===evId){ updates[`${PATH_VIATURAS}/${vid}/qru`]=tipo; updates[`${PATH_VIATURAS}/${vid}/qth`]=endereco; } });
        S.db.ref().update(updates).then(()=>toast('Ocorrência atualizada!','success')).catch(e=>{console.error(e);toast('Falha ao salvar.','error');});
        g('nit-reboque-acionamento')?.classList.remove('aberto');
        _resetAcionamento();
    }

    /* ── Finalizar / remover ──────────────────────────────────────────────── */
    function finalizarReboquista(id) {
        const r = S.reboquistas[id]; if (!r) return;
        const updates = {};
        if (r.eventoId) updates[`${PATH_EVENTOS}/${r.eventoId}/reboquistas/${id}`] = null;
        updates[`${PATH_REBOQUISTAS}/${id}/status`]     = 'disponivel';
        updates[`${PATH_REBOQUISTAS}/${id}/eventoId`]   = '';
        updates[`${PATH_REBOQUISTAS}/${id}/ocorrencia`] = '';
        S.db.ref().update(updates).then(()=>toast(`${r.nome} disponível.`,'info')).catch(e=>{console.error(e);toast('Falha.','error');});
    }

    function finalizarViatura(id) {
        const v = S.viaturas[id]; if (!v) return;
        const updates = {};
        if (v.eventoId) updates[`${PATH_EVENTOS}/${v.eventoId}/viaturas/${id}`] = null;
        updates[`${PATH_VIATURAS}/${id}/status`]   = 'disponivel';
        updates[`${PATH_VIATURAS}/${id}/eventoId`] = '';
        updates[`${PATH_VIATURAS}/${id}/qru`]      = '';
        updates[`${PATH_VIATURAS}/${id}/qth`]      = '';
        S.db.ref().update(updates).then(()=>toast(`VT ${v.vt} em disponível.`,'info')).catch(e=>{console.error(e);toast('Falha.','error');});
    }

    function _liberarVinculados(evId, updates) {
        Object.entries(S.reboquistas).forEach(([id,r])=>{
            if(r?.eventoId===evId){ updates[`${PATH_REBOQUISTAS}/${id}/status`]='disponivel'; updates[`${PATH_REBOQUISTAS}/${id}/eventoId`]=''; updates[`${PATH_REBOQUISTAS}/${id}/ocorrencia`]=''; }
        });
        Object.entries(S.viaturas).forEach(([id,v])=>{
            if(v?.eventoId===evId){ updates[`${PATH_VIATURAS}/${id}/status`]='disponivel'; updates[`${PATH_VIATURAS}/${id}/eventoId`]=''; updates[`${PATH_VIATURAS}/${id}/qru`]=''; updates[`${PATH_VIATURAS}/${id}/qth`]=''; }
        });
    }

    function finalizarEvento(evId) {
        const ev = S.eventos[evId]; if (!ev) return;
        const updates = {}; _liberarVinculados(evId, updates); updates[`${PATH_EVENTOS}/${evId}`] = null;
        S.db.ref().update(updates).then(()=>toast(`Ocorrência ${ev.tipo} finalizada.`,'success')).catch(e=>{console.error(e);toast('Falha.','error');});
    }

    function removerEvento(evId) {
        const ev = S.eventos[evId]; if (!ev) return;
        if (!confirm(`Cancelar a ocorrência ${ev.tipo} @ ${ev.endereco}?`)) return;
        const updates = {}; _liberarVinculados(evId, updates); updates[`${PATH_EVENTOS}/${evId}`] = null;
        S.db.ref().update(updates).then(()=>toast('Ocorrência cancelada.','success')).catch(e=>{console.error(e);toast('Falha.','error');});
    }

    /* ── Relatórios ───────────────────────────────────────────────────────── */
    function gerarRelatorioViaturas() {
        const vl = _sorted(S.viaturas).filter(([,v])=>v.status==='disponivel');
        const eq = _sorted(S.viaturas).filter(([,v])=>v.status==='atuando');
        let txt = `*RELATÓRIO DE VIATURAS — VIA LIVRE*\n*Data:* ${hojeBR()}\n\n`;
        txt += `🟢 Disponíveis: ${vl.length}   🟡 Atuando: ${eq.length}   Total: ${vl.length+eq.length}\n\n`;
        if (vl.length) {
            txt += `---\n🟢 *DISPONÍVEIS (${vl.length}):*\n`;
            vl.forEach(([,v])=>{ txt+=`\n*VT ${v.vt}* — ${v.equipe||'N/I'}\n`; });
        }
        if (eq.length) {
            txt += `\n---\n🟡 *ATUANDO (${eq.length}):*\n`;
            eq.forEach(([,v])=>{ txt+=`\n*VT ${v.vt}* — ${v.equipe||'N/I'}\n`; if(v.qru) txt+=`QRU: ${v.qru}\n`; if(v.qth) txt+=`QTH: ${v.qth}\n`; });
        }
        const ta = g('nit-reboque-rel-viaturas-texto'); if(ta) ta.value=txt.trim();
        _abrirModal(g('nit-reboque-modal-rel-viaturas'));
    }

    function gerarRelatorioReboques() {
        const disp = _sorted(S.reboquistas).filter(([,r])=>r.status==='disponivel');
        const atua = _sorted(S.reboquistas).filter(([,r])=>r.status==='atuando');
        let txt = `*RELATÓRIO DE REBOQUES*\n*Data:* ${hojeBR()}\n\n`;
        txt += `🟢 Disponíveis: ${disp.length}   🟡 Atuando: ${atua.length}   Total: ${disp.length+atua.length}\n`;
        if (atua.length) {
            const grupos = {};
            atua.forEach(([,r])=>{ const k=r.ocorrencia||'N/I'; (grupos[k]=grupos[k]||[]).push(r); });
            txt += `\n---\n🟡 *EM ATENDIMENTO:*\n`;
            Object.entries(grupos).forEach(([oc,lista])=>{ txt+=`\n*${oc}*\n`; lista.forEach(r=>{ txt+=`- ${r.nome} (VT: ${r.vt||'N/I'})\n`; }); });
        }
        if (disp.length) {
            txt += `\n---\n🟢 *DISPONÍVEIS:*\n`;
            disp.forEach(([,r])=>{ txt+=`- ${r.nome} (VT: ${r.vt||'N/I'})\n`; });
        }
        const ta = g('nit-reboque-rel-reboques-texto'); if(ta) ta.value=txt.trim();
        _abrirModal(g('nit-reboque-modal-rel-reboques'));
    }

    function copiarRelatorioEvento(evId) {
        const ev = S.eventos[evId]; if (!ev) return;
        let txt = `*${ev.tipo}*\n*Local:* ${ev.endereco}`;
        if (ev.horario) txt += `\n*Horário:* ${ev.horario}`;
        if (ev.obs)     txt += `\n*Obs:* ${ev.obs}`;
        const rebs = Object.entries(ev.reboquistas||{});
        if (rebs.length) { txt+=`\n\n*Reboques:*`; rebs.forEach(([id,n])=>{ const r=S.reboquistas[id]||{}; txt+=`\n- ${n} (VT: ${r.vt||'N/I'})`; }); }
        const viats = Object.entries(ev.viaturas||{});
        if (viats.length) { txt+=`\n\n*Viaturas:*`; viats.forEach(([,n])=>{ txt+=`\n- ${n}`; }); }
        copiarTexto(txt).then(ok=>toast(ok?'Relatório copiado!':'Falha ao copiar.',ok?'success':'error'));
    }

    function limparPlantao() {
        if (!confirm('Limpar TODOS os dados de reboques, viaturas e ocorrências deste plantão?')) return;
        S.db.ref(PATH_BASE).remove().then(()=>toast('Painel limpo!','success')).catch(e=>{console.error(e);toast('Falha ao limpar.','error');});
    }

    /* ── Drag-and-drop ────────────────────────────────────────────────────── */
    function _onDragStart(e) {
        const card = e.target.closest('.nit-reboque-card'); if (!card) return;
        S.draggedId   = card.dataset.id;
        S.draggedTipo = card.dataset.tipo;
        S.isDragging  = true;
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', S.draggedId); } catch {}
        setTimeout(() => card.classList.add('arrastando'), 0);
    }
    function _onDragEnd() {
        S.isDragging = false; S.draggedId = null; S.draggedTipo = null;
        document.querySelectorAll('.nit-reboque-card.arrastando').forEach(c=>c.classList.remove('arrastando'));
        document.querySelectorAll('.nit-reboque-dropzone-ativa').forEach(c=>c.classList.remove('nit-reboque-dropzone-ativa'));
        if (S.pendingRender) { S.pendingRender = false; _render(); }
    }
    function _onDragOver(e) {
        const alvo = e.target.closest('.nit-reboque-dropzone, #nit-reboques-vialivre, #nit-reboques-reboques, .nit-reboque-evento-card');
        if (!alvo) return; e.preventDefault(); e.dataTransfer.dropEffect='move';
        alvo.classList.add('nit-reboque-dropzone-ativa');
    }
    function _onDragLeave(e) {
        const alvo = e.target.closest('.nit-reboque-dropzone, #nit-reboques-vialivre, #nit-reboques-reboques, .nit-reboque-evento-card');
        if (alvo) alvo.classList.remove('nit-reboque-dropzone-ativa');
    }
    function _onDrop(e) {
        const id = S.draggedId; const tipo = S.draggedTipo;
        if (!id) return; e.preventDefault();

        // ── dropzone tipada do acionamento ─────────────────────────────────
        const dz = e.target.closest('.nit-reboque-dropzone[data-tipo]');
        if (dz && _acionamentoAberto() && !S.editandoEventoId) {
            const dzTipo = dz.dataset.tipo;
            if (dzTipo !== tipo) { toast(`Arraste ${dzTipo==='reboquista'?'reboquistas':'viaturas'} para esta área.`,'error'); return; }
            _adicionarRecurso(id, tipo); return;
        }

        // ── evento existente (aloca ao evento) ─────────────────────────────
        const evCard = e.target.closest('.nit-reboque-evento-card');
        if (evCard) { _alocarAoEvento(id, tipo, evCard.dataset.eventoId); return; }

        // ── reordenação na coluna de viaturas ──────────────────────────────
        const colVL = e.target.closest('#nit-reboques-vialivre');
        if (colVL && tipo === 'viatura') {
            const ordem = _ordemNaPosicao(colVL, e.clientY);
            S.viaturas[id] = { ...S.viaturas[id], ordem }; _renderViaLivre();
            S.db.ref(`${PATH_VIATURAS}/${id}/ordem`).set(ordem).catch(()=>{});
            return;
        }
        if (colVL && tipo === 'reboquista') { toast('Arraste reboquistas para a coluna REBOQUES.','error'); return; }

        // ── reordenação na coluna de reboquistas ───────────────────────────
        const colR = e.target.closest('#nit-reboques-reboques');
        if (colR && tipo === 'reboquista') {
            const ordem = _ordemNaPosicao(colR, e.clientY);
            S.reboquistas[id] = { ...S.reboquistas[id], ordem }; _renderReboques();
            S.db.ref(`${PATH_REBOQUISTAS}/${id}/ordem`).set(ordem).catch(()=>{});
            return;
        }
        if (colR && tipo === 'viatura') { toast('Arraste viaturas para a coluna VIA LIVRE.','error'); return; }
    }

    function _alocarAoEvento(id, tipo, evId) {
        const ev = S.eventos[evId]; if (!ev) return;
        if (tipo === 'reboquista') {
            const r = S.reboquistas[id]; if (!r) return;
            if (r.status==='atuando'&&r.eventoId===evId) { toast(`${r.nome} já está neste evento.`,'info'); return; }
            const updates = {};
            if (r.eventoId) updates[`${PATH_EVENTOS}/${r.eventoId}/reboquistas/${id}`] = null;
            updates[`${PATH_EVENTOS}/${evId}/reboquistas/${id}`]   = r.nome;
            updates[`${PATH_REBOQUISTAS}/${id}/status`]            = 'atuando';
            updates[`${PATH_REBOQUISTAS}/${id}/eventoId`]          = evId;
            updates[`${PATH_REBOQUISTAS}/${id}/ocorrencia`]        = `${ev.tipo} @ ${ev.endereco}`;
            S.db.ref().update(updates).then(()=>toast(`${r.nome} alocado.`,'success')).catch(()=>{});
        } else {
            const v = S.viaturas[id]; if (!v) return;
            if (v.eventoId===evId) { toast(`VT ${v.vt} já está nesta ocorrência.`,'info'); return; }
            const label = `VT ${v.vt}${v.equipe?' — '+v.equipe:''}`;
            const updates = {};
            if (v.eventoId) updates[`${PATH_EVENTOS}/${v.eventoId}/viaturas/${id}`] = null;
            updates[`${PATH_EVENTOS}/${evId}/viaturas/${id}`] = label;
            updates[`${PATH_VIATURAS}/${id}/status`]          = 'atuando';
            updates[`${PATH_VIATURAS}/${id}/eventoId`]        = evId;
            updates[`${PATH_VIATURAS}/${id}/qru`]             = ev.tipo;
            updates[`${PATH_VIATURAS}/${id}/qth`]             = ev.endereco;
            S.db.ref().update(updates).then(()=>toast(`VT ${v.vt} alocada.`,'success')).catch(()=>{});
        }
    }

    function _ordemNaPosicao(container, y) {
        const cards = [...container.querySelectorAll('.nit-reboque-card:not(.arrastando)')];
        let ant=null,prox=null;
        for (const c of cards) { const b=c.getBoundingClientRect(); if(y<b.top+b.height/2){prox=c;break;} ant=c; }
        const ord = el => {
            const coll = el?.dataset?.tipo==='viatura' ? S.viaturas : S.reboquistas;
            return (coll[el?.dataset?.id]||{}).ordem??0;
        };
        if (!ant && !prox) return maxOrdem(S.reboquistas)+1;
        if (!ant)  return ord(prox)-1;
        if (!prox) return ord(ant)+1;
        return (ord(ant)+ord(prox))/2;
    }

    /* ── Sidebar do módulo Reboques ──────────────────────────────────────────── */
    function _bindSidebar() {
        const sidebar     = g('nit-rb-sidebar');
        const toggle      = g('nit-rb-btn-toggle');
        const textarea    = g('nit-rb-bruto');
        const placeholder = g('nit-rb-bruto-placeholder');

        toggle?.addEventListener('click', () => {
            sidebar?.classList.toggle('collapsed');
            toggle.setAttribute('aria-expanded', String(!sidebar?.classList.contains('collapsed')));
        });

        if (textarea && placeholder) {
            const sync = () => { placeholder.style.opacity = textarea.value ? '0' : '1'; };
            textarea.addEventListener('input', sync);
            sync();
        }

        // seção balanço toggle
        g('nit-rb-sec-balanco-header')?.addEventListener('click', () => {
            g('nit-rb-sec-balanco')?.classList.toggle('collapsed-sec');
        });
        g('nit-rb-sec-acoes-header')?.addEventListener('click', () => {
            g('nit-rb-sec-acoes')?.classList.toggle('collapsed-sec');
        });
    }

    /* ── Bind UI ──────────────────────────────────────────────────────────── */
    function _bindUI() {
        const on = (id, ev, fn) => g(id)?.addEventListener(ev, fn);

        // top bar
        _bindSidebar();
        on('nit-rb-btn-processar','click', processarPlantao);
        on('nit-reboque-btn-add-viatura','click',()=>abrirEdicaoViatura(null));
        on('nit-reboque-btn-add-reboquista','click',()=>abrirEdicaoReboquista(null));
        on('nit-reboque-btn-rel-viaturas','click', gerarRelatorioViaturas);
        on('nit-reboque-btn-rel-reboques','click', gerarRelatorioReboques);
        on('nit-reboque-btn-limpar','click', limparPlantao);
        on('nit-reboque-btn-nova-ocorrencia','click', abrirNovaOcorrencia);

        // busca ocorrências
        on('nit-reboque-busca-eventos','input', e=>{ S.buscaEventos=e.target.value.trim(); _renderEventos(); });

        // acionamento
        on('nit-reboque-acion-btn-confirmar','click', confirmarAcionamento);
        on('nit-reboque-acion-btn-cancelar','click',()=>{ g('nit-reboque-acionamento')?.classList.remove('aberto'); _resetAcionamento(); });
        // remover tags
        ['nit-reboque-acion-tags-reboques','nit-reboque-acion-tags-viaturas'].forEach(tid => {
            g(tid)?.parentElement?.addEventListener('click', e => {
                const x = e.target.closest('.nit-reboque-tag-x'); if (!x) return;
                const { id, tipo } = x.dataset;
                if (tipo==='reboquista') S.multi.reboquistaIds = S.multi.reboquistaIds.filter(i=>i!==id);
                else S.multi.viaturaIds = S.multi.viaturaIds.filter(i=>i!==id);
                _renderTagsAcionamento();
            });
        });

        // modal viatura
        on('nit-reboque-viatura-btn-salvar','click', salvarViatura);
        on('nit-reboque-viatura-btn-cancelar','click',()=>_fecharModal(g('nit-reboque-modal-viatura')));
        g('nit-reboque-modal-viatura')?.addEventListener('click',e=>{ if(e.target===g('nit-reboque-modal-viatura')) _fecharModal(g('nit-reboque-modal-viatura')); });

        // modal reboquista
        on('nit-reboque-edit-btn-salvar','click', salvarReboquista);
        on('nit-reboque-edit-btn-cancelar','click',()=>_fecharModal(g('nit-reboque-modal-edicao')));
        g('nit-reboque-modal-edicao')?.addEventListener('click',e=>{ if(e.target===g('nit-reboque-modal-edicao')) _fecharModal(g('nit-reboque-modal-edicao')); });

        // modais relatório
        on('nit-reboque-rel-viaturas-copiar','click',()=>copiarTexto(g('nit-reboque-rel-viaturas-texto')?.value||'').then(ok=>toast(ok?'Copiado!':'Falha ao copiar.',ok?'success':'error')));
        on('nit-reboque-rel-viaturas-fechar','click',()=>_fecharModal(g('nit-reboque-modal-rel-viaturas')));
        on('nit-reboque-rel-reboques-copiar','click',()=>copiarTexto(g('nit-reboque-rel-reboques-texto')?.value||'').then(ok=>toast(ok?'Copiado!':'Falha ao copiar.',ok?'success':'error')));
        on('nit-reboque-rel-reboques-fechar','click',()=>_fecharModal(g('nit-reboque-modal-rel-reboques')));

        // modal processar


        // ESC global
        document.addEventListener('keydown', e => {
            if (e.key!=='Escape'||!S.inicializado) return;
            [g('nit-reboque-modal-processar'),g('nit-reboque-modal-viatura'),g('nit-reboque-modal-edicao'),g('nit-reboque-modal-rel-viaturas'),g('nit-reboque-modal-rel-reboques')].forEach(_fecharModal);
            if (_acionamentoAberto()) { g('nit-reboque-acionamento')?.classList.remove('aberto'); _resetAcionamento(); }
        });

        // delegation na aba inteira
        g('tab-reboques')?.addEventListener('click', e => {
            // cards de viatura
            const vCard = e.target.closest('.nit-reboque-card[data-tipo="viatura"]');
            if (vCard) {
                const id = vCard.dataset.id;
                if (e.target.closest('.js-vt-acionar'))  { abrirAcionamento(id,'viatura'); return; }
                if (e.target.closest('.js-vt-finalizar')){ finalizarViatura(id); return; }
                if (e.target.closest('.js-vt-editar'))   { abrirEdicaoViatura(id); return; }
                if (e.target.closest('.js-vt-remover'))  { removerViatura(id); return; }
            }
            // cards de reboquista
            const rCard = e.target.closest('.nit-reboque-card[data-tipo="reboquista"]');
            if (rCard) {
                const id = rCard.dataset.id;
                if (e.target.closest('.js-acionar'))  { abrirAcionamento(id,'reboquista'); return; }
                if (e.target.closest('.js-finalizar')){ finalizarReboquista(id); return; }
                if (e.target.closest('.js-editar'))   { abrirEdicaoReboquista(id); return; }
                if (e.target.closest('.js-remover'))  { removerReboquista(id); return; }
            }
            // cards de evento
            const evCard = e.target.closest('.nit-reboque-evento-card');
            if (evCard) {
                const evId = evCard.dataset.eventoId;
                if (e.target.closest('.js-ev-editar'))    { abrirEdicaoEvento(evId); return; }
                if (e.target.closest('.js-ev-relatorio')) { copiarRelatorioEvento(evId); return; }
                if (e.target.closest('.js-ev-finalizar')) { finalizarEvento(evId); return; }
                if (e.target.closest('.js-ev-remover'))   { removerEvento(evId); return; }
            }
        });

        // DnD
        const tab = g('tab-reboques');
        tab?.addEventListener('dragstart', _onDragStart);
        tab?.addEventListener('dragend',   _onDragEnd);
        tab?.addEventListener('dragover',  _onDragOver);
        tab?.addEventListener('dragleave', _onDragLeave);
        tab?.addEventListener('drop',      _onDrop);
    }

    /* ── Tabs fallback & bootstrap ────────────────────────────────────────── */
    function _bindTabsFallback() {
        document.querySelector('.tab-navigation')?.addEventListener('click', e => {
            const btn = e.target.closest('.tab-button[data-tab]'); if (!btn) return;
            const alvo = document.getElementById(btn.dataset.tab); if (!alvo) return;
            document.querySelectorAll('.tab-button[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));
            document.querySelectorAll('.tab-content').forEach(t=>t.classList.toggle('active',t===alvo));
        });
    }

    function _bootstrap() {
        let tentativas = 0;
        const esperar = () => {
            const fb = window.firebase;
            if (fb?.apps?.length) { fb.auth().onAuthStateChanged(u => { if(u) inicializar(fb.database()); else destruir(); }); return; }
            if (++tentativas > 100) { console.error('[NitReboques] Firebase não inicializou.'); return; }
            setTimeout(esperar, 200);
        };
        esperar();
    }
    document.readyState === 'loading'
        ? window.addEventListener('DOMContentLoaded', _bootstrap)
        : _bootstrap();

    return { inicializar, destruir };
})();
