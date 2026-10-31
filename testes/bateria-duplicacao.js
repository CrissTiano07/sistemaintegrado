// Bateria 13.2.1 — "forçar o card a duplicar" (pedido de 23/10/2026, depois do 446/933).
// Mistura, em sequências aleatórias reproduzíveis por semente:
//   · erros reais da fonte: hora digitada errada ("06.:50", "6:50", "06;50", "06h50", "06 :50", "0650"),
//     sem início, código sem o zero ("017" → "17"), linha repetida, linha omitida, fim apagado,
//     fim antes do início, tipo/problema trocado, início e fim corrigidos, relatório velho colado depois;
//   · o operador normalizando à mão pelos 3 caminhos (botão ✓, Central, arrastar), arrastando de volta,
//     processando relatório DURANTE os 5 s do "desfazer" do botão, dois operadores no mesmo banco.
// Depois de cada relatório CORRETO (a verdade do momento), confere:
//   D1 cada semáforo tem no painel exatamente tantos cards quantas linhas tem na fonte (nem duplica, nem some)
//   D2 os números do painel (pendentes + normalizados) somam o total da fonte
//   D3 o relatório de saída tem uma linha por ocorrência (mesma contagem por semáforo)
//   D4 os dois operadores veem a mesma coisa
//   D5 nenhum erro de programa
// Uso: node bateria-duplicacao.js [sementes=40] [passos=22]   ·   SEMENTES=3,7 VER=1 para reproduzir
const fs = require('fs'), path = require('path');
const h = require('./harness');
const { Mundo, montar, rng } = require('./estresse-mundo');

const N_SEM = +(process.argv[2] || 40), N_PASSOS = +(process.argv[3] || 22);
const doc = n => n.w.document;
const hojeDe = n => n.w.eval('NitData.hoje()');
const cardsHoje = n => { const hj = hojeDe(n); return [...doc(n).querySelectorAll('#tab-semaforo .kanban-card')].filter(c => c.dataset.datareferencia === hj); };
const ativos = n => cardsHoje(n).filter(c => c.closest('#coluna-espera, #coluna-normalizados'));
const p2 = x => String(x).padStart(2, '0');
const hm = n => { const d = new Date(n.relogio.agora()); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const assinatura = n => JSON.stringify([...doc(n).querySelectorAll('#tab-semaforo .kanban-card')].map(c => `${c.dataset.eventoid}@${c.closest('.kanban-column')?.id}`).sort());

async function processar(n, texto) {
  await h.processar(n, texto);
  for (let k = 0; k < 3 && h.modalAberto(n); k++) await h.responderModal(n, true);
}
async function relSaida(n) {
  const d = doc(n); const ck = d.getElementById('check-incluir-normalizados'); if (ck) ck.checked = true;
  d.getElementById('btn-visualizar-relatorio').click(); await h.dormir(200); if (h.modalAberto(n)) await h.responderModal(n, true); await h.dormir(150);
  const r = d.getElementById('modal-relatorio-texto').value; d.getElementById('btn-modal-fechar')?.click();
  return r.split('\n').filter(l => /^\d{2,4} 🚦/.test(l));
}
// ── operador ──
const cardDe = (n, cod, col) => doc(n).querySelector(`#${col} .kanban-card[data-codigo="${cod}"]`);
async function botao(n, cod, hora, durante) {     // durante(): algo que acontece na janela do desfazer
  const b = cardDe(n, cod, 'coluna-espera')?.querySelector('.btn-card-action.complete'); if (!b) return false;
  b.click(); await h.dormir(150);
  doc(n).getElementById('norm-hora-fim').value = hora; doc(n).getElementById('btn-norm-confirmar').click();
  if (durante) { await h.dormir(400); await durante(); await h.dormir(5600); } else await h.dormir(5800);
  return true;
}
async function central(n, cod, hora) {
  const c = cardDe(n, cod, 'coluna-espera'); if (!c) return false;
  const d = doc(n); c.click(); await h.dormir(250);
  d.querySelector('.nit-central-tab[data-tab="normalizar"]')?.click(); await h.dormir(150);
  const dt = new Date(n.relogio.agora());
  d.getElementById('central-norm-data').value = `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
  d.getElementById('central-norm-hora').value = hora; d.getElementById('btn-central-normalizar').click(); await h.dormir(400);
  d.querySelectorAll('[data-fechar], .nit-central-fechar, #btn-central-fechar').forEach(x => { try { x.click(); } catch (e) {} });
  return true;
}
async function arrastar(n, cod, de, para) {
  const card = cardDe(n, cod, de), alvo = doc(n).querySelector(`#${para} .kanban-cards-container`); if (!card || !alvo) return false;
  const ev = (tp, el) => { const e = new n.w.Event(tp, { bubbles: true, cancelable: true }); e.dataTransfer = { setData() {}, getData() { return ''; } }; e.clientY = 0; el.dispatchEvent(e); };
  ev('dragstart', card); ev('dragover', alvo); ev('drop', alvo); ev('dragend', card); await h.dormir(400);
  return true;
}

// ── erros da fonte (só neste relatório) ──
const TYPOS = [s => s.replace(/(\d{2}):(\d{2})$/, '$1.:$2'), s => s.replace(/ 0(\d):/, ' $1:'), s => s.replace(/:(\d{2})$/, ';$1'),
  s => s.replace(/:(\d{2})$/, 'h$1'), s => s.replace(/:(\d{2})$/, ' :$1'), s => s.replace(/(\d{2}):(\d{2})$/, '$1$2')];
function errar(r, rel, tipo, alvo) {   // alvo: o erro cai sempre no mesmo semáforo (fonte teimosa)
  const m = rel;
  const um0 = arr => arr.length ? arr[Math.floor(r() * arr.length)] : null;
  const um = arr => um0(alvo && arr.length && typeof arr[0] === 'object' ? arr.filter(l => l.cod === alvo) : arr);
  const todas = [...m.pend, ...m.norm];
  switch (tipo) {
    case 'typoIni': { const x = um(todas.filter(l => l.ini)); if (!x) return null; const t = um(TYPOS); x.ini = t(x.ini); return `${x.cod} início digitado "${x.ini.slice(11)}"`; }
    case 'typoFim': { const x = um(m.norm); if (!x) return null; const t = um(TYPOS); x.fim = t(x.fim); return `${x.cod} fim digitado "${x.fim.slice(11)}"`; }
    case 'semInicio': { const x = um(todas); if (!x) return null; x.ini = ''; return `${x.cod} sem início`; }
    case 'semZero': { const x = um(todas.filter(l => /^0/.test(l.cod))); if (!x) return null; x.cod = x.cod.replace(/^0+/, ''); return `${x.cod} sem o zero`; }
    case 'repetida': { const x = um(todas); if (!x) return null; (m.pend.includes(x) ? m.pend : m.norm).push({ ...x }); return `${x.cod} linha repetida`; }
    case 'omitir': { const x = um(todas); if (!x) return null; const a = m.pend.includes(x) ? m.pend : m.norm; a.splice(a.indexOf(x), 1); return `${x.cod} omitido`; }
    case 'apagouFim': { const x = um(m.norm); if (!x) return null; m.norm.splice(m.norm.indexOf(x), 1); m.pend.push({ cod: x.cod, ini: x.ini }); return `${x.cod} fim apagado`; }
    case 'minutoIni': { const x = um(todas.filter(l => l.ini)); if (!x) return null; const k = (1 + Math.floor(r() * 9)) * (r() < 0.5 ? -1 : 1);
      const [dd, hh] = x.ini.split(' '); const [H, M] = hh.split(':').map(Number); const t = Math.max(0, Math.min(23 * 60 + 59, H * 60 + M + k));
      x.ini = `${dd} ${p2(Math.floor(t / 60))}:${p2(t % 60)}`; return `${x.cod} início trocado para ${x.ini.slice(11)} (só neste)`; }
    case 'tipo': { const x = um(todas); if (!x) return null; x.tipo = um(['ENEL', 'FALHA DE EQUIPAMENTO', 'ABALROAMENTO', 'FURTO']); x.prob = um(['PISCANTE', 'APAGADO']); return `${x.cod} tipo trocado`; }
  }
  return null;
}

const falhas = [], perguntas = [];
let nRel = 0, nAcoes = 0;
async function sequencia(semente) {
  const r = rng(semente * 104729 + 3);
  const mundo = new Mundo(semente, { codigos: 8, inicioMin: 5 * 60 });
  // dois códigos com zero à esquerda, como os reais (017, 084)
  const troca = { 1001: '017', 1002: '084' };
  mundo.cods = mundo.cods.map(c => troca[c] || c); mundo.ocs.forEach(o => { o.cod = troca[o.cod] || o.cod; });
  const fb = h.criarFirebaseFalso({}, h.criarRelogio(mundo.iso()));
  const A = await h.subirNIT({ estado: {}, relogioIso: mundo.iso(), fb });
  const B = await h.subirNIT({ estado: {}, relogioIso: mundo.iso(), fb });
  const passos = []; let ultimoTexto = null, velho = null, errosVistos = 0, teimoso = null; const mantidos = new Set();
  const tipos = ['typoIni', 'typoIni', 'typoFim', 'semInicio', 'semInicio', 'semZero', 'repetida', 'omitir', 'apagouFim', 'tipo', 'minutoIni'];
  const conferir = async (n, limpo, onde) => {
    const f = [];
    const fonte = {}; [...limpo.pend, ...limpo.norm].forEach(l => { fonte[l.cod] = (fonte[l.cod] || 0) + 1; });
    const painel = {}; ativos(n).forEach(c => { painel[c.dataset.codigo] = (painel[c.dataset.codigo] || 0) + 1; });
    for (const c of new Set([...Object.keys(fonte), ...Object.keys(painel)]))
      if ((fonte[c] || 0) !== (painel[c] || 0)) f.push(`D1 ${c}: fonte ${fonte[c] || 0} × painel ${painel[c] || 0} [${cardsHoje(n).filter(x => x.dataset.codigo === c).map(x => `${x.dataset.eventoid}@${x.closest('.kanban-column')?.id.replace('coluna-', '')}${/"ts"/.test(x.dataset.normManual || "") ? "✋" : ""}`).join(' ')}]`);
    const d = doc(n), tot = (+d.getElementById('display-pendentes').textContent) + (+d.getElementById('display-normalizados').textContent);
    const tf = limpo.pend.length + limpo.norm.length;
    if (tot !== tf) f.push(`D2 painel soma ${tot} × fonte ${tf}`);
    const saida = await relSaida(n), porCod = {};
    saida.forEach(l => { const c = l.split(' ')[0]; porCod[c] = (porCod[c] || 0) + 1; });
    for (const c of new Set([...Object.keys(fonte), ...Object.keys(porCod)]))
      if ((fonte[c] || 0) !== (porCod[c] || 0)) f.push(`D3 saída ${c}: ${porCod[c] || 0} linha(s), fonte ${fonte[c] || 0}`);
    // Diferença num semáforo em que o NIT está PERGUNTANDO ao operador (ex.: "não veio") não é erro silencioso:
    // o operador decide e o número se acerta. Conta à parte, para relatar.
    const perguntando = new Set([...[...doc(n).querySelectorAll('#nit-integridade-processamento .nd-card')].map(e => e.dataset.codigo), ...mantidos]);   // + o operador mandou MANTER no "não veio"
    const d1 = f.filter(x => x.startsWith('D1 '));
    if (d1.length && d1.every(x => perguntando.has(x.split(' ')[1].replace(':', '')))) { perguntas.push(`semente ${semente}: ${d1.join(' · ')} (NIT perguntando: ${[...doc(n).querySelectorAll('#nit-integridade-processamento .nd-card')].filter(e => d1.some(x => x.split(' ')[1].replace(':', '') === e.dataset.codigo)).map(e => e.dataset.msg).join(',')})`); return []; }
    return f.map(x => `${onde}: ${x}`);
  };
  for (let i = 0; i < N_PASSOS; i++) {
    const x = r(); let desc; const f = [];
    const pend = ativos(A).filter(c => c.closest('#coluna-espera')).map(c => c.dataset.codigo);
    const norm = ativos(A).filter(c => c.closest('#coluna-normalizados')).map(c => c.dataset.codigo);
    if (x < 0.5 || !ultimoTexto) {
      mundo.avancar(15 + Math.floor(r() * 35));
      [A, B].forEach(o => o.relogio.definir(mundo.iso()));
      let corr = null;
      if (r() < 0.15) {   // a fonte CORRIGE de verdade (início ou fim): vira a verdade daqui em diante
        const q = r();
        if (q < 0.35) corr = mundo.mutar(mundo.relatorioLimpo(), 'retificar').d;
        else if (q < 0.65) corr = mundo.mutar(mundo.relatorioLimpo(), 'corrigirFim').d;
        else { const hj = mundo.hoje(); const fe = mundo.ocs.filter(o => o.fim != null && mundo.relatorioLimpo().norm.some(l => l.cod === o.cod));
          const o = fe[Math.floor(r() * fe.length)];
          if (o) { const ant = mundo.ocs.filter(x => x.cod === o.cod && x !== o && x.ini < o.ini).reduce((m, x) => Math.max(m, x.fim || 0), -1e9);
            const novo = o.ini + (r() < 0.5 ? -1 : 1) * (5 + Math.floor(r() * 15)); if (novo > ant && novo < o.fim) { o.ini = novo; corr = `corrigiu início de ${o.cod} (já normalizado)`; } } void hj; }
      }
      const limpo = mundo.relatorioLimpo();
      const op = r() < 0.3 ? B : A;
      // fonte teimosa: o mesmo erro no mesmo semáforo por vários relatórios (caso 446: "06.:50" das 07:01 às 11:38)
      if (!teimoso && r() < 0.18) { const c0 = [...limpo.pend, ...limpo.norm]; const l0 = c0[Math.floor(r() * c0.length)];
        if (l0) teimoso = { cod: l0.cod, tipo: ['typoIni', 'semInicio', 'semInicio', 'semZero', 'typoFim'][Math.floor(r() * 5)], restam: 2 + Math.floor(r() * 4), semente: Math.floor(r() * 1e6) }; }
      if (teimoso) {
        const errado = JSON.parse(JSON.stringify(limpo)); const d2 = errar(rng(teimoso.semente), errado, teimoso.tipo, teimoso.cod);
        if (d2 && teimoso.restam-- > 0) {
          await processar(op, montar(errado.data, errado.pend, errado.norm)); nRel++; await h.dormir(200);
          velho = ultimoTexto; ultimoTexto = montar(errado.data, errado.pend, errado.norm);
          passos.push(desc = `${op === A ? 'A' : 'B'} relatório ${mundo.iso().slice(11, 16)} com erro teimoso: ${d2} (faltam ${teimoso.restam})`);
          if (process.env.VER) console.log('   ' + i + '. ' + desc);
          if (process.env.COD) console.log('        rel: ' + JSON.stringify([...errado.pend.map(l=>['P',l.ini,l.fim]), ...errado.norm.map(l=>['N',l.ini,l.fim])].filter((x,k) => [...errado.pend, ...errado.norm][k].cod === process.env.COD)) + ' painel: ' + cardsHoje(op).filter(x => x.dataset.codigo === process.env.COD).map(x => `${x.dataset.eventoid}@${x.closest('.kanban-column')?.id.replace('coluna-', '')} ${(x.dataset.inicio||'').slice(11)}→${x.dataset.hora_fim || (x.dataset.fim||'').slice(11)}`).join(' | '));
          continue;
        }
        teimoso = null;
      }
      // 45%: relatório com erro, seguido do correto (como a CEMOB corrige no relatório seguinte)
      if (r() < 0.45) {
        const tipo = tipos[Math.floor(r() * tipos.length)];
        const errado = JSON.parse(JSON.stringify(limpo)); const d2 = errar(r, errado, tipo);
        if (d2) { await processar(op, montar(errado.data, errado.pend, errado.norm)); nRel++;
          passos.push(`${op === A ? 'A' : 'B'} relatório com erro: ${d2}`); if (process.env.COD) console.log('      ERR ' + d2 + ' :: ' + JSON.stringify([...errado.pend.map(l=>['P',l]), ...errado.norm.map(l=>['N',l])].filter(([,l]) => l.cod === process.env.COD)) + ' painel: ' + cardsHoje(op).filter(x => x.dataset.codigo === process.env.COD).map(x => `${x.dataset.eventoid}@${x.closest('.kanban-column')?.id.replace('coluna-', '')}`).join(' ')); await h.dormir(150); }
      }
      if (r() < 0.12 && velho) { await processar(op, velho); nRel++; passos.push(`${op === A ? 'A' : 'B'} cola relatório velho`); await h.dormir(150); }
      const texto = montar(limpo.data, limpo.pend, limpo.norm);
      await processar(op, texto); nRel++; await h.dormir(250);
      velho = ultimoTexto; ultimoTexto = texto;
      desc = `${op === A ? 'A' : 'B'} relatório correto ${mundo.iso().slice(11, 16)} (P${limpo.pend.length}/N${limpo.norm.length})${corr ? ' — fonte ' + corr : ''}`;
      f.push(...await conferir(op, limpo, op === A ? 'A' : 'B'));
    } else {
      nAcoes++;
      const y = r(), agora = hm(A);
      // o operador normaliza à mão; a fonte, em geral, manda o fim depois (com hora um pouco diferente)
      const fecharNoMundo = cod => { const o = mundo.ocs.find(o => o.cod === cod && o.fim == null); if (o && r() < 0.75) o.fim = Math.max(o.ini + 1, mundo.agora - Math.floor(r() * 4)); };
      const c = pend.length ? pend[Math.floor(r() * pend.length)] : null;
      if (y < 0.22 && c) { await botao(A, c, agora); fecharNoMundo(c); desc = `A normaliza ${c} pelo botão ${agora}`; }
      else if (y < 0.36 && c) { await central(A, c, agora); fecharNoMundo(c); desc = `A normaliza ${c} pela Central ${agora}`; }
      else if (y < 0.52 && c) { await arrastar(A, c, 'coluna-espera', 'coluna-normalizados'); fecharNoMundo(c); desc = `A arrasta ${c} para NORMALIZADOS`; }
      else if (y < 0.64 && c && ultimoTexto) {
        const t = ultimoTexto;
        await botao(A, c, agora, async () => { await processar(B, t); nRel++; });
        fecharNoMundo(c); desc = `A normaliza ${c} pelo botão e B processa durante o desfazer`;
      }
      else if (y < 0.74 && norm.length) { const n0 = norm[Math.floor(r() * norm.length)]; await arrastar(A, n0, 'coluna-normalizados', 'coluna-espera'); desc = `A arrasta ${n0} de volta para PENDENTES`;
        const o = mundo.ocs.filter(o => o.cod === n0 && o.fim != null).pop(); if (o && r() < 0.3) o.fim = null; }   // às vezes apagou de novo mesmo
      else {   // clica algo que o NIT perguntou
        const bt = [...doc(A).querySelectorAll('#nit-integridade-processamento .nd-card button[data-acao]')].filter(b => !['PERGUNTAR', 'NORMALIZOU'].includes(b.dataset.acao));
        if (bt.length) { const b = bt[Math.floor(r() * bt.length)]; const card = b.closest('.nd-card'); if (card?.dataset.msg === 'NIT-10' && b.dataset.acao === 'MANTER') mantidos.add(card.dataset.codigo);
          b.click(); await h.dormir(200); desc = `A clica ${b.dataset.acao} (${card?.dataset.msg} ${card?.dataset.codigo})`; }
        else desc = 'nada a fazer';
      }
      await h.dormir(150);
    }
    await h.dormir(150);
    if (assinatura(A) !== assinatura(B)) f.push('D4 A e B veem painéis diferentes');
    const erros = [...A.erros, ...B.erros].filter(e => !/Could not parse CSS/.test(e));
    if (erros.length > errosVistos) { f.push(`D5 erro: ${erros.slice(errosVistos).join(' | ').slice(0, 300)}`); errosVistos = erros.length; }
    passos.push(desc + (f.length ? '  ✗ ' + f.join(' · ') : ''));
    if (process.env.VER) console.log(`   ${i + 1}. ${passos[passos.length - 1]}`);
    if (process.env.COD) console.log('        ' + cardsHoje(A).filter(x => x.dataset.codigo === process.env.COD).map(x => `${x.dataset.eventoid}@${x.closest('.kanban-column')?.id.replace('coluna-', '')} ${x.dataset.inicio || ''}→${x.dataset.hora_fim || ''}`).join(' | '));
    if (f.length) { falhas.push({ semente, passo: i + 1, falhas: f, sequencia: passos.slice(), ultimoTexto }); break; }
  }
  A.dom.window.close(); B.dom.window.close();
}

(async () => {
  const t0 = Date.now();
  const lista = process.env.SEMENTES ? process.env.SEMENTES.split(',').map(Number) : Array.from({ length: N_SEM }, (_, i) => i + 1);
  for (const s of lista) { const a = falhas.length; await sequencia(s); process.stdout.write(falhas.length > a ? '✗' : '.'); }
  console.log('\n');
  fs.writeFileSync(path.join(__dirname, 'duplicacao-falhas.json'), JSON.stringify(falhas, null, 2));
  const porRegra = {}; falhas.forEach(x => x.falhas.forEach(m => { const k = m.split(' ')[1]; porRegra[k] = (porRegra[k] || 0) + 1; }));
  console.log(`sementes: ${lista.length} · relatórios: ${nRel} · ações do operador: ${nAcoes} · ${Math.round((Date.now() - t0) / 1000)} s`);
  console.log('RESUMO duplicação', falhas.length ? { FALHAS: falhas.length, porRegra } : { PASSOU: 'nenhuma duplicação' });
  if (perguntas.length) { console.log(`perguntas ao operador com número diferente da fonte até ele decidir: ${perguntas.length}`); perguntas.slice(0, 8).forEach(x => console.log('  ? ' + x)); }
  for (const x of falhas.slice(0, 15)) console.log(`  ✗ [semente ${x.semente} passo ${x.passo}] ${x.falhas.join(' · ')}\n      ${x.sequencia.slice(-4).join('\n      ')}`);
  process.exit(0);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
