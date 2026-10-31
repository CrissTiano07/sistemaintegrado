// Bateria 13.2.1 — hora com erro de digitação (caso real 23/10/2026: 446 "Início: 23/10/2026 06.:50")
// e card SEM início normalizado à mão (casos reais 446 e 933: o semáforo saía 2 vezes no relatório de saída).
// Regra: erro claro na hora é lido sem incomodar o operador e registrado no 📜 O QUE MUDOU;
// o que não dá para ler com segurança continua perguntando (NIT-14), mostrando o que veio.
const fs = require('fs'), path = require('path');
const h = require('./harness');
const T = '\t', D = '23/10/2026', RELOGIO = '2026-10-23T12:40:00';
const cab = d => `*🚦PLANTÃO CEMOB*${T}${d}${T}\n*PLANTONISTA* ${T}X${T}\n${T}${T}\n`;
const L = (cod, ini, fim, tipo = 'INVESTIGANDO', prob = 'APAGADO') =>
  `${tipo}${T}*🚦${T}${cod}${T}🚦${T}RUA ${cod}${T}●${T}${prob}${T}●*${T}Início:${T}${ini || ''}${fim ? `${T}Fim:${T}${fim}` : `${T}${T}`}${T}"\n"${T}\n`;
const rel = (p, n = []) => cab(D) + `*PENDENTES*❌${T}${T}\n\n` + p.join('') + `${T}${T}\n*NORMALIZADOS*✅${T}${T}\n\n` + n.join('');
const t = hm => `${D} ${hm}`;
const doc = n => n.w.document;
const txt = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
const dec = (n, msg, cod) => doc(n).querySelector(`#nit-integridade-processamento .nd-card[data-msg="${msg}"][data-codigo="${cod}"]`);
const no = (n, cod) => Object.entries(n.fb.estado().kanban || {}).filter(([, v]) => String(v.codigo) === String(cod));
const vis = n => [...doc(n).querySelectorAll('#tab-semaforo .kanban-card')].filter(c => c.style.display !== 'none');
const totais = n => { const v = vis(n); return `${v.filter(c => !c.closest('#coluna-normalizados')).length}/${v.filter(c => c.closest('#coluna-normalizados')).length}`; };
const subir = (fb, estado = {}) => h.subirNIT({ estado, relogioIso: RELOGIO, fb: fb || h.criarFirebaseFalso(estado, h.criarRelogio(RELOGIO)) });
async function proc(n, x) { await h.processar(n, x); if (h.modalAberto(n)) await h.responderModal(n, true); await h.dormir(500); }
async function diario(n) { doc(n).getElementById('nit-diario-btn')?.click(); await h.dormir(300);
  const its = [...doc(n).querySelectorAll('#nit-diario .nit-diario-item')].map(txt); doc(n).querySelector('#nit-diario [data-fechar]')?.click(); return its; }
async function relSaida(n) { doc(n).getElementById('btn-visualizar-relatorio').click(); await h.dormir(250); if (h.modalAberto(n)) await h.responderModal(n, true); await h.dormir(250);
  const r = doc(n).getElementById('modal-relatorio-texto').value; doc(n).getElementById('btn-modal-fechar')?.click(); return r; }
const ck = (ok, d) => ({ ok: !!ok, d }), eq = (a, b, d) => ck(a === b, `${d} (esperado: ${JSON.stringify(b)} · veio: ${JSON.stringify(a)})`);
const R = [];
function reg(id, nome, checks) { const s = checks.every(c => c.ok) ? 'PASSOU' : 'FALHOU'; R.push({ id, s });
  console.log(`${s.padEnd(7)} ${id} ${nome}`); for (const c of checks) console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`); }

(async () => {
  const REAL = fs.readFileSync(path.join(__dirname, 'dados/relatorio-23-10-446-hora-digitada.txt'), 'utf8');

  // H1 — o relatório real de 23/10
  { const A = await subir(); const k0 = h.toasts(A).length;
    await proc(A, REAL);
    const ts = h.toasts(A).slice(k0).filter(x => !/Bem-vindo/.test(x));
    const n = no(A, '446'); const c = doc(A).querySelector('#tab-semaforo .kanban-card[data-codigo="446"]');
    const r = await relSaida(A); const d = await diario(A);
    reg('H1', 'Relatório real: 446 "06.:50" lido como 06:50, sem incomodar', [
      ck(!dec(A, 'NIT-14', '446'), 'sem aviso "SEM HORA DE INÍCIO" para o 446'),
      eq(n.length, 1, 'um card do 446'),
      eq(n[0]?.[0], '446_231020260650', 'identidade pela hora lida'),
      eq(n[0]?.[1].inicio, t('06:50'), 'início gravado'),
      ck(c && !/06\.\s*$|Início:\s*23\/10\/2026 06\.(?!\d)/.test(txt(c)), `card sem o texto torto "06." (obs: ${txt(c).slice(0, 120)})`),
      ck(/^446 .*Desde 23\/10 - 06:50/m.test(r), `relatório de saída com "Desde 23/10 - 06:50" (obs: ${(r.split('\n').find(l => /^446 /.test(l)) || '—')})`),
      eq(totais(A), '8/13', 'painel igual ao cabeçalho do CEMOB (8 pendentes · 13 normalizados)'),
      ck(ts.some(x => /PRONTO · 8 pendentes · 13 normalizados/.test(x)), `✓ PRONTO (obs: ${ts.join(' | ')})`),
      ck(d.some(x => /ℹ Hora lida com correção: 446 \(início "06\.:50" → 06:50\)/.test(x)), `📜 O QUE MUDOU registra a leitura (obs: ${(d[0] || '').slice(0, 200)})`),
    ]); A.dom.window.close(); }

  // H2 — formas de erro claro (início e fim)
  { const A = await subir();
    const casos = [['901', '06.50', '06:50'], ['902', '6:50', '06:50'], ['903', '06h50', '06:50'], ['904', '06;;50', '06:50'], ['905', '06,50', '06:50'], ['906', '06 :50', '06:50']];
    await proc(A, rel(casos.map(([c, hm]) => L(c, t(hm))), [L('907', t('07:00'), t('08.:15'), 'ENEL')]));
    const d = await diario(A);
    reg('H2', 'Erros claros na hora (início e fim) viram hh:mm', [
      ...casos.map(([c, hm, esp]) => eq(no(A, c)[0]?.[1].inicio, t(esp), `${c} "${hm}"`)),
      eq(no(A, '907')[0]?.[1].hora_fim, '08:15', '907 fim "08.:15"'),
      ck(!doc(A).querySelector('#nit-integridade-processamento .nd-card[data-msg="NIT-14"]'), 'nenhum aviso de hora'),
      ck(d.some(x => /907 \(fim "08\.:15" → 08:15\)/.test(x)) && d.some(x => /902 \(início "6:50" → 06:50\)/.test(x)), 'diário lista as leituras corrigidas'),
      ck(!d.some(x => /906 \(início/.test(x)), '"06 :50" (só espaço) não precisa registrar'),
    ]); A.dom.window.close(); }

  // H3 — o que não dá para ler continua perguntando, mostrando o que veio
  { const A = await subir();
    await proc(A, rel([L('911', t('06.:5')), L('912', t('65:30')), L('913', t('0650')), L('914', '')]));
    const c1 = dec(A, 'NIT-14', '911'), c2 = dec(A, 'NIT-14', '912'), c4 = dec(A, 'NIT-14', '914');
    reg('H3', 'Hora ilegível: NIT-14 mostra o que veio', [
      eq(txt(c1?.querySelector('.nd-t')), '⚠ 911 HORA DE INÍCIO ILEGÍVEL', 'título 911'),
      eq(txt(c1?.querySelector('.nd-l2')), 'Veio "06.:5".', 'linha 2 do 911'),
      eq(txt(c2?.querySelector('.nd-l2')), 'Veio "65:30".', '912 hora impossível'),
      ck(!!dec(A, 'NIT-14', '913'), '913 "0650" (sem separador) pergunta'),
      eq(txt(c4?.querySelector('.nd-t')), '⚠ 914 SEM HORA DE INÍCIO', '914 sem nada: texto de sempre'),
      eq(no(A, '911')[0]?.[1].inicio || '', '', '911 fica sem início (não inventa)'),
    ]); A.dom.window.close(); }

  // H4 — card já criado SEM início pela versão anterior (produção hoje) + relatório lido com a correção
  { const fb = h.criarFirebaseFalso({}, h.criarRelogio(RELOGIO));
    const ini = REAL.replace('06.:50', '06.:5');       // simula a leitura antiga: hora ilegível → card sem início
    const A = await subir(fb); await proc(A, ini);
    const antes = no(A, '446').map(([id]) => id);
    await proc(A, REAL);
    const depois = no(A, '446');
    await proc(A, REAL);
    reg('H4', 'Card antigo sem início recebe a hora; não duplica', [
      eq(antes.join(), '446_SI23102026', 'antes: card sem início'),
      eq(depois.length, 1, 'continua um card só'),
      eq(depois[0]?.[1].inicio, t('06:50'), 'o mesmo card ganha o início 06:50'),
      ck(!dec(A, 'NIT-14', '446'), 'o aviso some'),
      eq(totais(A), '8/13', 'totais iguais ao CEMOB'),
      eq(no(A, '446').length, 1, 'reprocessar não muda nada'),
    ]); A.dom.window.close(); }

  // H5 — fonte corrige depois (06.:50 → 06:50): nada muda
  { const A = await subir(); await proc(A, REAL); const id1 = no(A, '446')[0]?.[0];
    await proc(A, REAL.replace('06.:50', '06:50'));
    reg('H5', 'Fonte corrige a digitação depois: nada muda', [
      eq(no(A, '446').length, 1, 'um card'), eq(no(A, '446')[0]?.[0], id1, 'mesma identidade'),
      ck(!doc(A).querySelector('#tab-semaforo .kanban-card[data-codigo="446"] .card-retificado'), 'sem etiqueta "início corrigido" (o horário não mudou)'),
    ]); A.dom.window.close(); }


  // ── P: card SEM início normalizado À MÃO (casos 446/933 de 23/10) ──
  const manual = async (A, cod, hm) => { doc(A).querySelector(`#tab-semaforo .kanban-card[data-codigo="${cod}"] .btn-card-action.complete`).click(); await h.dormir(200);
    doc(A).getElementById('norm-hora-fim').value = hm; doc(A).getElementById('btn-norm-confirmar').click(); await h.dormir(5800); };
  const linhas933 = async A => (await relSaida2(A)).split('\n').filter(l => /^933 /.test(l));
  async function relSaida2(n) { const c = doc(n).getElementById('check-incluir-normalizados'); c.checked = true; c.dispatchEvent(new n.w.Event('change')); return relSaida(n); }
  const R1 = rel([L('933', ''), L('500', t('07:00'))]);
  const FECHA = rel([L('500', t('07:00'))], [L('933', t('06:50'), t('08:15'), 'ENEL')]);

  { const A = await subir(); await proc(A, R1); await manual(A, '933', '08:33');
    await proc(A, R1);                                         // a fonte ainda diz pendente, sem hora
    const meio = { cards: no(A, '933').length, azul: !!dec(A, 'NIT-17', '933'), tot: totais(A) };
    await proc(A, FECHA);
    const n = no(A, '933'); const c = doc(A).querySelector('#tab-semaforo .kanban-card[data-codigo="933"]');
    const r = await linhas933(A);
    reg('P1', 'Sem início + normalizado à mão + fonte manda início e fim: um card só (caso 933)', [
      eq(meio.cards, 1, 'fonte ainda sem hora: continua um card (antes criava um pendente a mais)'),
      ck(meio.azul, 'fonte ainda sem hora: aviso azul "normalizado à mão"'),
      eq(meio.tot, '1/1', 'fonte ainda sem hora: totais 1 pendente · 1 normalizado'),
      eq(n.length, 1, 'depois do fim da fonte: um card'),
      eq(n[0]?.[1].inicio, t('06:50'), 'recebe o início da fonte'),
      eq(n[0]?.[1].hora_fim, '08:15', 'vale o fim da fonte'),
      ck(!n[0]?.[1].normManual, 'deixa de ser provisório'),
      ck([...(c?.querySelectorAll('.card-retificado') || [])].some(e => txt(e) === '⟲ fim corrigido 08:33 → 08:15'), 'etiqueta ⟲ fim corrigido 08:33 → 08:15'),
      eq(r.length, 1, `relatório de saída com o 933 uma vez só (obs: ${r.join(' || ')})`),
      eq(totais(A), '1/1', 'totais iguais ao CEMOB'),
    ]); A.dom.window.close(); }

  { const A = await subir(); await proc(A, R1); await manual(A, '933', '08:33');
    await proc(A, rel([L('933', t('06:50')), L('500', t('07:00'))]));   // fonte manda o início, ainda aberta
    const meio = no(A, '933'); const azulMeio = !!dec(A, 'NIT-17', '933');
    await proc(A, FECHA);
    reg('P2', 'Fonte manda primeiro o início (aberta) e depois o fim', [
      eq(meio.length, 1, 'com início, ainda aberta: um card'),
      ck(meio[0]?.[1].inicio === t('06:50') && meio[0]?.[1].normManual && meio[0]?.[1].coluna === 'coluna-normalizados', 'recebe o início e segue normalizado à mão'),
      ck(azulMeio, 'aviso azul "normalizado à mão" enquanto a fonte diz pendente'),
      eq(no(A, '933').length, 1, 'depois do fim: um card'),
      eq(no(A, '933')[0]?.[1].hora_fim, '08:15', 'vale o fim da fonte'),
    ]); A.dom.window.close(); }

  { const A = await subir(); await proc(A, R1); await manual(A, '933', '08:33');
    await proc(A, rel([L('933', t('09:00')), L('500', t('07:00'))], [L('933', t('06:50'), t('08:15'), 'ENEL')]));
    const n = no(A, '933').map(([, v]) => `${v.coluna}:${v.inicio}`).sort();
    reg('P3', 'Falha NOVA depois do fim informado não é absorvida (reincidência)', [
      eq(no(A, '933').length, 2, 'dois cards: a ocorrência encerrada e a nova'),
      ck(n.includes(`coluna-normalizados:${t('06:50')}`) && n.includes(`coluna-espera:${t('09:00')}`), `06:50 normalizado + 09:00 pendente (obs: ${n.join(' · ')})`),
    ]); A.dom.window.close(); }

  { const A = await subir(); await proc(A, R1); await proc(A, FECHA);
    reg('P4', 'Sem início, SEM normalizar à mão: continua como antes', [
      eq(no(A, '933').length, 1, 'um card'), eq(no(A, '933')[0]?.[1].hora_fim, '08:15', 'fim da fonte'),
    ]); A.dom.window.close(); }

  { const A = await subir(); await proc(A, rel([L('933', t('06:50')), L('500', t('07:00'))])); await manual(A, '933', '08:33'); await proc(A, FECHA);
    reg('P5', 'Com início + normalizado à mão: continua como antes (BR-DEC-002)', [
      eq(no(A, '933').length, 1, 'um card'), eq(no(A, '933')[0]?.[1].hora_fim, '08:15', 'fim da fonte'), ck(!no(A, '933')[0]?.[1].normManual, 'definitivo'),
    ]); A.dom.window.close(); }

  // P6 — sequência REAL do 933 (23/10, 📜 do João Paulo): sem hora → não veio → PENDENTE → ✓ 08:33 → fonte 06:50–08:15
  { const A = await subir(); const P = [L('500', t('06:00'))];
    await proc(A, rel([L('933', ''), ...P]));
    await proc(A, rel([...P]));
    const nv = !!dec(A, 'NIT-10', '933');
    doc(A).querySelector('#nit-integridade-processamento .nd-card[data-msg="NIT-10"][data-codigo="933"] button[data-acao="MANTER"]')?.click(); await h.dormir(250);
    await manual(A, '933', '08:33');
    await proc(A, rel([...P], [L('933', t('06:50'), t('08:15'), 'ENEL')]));
    const r = await linhas933(A);
    reg('P6', 'Sequência real do 933: sem hora → não veio → PENDENTE → à mão 08:33 → fonte 06:50–08:15', [
      ck(nv, 'às 08:12 o NIT pergunta "não veio"'),
      eq(no(A, '933').length, 1, 'um card do 933'),
      eq(r.length, 1, `relatório de saída com o 933 uma vez (obs: ${r.join(' || ')})`),
      ck(/06:50 às 08:15/.test(r[0] || ''), 'com o horário da fonte'),
      eq(totais(A), '1/1', 'totais iguais ao CEMOB'),
    ]); A.dom.window.close(); }

  // P7 — sequência REAL do 446: sem hora até a normalização à mão (11:43), depois a fonte 06:50–11:41
  { const A = await subir(); const P = [L('500', t('06:00'))];
    await proc(A, rel([L('446', ''), ...P])); await proc(A, rel([L('446', ''), ...P]));
    await manual(A, '446', '11:43');
    await proc(A, rel([L('446', ''), ...P]));
    await proc(A, rel([...P], [L('446', t('06:50'), t('11:41'), 'ABALROAMENTO')]));
    const r = (await relSaida2(A)).split('\n').filter(l => /^446 /.test(l));
    reg('P7', 'Sequência real do 446: sem hora → à mão 11:43 → fonte 06:50–11:41', [
      eq(no(A, '446').length, 1, 'um card do 446'),
      eq(r.length, 1, `relatório de saída com o 446 uma vez (obs: ${r.join(' || ')})`),
      eq(no(A, '446')[0]?.[1].hora_fim, '11:41', 'vale o fim da fonte'),
    ]); A.dom.window.close(); }

  // P8 — dois operadores: A normaliza à mão, B processa o relatório que fecha
  { const fb = h.criarFirebaseFalso({}, h.criarRelogio(RELOGIO)); const A = await subir(fb), B = await subir(fb);
    await proc(A, R1); await h.dormir(300); await manual(A, '933', '08:33'); await h.dormir(400);
    await proc(B, FECHA); await h.dormir(500);
    const vA = [...doc(A).querySelectorAll('#tab-semaforo .kanban-card[data-codigo="933"]')].filter(c => c.style.display !== 'none').length;
    reg('P8', 'Dois operadores: A normaliza à mão, B processa o fim da fonte', [
      eq(no(A, '933').length, 1, 'um card no banco'), eq(vA, 1, 'um card na tela do A'), eq(no(A, '933')[0]?.[1].hora_fim, '08:15', 'fim da fonte'),
    ]); A.dom.window.close(); B.dom.window.close(); }

  // P9 — a fonte fecha DEPOIS do horário informado pelo operador (mesma ocorrência)
  { const A = await subir(); await proc(A, R1); await manual(A, '933', '08:33');
    await proc(A, rel([L('500', t('07:00'))], [L('933', t('06:50'), t('09:00'), 'ENEL')]));
    reg('P9', 'Fonte fecha depois do horário à mão (06:50–09:00 vs 08:33)', [
      eq(no(A, '933').length, 1, 'um card'), eq(no(A, '933')[0]?.[1].hora_fim, '09:00', 'vale 09:00'),
      ck([...(doc(A).querySelectorAll('#tab-semaforo .kanban-card[data-codigo="933"] .card-retificado'))].some(e => txt(e) === '⟲ fim corrigido 08:33 → 09:00'), 'etiqueta ⟲ fim corrigido 08:33 → 09:00'),
    ]); A.dom.window.close(); }

  // P10 — REABRIR no aviso azul antes da fonte fechar
  { const A = await subir(); await proc(A, R1); await manual(A, '933', '08:33'); await proc(A, R1);
    dec(A, 'NIT-17', '933')?.querySelector('button[data-acao="REABRIR"]')?.click(); await h.dormir(300);
    const reab = no(A, '933')[0]?.[1].coluna;
    await proc(A, FECHA);
    reg('P10', 'Operador reabre (aviso azul) e depois a fonte fecha', [
      eq(reab, 'coluna-espera', 'REABRIR devolve a pendente'), eq(no(A, '933').length, 1, 'um card'), eq(no(A, '933')[0]?.[1].hora_fim, '08:15', 'fim da fonte'),
    ]); A.dom.window.close(); }

  // P11 — o mesmo relatório de fechamento processado 3 vezes
  { const A = await subir(); await proc(A, R1); await manual(A, '933', '08:33'); await proc(A, FECHA); await proc(A, FECHA); await proc(A, FECHA);
    reg('P11', 'Mesmo relatório 3 vezes: nada muda', [ eq(no(A, '933').length, 1, 'um card'), eq(totais(A), '1/1', 'totais') ]); A.dom.window.close(); }

  // P12 — vários semáforos no mesmo relatório: dois provisórios sem início + um comum
  { const A = await subir(); await proc(A, rel([L('933', ''), L('446', ''), L('500', t('07:00'))]));
    await manual(A, '933', '08:33'); await manual(A, '446', '08:40');
    await proc(A, rel([L('500', t('07:00'))], [L('933', t('06:50'), t('08:15'), 'ENEL'), L('446', t('06:50'), t('08:45'))]));
    reg('P12', 'Dois provisórios no mesmo relatório', [
      eq(no(A, '933').length + no(A, '446').length, 2, 'um card de cada'), eq(no(A, '446')[0]?.[1].hora_fim, '08:45', '446 vale 08:45'), eq(totais(A), '1/2', 'totais'),
    ]); A.dom.window.close(); }

  // ── N: os três caminhos de normalizar à mão (botão ✓, Central, arrastar) + arrastar de volta ──
  const arrastar = async (A, cod, col) => { const card = doc(A).querySelector(`#tab-semaforo .kanban-card[data-codigo="${cod}"]`), alvo = doc(A).querySelector(`#${col} .kanban-cards-container`);
    const ev = (tp, el) => { const e = new A.w.Event(tp, { bubbles: true, cancelable: true }); e.dataTransfer = { setData() {} }; e.clientY = 0; el.dispatchEvent(e); };
    ev('dragstart', card); ev('dragover', alvo); ev('drop', alvo); ev('dragend', card); await h.dormir(500); };
  const central = async (A, cod, hm) => { const d = doc(A); d.querySelector(`#tab-semaforo .kanban-card[data-codigo="${cod}"]`).click(); await h.dormir(300);
    d.querySelector('.nit-central-tab[data-tab="normalizar"]')?.click(); await h.dormir(200);
    d.getElementById('central-norm-data').value = '2026-10-23'; d.getElementById('central-norm-hora').value = hm; d.getElementById('btn-central-normalizar').click(); await h.dormir(500); };
  const jeitos = { 'BOTÃO': (A, c) => manual(A, c, '08:33'), 'CENTRAL': (A, c) => central(A, c, '08:33'), 'ARRASTAR': (A, c) => arrastar(A, c, 'coluna-normalizados') };
  let nN = 0;
  for (const [jeito, fazer] of Object.entries(jeitos)) for (const comInicio of [true, false]) {
    const A = await subir(); const ini = comInicio ? t('06:50') : '';
    const R = rel([L('933', ini), L('500', t('07:00'))]);
    await proc(A, R); await fazer(A, '933');
    const n1 = no(A, '933')[0]?.[1] || {};
    await proc(A, R);
    const meio = { cards: no(A, '933').length, azul: !!dec(A, 'NIT-17', '933'), voltou: !!dec(A, 'NIT-11', '933') };
    await proc(A, FECHA);
    reg(`N${++nN}`, `${jeito} · ${comInicio ? 'com' : 'sem'} início: normalização à mão provisória`, [
      ck(n1.coluna === 'coluna-normalizados' && n1.status === 'NORMALIZADO' && !!n1.hora_fim && !!n1.normManual, `depois de normalizar: NORMALIZADO, com fim e marca ✋ (obs: ${n1.status}/${n1.hora_fim}/${!!n1.normManual})`),
      ck(meio.cards === 1 && meio.azul && !meio.voltou, `fonte ainda pendente: um card, aviso azul, sem "voltou atrás" (obs: ${JSON.stringify(meio)})`),
      eq(no(A, '933').length, 1, 'fonte fecha: um card'),
      eq(no(A, '933')[0]?.[1].hora_fim, '08:15', 'vale o fim da fonte'),
      ck(!no(A, '933')[0]?.[1].normManual, 'deixa de ser provisório'),
    ]); A.dom.window.close();
  }
  { const A = await subir(); await proc(A, rel([L('933', t('06:50')), L('500', t('07:00'))])); await manual(A, '933', '08:33');
    await arrastar(A, '933', 'coluna-espera');
    const n = no(A, '933')[0]?.[1] || {};
    const d = await diario(A);
    reg('N7', 'Arrastar de NORMALIZADOS para AGUARDANDO = reabrir', [
      ck(n.coluna === 'coluna-espera' && n.status === 'PENDENTE' && !n.hora_fim && !n.normManual, `PENDENTE, sem fim, sem ✋ (obs: ${n.coluna}/${n.status}/${n.hora_fim || '—'})`),
      ck(d.some(x => /933 reaberto \(arrastado de NORMALIZADOS\)/.test(x)), '📜 registra "933 reaberto (arrastado de NORMALIZADOS)"'),
    ]); A.dom.window.close(); }
  { const A = await subir(); await proc(A, FECHA); await arrastar(A, '933', 'coluna-espera');
    const n = no(A, '933')[0]?.[1] || {};
    await proc(A, FECHA);
    reg('N8', 'Normalizado pela fonte arrastado de volta: o próximo relatório normaliza de novo', [
      ck(n.status === 'PENDENTE' && !n.hora_fim, 'ao arrastar: PENDENTE, sem fim'),
      ck(no(A, '933')[0]?.[1].coluna === 'coluna-normalizados' && no(A, '933')[0]?.[1].hora_fim === '08:15', 'próximo relatório: volta a normalizado 08:15 (a fonte manda)'),
      eq(no(A, '933').length, 1, 'um card'),
    ]); A.dom.window.close(); }

  const c = R.reduce((a, r) => (a[r.s] = (a[r.s] || 0) + 1, a), {});
  console.log('\nRESUMO hora', c);
  fs.writeFileSync(path.join(__dirname, 'bateria-hora-resultado.json'), JSON.stringify(R, null, 1));
  process.exit(0);
})();
