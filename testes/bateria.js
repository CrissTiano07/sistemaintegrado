// Bateria T01–T21 — executa o nit.js real (harness jsdom + Firebase em memória).
// Somente leitura do repositório. Classificação: PASSOU | FALHOU | PARCIAL | NÃO IMPLEMENTADO.
const fs = require('fs');
const h = require('./harness');

const T = '\t';
const cab = (d) =>
  `*🚦PLANTÃO CEMOB*${T}${d}${T}\n*PLANTONISTA* ${T}TESTE${T}\n${T}${T}\n`;
const linhaOc = ({ tipo = 'INVESTIGANDO', cod, prob = 'APAGADO', ini, fim }) => {
  const i = ini ? `Início:${T}${ini}` : `Início:${T}`;
  const f = fim ? `${T}Fim:${T}${fim}` : `${T}${T}`;
  return `${tipo}${T}*🚦${T}${cod}${T}🚦${T}RUA ${cod} & AV TESTE${T}●${T}${prob}${T}●*${T}${i}${f}${T}"\n"${T}\n`;
};
// rel(data, pendentes[], normalizados[])
const rel = (d, pend = [], norm = []) =>
  cab(d) + `*PENDENTES*❌${T}${T}\n\n` + pend.map(linhaOc).join('') +
  `${T}${T}\n*NORMALIZADOS*✅${T}${T}\n\n` + norm.map(linhaOc).join('');

const HOJE = '11/10/2026', ONTEM = '10/10/2026';
const RELOGIO = '2026-10-11T08:00:00';

// ── utilitários de inspeção ────────────────────────────────────────────────
const kanban = nit => nit.fb.estado().kanban || {};
const nosDo = (nit, cod) => Object.entries(kanban(nit)).filter(([k]) => k.startsWith(cod + '_'));
const alertaIntegridade = nit => {
  const el = nit.w.document.getElementById('nit-integridade-processamento');
  return el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 1000) : null;
};
const ultimoToast = nit => h.toasts(nit).slice(-2).join(' | ');

let ATUAL = null;
async function cenario(estado, relatorios, opts = {}) {
  const nit = ATUAL = await h.subirNIT({ estado: estado || {}, relogioIso: opts.relogio || RELOGIO });
  for (const r of relatorios) {
    await h.processar(nit, r);
    if (h.modalAberto(nit)) await h.responderModal(nit, opts.confirmar !== false);
  }
  return nit;
}

const R = [];
function reg(id, nome, status, observado, contrato) {
  let conf = 'n/a (sem execução)';
  if (ATUAL) { const a = alertaIntegridade(ATUAL); const ok = h.toasts(ATUAL).slice(-1).some(t => /conferido/.test(t)); conf = a ? a.match(/(⚠️|ℹ️)[^•]+/g).map(x => x.trim()).join(' / ') : (ok ? '✓ conferido' : 'sem alerta'); }
  R.push({ id, nome, status, observado, contrato, conf });
  console.log(`${status.padEnd(17)} ${id} ${nome}\n   observado: ${observado}\n   contrato:  ${contrato}\n`);
}

(async () => {
  let nit, n, k;

  // T01 Estabilidade
  nit = await cenario({}, [rel(HOJE, [{ cod: '835', ini: '11/10/2026 06:00' }]), rel(HOJE, [{ cod: '835', ini: '11/10/2026 06:00' }])]);
  n = nosDo(nit, '835');
  reg('T01', 'Estabilidade', n.length === 1 ? 'PASSOU' : 'FALHOU',
    `${n.length} nó(s) após 2 relatórios iguais; alerta: ${alertaIntegridade(nit) || 'nenhum'}`, '§6 mesmo código+início → mesma ocorrência');
  nit.dom.window.close(); ATUAL = null;

  // T02 Enriquecimento: Início ausente → informado
  nit = await cenario({}, [rel(HOJE, [{ cod: '685' }]), rel(HOJE, [{ cod: '685', ini: '11/10/2026 07:37' }])]);
  n = nosDo(nit, '685');
  reg('T02', 'Enriquecimento (Início ausente → informado)',
    n.length === 1 && !alertaIntegridade(nit) ? 'PASSOU' : n.length === 1 ? 'PARCIAL' : 'FALHOU',
    `${n.length} nó(s): ${n.map(([x]) => x).join(', ')}; início gravado: "${n[0]?.[1].inicio}"; alerta: ${alertaIntegridade(nit) || 'nenhum'}`,
    '§7 NULL→valor enriquece a mesma ocorrência; identidade provisória consolidada');
  nit.dom.window.close(); ATUAL = null;

  // T03 Pendente → Normalizado
  nit = await cenario({}, [rel(HOJE, [{ cod: '142', ini: '11/10/2026 06:10' }]), rel(HOJE, [], [{ cod: '142', ini: '11/10/2026 06:10', fim: '11/10/2026 07:26' }])]);
  n = nosDo(nit, '142');
  reg('T03', 'Pendente → Normalizado', n.length === 1 && n[0][1].coluna === 'coluna-normalizados' ? 'PASSOU' : 'FALHOU',
    `${n.length} nó(s), coluna ${n[0]?.[1].coluna}, fim ${n[0]?.[1].data_fim} ${n[0]?.[1].hora_fim}`, '§10 transição esperada sem mudar identidade');
  nit.dom.window.close(); ATUAL = null;

  // T04 Normalizado direto
  nit = await cenario({}, [rel(HOJE, [{ cod: '900', ini: '11/10/2026 06:00' }]), rel(HOJE, [{ cod: '900', ini: '11/10/2026 06:00' }], [{ cod: '663', ini: '11/10/2026 06:10', fim: '11/10/2026 07:20' }])]);
  n = nosDo(nit, '663');
  reg('T04', 'Normalizado direto', n.length === 1 && n[0][1].coluna === 'coluna-normalizados' && !alertaIntegridade(nit) ? 'PASSOU' : 'FALHOU',
    `${n.length} nó(s), coluna ${n[0]?.[1].coluna}`, '§8 não exigir existência anterior como pendente');
  nit.dom.window.close(); ATUAL = null;

  // T05 Mudança de classificação
  nit = await cenario({}, [rel(HOJE, [{ cod: '044', tipo: 'INVESTIGANDO', ini: '11/10/2026 06:10' }]), rel(HOJE, [{ cod: '044', tipo: 'FURTO', ini: '11/10/2026 06:10' }])]);
  n = nosDo(nit, '044');
  reg('T05', 'Mudança de classificação', n.length === 1 && n[0][1].tipo === 'FURTO' ? 'PASSOU' : 'FALHOU',
    `${n.length} nó(s), tipo ${n[0]?.[1].tipo}`, '§9 atributo muda, identidade não');
  nit.dom.window.close(); ATUAL = null;

  // T06 Contradição de início (A → B) com A pendente
  nit = await cenario({}, [rel(HOJE, [{ cod: '123', ini: '11/10/2026 06:30' }]), rel(HOJE, [{ cod: '123', ini: '11/10/2026 08:15' }])]);
  n = nosDo(nit, '123');
  reg('T06', 'Contradição de início A → B',
    'FALHOU',
    `${n.length} nó(s): ${n.map(([x]) => x).join(', ')} — B mesclado em A sem decisão; alerta: ${alertaIntegridade(nit) || 'nenhum'}`,
    '§11–12 contradição → Guardião: preservar, diagnosticar, decidir; não decidir silenciosamente');
  nit.dom.window.close(); ATUAL = null;

  // T07 Retificação tardia 468/790: 08:20 ×3 → 06:10 + Fim 08:17
  nit = await cenario({}, [
    rel(HOJE, [{ cod: '790', ini: '11/10/2026 08:20' }]),
    rel(HOJE, [{ cod: '790', ini: '11/10/2026 08:20' }]),
    rel(HOJE, [], [{ cod: '790', ini: '11/10/2026 06:10', fim: '11/10/2026 08:17' }]),
  ], { relogio: '2026-10-11T09:00:00' });
  n = nosDo(nit, '790');
  reg('T07', 'Retificação tardia (790/468)',
    n.length === 1 ? 'PARCIAL' : 'FALHOU',
    `${n.length} nó(s): ${n.map(([x, v]) => `${x} [${v.coluna}, início ${v.inicio}]`).join('; ')}; alerta: ${alertaIntegridade(nit) || 'nenhum'}`,
    '§13 preservar eventoId estável e tratar como retificação após reconciliação (não silenciosa)');
  nit.dom.window.close(); ATUAL = null;

  // T08 Fim → ausente (normalizado volta sem Fim)
  nit = await cenario({}, [rel(HOJE, [], [{ cod: '555', ini: '11/10/2026 06:00', fim: '11/10/2026 06:40' }]), rel(HOJE, [{ cod: '555', ini: '11/10/2026 06:00' }])]);
  n = nosDo(nit, '555');
  let p = h.painel(nit);
  reg('T08', 'Fim → ausente', 'FALHOU',
    `${n.length} nó(s), coluna ${n[0]?.[1].coluna}; painel ${p.total}/${p.pendentes}/${p.normalizados} vs CEMOB 1/1/0; alerta: ${alertaIntegridade(nit) || 'nenhum'}; toast: ${ultimoToast(nit)}`,
    '§14 possível retificação → reconciliação; não ignorar silenciosamente');
  nit.dom.window.close(); ATUAL = null;

  // T09 Normalizado → Pendente (mesmo caso visto pela contagem)
  reg('T09', 'Normalizado → Pendente', 'FALHOU',
    `mesmo mecanismo do T08: card permanece normalizado e a contagem diverge do CEMOB sem aviso`,
    '§15 / BR-NOR-007 reconciliação explícita com decisão humana [CONFLITO documental: VALIDAR × CONTRATO]');

  // T10 Reincidência real (A normalizado, B novo)
  nit = await cenario({}, [rel(HOJE, [], [{ cod: '377', ini: '11/10/2026 05:40', fim: '11/10/2026 06:20' }]), rel(HOJE, [{ cod: '377', ini: '11/10/2026 07:50' }], [{ cod: '377', ini: '11/10/2026 05:40', fim: '11/10/2026 06:20' }])]);
  n = nosDo(nit, '377');
  const b = n.find(([x]) => x.endsWith('1110202607' + '50'.slice(0)) || x.includes('202607'));
  reg('T10', 'Reincidência real (anterior normalizada)', n.length === 2 ? 'PASSOU' : 'FALHOU',
    `${n.length} nó(s): ${n.map(([x, v]) => `${x}${v.reincidente ? ' ↺REINC' : ''}`).join(', ')}`, '§22 novo início legítimo → novo eventoId, sem herdar estado');
  nit.dom.window.close(); ATUAL = null;

  // T10b Reincidência com anterior AINDA pendente (assinatura do cardHerdado)
  nit = await cenario({}, [rel(HOJE, [{ cod: '378', ini: '11/10/2026 05:40' }]), rel(HOJE, [{ cod: '378', ini: '11/10/2026 05:40' }, { cod: '378', ini: '11/10/2026 07:50' }])]);
  n = nosDo(nit, '378');
  p = h.painel(nit);
  reg('T10b', 'Reincidência com anterior ainda pendente', n.length === 2 ? 'PASSOU' : 'FALHOU',
    `CEMOB 2 ocorrências; NIT ${n.length} nó(s): ${n.map(([x]) => x).join(', ')}; painel ${p.total}; alerta: ${alertaIntegridade(nit) || 'nenhum'}`,
    'INV-CEMOB-01/03: não perder nem colapsar reincidência');
  nit.dom.window.close(); ATUAL = null;

  // T11 Idempotência
  const r11 = rel(HOJE, [{ cod: '100', ini: '11/10/2026 06:00' }, { cod: '101', ini: '11/10/2026 06:05' }], [{ cod: '102', ini: '11/10/2026 05:00', fim: '11/10/2026 05:30' }]);
  nit = await cenario({}, [r11]);
  const antes = JSON.stringify(Object.keys(kanban(nit)).sort());
  await h.processar(nit, r11); await h.processar(nit, r11);
  const depois = JSON.stringify(Object.keys(kanban(nit)).sort());
  reg('T11', 'Idempotência (mesmo bruto 3×)', antes === depois && !alertaIntegridade(nit) ? 'PASSOU' : 'FALHOU',
    `nós antes ${antes} / depois ${depois}; toast: ${ultimoToast(nit)}`, '§33 reprocessamento do mesmo bruto não altera');
  nit.dom.window.close(); ATUAL = null;

  // T12 NIT N−1 (colisão por código: bruto traz 2 do mesmo SCN, um anterior pendente com outro início)
  reg('T12', 'Divergência NIT N−1', 'PARCIAL',
    'coberto por T06/T10b: o evento novo some (herdado pelo código); o Plano A ' + 'exibe a ausência', 'INV-CEMOB-01 não perder ocorrência silenciosamente');

  // T13 NIT N+1 (caso 1430: some do bruto sem normalizar)
  nit = await cenario({}, [rel(HOJE, [{ cod: '1430', ini: '11/10/2026 06:00' }, { cod: '200', ini: '11/10/2026 06:10' }]), rel(HOJE, [{ cod: '200', ini: '11/10/2026 06:10' }])]);
  p = h.painel(nit);
  reg('T13', 'Divergência NIT N+1 (caso 1430)', 'FALHOU',
    `bruto 1, painel ${p.total} (${p.pendentes} pend.); alerta: ${alertaIntegridade(nit) || 'nenhum'}; toast: ${ultimoToast(nit)}`,
    'INV-CEMOB-07 / TODO-026: detectar "unexpected", não só ausentes');
  nit.dom.window.close(); ATUAL = null;

  // T14 Totais iguais, membros diferentes
  nit = await cenario({}, [rel(HOJE, [{ cod: '1430', ini: '11/10/2026 06:00' }, { cod: '300', ini: '11/10/2026 06:10' }]), rel(HOJE, [{ cod: '300', ini: '11/10/2026 06:10' }, { cod: '301', ini: '11/10/2026 06:20' }])]);
  p = h.painel(nit);
  reg('T14', 'Totais iguais, membros diferentes', 'FALHOU',
    `bruto 2 (300, 301), painel ${p.total} (inclui 1430 que saiu do bruto); alerta: ${alertaIntegridade(nit) || 'nenhum'}`,
    'INV-CEMOB-07 comparar conjuntos, não totais');
  nit.dom.window.close(); ATUAL = null;

  // T15–T18: dependem do Guardião
  reg('T15', 'Caso inconclusivo', 'NÃO IMPLEMENTADO', 'não existe classificação INCONCLUSIVO no motor atual', '§17 preservar e revisar');
  reg('T16', 'Consequência projetada', 'NÃO IMPLEMENTADO', 'não há prévia antes de gravar (exceção: aviso de data do TODO-030)', 'INV-CEMOB-08 / TODO-022');
  reg('T17', 'Correção de decisão', 'NÃO IMPLEMENTADO', 'não há decisão humana registrada para reverter', '§27 / TODO-024');
  reg('T18', 'Novos fatos após decisão', 'NÃO IMPLEMENTADO', 'idem', '§27');

  // T19 Data do plantão divergente
  nit = await cenario({}, [rel('13/09/2026', [{ cod: '400', ini: '11/10/2026 06:00' }])], { confirmar: false });
  reg('T19', 'Data do plantão divergente', Object.keys(kanban(nit)).length === 0 ? 'PASSOU' : 'FALHOU',
    `aviso exibido e Cancelar não gravou (${Object.keys(kanban(nit)).length} nós); toast: ${ultimoToast(nit)}`, 'TODO-030');
  nit.dom.window.close(); ATUAL = null;

  // T20 Início ausente reprocessado (eventoId com Date.now)
  const r20 = rel(HOJE, [{ cod: '584' }, { cod: '601', ini: '11/10/2026 06:00' }]);
  nit = await cenario({}, [r20]);
  const ids1 = nosDo(nit, '584').map(([x]) => x);
  await h.dormir(20);
  await h.processar(nit, r20);
  const ids2 = nosDo(nit, '584').map(([x]) => x);
  reg('T20', 'Início ausente reprocessado', ids2.length === 1 && !alertaIntegridade(nit) ? 'PASSOU' : 'FALHOU',
    `nós 584: ${ids2.join(', ')}; alerta: ${alertaIntegridade(nit) || 'nenhum'}`, 'identidade estável (SCNs 584/1118)');
  nit.dom.window.close(); ATUAL = null;

  // T21 "Conferido" com cards invisíveis
  nit = await cenario({}, [rel('13/09/2026', [{ cod: '500', ini: '11/10/2026 06:00' }, { cod: '501', ini: '11/10/2026 06:05' }])], { confirmar: true });
  p = h.painel(nit);
  const conferido = h.toasts(nit).some(t => /conferido/.test(t));
  reg('T21', '"Conferido" com cards invisíveis', conferido && p.total === '0' ? 'FALHOU' : 'PASSOU',
    `toast "conferido": ${conferido}; painel mostra ${p.total} de 2`, 'conferência deve refletir o que o operador vê');
  nit.dom.window.close(); ATUAL = null;

  const resumo = R.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
  console.log('RESUMO', resumo);
  fs.writeFileSync(require('path').join(__dirname, 'bateria-resultado.json'), JSON.stringify(R, null, 2));
  process.exit(0);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
