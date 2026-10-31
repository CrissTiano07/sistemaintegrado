// Bateria 13.1 — regra "um semáforo, uma pendência" (aprovada em 14/10/2026).
// Roda o nit.js real (jsdom + Firebase em memória). NÃO acessa produção.
// Cada cenário verifica o comportamento ESPERADO pela regra aprovada; antes da
// mudança no motor, as falhas mostram exatamente o que precisa mudar.
//
// Invariantes verificadas em TODOS os cenários (prioridades de homologação):
//   I1  nenhum semáforo com mais de 1 card pendente
//   I2  todo semáforo com linha aberta no último relatório tem 1 card pendente (nenhuma pendência perdida)
//   I3  nenhum eventoId duplicado no painel
const fs = require('fs');
const path = require('path');
const h = require('./harness');

const T = '\t';
const cab = d => `*🚦PLANTÃO CEMOB*${T}${d}${T}\n*PLANTONISTA* ${T}TESTE${T}\n${T}${T}\n`;
const linhaOc = ({ tipo = 'INVESTIGANDO', cod, prob = 'APAGADO', ini, fim }) => {
  const i = ini ? `Início:${T}${ini}` : `Início:${T}`;
  const f = fim ? `${T}Fim:${T}${fim}` : `${T}${T}`;
  return `${tipo}${T}*🚦${T}${cod}${T}🚦${T}RUA ${cod} & AV TESTE${T}●${T}${prob}${T}●*${T}${i}${f}${T}"\n"${T}\n`;
};
const rel = (d, pend = [], norm = []) =>
  cab(d) + `*PENDENTES*❌${T}${T}\n\n` + pend.map(linhaOc).join('') +
  `${T}${T}\n*NORMALIZADOS*✅${T}${T}\n\n` + norm.map(linhaOc).join('');

const D = '14/10/2026';
const RELOGIO = '2026-10-14T10:30:00';
const t = hm => `${D} ${hm}`;

// ── inspeção ──────────────────────────────────────────────────────────────
const kanban = nit => nit.fb.estado().kanban || {};
const nos = (nit, cod) => Object.entries(kanban(nit)).filter(([, v]) => String(v.codigo) === String(cod));
const pendentes = (nit, cod) => nos(nit, cod).filter(([, v]) => v.coluna !== 'coluna-normalizados');
const normalizados = (nit, cod) => nos(nit, cod).filter(([, v]) => v.coluna === 'coluna-normalizados');
const alerta = nit => {
  const el = nit.w.document.getElementById('nit-integridade-processamento');
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
};
const toastsTxt = nit => h.toasts(nit).join(' | ');
// 13.2: horário corrigido é etiqueta no card (NIT-05); demais registros vão para cards de decisão/toasts
const retificado = (nit, cod) => [...nit.w.document.querySelectorAll(`#tab-semaforo .kanban-card[data-codigo="${cod}"] .card-retificado`)].length > 0;
const registrou = (nit, cod) => alerta(nit).includes(cod) || toastsTxt(nit).includes(cod) || retificado(nit, cod);
const descr = (nit, cod) => nos(nit, cod).map(([k, v]) =>
  `${k}[${v.coluna === 'coluna-normalizados' ? 'NORM' : 'PEND'} início=${v.inicio || '∅'}${v.hora_fim ? ' fim=' + v.hora_fim : ''}${v.reincidente ? ' ↺' : ''}]`).join(' ') || '(nenhum)';

// linhas abertas do último relatório → para I2
const abertasDe = texto => {
  const out = new Set(); let secao = '';
  for (const l of texto.split('\n')) {
    if (/\*PENDENTES\*/.test(l)) secao = 'P';
    if (/\*NORMALIZADOS\*/i.test(l)) secao = 'N';
    const m = l.match(/🚦\t(\S+)\t🚦/);
    if (m && secao === 'P' && !/Fim:/.test(l)) out.add(m[1]);
  }
  return out;
};

function invariantes(nit, ultimoRel) {
  const falhas = [];
  const porCod = {};
  for (const [, v] of Object.entries(kanban(nit)))
    if (v.coluna !== 'coluna-normalizados') porCod[v.codigo] = (porCod[v.codigo] || 0) + 1;
  for (const [c, n] of Object.entries(porCod)) if (n > 1) falhas.push(`I1: ${c} com ${n} pendentes`);
  for (const c of abertasDe(ultimoRel)) if (!porCod[c]) falhas.push(`I2: ${c} aberto no relatório e sem pendente no painel`);
  const dup = h.painel(nit).eventoIdsDuplicados; if (dup.length) falhas.push(`I3: duplicados ${dup}`);
  return falhas;
}

// ── execução ──────────────────────────────────────────────────────────────
async function subir(opts = {}) { return h.subirNIT({ estado: opts.estado || {}, relogioIso: opts.relogio || RELOGIO, fb: opts.fb }); }
async function proc(nit, texto) {
  await h.processar(nit, texto);
  if (h.modalAberto(nit)) await h.responderModal(nit, true);
}
const R = [];
const estadoEstavel = nit => JSON.stringify(Object.entries(kanban(nit)).sort().map(([k, v]) =>
  [k, v.coluna, v.inicio, v.hora_fim || '', v.dataReferencia, Object.keys(v.aliases || {}).sort().join(',')]));
async function reg(id, nome, checks, nit, ultimoRel, regra) {
  const inv = nit && ultimoRel ? invariantes(nit, ultimoRel) : [];
  if (nit && ultimoRel) {
    if (/não foi aplicada/.test(alerta(nit))) inv.push('I5: conferência diz que o motor não aplicou uma linha');
    const antes = estadoEstavel(nit);
    await proc(nit, ultimoRel); await proc(nit, ultimoRel);
    if (estadoEstavel(nit) !== antes) inv.push('I4: reprocessar o mesmo relatório 2× mudou o estado');
    inv.push(...invariantes(nit, ultimoRel).map(x => x + ' (após reprocessar)'));
  }
  const falhas = checks.filter(c => !c.ok).map(c => c.d).concat(inv);
  const status = falhas.length ? 'FALHOU' : 'PASSOU';
  R.push({ id, nome, status, falhas, regra });
  console.log(`${status.padEnd(7)} ${id} ${nome}`);
  for (const c of checks) console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`);
  for (const i of inv) console.log(`   ✗ ${i}`);
  console.log(`   regra: ${regra}\n`);
}
const aliasesDe = no => Object.keys(no?.aliases || {});
const ck = (ok, d) => ({ ok: !!ok, d });

(async () => {
  let nit, r1, r2, r3, n;

  // C01 Retificação de início, sem fim
  nit = await subir();
  r1 = rel(D, [{ cod: '790', ini: t('08:00') }]);
  r2 = rel(D, [{ cod: '790', ini: t('08:20') }]);
  await proc(nit, r1); await proc(nit, r2);
  n = nos(nit, '790');
  await reg('C01', 'Retificação de início (08:00 → 08:20, sem fim)', [
    ck(n.length === 1, `1 card do 790 (obs: ${descr(nit, '790')})`),
    ck(pendentes(nit, '790').length === 1, 'continua pendente'),
    ck(n[0]?.[1].inicio === t('08:20'), `início atual = 08:20 (obs: ${n[0]?.[1].inicio})`),
    ck(n[0]?.[1].inicioAnterior === t('08:00') && n[0]?.[0] === '790_141020260800', `início anterior 08:00 guardado e chave original preservada (obs: ${n[0]?.[1].inicioAnterior}, ${n[0]?.[0]})`),
    ck(registrou(nit, '790'), 'alteração registrada (toast/conferência)'),
  ], nit, r2, 'início muda → mesmo card, registra; início atual passa a 08:20');
  nit.dom.window.close();

  // C02 Retificação + fim no horário atual
  nit = await subir();
  r3 = rel(D, [], [{ cod: '790', ini: t('08:20'), fim: t('09:00') }]);
  await proc(nit, r1); await proc(nit, r2); await proc(nit, r3);
  n = nos(nit, '790');
  await reg('C02', 'Retificação e depois fim no horário atual', [
    ck(n.length === 1, `1 card (obs: ${descr(nit, '790')})`),
    ck(normalizados(nit, '790').length === 1, 'normalizado'),
    ck(n[0]?.[1].hora_fim === '09:00', 'fim 09:00 gravado'),
  ], nit, r3, 'fim explícito do início atual encerra');
  nit.dom.window.close();

  // C03a Reincidência sem sobreposição (horário atual recebe fim antes do novo início)
  nit = await subir();
  r2 = rel(D, [{ cod: '790', ini: t('08:20') }], [{ cod: '790', ini: t('08:00'), fim: t('08:15') }]);
  await proc(nit, r1); await proc(nit, r2);
  await reg('C03a', 'Reincidência: 08:00 fim 08:15, novo 08:20 aberto', [
    ck(nos(nit, '790').length === 2, `2 cards (obs: ${descr(nit, '790')})`),
    ck(normalizados(nit, '790').some(([, v]) => v.inicio === t('08:00') && v.hora_fim === '08:15'), '08:00 normalizado com fim 08:15'),
    ck(pendentes(nit, '790').some(([, v]) => v.inicio === t('08:20') && v.reincidente), '08:20 pendente ↺ REINC'),
  ], nit, r2, 'fim ≤ novo início → reincidência automática');
  nit.dom.window.close();

  // C03a-S Sobreposição (fim 08:40 > novo início 08:20)
  nit = await subir();
  r2 = rel(D, [{ cod: '790', ini: t('08:20') }], [{ cod: '790', ini: t('08:00'), fim: t('08:40') }]);
  await proc(nit, r1); await proc(nit, r2);
  await reg('C03a-S', 'Sobreposição: 08:00 fim 08:40, novo 08:20 aberto', [
    ck(nos(nit, '790').length === 1, `não cria reincidência: 1 card (obs: ${descr(nit, '790')})`),
    ck(pendentes(nit, '790').length === 1, 'pendência preservada'),
    ck(registrou(nit, '790'), 'inconsistência registrada'),
  ], nit, r2, 'sobreposição → não cria reincidência; preserva pendência; registra');
  nit.dom.window.close();

  // C03b Horário antigo (já retificado) volta com fim, sem sobreposição
  nit = await subir();
  r2 = rel(D, [{ cod: '790', ini: t('08:20') }]);
  r3 = rel(D, [{ cod: '790', ini: t('08:20') }], [{ cod: '790', ini: t('08:00'), fim: t('08:15') }]);
  await proc(nit, r1); await proc(nit, r2); await proc(nit, r3);
  await reg('C03b', 'Retificado p/ 08:20; 08:00 volta com fim 08:15', [
    ck(nos(nit, '790').length === 2, `2 cards (obs: ${descr(nit, '790')})`),
    ck(normalizados(nit, '790').some(([, v]) => v.hora_fim === '08:15'), 'card original normalizado com fim 08:15'),
    ck(pendentes(nit, '790').some(([, v]) => v.inicio === t('08:20') && v.reincidente), '08:20 pendente ↺ REINC'),
    ck(registrou(nit, '790'), 'registrado'),
  ], nit, r3, 'sem sobreposição → segue o relatório; registra');
  nit.dom.window.close();

  // C03b-S Horário antigo volta com fim e sobreposição
  nit = await subir();
  r3 = rel(D, [{ cod: '790', ini: t('08:20') }], [{ cod: '790', ini: t('08:00'), fim: t('08:40') }]);
  await proc(nit, r1); await proc(nit, r2); await proc(nit, r3);
  n = pendentes(nit, '790');
  await reg('C03b-S', 'Retificado p/ 08:20; 08:00 volta com fim 08:40', [
    ck(nos(nit, '790').length === 1, `1 card (obs: ${descr(nit, '790')})`),
    ck(n.length === 1 && n[0][1].inicio === t('08:20'), 'continua pendente com início 08:20'),
    ck(registrou(nit, '790'), 'inconsistência registrada'),
  ], nit, r3, 'horário antigo não encerra; sobreposição → preserva e registra');
  nit.dom.window.close();

  // C04 Duas linhas abertas no PRIMEIRO processamento (painel vazio)
  nit = await subir();
  r1 = rel(D, [{ cod: '790', ini: t('08:00') }, { cod: '790', ini: t('08:20') }]);
  await proc(nit, r1);
  n = pendentes(nit, '790');
  await reg('C04', 'Duas linhas abertas — painel vazio', [
    ck(n.length === 1, `1 pendente (obs: ${descr(nit, '790')})`),
    ck(n.length === 1 && n[0][1].inicio === t('08:00') && aliasesDe(n[0][1]).includes('790_141020260820'), `card 08:00 com a linha 08:20 guardada (obs: ${aliasesDe(n[0]?.[1])})`),
    ck(registrou(nit, '790'), 'inconsistência alertada'),
  ], nit, r1, 'duas abertas = inconsistência da fonte: 1 card, guarda a 2ª, alerta');
  nit.dom.window.close();

  // C04r Duas linhas abertas no REPROCESSAMENTO (card 08:00 já existe)
  nit = await subir();
  r1 = rel(D, [{ cod: '790', ini: t('08:00') }]);
  r2 = rel(D, [{ cod: '790', ini: t('08:00') }, { cod: '790', ini: t('08:20') }]);
  await proc(nit, r1); await proc(nit, r2);
  n = pendentes(nit, '790');
  await reg('C04r', 'Duas linhas abertas — reprocessamento', [
    ck(n.length === 1, `1 pendente (obs: ${descr(nit, '790')})`),
    ck(n.length === 1 && aliasesDe(n[0][1]).includes('790_141020260820'), `linha 08:20 guardada no card (obs: ${aliasesDe(n[0]?.[1])})`),
    ck(registrou(nit, '790'), 'inconsistência alertada'),
  ], nit, r2, 'idem C04, com card existente');
  nit.dom.window.close();

  // C04n Duas abertas de semáforo novo num painel que já tem outros cards
  nit = await subir();
  r1 = rel(D, [{ cod: '100', ini: t('07:00') }]);
  r2 = rel(D, [{ cod: '100', ini: t('07:00') }, { cod: '791', ini: t('08:00') }, { cod: '791', ini: t('08:20') }]);
  await proc(nit, r1); await proc(nit, r2);
  await reg('C04n', 'Duas abertas de semáforo novo (reprocessamento)', [
    ck(pendentes(nit, '791').length === 1, `1 pendente (obs: ${descr(nit, '791')})`),
    ck(registrou(nit, '791'), 'inconsistência alertada'),
  ], nit, r2, 'idem C04');
  nit.dom.window.close();

  // C05 Idempotência com retificação
  nit = await subir();
  r1 = rel(D, [{ cod: '790', ini: t('08:00') }]);
  r2 = rel(D, [{ cod: '790', ini: t('08:20') }, { cod: '100', ini: t('07:00') }], [{ cod: '102', ini: t('06:00'), fim: t('06:30') }]);
  await proc(nit, r1); await proc(nit, r2);
  const snap = JSON.stringify(Object.fromEntries(Object.entries(kanban(nit)).map(([k, v]) => [k, { c: v.coluna, i: v.inicio, f: v.hora_fim }])));
  await proc(nit, r2); await proc(nit, r2);
  const snap2 = JSON.stringify(Object.fromEntries(Object.entries(kanban(nit)).map(([k, v]) => [k, { c: v.coluna, i: v.inicio, f: v.hora_fim }])));
  await reg('C05', 'Reprocessar o mesmo relatório 3×', [
    ck(snap === snap2, 'estado idêntico após repetir'),
    ck(Object.keys(kanban(nit)).length === 3, `3 cards (obs: ${Object.keys(kanban(nit)).length})`),
  ], nit, r2, 'processar de novo não muda nada');
  nit.dom.window.close();

  // C06 Relatório cumulativo repete normalizados + reincidência
  nit = await subir();
  r1 = rel(D, [{ cod: '791', ini: t('07:00') }], [{ cod: '790', ini: t('06:00'), fim: t('06:30') }]);
  r2 = rel(D, [{ cod: '791', ini: t('07:00') }, { cod: '790', ini: t('08:20') }], [{ cod: '790', ini: t('06:00'), fim: t('06:30') }]);
  await proc(nit, r1); await proc(nit, r2); await proc(nit, r2);
  await reg('C06', 'Cumulativo: normalizado repetido + reincidência', [
    ck(nos(nit, '790').length === 2, `2 cards do 790, sem duplicar (obs: ${descr(nit, '790')})`),
    ck(normalizados(nit, '790').length === 1 && pendentes(nit, '790').length === 1, '1 normalizado + 1 pendente'),
  ], nit, r2, 'normalizado repetido reconhece o mesmo card');
  nit.dom.window.close();

  // C07 Linha some sem fim
  nit = await subir();
  r1 = rel(D, [{ cod: '790', ini: t('08:00') }, { cod: '791', ini: t('08:10') }]);
  r2 = rel(D, [{ cod: '791', ini: t('08:10') }]);
  await proc(nit, r1); await proc(nit, r2);
  await reg('C07', 'Linha some do relatório sem fim', [
    ck(pendentes(nit, '790').length === 1, 'continua pendente (ausência ≠ encerramento)'),
    ck(alerta(nit).includes('790'), 'conferência avisa'),
  ], nit, r2, 'linha ausente não normaliza');
  nit.dom.window.close();

  // C08 Normalizado perde o fim
  nit = await subir();
  r1 = rel(D, [], [{ cod: '555', ini: t('06:00'), fim: t('06:40') }]);
  r2 = rel(D, [{ cod: '555', ini: t('06:00') }]);
  await proc(nit, r1); await proc(nit, r2);
  await reg('C08', 'Normalizado volta sem fim', [
    ck(normalizados(nit, '555').length === 1 && nos(nit, '555').length === 1, `nada muda: continua normalizado (obs: ${descr(nit, '555')})`),
    ck(alerta(nit).includes('555'), 'alerta persistente na conferência'),
  ], null, null, 'BR-NOR-007: só com decisão humana (botão na 13.2)');
  nit.dom.window.close();

  // C09 Sem início, reprocessado
  nit = await subir();
  r1 = rel(D, [{ cod: '584' }, { cod: '601', ini: t('06:00') }]);
  await proc(nit, r1); const ids1 = nos(nit, '584').map(x => x[0]);
  await h.dormir(30); await proc(nit, r1);
  const ids2 = nos(nit, '584').map(x => x[0]);
  await reg('C09', 'Sem início, reprocessado', [
    ck(ids2.length === 1 && ids1[0] === ids2[0], `mesma identidade (obs: ${ids1} → ${ids2})`),
  ], nit, r1, 'identidade fixa sem Date.now()');
  nit.dom.window.close();

  // C09b Sem início, depois o início chega
  nit = await subir();
  r1 = rel(D, [{ cod: '685' }]);
  r2 = rel(D, [{ cod: '685', ini: t('07:37') }]);
  await proc(nit, r1); await proc(nit, r2);
  n = nos(nit, '685');
  await reg('C09b', 'Sem início → início informado', [
    ck(n.length === 1, `1 card (obs: ${descr(nit, '685')})`),
    ck(n[0]?.[1].inicio === t('07:37'), `início atualizado para 07:37 (obs: ${n[0]?.[1].inicio || '∅'})`),
  ], nit, r2, 'enriquecimento = retificação do mesmo card');
  nit.dom.window.close();

  // C11 Três correções e volta ao original
  nit = await subir();
  const seq = ['08:00', '08:20', '08:35', '08:00'];
  const obs = [];
  for (const hm of seq) {
    r1 = rel(D, [{ cod: '790', ini: t(hm) }]); await proc(nit, r1);
    const p = pendentes(nit, '790');
    obs.push(`${hm}→${nos(nit, '790').length}c/${p[0]?.[1].inicio?.slice(-5) || '∅'}`);
  }
  await reg('C11', 'Correções 08:00→08:20→08:35→08:00', [
    ck(nos(nit, '790').length === 1, `sempre 1 card (obs: ${obs.join(' ')})`),
    ck(obs.every((o, i) => o.endsWith('/' + seq[i])), 'início atual acompanha cada correção'),
  ], nit, r1, 'aliases acumulam; sempre o mesmo card');
  nit.dom.window.close();

  // C12 Fim no dia seguinte — sobreposição que só aparece com a DATA (hora sozinha engana)
  nit = await subir({ relogio: '2026-10-15T01:00:00' });
  const D2 = '15/10/2026';
  r1 = rel(D2, [{ cod: '790', ini: '14/10/2026 23:00' }]);
  r2 = rel(D2, [{ cod: '790', ini: '14/10/2026 23:50' }], [{ cod: '790', ini: '14/10/2026 23:00', fim: '15/10/2026 00:10' }]);
  await proc(nit, r1); await proc(nit, r2);
  await reg('C12', 'Fim 15/10 00:10 > novo início 14/10 23:50 (virada)', [
    ck(nos(nit, '790').length === 1, `sobreposição detectada pela data: sem reincidência (obs: ${descr(nit, '790')})`),
    ck(pendentes(nit, '790').length === 1, 'pendência preservada'),
  ], nit, r2, 'comparação usa data+hora completas');
  nit.dom.window.close();

  // C12b Virada sem sobreposição → reincidência
  nit = await subir({ relogio: '2026-10-15T01:00:00' });
  r2 = rel(D2, [{ cod: '790', ini: '15/10/2026 00:20' }], [{ cod: '790', ini: '14/10/2026 23:00', fim: '15/10/2026 00:10' }]);
  await proc(nit, r1); await proc(nit, r2);
  await reg('C12b', 'Fim 15/10 00:10 ≤ novo início 15/10 00:20', [
    ck(nos(nit, '790').length === 2, `reincidência (obs: ${descr(nit, '790')})`),
  ], nit, r2, 'sequência válida atravessando a meia-noite');
  nit.dom.window.close();

  // C13 Fim sem data (dados insuficientes)
  nit = await subir();
  r1 = rel(D, [{ cod: '790', ini: t('08:00') }]);
  r2 = rel(D, [{ cod: '790', ini: t('08:20') }], [{ cod: '790', ini: t('08:00'), fim: '08:15' }]);
  await proc(nit, r1); await proc(nit, r2);
  await reg('C13', 'Fim sem data + novo início aberto', [
    ck(nos(nit, '790').length === 1, `dados insuficientes: sem reincidência (obs: ${descr(nit, '790')})`),
    ck(pendentes(nit, '790').length === 1, 'pendência preservada'),
    ck(registrou(nit, '790'), 'registrado'),
  ], nit, r2, 'dados insuficientes → não presume reincidência');
  nit.dom.window.close();

  // C10 Dois operadores: A processa, B retifica, A reprocessa
  {
    const rel0 = h.criarRelogio(RELOGIO);
    const fb = h.criarFirebaseFalso({}, rel0);
    const A = await subir({ fb }), B = await subir({ fb });
    r1 = rel(D, [{ cod: '790', ini: t('08:00') }]);
    r2 = rel(D, [{ cod: '790', ini: t('08:20') }]);
    await proc(A, r1); await h.dormir(150);
    await proc(B, r2); await h.dormir(150);
    await proc(A, r2); await h.dormir(150);
    const domA = [...A.w.document.querySelectorAll('#tab-semaforo .kanban-card[data-codigo="790"]')].map(c => c.dataset.inicio);
    const domB = [...B.w.document.querySelectorAll('#tab-semaforo .kanban-card[data-codigo="790"]')].map(c => c.dataset.inicio);
    await reg('C10', 'Dois operadores: A cria 08:00, B retifica 08:20, A reprocessa', [
      ck(nos(A, '790').length === 1, `1 card no banco (obs: ${descr(A, '790')})`),
      ck(domA.length === 1 && domB.length === 1, `1 card na tela de cada um (A=${domA.length}, B=${domB.length})`),
      ck(domA[0] === t('08:20') && domB[0] === t('08:20'), `os dois veem início 08:20 (A=${domA}, B=${domB})`),
    ], A, r2, 'sincronização: campos novos chegam ao outro operador');
    A.dom.window.close(); B.dom.window.close();
  }

  // C10b Dois operadores processam o mesmo relatório quase ao mesmo tempo
  {
    const rel0 = h.criarRelogio(RELOGIO);
    const fb = h.criarFirebaseFalso({}, rel0);
    const A = await subir({ fb }), B = await subir({ fb });
    r1 = rel(D, [{ cod: '790', ini: t('08:00') }, { cod: '791', ini: t('08:05') }], [{ cod: '792', ini: t('06:00'), fim: t('06:30') }]);
    await Promise.all([proc(A, r1), proc(B, r1)]); await h.dormir(200);
    await reg('C10b', 'Dois operadores, mesmo relatório simultâneo', [
      ck(Object.keys(kanban(A)).length === 3, `3 cards no banco (obs: ${Object.keys(kanban(A)).join(', ')})`),
      ck(A.w.document.querySelectorAll('#tab-semaforo .kanban-card').length === 3 && B.w.document.querySelectorAll('#tab-semaforo .kanban-card').length === 3, 'cada tela com 3 cards'),
    ], A, r1, 'chaves determinísticas: gravação simultânea não duplica');
    A.dom.window.close(); B.dom.window.close();
  }


  // ── Casos adicionais ─────────────────────────────────────────────────────
  // C16 Card some; único horário aparece já encerrado → correção + fim no MESMO card (CONTRATO §13)
  nit = await subir();
  r1 = rel(D, [{ cod: '790', ini: t('08:00') }]);
  r2 = rel(D, [], [{ cod: '790', ini: t('10:00'), fim: t('10:30') }]);
  await proc(nit, r1);
  await nit.fb.firebase.database().ref('kanban/790_141020260800').update({ equipe: 'EQ-7', viatura: 'VT-12', tsDespacho: 1 });
  await proc(nit, r2);
  n = nos(nit, '790');
  await reg('C16', 'Card 08:00 some; aparece só 10:00–10:30 encerrado', [
    ck(n.length === 1 && n[0][0] === '790_141020260800', `mesmo card, sem segundo card (obs: ${descr(nit, '790')})`),
    ck(normalizados(nit, '790').length === 1 && n[0][1].inicio === t('10:00') && n[0][1].hora_fim === '10:30', 'normalizado com início corrigido e fim'),
    ck(n[0][1].equipe === 'EQ-7' && n[0][1].viatura === 'VT-12' && n[0][1].inicioAnterior === t('08:00'), 'equipe, viatura e início anterior preservados'),
    ck(retificado(nit, '790'), 'retificação registrada (etiqueta ⟲ no card)'),
  ], nit, r2, 'CONTRATO §13: retificação com fim no mesmo card');
  nit.dom.window.close();

  // C21 Caso real 468/790: 08:20 ×3 → 06:10 + Fim 08:17, com equipe despachada no meio
  nit = await subir({ relogio: '2026-10-14T09:00:00' });
  r1 = rel(D, [{ cod: '790', ini: t('08:20') }]);
  r2 = rel(D, [], [{ cod: '790', ini: t('06:10'), fim: t('08:17') }]);
  await proc(nit, r1); await proc(nit, r1);
  await nit.fb.firebase.database().ref('kanban/790_141020260820').update({ equipe: 'EQ-3', historico: { h1: { acao: 'despacho' } } });
  await proc(nit, r1); await proc(nit, r2);
  n = nos(nit, '790');
  await reg('C21', 'Caso real 468/790 (08:20 ×3 → 06:10 + fim 08:17)', [
    ck(n.length === 1 && n[0][0] === '790_141020260820', `identidade preservada, 1 card (obs: ${descr(nit, '790')})`),
    ck(normalizados(nit, '790').length === 1 && n[0][1].inicio === t('06:10') && n[0][1].hora_fim === '08:17', 'normalizado 06:10–08:17'),
    ck(n[0][1].equipe === 'EQ-3' && n[0][1].historico?.h1?.acao === 'despacho', 'equipe e histórico preservados'),
    ck(n[0][1].inicioAnterior === t('08:20'), 'início anterior 08:20 registrado'),
    ck(retificado(nit, '790'), 'retificação registrada (etiqueta ⟲ no card)'),
  ], nit, r2, 'CONTRATO §13');
  nit.dom.window.close();

  // C21b Semelhante, mas DUAS linhas encerradas aparecem → ambíguo, não normaliza o card
  nit = await subir();
  r1 = rel(D, [{ cod: '790', ini: t('08:20') }]);
  r2 = rel(D, [], [{ cod: '790', ini: t('06:10'), fim: t('06:40') }, { cod: '790', ini: t('07:00'), fim: t('08:17') }]);
  await proc(nit, r1); await proc(nit, r2);
  await reg('C21b', 'Card some; duas linhas encerradas (ambíguo)', [
    ck(pendentes(nit, '790').length === 1 && pendentes(nit, '790')[0][1].inicio === t('08:20'), `pendência preservada, card não normalizado (obs: ${descr(nit, '790')})`),
    ck(alerta(nit).includes('790'), 'conferência sinaliza'),
  ], nit, r2, 'linhas contraditórias → não normaliza');
  nit.dom.window.close();

  // C21c Semelhante: uma encerrada + uma aberta → card segue pendente (corrigido para a aberta)
  nit = await subir();
  r1 = rel(D, [{ cod: '790', ini: t('08:20') }]);
  r2 = rel(D, [{ cod: '790', ini: t('09:00') }], [{ cod: '790', ini: t('06:10'), fim: t('06:40') }]);
  await proc(nit, r1); await proc(nit, r2);
  await reg('C21c', 'Card some; uma encerrada + uma aberta', [
    ck(pendentes(nit, '790').length === 1 && pendentes(nit, '790')[0][0] === '790_141020260820', `card original segue pendente (obs: ${descr(nit, '790')})`),
  ], nit, r2, 'não normaliza com linha aberta presente');
  nit.dom.window.close();

  // C21d Retificação com fim vinda de herança (card de ontem pendente)
  nit = await subir({ relogio: '2026-10-15T07:00:00' });
  r1 = rel('14/10/2026', [{ cod: '790', ini: t('22:00') }]);
  await proc(nit, r1);
  r2 = rel('15/10/2026', [], [{ cod: '790', ini: t('21:40'), fim: '15/10/2026 06:30' }]);
  await proc(nit, r2);
  n = nos(nit, '790');
  await reg('C21d', 'Pendente de ontem: fonte corrige início e encerra hoje', [
    ck(n.length === 1 && normalizados(nit, '790').length === 1 && n[0][1].inicio === t('21:40') && n[0][1].dataReferencia === '15/10/2026', `mesmo card, normalizado e no painel de hoje (obs: ${descr(nit, '790')})`),
  ], nit, r2, 'retificação + fim também na virada do dia');
  nit.dom.window.close();

  // C17 Legado: dois pendentes do mesmo semáforo já no banco
  {
    const base = { coluna: 'coluna-espera', codigo: '790', status: 'PENDENTE', dataReferencia: D, problema: 'APAGADO', endereco: 'RUA 790' };
    const estado = { kanban: {
      '790_141020260800': { ...base, eventoId: '790_141020260800', inicio: t('08:00'), equipe: 'EQ-1' },
      '790_141020260820': { ...base, eventoId: '790_141020260820', inicio: t('08:20'), reincidente: true },
    } };
    nit = await subir({ estado });
    r1 = rel(D, [{ cod: '790', ini: t('08:00') }, { cod: '790', ini: t('08:20') }]);
    await proc(nit, r1);
    const k = kanban(nit);
    await reg('C17', 'Legado: 2 pendentes do 790 já gravados', [
      ck(Object.keys(k).length === 2 && k['790_141020260800']?.equipe === 'EQ-1', 'os dois cards preservados, equipe intacta (nada apagado/mesclado)'),
      ck(/790 TEM 2 CARDS/.test(alerta(nit)), 'NIT-16 mostra o conflito (790 TEM 2 CARDS)'),
    ], null, null, 'C17: preservar legado; sinalizar; operador resolve (botão na 13.2)');
    nit.dom.window.close();
  }

  // C18 Card legado com ID de horário (Date.now) e sem início
  {
    const estado = { kanban: { '584_1791984600495': { coluna: 'coluna-espera', codigo: '584', status: 'PENDENTE', dataReferencia: D, inicio: '', problema: 'APAGADO', eventoId: '584_1791984600495' } } };
    nit = await subir({ estado });
    r1 = rel(D, [{ cod: '584' }]);
    await proc(nit, r1);
    await reg('C18', 'ID antigo (Date.now) sem início continua reconhecido', [
      ck(nos(nit, '584').length === 1 && nos(nit, '584')[0][0] === '584_1791984600495', `mesmo card antigo (obs: ${nos(nit, '584').map(x => x[0])})`),
    ], nit, r1, 'IDs antigos reconhecidos; nenhuma migração');
    nit.dom.window.close();
  }

  // C18b ID novo sem início é estável e determinístico
  nit = await subir();
  r1 = rel(D, [{ cod: '584' }]);
  await proc(nit, r1);
  await reg('C18b', 'ID novo sem início: fixo', [
    ck(nos(nit, '584').length === 1 && nos(nit, '584')[0][0] === '584_SI14102026', `chave determinística (obs: ${nos(nit, '584').map(x => x[0])})`),
  ], nit, r1, 'sem Date.now()');
  nit.dom.window.close();

  // C19 Retificado p/ 08:20; fonte volta a 08:00 já com fim (08:20 some)
  nit = await subir();
  r1 = rel(D, [{ cod: '790', ini: t('08:00') }]);
  r2 = rel(D, [{ cod: '790', ini: t('08:20') }]);
  r3 = rel(D, [], [{ cod: '790', ini: t('08:00'), fim: t('09:00') }]);
  await proc(nit, r1); await proc(nit, r2); await proc(nit, r3);
  n = nos(nit, '790');
  await reg('C19', 'Volta ao horário anterior já encerrado', [
    ck(n.length === 1 && normalizados(nit, '790').length === 1 && n[0][1].inicio === t('08:00') && n[0][1].hora_fim === '09:00', `1 card normalizado 08:00–09:00 (obs: ${descr(nit, '790')})`),
  ], nit, r3, 'horário anterior com fim e atual ausente = correção + fim');
  nit.dom.window.close();

  // C20 Duas abertas guardadas e depois a guardada vira reincidência (08:00 fim 08:10; 08:20 aberta)
  nit = await subir();
  r1 = rel(D, [{ cod: '790', ini: t('08:00') }, { cod: '790', ini: t('08:20') }]);
  r2 = rel(D, [{ cod: '790', ini: t('08:20') }], [{ cod: '790', ini: t('08:00'), fim: t('08:10') }]);
  await proc(nit, r1); await proc(nit, r2);
  await reg('C20', 'Linha guardada vira reincidência quando a anterior ganha fim', [
    ck(normalizados(nit, '790').length === 1 && pendentes(nit, '790').length === 1 && pendentes(nit, '790')[0][1].inicio === t('08:20'), `08:00 normalizado + 08:20 pendente (obs: ${descr(nit, '790')})`),
    ck(!aliasesDe(normalizados(nit, '790')[0]?.[1]).includes('790_141020260820'), 'horário 08:20 liberado do card antigo'),
  ], nit, r2, 'sequência válida → reincidência; sem horário duplicado entre cards');
  nit.dom.window.close();

  // C10c Dois operadores retificam ao mesmo tempo (referências não se perdem)
  {
    const rel0 = h.criarRelogio(RELOGIO);
    const fb = h.criarFirebaseFalso({}, rel0);
    const A = await subir({ fb }), B = await subir({ fb });
    r1 = rel(D, [{ cod: '790', ini: t('08:00') }]);
    r2 = rel(D, [{ cod: '790', ini: t('08:20') }]);
    r3 = rel(D, [{ cod: '790', ini: t('08:35') }]);
    await proc(A, r1); await h.dormir(150);
    await Promise.all([proc(A, r2), proc(B, r2)]); await h.dormir(150);
    await Promise.all([proc(A, r3), proc(B, r3)]); await h.dormir(150);
    const no = nos(A, '790');
    await reg('C10c', 'Dois operadores retificam juntos (08:00→08:20→08:35)', [
      ck(no.length === 1 && no[0][1].inicio === t('08:35'), `1 card, início 08:35 (obs: ${descr(A, '790')})`),
      ck(['790_141020260820'].every(x => aliasesDe(no[0]?.[1]).includes(x)), `horário 08:20 preservado nas referências (obs: ${aliasesDe(no[0]?.[1])})`),
      ck([...B.w.document.querySelectorAll('#tab-semaforo .kanban-card[data-codigo="790"]')].map(c => c.dataset.inicio).join() === t('08:35'), 'B vê o mesmo card'),
    ], A, r3, 'gravação por caminho (aliases/ID) não sobrescreve');
    A.dom.window.close(); B.dom.window.close();
  }

  // C14 Relatório real de 09/10/2026 (31 ocorrências: 4 pendentes, 27 normalizados)
  {
    const real = path.join(process.env.NIT_RELATORIO_REAL || '');
    if (process.env.NIT_RELATORIO_REAL && fs.existsSync(real)) {
      const txt = fs.readFileSync(real, 'utf8');
      nit = await subir({ relogio: '2026-10-09T17:00:00' });
      await proc(nit, txt);
      const k = Object.values(kanban(nit));
      const conferido = h.toasts(nit).some(x => /PRONTO/.test(x));
      await reg('C14', 'Relatório real 09/10 (31: 4 pend + 27 norm)', [
        ck(k.length === 31, `31 cards (obs: ${k.length})`),
        ck(k.filter(v => v.coluna !== 'coluna-normalizados').length === 4, `4 pendentes (obs: ${k.filter(v => v.coluna !== 'coluna-normalizados').length})`),
        ck(conferido && !alerta(nit), `conferência ✓ (alerta: ${alerta(nit).slice(0, 120) || 'nenhum'})`),
      ], nit, txt, 'relatório real sem regressão');
      nit.dom.window.close();
    } else console.log('C14 pulado: defina NIT_RELATORIO_REAL\n');
  }

  const resumo = R.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
  console.log('RESUMO 13.1', resumo);
  fs.writeFileSync(path.join(__dirname, 'bateria-13-1-resultado.json'), JSON.stringify(R, null, 2));
  process.exit(0);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
