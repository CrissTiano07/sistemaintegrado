// Bateria de estresse 13.2 — "sentir na pele o que o operador vai sentir".
//  A) DIA SIMULADO: um turno inteiro (06:00 → 02:00 do dia seguinte), relatório a cada 30 min,
//     com erros da fonte intercalados com relatórios corretos. Dois operadores no mesmo banco.
//  B) SEQUÊNCIAS ALEATÓRIAS: relatórios com erros + cliques do operador (TIRAR, MANTER, REABRIR,
//     PERGUNTAR, DESFAZER…) + internet caindo, muitas sementes.
// Depois de CADA passo, as regras abaixo precisam continuar verdadeiras. Se uma quebrar,
// a bateria grava a semente e a sequência exata (estresse-falhas.json) para reproduzir.
//
//  R1 nunca dois pendentes do mesmo semáforo
//  R2 nenhuma pendência perdida (aberto no relatório → pendente no painel, ou pergunta NIT-11)
//  R3 nenhum card duplicado na tela
//  R4 nada apagado (nenhum nó do banco some)
//  R5 nenhuma linha "não entrou no painel" (NIT-35)
//  R6 relatório correto → painel bate com o relatório e nada a decidir
//  R7 reprocessar o mesmo relatório não muda nada
//  R8 DESFAZER volta exatamente ao estado de antes
//  R9 os dois operadores terminam vendo a mesma coisa
//  R10 nenhum erro de programa escondido
//
// Uso: node bateria-estresse.js [sementesB=40] [passosB=25]
const fs = require('fs');
const path = require('path');
const h = require('./harness');
const { Mundo, montar, rng } = require('./estresse-mundo');

const N_SEM = +(process.argv[2] || 40), N_PASSOS = +(process.argv[3] || 25);
const falhas = [];
let passosTotais = 0, relatoriosTotais = 0, cliquesTotais = 0;

// ── leitura do estado ─────────────────────────────────────────────────────
const doc = n => n.w.document;
const kanban = n => n.fb.estado().kanban || {};
const limpar = v => {   // estado comparável: sem carimbos de tempo/operador e sem campos vazios
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) {   // ordem das chaves não importa
      if (/^ts|^operador$|^turno$|^por$/.test(k)) continue;
      const y = limpar(x);
      if (y === '' || y == null || (typeof y === 'object' && !Object.keys(y).length)) continue;
      o[k] = y;
    }
    return o;
  }
  return v;
};
const foto = n => JSON.stringify(Object.keys(kanban(n)).sort().map(k => [k, limpar(kanban(n)[k])]));
const telaCards = n => [...doc(n).querySelectorAll('#tab-semaforo .kanban-card')];
const hojeDe = n => n.w.NitData ? n.w.NitData.hoje() : '';
const visHoje = n => { const hj = doc(n).defaultView.eval('NitData.hoje()'); return telaCards(n).filter(c => c.dataset.datareferencia === hj); };
const ehNorm = c => !!c.closest('#coluna-normalizados');
const itensDec = n => [...doc(n).querySelectorAll('#nit-integridade-processamento .nd-card')];
const assinaturaTela = n => JSON.stringify(telaCards(n).map(c => `${c.dataset.eventoid}@${c.closest('.kanban-column')?.id}`).sort());

function regras(n, relFeito, ctx, extra = {}) {
  const f = [];
  const vis = visHoje(n);
  const porCod = {};
  vis.filter(c => !ehNorm(c)).forEach(c => { porCod[c.dataset.codigo] = (porCod[c.dataset.codigo] || 0) + 1; });
  const legado = new Set(itensDec(n).filter(i => i.dataset.msg === 'NIT-16').map(i => i.dataset.codigo));
  for (const [c, k] of Object.entries(porCod)) if (k > 1 && !legado.has(c)) f.push(`R1 ${c} com ${k} pendentes`);
  if (relFeito) {
    const nit11 = new Set(itensDec(n).filter(i => i.dataset.msg === 'NIT-11').map(i => i.dataset.codigo));
    const decididos = extra.decididosNit11 || new Set();
    for (const l of relFeito.pend) if (!porCod[l.cod] && !nit11.has(l.cod) && !decididos.has(l.cod)) f.push(`R2 ${l.cod} aberto no relatório e sem pendente no painel — banco: ${JSON.stringify(Object.entries(kanban(n)).filter(([, v]) => v.codigo === l.cod).map(([k, v]) => [k, v.coluna, v.inicio, v.hora_fim || '', v.dataReferencia, v.retirado ? 'RETIRADO' : '', v.decisoes ? Object.keys(v.decisoes) : '']))} linha: ${JSON.stringify(relFeito.pend.filter(x => x.cod === l.cod))} tela: ${telaCards(n).filter(c => c.dataset.codigo === l.cod).map(c => c.dataset.eventoid + '@' + c.dataset.datareferencia).join(',')}`);
  }
  const ids = telaCards(n).map(c => c.dataset.eventoid);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) f.push(`R3 duplicados na tela: ${[...new Set(dup)]}`);
  const kb = kanban(n), chaves = Object.keys(kb);
  ctx.excluidos = ctx.excluidos || new Set();
  // R4: nada some do banco — exceto card EXCLUÍDO num dia anterior (limpeza do dia seguinte, aprovada em 19/10)
  for (const k of ctx.chavesVistas) if (!chaves.includes(k) && !ctx.excluidos.has(k)) f.push(`R4 nó ${k} sumiu do banco`);
  chaves.forEach(k => { ctx.chavesVistas.add(k); if (kb[k].retirado) ctx.excluidos.add(k); else ctx.excluidos.delete(k); });
  if (itensDec(n).some(i => i.dataset.msg === 'NIT-35')) f.push(`R5 NIT-35: ${itensDec(n).filter(i => i.dataset.msg === 'NIT-35').map(i => i.dataset.codigo)}`);
  const erros = n.erros.filter(e => !/Could not parse CSS/.test(e));
  if (erros.length > ctx.errosVistos) { f.push(`R10 erro de programa: ${erros.slice(ctx.errosVistos).join(' | ').slice(0, 300)}`); ctx.errosVistos = erros.length; }
  return f;
}

async function processar(n, texto, cancelarModal = false) {
  await h.processar(n, texto);
  if (h.modalAberto(n)) await h.responderModal(n, !cancelarModal);
  relatoriosTotais++;
}
function definirRelogio(ops, iso) { ops.forEach(o => o.relogio.definir(iso)); }

// ── A) DIA SIMULADO ───────────────────────────────────────────────────────
async function diaSimulado(semente) {
  const mundo = new Mundo(semente, { codigos: 22 });
  const fb = h.criarFirebaseFalso({}, h.criarRelogio(mundo.iso()));
  const A = await h.subirNIT({ estado: {}, relogioIso: mundo.iso(), fb });
  const B = await h.subirNIT({ estado: {}, relogioIso: mundo.iso(), fb });
  const ctx = { chavesVistas: new Set(), errosVistos: 0 };
  const ctxB = { chavesVistas: new Set(), errosVistos: 0 };
  const tipos = ['omitir', 'duplicar', 'semInicio', 'fimAntes', 'apagouFim', 'retificar', 'corrigirFim', 'repetir', 'dataErrada'];
  const diario = [];
  const esperados = new Set();
  for (let passo = 1; passo <= 40; passo++) {
    mundo.avancar(30);
    definirRelogio([A, B, { relogio: { definir: iso => fb.relogio?.definir?.(iso) } }], mundo.iso());
    const limpo = mundo.relatorioLimpo();
    let rel = limpo, desc = 'correto', limpoMesmo = true, cancelar = false;
    if (passo % 2 === 0) {
      const tipo = tipos[(passo / 2 - 1) % tipos.length];
      if (tipo === 'repetir') { desc = 'mesmo relatório colado de novo'; }
      else if (tipo === 'dataErrada') { rel = { ...limpo, data: mundo.ontem() }; desc = 'data de ontem no cabeçalho (operador CANCELA)'; cancelar = true; limpoMesmo = false; }
      else {
        const m = mundo.mutar(limpo, tipo);
        rel = m.rel; desc = m.d || `${tipo} (sem efeito)`; limpoMesmo = m.permanente || !m.d;
      }
    }
    const texto = montar(rel.data, rel.pend, rel.norm);
    const op = passo % 5 === 0 ? B : A;        // de vez em quando quem processa é o outro operador
    const ctxOp = op === A ? ctx : ctxB;
    const antes = foto(A);
    await processar(op, texto, cancelar);
    if (desc === 'mesmo relatório colado de novo') await processar(op, texto);
    await h.dormir(150);
    passosTotais++;
    const f = cancelar ? [] : regras(op, rel, ctxOp);
    if (cancelar && foto(A) !== antes) f.push('CANCELAR mudou o painel');
    if (!cancelar && limpoMesmo) {
      const vis = visHoje(op), pend = vis.filter(c => !ehNorm(c)).length, norm = vis.filter(ehNorm).length;
      if (pend !== rel.pend.length || norm !== rel.norm.length) f.push(`R6 painel ${pend}/${norm} × relatório ${rel.pend.length}/${rel.norm.length}`);
      // exceção correta: pendência cujo fim só saiu no relatório de ONTEM (que o NIT não processou
      // depois do fim) — o relatório de hoje não tem como fechá-la; o NIT pergunta (NIT-10).
      const amb = itensDec(op).filter(i => !/NIT-02/.test(i.dataset.msg) && !(i.dataset.msg === 'NIT-10' && mundo.fechouOntem(i.dataset.codigo)));
      itensDec(op).filter(i => i.dataset.msg === 'NIT-10' && mundo.fechouOntem(i.dataset.codigo)).forEach(i => esperados.add(`${i.dataset.codigo} fechou ontem, depois do último relatório → NIT pergunta (NIT-10)`));
      if (amb.length) f.push(`R6 relatório correto e ainda há decisão: ${amb.map(i => `${i.dataset.msg} ${i.dataset.codigo}`).join(', ')}`);
      const f1 = foto(op); await processar(op, texto); await h.dormir(100);
      if (foto(op) !== f1) f.push('R7 reprocessar o mesmo relatório mudou o estado');
    }
    await h.dormir(150);
    if (assinaturaTela(A) !== assinaturaTela(B)) f.push('R9 A e B veem painéis diferentes');
    diario.push(`${passo}. ${mundo.iso().slice(5, 16).replace('T', ' ')} ${op === A ? 'A' : 'B'} — ${desc}${f.length ? '  ✗ ' + f.join(' · ') : '  ✓'}`);
    if (process.env.DEBUG_COD) { const c = process.env.DEBUG_COD; console.log(`   [${passo}] ${c}:`, JSON.stringify(Object.entries(kanban(A)).filter(([k]) => k.startsWith(c + '_')).map(([k, v]) => [k, v.coluna, v.inicio, v.data_fim + ' ' + v.hora_fim, v.dataReferencia])), '| rel:', JSON.stringify([...rel.pend, ...rel.norm].filter(l => l.cod === c))); }
    if (f.length) falhas.push({ bateria: 'dia', semente, passo, desc, falhas: f, relatorio: texto });
  }
  A.dom.window.close(); B.dom.window.close();
  if (esperados.size) diario.push('', 'Comportamentos esperados observados:', ...[...esperados].map(x => '  · ' + x));
  return diario;
}

// ── B) SEQUÊNCIAS ALEATÓRIAS ──────────────────────────────────────────────
async function sequencia(semente) {
  const r = rng(semente * 7919 + 1);
  const mundo = new Mundo(semente, { codigos: 10 });
  const fb = h.criarFirebaseFalso({}, h.criarRelogio(mundo.iso()));
  const A = await h.subirNIT({ estado: {}, relogioIso: mundo.iso(), fb });
  const B = await h.subirNIT({ estado: {}, relogioIso: mundo.iso(), fb });
  const ctx = { chavesVistas: new Set(), errosVistos: 0 };
  const passos = [];
  let ultimoRel = null, fotoAntesAcao = null, decididosNit11 = new Set();
  const tipos = ['omitir', 'duplicar', 'semInicio', 'fimAntes', 'apagouFim', 'retificar', 'corrigirFim'];
  for (let i = 0; i < N_PASSOS; i++) {
    const x = r();
    let desc;
    const f = [];
    if (x < 0.45 || !ultimoRel) {
      mundo.avancar(20 + Math.floor(r() * 40));
      [A, B].forEach(o => o.relogio.definir(mundo.iso()));
      let rel = mundo.relatorioLimpo(); desc = 'relatório correto';
      if (r() < 0.6) { const m = mundo.mutar(rel, tipos[Math.floor(r() * tipos.length)]); rel = m.rel; desc = `relatório: ${m.d || 'correto'}`; }
      const op = r() < 0.25 ? B : A;
      await processar(op, montar(rel.data, rel.pend, rel.norm));
      ultimoRel = rel; fotoAntesAcao = null;
      rel.norm.forEach(l => decididosNit11.delete(l.cod));   // MANTER NORMALIZADO vale até a fonte devolver o fim   // R8 só compara quando nada mais mudou entre a ação e o DESFAZER
      desc = `${op === A ? 'A' : 'B'} ${desc}`;
      if (op === B) {   // R2 vale para quem processou (a lista de decisões é de cada janela)
        await h.dormir(120);
        f.push(...regras(B, rel, { chavesVistas: new Set(), errosVistos: B.erros.filter(e => !/Could not parse CSS/.test(e)).length }).filter(m => /^R2/.test(m)));
        rel.__jaConferido = true;
      }
    } else if (x < 0.85) {
      const cards = itensDec(A).filter(c => c.querySelector('button[data-acao]'));
      const btns = cards.flatMap(c => [...c.querySelectorAll('button[data-acao]')]);
      const desf = doc(A).querySelector('#nit-integridade-processamento button[data-acao="DESFAZER"]');
      const todas = doc(A).querySelector('#nit-integridade-processamento button[data-acao="PERGUNTAR_TODAS"]');
      const opcoes = [...btns, ...(desf ? [desf, desf] : []), ...(todas ? [todas] : [])];
      if (!opcoes.length) { desc = 'nada para clicar'; }
      else {
        const b = opcoes[Math.floor(r() * opcoes.length)];
        const acao = b.dataset.acao, card = b.closest('.nd-card');
        desc = `A clica ${acao}${card ? ` (${card.dataset.msg} ${card.dataset.codigo})` : ''}`;
        const antes = foto(A);
        if (acao === 'DESFAZER') {
          b.click(); await h.dormir(150);
          const nada = /Nada a desfazer/.test(doc(A).querySelector('#nit-integridade-processamento .nd-conf-txt')?.textContent || '');
          if (fotoAntesAcao && !nada && foto(A) !== fotoAntesAcao) {
            const a = new Map(JSON.parse(fotoAntesAcao)), d = new Map(JSON.parse(foto(A)));
            const dif = [...new Set([...a.keys(), ...d.keys()])].flatMap(k => {
              const x = a.get(k) || {}, y = d.get(k) || {};
              return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter(c => JSON.stringify(x[c]) !== JSON.stringify(y[c])).map(c => `${k}.${c}: ${JSON.stringify(x[c])} → ${JSON.stringify(y[c])}`);
            });
            f.push('R8 DESFAZER não voltou ao estado de antes: ' + dif.join('; '));
          }
          fotoAntesAcao = null;
        } else if (acao === 'NORMALIZOU') {
          b.click(); await h.dormir(100);   // abre a janela de normalizar; o operador desiste
          doc(A).getElementById('btn-norm-cancelar')?.click(); await h.dormir(100);
          if (doc(A).getElementById('modal-normalizar')?.classList.contains('visible')) f.push('R10 janela de normalizar não fechou');
        } else {
          b.click(); await h.dormir(150);
          if (['TIRAR', 'MANTER', 'REABRIR', 'MANTER_NORM'].includes(acao)) fotoAntesAcao = antes;
          if (card?.dataset.msg === 'NIT-11') decididosNit11.add(card.dataset.codigo);
        }
        cliquesTotais++;
      }
    } else if (x < 0.93) {
      fb.controle.definirOnline(false); await h.dormir(50);
      desc = 'internet cai';
      fb.controle.definirOnline(true); await h.dormir(50);
      desc += ' e volta';
    } else {
      await processar(A, montar(ultimoRel.data, ultimoRel.pend, ultimoRel.norm));
      desc = 'A cola o último relatório de novo'; fotoAntesAcao = null;
    }
    await h.dormir(120);
    passosTotais++;
    f.push(...regras(A, /relatório/.test(desc) && !ultimoRel.__jaConferido ? ultimoRel : null, ctx, { decididosNit11 }));
    if (assinaturaTela(A) !== assinaturaTela(B)) {
      const a = new Set(JSON.parse(assinaturaTela(A))), b = new Set(JSON.parse(assinaturaTela(B)));
      f.push(`R9 A e B veem painéis diferentes: só A ${[...a].filter(x => !b.has(x)).join(',')} · só B ${[...b].filter(x => !a.has(x)).join(',')}`);
    }
    passos.push(desc);
    if (f.length) { falhas.push({ bateria: 'aleatoria', semente, passo: i + 1, desc, falhas: f, sequencia: passos.slice() }); break; }
  }
  A.dom.window.close(); B.dom.window.close();
}

(async () => {
  const t0 = Date.now();
  console.log('A) DIA SIMULADO (06:00 → 02:00, relatório a cada 30 min, dois operadores)\n');
  const diario = process.env.SEMENTES ? [] : await diaSimulado(1610);
  diario.forEach(l => console.log('  ' + l));
  console.log(`\nB) SEQUÊNCIAS ALEATÓRIAS (${N_SEM} sementes × até ${N_PASSOS} passos)`);
  const lista = process.env.SEMENTES ? process.env.SEMENTES.split(',').map(Number) : Array.from({ length: N_SEM }, (_, i) => i + 1);
  for (const s of lista) {
    const antes = falhas.length;
    await sequencia(s);
    process.stdout.write(falhas.length > antes ? '✗' : '.');
  }
  console.log('\n');
  fs.writeFileSync(path.join(__dirname, 'estresse-falhas.json'), JSON.stringify(falhas, null, 2));
  console.log(`passos: ${passosTotais} · relatórios processados: ${relatoriosTotais} · cliques: ${cliquesTotais} · tempo: ${Math.round((Date.now() - t0) / 1000)} s`);
  const porRegra = {};
  falhas.forEach(x => x.falhas.forEach(m => { const k = m.split(' ')[0]; porRegra[k] = (porRegra[k] || 0) + 1; }));
  console.log('RESUMO estresse', falhas.length ? { FALHAS: falhas.length, porRegra } : { PASSOU: 'todas as regras' });
  for (const x of falhas.slice(0, 12)) console.log(`  ✗ [${x.bateria} semente ${x.semente} passo ${x.passo}] ${x.desc}: ${x.falhas.join(' · ')}`);
  process.exit(0);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
