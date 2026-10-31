// Bateria 14.1 — barra lateral pela especificação de 22/10/2026.
const h = require('./harness');
const { montar } = require('./estresse-mundo');
const R = []; const ck = (ok, d) => ({ ok: !!ok, d });
function reg(id, nome, cs) { const s = cs.every(c => c.ok) ? 'PASSOU' : 'FALHOU'; R.push(s); console.log(`${s.padEnd(7)} ${id} ${nome}`); cs.forEach(c => console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`)); }
const D = '30/10/2026', t = x => `${D} ${x}`, ISO = '2026-10-30T20:19:00';
const doc = n => n.w.document;
const causas = n => [...doc(n).querySelectorAll('#sb-causas .sb-causa')].map(e => `${e.querySelector('span')?.textContent}:${e.querySelector('b')?.textContent}`);
(async () => {
  const fb = h.criarFirebaseFalso({}, h.criarRelogio(ISO));
  const A = await h.subirNIT({ estado: {}, relogioIso: ISO, fb });
  try { A.w.localStorage.setItem('nit-sidebar-collapsed', '1'); } catch (e) {}
  const B = await h.subirNIT({ estado: {}, relogioIso: ISO, fb }); await h.dormir(500);
  const d = doc(B), sec = d.getElementById('sb-sec-saida');
  const ordem = [...sec.querySelector('.sb-inner').children].filter(e => !e.hidden).map(e => e.id || e.className.split(' ')[0]);
  reg('SB1', 'Barra lateral sempre aberta e SAÍDA na ordem combinada', [
    ck(!d.getElementById('btn-sb-toggle') && !d.getElementById('sidebar').classList.contains('collapsed'), 'sem botão de recolher; aberta mesmo com "recolhida" guardada no navegador'),
    ck(d.getElementById('relatorio-final-preview').hidden, 'pré-visualização retirada da tela'),
    ck(JSON.stringify(ordem) === JSON.stringify(['sb-estado', 'balanco-compacto', 'btn-visualizar-relatorio', 'form-check', 'sb-resumo']), `ordem: ${ordem.join(' → ')}`),
  ]);
  const P = [{ cod: '1087', ini: t('18:09'), causa: 'ENEL' }, { cod: '183', ini: t('16:35'), causa: 'ROMPIMENTO' }, { cod: '483', ini: t('18:09'), causa: 'ENEL' }];
  const N = [{ cod: '404', ini: t('15:00'), fim: t('17:30'), causa: 'ENEL' }, { cod: '225', ini: t('15:00'), fim: t('17:30'), causa: 'FURTO' }];
  let txt = montar(D, P, N);
  // a causa vem na 1ª coluna da linha do relatório
  [...P, ...N].forEach(x => { txt = txt.replace(new RegExp(`^[^\\t\\n]*(\\t\\*🚦\\t${x.cod}\\t)`, 'm'), `${x.causa}$1`); });
  await h.processar(A, txt); while (h.modalAberto(A)) await h.responderModal(A, true); await h.dormir(900);
  const p = h.painel(B), cs = causas(B), soma = cs.reduce((a, x) => a + +x.split(':')[1], 0);
  reg('SB2', 'CAUSAS DO DIA: maior → menor, só as ocorridas, somando o total de Ocorrências; linha de estado igual para todos', [
    ck(cs[0] === 'ENEL:3' && cs.length === 3, `causas: ${cs.join(' · ')}`),
    ck(soma === +p.total, `soma ${soma} = Ocorrências ${p.total}`),
    ck(/^✓ ATUALIZADO 20:19 · COLADO$/.test(d.getElementById('sb-estado').textContent), `outra janela: "${d.getElementById('sb-estado').textContent}"`),
    ck(!sec.querySelector('.sb-section-header'), 'sem o título SAÍDA'),
  ]);
  // 1087 vai para VIA LIVRE e normaliza; 483 vai para AMC
  const kb = A.fb.estado().kanban, id = c => Object.keys(kb).find(k => kb[k].codigo === c);
  await A.w.NitFirebase.db.ref(`kanban/${id('1087')}`).update({ coluna: 'coluna-vl', sub: 'vl', pl: 'atend', colunaN: 'VIA LIVRE' });
  await A.w.NitFirebase.db.ref(`kanban/${id('483')}`).update({ coluna: 'coluna-amc', sub: 'amc', pl: 'atend', colunaN: 'AMC' }); await h.dormir(500);
  await A.w.NitFirebase.db.ref(`kanban/${id('1087')}`).update({ coluna: 'coluna-normalizados', status: 'NORMALIZADO', data_fim: D, hora_fim: '20:15', pl: 'norm' }); await h.dormir(700);
  await h.dormir(500);
  const at = n => `VL ${doc(n).getElementById('sb-at-vl').textContent} · AMC ${doc(n).getElementById('sb-at-amc').textContent}`;
  reg('SB3', 'ATENDIDOS: conta quem passou por VIA LIVRE/AMC, mesmo depois de normalizado', [
    ck(at(A) === 'VL 1 · AMC 1' && at(B) === 'VL 1 · AMC 1', `A ${at(A)} · B ${at(B)}`),
    ck(doc(B).querySelector('#coluna-normalizados .kanban-card[data-codigo="1087"]'), '1087 normalizado e ainda contado em VIA LIVRE'),
  ]);
  // muitas causas: até 5 linhas, a 5ª soma o resto
  const C = ['ABALROAMENTO', 'VANDALISMO', 'MODERNIZAÇÃO', 'IMPROCEDENTE'];
  let t2 = montar(D, C.map((c, i) => ({ cod: String(700 + i), ini: t('19:0' + i), causa: c })).concat(P), N);
  [...C.map((c, i) => ({ cod: String(700 + i), causa: c })), ...P, ...N].forEach(x => { t2 = t2.replace(new RegExp(`^[^\\t\\n]*(\\t\\*🚦\\t${x.cod}\\t)`, 'm'), `${x.causa}$1`); });
  await h.processar(A, t2); while (h.modalAberto(A)) await h.responderModal(A, true); await h.dormir(900);
  const c2 = causas(B), soma2 = c2.reduce((a, x) => a + +x.split(':')[1], 0);
  reg('SB4', 'Muitas causas: todas aparecem (nada agrupado), e a soma continua igual a Ocorrências', [
    ck(c2.length === 7 && !c2.some(x => /OUTRAS/.test(x)), `causas: ${c2.join(' · ')}`),
    ck(soma2 === +h.painel(B).total, `soma ${soma2} = Ocorrências ${h.painel(B).total}`),
  ]);
  // rendição e apoio: conta cada equipe que atuou, uma vez por semáforo
  const NC = A.w.NitCentral || { _derivarColunaN: h0 => { const evs = Object.values(h0).sort((a, b) => a.ts - b.ts); const seg = []; let cur = []; for (const e of evs) { const l = e.sub === 'vl' ? 'VIA LIVRE' : 'AMC'; if (e.tipo === 'despacho') cur = [l]; else if (e.tipo === 'apoio') { if (!cur.includes(l)) cur.push(l); } else { seg.push(cur.join(' + ')); cur = [l]; } } seg.push(cur.join(' + ')); return seg.join(' → '); } }, hist = (...evs) => Object.fromEntries(evs.map((e, i) => [`h${i}`, { ts: i + 1, ...e }]));
  const casos = {
    rendicao: NC._derivarColunaN(hist({ tipo: 'despacho', sub: 'vl' }, { tipo: 'rendição', sub: 'amc' })),
    apoio: NC._derivarColunaN(hist({ tipo: 'despacho', sub: 'amc' }, { tipo: 'apoio', sub: 'vl' })),
    volta: NC._derivarColunaN(hist({ tipo: 'despacho', sub: 'vl' }, { tipo: 'rendição', sub: 'amc' }, { tipo: 'rendição', sub: 'vl' })),
  };
  const kb2 = A.fb.estado().kanban, id2 = c => Object.keys(kb2).find(k => kb2[k].codigo === c);
  await A.w.NitFirebase.db.ref(`kanban/${id2('700')}`).update({ colunaN: casos.rendicao, coluna: 'coluna-normalizados', status: 'NORMALIZADO', data_fim: D, hora_fim: '20:30', pl: 'norm' });
  await A.w.NitFirebase.db.ref(`kanban/${id2('701')}`).update({ colunaN: casos.apoio, coluna: 'coluna-amc', sub: 'amc', pl: 'atend' });
  await A.w.NitFirebase.db.ref(`kanban/${id2('702')}`).update({ colunaN: casos.volta, coluna: 'coluna-vl', sub: 'vl', pl: 'atend' });
  await h.dormir(1200);
  // antes: VL 1087 · AMC 483 → agora +700 (VL→AMC), +701 (AMC+VL), +702 (VL→AMC→VL, conta 1 em cada)
  reg('SB5', 'Rendição e apoio: cada equipe que atuou conta 1 por semáforo (ação conjunta conta para as duas)', [
    ck(casos.rendicao === 'VIA LIVRE → AMC' && casos.apoio === 'AMC + VIA LIVRE' && casos.volta === 'VIA LIVRE → AMC → VIA LIVRE', `trajetórias: ${JSON.stringify(casos)}`),
    ck(at(B) === 'VL 4 · AMC 4', `ATENDIDOS ${at(B)} (esperado VL 4 · AMC 4)`),
  ]);
  if (process.env.DUMP) require('fs').writeFileSync(process.env.DUMP, doc(B).documentElement.outerHTML.replace(/<script[\s\S]*?<\/script>/g, ''));
  const f = R.filter(x => x !== 'PASSOU').length;
  console.log('RESUMO sidebar', f ? { FALHOU: f, PASSOU: R.length - f } : { PASSOU: R.length });
  process.exit(0);
})();
