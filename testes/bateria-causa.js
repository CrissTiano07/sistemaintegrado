// Bateria de causa e relatório de saída (13.1, 16/10/2026).
//  K1 causa corrigida chega ao outro operador · K2 causa como a fonte escreveu
//  K3 relatório de saída: normalizado com horário de normalização · K4 relatórios reais de 16/10
const fs = require('fs');
const path = require('path');
const h = require('./harness');

const T = '\t';
const D = '16/10/2026';
const RELOGIO = '2026-10-16T21:00:00';
const cab = d => `*🚦PLANTÃO CEMOB*${T}${d}${T}\n*PLANTONISTA* ${T}X${T}\n${T}${T}\n`;
const L = (tipo, cod, prob, ini, fim) => `${tipo}${T}*🚦${T}${cod}${T}🚦${T}RUA ${cod}${T}●${T}${prob}${T}●*${T}Início:${T}${ini}${fim ? `${T}Fim:${T}${fim}` : `${T}${T}`}${T}"\n"${T}\n`;
const rel = (p, n) => cab(D) + `*PENDENTES*❌${T}${T}\n\n` + p.join('') + `${T}${T}\n*NORMALIZADOS*✅${T}${T}\n\n` + n.join('');
const t = hm => `${D} ${hm}`;

const tipoTela = (nit, cod) => [...nit.w.document.querySelectorAll(`#tab-semaforo .kanban-card[data-codigo="${cod}"]`)].map(c => c.dataset.tipo).join(',');
async function proc(nit, x) { await h.processar(nit, x); if (h.modalAberto(nit)) await h.responderModal(nit, true); }
async function relatorioSaida(nit) {
  const chk = nit.w.document.getElementById('check-incluir-normalizados'); if (chk) chk.checked = true;
  nit.w.eval('void 0'); // noop
  nit.w.document.getElementById('check-incluir-normalizados')?.dispatchEvent(new nit.w.Event('change', { bubbles: true }));
  await h.dormir(100);
  return nit.w.document.getElementById('relatorio-final-preview')?.value || '';
}

const R = [];
function reg(id, nome, checks) {
  const status = checks.every(c => c.ok) ? 'PASSOU' : 'FALHOU';
  R.push({ id, nome, status });
  console.log(`${status.padEnd(7)} ${id} ${nome}`);
  for (const c of checks) console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`);
  console.log('');
}
const ck = (ok, d) => ({ ok: !!ok, d });

(async () => {
  // K1 causa corrigida por B chega à tela de A
  { const fb = h.criarFirebaseFalso({}, h.criarRelogio(RELOGIO));
    const A = await h.subirNIT({ estado: {}, relogioIso: RELOGIO, fb }), B = await h.subirNIT({ estado: {}, relogioIso: RELOGIO, fb });
    await proc(A, rel([L('INVESTIGANDO', '530', 'PISCANTE', t('10:54')), L('INVESTIGANDO', '973', 'APAGADO', t('10:54'))], [])); await h.dormir(200);
    await proc(B, rel([L('FALHA DE EQUIPAMENTO', '973', 'PISCANTE', t('10:54'))], [L('ENEL', '530', 'PISCANTE', t('10:54'), t('13:58'))])); await h.dormir(300);
    const tag973 = A.w.document.querySelector('[data-codigo="973"] .card-status-tag')?.textContent;
    reg('K1', 'Causa e problema corrigidos chegam ao outro operador', [
      ck(tipoTela(A, '530') === 'ENEL' && tipoTela(A, '973') === 'FALHA DE EQUIPAMENTO', `tela de A: 530=${tipoTela(A, '530')}, 973=${tipoTela(A, '973')}`),
      ck(tag973 === 'PISCANTE', `problema do 973 atualizado na tela de A (obs: ${tag973})`),
    ]); A.dom.window.close(); B.dom.window.close(); }

  // K2 causa como a fonte escreveu
  { const A = await h.subirNIT({ estado: {}, relogioIso: RELOGIO });
    await proc(A, rel([L('ABALROAMENTO', '874', 'APAGADO', t('16:37')), L('', '501', 'ACOMPANHAMENTO', t('09:00')), L('CAUSA NOVA QUALQUER', '502', 'APAGADO', t('09:10'))],
                      [L('MODERNIZAÇÃO', '690', 'ACOMPANHAMENTO', t('09:30'), t('13:20'))]));
    reg('K2', 'Causa como a fonte escreveu', [
      ck(tipoTela(A, '874') === 'ABALROAMENTO', `874 ABALROAMENTO (obs: ${tipoTela(A, '874')})`),
      ck(tipoTela(A, '690') === 'MODERNIZAÇÃO', `690 MODERNIZAÇÃO (obs: ${tipoTela(A, '690')})`),
      ck(tipoTela(A, '501') === 'ACOMPANHAMENTO', `sem causa escrita, problema ACOMPANHAMENTO → ACOMPANHAMENTO (obs: ${tipoTela(A, '501')})`),
      ck(tipoTela(A, '502') === 'CAUSA NOVA QUALQUER', `causa fora da lista é mantida (obs: ${tipoTela(A, '502')})`),
    ]); A.dom.window.close(); }

  // K3 relatório de saída
  { const A = await h.subirNIT({ estado: {}, relogioIso: RELOGIO });
    await proc(A, rel([L('FURTO', '9901', 'APAGADO', t('08:00'))], [L('ENEL', '9902', 'PISCANTE', t('08:30'), t('09:00'))]));
    const txt = await relatorioSaida(A);
    const l1 = txt.split('\n').find(x => x.startsWith('9901')) || '', l2 = txt.split('\n').find(x => x.startsWith('9902')) || '';
    reg('K3', 'Relatório de saída', [
      ck(/FURTO - Desde 16\/10 - 08:00/.test(l1), `pendente com "Desde" (obs: ${l1})`),
      ck(/ENEL - 16\/10 08:30 às 09:00 /.test(l2), `normalizado no mesmo dia: "16/10 08:30 às 09:00" (obs: ${l2})`),
    ]); A.dom.window.close(); }

  // K4 relatórios reais de 16/10 (três versões do dia)
  const dir = process.env.NIT_RELATORIOS_1610;
  if (dir && fs.existsSync(dir)) {
    const A = await h.subirNIT({ estado: {}, relogioIso: RELOGIO });
    for (const f of ['r1.txt', 'r2.txt', 'r3.txt']) await proc(A, fs.readFileSync(path.join(dir, f), 'utf8'));
    const txt = await relatorioSaida(A);
    const linha = c => txt.split('\n').filter(x => x.startsWith(c + ' ')).join(' | ');
    const conferido = h.toasts(A).some(x => /PRONTO/.test(x));
    const painelK4 = A.w.document.getElementById('nit-integridade-processamento')?.textContent.replace(/\s+/g, ' ').trim() || '';
    reg('K4', 'Relatórios reais de 16/10 (r1 → r2 → r3)', [
      ck(!/N\/I/.test(txt), 'nenhuma causa "N/I" no relatório de saída'),
      ck(/973 .*FALHA - Desde 16\/10 - 10:54/.test(linha('973')), `973 pendente com causa FALHA (obs: ${linha('973')})`),
      ck(/874 .*ABALROAMENTO/.test(linha('874')) && /MODERNIZAÇÃO - 16\/10 09:30 às 13:20/.test(linha('208')), 'ABALROAMENTO e MODERNIZAÇÃO aparecem'),
      ck(/1164 .*IMPROCEDENTE - 16\/10 09:30 às 10:35/.test(linha('1164')), `1164 IMPROCEDENTE 09:30 às 10:35 (obs: ${linha('1164')})`),
      ck(/FURTO - 15\/10 14:00 às 16\/10 00:01/.test(linha('887')) && /FURTO - 16\/10 07:14 às 10:46/.test(linha('887')), `887: virada do dia explícita e as duas ocorrências distinguíveis (obs: ${linha('887')})`),
      ck(conferido, `✓ PRONTO (painel: ${painelK4.slice(0, 200) || 'vazio'})`),
    ]);
    console.log(txt);
    A.dom.window.close();
  } else console.log('K4 pulado: defina NIT_RELATORIOS_1610\n');

  console.log('RESUMO causa', R.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {}));
  process.exit(0);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
