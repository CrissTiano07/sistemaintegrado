// Bateria 14.2 — virada da meia-noite com a planilha (BR-PLA-002, pedido do Cristiano em 31/10/2026):
// pendente que virou herança e o CTA encerrou DEPOIS da meia-noite com hora de ONTEM (23:59).
const h = require('./harness');
const { montarRelatorio } = require(process.env.MONTAR || './planilha-montar.js');
const R = []; const ck = (ok, d) => ({ ok: !!ok, d });
function reg(id, nome, cs) { const s = cs.every(c => c.ok) ? 'PASSOU' : 'FALHOU'; R.push(s); console.log(`${s.padEnd(7)} ${id} ${nome}`); cs.forEach(c => console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`)); }
const doc = n => n.w.document;
const lin = (scn, ini, fim, causa = 'ENEL') => { const [di, hi] = ini.split(' '), [df = '', hf = ''] = (fim || '').split(' ');
  return [scn, `RUA ${scn} & AV TESTE`, di, 'JORDAN', 'APAGADO', causa, di, hi, ini, df, hf, fim || '', '', '', '', '', `obs ${scn}`]; };
let ver = 0;
const fonte = (linhas, D, em, ontem = []) => { const r = montarRelatorio(linhas, D);
  return { conteudo: { texto: r.texto, dataReferencia: D, geradoEm: em, pendentes: r.pendentes, normalizados: r.normalizados, itens: r.itens, ontem, assinatura: 'v' + (++ver) }, verificadoEm: em }; };
const ts = iso => new Date(iso).getTime();
const relogio = (ns, iso) => ns.forEach(n => n.relogio.definir(iso));
const cartao = (n, cod) => doc(n).querySelector(`#tab-semaforo .kanban-card[data-codigo="${cod}"]`);
const decisoes = n => [...doc(n).querySelectorAll('#nit-integridade-processamento .nd-card')].map(c => `${c.dataset.msg}:${c.dataset.codigo}`);
const tot = n => { const p = h.painel(n); return `${p.total}/${p.pendentes}/${p.normalizados}`; };
const aud = n => JSON.stringify(n.fb.estado().auditoria || {});
(async () => {
  const L30 = [lin('183', '30/10/2026 16:35', '', 'ROMPIMENTO'), lin('695', '30/10/2026 19:00', '', 'ABALROAMENTO')];
  const ini = { fonte_planilha: fonte(L30, '30/10/2026', ts('2026-10-30T23:30:00')) };
  const fb = h.criarFirebaseFalso(ini, h.criarRelogio('2026-10-30T23:30:00'));
  const A = await h.subirNIT({ estado: ini, relogioIso: '2026-10-30T23:30:00', fb }), B = await h.subirNIT({ estado: ini, relogioIso: '2026-10-30T23:30:00', fb });
  await h.dormir(2500);
  // virada: 00:00 de 31/10, os dois continuam abertos → herança
  relogio([A, B], '2026-10-31T00:00:30');
  await A.w.NitFirebase.db.ref('fonte_planilha').set(fonte(L30, '31/10/2026', ts('2026-10-31T00:00:10'))); await h.dormir(2500);
  reg('V1', 'Virada: os dois pendentes viram herança do dia 31', [ck(tot(A) === '2/2/0' && tot(B) === '2/2/0', `A ${tot(A)} · B ${tot(B)} (Ocorrências/Pendentes/Normalizados)`)]);
  // 00:12: o TCT encerra o 183 com 30/10 23:59 → sai do relatório do dia 31 e entra na lista "normalizou ontem"
  relogio([A, B], '2026-10-31T00:12:00');
  const L31 = [lin('183', '30/10/2026 16:35', '30/10/2026 23:59', 'ROMPIMENTO'), L30[1]];
  await A.w.NitFirebase.db.ref('fonte_planilha').set(fonte(L31, '31/10/2026', ts('2026-10-31T00:11:50'), [{ c: '183', i: '30/10/2026 16:35', f: '30/10/2026 23:59' }])); await h.dormir(3000);
  const c183 = cartao(B, '183');
  reg('V2', 'Encerrado depois da meia-noite com hora de ontem: fecha no dia 30, sem perguntar, sem contar hoje', [
    ck(c183 && c183.closest('#coluna-normalizados') && c183.dataset.datareferencia === '30/10/2026' && c183.dataset.hora_fim === '23:59', `183: normalizado, dia ${c183?.dataset.datareferencia}, fim ${c183?.dataset.data_fim} ${c183?.dataset.hora_fim}`),
    ck(tot(A) === '1/1/0' && tot(B) === '1/1/0', `totais de hoje = planilha do dia 31 (1/1/0): A ${tot(A)} · B ${tot(B)}`),
    ck(!decisoes(A).some(x => /183/.test(x)) && !decisoes(B).some(x => /183/.test(x)), `nenhum alerta do 183 (${decisoes(B).join(', ') || 'nenhum'})`),
    ck(!/aguardando a fonte/i.test(c183?.textContent || ''), 'sem "aguardando a fonte"'),
    ck(/183 normalizou ontem \(30\/10\) às 23:59/.test(aud(A)), 'LINHA DO TEMPO: "✓ 183 normalizou ontem (30/10) às 23:59…"'),
    ck(!/183/.test([...doc(B).querySelectorAll('#sb-causas .sb-causa span')].map(e => e.textContent).join()) && /ABALROAMENTO/.test(doc(B).getElementById('sb-causas').textContent) && !/ROMPIMENTO/.test(doc(B).getElementById('sb-causas').textContent), `CAUSAS de hoje sem o 183: ${doc(B).getElementById('sb-causas').textContent}`),
  ]);
  // próxima mudança da planilha: nada volta
  relogio([A, B], '2026-10-31T00:20:00');
  await A.w.NitFirebase.db.ref('fonte_planilha').set(fonte([...L31, lin('300', '31/10/2026 00:18')], '31/10/2026', ts('2026-10-31T00:19:50'), [{ c: '183', i: '30/10/2026 16:35', f: '30/10/2026 23:59' }])); await h.dormir(3000);
  reg('V3', 'Atualizações seguintes: o 183 continua no dia 30 e nada é perguntado', [
    ck(tot(B) === '2/2/0' && cartao(B, '183').dataset.datareferencia === '30/10/2026', `B ${tot(B)} (695 + 300 pendentes)`),
    ck(!decisoes(B).some(x => /183/.test(x)), 'sem alerta do 183'),
  ]);
  A.dom.window.close(); B.dom.window.close();

  // V4: sem a lista (script antigo / relatório colado): alerta como antes; normalizar À MÃO com data de ontem tira o card de hoje
  const fb2 = h.criarFirebaseFalso({ fonte_planilha: fonte(L30, '30/10/2026', ts('2026-10-30T23:30:00')) }, h.criarRelogio('2026-10-30T23:30:00'));
  const C = await h.subirNIT({ estado: {}, relogioIso: '2026-10-30T23:30:00', fb: fb2 }); await h.dormir(2500);
  relogio([C], '2026-10-31T00:00:30'); await C.w.NitFirebase.db.ref('fonte_planilha').set(fonte(L30, '31/10/2026', ts('2026-10-31T00:00:10'))); await h.dormir(2500);
  relogio([C], '2026-10-31T00:12:00'); await C.w.NitFirebase.db.ref('fonte_planilha').set(fonte(L31, '31/10/2026', ts('2026-10-31T00:11:50'))); await h.dormir(2500);
  const alertou = decisoes(C).includes('NIT-10:183');
  const card = [...doc(C).querySelectorAll('#nit-integridade-processamento .nd-card')].find(c => c.dataset.msg === 'NIT-10' && c.dataset.codigo === '183');
  card?.querySelector('button[data-acao="NORMALIZOU"]')?.click(); await h.dormir(300);
  doc(C).getElementById('norm-data-fim').value = '2026-10-30'; doc(C).getElementById('norm-hora-fim').value = '23:59';
  doc(C).getElementById('btn-norm-confirmar').click(); await h.dormir(6000);
  const k = cartao(C, '183');
  const nAc = (aud(C).match(/183 normalizado à mão às 23:59/g) || []).length;
  reg('V4', 'Sem a lista: alerta como antes; normalizar à mão com 30/10 23:59 tira o 183 dos totais de hoje', [
    ck(alertou, 'alerta "183 SAIU DO RELATÓRIO" (como hoje)'),
    ck(k && k.closest('#coluna-normalizados') && k.dataset.datareferencia === '30/10/2026', `183 normalizado e no dia ${k?.dataset.datareferencia}`),
    ck(tot(C) === '1/1/0', `totais de hoje ${tot(C)} (= planilha 1/1/0)`),
    ck(nAc === 1, `"183 normalizado à mão às 23:59" registrado ${nAc}x (uma vez só)`),
  ]);
  relogio([C], '2026-10-31T00:20:00'); await C.w.NitFirebase.db.ref('fonte_planilha').set(fonte([...L31, lin('300', '31/10/2026 00:18')], '31/10/2026', ts('2026-10-31T00:19:50'))); await h.dormir(2500);
  reg('V5', 'Depois de normalizar à mão com data de ontem: os relatórios seguintes não perguntam de novo', [
    ck(!decisoes(C).some(x => /183/.test(x)), `alertas: ${decisoes(C).join(', ') || 'nenhum'}`),
    ck(tot(C) === '2/2/0' && cartao(C, '183').dataset.datareferencia === '30/10/2026', `totais ${tot(C)}; 183 continua no dia 30`),
  ]);
  const f = R.filter(x => x !== 'PASSOU').length;
  console.log('RESUMO virada-planilha', f ? { FALHOU: f, PASSOU: R.length - f } : { PASSOU: R.length });
  process.exit(0);
})();
