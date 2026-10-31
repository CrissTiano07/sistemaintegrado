// Roteiro de homologação 13.2.1 — Parte 4: erros da fonte que duplicavam card (BR-DEC-005).
// Cada passo roda no NIT do laboratório e é CONFERIDO antes de ir para o roteiro.
// Uso: node gerar-duplicacao-homolog.js <pasta-saida> <aaaa-mm-dd>
const fs = require('fs'), path = require('path');
const h = require('./harness');
const { montar } = require('./estresse-mundo');
const [, , OUT, DIA] = process.argv;
const [aa, mm, dd] = DIA.split('-'); const D = `${dd}/${mm}/${aa}`, t = x => `${D} ${x}`;
const END = { '081': 'AV. BEZERRA DE MENEZES & R. OLAVO BILAC', 802: 'AV. CARAPINIMA & R. PE. FRANCISCO PINTO', 803: 'R. ARI MAIA & R. OSCAR ARARIPE',
  804: 'AV. ROGACIANO LEITE & AV. DES. GONZAGA', 805: 'R. JOSÉ VILAR & R. JOÃO CARVALHO', 806: 'R. PADRE VALDEVINO & AV. DOM MANUEL' };
const relTxt = (p, n) => montar(D, p, n).replace(/RUA (\d+) & AV ESTRESSE/g, (_, c) => END[c] || END[c.padStart(3, '0')] || `RUA ${c}`);
const P = (cod, ini) => ({ cod, ini, tipo: 'ENEL' }), N = (cod, ini, fim) => ({ cod, ini, fim, tipo: 'ENEL' });
const PASSOS = [
  { nome: 'd01-inicio.txt', quem: 'A', p: [P('081', t('01:10')), P('802', t('01:20'))],
    n: [N('803', t('00:05'), t('00:40')), N('804', t('00:30'), t('01:15')), N('805', '', t('00:50')), N('806', t('00:03'), t('00:20')), N('806', t('00:03'), t('00:20'))],
    o: '806 vem REPETIDO (mesma linha 2 vezes) e 805 vem SEM início. Aviso passageiro (some sozinho): "ℹ 806 VEIO 2 VEZES NO RELATÓRIO. Contado uma vez só." Nenhum card de aviso para o 806; só o amarelo "⚠ 805 SEM HORA DE INÍCIO". Na LINHA DO TEMPO, em Informações incompletas: "806 veio 2 vezes (contado 1)".', aviso36: '806',
    esp: { '081': 'pendente 01:10', 802: 'pendente 01:20', 803: 'normalizado 00:05→00:40', 804: 'normalizado 00:30→01:15', 805: 'normalizado (sem início)→00:50', 806: 'normalizado 00:03→00:20' }, tot: '2 pendentes · 4 normalizados' },
  { nome: 'd02-fonte-com-erros.txt', quem: 'B', p: [P('81', t('01:10')), P('802', t('01:20'))],
    n: [N('803', '', t('00:40')), N('804', t('00:22'), t('01:15')), N('805', '', t('00:50')), N('806', t('00:03'), t('00:20'))],
    o: '"81" sem o zero · 803 perdeu o início · 804 com início corrigido para 00:22 · 805 ainda sem início.',
    esp: { '081': 'pendente 01:10', 802: 'pendente 01:20', 803: 'normalizado 00:05→00:40', 804: 'normalizado 00:22→01:15', 805: 'normalizado (sem início)→00:50', 806: 'normalizado 00:03→00:20' }, tot: '2 pendentes · 4 normalizados' },
  { nome: 'd03-fonte-corrigindo.txt', quem: 'A', p: [P('081', t('01:10'))],
    n: [N('802', '', t('01:50')), N('803', t('00:05'), t('00:40')), N('804', t('00:30'), t('01:15')), N('805', t('00:15'), t('00:50')), N('806', t('00:03'), t('00:20'))],
    o: '802 normaliza numa linha SEM início · 804 volta para 00:30 · 805 ganha o início 00:15.',
    esp: { '081': 'pendente 01:10', 802: 'normalizado 01:20→01:50', 803: 'normalizado 00:05→00:40', 804: 'normalizado 00:30→01:15', 805: 'normalizado 00:15→00:50', 806: 'normalizado 00:03→00:20' }, tot: '1 pendente · 5 normalizados' },
  { nome: 'd04-correto.txt', quem: 'B', p: [P('081', t('01:10'))],
    n: [N('802', t('01:20'), t('01:50')), N('803', t('00:05'), t('00:40')), N('804', t('00:30'), t('01:15')), N('805', t('00:15'), t('00:50')), N('806', t('00:03'), t('00:20'))],
    o: 'Relatório certo.',
    esp: { '081': 'pendente 01:10', 802: 'normalizado 01:20→01:50', 803: 'normalizado 00:05→00:40', 804: 'normalizado 00:30→01:15', 805: 'normalizado 00:15→00:50', 806: 'normalizado 00:03→00:20' }, tot: '1 pendente · 5 normalizados' },
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const iso = `${DIA}T02:20:00`; const fb = h.criarFirebaseFalso({}, h.criarRelogio(iso));
  const A = await h.subirNIT({ estado: {}, relogioIso: iso, fb }), B = await h.subirNIT({ estado: {}, relogioIso: iso, fb });
  const doc = n => n.w.document; const problemas = []; const md = [];
  const tot = n => { const v = [...doc(n).querySelectorAll('#tab-semaforo .kanban-card')]; const p = v.filter(x => !x.closest('#coluna-normalizados')).length, q = v.length - p;
    return `${p} pendente${p === 1 ? '' : 's'} · ${q} normalizado${q === 1 ? '' : 's'}`; };
  const desc = (n, c) => [...doc(n).querySelectorAll(`#tab-semaforo .kanban-card[data-codigo="${c}"]`)].map(x => `${x.closest('#coluna-normalizados') ? 'normalizado' : 'pendente'} ${(x.dataset.inicio || '').slice(11) || '(sem início)'}${x.closest('#coluna-normalizados') ? '→' + (x.dataset.hora_fim || (x.dataset.fim || '').slice(11)) : ''}`.replace(' (sem início)→', ' (sem início)→'));
  md.push(`# Parte 4 — erros da fonte que duplicavam card (13.2.1)`, '', `Relatórios de **${D}**. Kanban limpo antes de começar. Duas janelas (A e B) no mesmo banco, como nas outras partes.`, '',
    'Em **todos** os passos: cada semáforo tem **um card só** e os números batem com o cabeçalho.', '');
  for (const [i, s] of PASSOS.entries()) {
    const n = s.quem === 'A' ? A : B;
    fs.writeFileSync(path.join(OUT, s.nome), relTxt(s.p, s.n));
    await h.processar(n, relTxt(s.p, s.n)); while (h.modalAberto(n)) await h.responderModal(n, true); await h.dormir(900);
    const linhas = [];
    for (const [c, e] of Object.entries(s.esp)) {
      const v = desc(A, c), w = desc(B, c);
      const ok = v.length === 1 && v[0] === e && JSON.stringify(v) === JSON.stringify(w);
      if (!ok) problemas.push(`${s.nome} ${c}: A=${v.join(' | ')} B=${w.join(' | ')} esperado ${e}`);
      linhas.push(`   - **${c}**: ${e.replace('(sem início)', 'sem início')}`);
    }
    if (s.aviso36 && (doc(A).querySelector('#nit-integridade-processamento .nd-card[data-msg="NIT-36"]') || !JSON.stringify(fb.estado().auditoria || {}).includes(`${s.aviso36} veio 2 vezes (contado 1)`))) problemas.push(`${s.nome}: NIT-36 do ${s.aviso36} errado`);
    const sobra = [...doc(A).querySelectorAll('#tab-semaforo .kanban-card')].filter(x => !Object.keys(s.esp).includes(x.dataset.codigo)).map(x => x.dataset.codigo);
    if (sobra.length) problemas.push(`${s.nome}: cards a mais ${sobra}`);
    if (tot(A) !== s.tot || tot(B) !== s.tot) problemas.push(`${s.nome}: totais A=${tot(A)} B=${tot(B)} esperado ${s.tot}`);
    md.push(`## Passo ${i + 1} — janela ${s.quem}: \`${s.nome}\``, '', s.o, '', `Esperado nas duas janelas — **${s.tot}**:`, ...linhas, '');
  }
  const d = doc(A); d.getElementById('check-incluir-normalizados').checked = true; d.getElementById('btn-visualizar-relatorio').click(); await h.dormir(200);
  if (h.modalAberto(A)) await h.responderModal(A, true); await h.dormir(200);
  const sai = d.getElementById('modal-relatorio-texto').value.split('\n').filter(l => /^\d{3,4} 🚦/.test(l));
  if (sai.length !== 6) problemas.push(`saída com ${sai.length} linhas`);
  const dia = JSON.stringify(fb.estado().auditoria || {});
  for (const x of ['Código lido com correção: \\"81\\" → 081', 'Início corrigido no relatório: 804']) if (!dia.includes(x.replace(/\\"/g, '\\"'))) problemas.push(`📜 sem "${x}"`);
  md.push('## No fim', '', '- Gerar o relatório de saída (com normalizados): **6 linhas**, uma por semáforo, 081 com o zero.',
    '- 📜 LINHA DO TEMPO: "ℹ Código lido com correção: "81" → 081" (uma vez) e "⟲ Início corrigido no relatório: 804 (00:30 → 00:22)" e depois "804 (00:22 → 00:30)".', '',
    '**Se qualquer semáforo aparecer em dois cards, parar e mandar print.**');
  fs.writeFileSync(path.join(OUT, 'ROTEIRO-PARTE-4.md'), md.join('\n') + '\n');
  console.log(problemas.length ? '✗ ' + problemas.join('\n✗ ') : `✓ Parte 4 conferida (${PASSOS.length} relatórios, saída 6 linhas)`);
  process.exit(problemas.length ? 1 : 0);
})();
