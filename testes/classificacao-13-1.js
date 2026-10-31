// Bateria da classificação 13.1 — testa SOMENTE a função _classificarLinhas (leitura).
// Para cada cenário: estado dos cards (como o motor corrigido o deixaria) + relatório
// → decisão esperada por linha. Também verifica:
//   • independência da ordem: o mesmo relatório com seções e linhas invertidas dá as mesmas decisões;
//   • invariantes sobre o resultado projetado: ≤1 pendente por semáforo e nenhuma linha aberta sem pendente.
const fs = require('fs');
const path = require('path');
const h = require('./harness');

const T = '\t';
const D = '14/10/2026';
const cab = d => `*🚦PLANTÃO CEMOB*${T}${d}${T}\n*PLANTONISTA* ${T}TESTE${T}\n${T}${T}\n`;
const linhaOc = ({ cod, ini, fim }) =>
  `INVESTIGANDO${T}*🚦${T}${cod}${T}🚦${T}RUA ${cod} & AV TESTE${T}●${T}APAGADO${T}●*${T}Início:${T}${ini || ''}${fim ? `${T}Fim:${T}${fim}` : `${T}${T}`}${T}"\n"${T}\n`;
const secP = l => `*PENDENTES*❌${T}${T}\n\n` + l.map(linhaOc).join('');
const secN = l => `${T}${T}\n*NORMALIZADOS*✅${T}${T}\n\n` + l.map(linhaOc).join('');
const rel = (d, pend = [], norm = []) => cab(d) + secP(pend) + secN(norm);
const relInvertido = (d, pend = [], norm = []) => cab(d) + secN([...norm].reverse()) + `${T}${T}\n` + secP([...pend].reverse());

const t = (hm, d = D) => `${d} ${hm}`;
const idDe = (cod, ini) => `${cod}_${ini.replace(/[^0-9]/g, '').slice(0, 12)}`;
// card(cod, idHm, { ini, aliases, norm, fim, dref })
const card = (cod, idIni, o = {}) => ({
  id: idDe(cod, idIni), codigo: cod, inicio: o.ini ?? idIni,
  aliases: (o.aliases || []).map(a => idDe(cod, a)), normalizado: !!o.norm, fim: o.fim || '',
  dataReferencia: o.dref || D,
});

const CENARIOS = [
  { id: 'C01', nome: 'Retificação 08:00 → 08:20 (sem fim)',
    cards: [card('790', t('08:00'))], pend: [{ cod: '790', ini: t('08:20') }],
    esperado: [['790', t('08:20'), 'A', 'RETIFICAR']] },
  { id: 'C02', nome: 'Card retificado (08:20) recebe fim',
    cards: [card('790', t('08:00'), { ini: t('08:20') })], norm: [{ cod: '790', ini: t('08:20'), fim: t('09:00') }],
    esperado: [['790', t('08:20'), 'F', 'NORMALIZAR']] },
  { id: 'C03a', nome: 'Reincidência: 08:00 fim 08:15; 08:20 aberta',
    cards: [card('790', t('08:00'))], pend: [{ cod: '790', ini: t('08:20') }], norm: [{ cod: '790', ini: t('08:00'), fim: t('08:15') }],
    esperado: [['790', t('08:00'), 'F', 'NORMALIZAR'], ['790', t('08:20'), 'A', 'CRIAR_PENDENTE_REINC']] },
  { id: 'C03a-S', nome: 'Sobreposição: 08:00 fim 08:40; 08:20 aberta',
    cards: [card('790', t('08:00'))], pend: [{ cod: '790', ini: t('08:20') }], norm: [{ cod: '790', ini: t('08:00'), fim: t('08:40') }],
    esperado: [['790', t('08:00'), 'F', 'IGNORAR_FIM', 'AMBIGUO'], ['790', t('08:20'), 'A', 'GUARDAR_NO_CARD', 'AMBIGUO']] },
  { id: 'C03b', nome: 'Retificado p/ 08:20; 08:00 volta com fim 08:15',
    cards: [card('790', t('08:00'), { ini: t('08:20') })], pend: [{ cod: '790', ini: t('08:20') }], norm: [{ cod: '790', ini: t('08:00'), fim: t('08:15') }],
    esperado: [['790', t('08:00'), 'F', 'NORMALIZAR'], ['790', t('08:20'), 'A', 'CRIAR_PENDENTE_REINC']] },
  { id: 'C03b-S', nome: 'Retificado p/ 08:20; 08:00 volta com fim 08:40',
    cards: [card('790', t('08:00'), { ini: t('08:20') })], pend: [{ cod: '790', ini: t('08:20') }], norm: [{ cod: '790', ini: t('08:00'), fim: t('08:40') }],
    esperado: [['790', t('08:00'), 'F', 'IGNORAR_FIM', 'AMBIGUO'], ['790', t('08:20'), 'A', 'MANTER']] },
  { id: 'C04', nome: 'Duas abertas, painel vazio',
    cards: [], pend: [{ cod: '790', ini: t('08:00') }, { cod: '790', ini: t('08:20') }],
    esperado: [['790', t('08:00'), 'A', 'CRIAR_PENDENTE'], ['790', t('08:20'), 'A', 'GUARDAR_NO_CARD', 'ALERTA']] },
  { id: 'C04r', nome: 'Duas abertas, card 08:00 existe',
    cards: [card('790', t('08:00'))], pend: [{ cod: '790', ini: t('08:00') }, { cod: '790', ini: t('08:20') }],
    esperado: [['790', t('08:00'), 'A', 'MANTER'], ['790', t('08:20'), 'A', 'GUARDAR_NO_CARD', 'ALERTA']] },
  { id: 'C04n', nome: 'Duas abertas de semáforo novo (painel com outros)',
    cards: [card('100', t('07:00'))], pend: [{ cod: '100', ini: t('07:00') }, { cod: '791', ini: t('08:00') }, { cod: '791', ini: t('08:20') }],
    esperado: [['100', t('07:00'), 'A', 'MANTER'], ['791', t('08:00'), 'A', 'CRIAR_PENDENTE'], ['791', t('08:20'), 'A', 'GUARDAR_NO_CARD', 'ALERTA']] },
  { id: 'C05', nome: 'Idempotência: estado já corrigido + mesmo relatório',
    cards: [card('790', t('08:00'), { ini: t('08:20') }), card('100', t('07:00')), card('102', t('06:00'), { norm: true, fim: t('06:30') })],
    pend: [{ cod: '790', ini: t('08:20') }, { cod: '100', ini: t('07:00') }], norm: [{ cod: '102', ini: t('06:00'), fim: t('06:30') }],
    esperado: [['790', t('08:20'), 'A', 'MANTER'], ['100', t('07:00'), 'A', 'MANTER'], ['102', t('06:00'), 'F', 'MANTER']] },
  { id: 'C06', nome: 'Cumulativo: normalizado repetido + reincidência',
    cards: [card('790', t('06:00'), { norm: true, fim: t('06:30') }), card('791', t('07:00'))],
    pend: [{ cod: '791', ini: t('07:00') }, { cod: '790', ini: t('08:20') }], norm: [{ cod: '790', ini: t('06:00'), fim: t('06:30') }],
    esperado: [['791', t('07:00'), 'A', 'MANTER'], ['790', t('06:00'), 'F', 'MANTER'], ['790', t('08:20'), 'A', 'CRIAR_PENDENTE_REINC']] },
  { id: 'C06b', nome: 'Cumulativo depois da reincidência criada',
    cards: [card('790', t('06:00'), { norm: true, fim: t('06:30') }), card('790', t('08:20')), card('791', t('07:00'))],
    pend: [{ cod: '791', ini: t('07:00') }, { cod: '790', ini: t('08:20') }], norm: [{ cod: '790', ini: t('06:00'), fim: t('06:30') }],
    esperado: [['791', t('07:00'), 'A', 'MANTER'], ['790', t('06:00'), 'F', 'MANTER'], ['790', t('08:20'), 'A', 'MANTER']] },
  { id: 'C07', nome: 'Linha some sem fim',
    cards: [card('790', t('08:00')), card('791', t('08:10'))], pend: [{ cod: '791', ini: t('08:10') }],
    esperado: [['791', t('08:10'), 'A', 'MANTER'], ['790', 'card', '-', 'MANTER', 'ALERTA']] },
  { id: 'C08', nome: 'Normalizado volta sem fim',
    cards: [card('555', t('06:00'), { norm: true, fim: t('06:40') })], pend: [{ cod: '555', ini: t('06:00') }],
    esperado: [['555', t('06:00'), 'A', 'MANTER', 'ALERTA']] },
  { id: 'C09', nome: 'Sem início, card sem início existe',
    cards: [{ id: '584_1791984600495', codigo: '584', inicio: '', aliases: [], normalizado: false, fim: '', dataReferencia: D }],
    pend: [{ cod: '584' }],
    esperado: [['584', '', 'A', 'MANTER']] },
  { id: 'C09b', nome: 'Sem início → início chega',
    cards: [{ id: '685_1791984600495', codigo: '685', inicio: '', aliases: [], normalizado: false, fim: '', dataReferencia: D }],
    pend: [{ cod: '685', ini: t('07:37') }],
    esperado: [['685', t('07:37'), 'A', 'RETIFICAR']] },
  { id: 'C11-2', nome: 'Correção 2: 08:00 → 08:20', cards: [card('790', t('08:00'))], pend: [{ cod: '790', ini: t('08:20') }], esperado: [['790', t('08:20'), 'A', 'RETIFICAR']] },
  { id: 'C11-3', nome: 'Correção 3: 08:20 → 08:35', cards: [card('790', t('08:00'), { ini: t('08:20') })], pend: [{ cod: '790', ini: t('08:35') }], esperado: [['790', t('08:35'), 'A', 'RETIFICAR']] },
  { id: 'C11-4', nome: 'Correção 4: 08:35 → volta a 08:00', cards: [card('790', t('08:00'), { ini: t('08:35'), aliases: [t('08:20')] })], pend: [{ cod: '790', ini: t('08:00') }], esperado: [['790', t('08:00'), 'A', 'RETIFICAR']] },
  { id: 'C11-5', nome: 'Depois da volta: 08:00 repetido', cards: [card('790', t('08:00'), { ini: t('08:00'), aliases: [t('08:20'), t('08:35')] })], pend: [{ cod: '790', ini: t('08:00') }], esperado: [['790', t('08:00'), 'A', 'MANTER']] },
  { id: 'C12', nome: 'Virada: fim 15/10 00:10 > novo início 14/10 23:50', data: '15/10/2026',
    cards: [card('790', '14/10/2026 23:00', { dref: '15/10/2026' })], pend: [{ cod: '790', ini: '14/10/2026 23:50' }], norm: [{ cod: '790', ini: '14/10/2026 23:00', fim: '15/10/2026 00:10' }],
    esperado: [['790', '14/10/2026 23:00', 'F', 'IGNORAR_FIM', 'AMBIGUO'], ['790', '14/10/2026 23:50', 'A', 'GUARDAR_NO_CARD', 'AMBIGUO']] },
  { id: 'C12b', nome: 'Virada: fim 15/10 00:10 ≤ novo início 15/10 00:20', data: '15/10/2026',
    cards: [card('790', '14/10/2026 23:00', { dref: '15/10/2026' })], pend: [{ cod: '790', ini: '15/10/2026 00:20' }], norm: [{ cod: '790', ini: '14/10/2026 23:00', fim: '15/10/2026 00:10' }],
    esperado: [['790', '14/10/2026 23:00', 'F', 'NORMALIZAR'], ['790', '15/10/2026 00:20', 'A', 'CRIAR_PENDENTE_REINC']] },
  { id: 'C12c', nome: 'Anterior de ONTEM normalizado; nova hoje (outra data)', data: '15/10/2026',
    cards: [card('790', '14/10/2026 10:00', { norm: true, fim: '14/10/2026 11:00', dref: '14/10/2026' })], pend: [{ cod: '790', ini: '15/10/2026 06:00' }],
    esperado: [['790', '15/10/2026 06:00', 'A', 'CRIAR_PENDENTE']] },
  { id: 'C13', nome: 'Fim sem data + novo início aberto',
    cards: [card('790', t('08:00'))], pend: [{ cod: '790', ini: t('08:20') }], norm: [{ cod: '790', ini: t('08:00'), fim: '08:15' }],
    esperado: [['790', t('08:00'), 'F', 'IGNORAR_FIM', 'AMBIGUO'], ['790', t('08:20'), 'A', 'GUARDAR_NO_CARD', 'AMBIGUO']] },
  { id: 'C15', nome: 'Pendente de ontem continua (herança)', data: '15/10/2026',
    cards: [card('790', '14/10/2026 22:00', { dref: '14/10/2026' })], pend: [{ cod: '790', ini: '14/10/2026 22:00' }],
    esperado: [['790', '14/10/2026 22:00', 'A', 'MANTER']] },
  { id: 'C16', nome: 'Card some; único horário aparece já encerrado (CONTRATO §13)',
    cards: [card('790', t('08:00'))], norm: [{ cod: '790', ini: t('10:00'), fim: t('10:30') }],
    esperado: [['790', t('10:00'), 'F', 'RETIFICAR_E_NORMALIZAR', 'REGISTRO']] },
  { id: 'C16-468', nome: 'Caso real 468/790: 08:20 → 06:10 + fim 08:17',
    cards: [card('790', t('08:20'))], norm: [{ cod: '790', ini: t('06:10'), fim: t('08:17') }],
    esperado: [['790', t('06:10'), 'F', 'RETIFICAR_E_NORMALIZAR', 'REGISTRO']] },
  { id: 'C16b', nome: 'Card some; DUAS linhas encerradas aparecem (ambíguo)',
    cards: [card('790', t('08:00'))], norm: [{ cod: '790', ini: t('06:10'), fim: t('06:40') }, { cod: '790', ini: t('09:00'), fim: t('09:30') }],
    esperado: [['790', t('06:10'), 'F', 'CRIAR_NORMALIZADO', 'AMBIGUO'], ['790', t('09:00'), 'F', 'CRIAR_NORMALIZADO', 'AMBIGUO']] },
  { id: 'C16c', nome: 'Card some; uma encerrada + uma aberta (não normaliza o card)',
    cards: [card('790', t('08:00'))], pend: [{ cod: '790', ini: t('09:00') }], norm: [{ cod: '790', ini: t('06:10'), fim: t('06:40') }],
    esperado: [['790', t('09:00'), 'A', 'RETIFICAR']] },
  { id: 'C17', nome: 'Legado: 2 pendentes do mesmo semáforo já no banco',
    cards: [card('790', t('08:00')), card('790', t('08:20'))], pend: [{ cod: '790', ini: t('08:00') }, { cod: '790', ini: t('08:20') }],
    esperado: [['790', t('08:00'), 'A', 'MANTER'], ['790', t('08:20'), 'A', 'MANTER'], ['790', 'card', '-', 'MANTER', 'AMBIGUO']] },
  { id: 'C18', nome: 'Duas abertas guardadas: próximo relatório igual',
    cards: [card('790', t('08:00'), { aliases: [t('08:20')] })], pend: [{ cod: '790', ini: t('08:00') }, { cod: '790', ini: t('08:20') }],
    esperado: [['790', t('08:00'), 'A', 'MANTER'], ['790', t('08:20'), 'A', 'GUARDAR_NO_CARD', 'ALERTA']] },
  { id: 'C19', nome: 'Retificado p/ 08:20; fonte volta a 08:00 já com fim (08:20 some)',
    cards: [card('790', t('08:00'), { ini: t('08:20') })], norm: [{ cod: '790', ini: t('08:00'), fim: t('09:00') }],
    esperado: [['790', t('08:00'), 'F', 'RETIFICAR_E_NORMALIZAR']] },
];

// Projeção do resultado → invariantes
function invariantes(linhas, rows, cards) {
  const f = [];
  const pendPorCod = {};
  for (const c of cards) if (!c.normalizado) pendPorCod[c.codigo] = (pendPorCod[c.codigo] || 0) + 1;
  for (const r of rows) {
    if (['NORMALIZAR', 'RETIFICAR_E_NORMALIZAR'].includes(r.decisao)) pendPorCod[r.codigo]--;
    if (r.decisao.startsWith('CRIAR_PENDENTE')) pendPorCod[r.codigo] = (pendPorCod[r.codigo] || 0) + 1;
  }
  const legado = new Set(rows.filter(r => /legado/.test(r.justificativa)).map(r => r.codigo));
  for (const [c, n] of Object.entries(pendPorCod)) if (n > 1 && !legado.has(c)) f.push(`I1 ${c}: ${n} pendentes`);
  // Exceção documentada: normalizado que volta sem fim fica normalizado até decisão humana (BR-NOR-007), com ALERTA.
  const excecao = new Set(rows.filter(r => r.motivo === 'ATIVIDADE_INCOMUM').map(r => r.codigo));
  for (const l of linhas) if (!l.fim && !(pendPorCod[l.cod] > 0) && !excecao.has(l.cod)) f.push(`I2 ${l.cod}: linha aberta sem pendente`);
  if (rows.filter(r => r.idx != null).length !== linhas.length) f.push(`toda linha classificada: ${rows.filter(r => r.idx != null).length}/${linhas.length}`);
  return f;
}

const chave = r => `${r.codigo}|${r.idx == null ? 'card' : r.linha}|${r.decisao}|${r.gravidade}`;

(async () => {
  const nit = await h.subirNIT({ estado: {}, relogioIso: '2026-10-14T10:30:00' });
  const C = nit.w.NitClassificador;
  const out = []; let ok = 0, falhou = 0;
  const md = ['| Cenário | Linha recebida | Ocorrência | Card | Decisão | Gravidade | Justificativa |', '|---|---|---|---|---|---|---|'];

  for (const s of CENARIOS) {
    const d = s.data || D;
    const evs = C.parsear(rel(d, s.pend, s.norm));
    const rows = C.classificar(evs, s.cards);
    const rowsInv = C.classificar(C.parsear(relInvertido(d, s.pend, s.norm)), s.cards);
    const falhas = [];
    for (const [cod, ini, st, dec, grav] of s.esperado) {
      const r = rows.find(r => r.codigo === cod && (ini === 'card' ? r.idx == null : (r.linha.startsWith(ini || '(sem início)') && r.linha.endsWith(st === 'F' ? 'ENCERRADA' : 'ABERTA'))));
      if (!r) { falhas.push(`sem decisão para ${cod} ${ini} ${st}`); continue; }
      if (r.decisao !== dec) falhas.push(`${cod} ${ini || '(sem início)'}: esperado ${dec}, obtido ${r.decisao}`);
      if (grav && r.gravidade !== grav) falhas.push(`${cod} ${ini}: gravidade esperada ${grav}, obtida ${r.gravidade}`);
    }
    const a = rows.map(chave).sort().join(';'), b = rowsInv.map(chave).sort().join(';');
    if (a !== b) falhas.push('ordem do relatório alterou a decisão');
    falhas.push(...invariantes([...(s.pend || []), ...(s.norm || [])], rows, s.cards));
    const status = falhas.length ? 'FALHOU' : 'PASSOU';
    status === 'PASSOU' ? ok++ : falhou++;
    console.log(`${status.padEnd(7)} ${s.id} ${s.nome}`);
    for (const r of rows) console.log(`   ${r.codigo} ${r.linha.padEnd(48)} → ${r.decisao}${r.gravidade !== 'NENHUMA' ? ' [' + r.gravidade + ']' : ''}  (${r.justificativa})`);
    for (const x of falhas) console.log(`   ✗ ${x}`);
    for (const r of rows) md.push(`| ${s.id} | ${r.codigo} · ${r.linha} | ${r.ocorrencia} | ${r.card} | ${r.decisao} | ${r.gravidade} | ${r.justificativa}${r.acaoSegura ? ' — ação segura: ' + r.acaoSegura : ''} |`);
    out.push({ id: s.id, status, falhas, rows });
  }

  // Relatório real 09/10: (a) painel vazio; (b) com o 323 de 08/10 21:00 ainda pendente
  const realPath = process.env.NIT_RELATORIO_REAL;
  if (realPath && fs.existsSync(realPath)) {
    const txt = fs.readFileSync(realPath, 'utf8');
    const evs = C.parsear(txt);
    for (const [nome, cards] of [['REAL-a painel vazio', []], ['REAL-b 323 (08/10 21:00) pendente', [card('323', '08/10/2026 21:00', { dref: '08/10/2026' })]]]) {
      const rows = C.classificar(evs, cards);
      const cont = rows.reduce((m, r) => (m[r.decisao] = (m[r.decisao] || 0) + 1, m), {});
      const pendFinal = rows.filter(r => r.decisao.startsWith('CRIAR_PENDENTE') || (r.decisao === 'MANTER' && r.linha.endsWith('ABERTA'))).map(r => r.codigo).sort();
      const amb = rows.filter(r => r.gravidade === 'AMBIGUO' || r.gravidade === 'ALERTA');
      const inv = invariantes(evs.map(e => ({ cod: e.codigo, fim: e.fim })), rows, cards);
      const okReal = evs.length === 31 && pendFinal.join() === ['1051', '323', '361', '986'].join() && !inv.length;
      okReal ? ok++ : falhou++;
      console.log(`${okReal ? 'PASSOU ' : 'FALHOU '} ${nome}: ${evs.length} linhas; decisões ${JSON.stringify(cont)}; pendentes ao final: ${pendFinal.join(', ')}; alertas/ambíguos: ${amb.length}`);
      for (const r of rows.filter(r => ['323', '094', '882'].includes(r.codigo))) console.log(`   ${r.codigo} ${r.linha.padEnd(48)} → ${r.decisao}${r.reincidente ? ' (reincidente)' : ''}  (${r.justificativa})`);
      for (const x of inv) console.log(`   ✗ ${x}`);
      for (const r of rows.filter(r => ['323', '094', '882'].includes(r.codigo))) md.push(`| ${nome} | ${r.codigo} · ${r.linha} | ${r.ocorrencia} | ${r.card} | ${r.decisao} | ${r.gravidade} | ${r.justificativa} |`);
    }
  }

  // Prova de que a função é somente leitura
  const antes = JSON.stringify(nit.fb.estado()), nEscritas = nit.fb.escritas.length;
  C.classificar(C.parsear(rel(D, [{ cod: '790', ini: t('08:20') }])), [card('790', t('08:00'))]);
  const leitura = JSON.stringify(nit.fb.estado()) === antes && nit.fb.escritas.length === nEscritas;
  console.log(`${leitura ? 'PASSOU ' : 'FALHOU '} somente leitura: nenhuma gravação no Firebase (${nit.fb.escritas.length - nEscritas} escritas)`);
  leitura ? ok++ : falhou++;

  console.log('\nRESUMO classificação', { PASSOU: ok, FALHOU: falhou });
  fs.writeFileSync(path.join(__dirname, 'classificacao-13-1-tabela.md'), md.join('\n') + '\n');
  fs.writeFileSync(path.join(__dirname, 'classificacao-13-1-resultado.json'), JSON.stringify(out, null, 2));
  process.exit(0);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
