// Gera relatórios de TENSÃO para a homologação manual: muitos semáforos, vários erros
// da fonte no MESMO relatório, os dois operadores processando, repetição, data errada.
// O resultado esperado de cada passo sai rodando o NIT real (A e B no mesmo banco).
const fs = require('fs'), path = require('path');
const h = require('./harness');
const { Mundo, montar } = require('./estresse-mundo');
const [, , OUT, AAAA_MM_DD] = process.argv;
const [a, m, d] = AAAA_MM_DD.split('-').map(Number);
const TIPOS = ['INVESTIGANDO', 'ENEL', 'FURTO', 'FALHA DE EQUIPAMENTO', 'ABALROAMENTO', 'VANDALISMO', 'INVESTIGANDO', 'ENEL'];
const PROBS = ['APAGADO', 'PISCANTE', 'APAGADO', 'TRAVADO', 'APAGADO', 'PISCANTE'];
const vestir = l => ({ ...l, tipo: TIPOS[+l.cod % TIPOS.length], prob: PROBS[+l.cod % PROBS.length] });

// [quem processa, erros da fonte, o que o operador faz (texto), ações simuladas]
const plano = [
  ['A', [], 'Processe (abertura: muitos semáforos).', []],
  ['A', ['omitir', 'duplicar'], 'Processe. EXCLUIR no ⚠ NÃO VEIO. 📋 PERGUNTAR no ⚠ VEIO 2 VEZES (azul).', [['NIT-10', 'TIRAR'], ['NIT-12', 'PERGUNTAR']]],
  ['A', [], 'Processe. O semáforo que você EXCLUIU volta sozinho (a fonte listou de novo).', []],
  ['A', ['apagouFim', 'semInicio', 'fimAntes'], 'Processe (3 erros de uma vez). Clique 📋 PERGUNTAR TODAS e cole no bloco de notas.', [['*', 'PERGUNTAR_TODAS']]],
  ['B', 'repetir', 'Na janela do B, cole o MESMO relatório do passo 4. As perguntas aparecem ⏳ PERGUNTADO.', []],
  ['A', [], 'Processe (relatório corrigido).', []],
  ['A', ['retificar', 'corrigirFim', 'omitir'], 'Processe. PENDENTE no ⚠ NÃO VEIO. Procure as etiquetas ⟲.', [['NIT-10', 'MANTER']]],
  ['A', 'repetir', 'Cole o MESMO relatório de novo. Nada pode mudar.', []],
  ['A', 'dataErrada', 'Processe. Aparece "ESTE RELATÓRIO É DE ONTEM": clique CANCELAR.', 'cancelar'],
  ['A', ['apagouFim'], 'Processe. REABRIR → DESFAZER → MANTER NORMALIZADO.', [['NIT-11', 'REABRIR'], ['*', 'DESFAZER'], ['NIT-11', 'MANTER_NORM']]],
  ['B', ['duplicar', 'omitir'], 'Processe NA JANELA DO B. Decida lá mesmo: EXCLUIR no ⚠ NÃO VEIO.', [['NIT-10', 'TIRAR']]],
  ['A', [], 'Processe na janela do A (relatório corrigido).', []],
  ['A', [], 'Fechamento: processe e confira os totais com o relatório.', []],
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mundo = new Mundo(4242, { codigos: 32, base: { a, m, d } });
  const fb = h.criarFirebaseFalso({}, h.criarRelogio(mundo.iso()));
  const A = await h.subirNIT({ estado: {}, relogioIso: mundo.iso(), fb });
  const B = await h.subirNIT({ estado: {}, relogioIso: mundo.iso(), fb });
  const vistos = { A: [], B: [] };
  for (const [k, n] of [['A', A], ['B', B]])
    new n.w.MutationObserver(ms => ms.forEach(x => x.addedNodes.forEach(t => t.classList?.contains('toast') && vistos[k].push(t.textContent.trim()))))
      .observe(n.w.document.getElementById('toast-container'), { childList: true });
  const linhas = [];
  let conhecidos = new Set(), ultimoTexto = '';
  for (let i = 0; i < plano.length; i++) {
    const [quem, erros, fazer, acoes] = plano[i];
    const op = quem === 'A' ? A : B, doc = op.w.document;
    let texto, desc;
    if (erros === 'repetir') { texto = ultimoTexto; desc = 'mesmo relatório do passo anterior'; }
    else {
      mundo.avancar(45); A.relogio.definir(mundo.iso()); B.relogio.definir(mundo.iso());
      let rel = mundo.relatorioLimpo(); const ds = [];
      if (erros === 'dataErrada') { rel = { ...rel, data: mundo.ontem() }; ds.push('data de ontem no cabeçalho'); }
      else for (const e of erros) { const x = mundo.mutar(rel, e, conhecidos); rel = x.rel; if (x.d) ds.push(x.d); }
      if (erros !== 'dataErrada') { const lim = mundo.relatorioLimpo(); conhecidos = new Set([...lim.pend, ...lim.norm].map(l => `${l.cod}|${l.ini}`)); }
      texto = montar(rel.data, rel.pend.map(vestir), rel.norm.map(vestir));
      desc = ds.join(' + ') || 'relatório correto';
      if (erros !== 'dataErrada') ultimoTexto = texto;
    }
    const nome = `x${String(i + 1).padStart(2, '0')}.txt`;
    fs.writeFileSync(path.join(OUT, nome), texto);
    const nT = vistos[quem].length;
    await h.processar(op, texto);
    let modal = '';
    if (h.modalAberto(op)) { const md = h.modalAberto(op); modal = `janela: ${md.titulo} ${md.msg}`; await h.responderModal(op, acoes !== 'cancelar'); }
    await h.dormir(250);
    let fazerTxt = fazer, acoesFeitas = acoes;
    if (Array.isArray(acoes) && acoes.some(([, ac]) => ac === 'REABRIR')) {
      const c = doc.querySelector('#nit-integridade-processamento .nd-card[data-msg="NIT-11"]');
      if (c && !c.querySelector('button[data-acao="REABRIR"]')) {
        fazerTxt = `Processe. O botão REABRIR **não aparece** e o card explica: o ${c.dataset.codigo} já tem outra pendência aberta. Clique MANTER NORMALIZADO → DESFAZER → MANTER NORMALIZADO.`;
        acoesFeitas = [['NIT-11', 'MANTER_NORM'], ['*', 'DESFAZER'], ['NIT-11', 'MANTER_NORM']];
      }
    }
    const toasts = vistos[quem].slice(nT).filter(x => !/Bem-vindo/.test(x));
    const tit = [...doc.querySelectorAll('#nit-integridade-processamento .nd-titulo, #nit-integridade-processamento .nd-card:not(.nd-chip) .nd-t, #nit-integridade-processamento .nd-chip .nd-t')]
      .map(e => e.textContent.trim() + (e.closest('.nd-perguntado') ? ' (⏳ PERGUNTADO)' : ''));
    linhas.push(`| ${i + 1} | ${quem} | **${nome}** — ${desc} | ${fazerTxt} | ${[modal, ...toasts, ...tit].filter(Boolean).join(' · ') || '—'} |`);
    if (Array.isArray(acoesFeitas)) for (const [msg, ac] of acoesFeitas) {
      const b = msg === '*' ? doc.querySelector(`#nit-integridade-processamento button[data-acao="${ac}"]`)
                            : doc.querySelector(`#nit-integridade-processamento .nd-card[data-msg="${msg}"] button[data-acao="${ac}"]`);
      b?.click(); await h.dormir(200);
      if (!b) linhas.push(`|  |  | ⚠ ação "${ac}" não estava disponível no laboratório | | |`);
    }
    if (Array.isArray(acoes) && acoes.length) {
      const conf = doc.querySelector('#nit-integridade-processamento .nd-conf-txt')?.textContent.trim();
      if (conf) linhas.push(`|  |  | depois dos cliques | | ${conf} |`);
    }
    if (i === 2) {
      const ret = A.w.fb_ret;  // placeholder
    }
    if (i === 6) {
      const tags = [...A.w.document.querySelectorAll('#tab-semaforo .card-retificado')].map(e => `${e.closest('.kanban-card').dataset.codigo}: ${e.textContent.trim()}`);
      linhas.push(`|  |  | etiquetas nos cards | | ${tags.join(' · ')} |`);
    }
  }
  await h.dormir(300);
  const vis = [...A.w.document.querySelectorAll('#tab-semaforo .kanban-card')].filter(c => c.style.display !== 'none');
  const norm = vis.filter(c => c.closest('#coluna-normalizados')).length;
  const iguais = JSON.stringify([...A.w.document.querySelectorAll('#tab-semaforo .kanban-card')].map(c => c.dataset.eventoid + c.closest('.kanban-column')?.id).sort())
              === JSON.stringify([...B.w.document.querySelectorAll('#tab-semaforo .kanban-card')].map(c => c.dataset.eventoid + c.closest('.kanban-column')?.id).sort());
  fs.writeFileSync(path.join(OUT, 'ROTEIRO-TENSAO.md'), `# Tensão — homologação 13.2 (relatórios de ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a})

32 semáforos, vários erros da fonte no mesmo relatório, os dois operadores processando.
Preparar: apague o nó \`kanban\` no Firebase do nit-homologacao; janelas A e B; Ctrl+F5.
Horários "das HH:MM" e "PERGUNTADO HH:MM" seguem o relógio do computador; os avisos ℹ somem em ~8 s (olhe logo após processar).

| # | Quem | Relatório (o que a fonte fez) | O que você faz | O que deve aparecer |
|---|---|---|---|---|
${linhas.join('\n')}

**Fechamento:** ${vis.length - norm} pendentes · ${norm} normalizados. As janelas A e B ${iguais ? 'devem mostrar exatamente os mesmos cards' : '⚠ divergiram no laboratório'}.

Anote o que travou, confundiu ou demorou. Tente também, livremente: clicar rápido, DESFAZER duas vezes, recolher/expandir colunas no meio do processo, derrubar a internet antes de clicar.
`);
  console.log(fs.readFileSync(path.join(OUT, 'ROTEIRO-TENSAO.md'), 'utf8'));
  process.exit(0);
})();
