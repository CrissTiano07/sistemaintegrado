// Roteiro manual das mudanças de 20/10 (132homolog7):
//  • colunas: nada recolhe sozinho; recolher/expandir à mão, título no alto; DECIDIR chega e as outras deslizam
//  • normalizar à mão é provisório (✋ etiqueta, ℹ NIT-17 azul) até a fonte mandar o fim
//  • data sugerida na janela de normalizar = hoje (antes, depois das 21h, sugeria amanhã)
// Cada passo roda no NIT real (janelas A e B no mesmo banco) e é CONFERIDO: se algo não aparecer
// como o roteiro diz, o gerador avisa (o roteiro nunca promete o que não acontece).
// Uso: node gerar-mudancas.js <pasta-saida> <aaaa-mm-dd>
const fs = require('fs'), path = require('path');
const h = require('./harness');
const { montar } = require('./estresse-mundo');
const [, , OUT, DIA] = process.argv;
const [aa, mm, dd] = DIA.split('-'); const D = `${dd}/${mm}/${aa}`;
const t = hm => `${D} ${hm}`;
const END = { 201: 'AV. SANTOS DUMONT & R. TIBÚRCIO CAVALCANTE', 202: 'AV. BEZERRA DE MENEZES & R. JOÃO CORDEIRO', 203: 'AV. WASHINGTON SOARES & R. DES. PRAXEDES',
  204: 'AV. HERÁCLITO GRAÇA & R. BARÃO DE ARACATI', 205: 'R. COSTA BARROS & AV. DOM MANUEL', 206: 'AV. AGUANAMBI & R. PADRE FRANCISCO PINTO' };
const P = (cod, ini) => ({ cod: String(cod), ini, tipo: 'ENEL', prob: 'APAGADO' });
const N = (cod, ini, fim) => ({ ...P(cod, ini), fim });
const relTxt = (pend, norm) => montar(D, pend, norm).replace(/RUA (\d+) & AV ESTRESSE/g, (_, c) => END[c] || `RUA ${c}`);
const txt = e => (e?.textContent || '').replace(/\s+/g, ' ').trim();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const iso = `${DIA}T21:30:00`;                    // depois das 21h: confere a data sugerida
  const fb = h.criarFirebaseFalso({}, h.criarRelogio(iso));
  const A = await h.subirNIT({ estado: {}, relogioIso: iso, fb }), B = await h.subirNIT({ estado: {}, relogioIso: iso, fb });
  const doc = n => n.w.document;
  const card = (n, c) => doc(n).querySelector(`#tab-semaforo .kanban-card[data-codigo="${c}"]`);
  const dec = (n, msg, c) => doc(n).querySelector(`#nit-integridade-processamento .nd-card[data-msg="${msg}"][data-codigo="${c}"]`);
  const conf = n => txt(doc(n).querySelector('#nit-integridade-processamento .nd-confirmacao .nd-conf-txt'));
  const recolhida = (n, id) => doc(n).getElementById(id)?.classList.contains('collapsed');
  const colunas = n => [...doc(n).querySelector('#tab-semaforo .kanban-board').children].filter(c => c.classList.contains('kanban-column')).map(c => c.id);
  const vistos = [];
  new A.w.MutationObserver(ms => ms.forEach(x => x.addedNodes.forEach(e => e.classList?.contains('toast') && vistos.push(txt(e)))))
    .observe(doc(A).getElementById('toast-container'), { childList: true });
  const linhas = [], problemas = []; let nRel = 0, passo = 0;
  const confere = (ok, desc) => { if (!ok) problemas.push(`passo ${passo}: ${desc}`); return ok ? desc : `⚠ ${desc}`; };
  const processar = async (n, pend, norm) => {
    const texto = relTxt(pend, norm); const nome = `m${String(++nRel).padStart(2, '0')}.txt`;
    fs.writeFileSync(path.join(OUT, nome), texto);
    const k = vistos.length; await h.processar(n, texto); await h.dormir(300);
    return { nome, toasts: vistos.slice(k).filter(x => !/Bem-vindo/.test(x)) };
  };
  const normalizarPeloCard = async (n, c, hora) => {
    card(n, c).querySelector('.btn-card-action.complete').click(); await h.dormir(200);
    const aberta = doc(n).getElementById('modal-normalizar').classList.contains('visible');
    const data = doc(n).getElementById('norm-data-fim').value;
    doc(n).getElementById('norm-hora-fim').value = hora;
    doc(n).getElementById('btn-norm-confirmar').click(); await h.dormir(5800);   // 5 s para desfazer o normalizar
    return { aberta, data };
  };
  const linha = (quem, rel, fazer, ver) => linhas.push(`| ${passo} | ${quem} | ${rel} | ${fazer} | ${ver.join('<br>')} |`);

  // 1. abertura
  passo++;
  const R1p = [P(201, t('07:00')), P(202, t('07:10')), P(203, t('07:20')), P(204, t('07:30')), P(205, t('07:40'))], R1n = [N(206, t('06:00'), t('06:30'))];
  let r = await processar(A, R1p, R1n);
  linha('A', r.nome, 'Processe (abertura).', [
    confere(r.toasts.some(x => /PRONTO · 5 pendentes · 1 normalizado/.test(x)), '✓ PRONTO · 5 pendentes · 1 normalizado'),
    confere(!doc(A).getElementById('coluna-decidir'), 'sem a coluna ⚠ DECIDIR'),
    confere(['coluna-vl', 'coluna-amc', 'coluna-sem-necessidade'].every(id => !recolhida(A, id)), 'VIA LIVRE, AMC e SEM NECESSIDADE vazias e ABERTAS (nada recolhe sozinho)'),
  ]);

  // 2. recolher à mão
  passo++;
  for (const id of ['coluna-vl', 'coluna-amc']) doc(A).querySelector(`#${id} .kanban-column-header`).click();
  await h.dormir(150);
  const grade = doc(A).querySelector('#tab-semaforo .kanban-board').style.gridTemplateColumns;
  linha('A', '—', 'Clique no título de **VIA LIVRE** e de **AMC**.', [
    confere(recolhida(A, 'coluna-vl') && recolhida(A, 'coluna-amc'), 'as duas viram faixas finas, com ▸, o número e o nome escrito de cima para baixo, começando no alto'),
    confere((grade.match(/36px/g) || []).length === 2, 'as outras colunas ocupam o espaço'),
    confere(!recolhida(B, 'coluna-vl') && !recolhida(B, 'coluna-amc'), 'na janela B continuam abertas (a escolha é de cada tela)'),
  ]);

  // 3. DECIDIR chega: as outras deslizam
  passo++;
  const R2p = [P(201, t('07:00')), P(202, t('07:10')), P(203, t('07:20')), P(204, t('07:30'))];
  r = await processar(A, R2p, R1n);
  const cols = colunas(A);
  const g3 = doc(A).querySelector('#tab-semaforo .kanban-board').style.gridTemplateColumns;
  linha('A', r.nome, 'Processe (o 205 sumiu).', [
    confere(cols[0] === 'coluna-decidir' && !!dec(A, 'NIT-10', '205'), '⚠ DECIDIR aparece como 1ª coluna com "⚠ 205 SAIU DO RELATÓRIO"'),
    confere(/minmax\(230px/.test(g3) && !recolhida(A, 'coluna-espera') && !recolhida(A, 'coluna-sem-necessidade'), 'nenhuma coluna recolheu sozinha: as outras deslizam para a direita (em tela estreita aparece a rolagem lateral)'),
    confere(recolhida(A, 'coluna-vl') && recolhida(A, 'coluna-amc'), 'VIA LIVRE e AMC continuam como você deixou (recolhidas)'),
  ]);

  // 4. NORMALIZOU no card "não veio"
  passo++;
  dec(A, 'NIT-10', '205').querySelector('button[data-acao="NORMALIZOU"]').click(); await h.dormir(200);
  const aberta4 = doc(A).getElementById('modal-normalizar').classList.contains('visible');
  const data4 = doc(A).getElementById('norm-data-fim').value;
  doc(A).getElementById('norm-hora-fim').value = '09:00';
  doc(A).getElementById('btn-norm-confirmar').click(); await h.dormir(5800);
  const c4 = conf(A);
  linha('A', '—', 'No 205: **NORMALIZOU** → hora do fim **09:00** → confirmar.', [
    confere(aberta4, 'abre a janela de normalizar'),
    confere(data4 === DIA, `a data sugerida é HOJE (${D}), mesmo depois das 21h`),
    confere(/^✓ 205 NORMALIZADO ÀS 09:00\./.test(c4), `"✓ 205 NORMALIZADO ÀS 09:00." (veio: ${c4})`),
    confere(txt(card(A, '205')?.querySelector('.card-manual')) === '✋ normalizado à mão · aguardando a fonte', 'card do 205 em NORMALIZADOS com "✋ normalizado à mão · aguardando a fonte"'),
  ]);

  // 5. normalizar à mão pelo ✓ do card
  passo++;
  const n203 = await normalizarPeloCard(A, '203', '08:15');
  const n204 = await normalizarPeloCard(A, '204', '08:30');
  linha('A', '—', 'No card do **203**: ✓ → fim **08:15**. No card do **204**: ✓ → fim **08:30**.', [
    confere(n203.aberta && n204.aberta && n203.data === DIA, 'a janela abre com a data de hoje'),
    confere(['203', '204'].every(c => card(A, c)?.closest('#coluna-normalizados') && card(A, c)?.querySelector('.card-manual')), 'os dois em NORMALIZADOS com a etiqueta ✋'),
    confere(['203', '204'].every(c => card(B, c)?.querySelector('.card-manual')), 'na janela B: a mesma etiqueta ✋ (sem processar)'),
  ]);

  // 6. a fonte ainda diz pendente
  passo++;
  r = await processar(A, R2p, R1n);
  const az = ['203', '204'].map(c => dec(A, 'NIT-17', c));
  linha('A', r.nome, 'Processe (a fonte ainda não sabe: 203 e 204 vêm pendentes).', [
    confere(az.every(x => x && x.classList.contains('nd-azul')), 'avisos azuis "ℹ 203 NORMALIZADO À MÃO" e "ℹ 204 NORMALIZADO À MÃO"'),
    confere(txt(az[0]?.querySelector('.nd-l2')) === 'Você normalizou às 08:15. A fonte ainda diz pendente. Nada a fazer: quando a fonte mandar o fim, vale o horário dela.', 'linha: "Você normalizou às 08:15. A fonte ainda diz pendente. Nada a fazer…"'),
    confere(!dec(A, 'NIT-11', '203') && !dec(A, 'NIT-11', '204'), 'NÃO aparece "VOLTOU ATRÁS"'),
    confere(card(A, '203')?.closest('#coluna-normalizados') && card(A, '204')?.closest('#coluna-normalizados'), 'os cards continuam em NORMALIZADOS'),
    confere(!dec(A, 'NIT-10', '205'), 'o 205 (normalizado à mão) não pergunta de novo'),
    confere(r.toasts.some(x => /PRONTO/.test(x)), 'azul não conta: ✓ PRONTO'),
  ]);

  // 7. REABRIR no aviso azul + DESFAZER
  passo++;
  dec(A, 'NIT-17', '203').querySelector('button[data-acao="REABRIR"]').click(); await h.dormir(250);
  const c7 = conf(A); const reab = card(A, '203')?.closest('#coluna-espera');
  doc(A).querySelector('#nit-integridade-processamento .nd-confirmacao button[data-acao="DESFAZER"]')?.click(); await h.dormir(250);
  const c7b = conf(A);
  linha('A', '—', 'No aviso azul do 203: **REABRIR** → veja o card voltar para AGUARDANDO → **DESFAZER**.', [
    confere(/^✓ 203 REABRIU\./.test(c7) && reab, `"✓ 203 REABRIU." e o card volta a pendente (veio: ${c7})`),
    confere(/^↩ DESFEITO\. 203 VOLTOU\./.test(c7b) && card(A, '203')?.closest('#coluna-normalizados') && card(A, '203')?.querySelector('.card-manual'), `"↩ DESFEITO. 203 VOLTOU." — normalizado à mão de novo, 08:15 (veio: ${c7b})`),
  ]);

  // 8. a fonte manda o fim
  passo++;
  r = await processar(A, [P(201, t('07:00')), P(202, t('07:10'))], [...R1n, N(203, t('07:20'), t('08:20')), N(204, t('07:30'), t('08:30')), N(205, t('07:40'), t('09:00'))]);
  linha('A', r.nome, 'Processe (a fonte mandou o fim do 203, 204 e 205).', [
    confere(txt(card(A, '203')?.querySelector('.card-retificado')) === '⟲ fim corrigido 08:15 → 08:20', '203: vale o horário da fonte — "⟲ fim corrigido 08:15 → 08:20"'),
    confere(card(A, '204')?.dataset && !card(A, '204').querySelector('.card-retificado'), '204: mesmo horário (08:30), sem etiqueta de correção'),
    confere(['203', '204', '205'].every(c => !card(A, c)?.querySelector('.card-manual') && !card(B, c)?.querySelector('.card-manual')), 'a etiqueta ✋ some dos três (A e B)'),
    confere(!doc(A).querySelector('#nit-integridade-processamento .nd-card[data-msg="NIT-17"]'), 'os avisos azuis somem'),
    confere(r.toasts.some(x => /PRONTO · 2 pendentes · 4 normalizados/.test(x)), '✓ PRONTO · 2 pendentes · 4 normalizados'),
  ]);

  // 9. expandir à mão
  passo++;
  for (const id of ['coluna-vl', 'coluna-amc']) doc(A).querySelector(`#${id} .kanban-column-header`).click();
  await h.dormir(150);
  linha('A', '—', 'Clique nas faixas de VIA LIVRE e AMC.', [confere(!recolhida(A, 'coluna-vl') && !recolhida(A, 'coluna-amc'), 'as duas abrem de novo')]);

  await h.dormir(300);
  const assin = n => JSON.stringify([...doc(n).querySelectorAll('#tab-semaforo .kanban-card')].map(c => c.dataset.eventoid + c.closest('.kanban-column')?.id).sort());
  if (assin(A) !== assin(B)) problemas.push('A e B terminaram diferentes');
  const md = `# Mudanças de 20/10 — roteiro manual (relatórios de ${D})

Preparar: apague o nó \`kanban\` no Firebase do nit-homologacao; janelas A e B; Ctrl+F5.
Testa: **colunas** (nada recolhe sozinho; recolher/expandir à mão, título no alto; a ⚠ DECIDIR chega e as outras deslizam) e
**normalizar à mão** (provisório até a fonte mandar o fim). Semáforos 201 a 206.
Nos passos com janela de normalizar, espere ~5 s depois de confirmar (tempo do desfazer).

| # | Quem | Relatório | O que você faz | O que deve aparecer |
|---|---|---|---|---|
${linhas.join('\n')}

**Fechamento:** 2 pendentes · 4 normalizados, iguais nas janelas A e B.
`;
  fs.writeFileSync(path.join(OUT, 'ROTEIRO-MUDANCAS.md'), md);
  console.log(md);
  console.log(problemas.length ? 'PROBLEMAS:\n' + problemas.join('\n') : 'CONFERIDO: tudo aparece como o roteiro diz');
  process.exit(0);
})();
