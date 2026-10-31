// Roteiro de homologação 13.2.1 — Parte 3: os caminhos de normalizar à mão (arrastar, Central) e arrastar de volta.
// Conferido no NIT real antes de ir para o roteiro. Uso: node gerar-caminhos-homolog.js <saida> <aaaa-mm-dd>
const fs = require('fs'), path = require('path');
const h = require('./harness');
const { montar } = require('./estresse-mundo');
const [, , OUT, DIA] = process.argv;
const [aa, mm, dd] = DIA.split('-'); const D = `${dd}/${mm}/${aa}`; const t = hm => `${D} ${hm}`;
const END = { 701: 'AV. BEZERRA DE MENEZES & R. JOÃO CORDEIRO', 702: 'AV. AGUANAMBI & R. PADRE FRANCISCO PINTO', 703: 'AV. 13 DE MAIO & AV. DA UNIVERSIDADE', 704: 'AV. PONTES VIEIRA & R. JOÃO CARVALHO' };
const P = (cod, ini) => ({ cod: String(cod), ini, tipo: 'ENEL', prob: 'APAGADO' }); const N = (cod, ini, fim) => ({ ...P(cod, ini), fim });
const relTxt = (p, n) => montar(D, p, n).replace(/RUA (\d+) & AV ESTRESSE/g, (_, c) => END[c]);
const txt = e => (e?.textContent || '').replace(/\s+/g, ' ').trim();
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const iso = `${DIA}T09:00:00`; const fb = h.criarFirebaseFalso({}, h.criarRelogio(iso));
  const A = await h.subirNIT({ estado: {}, relogioIso: iso, fb }), B = await h.subirNIT({ estado: {}, relogioIso: iso, fb });
  const doc = n => n.w.document;
  const card = (n, c) => doc(n).querySelector(`#tab-semaforo .kanban-card[data-codigo="${c}"]`);
  const no = c => Object.values(A.fb.estado().kanban || {}).filter(v => v.codigo === c);
  const dec = (n, msg, c) => doc(n).querySelector(`#nit-integridade-processamento .nd-card[data-msg="${msg}"][data-codigo="${c}"]`);
  const etq = (n, c) => [...doc(n).querySelectorAll(`#tab-semaforo .kanban-card[data-codigo="${c}"] .card-retificado, #tab-semaforo .kanban-card[data-codigo="${c}"] .card-manual`)].map(txt);
  const linhas = [], problemas = []; let passo = 0, nRel = 0;
  const confere = (ok, d) => { if (!ok) problemas.push(`passo ${passo}: ${d}`); return ok ? d : `⚠ ${d}`; };
  const processar = async (n, p, nn) => { const nome = `c${String(++nRel).padStart(2, '0')}.txt`; fs.writeFileSync(path.join(OUT, nome), relTxt(p, nn));
    await h.processar(n, relTxt(p, nn)); if (h.modalAberto(n)) await h.responderModal(n, true); await h.dormir(500); return nome; };
  const arrastar = async (n, c, col) => { const el = card(n, c), alvo = doc(n).querySelector(`#${col} .kanban-cards-container`);
    const ev = (tp, x) => { const e = new n.w.Event(tp, { bubbles: true, cancelable: true }); e.dataTransfer = { setData() {} }; e.clientY = 0; x.dispatchEvent(e); };
    ev('dragstart', el); ev('dragover', alvo); ev('drop', alvo); ev('dragend', el); await h.dormir(500); };
  const linha = (q, a, f, v) => linhas.push(`| ${passo} | ${q} | ${a} | ${f} | ${v.join('<br>')} |`);
  const R1p = [P(701, t('07:00')), P(702, ''), P(704, t('07:10'))], R1n = [N(703, t('06:00'), t('07:00'))];

  passo++; let r = await processar(A, R1p, R1n);
  linha('A', r, 'Processe.', [confere(!!dec(A, 'NIT-14', '702'), '⚠ 702 SEM HORA DE INÍCIO'), confere(card(A, '703')?.closest('#coluna-normalizados'), '703 em NORMALIZADOS')]);

  passo++; await arrastar(A, '701', 'coluna-normalizados');
  const n701 = no('701')[0] || {};
  linha('A', '—', '**Arraste** o card do **701** para NORMALIZADOS.', [
    confere(n701.status === 'NORMALIZADO' && !!n701.hora_fim && etq(A, '701').includes('✋ normalizado à mão · aguardando a fonte'), '701 normalizado com a **hora de agora** e "✋ normalizado à mão" (antes ficava sem fim)'),
    confere(etq(B, '701').includes('✋ normalizado à mão · aguardando a fonte'), 'na janela B: a mesma etiqueta')]);

  passo++; card(A, '702').click(); await h.dormir(300); doc(A).querySelector('.nit-central-tab[data-tab="normalizar"]')?.click(); await h.dormir(200);
  doc(A).getElementById('central-norm-data').value = DIA; doc(A).getElementById('central-norm-hora').value = '08:40'; doc(A).getElementById('btn-central-normalizar').click(); await h.dormir(500);
  linha('A', '—', 'Abra o card do **702** (clique nele) → aba **Normalizar** → hora **08:40** → confirmar.', [
    confere(no('702')[0]?.normManual && etq(A, '702').includes('✋ normalizado à mão · aguardando a fonte'), '702 em NORMALIZADOS com "✋ normalizado à mão" (antes a Central não marcava)')]);

  passo++; await arrastar(A, '703', 'coluna-espera');
  const n703 = no('703')[0] || {};
  linha('A', '—', '**Arraste** o card do **703** de NORMALIZADOS para AGUARDANDO.', [
    confere(n703.status === 'PENDENTE' && !n703.hora_fim && card(A, '703')?.closest('#coluna-espera'), '703 reaberto: em AGUARDANDO, sem fim (antes o banco continuava NORMALIZADO)')]);

  passo++; r = await processar(A, R1p, R1n);
  linha('A', r, 'Processe (o mesmo relatório: a fonte ainda não sabe).', [
    confere(dec(A, 'NIT-17', '701') && dec(A, 'NIT-17', '702') && !dec(A, 'NIT-11', '701') && !dec(A, 'NIT-11', '702'), 'avisos azuis "ℹ 701 NORMALIZADO À MÃO" e "ℹ 702 NORMALIZADO À MÃO" — sem "VOLTOU ATRÁS"'),
    confere(no('702').length === 1, '702: continua UM card (antes a Central criava outro)'),
    confere(card(A, '703')?.closest('#coluna-normalizados'), '703 volta a NORMALIZADOS (a fonte diz normalizado)')]);

  passo++; r = await processar(B, [P(704, t('07:10'))], [...R1n, N(701, t('07:00'), t('08:30')), N(702, t('06:45'), t('08:20'))]); await h.dormir(400);
  linha('B', r, 'Na **janela B**, processe (a fonte fechou 701 e 702).', [
    confere(no('701').length === 1 && no('701')[0].hora_fim === '08:30' && etq(B, '701').some(x => /^⟲ fim corrigido .* → 08:30$/.test(x)), '701: um card, fim 08:30, "⟲ fim corrigido (hora do arraste) → 08:30"'),
    confere(no('702').length === 1 && no('702')[0].inicio === t('06:45') && etq(B, '702').includes('⟲ fim corrigido 08:40 → 08:20'), '702: **um card só**, início 06:45, "⟲ fim corrigido 08:40 → 08:20"'),
    confere(!etq(B, '701').some(x => /✋/.test(x)) && !etq(B, '702').some(x => /✋/.test(x)), 'sem a etiqueta ✋ (vale a fonte)')]);

  const md = `# 13.2.1 — Parte 3: arrastar e Central (${D})

Apague o nó \`kanban\` do **nit-homologacao**; duas janelas (A e B); Ctrl+F5.

| # | Quem | Relatório | O que você faz | O que deve aparecer |
|---|---|---|---|---|
${linhas.join('\n')}
`;
  fs.writeFileSync(path.join(OUT, 'ROTEIRO-PARTE-3.md'), md); console.log(md);
  console.log(problemas.length ? 'PROBLEMAS:\n' + problemas.join('\n') : 'CONFERIDO: tudo aparece como o roteiro diz');
  process.exit(0);
})();
