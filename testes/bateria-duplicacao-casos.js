// Bateria 13.2.1 — casos de duplicação achados pela bateria-duplicacao.js (23/10/2026), um a um.
// Cada caso: sequência de relatórios → no fim, cards do semáforo (quantos, coluna, início→fim) e linhas na saída.
const h = require('./harness');
const { montar } = require('./estresse-mundo');
const D = '18/10/2026', t = x => `${D} ${x}`;
const doc = n => n.w.document;
const cards = (n, cod) => [...doc(n).querySelectorAll('#tab-semaforo .kanban-card')].filter(c => c.dataset.codigo.replace(/^0+/, '') === cod.replace(/^0+/, ''))
  .map(c => `${c.closest('.kanban-column').id.replace('coluna-', '')} ${(c.dataset.inicio || '').slice(11) || 'SI'}→${c.dataset.hora_fim || (c.dataset.fim || '').slice(11)}`).sort();
async function saida(n, cod) {
  const d = doc(n); d.getElementById('check-incluir-normalizados').checked = true;
  d.getElementById('btn-visualizar-relatorio').click(); await h.dormir(200); if (h.modalAberto(n)) await h.responderModal(n, true); await h.dormir(150);
  const r = d.getElementById('modal-relatorio-texto').value.split('\n').filter(l => l.split(' ')[0].replace(/^0+/, '') === cod.replace(/^0+/, '')); d.getElementById('btn-modal-fechar')?.click(); return r.length;
}
const R = [];
async function caso(id, nome, cod, relatorios, esperado, extra) {
  const A = await h.subirNIT({ estado: {}, relogioIso: '2026-10-18T12:00:00' });
  for (const x of relatorios) { if (typeof x === 'function') { await x(A); continue; } const [p, n] = x; await h.processar(A, montar(D, p, n)); while (h.modalAberto(A)) await h.responderModal(A, true); await h.dormir(300); }
  if (extra) await extra(A);
  const c = cards(A, cod), s = await saida(A, cod);
  const ok = JSON.stringify(c) === JSON.stringify(esperado.sort()) && s === esperado.length;
  R.push(ok); console.log(`${ok ? 'PASSOU' : 'FALHOU'}  ${id} ${nome}\n   ${ok ? '✓' : '✗'} painel: ${c.join(' · ') || '—'} · saída: ${s} linha(s)${ok ? '' : `  (esperado: ${esperado.join(' · ')})`}`);
  A.dom.window.close();
}
(async () => {
  await caso('X1', 'código sem o zero ("17") é o 017', '017',
    [[[{ cod: '017', ini: t('04:16') }], []], [[{ cod: '17', ini: t('04:16') }], []], [[{ cod: '017', ini: t('04:16') }], []]],
    ['espera 04:16→']);
  await caso('X2', 'normalizado: a linha volta sem início (mesmo fim) — não abre outro', '500',
    [[[], [{ cod: '500', ini: t('04:16'), fim: t('05:28') }]], [[], [{ cod: '500', ini: '', fim: t('05:28') }]], [[], [{ cod: '500', ini: t('04:16'), fim: t('05:28') }]]],
    ['normalizados 04:16→05:28']);
  await caso('X3', 'normalizado: linha sem início + falha nova com início', '500',
    [[[], [{ cod: '500', ini: t('04:16'), fim: t('05:28') }]], [[{ cod: '500', ini: t('08:25') }], [{ cod: '500', ini: '', fim: t('05:28') }]],
     [[{ cod: '500', ini: t('08:25') }], [{ cod: '500', ini: t('04:16'), fim: t('05:28') }]]],
    ['normalizados 04:16→05:28', 'espera 08:25→']);
  await caso('X4', 'pendente com início: linha encerrada sem início fecha o card e mantém o início', '500',
    [[[{ cod: '500', ini: t('08:25') }], []], [[], [{ cod: '500', ini: '', fim: t('09:03') }]], [[], [{ cod: '500', ini: t('08:25'), fim: t('09:03') }]]],
    ['normalizados 08:25→09:03']);
  await caso('X5', 'a mesma linha repetida no relatório é uma ocorrência só', '500',
    [[[], [{ cod: '500', ini: t('03:18'), fim: t('05:03') }, { cod: '500', ini: t('03:18'), fim: t('05:03') }]], [[], [{ cod: '500', ini: t('03:18'), fim: t('05:03') }]]],
    ['normalizados 03:18→05:03']);
  await caso('X6', 'linha repetida depois de o card existir', '500',
    [[[], [{ cod: '500', ini: t('03:18'), fim: t('05:03') }]], [[], [{ cod: '500', ini: t('03:18'), fim: t('05:03') }, { cod: '500', ini: t('03:18'), fim: t('05:03') }]]],
    ['normalizados 03:18→05:03']);
  await caso('X7', 'fonte corrige o início de um normalizado (06:50 → 06:05)', '500',
    [[[], [{ cod: '500', ini: t('06:50'), fim: t('08:15') }]], [[], [{ cod: '500', ini: t('06:05'), fim: t('08:15') }]]],
    ['normalizados 06:05→08:15']);
  await caso('X8', '... e depois volta ao início anterior', '500',
    [[[], [{ cod: '500', ini: t('06:50'), fim: t('08:15') }]], [[], [{ cod: '500', ini: t('06:05'), fim: t('08:15') }]], [[], [{ cod: '500', ini: t('06:50'), fim: t('08:15') }]]],
    ['normalizados 06:50→08:15']);
  await caso('X9', 'normalizado sem início pela fonte, várias vezes, depois com início (_SI, _SI_2… não)', '500',
    [[[], [{ cod: '500', ini: '', fim: t('05:28') }]], [[], [{ cod: '500', ini: '', fim: t('05:28') }]], [[], [{ cod: '500', ini: '', fim: t('05:28') }]],
     [[], [{ cod: '500', ini: t('04:16'), fim: t('05:28') }]]],
    ['normalizados 04:16→05:28']);
  await caso('X10', 'reincidência real continua virando 2 cards (não é duplicação)', '500',
    [[[], [{ cod: '500', ini: t('03:15'), fim: t('06:27') }]], [[{ cod: '500', ini: t('10:00') }], [{ cod: '500', ini: t('03:15'), fim: t('06:27') }]]],
    ['normalizados 03:15→06:27', 'espera 10:00→']);
  await caso('X11', 'duas falhas normalizadas, uma troca o início: só ela muda', '500',
    [[[], [{ cod: '500', ini: t('03:15'), fim: t('04:00') }, { cod: '500', ini: t('07:00'), fim: t('08:00') }]],
     [[], [{ cod: '500', ini: t('03:15'), fim: t('04:00') }, { cod: '500', ini: t('06:40'), fim: t('08:00') }]]],
    ['normalizados 03:15→04:00', 'normalizados 06:40→08:00']);
  const aMao = async A => { doc(A).querySelector('#coluna-espera .kanban-card[data-codigo="500"] .btn-card-action.complete').click(); await h.dormir(150);
    doc(A).getElementById('norm-hora-fim').value = '08:30'; doc(A).getElementById('btn-norm-confirmar').click(); await h.dormir(5800); };
  await caso('X12', 'normalizado à mão; a fonte corrige o início (ainda aberto) e depois fecha', '500',
    [[[{ cod: '500', ini: t('07:37') }], []], aMao, [[{ cod: '500', ini: t('07:47') }], []], [[], [{ cod: '500', ini: t('07:47'), fim: t('08:28') }]]],
    ['normalizados 07:47→08:28']);
  await caso('X13', 'normalizado volta ABERTO com início trocado (05:28 → 05:13) e depois fecha', '500',
    [[[], [{ cod: '500', ini: t('05:28'), fim: t('05:52') }]], [[{ cod: '500', ini: t('05:13') }], []], [[], [{ cod: '500', ini: t('05:13'), fim: t('05:52') }]]],
    ['normalizados 05:13→05:52']);
  await caso('X14', 'pendente com início: fonte fecha numa linha sem início e abre falha nova', '500',
    [[[{ cod: '500', ini: t('04:31') }], []], [[{ cod: '500', ini: t('07:04') }], [{ cod: '500', ini: '', fim: t('06:26') }]],
     [[{ cod: '500', ini: t('07:04') }], [{ cod: '500', ini: t('04:31'), fim: t('06:26') }]]],
    ['normalizados 04:31→06:26', 'espera 07:04→']);
  await caso('X15', 'sem início normalizado pela fonte; depois vem com início + falha nova sem início', '500',
    [[[{ cod: '500', ini: '' }], []], [[], [{ cod: '500', ini: '', fim: t('05:46') }]],
     [[{ cod: '500', ini: '' }], [{ cod: '500', ini: t('05:12'), fim: t('05:46') }]],
     [[{ cod: '500', ini: t('06:35') }], [{ cod: '500', ini: t('05:12'), fim: t('05:46') }]]],
    ['normalizados 05:12→05:46', 'espera 06:35→']);
  const aMao2 = async A => { doc(A).querySelector('#coluna-espera .kanban-card[data-codigo="500"] .btn-card-action.complete').click(); await h.dormir(150);
    doc(A).getElementById('norm-hora-fim').value = '06:12'; doc(A).getElementById('btn-norm-confirmar').click(); await h.dormir(5800); };
  await caso('X16', 'normalizado à mão; a fonte corrige o início e fecha, junto com falha nova de hora ilegível', '500',
    [[[{ cod: '500', ini: t('04:11') }], []], aMao2, [[{ cod: '500', ini: `${D} 0642` }], [{ cod: '500', ini: t('04:28'), fim: t('06:12') }]],
     [[], [{ cod: '500', ini: t('04:28'), fim: t('06:12') }, { cod: '500', ini: t('06:42'), fim: t('08:17') }]]],
    ['normalizados 04:28→06:12', 'normalizados 06:42→08:17']);
  const f = R.filter(x => !x).length;
  console.log('RESUMO duplicação-casos', f ? { FALHOU: f, PASSOU: R.length - f } : { PASSOU: R.length });
  process.exit(0);
})();
