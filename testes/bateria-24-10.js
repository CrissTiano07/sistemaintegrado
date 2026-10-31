// Bateria 13.2.1 — ajustes autorizados em 24/10/2026 (homologação da madrugada):
//  A1 linha sem hora de início não grava "Início:" como observação
//  A2 card que já nasce normalizado não mostra o ⏳ do início
//  A3 linha repetida → aviso azul NIT-36 (só informativo); sem repetição, nenhum
//  A4 LINHA DO TEMPO: resumo, filtros, blocos por relatório, leituras recolhidas
const h = require('./harness');
const { montar } = require('./estresse-mundo');
const D = '24/10/2026', t = x => `${D} ${x}`;
const doc = n => n.w.document;
const txt = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
const R = [];
const ck = (ok, d) => ({ ok: !!ok, d });
function reg(id, nome, cs) { const s = cs.every(c => c.ok) ? 'PASSOU' : 'FALHOU'; R.push(s); console.log(`${s.padEnd(7)} ${id} ${nome}`); cs.forEach(c => console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`)); }
async function proc(n, p, q) { await h.processar(n, montar(D, p, q)); while (h.modalAberto(n)) await h.responderModal(n, true); await h.dormir(500); }
const card = (n, c) => doc(n).querySelector(`#tab-semaforo .kanban-card[data-codigo="${c}"]`);
(async () => {
  const A = await h.subirNIT({ estado: {}, relogioIso: '2026-10-24T02:00:00' });
  await proc(A, [{ cod: '902', ini: '' }, { cod: '500', ini: t('01:00') }], [{ cod: '199', ini: t('00:02'), fim: t('00:10') }]);
  const n902 = Object.values(A.fb.estado().kanban).find(v => v.codigo === '902');
  reg('A1', 'Linha sem hora de início não vira observação "Início:"', [
    ck(!/In[ií]cio:/.test(n902?.observacoes || ''), `banco: observação "${n902?.observacoes || ''}"`),
    ck(!/In[ií]cio:/.test(txt(card(A, '902'))), `card: "${txt(card(A, '902'))}"`),
  ]);
  reg('A2', 'Card que já nasce normalizado não mostra o ⏳ do início', [
    ck(!/⏳/.test(txt(card(A, '199'))) && /00:10/.test(txt(card(A, '199'))), `card: "${txt(card(A, '199'))}"`),
  ]);
  const nit36 = () => doc(A).querySelector('#nit-integridade-processamento .nd-card[data-msg="NIT-36"]');
  const vistos = []; new A.w.MutationObserver(ms => ms.forEach(x => x.addedNodes.forEach(e => e.classList?.contains('toast') && vistos.push(txt(e))))).observe(doc(A).getElementById('toast-container'), { childList: true });
  await proc(A, [{ cod: '500', ini: t('01:00') }, { cod: '500', ini: t('01:00') }, { cod: '902', ini: t('01:25') }], [{ cod: '199', ini: t('00:02'), fim: t('00:10') }]);
  const aud = JSON.stringify(A.fb.estado().auditoria || {});
  reg('A3', 'Linha repetida: não polui o painel — aviso passageiro + LINHA DO TEMPO', [
    ck(!nit36(), 'nenhum card de aviso no painel'),
    ck(vistos.some(x => /500 VEIO 2 VEZES NO RELATÓRIO\. Contado uma vez só\./.test(x)), `aviso passageiro: ${vistos.join(' || ')}`),
    ck(/Informações incompletas: [^"]*500 veio 2 vezes \(contado 1\)/.test(aud), 'LINHA DO TEMPO: "⚠ Informações incompletas: 500 veio 2 vezes (contado 1)"'),
    ck(doc(A).querySelectorAll('#tab-semaforo .kanban-card[data-codigo="500"]').length === 1, 'um card só do 500'),
  ]);
  await proc(A, [{ cod: '500', ini: t('01:00') }, { cod: '902', ini: t('01:25') }, { cod: '17', ini: t('01:40') }], [{ cod: '199', ini: t('00:02'), fim: t('00:10') }]);
  doc(A).getElementById('nit-diario-btn').click(); await h.dormir(400);
  const ov = doc(A).getElementById('nit-diario');
  const itens = () => [...ov.querySelectorAll('.nit-diario-item')];
  const tudo = itens().length;
  ov.querySelector('[data-filtro="erros"]').click(); await h.dormir(100);
  const soErros = itens().map(txt);
  const errosSoErro = !soErros.some(x => /Entraram|Normalizaram/.test(x)); const pilErros = txt(ov.querySelector('[data-filtro="erros"]'));
  ov.querySelector('[data-filtro="correcoes"]').click(); await h.dormir(100);
  const corr = itens().map(txt); const corrAberto = [...ov.querySelectorAll('details.ndt-leit')].every(d => d.open) && !corr.some(x => /Entraram/.test(x));
  ov.querySelector('[data-filtro="tudo"]').click(); await h.dormir(100);
  const ultimo = itens()[0];
  reg('A4', 'LINHA DO TEMPO: resumo, filtros e blocos', [
    ck(txt(doc(A).getElementById('nit-diario-btn')) === '📜 LINHA DO TEMPO', 'botão "📜 LINHA DO TEMPO"'),
    ck(/Agora\s*3 pendentes 1 normalizado/.test(txt(ov.querySelector('.ndt-resumo'))), `resumo: "${txt(ov.querySelector('.ndt-resumo'))}"`),
    ck(tudo === 3, `3 blocos (veio ${tudo})`),
    ck(soErros.length === 2 && /902/.test(soErros.join(' ')) && /500 veio 2 vezes/.test(soErros.join(' ')), `filtro Informações incompletas: 902 sem hora e 500 repetido (${soErros.length})`),
    ck(corr.length === 2, `filtro Correções: 902 corrigido e 017 lido sem zero (${corr.length})`),
    ck(errosSoErro && /Informações incompletas 2/.test(pilErros), `filtro Erros mostra só as linhas de erro e conta itens (${pilErros})`),
    ck(corrAberto, 'filtro Correções mostra só correções, com as de digitação abertas'),
    ck(ultimo && /\+1 pendente/.test(txt(ultimo.querySelector('.ndt-btopo'))), `delta no último bloco: "${txt(ultimo?.querySelector('.ndt-btopo'))}"`),
    ck(ultimo && ultimo.querySelector('details.ndt-leit summary') && !ultimo.querySelector('details.ndt-leit').open && /"17" → 017/.test(txt(ultimo.querySelector('details.ndt-leit'))) && /^Correções de digitação \(1\)$/.test(txt(ultimo.querySelector('details.ndt-leit summary'))), 'leitura "17" → 017 recolhida em "1 leitura corrigida…"'),
  ]);
  const f = R.filter(x => x !== 'PASSOU').length;
  console.log('RESUMO 24-10', f ? { FALHOU: f, PASSOU: R.length - f } : { PASSOU: R.length });
  process.exit(0);
})();
