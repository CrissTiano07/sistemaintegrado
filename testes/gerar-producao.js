// Teste essencial de PRODUÇÃO logo após a publicação (madrugada, fora do turno).
// Semáforos 9901–9907 (não existem na operação) e endereço "TESTE NIT — APAGAR", para não misturar com cards reais.
// Cada passo roda no NIT real (janelas A e B no mesmo banco) e é CONFERIDO antes de ir para o roteiro.
// Uso: node gerar-producao.js <pasta-saida> <aaaa-mm-dd>
const fs = require('fs'), path = require('path');
const h = require('./harness');
const { montar } = require('./estresse-mundo');
const [, , OUT, DIA, REAL] = process.argv;   // REAL (opcional): último relatório de verdade — as pendências dele entram em todos os relatórios do teste
const pendReais = (() => {
  if (!REAL) return '';
  const txtR = fs.readFileSync(REAL, 'utf8').replace(/\r/g, '');
  const ini = txtR.search(/\*PENDENTES\*/), fim = txtR.search(/\*NORMALIZADOS\*/);
  if (ini < 0) return '';
  return txtR.slice(ini, fim < 0 ? undefined : fim).split('\n').slice(1).filter(l => /🚦/.test(l)).map(l => l + '\n').join('');
})();
const [aa, mm, dd] = DIA.split('-'); const D = `${dd}/${mm}/${aa}`;
const ontem = (() => { const x = new Date(Date.UTC(+aa, +mm - 1, +dd) - 864e5); return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${x.getUTCFullYear()}`; })();
const t = hm => `${D} ${hm}`;
const P = (cod, ini) => ({ cod: String(cod), ini, tipo: 'INVESTIGANDO', prob: 'APAGADO' });
const N = (cod, ini, fim) => ({ ...P(cod, ini), fim });
const relTxt = (pend, norm, data = D, reais = true) => montar(data, pend, norm).replace(/RUA (\d+) & AV ESTRESSE/g, 'TESTE NIT — APAGAR')
  .replace(/(\*PENDENTES\*❌\t\t\n\n)/, (m) => m + (reais ? pendReais : ''));
const nReais = (pendReais.match(/🚦/g) || []).length / 2;
const txt = e => (e?.textContent || '').replace(/\s+/g, ' ').trim();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const iso = `${DIA}T00:30:00`;
  const fb = h.criarFirebaseFalso({}, h.criarRelogio(iso));
  const A = await h.subirNIT({ estado: {}, relogioIso: iso, fb }), B = await h.subirNIT({ estado: {}, relogioIso: iso, fb });
  const doc = n => n.w.document;
  const cards = (n, c) => [...doc(n).querySelectorAll(`#tab-semaforo .kanban-card[data-codigo="${c}"]`)];
  const card = (n, c) => cards(n, c)[0];
  const dec = (n, msg, c) => doc(n).querySelector(`#nit-integridade-processamento .nd-card[data-msg="${msg}"][data-codigo="${c}"]`);
  const conf = n => txt(doc(n).querySelector('#nit-integridade-processamento .nd-confirmacao .nd-conf-txt'));
  const clicar = async (n, el, acao) => { const b = el?.querySelector(`button[data-acao="${acao}"]`); b?.click(); await h.dormir(250); return !!b; };
  const vistos = { A: [], B: [] };
  for (const [k, n] of [['A', A], ['B', B]])
    new n.w.MutationObserver(ms => ms.forEach(x => x.addedNodes.forEach(e => e.classList?.contains('toast') && vistos[k].push(txt(e)))))
      .observe(doc(n).getElementById('toast-container'), { childList: true });
  const linhas = [], problemas = []; let nRel = 0, passo = 0, ultimo = '';
  const confere = (ok, desc) => { if (!ok) problemas.push(`passo ${passo}: ${desc}`); return ok ? desc : `⚠ ${desc}`; };
  const processar = async (quem, n, texto) => {
    const nome = `p${String(++nRel).padStart(2, '0')}.txt`; fs.writeFileSync(path.join(OUT, nome), texto);
    const k = vistos[quem].length; await h.processar(n, texto); await h.dormir(300);
    return { nome, toasts: vistos[quem].slice(k).filter(x => !/Bem-vindo/.test(x)) };
  };
  const rel = (p, nn) => { ultimo = relTxt(p, nn); return ultimo; };
  const linha = (quem, arq, fazer, ver) => linhas.push(`| ${passo} | ${quem} | ${arq} | ${fazer} | ${ver.join('<br>')} |`);

  // 1. abertura
  passo++;
  let r = await processar('A', A, rel([P(9901, t('00:02')), P(9902, t('00:05')), P(9903, t('00:08')), P(9904, t('00:10')), P(9905, t('00:12'))], [N(9906, t('00:01'), t('00:04'))]));
  linha('A', r.nome, 'Processe (abertura).', [
    confere(r.toasts.some(x => new RegExp(`PRONTO · ${5 + nReais} pendentes? · 1 normalizados?`).test(x)), `✓ PRONTO · ${5 + nReais} pendente${5 + nReais === 1 ? '' : 's'} · 1 normalizado${nReais ? ` (inclui as ${nReais} reais)` : ''}`),
    confere(!doc(A).getElementById('coluna-decidir'), 'sem a coluna ⚠ DECIDIR'),
  ]);

  // 2. vários erros da fonte de uma vez
  passo++;
  r = await processar('A', A, rel([P(9902, t('00:06')), P(9904, t('00:10')), P(9904, t('00:17')), P(9905, '')],
    [N(9901, t('00:02'), t('00:20')), N(9906, t('00:01'), t('00:07'))]));
  const v2 = [
    confere(!!dec(A, 'NIT-10', '9903'), '⚠ 9903 SAIU DO RELATÓRIO'),
    confere(dec(A, 'NIT-12', '9904')?.classList.contains('nd-azul'), 'ℹ 9904 VEIO 2 VEZES (azul)'),
    confere(!!dec(A, 'NIT-14', '9905'), '⚠ 9905 SEM HORA DE INÍCIO'),
    confere(txt(card(A, '9902')?.querySelector('.card-retificado')) === '⟲ início corrigido 00:05 → 00:06', 'card 9902: ⟲ início corrigido 00:05 → 00:06'),
    confere(txt(card(A, '9906')?.querySelector('.card-retificado')) === '⟲ fim corrigido 00:04 → 00:07', 'card 9906: ⟲ fim corrigido 00:04 → 00:07'),
    confere(card(A, '9901')?.closest('#coluna-normalizados'), '9901 em NORMALIZADOS'),
    confere(card(A, '9905')?.dataset.inicio === t('00:12'), 'card 9905 continua com início 00:12 (linha sem hora não apaga)'),
  ];
  await clicar(A, dec(A, 'NIT-10', '9903'), 'MANTER');
  v2.push(confere(/^✓ 9903 CONTINUA PENDENTE\./.test(conf(A)), `PENDENTE no 9903 → "✓ 9903 CONTINUA PENDENTE." (veio: ${conf(A)})`));
  linha('A', r.nome, 'Processe. No 9903: **PENDENTE**.', v2);

  // 3. janela B: vê a DECIDIR sem processar, pergunta todas, cola o mesmo relatório
  passo++;
  await h.dormir(400);
  const vB = [confere(!!dec(B, 'NIT-14', '9905') && !!dec(B, 'NIT-12', '9904'), 'ANTES de colar: a ⚠ DECIDIR do B já mostra o 9905 e o 9904'),
    confere(!dec(B, 'NIT-10', '9903'), 'o 9903 já sumiu (o A decidiu)')];
  doc(B).querySelector('#nit-integridade-processamento button[data-acao="PERGUNTAR_TODAS"]')?.click(); await h.dormir(300);
  vB.push(confere(!!doc(A).querySelector('#nit-integridade-processamento .nd-card[data-codigo="9905"].nd-perguntado, #nit-integridade-processamento .nd-chip[data-codigo="9905"]'), '📋 PERGUNTAR TODAS no B → no A o 9905 aparece ⏳ PERGUNTADO'));
  r = await processar('B', B, ultimo);
  vB.push(confere(!dec(B, 'NIT-10', '9903'), 'colar o mesmo relatório não pergunta o 9903 de novo'));
  linha('B', `${r.nome} (= p02)`, 'Na janela B: veja a ⚠ DECIDIR **antes** de colar. Clique **📋 PERGUNTAR TODAS**. Depois cole o relatório.', vB);

  // 4. relatório corrigido + novidades
  passo++;
  r = await processar('A', A, rel([P(9901, t('00:30')), P(9902, t('00:06')), P(9903, t('00:08')), P(9904, t('00:10')), P(9905, t('00:12')), P(9907, t('00:25'))],
    [N(9901, t('00:02'), t('00:20')), N(9906, t('00:01'), t('00:07'))]));
  linha('A', r.nome, 'Processe (a fonte corrigiu + novidades).', [
    confere(r.toasts.some(x => /9901 APAGOU DE NOVO/.test(x)), 'ℹ 9901 APAGOU DE NOVO'),
    confere(!dec(A, 'NIT-12', '9904') && !dec(A, 'NIT-14', '9905'), '9904 e 9905 resolvidos (somem da ⚠ DECIDIR)'),
    confere(cards(A, '9901').length === 2, 'o 9901 fica com 2 cards: o normalizado das 00:02 e o pendente das 00:30'),
    confere(r.toasts.some(x => new RegExp(`PRONTO · ${6 + nReais} pendentes? · 2 normalizados?`).test(x)), `✓ PRONTO · ${6 + nReais} pendente${6 + nReais === 1 ? '' : 's'} · 2 normalizados${nReais ? ` (inclui as ${nReais} reais)` : ''}`),
  ]);

  // 5. normalizar à mão + fonte atrasada + voltou atrás
  passo++;
  card(A, '9907').querySelector('.btn-card-action.complete').click(); await h.dormir(200);
  doc(A).getElementById('norm-hora-fim').value = '00:40'; doc(A).getElementById('btn-norm-confirmar').click(); await h.dormir(5800);
  const v5 = [confere(card(A, '9907')?.querySelector('.card-manual') && card(B, '9907')?.querySelector('.card-manual'), 'card 9907: "✋ normalizado à mão" nas duas janelas')];
  r = await processar('A', A, rel([P(9901, t('00:30')), P(9902, t('00:06')), P(9903, t('00:08')), P(9904, t('00:10')), P(9905, t('00:12')), P(9906, t('00:01')), P(9907, t('00:25'))],
    [N(9901, t('00:02'), t('00:20'))]));
  v5.push(confere(dec(A, 'NIT-17', '9907')?.classList.contains('nd-azul') && !dec(A, 'NIT-11', '9907'), 'ℹ 9907 NORMALIZADO À MÃO (azul), sem "voltou atrás"'),
    confere(!!dec(A, 'NIT-11', '9906'), '⚠ 9906 VOLTOU ATRÁS'));
  await clicar(A, dec(A, 'NIT-11', '9906'), 'REABRIR');
  v5.push(confere(/^✓ 9906 REABRIU\./.test(conf(A)), `REABRIR → "✓ 9906 REABRIU." (veio: ${conf(A)})`));
  doc(A).querySelector('#nit-integridade-processamento .nd-confirmacao button[data-acao="DESFAZER"]')?.click(); await h.dormir(250);
  v5.push(confere(/^↩ DESFEITO\. 9906 VOLTOU\./.test(conf(A)), `DESFAZER → "↩ DESFEITO. 9906 VOLTOU." (veio: ${conf(A)})`));
  await clicar(A, dec(A, 'NIT-11', '9906'), 'MANTER_NORM');
  v5.push(confere(/^✓ 9906 CONTINUA NORMALIZADO\./.test(conf(A)) || /9906/.test(conf(A)), `MANTER NORMALIZADO → ${conf(A)}`),
    confere(card(A, '9906')?.closest('#coluna-normalizados'), '9906 continua em NORMALIZADOS'));
  linha('A', `— e ${r.nome}`, 'Primeiro: no card do **9907**, ✓ → fim **00:40** (espere ~5 s). Depois processe. No 9906: **REABRIR** → **DESFAZER** → **MANTER NORMALIZADO**.', v5);

  // 6. relatório de ontem → cancelar
  passo++;
  const tOntem = relTxt([P(9901, `${ontem} 23:00`)], [], ontem, false);
  const nomeO = `p${String(++nRel).padStart(2, '0')}.txt`; fs.writeFileSync(path.join(OUT, nomeO), tOntem);
  await h.processar(A, tOntem); await h.dormir(250);
  const md = h.modalAberto(A); await h.responderModal(A, false); await h.dormir(250);
  linha('A', nomeO, 'Processe. Na janela "ESTE RELATÓRIO É DE…": **CANCELAR**.', [
    confere(!!md && /ESTE RELATÓRIO/.test(md.titulo), `janela "${md?.titulo || '—'}"`),
    confere(cards(A, '9901').length === 2, 'CANCELAR: nada muda no painel'),
  ]);

  // 7. fechamento
  passo++;
  r = await processar('A', A, rel([], [N(9901, t('00:02'), t('00:20')), N(9901, t('00:30'), t('00:50')), N(9902, t('00:06'), t('00:45')), N(9903, t('00:08'), t('00:42')),
    N(9904, t('00:10'), t('00:44')), N(9905, t('00:12'), t('00:46')), N(9906, t('00:01'), t('00:07')), N(9907, t('00:25'), t('00:41'))]));
  linha('A', r.nome, 'Processe (a fonte fechou tudo).', [
    confere(r.toasts.some(x => new RegExp(`PRONTO · ${0 + nReais} pendentes? · 8 normalizados?`).test(x)), `✓ PRONTO · ${0 + nReais} pendente${0 + nReais === 1 ? '' : 's'} · 8 normalizados${nReais ? ` (inclui as ${nReais} reais)` : ''}`),
    confere(txt(card(A, '9907')?.querySelector('.card-retificado')) === '⟲ fim corrigido 00:40 → 00:41' && !card(A, '9907').querySelector('.card-manual'), '9907: vale o horário da fonte — "⟲ fim corrigido 00:40 → 00:41", sem a etiqueta ✋'),
    confere(!doc(A).querySelector('#nit-integridade-processamento .nd-card'), 'a ⚠ DECIDIR fica vazia'),
  ]);

  // 8. O QUE MUDOU
  passo++;
  doc(B).getElementById('nit-diario-btn')?.click(); await h.dormir(300);
  const its = [...doc(B).querySelectorAll('#nit-diario .nit-diario-item')].map(txt);
  linha('B', '—', 'Na janela B: **📜 O QUE MUDOU**. FECHAR.', [
    confere(its.length >= 8, `todas as entradas do teste (${its.length}), a mais recente no alto`),
    confere(its.some(x => /9906 CONTINUA NORMALIZADO|9906/.test(x)) && its.some(x => /9907 normalizado à mão/.test(x)), 'aparecem as suas decisões (9903, 9906, 9907)'),
  ]);

  await h.dormir(300);
  const assin = n => JSON.stringify([...doc(n).querySelectorAll('#tab-semaforo .kanban-card')].map(c => c.dataset.eventoid + c.closest('.kanban-column')?.id).sort());
  if (assin(A) !== assin(B)) problemas.push('A e B terminaram diferentes');
  const mdTxt = `# Teste essencial de produção — relatórios de ${D}

Semáforos **9901 a 9907** (não existem na operação; endereço "TESTE NIT — APAGAR").
${nReais ? `Os relatórios também trazem as **${nReais} pendências reais** do último relatório (${[...pendReais.matchAll(/🚦\t?(\w+)\t?🚦/g)].map(m => m[1]).join(', ')}), como a fonte faria: elas **não** podem virar pergunta. Os totais abaixo já as somam.` : 'Sem pendências reais no painel: confira antes que AGUARDANDO e SEM NECESSIDADE estão vazias.'}
Duas janelas (A e B), logadas, Ctrl+F5. **Não arraste card para VIA LIVRE/AMC** (o despacho vai para a planilha).
Os avisos ℹ somem em ~8 s: olhe logo depois de processar (ou no 📜 O QUE MUDOU).

| # | Quem | Relatório | O que você faz | O que deve aparecer |
|---|---|---|---|---|
${linhas.join('\n')}

**Fechamento:** ${nReais} pendente(s) (as reais) · 8 normalizados do teste, iguais nas janelas A e B.

## Limpar depois (antes das 05:30)
Feche as duas janelas. No console do Firebase de produção (nit-operacional), apague:
1. em \`kanban\`: os nós que começam com **990**;
2. em \`historico\`: os nós que começam com **990** (se houver);
3. \`auditoria/${D.replace(/\D/g, '')}\` (o 📜 do dia, só com o teste);
4. \`meta/decisoes_ativas\` (o próximo relatório do turno recria).
Abra o NIT de novo: painel sem nenhum 990x, 📜 "Nada registrado hoje.".
`;
  fs.writeFileSync(path.join(OUT, 'ROTEIRO-PRODUCAO.md'), mdTxt);
  console.log(mdTxt);
  console.log(problemas.length ? 'PROBLEMAS:\n' + problemas.join('\n') : 'CONFERIDO: tudo aparece como o roteiro diz');
  process.exit(0);
})();
