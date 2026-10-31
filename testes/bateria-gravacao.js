// Bateria de gravação (13.1, Mudança 6): o NIT nunca para e nunca esconde falha de gravação.
// 13.2: textos do MENSAGENS.md (NIT-30..34); o "Recuperar último relatório" saiu (o relatório está no WhatsApp).
// Usa a simulação de rede do harness: atraso, sem conexão e recusa do servidor.
const fs = require('fs');
const path = require('path');
const h = require('./harness');

const T = '\t';
const D = '14/10/2026';
const RELOGIO = '2026-10-14T10:30:00';
const cab = d => `*🚦PLANTÃO CEMOB*${T}${d}${T}\n*PLANTONISTA* ${T}TESTE${T}\n${T}${T}\n`;
const linhaOc = ({ cod, ini, fim }) =>
  `INVESTIGANDO${T}*🚦${T}${cod}${T}🚦${T}RUA ${cod} & AV TESTE${T}●${T}APAGADO${T}●*${T}Início:${T}${ini}${fim ? `${T}Fim:${T}${fim}` : `${T}${T}`}${T}"\n"${T}\n`;
const rel = (pend = [], norm = []) => cab(D) + `*PENDENTES*❌${T}${T}\n\n` + pend.map(linhaOc).join('') +
  `${T}${T}\n*NORMALIZADOS*✅${T}${T}\n\n` + norm.map(linhaOc).join('');
const t = hm => `${D} ${hm}`;
const R1 = rel([{ cod: '9901', ini: t('08:00') }, { cod: '9902', ini: t('08:30') }], [{ cod: '9904', ini: t('06:00'), fim: t('07:15') }]);
const R2 = rel([{ cod: '9901', ini: t('08:00') }, { cod: '9902', ini: t('08:30') }, { cod: '9905', ini: t('09:00') }], [{ cod: '9904', ini: t('06:00'), fim: t('07:15') }]);

const indicador = nit => nit.w.document.getElementById('nit-gravacao-status')?.textContent.trim() || '(sem indicador)';
const statusFb = nit => nit.w.document.querySelector('#nit-firebase-status span:last-child')?.textContent.trim();
const cardsTela = nit => [...nit.w.document.querySelectorAll('#tab-semaforo .kanban-card')].map(c => c.dataset.codigo).sort().join(',');
const nosBanco = fb => Object.keys(fb.estado().kanban || {}).map(k => k.split('_')[0]).sort().join(',');
const sairPede = nit => { const ev = new nit.w.Event('beforeunload', { cancelable: true }); nit.w.dispatchEvent(ev); return ev.defaultPrevented; };
async function proc(nit, texto) { await h.processar(nit, texto); if (h.modalAberto(nit)) await h.responderModal(nit, true); }
async function subir(fb) { return h.subirNIT({ estado: {}, relogioIso: RELOGIO, fb }); }
const novoFb = () => h.criarFirebaseFalso({}, h.criarRelogio(RELOGIO));

const R = [];
function reg(id, nome, checks) {
  const status = checks.every(c => c.ok) ? 'PASSOU' : 'FALHOU';
  R.push({ id, nome, status, falhas: checks.filter(c => !c.ok).map(c => c.d) });
  console.log(`${status.padEnd(7)} ${id} ${nome}`);
  for (const c of checks) console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`);
  console.log('');
}
const ck = (ok, d) => ({ ok: !!ok, d });

(async () => {
  // G1 Rede normal
  { const fb = novoFb(); const A = await subir(fb);
    await proc(A, R1); await h.dormir(1700);
    reg('G1', 'Rede normal', [
      ck(indicador(A) === '✓ SALVO', `indicador "✓ SALVO" (obs: ${indicador(A)})`),
      ck(nosBanco(fb) === '9901,9902,9904', 'banco gravado'),
      ck(!sairPede(A), 'fechar a aba não pede confirmação'),
    ]); A.dom.window.close(); }

  // G2 Servidor lento (3 s)
  { const fb = novoFb(); const A = await subir(fb);
    fb.controle.atrasoMs = 3000;
    const t0 = Date.now(); await proc(A, R1); const tempoProc = Date.now() - t0;
    const telaLogo = cardsTela(A);
    await h.dormir(1800); const durante = indicador(A); const pedeDurante = sairPede(A);
    await h.dormir(2200); const depois = indicador(A);
    reg('G2', 'Servidor lento (3 s)', [
      ck(telaLogo === '9901,9902,9904' && tempoProc < 2000, `cards na tela na hora, sem esperar o servidor (${tempoProc} ms)`),
      ck(/ENVIANDO/.test(durante), `durante: "⏳ ENVIANDO…" (obs: ${durante})`),
      ck(pedeDurante, 'durante: fechar a aba pede confirmação'),
      ck(depois === '✓ SALVO', `depois: "✓ SALVO" (obs: ${depois})`),
    ]); A.dom.window.close(); }

  // G3 Sem conexão e conexão voltando
  { const fb = novoFb(); const A = await subir(fb);
    fb.controle.definirOnline(false); await h.dormir(100);
    await proc(A, R1); await h.dormir(1800);
    const tela = cardsTela(A), ind = indicador(A), st = statusFb(A), pede = sairPede(A);
    const conferiu = h.toasts(A).some(x => /PRONTO/.test(x));
    await proc(A, R2); await h.dormir(300); const tela2 = cardsTela(A);
    fb.controle.definirOnline(true); await h.dormir(1800);
    reg('G3', 'Sem conexão → conexão volta', [
      ck(tela === '9901,9902,9904' && conferiu, 'offline: processa, mostra os cards e confere normalmente'),
      ck(tela2 === '9901,9902,9904,9905', 'offline: continua processando (segundo relatório)'),
      ck(/offline/i.test(st) && /SEM INTERNET/.test(ind), `offline: "📵 SEM INTERNET" (obs: ${st} · ${ind})`),
      ck(pede, 'offline: fechar a aba pede confirmação'),
      ck(indicador(A) === '✓ SALVO' && nosBanco(fb) === '9901,9902,9904,9905', `conexão voltou: tudo enviado (banco: ${nosBanco(fb)}; ${indicador(A)})`),
      ck(!sairPede(A), 'conexão voltou: fechar a aba não pede mais confirmação'),
    ]); A.dom.window.close(); }

  // G4 Servidor recusa a gravação de um semáforo (card já existente sendo atualizado)
  { const fb = novoFb(); const A = await subir(fb);
    await proc(A, R1); await h.dormir(200);
    fb.controle.codigoRecusa = 'WRITE_CANCELED'; fb.controle.recusar = p => /kanban\/9902_/.test(p);
    await proc(A, rel([{ cod: '9901', ini: t('08:00') }, { cod: '9902', ini: t('08:40') }, { cod: '9905', ini: t('09:00') }], [{ cod: '9904', ini: t('06:00'), fim: t('07:15') }]));
    await h.dormir(300);
    const ind = indicador(A), toast = h.toasts(A).join(' | ');
    fb.controle.recusar = null;
    await proc(A, rel([{ cod: '9901', ini: t('08:00') }, { cod: '9905', ini: t('09:00') }, { cod: '9906', ini: t('10:00') }])); await h.dormir(300);
    reg('G4', 'Servidor recusa a gravação de um semáforo', [
      ck(/9902 NÃO SALVOU/.test(ind), `indicador mostra o semáforo (obs: ${ind})`),
      ck(/9902 NÃO SALVOU/.test(toast), 'toast de erro com o semáforo'),
      ck(/9905/.test(nosBanco(fb)), 'os outros semáforos foram salvos'),
      ck(/9906/.test(cardsTela(A)), 'o operador continua trabalhando (novo processamento funciona)'),
    ]); A.dom.window.close(); }

  // G4b Recusa de uma gravação em lote (primeiro processamento do dia)
  { const fb = novoFb(); const A = await subir(fb);
    fb.controle.codigoRecusa = 'WRITE_CANCELED'; fb.controle.recusar = p => p === 'kanban';
    await proc(A, R1); await h.dormir(300);
    const ind = indicador(A);
    reg('G4b', 'Servidor recusa a gravação em lote', [
      ck(/NÃO SALVOU/.test(ind), `indicador avisa a falha, sem esconder (obs: ${ind})`),
    ]); A.dom.window.close(); }

  // G5 Aba fechada sem conexão → reabre → cola de novo o relatório do WhatsApp → nada se perde, nada duplica
  { const fb = novoFb(); const A = await subir(fb);
    fb.controle.definirOnline(false); await h.dormir(100);
    await proc(A, R1); await h.dormir(200);
    A.dom.window.close();                       // a fila do SDK se perde com a aba
    fb.controle.fila.length = 0; fb.controle.definirOnline(true);
    await fb.firebase.database().ref('kanban').remove();   // reproduz a perda real
    const B = await subir(fb);
    await proc(B, R1); await h.dormir(300);
    await proc(B, R1); await h.dormir(300);     // reprocessar de novo não duplica
    reg('G5', 'Aba fechada offline → reprocessar o relatório do WhatsApp', [
      ck(!B.w.document.getElementById('nit-recuperar-relatorio'), 'sem botão "Recuperar último relatório" (13.2)'),
      ck(nosBanco(fb) === '9901,9902,9904' && cardsTela(B) === '9901,9902,9904', `cards restaurados sem duplicar (banco: ${nosBanco(fb)})`),
    ]); B.dom.window.close(); }

  const resumo = R.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
  console.log('RESUMO gravação', resumo);
  fs.writeFileSync(path.join(__dirname, 'bateria-gravacao-resultado.json'), JSON.stringify(R, null, 2));
  process.exit(0);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
