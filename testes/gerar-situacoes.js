// 22 situações diferentes, cada uma num semáforo próprio, numa sequência curta de relatórios.
// O esperado de cada passo sai do NIT real (A e B no mesmo banco) e é CONFERIDO: se o NIT não
// mostrar o que a situação pede, o gerador para e avisa (o roteiro nunca promete o que não acontece).
const fs = require('fs'), path = require('path');
const h = require('./harness');
const { montar } = require('./estresse-mundo');
const [, , OUT, DIA] = process.argv;                       // DIA aaaa-mm-dd
const [aa, mm, dd] = DIA.split('-'); const D = `${dd}/${mm}/${aa}`;
const ontem = (() => { const x = new Date(Date.UTC(+aa, +mm - 1, +dd) - 864e5); return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${x.getUTCFullYear()}`; })();
const t = hm => `${D} ${hm}`;
const END = { 101: 'AV. SANTOS DUMONT & R. TIBÚRCIO CAVALCANTE', 102: 'AV. BEZERRA DE MENEZES & R. JOÃO CORDEIRO', 103: 'AV. WASHINGTON SOARES & R. DES. PRAXEDES',
  104: 'AV. HERÁCLITO GRAÇA & R. BARÃO DE ARACATI', 105: 'R. COSTA BARROS & AV. DOM MANUEL', 106: 'AV. AGUANAMBI & R. PADRE FRANCISCO PINTO',
  107: 'AV. ROGACIANO LEITE & R. ANDRADE FURTADO', 108: 'AV. 13 DE MAIO & AV. DA UNIVERSIDADE', 109: 'AV. PONTES VIEIRA & R. JOÃO CARVALHO',
  110: 'AV. ANTÔNIO SALES & R. TORRES CÂMARA', 111: 'AV. JOÃO PESSOA & R. CARNEIRO DA CUNHA', 112: 'AV. VIRGÍLIO TÁVORA & R. CANUTO DE AGUIAR' };
const TP = { 101: ['ENEL', 'APAGADO'], 102: ['FURTO', 'APAGADO'], 103: ['INVESTIGANDO', 'PISCANTE'], 104: ['FALHA DE EQUIPAMENTO', 'APAGADO'], 105: ['INVESTIGANDO', 'APAGADO'],
  106: ['ENEL', 'PISCANTE'], 107: ['ABALROAMENTO', 'APAGADO'], 108: ['ENEL', 'APAGADO'], 109: ['INVESTIGANDO', 'TRAVADO'], 110: ['VANDALISMO', 'APAGADO'], 111: ['ENEL', 'APAGADO'], 112: ['FURTO', 'PISCANTE'] };
const P = (cod, ini) => ({ cod: String(cod), ini, tipo: TP[cod][0], prob: TP[cod][1] });
const N = (cod, ini, fim) => ({ ...P(cod, ini), fim });
const relTxt = (pend, norm, data = D) => montar(data, pend, norm).replace(/RUA (\d+) & AV ESTRESSE/g, (_, c) => END[c] || `RUA ${c}`);

// estado-base de cada relatório: [pendentes, normalizados]
const base = {
  p: { 101: '07:00', 102: '07:10', 103: '07:20', 104: '07:30', 106: `${ontem} 22:00`, 107: '07:50', 108: '08:00', 109: '08:05', 110: '08:10' },
};
const passos = [
  { quem: 'A', sit: ['S01', 'S21'], fazer: 'Processe (abertura).',
    pend: [P(101, t('07:00')), P(102, t('07:10')), P(103, t('07:20')), P(104, t('07:30')), P(106, `${ontem} 22:00`), P(107, t('07:50')), P(108, t('08:00')), P(109, t('08:05')), P(110, t('08:10'))],
    norm: [N(111, t('06:00'), t('06:40')), N(112, t('06:10'), t('06:50'))], espera: ['PRONTO'] },
  { quem: 'A', sit: ['S02', 'S04', 'S05', 'S06', 'S09', 'S22'], fazer: 'Processe. PENDENTE no 103 (ele continua apagado). 📋 PERGUNTAR no 104 (azul, só para saber) e no 111.',
    pend: [P(102, t('07:15')), P(104, t('07:30')), P(104, t('08:20')), P(106, `${ontem} 22:00`), P(107, t('07:50')), P(108, t('08:00')), P(109, t('08:05')), P(110, t('08:10'))],
    norm: [N(101, t('07:00'), t('08:30')), N(112, t('06:10'), t('06:55'))],
    acoes: [['NIT-10', 'MANTER', '103'], ['NIT-12', 'PERGUNTAR', '104'], ['NIT-10', 'PERGUNTAR', '111']],
    espera: ['103 NÃO VEIO', '104 VEIO 2 VEZES', '111 NÃO VEIO'], tags: ['102', '112'] },
  { quem: 'A', sit: ['S03', 'S12'], fazer: 'Processe (relatório corrigido + novidades).',
    pend: [P(101, t('09:00')), P(102, t('07:15')), P(103, t('07:20')), P(104, t('07:30')), P(105, ''), P(106, `${ontem} 22:00`), P(107, t('07:50')), P(108, t('08:00')), P(109, t('08:05')), P(110, t('08:10'))],
    norm: [N(101, t('07:00'), t('08:30')), N(111, t('06:00'), t('06:40')), N(112, t('06:10'), t('06:55'))],
    espera: ['101 APAGOU DE NOVO', '104 RESOLVIDO', '111 RESOLVIDO', '105 SEM HORA DE INÍCIO'] },
  { quem: 'A', sit: ['S07', 'S10', 'S11'], fazer: 'Processe. EXCLUIR no 107 (some também na janela B) → DESFAZER → EXCLUIR de novo.',
    pend: [P(101, t('09:00')), P(102, t('07:15')), P(103, t('07:20')), P(104, t('07:30')), P(105, ''), P(106, `${ontem} 22:00`), P(109, ''), P(110, t('08:10'))],
    norm: [N(101, t('07:00'), t('08:30')), N(108, t('08:00'), t('07:40')), N(111, t('06:00'), t('06:40')), N(112, t('06:10'), t('06:55'))],
    acoes: [['NIT-10', 'TIRAR', '107'], ['*', 'DESFAZER'], ['NIT-10', 'TIRAR', '107']],
    espera: ['107 NÃO VEIO', '108 HORÁRIO NÃO FECHA', '109 SEM HORA DE INÍCIO'], confere: { '109': 'card do 109 continua com início 08:05' } },
  { quem: 'A', sit: ['S08'], fazer: 'Processe (relatório corrigido). O 107 que você tirou volta sozinho.',
    pend: [P(101, t('09:00')), P(102, t('07:15')), P(103, t('07:20')), P(104, t('07:30')), P(105, t('09:10')), P(106, `${ontem} 22:00`), P(107, t('07:50')), P(109, t('08:05'))],
    norm: [N(101, t('07:00'), t('08:30')), N(108, t('08:00'), t('09:40')), N(110, t('08:10'), t('09:50')), N(111, t('06:00'), t('06:40')), N(112, t('06:10'), t('06:55'))],
    espera: ['108 RESOLVIDO', '109 RESOLVIDO', '105 RESOLVIDO', 'PRONTO'] },
  { quem: 'A', sit: ['S13', 'S15', 'S14'], fazer: 'Processe. No 110: REABRIR → DESFAZER → 📋 PERGUNTAR. No 101 o REABRIR NÃO aparece (já tem outra pendência): MANTER NORMALIZADO.',
    pend: [P(101, t('07:00')), P(101, t('09:00')), P(102, t('07:15')), P(103, t('07:20')), P(104, t('07:30')), P(105, t('09:10')), P(106, `${ontem} 22:00`), P(107, t('07:50')), P(109, t('08:05')), P(110, t('08:10'))],
    norm: [N(108, t('08:00'), t('09:40')), N(111, t('06:00'), t('06:40')), N(112, t('06:10'), t('06:55'))],
    acoes: [['NIT-11', 'REABRIR', '110'], ['*', 'DESFAZER'], ['NIT-11', 'PERGUNTAR', '110'], ['NIT-11', 'MANTER_NORM', '101']],
    espera: ['110 VOLTOU ATRÁS', '101 VOLTOU ATRÁS', 'Já existe outra pendência do 101'], semReabrir: '101' },
  { quem: 'A', sit: ['S18'], fazer: 'Cole o MESMO relatório de novo. Nada pode mudar; o 101 não pergunta de novo.', repetir: true, espera: ['PRONTO'], naoEspera: ['101 VOLTOU'] },
  { quem: 'A', sit: ['S24'], fazer: 'Clique 📜 O QUE MUDOU (no topo). Confira o que aconteceu em cada relatório e as suas decisões. FECHAR.', diario: true },
  { quem: 'A', sit: ['S25'], fazer: 'Clique Ver Relatório. Aparece o lembrete do 110: clique ESPERAR (não abre). Clique Ver Relatório de novo → GERAR ASSIM MESMO (abre o relatório, sem marcação).', lembrete: true },
  { quem: 'B', sit: ['S19'], fazer: 'Na janela do B: ANTES de colar, veja que a coluna ⚠ DECIDIR já mostra o 110 ⏳ PERGUNTADO (é a mesma das duas janelas). Depois cole o mesmo relatório.', repetir: true, espera: ['110 VOLTOU ATRÁS (⏳'] },
  { quem: 'A', sit: ['S16'], fazer: 'Processe. Janela "ESTE RELATÓRIO É DE ONTEM": clique CANCELAR. Nada muda.', ontem: true, cancelar: true, espera: ['janela'] },
  { quem: 'A', sit: ['S17'], fazer: 'Cole este texto (não é relatório) e processe.', texto: 'Bom dia, pessoal! Segue o relatório mais tarde.', espera: ['NÃO ENTENDI'] },
  { quem: 'A', sit: ['S20'], fazer: 'DESLIGUE o Wi-Fi. Clique MANTER NORMALIZADO no 110. Veja "📵 SEM INTERNET. Não feche a aba." LIGUE o Wi-Fi: "✓ SALVO". (Sem relatório neste passo.)', semRelatorio: true },
  { quem: 'A', sit: ['S02'], fazer: 'Fechamento: processe e confira os totais.',
    pend: [P(101, t('09:00')), P(102, t('07:15')), P(103, t('07:20')), P(105, t('09:10')), P(106, `${ontem} 22:00`), P(109, t('08:05'))],
    norm: [N(101, t('07:00'), t('08:30')), N(104, t('07:30'), t('10:30')), N(107, t('07:50'), t('10:20')), N(108, t('08:00'), t('09:40')), N(110, t('08:10'), t('09:50')), N(111, t('06:00'), t('06:40')), N(112, t('06:10'), t('06:55'))],
    espera: ['PRONTO'] },
];
const SIT = {
  S01: 'Abertura normal (✓ PRONTO)', S02: 'Pendente que normaliza', S03: 'Apagou de novo no mesmo dia (ℹ APAGOU DE NOVO)', S04: 'Fonte corrigiu o início (⟲ início corrigido)',
  S05: 'Fonte corrigiu o fim (⟲ fim corrigido)', S06: 'Não veio no relatório → PENDENTE', S07: 'Não veio → EXCLUIR → DESFAZER (dois operadores)', S08: 'Card excluído volta quando a fonte lista de novo',
  S09: 'Veio 2 vezes → PERGUNTAR → resolvido', S10: 'Fim antes do início (HORÁRIO NÃO FECHA)', S11: 'Linha sem início NÃO apaga o início do card', S12: 'Pendência nova já sem início',
  S13: 'Voltou atrás (mesma ocorrência) → REABRIR → DESFAZER', S14: 'MANTER NORMALIZADO fica lembrado', S15: 'Sem REABRIR quando já há outra pendência (o card explica)', S16: 'Relatório de outro dia → CANCELAR',
  S17: 'Texto que não é relatório', S18: 'Mesmo relatório colado de novo (nada muda)', S19: 'Operador B vê o que o A perguntou', S20: 'Sem internet / salvo', S24: '📜 O QUE MUDOU consultável', S25: 'Lembrete ao gerar relatório com decisão aberta',
  S21: 'Pendência de ontem continua hoje', S22: 'Normalizado que some do relatório',
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const fb = h.criarFirebaseFalso({}, h.criarRelogio(`${DIA}T11:00:00`));
  const A = await h.subirNIT({ estado: {}, relogioIso: `${DIA}T11:00:00`, fb }), B = await h.subirNIT({ estado: {}, relogioIso: `${DIA}T11:00:00`, fb });
  const vistos = { A: [], B: [] };
  for (const [k, n] of [['A', A], ['B', B]])
    new n.w.MutationObserver(ms => ms.forEach(x => x.addedNodes.forEach(e => e.classList?.contains('toast') && vistos[k].push(e.textContent.trim()))))
      .observe(n.w.document.getElementById('toast-container'), { childList: true });
  const linhas = []; const problemas = []; let ultimo = '', nRel = 0;
  for (let i = 0; i < passos.length; i++) {
    const p = passos[i]; const op = p.quem === 'A' ? A : B; const doc = op.w.document;
    let nome = '—', saida = [];
    if (p.diario) {
      doc.getElementById('nit-diario-btn')?.click(); await h.dormir(300);
      const its = [...doc.querySelectorAll('#nit-diario .nit-diario-item')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
      saida.push(`${its.length} entradas; a mais recente: "${(its[0] || '').slice(0, 90)}…"`);
      if (its.length < 5) problemas.push(`passo ${i + 1}: diário com poucas entradas (${its.length})`);
      doc.querySelector('#nit-diario [data-fechar]')?.click(); await h.dormir(100);
    } else if (p.lembrete) {
      doc.getElementById('btn-visualizar-relatorio').click(); await h.dormir(200);
      const md = h.modalAberto(op); saida.push(md ? `janela: ${md.titulo} ${md.msg} [GERAR ASSIM MESMO] [ESPERAR]` : '⚠ sem lembrete');
      if (!md) problemas.push(`passo ${i + 1}: lembrete não apareceu`);
      await h.responderModal(op, false);
      doc.getElementById('btn-visualizar-relatorio').click(); await h.dormir(200); await h.responderModal(op, true);
      saida.push(doc.getElementById('modal-relatorio').classList.contains('visible') ? 'relatório abriu' : '⚠ relatório não abriu');
      doc.getElementById('btn-modal-fechar')?.click(); await h.dormir(100);
    } else if (!p.semRelatorio) {
      const texto = p.texto || (p.repetir ? ultimo : p.ontem ? relTxt([P(101, `${ontem} 07:00`)], [], ontem) : relTxt(p.pend, p.norm));
      if (!p.repetir && !p.texto && !p.ontem) ultimo = texto;
      nome = `s${String(++nRel).padStart(2, '0')}.txt`;
      fs.writeFileSync(path.join(OUT, nome), texto);
      const n0 = vistos[p.quem].length;
      await h.processar(op, texto);
      if (h.modalAberto(op)) { const md = h.modalAberto(op); saida.push(`janela: ${md.titulo} ${md.msg} [USAR] [CANCELAR]`); await h.responderModal(op, !p.cancelar); }
      await h.dormir(250);
      saida.push(...vistos[p.quem].slice(n0).filter(x => !/Bem-vindo/.test(x)));
      saida.push(...[...doc.querySelectorAll('#nit-integridade-processamento .nd-titulo, #nit-integridade-processamento .nd-card .nd-t, #nit-integridade-processamento .nd-l3')]
        .map(e => e.textContent.trim() + (e.closest('.nd-perguntado') ? ' (⏳ PERGUNTADO)' : '')));
    } else {
      const b = doc.querySelector('#nit-integridade-processamento .nd-card[data-msg="NIT-11"][data-codigo="110"] button[data-acao="MANTER_NORM"]');
      if (!b) problemas.push(`passo ${i + 1}: botão MANTER NORMALIZADO do 110 não está na tela`);
      fb.controle.definirOnline(false); await h.dormir(100); b?.click(); await h.dormir(300);
      saida.push(doc.getElementById('nit-gravacao-status')?.textContent.trim());
      fb.controle.definirOnline(true); await h.dormir(300);
      saida.push(doc.getElementById('nit-gravacao-status')?.textContent.trim());
      saida.push(doc.querySelector('#nit-integridade-processamento .nd-conf-txt')?.textContent.trim());
    }
    const txt = saida.join(' · ');
    for (const e of p.espera || []) if (!txt.includes(e)) problemas.push(`passo ${i + 1}: esperava "${e}" — veio: ${txt}`);
    for (const e of p.naoEspera || []) if (txt.includes(e)) problemas.push(`passo ${i + 1}: NÃO devia aparecer "${e}"`);
    if (p.semReabrir) { const c = doc.querySelector(`#nit-integridade-processamento .nd-card[data-msg="NIT-11"][data-codigo="${p.semReabrir}"]`);
      if (!c || c.querySelector('button[data-acao="REABRIR"]')) problemas.push(`passo ${i + 1}: o ${p.semReabrir} devia aparecer SEM o botão REABRIR`); }
    if (p.tags) saida.push(...p.tags.map(c => `etiqueta ${c}: ${doc.querySelector(`#tab-semaforo .kanban-card[data-codigo="${c}"] .card-retificado`)?.textContent.trim() || '⚠ não apareceu'}`));
    if (p.confere) for (const [c, d] of Object.entries(p.confere)) {
      const ok = [...doc.querySelectorAll(`#tab-semaforo .kanban-card[data-codigo="${c}"]`)].some(x => x.dataset.inicio === t('08:05'));
      saida.push(`${ok ? '✓' : '⚠'} ${d}`); if (!ok) problemas.push(`passo ${i + 1}: ${d}`);
    }
    for (const [msg, acao, cod] of p.acoes || []) {
      const sel = msg === '*' ? `#nit-integridade-processamento button[data-acao="${acao}"]`
        : `#nit-integridade-processamento .nd-card[data-msg="${msg}"]${cod ? `[data-codigo="${cod}"]` : ''} button[data-acao="${acao}"]`;
      const b = doc.querySelector(sel); if (!b) problemas.push(`passo ${i + 1}: botão ${acao} ${cod || ''} não disponível`);
      b?.click(); await h.dormir(200);
      const conf = doc.querySelector('#nit-integridade-processamento .nd-conf-txt')?.textContent.trim();
      if (['TIRAR', 'MANTER', 'REABRIR', 'MANTER_NORM', 'DESFAZER'].includes(acao) && conf) saida.push(`→ ${acao.replace('_', ' ')}${cod ? ' ' + cod : ''}: ${conf}`);
    }
    linhas.push(`| ${i + 1} | ${p.quem} | ${nome} | ${p.sit.map(s => `**${s}** ${SIT[s]}`).join('<br>')} | ${p.fazer} | ${saida.filter(Boolean).join(' · ')} |`);
  }
  await h.dormir(300);
  const assin = n => JSON.stringify([...n.w.document.querySelectorAll('#tab-semaforo .kanban-card')].map(c => c.dataset.eventoid + c.closest('.kanban-column')?.id).sort());
  if (assin(A) !== assin(B)) problemas.push('A e B terminaram diferentes');
  const vis = [...A.w.document.querySelectorAll('#tab-semaforo .kanban-card')].filter(c => c.style.display !== 'none');
  const norm = vis.filter(c => c.closest('#coluna-normalizados')).length;
  const md = `# 22 situações — homologação 13.2 (relatórios de ${D})

Preparar: apague o nó \`kanban\` no Firebase do nit-homologacao; janelas A e B; Ctrl+F5.
Cada situação usa um semáforo próprio (101 a 112). Os avisos ℹ somem em ~8 s: olhe logo após processar.
"das HH:MM" e "PERGUNTADO HH:MM" seguem o relógio do computador.

| # | Quem | Relatório | Situações | O que você faz | O que deve aparecer |
|---|---|---|---|---|---|
${linhas.join('\n')}

**Fechamento:** ${vis.length - norm} pendentes · ${norm} normalizados, iguais nas janelas A e B.

Situações cobertas: ${Object.keys(SIT).length} (${Object.keys(SIT).join(', ')}).
`;
  fs.writeFileSync(path.join(OUT, 'ROTEIRO-SITUACOES.md'), md);
  console.log(md);
  console.log(problemas.length ? 'PROBLEMAS:\n' + problemas.join('\n') : 'CONFERIDO: todas as situações aparecem como o roteiro diz');
  process.exit(0);
})();
