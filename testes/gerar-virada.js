// Teste de VIRADA (dia e turno) em produção, de madrugada, com o kanban zerado.
// Fase 1 — relatórios de ONTEM processados depois da meia-noite (o último do dia saiu tarde) pelo operador A.
// Fase 2 — o operador do turno seguinte abre o NIT (janela nova) e processa os relatórios de HOJE.
// Semáforos 9901–9908 ("TESTE NIT — APAGAR"). Cada passo roda no NIT real e é CONFERIDO.
// Uso: node gerar-virada.js <pasta-saida> <aaaa-mm-dd de HOJE> [hh:mm do teste, padrão 00:30]
const fs = require('fs'), path = require('path');
const h = require('./harness');
const { montar } = require('./estresse-mundo');
const [, , OUT, DIA, HORA = '00:30'] = process.argv;
const [aa, mm, dd] = DIA.split('-'); const HOJE = `${dd}/${mm}/${aa}`;
const xo = new Date(Date.UTC(+aa, +mm - 1, +dd) - 864e5);
const ONTEM = `${String(xo.getUTCDate()).padStart(2, '0')}/${String(xo.getUTCMonth() + 1).padStart(2, '0')}/${xo.getUTCFullYear()}`;
const o = hm => `${ONTEM} ${hm}`, t = hm => `${HOJE} ${hm}`;
const P = (cod, ini) => ({ cod: String(cod), ini, tipo: 'INVESTIGANDO', prob: 'APAGADO' });
const N = (cod, ini, fim) => ({ ...P(cod, ini), fim });
const relTxt = (data, pend, norm) => montar(data, pend, norm).replace(/RUA (\d+) & AV ESTRESSE/g, 'TESTE NIT — APAGAR');
const txt = e => (e?.textContent || '').replace(/\s+/g, ' ').trim();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const iso = `${DIA}T${HORA}:00`;
  const fb = h.criarFirebaseFalso({}, h.criarRelogio(iso));
  const A = await h.subirNIT({ estado: {}, relogioIso: iso, fb });
  let B = null;
  const doc = n => n.w.document;
  const vis = (n, c) => [...doc(n).querySelectorAll(`#tab-semaforo .kanban-card[data-codigo="${c}"]`)].filter(x => x.style.display !== 'none');
  const card = (n, c) => vis(n, c)[0];
  const col = (n, c) => card(n, c)?.closest('.kanban-column')?.id || '—';
  const dec = (n, msg, c) => doc(n).querySelector(`#nit-integridade-processamento .nd-card[data-msg="${msg}"][data-codigo="${c}"]`);
  const conf = n => txt(doc(n).querySelector('#nit-integridade-processamento .nd-confirmacao .nd-conf-txt'));
  const vistos = new Map();
  const observar = n => { vistos.set(n, []); new n.w.MutationObserver(ms => ms.forEach(x => x.addedNodes.forEach(e => e.classList?.contains('toast') && vistos.get(n).push(txt(e)))))
    .observe(doc(n).getElementById('toast-container'), { childList: true }); };
  observar(A);
  const linhas = [], problemas = []; let nRel = 0, passo = 0;
  const confere = (ok, desc) => { if (!ok) problemas.push(`passo ${passo}: ${desc}`); return ok ? desc : `⚠ ${desc}`; };
  const processar = async (n, texto, usarOntem = false) => {
    const nome = `v${String(++nRel).padStart(2, '0')}.txt`; fs.writeFileSync(path.join(OUT, nome), texto);
    const k = vistos.get(n).length; await h.processar(n, texto);
    let janela = null;
    if (h.modalAberto(n)) { janela = h.modalAberto(n); await h.responderModal(n, usarOntem); }
    await h.dormir(400);
    return { nome, janela, toasts: vistos.get(n).slice(k).filter(x => !/Bem-vindo/.test(x)) };
  };
  const linha = (quem, arq, fazer, ver) => linhas.push(`| ${passo} | ${quem} | ${arq} | ${fazer} | ${ver.join('<br>')} |`);
  const pronto = (r, p, n) => r.toasts.some(x => new RegExp(`PRONTO · ${p} pendentes? · ${n} normalizados?`).test(x));

  // ── FASE 0: relatório atrasado de ontem ───────────────────────────────
  passo++;
  let r = await processar(A, relTxt(ONTEM, [P(9901, o('21:00')), P(9902, o('21:10'))], [N(9905, o('20:00'), o('20:30'))]), true);
  const n02 = doc(A).querySelector('#nit-integridade-processamento .nd-card[data-msg="NIT-02"]');
  linha('A', r.nome, `Processe o último relatório de **ontem** (saiu tarde). Janela "ESTE RELATÓRIO É DE ${ONTEM.slice(0, 5)}": **USAR**.`, [
    confere(/ESTE RELATÓRIO É DE/.test(r.janela?.titulo || ''), `janela "${r.janela?.titulo || '—'}"`),
    confere(!!n02, `na ⚠ DECIDIR: "${txt(n02?.querySelector('.nd-t'))} ${txt(n02?.querySelector('.nd-l2'))}" (os semáforos ficam guardados com a data de ontem)`),
    confere(!card(A, '9901') && !card(A, '9902') && !card(A, '9905'), 'o painel de hoje NÃO mostra 9901, 9902, 9905 (é assim também na versão anterior)'),
  ]);

  // ── FASE 1: turno A, hoje ─────────────────────────────────────────────
  passo++;
  r = await processar(A, relTxt(HOJE, [P(9901, o('21:00')), P(9902, o('21:12')), P(9903, t('00:05')), P(9904, t('00:08'))], []));
  linha('A', r.nome, 'Processe o primeiro relatório de **hoje**.', [
    confere(['9901', '9902'].every(c => col(A, c) === 'coluna-espera'), 'as pendências de ontem (9901, 9902) aparecem em AGUARDANDO'),
    confere(txt(card(A, '9902')?.querySelector('.card-retificado')) === '⟲ início corrigido 21:10 → 21:12', 'card 9902: ⟲ início corrigido 21:10 → 21:12 (mesma ocorrência de ontem, não duplicou)'),
    confere(vis(A, '9902').length === 1 && vis(A, '9901').length === 1, 'um card por semáforo'),
    confere(!card(A, '9905'), '9905 (normalizado ontem) não aparece hoje'),
    confere(!doc(A).querySelector('#nit-integridade-processamento .nd-card[data-msg="NIT-02"]'), 'o aviso de ontem sai da ⚠ DECIDIR'),
    confere(pronto(r, 4, 0), '✓ PRONTO · 4 pendentes · 0 normalizados'),
  ]);

  passo++;
  r = await processar(A, relTxt(HOJE, [P(9902, o('21:12')), P(9904, t('00:08')), P(9904, t('00:15'))], [N(9901, o('21:00'), t('00:20'))]));
  const v3 = [
    confere(col(A, '9901') === 'coluna-normalizados', '9901 (de ontem) normalizou hoje às 00:20'),
    confere(!!dec(A, 'NIT-10', '9903'), '⚠ 9903 SAIU DO RELATÓRIO'),
    confere(dec(A, 'NIT-12', '9904')?.classList.contains('nd-azul'), 'ℹ 9904 VEIO 2 VEZES (azul)'),
  ];
  doc(A).querySelector('#nit-integridade-processamento .nd-card[data-msg="NIT-12"][data-codigo="9904"] button[data-acao="PERGUNTAR"]')?.click(); await h.dormir(250);
  card(A, '9902').querySelector('.btn-card-action.complete').click(); await h.dormir(200);
  const dataSug = doc(A).getElementById('norm-data-fim').value;
  doc(A).getElementById('norm-hora-fim').value = '00:25'; doc(A).getElementById('btn-norm-confirmar').click(); await h.dormir(5800);
  v3.push(confere(dataSug === DIA, `normalizar o 9902 (de ontem): a janela sugere a data de hoje (${HOJE})`),
    confere(col(A, '9902') === 'coluna-normalizados' && !!card(A, '9902')?.querySelector('.card-manual'), '9902 em NORMALIZADOS com "✋ normalizado à mão"'));
  linha('A', r.nome, 'Processe. No 9904: **📋 PERGUNTAR**. **Não responda** o 9903 (fica para o próximo turno). No card do **9902**: ✓ → fim **00:25** (espere ~5 s). Depois **Sair** e feche a janela A.', v3);
  A.dom.window.close();

  // ── FASE 2: turno B ───────────────────────────────────────────────────
  passo++;
  B = await h.subirNIT({ estado: {}, relogioIso: iso, fb }); observar(B); await h.dormir(800);
  const v4 = [
    confere(['9903', '9904'].every(c => col(B, c) === 'coluna-espera'), 'AGUARDANDO: 9903 e 9904'),
    confere(col(B, '9902') === 'coluna-normalizados' && !!card(B, '9902')?.querySelector('.card-manual'), '9902 normalizado à mão, com a etiqueta ✋'),
    confere(!!dec(B, 'NIT-10', '9903'), 'a ⚠ DECIDIR mostra o 9903 que o turno anterior não respondeu'),
    confere(!!doc(B).querySelector('#nit-integridade-processamento [data-codigo="9904"].nd-perguntado, #nit-integridade-processamento .nd-chip[data-codigo="9904"]'), 'e o 9904 já ⏳ PERGUNTADO pelo turno anterior'),
  ];
  doc(B).querySelector('#nit-integridade-processamento .nd-card[data-msg="NIT-10"][data-codigo="9903"] button[data-acao="MANTER"]')?.click(); await h.dormir(250);
  v4.push(confere(/^✓ 9903 CONTINUA PENDENTE\./.test(conf(B)), `PENDENTE no 9903 → "✓ 9903 CONTINUA PENDENTE." (veio: ${conf(B)})`));
  linha('B', '—', 'Abra o NIT numa **janela nova** (Ctrl+F5) e entre: é o turno seguinte. **Antes de colar**, olhe o painel. Depois, no 9903: **PENDENTE**.', v4);

  passo++;
  r = await processar(B, relTxt(HOJE, [P(9902, o('21:12')), P(9903, t('00:05')), P(9904, t('00:08')), P(9906, t('00:28'))], [N(9901, o('21:00'), t('00:20'))]));
  linha('B', r.nome, 'Processe (a fonte ainda não sabe do 9902).', [
    confere(dec(B, 'NIT-17', '9902')?.classList.contains('nd-azul') && !dec(B, 'NIT-11', '9902'), 'ℹ 9902 NORMALIZADO À MÃO (azul), sem "voltou atrás"'),
    confere(!dec(B, 'NIT-12', '9904'), '9904 resolvido (veio 1 vez)'),
    confere(col(B, '9906') === 'coluna-espera', '9906 novo em AGUARDANDO'),
  ]);

  passo++;
  r = await processar(B, relTxt(HOJE, [P(9906, t('00:28'))], [N(9901, o('21:00'), t('00:20')), N(9902, o('21:12'), t('00:30')), N(9903, t('00:05'), t('00:32')), N(9904, t('00:08'), t('00:35'))]));
  linha('B', r.nome, 'Fechamento: processe e confira.', [
    confere([...(card(B, '9902')?.querySelectorAll('.card-retificado') || [])].some(e => txt(e) === '⟲ fim corrigido 00:25 → 00:30') && !card(B, '9902')?.querySelector('.card-manual'), '9902: vale o horário da fonte — "⟲ fim corrigido 00:25 → 00:30" (abaixo do "⟲ início corrigido"), sem a etiqueta ✋'),
    confere(!doc(B).querySelector('#nit-integridade-processamento .nd-card'), 'a ⚠ DECIDIR fica vazia'),
    confere(pronto(r, 1, 4), '✓ PRONTO · 1 pendente · 4 normalizados'),
  ]);

  passo++;
  doc(B).getElementById('nit-diario-btn')?.click(); await h.dormir(300);
  const its = [...doc(B).querySelectorAll('#nit-diario .nit-diario-item')].map(txt);
  linha('B', '—', '**📜 O QUE MUDOU**: os dois turnos no mesmo diário. FECHAR.', [
    confere(its.length >= 7 && its.some(x => /9902 normalizado à mão/.test(x)) && its.some(x => /9903 CONTINUA PENDENTE/.test(x)), `${its.length} entradas: as do turno A (inclusive "9902 normalizado à mão") e as do B`),
  ]);

  const mdTxt = `# Teste de virada (dia + turno) — produção, ${HOJE} de madrugada

Kanban zerado antes de começar. Semáforos **9901 a 9908** ("TESTE NIT — APAGAR").
**Não arraste card para VIA LIVRE/AMC** (o despacho vai para a planilha).
Passo 1: o último relatório de **${ONTEM}** saiu tarde e é processado depois da meia-noite. Passos 2–3: turno A, relatórios de **${HOJE}**. Passos 4–7: o turno seguinte (janela nova).
Os avisos ℹ somem em ~8 s: olhe logo depois de processar (ou no 📜 O QUE MUDOU).

| # | Quem | Relatório | O que você faz | O que deve aparecer |
|---|---|---|---|---|
${linhas.join('\n')}

Fica de fora: o aviso de virada que aparece ao abrir o NIT de manhã (\`modal-virada-dia\`) — depende do relógio do computador e de ter processado ontem no mesmo navegador.

## Limpar depois (antes das 05:30)
Feche as janelas. No console do Firebase (nit-operacional), apague: em \`kanban\` e \`historico\` os nós **990…**;
\`auditoria/${HOJE.replace(/\D/g, '')}\`; \`meta/decisoes_ativas\`. Abra o NIT: painel sem 990x.
`;
  fs.writeFileSync(path.join(OUT, 'ROTEIRO-VIRADA.md'), mdTxt);
  console.log(mdTxt);
  console.log(problemas.length ? 'PROBLEMAS:\n' + problemas.join('\n') : 'CONFERIDO: tudo aparece como o roteiro diz');
  process.exit(0);
})();
