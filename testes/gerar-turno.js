// Gera o "turno simulado" para a homologação manual: relatórios t01..t15 + roteiro
// com o que fazer e o que deve aparecer (obtido rodando o NIT real no laboratório).
const fs = require('fs'), path = require('path');
const h = require('./harness');
const { Mundo, montar } = require('./estresse-mundo');
const [, , OUT, AAAA_MM_DD] = process.argv;
const [a, m, d] = AAAA_MM_DD.split('-').map(Number);
const plano = [
  ['correto', 'Processe (abertura do turno).'],
  ['correto', 'Processe.'],
  ['omitir', 'Processe. No card ⚠ NÃO VEIO, clique 📋 PERGUNTAR e cole no bloco de notas.'],
  ['correto', 'Processe (a fonte mandou o relatório certo).'],
  ['duplicar', 'Processe. Clique 📋 PERGUNTAR no card ⚠ VEIO 2 VEZES.'],
  ['correto', 'Processe.'],
  ['apagouFim', 'Processe. No card ⚠ VOLTOU PARA PENDENTE: REABRIR, confira nas duas janelas, depois DESFAZER.'],
  ['correto', 'Processe.'],
  ['retificar', 'Processe. Procure no card a etiqueta ⟲ início corrigido.'],
  ['corrigirFim', 'Processe. Procure no card normalizado a etiqueta ⟲ fim corrigido.'],
  ['semInicio', 'Processe. Confira na janela do B que os cards são os mesmos.'],
  ['fimAntes', 'Processe. Clique 📋 PERGUNTAR no card ⚠ HORÁRIO NÃO FECHA.'],
  ['correto', 'Processe.'],
  ['omitir', 'Processe. TIRAR no card ⚠ NÃO VEIO (some em A e B) → DESFAZER → MANTER.'],
  ['correto', 'Processe. Feche o turno: confira totais com o relatório.'],
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mundo = new Mundo(2210, { codigos: 18, base: { a, m, d } });
  const A = await h.subirNIT({ estado: {}, relogioIso: mundo.iso() });
  const linhas = [];
  const vistos = [];   // todos os toasts (somem da tela depois de alguns segundos)
  new A.w.MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.classList?.contains('toast') && vistos.push(n.textContent.trim()))))
    .observe(A.w.document.getElementById('toast-container'), { childList: true });
  let conhecidos = new Set();
  for (let i = 0; i < plano.length; i++) {
    const [tipo, fazer] = plano[i];
    mundo.avancar(40);
    A.relogio.definir(mundo.iso());
    let rel = mundo.relatorioLimpo(), desc = 'relatório correto';
    if (tipo !== 'correto') { const x = mundo.mutar(rel, tipo, conhecidos); rel = x.rel; desc = x.d || desc; }
    { const lim = mundo.relatorioLimpo(); conhecidos = new Set([...lim.pend, ...lim.norm].map(l => `${l.cod}|${l.ini}`)); }
    const nome = `t${String(i + 1).padStart(2, '0')}.txt`;
    const texto = montar(rel.data, rel.pend, rel.norm);
    fs.writeFileSync(path.join(OUT, nome), texto);
    const nT = vistos.length;
    await h.processar(A, texto); await h.dormir(200);
    const doc = A.w.document;
    const toasts = vistos.slice(nT).filter(x => !/Bem-vindo/.test(x));
    const tit = [...doc.querySelectorAll('#nit-integridade-processamento .nd-titulo, #nit-integridade-processamento .nd-card:not(.nd-chip) .nd-t')].map(e => e.textContent.trim());
    const tags = [...doc.querySelectorAll('#tab-semaforo .card-retificado')].map(e => `${e.closest('.kanban-card').dataset.codigo}: ${e.textContent.trim()}`);
    linhas.push(`| ${i + 1} | **${nome}** — ${desc} | ${fazer} | ${[...toasts, ...tit].join(' · ') || '—'} |`);
    // simula as ações do roteiro no laboratório para o próximo passo bater
    const btn = (msg, acao) => doc.querySelector(`#nit-integridade-processamento .nd-card[data-msg="${msg}"] button[data-acao="${acao}"]`);
    if (tipo === 'apagouFim') { btn('NIT-11', 'REABRIR')?.click(); await h.dormir(150); doc.querySelector('button[data-acao="DESFAZER"]')?.click(); await h.dormir(150); }
    if (tipo === 'omitir' && i === 13) { btn('NIT-10', 'TIRAR')?.click(); await h.dormir(150); doc.querySelector('button[data-acao="DESFAZER"]')?.click(); await h.dormir(150); btn('NIT-10', 'MANTER')?.click(); await h.dormir(150); }
    if (i === 9) linhas.push(`|  | etiquetas nos cards | | ${tags.join(' · ')} |`);
  }
  const vis = [...A.w.document.querySelectorAll('#tab-semaforo .kanban-card')].filter(c => c.style.display !== 'none');
  const norm = vis.filter(c => c.closest('#coluna-normalizados')).length;
  fs.writeFileSync(path.join(OUT, 'ROTEIRO-TURNO.md'), `# Turno simulado — homologação 13.2 (relatórios de ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a})

Preparar: apague o nó \`kanban\` no Firebase do nit-homologacao; duas janelas (A e B); Ctrl+F5.
Processe na janela do **A**, salvo quando indicado. Os horários "das HH:MM" e "PERGUNTADO HH:MM" usam o relógio do computador.

| # | Relatório (o que a fonte fez) | O que você faz | O que deve aparecer |
|---|---|---|---|
${linhas.join('\n')}

**Fim do turno:** ${vis.length - norm} pendentes · ${norm} normalizados no painel, iguais ao t15.

Anote: o que travou, o que confundiu, o que demorou (teste dos 5 segundos).
`);
  console.log(fs.readFileSync(path.join(OUT, 'ROTEIRO-TURNO.md'), 'utf8'));
  process.exit(0);
})();
