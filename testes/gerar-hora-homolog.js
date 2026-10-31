// Roteiro de homologação 13.2.1 — hora com erro de digitação, sem hora de início e normalização à mão.
// Cada passo roda no NIT real (janelas A e B no mesmo banco) e é CONFERIDO antes de ir para o roteiro.
// Uso: node gerar-hora-homolog.js <pasta-saida> <aaaa-mm-dd>
const fs = require('fs'), path = require('path');
const h = require('./harness');
const { montar } = require('./estresse-mundo');
const [, , OUT, DIA] = process.argv;
const [aa, mm, dd] = DIA.split('-'); const D = `${dd}/${mm}/${aa}`;
const t = hm => `${D} ${hm}`;
const END = { 601: 'R. PROF. HERIBALDO COSTA & AV. SEN. FERNANDES TÁVORA', 602: 'AV. C (CONJ. CEARÁ) & AV. H (CONJ. CEARÁ)', 603: 'AV. GODOFREDO MACIEL & AV. PRES. COSTA E SILVA',
  604: 'R. CEL. TIBÚRCIO & AV. PRES. COSTA E SILVA', 605: 'R. DONA LIBANIA & AV. WENEFRIDO MELO', 606: 'R. JOSÉ VILAR & AV. JÚLIO VENTURA', 607: 'R. SILVA PAULET & AV. JÚLIO VENTURA',
  608: 'AV. CARAPINIMA & R. PE. FRANCISCO PINTO', 609: 'R. ARI MAIA & R. OSCAR ARARIPE' };
const TP = { 601: 'ABALROAMENTO', 602: 'ENEL', 603: 'INVESTIGANDO', 604: 'ENEL', 605: 'INVESTIGANDO', 606: 'FURTO', 607: 'INVESTIGANDO', 608: 'ENEL', 609: 'ENEL' };
const P = (cod, ini) => ({ cod: String(cod), ini, tipo: TP[cod], prob: 'APAGADO' });
const N = (cod, ini, fim) => ({ ...P(cod, ini), fim });
// hora "torta" entra crua no texto (o gerador usa o valor como veio)
const relTxt = (pend, norm) => montar(D, pend, norm).replace(/RUA (\d+) & AV ESTRESSE/g, (_, c) => END[c] || `RUA ${c}`);
const txt = e => (e?.textContent || '').replace(/\s+/g, ' ').trim();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const iso = `${DIA}T14:00:00`;
  const fb = h.criarFirebaseFalso({}, h.criarRelogio(iso));
  const A = await h.subirNIT({ estado: {}, relogioIso: iso, fb }), B = await h.subirNIT({ estado: {}, relogioIso: iso, fb });
  const doc = n => n.w.document;
  const vis = (n, c) => [...doc(n).querySelectorAll(`#tab-semaforo .kanban-card[data-codigo="${c}"]`)].filter(x => x.style.display !== 'none');
  const col = (n, c) => vis(n, c).map(x => x.closest('.kanban-column').id.replace('coluna-', ''));
  const etq = (n, c) => vis(n, c).flatMap(x => [...x.querySelectorAll('.card-retificado, .card-manual')].map(txt));
  const dec = (n, msg, c) => doc(n).querySelector(`#nit-integridade-processamento .nd-card[data-msg="${msg}"][data-codigo="${c}"]`);
  const decT = (n, c) => [...doc(n).querySelectorAll(`#nit-integridade-processamento .nd-card[data-codigo="${c}"]`)].map(e => `${txt(e.querySelector('.nd-t'))} ${txt(e.querySelector('.nd-l2'))}`.trim());
  const conf = n => txt(doc(n).querySelector('#nit-integridade-processamento .nd-confirmacao .nd-conf-txt'));
  const tot = n => { const v = [...doc(n).querySelectorAll('#tab-semaforo .kanban-card')].filter(x => x.style.display !== 'none');
    return `${v.filter(x => !x.closest('#coluna-normalizados')).length} pendentes · ${v.filter(x => x.closest('#coluna-normalizados')).length} normalizados`; };
  const vistos = new Map();
  for (const n of [A, B]) { vistos.set(n, []); new n.w.MutationObserver(ms => ms.forEach(x => x.addedNodes.forEach(e => e.classList?.contains('toast') && vistos.get(n).push(txt(e)))))
    .observe(doc(n).getElementById('toast-container'), { childList: true }); }
  const linhas = [], problemas = []; let nRel = 0, passo = 0;
  const confere = (ok, desc) => { if (!ok) problemas.push(`passo ${passo}: ${desc}`); return ok ? desc : `⚠ ${desc}`; };
  const processar = async (n, pend, norm) => {
    const nome = `t${String(++nRel).padStart(2, '0')}.txt`; fs.writeFileSync(path.join(OUT, nome), relTxt(pend, norm));
    const k = vistos.get(n).length; await h.processar(n, relTxt(pend, norm)); if (h.modalAberto(n)) await h.responderModal(n, true); await h.dormir(500);
    return { nome, toasts: vistos.get(n).slice(k).filter(x => !/Bem-vindo/.test(x)) };
  };
  const manual = async (n, c, hm) => { vis(n, c)[0].querySelector('.btn-card-action.complete').click(); await h.dormir(200);
    doc(n).getElementById('norm-hora-fim').value = hm; doc(n).getElementById('btn-norm-confirmar').click(); await h.dormir(5800); };
  const relSaida = async n => { const c = doc(n).getElementById('check-incluir-normalizados'); c.checked = true; c.dispatchEvent(new n.w.Event('change'));
    doc(n).getElementById('btn-visualizar-relatorio').click(); await h.dormir(250); if (h.modalAberto(n)) await h.responderModal(n, true); await h.dormir(250);
    const r = doc(n).getElementById('modal-relatorio-texto').value; doc(n).getElementById('btn-modal-fechar')?.click(); return r; };
  const linha = (quem, arq, fazer, ver) => linhas.push(`| ${passo} | ${quem} | ${arq} | ${fazer} | ${ver.join('<br>')} |`);

  // 1. abertura: horas tortas, sem hora, ilegível
  passo++;
  let pend = [P(601, t('06.:50')), P(602, t('07.30')), P(603, t('8:05')), P(604, ''), P(605, t('09.:1')), P(606, t('07:00')), P(607, t('07:20'))];
  let norm = [N(608, t('06:00'), t('06.:40'))];
  let r = await processar(A, pend, norm);
  linha('A', r.nome, 'Processe (abertura).', [
    confere(!dec(A, 'NIT-14', '601') && !dec(A, 'NIT-14', '602') && !dec(A, 'NIT-14', '603'), 'nenhum aviso para 601 ("06.:50"), 602 ("07.30") e 603 ("8:05")'),
    confere(vis(A, '601')[0]?.dataset.inicio === t('06:50') && vis(A, '602')[0]?.dataset.inicio === t('07:30') && vis(A, '603')[0]?.dataset.inicio === t('08:05'), 'cards com 06:50, 07:30 e 08:05'),
    confere(/06:40$/.test(vis(A, '608')[0]?.dataset.fim || vis(A, '608')[0]?.dataset.hora_fim || '') && col(A, '608')[0] === 'normalizados', '608 normalizado com fim 06:40 (veio "06.:40")'),
    confere(decT(A, '604').includes('⚠ 604 SEM HORA DE INÍCIO Veio sem a hora que começou.'), '⚠ 604 SEM HORA DE INÍCIO'),
    confere(decT(A, '605').includes('⚠ 605 HORA DE INÍCIO ILEGÍVEL Veio "09.:1".'), '⚠ 605 HORA DE INÍCIO ILEGÍVEL · Veio "09.:1".'),
    confere(tot(A) === '7 pendentes · 1 normalizados', 'painel: 7 pendentes · 1 normalizado'),
  ]);

  // 2. normalizar à mão: 604 (sem início) e 606 (com início)
  passo++;
  await manual(A, '604', '09:10'); await manual(A, '606', '09:15');
  linha('A', '—', 'Normalize à mão pelo ✓ do card: **604** fim **09:10** · **606** fim **09:15** (espere ~5 s em cada).', [
    confere(col(A, '604')[0] === 'normalizados' && etq(A, '604').includes('✋ normalizado à mão · aguardando a fonte'), '604 em NORMALIZADOS com "✋ normalizado à mão"'),
    confere(col(A, '606')[0] === 'normalizados' && etq(A, '606').includes('✋ normalizado à mão · aguardando a fonte'), '606 em NORMALIZADOS com "✋ normalizado à mão"'),
    confere(etq(B, '604').includes('✋ normalizado à mão · aguardando a fonte'), 'na janela B: a mesma etiqueta (sem processar)'),
  ]);

  // 3. a fonte ainda não sabe; 605 recebe a hora; 607 some
  passo++;
  pend = [P(601, t('06.:50')), P(602, t('07.30')), P(603, t('8:05')), P(604, ''), P(605, t('09:12')), P(606, t('07:00'))];
  r = await processar(A, pend, norm);
  const v3 = [
    confere(vis(A, '604').length === 1 && dec(A, 'NIT-17', '604'), '604: continua UM card, aviso azul "ℹ 604 NORMALIZADO À MÃO" (antes criava outro pendente)'),
    confere(vis(A, '606').length === 1 && dec(A, 'NIT-17', '606'), '606: um card, aviso azul'),
    confere(vis(A, '605')[0]?.dataset.inicio === t('09:12') && !dec(A, 'NIT-14', '605'), '605 recebe 09:12 e o aviso some'),
    confere(!!dec(A, 'NIT-10', '607'), '⚠ 607 SAIU DO RELATÓRIO'),
  ];
  dec(A, 'NIT-10', '607')?.querySelector('button[data-acao="MANTER"]')?.click(); await h.dormir(250);
  v3.push(confere(/^✓ 607 CONTINUA PENDENTE\./.test(conf(A)), `PENDENTE no 607 → "✓ 607 CONTINUA PENDENTE." (veio: ${conf(A)})`));
  linha('A', r.nome, 'Processe. No 607: **PENDENTE**.', v3);

  // 4. janela B fecha 604 e 606 (fim antes/depois do horário à mão), 607 volta, 601 normaliza, 609 nasce sem hora
  passo++;
  pend = [P(602, t('07.30')), P(603, t('8:05')), P(605, t('09:12')), P(607, t('07:20')), P(609, '')];
  norm = [N(608, t('06:00'), t('06.:40')), N(604, t('06:50'), t('09:00')), N(606, t('07:00'), t('09:20')), N(601, t('06.:50'), t('10:00'))];
  r = await processar(B, pend, norm); await h.dormir(400);
  linha('B', r.nome, 'Na **janela B**, processe (a fonte fechou 604, 606 e 601).', [
    confere(vis(B, '604').length === 1 && etq(B, '604').includes('⟲ fim corrigido 09:10 → 09:00') && !etq(B, '604').some(x => /✋/.test(x)), '604: **um card só**, "⟲ fim corrigido 09:10 → 09:00", sem ✋'),
    confere(vis(B, '606').length === 1 && etq(B, '606').includes('⟲ fim corrigido 09:15 → 09:20'), '606: um card, "⟲ fim corrigido 09:15 → 09:20"'),
    confere(col(B, '601')[0] === 'normalizados' && vis(B, '601').length === 1, '601 normalizou (um card)'),
    confere(decT(B, '609').includes('⚠ 609 SEM HORA DE INÍCIO Veio sem a hora que começou.'), '⚠ 609 SEM HORA DE INÍCIO'),
    confere(vis(A, '604').length === 1 && vis(A, '606').length === 1, 'na janela A: também um card de cada'),
  ]);

  // 5. 609: à mão, a fonte insiste sem hora, operador REABRE
  passo++;
  await manual(A, '609', '10:40');
  r = await processar(A, pend, norm);
  const azul609 = !!dec(A, 'NIT-17', '609');
  dec(A, 'NIT-17', '609')?.querySelector('button[data-acao="REABRIR"]')?.click(); await h.dormir(300);
  linha('A', `— e ${r.nome}`, 'No card do **609**: ✓ → fim **10:40**. Depois processe (a fonte ainda manda o 609 sem hora). No aviso azul do 609: **REABRIR**.', [
    confere(azul609 && vis(A, '609').length === 1, '609: aviso azul, um card'),
    confere(/^✓ 609 REABRIU\./.test(conf(A)) && col(A, '609')[0] === 'espera', `REABRIR → "✓ 609 REABRIU." e volta para AGUARDANDO (veio: ${conf(A)})`),
  ]);

  // 6. 609 fecha pela fonte; 604 apaga DE NOVO (nova falha depois do fim); 607 à mão
  passo++;
  await manual(A, '607', '11:00');
  pend = [P(602, t('07.30')), P(603, t('8:05')), P(604, t('11:30')), P(605, t('09:12')), P(607, t('07:20'))];
  norm = [N(608, t('06:00'), t('06.:40')), N(604, t('06:50'), t('09:00')), N(606, t('07:00'), t('09:20')), N(601, t('06.:50'), t('10:00')), N(609, t('06:55'), t('10:35'))];
  r = await processar(A, pend, norm);
  linha('A', `— e ${r.nome}`, 'No card do **607**: ✓ → fim **11:00**. Depois processe (o 609 fechou; o 604 apagou de novo às 11:30).', [
    confere(vis(A, '609').length === 1 && col(A, '609')[0] === 'normalizados' && vis(A, '609')[0].dataset.inicio === t('06:55'), '609: um card, normalizado 06:55–10:35'),
    confere(vis(A, '604').length === 2 && col(A, '604').sort().join() === 'espera,normalizados', '604: dois cards — o normalizado (06:50–09:00) e a falha nova das 11:30 (é reincidência, o CEMOB também lista os dois)'),
    confere(r.toasts.some(x => /604 APAGOU DE NOVO/.test(x)), 'ℹ 604 APAGOU DE NOVO'),
    confere(dec(A, 'NIT-17', '607') && vis(A, '607').length === 1, '607: aviso azul (a fonte ainda diz pendente), um card'),
  ]);

  // 7. fechamento + relatório de saída
  passo++;
  pend = [P(604, t('11:30'))];
  norm = [N(608, t('06:00'), t('06.:40')), N(604, t('06:50'), t('09:00')), N(606, t('07:00'), t('09:20')), N(601, t('06.:50'), t('10:00')), N(609, t('06:55'), t('10:35')),
    N(602, t('07.30'), t('11:10')), N(603, t('8:05'), t('11:15')), N(605, t('09:12'), t('11:20')), N(607, t('07:20'), t('11:05'))];
  r = await processar(A, pend, norm);
  const rs = await relSaida(A); const conta = c => rs.split('\n').filter(l => new RegExp(`^${c} `).test(l)).length;
  linha('A', r.nome, 'Fechamento: processe. Depois **Ver Relatório** com **Incluir normalizados** marcado.', [
    confere(r.toasts.some(x => /PRONTO · 1 pendente · 9 normalizados/.test(x)), '✓ PRONTO · 1 pendente · 9 normalizados'),
    confere(etq(A, '607').includes('⟲ fim corrigido 11:00 → 11:05'), '607: "⟲ fim corrigido 11:00 → 11:05"'),
    confere(['601', '602', '603', '605', '606', '607', '608', '609'].every(c => conta(c) === 1) && conta('604') === 2, 'no relatório de saída cada semáforo aparece UMA vez; o 604 duas (normalizado + pendente das 11:30)'),
    confere(/^601 .*06:50 às 10:00/m.test(rs) && /^602 .*07:30 às 11:10/m.test(rs) && /^603 .*08:05 às 11:15/m.test(rs) && /^608 .*06:00 às 06:40/m.test(rs), 'horas certas no relatório: 601 06:50, 602 07:30, 603 08:05, 608 fim 06:40'),
    confere(!doc(A).querySelector('#nit-integridade-processamento .nd-card'), 'a ⚠ DECIDIR fica vazia'),
  ]);

  // 8. diário
  passo++;
  doc(B).getElementById('nit-diario-btn')?.click(); await h.dormir(300);
  const its = [...doc(B).querySelectorAll('#nit-diario .nit-diario-linha, #nit-diario .nit-diario-cab')].map(txt).join(' || ');
  linha('B', '—', 'Na janela B: **📜 LINHA DO TEMPO**.', [
    confere(/Hora lida com correção: 601 \(início "06\.:50" → 06:50\)/.test(its) && /602 \(início "07\.30" → 07:30\)/.test(its) && /608 \(fim "06\.:40" → 06:40\)/.test(its), '"ℹ Hora lida com correção: 601 (início "06.:50" → 06:50) · 602 … · 603 … · 608 (fim "06.:40" → 06:40)"'),
    confere(/605 hora de início ilegível/.test(its) && /604 sem hora de início/.test(its), '"⚠ Informações incompletas: … 604 sem hora de início · 605 hora de início ilegível"'),
    confere(/604 normalizado à mão às 09:10/.test(its) && /609 REABRIU/.test(its), 'as decisões: normalizações à mão, PENDENTE, REABRIU'),
  ]);

  const assin = n => JSON.stringify([...doc(n).querySelectorAll('#tab-semaforo .kanban-card')].filter(x => x.style.display !== 'none').map(c => c.dataset.eventoid + c.closest('.kanban-column')?.id).sort());
  if (assin(A) !== assin(B)) problemas.push('A e B terminaram diferentes');
  const md = `# 13.2.1 — roteiro de homologação: hora, sem hora de início e normalização à mão (${D})

Preparar: apague o nó \`kanban\` no Firebase do **nit-homologacao**; abra **duas janelas** (A e B); Ctrl+F5.
Semáforos 601 a 609 (endereços de exemplo). Os avisos ℹ somem em ~8 s: olhe logo depois de processar (ou no 📜).
Na janela de normalizar, espere ~5 s depois de confirmar (tempo do desfazer).

| # | Quem | Relatório | O que você faz | O que deve aparecer |
|---|---|---|---|---|
${linhas.join('\n')}

**Fechamento:** 1 pendente · 9 normalizados, iguais nas janelas A e B.

Casos cobertos: hora com erro de digitação no início (601 "06.:50", 602 "07.30", 603 "8:05") e no fim (608 "06.:40");
sem hora de início (604, 609) e hora ilegível (605 "09.:1") completada depois; normalização à mão sem início (604, 609)
e com início (606, 607); fonte fechando antes (604) e depois (606, 607) do horário à mão; fonte insistindo sem hora (604, 609);
REABRIR (609); "não veio" → PENDENTE (607); reincidência depois do fim (604); dois operadores (B fecha o que A normalizou à mão).
`;
  fs.writeFileSync(path.join(OUT, 'ROTEIRO-13-2-1.md'), md);
  console.log(md);
  console.log(problemas.length ? 'PROBLEMAS:\n' + problemas.join('\n') : 'CONFERIDO: tudo aparece como o roteiro diz');
  process.exit(0);
})();
