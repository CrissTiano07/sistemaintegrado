// Bateria 13.2 — Mensagens do NIT (MENSAGENS.md, validado em 17/10/2026).
// Cada ID do catálogo tem um teste que confere o TEXTO EXATO e o comportamento:
// botões, ⏳ PERGUNTADO, DESFAZER, totais, card que some sozinho, dois operadores.
const fs = require('fs');
const path = require('path');
const h = require('./harness');

const T = '\t';
const D = '16/10/2026';
const RELOGIO = '2026-10-16T21:00:00';
const cab = d => `*🚦PLANTÃO CEMOB*${T}${d}${T}\n*PLANTONISTA* ${T}X${T}\n${T}${T}\n`;
const L = (cod, ini, fim, tipo = 'INVESTIGANDO', prob = 'APAGADO') =>
  `${tipo}${T}*🚦${T}${cod}${T}🚦${T}RUA ${cod}${T}●${T}${prob}${T}●*${T}Início:${T}${ini || ''}${fim ? `${T}Fim:${T}${fim}` : `${T}${T}`}${T}"\n"${T}\n`;
const rel = (p, n = [], d = D) => cab(d) + `*PENDENTES*❌${T}${T}\n\n` + p.join('') + `${T}${T}\n*NORMALIZADOS*✅${T}${T}\n\n` + n.join('');
const t = hm => `${D} ${hm}`;

// ── inspeção ──────────────────────────────────────────────────────────────
const doc = nit => nit.w.document;
const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
const painelDec = nit => doc(nit).getElementById('nit-integridade-processamento');
const cardsDec = nit => [...doc(nit).querySelectorAll('#nit-integridade-processamento .nd-card')];
const dec = (nit, msg, cod) => cardsDec(nit).find(c => c.dataset.msg === msg && c.dataset.codigo === cod);
const titulo = el => txt(el?.querySelector('.nd-t'));
const linha2 = el => txt(el?.querySelector('.nd-l2'));
const botoes = el => [...(el?.querySelectorAll('.nd-botoes button') || [])].map(b => txt(b));
const clicar = async (nit, el, acao) => { el?.querySelector(`button[data-acao="${acao}"]`)?.click(); await h.dormir(200); };
const confirmacao = nit => txt(doc(nit).querySelector('#nit-integridade-processamento .nd-confirmacao .nd-conf-txt'));
const desfazer = async nit => { doc(nit).querySelector('#nit-integridade-processamento .nd-confirmacao button[data-acao="DESFAZER"]')?.click(); await h.dormir(200); };
const cabTitulo = nit => txt(doc(nit).querySelector('#nit-integridade-processamento .nd-titulo'));
const cabSub = nit => txt(doc(nit).querySelector('#nit-integridade-processamento .nd-sub'));
const naTela = (nit, cod) => [...doc(nit).querySelectorAll(`#tab-semaforo .kanban-card[data-codigo="${cod}"]`)];
const no = (nit, cod) => Object.entries(nit.fb.estado().kanban || {}).filter(([, v]) => String(v.codigo) === String(cod));
const toastsTxt = nit => h.toasts(nit).filter(x => !/^Bem-vindo/.test(x));
const HM = /\d{2}:\d{2}/;

async function proc(nit, x) { await h.processar(nit, x); if (h.modalAberto(nit)) await h.responderModal(nit, true); }
function capturarCopia(nit) {
  const c = { texto: null };
  nit.w.navigator.clipboard.writeText = s => { c.texto = s; return Promise.resolve(); };
  return c;
}
const novoFb = () => h.criarFirebaseFalso({}, h.criarRelogio(RELOGIO));
const subir = (fb, estado = {}) => h.subirNIT({ estado, relogioIso: RELOGIO, fb });

const R = [];
function reg(id, nome, checks) {
  const status = checks.every(c => c.ok) ? 'PASSOU' : 'FALHOU';
  R.push({ id, nome, status, falhas: checks.filter(c => !c.ok).map(c => c.d) });
  console.log(`${status.padEnd(7)} ${id} ${nome}`);
  for (const c of checks) console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`);
  console.log('');
}
const ck = (ok, d) => ({ ok: !!ok, d });
const eq = (obs, esp, d) => ck(obs === esp, `${d}: "${esp}"${obs === esp ? '' : ` (obs: "${obs}")`}`);

(async () => {
  // ── NIT-01 PRONTO ─────────────────────────────────────────────────────
  { const A = await subir(novoFb());
    await proc(A, rel([L('9901', t('08:00')), L('9902', t('08:30'))], [L('9904', t('06:00'), t('07:15'))]));
    reg('NIT-01', 'Processou sem nada a decidir', [
      ck(toastsTxt(A).includes('✓ PRONTO · 2 pendentes · 1 normalizado'), `toast "✓ PRONTO · 2 pendentes · 1 normalizado" (obs: ${toastsTxt(A).join(' | ')})`),
      ck(!painelDec(A), 'nenhum card de decisão'),
      ck(toastsTxt(A).length === 1, `um único toast (obs: ${toastsTxt(A).length})`),
    ]); A.dom.window.close(); }

  // ── NIT-02 relatório de outro dia ─────────────────────────────────────
  { const A = await subir(novoFb());
    await h.processar(A, rel([L('9901', '15/10/2026 08:00')], [], '15/10/2026'));
    const m = h.modalAberto(A);
    const ok = txt(doc(A).getElementById('btn-confirmar-generico-ok')), can = txt(doc(A).getElementById('btn-confirmar-generico-cancel'));
    await h.responderModal(A, false);
    const okDepois = txt(doc(A).getElementById('btn-confirmar-generico-ok'));
    reg('NIT-02', 'Relatório de outro dia', [
      eq(m?.titulo, '⚠ ESTE RELATÓRIO É DE 15/10.', 'título'),
      eq(m?.msg, 'Hoje é 16/10.', 'mensagem'),
      ck(ok === 'USAR' && can === 'CANCELAR', `botões [USAR] [CANCELAR] (obs: ${ok} / ${can})`),
      ck(naTela(A, '9901').length === 0 && toastsTxt(A).length === 0, 'CANCELAR: nada processado, sem toast'),
      ck(okDepois === 'Confirmar', `botão do modal genérico volta ao texto padrão (obs: ${okDepois})`),
    ]); A.dom.window.close(); }

  // ── NIT-03 texto não reconhecido ──────────────────────────────────────
  { const A = await subir(novoFb());
    await h.processar(A, 'bom dia pessoal, segue o relatório');
    const t1 = toastsTxt(A).slice(-1)[0];
    await h.processar(A, '   ');
    const t2 = toastsTxt(A).slice(-1)[0];
    reg('NIT-03', 'Não entendi o texto', [
      eq(t1, '❌ NÃO ENTENDI O TEXTO. Cole o relatório inteiro do WhatsApp.', 'texto sem semáforo'),
      eq(t2, '❌ NÃO ENTENDI O TEXTO. Cole o relatório inteiro do WhatsApp.', 'campo vazio'),
    ]); A.dom.window.close(); }

  // ── NIT-04 reincidência ───────────────────────────────────────────────
  { const A = await subir(novoFb());
    await proc(A, rel([L('887', t('07:14'))]));
    await proc(A, rel([L('887', t('11:00'))], [L('887', t('07:14'), t('10:46'))]));
    reg('NIT-04', 'Apagou de novo', [
      ck(toastsTxt(A).includes('ℹ 887 APAGOU DE NOVO. 2ª vez hoje.'), `toast "ℹ 887 APAGOU DE NOVO. 2ª vez hoje." (obs: ${toastsTxt(A).join(' | ')})`),
      ck(!/Registrado|Conferir|corrigido/.test(toastsTxt(A).join(' ')), 'sem textos antigos'),
    ]); A.dom.window.close(); }

  // ── NIT-05 horário corrigido (etiqueta no card, nos dois operadores) ──
  { const fb = novoFb(); const A = await subir(fb), B = await subir(fb);
    await proc(A, rel([L('9901', t('08:00'))])); await h.dormir(150);
    await proc(A, rel([L('9901', t('08:40'))])); await h.dormir(300);
    const tagA = txt(naTela(A, '9901')[0]?.querySelector('.card-retificado'));
    const tagB = txt(naTela(B, '9901')[0]?.querySelector('.card-retificado'));
    reg('NIT-05', 'Horário corrigido', [
      eq(tagA, '⟲ início corrigido 08:00 → 08:40', 'etiqueta no card (A)'),
      eq(tagB, '⟲ início corrigido 08:00 → 08:40', 'etiqueta no card (B, outro operador)'),
      ck(!toastsTxt(A).some(x => /Horário corrigido/.test(x)), 'sem toast "Horário corrigido"'),
      ck(toastsTxt(A).slice(-1)[0] === '✓ PRONTO · 1 pendente · 0 normalizados', `segue ✓ PRONTO (obs: ${toastsTxt(A).slice(-1)[0]})`),
    ]); A.dom.window.close(); B.dom.window.close(); }

  // ── NIT-05b fim corrigido pela fonte (card já normalizado) ────────────
  { const fb = novoFb(); const A = await subir(fb), B = await subir(fb);
    await proc(A, rel([], [L('468', t('10:00'), t('09:30'))])); await h.dormir(150);
    const R2 = rel([], [L('468', t('10:00'), t('10:30'))]);
    await proc(A, R2); await h.dormir(300);
    const n = no(A, '468')[0]?.[1] || {};
    const tagA = txt(naTela(A, '468')[0]?.querySelector('.card-retificado'));
    const tagB = txt(naTela(B, '468')[0]?.querySelector('.card-retificado'));
    const antes = JSON.stringify(no(A, '468').map(([k, v]) => [k, v.hora_fim, v.fimAnterior]));
    await proc(A, R2); await proc(A, R2);
    reg('NIT-05b', 'Fim corrigido no relatório', [
      ck(no(A, '468').length === 1 && n.hora_fim === '10:30' && n.data_fim === D, `banco: um card, fim 10:30 (obs: ${no(A, '468').length} card(s), fim ${n.data_fim} ${n.hora_fim})`),
      ck(n.fimAnterior === t('09:30'), `fim anterior guardado (obs: ${n.fimAnterior})`),
      eq(tagA, '⟲ fim corrigido 09:30 → 10:30', 'etiqueta no card (A)'),
      eq(tagB, '⟲ fim corrigido 09:30 → 10:30', 'etiqueta no card (B)'),
      ck(JSON.stringify(no(A, '468').map(([k, v]) => [k, v.hora_fim, v.fimAnterior])) === antes, 'reprocessar o mesmo relatório não muda nada'),
      ck(!dec(A, 'NIT-13', '468') && !painelDec(A), 'sem card de decisão (é correção, não problema)'),
    ]); A.dom.window.close(); B.dom.window.close(); }

  // ── NIT-06 + NIT-10 TIRAR / DESFAZER (dois operadores) ────────────────
  { const fb = novoFb(); const A = await subir(fb), B = await subir(fb);
    const cp = capturarCopia(A);
    await proc(A, rel([L('973', t('10:54')), L('530', t('11:00'))])); await h.dormir(150);
    const nAntes = toastsTxt(A).length;
    await proc(A, rel([L('530', t('11:00'))]));
    const c = dec(A, 'NIT-10', '973');
    const checks = [
      eq(cabTitulo(A), 'RELATÓRIO ALTERADO!', 'NIT-06 título'),
      eq(cabSub(A), '1 semáforo precisa de você', 'NIT-06 subtítulo'),
      ck(!toastsTxt(A).slice(nAntes).some(x => /PRONTO/.test(x)), 'sem ✓ PRONTO quando há decisão'),
      eq(titulo(c), '⚠ 973 SAIU DO RELATÓRIO', 'NIT-10 título'),
      ck(/^Pendente desde 10:54\. No relatório das \d{2}:\d{2} não aparece mais, nem como normalizado\.$/.test(linha2(c)), `NIT-10 linha 2 "Pendente desde 10:54. Sumiu no relatório das HH:MM." (obs: ${linha2(c)})`),
      eq(botoes(c).join(' | '), 'CONTINUA PENDENTE | NORMALIZOU | EXCLUIR | 📋 PERGUNTAR', 'botões pelo estado do semáforo'),
    ];
    await clicar(A, c, 'PERGUNTAR');
    checks.push(ck(/^O 973 \(pendente desde 10:54\) não veio no relatório das \d{2}:\d{2}\. Normalizou\?$/.test(cp.texto || ''), `pergunta copiada (obs: ${cp.texto})`));
    await clicar(A, dec(A, 'NIT-10', '973'), 'TIRAR'); await h.dormir(200);
    checks.push(
      eq(confirmacao(A), '✓ 973 EXCLUÍDO DO PAINEL. Agora: 1 pendente · 0 normalizados', 'NIT-20 confirmação'),
      ck(naTela(A, '973').length === 0 && naTela(B, '973').length === 0, 'saiu do painel de A e de B'),
      ck(no(A, '973').length === 1 && no(A, '973')[0]?.[1].retirado, 'continua no banco, marcado como retirado (não apaga)'),
      ck(!dec(A, 'NIT-10', '973'), 'card de decisão some'),
    );
    await desfazer(A); await h.dormir(200);
    checks.push(
      eq(confirmacao(A), '↩ DESFEITO. 973 VOLTOU. Agora: 2 pendentes · 0 normalizados', 'NIT-21'),
      ck(naTela(A, '973').length === 1 && naTela(B, '973').length === 1, 'voltou em A e em B'),
      ck(!no(A, '973')[0]?.[1].retirado, 'marca de retirado removida'),
      ck(!!dec(A, 'NIT-10', '973'), 'a pergunta volta (o problema continua)'),
    );
    reg('NIT-06/10/20/21', 'Não veio no relatório → TIRAR → DESFAZER', checks);
    A.dom.window.close(); B.dom.window.close(); }

  // ── NIT-10 MANTER (lembrado) e volta a perguntar se sumir de novo ─────
  { const A = await subir(novoFb());
    const R1 = rel([L('973', t('10:54')), L('530', t('11:00'))]), R2 = rel([L('530', t('11:00'))]);
    await proc(A, R1); await proc(A, R2);
    await clicar(A, dec(A, 'NIT-10', '973'), 'MANTER');
    const conf = confirmacao(A);
    await proc(A, R2);
    const lembrou = !dec(A, 'NIT-10', '973');
    const pronto = toastsTxt(A).slice(-1)[0];
    await proc(A, R1); await proc(A, R2);
    reg('NIT-10 MANTER', 'Manter fica lembrado; volta a perguntar se sumir de novo', [
      eq(conf, '✓ 973 CONTINUA PENDENTE. Agora: 2 pendentes · 0 normalizados', 'confirmação'),
      ck(lembrou, 'mesmo relatório de novo: não pergunta outra vez'),
      eq(pronto, '✓ PRONTO · 2 pendentes · 0 normalizados', 'e mostra ✓ PRONTO'),
      ck(!!dec(A, 'NIT-10', '973'), 'voltou no relatório e sumiu de novo: pergunta outra vez'),
    ]); A.dom.window.close(); }

  // ── NIT-10: card retirado que volta no relatório ──────────────────────
  { const A = await subir(novoFb());
    const R1 = rel([L('973', t('10:54')), L('530', t('11:00'))]);
    await proc(A, R1); await proc(A, rel([L('530', t('11:00'))]));
    await clicar(A, dec(A, 'NIT-10', '973'), 'TIRAR');
    await proc(A, R1);
    const ids = [...doc(A).querySelectorAll('[data-eventoid^="973_"]')].length;
    reg('NIT-10 volta', 'Card retirado volta quando a fonte lista de novo', [
      ck(naTela(A, '973').length === 1 && ids === 1, `um único card 973 no painel (DOM: ${ids})`),
      ck(no(A, '973').length === 1 && !no(A, '973')[0]?.[1].retirado, 'banco: mesmo nó, sem marca de retirado'),
    ]); A.dom.window.close(); }

  // ── NIT-11 voltou para pendente: REABRIR / DESFAZER / MANTER NORMALIZADO ─
  { const A = await subir(novoFb()); const cp = capturarCopia(A);
    await proc(A, rel([L('887', t('07:14'))]));
    await proc(A, rel([], [L('887', t('07:14'), t('10:46'))]));
    await proc(A, rel([L('887', t('07:14'))]));
    const c = dec(A, 'NIT-11', '887');
    const checks = [
      eq(titulo(c), '⚠ 887 VOLTOU ATRÁS', 'título'),
      eq(linha2(c), 'Mesma ocorrência (início 07:14). Normalizou às 10:46 e agora veio de novo como pendente. Não é uma nova falha.', 'linha 2'),
      eq(botoes(c).join(' | '), 'REABRIR | MANTER NORMALIZADO | 📋 PERGUNTAR', 'botões'),
    ];
    await clicar(A, c, 'PERGUNTAR');
    checks.push(eq(cp.texto, 'O 887 normalizou às 10:46 e voltou como pendente. Apagou de novo?', 'pergunta copiada'));
    await clicar(A, dec(A, 'NIT-11', '887'), 'REABRIR');
    const n = no(A, '887')[0]?.[1] || {};
    checks.push(
      eq(confirmacao(A), '✓ 887 REABRIU. Agora: 1 pendente · 0 normalizados', 'confirmação'),
      ck(n.coluna !== 'coluna-normalizados' && !n.hora_fim, `reaberto no banco (coluna ${n.coluna}, fim "${n.hora_fim || ''}")`),
    );
    await desfazer(A);
    const n2 = no(A, '887')[0]?.[1] || {};
    checks.push(
      eq(confirmacao(A), '↩ DESFEITO. 887 VOLTOU. Agora: 0 pendentes · 1 normalizado', 'DESFAZER'),
      ck(n2.coluna === 'coluna-normalizados' && n2.hora_fim === '10:46', 'normalizado de novo, com o fim 10:46'),
    );
    await clicar(A, dec(A, 'NIT-11', '887'), 'MANTER_NORM');
    checks.push(eq(confirmacao(A), '✓ 887 FICOU NORMALIZADO. Agora: 0 pendentes · 1 normalizado', 'MANTER NORMALIZADO'));
    await proc(A, rel([L('887', t('07:14'))]));
    checks.push(ck(!dec(A, 'NIT-11', '887'), 'decisão lembrada no reprocessamento'));
    reg('NIT-11', 'Voltou para pendente', checks); A.dom.window.close(); }

  // ── NIT-11: card que nasceu normalizado → REABRIR → DESFAZER mantém o fim; REABRIR some se já há pendente ─
  { const A = await subir(novoFb());
    await proc(A, rel([], [L('887', t('07:14'), t('10:46'))]));
    await proc(A, rel([L('887', t('07:14'))]));
    const antes = JSON.stringify(no(A, '887').map(([k, v]) => [k, v.coluna, v.data_fim, v.hora_fim, v.fim || '']));
    await clicar(A, dec(A, 'NIT-11', '887'), 'REABRIR'); await desfazer(A);
    const depois = JSON.stringify(no(A, '887').map(([k, v]) => [k, v.coluna, v.data_fim, v.hora_fim, v.fim || '']));
    await proc(A, rel([L('888', t('07:00'))], [L('888', t('06:00'), t('06:30'))]));
    await proc(A, rel([L('888', t('06:00')), L('888', t('07:00'))]));
    reg('NIT-11 extra', 'DESFAZER do REABRIR e regra de uma pendência', [
      ck(antes === depois, `DESFAZER volta exatamente (antes ${antes} / depois ${depois})`),
      eq(botoes(dec(A, 'NIT-11', '888')).join(' | '), 'MANTER NORMALIZADO | 📋 PERGUNTAR', '888 já tem pendente: sem REABRIR'),
      eq(txt(dec(A, 'NIT-11', '888')?.querySelector('.nd-l3')), 'Já existe outra pendência do 888, a das 07:00. Por isso não dá para reabrir esta.', 'o card explica por que não há REABRIR'),
    ]); A.dom.window.close(); }

  // ── Linha sem início não pode colidir com card antigo que nasceu sem início ─
  { const A = await subir(novoFb());
    await proc(A, rel([L('1006', '')]));                                   // nasce sem início (id _SI)
    await proc(A, rel([L('1006', t('07:03'))]));                           // ganha início
    await proc(A, rel([], [L('1006', t('07:03'), t('08:46'))]));           // normaliza
    const R4 = rel([L('1006', '')], [L('1006', t('07:03'), t('08:46'))]);  // nova ocorrência, de novo sem início
    await proc(A, R4);
    const pend = no(A, '1006').filter(([, v]) => v.coluna !== 'coluna-normalizados');
    const antes = JSON.stringify(no(A, '1006').map(([k, v]) => [k, v.coluna]).sort());
    await proc(A, R4);
    reg('SEM INÍCIO 2', 'Nova pendência sem início não se perde', [
      ck(pend.length === 1, `uma pendência nova (obs: ${JSON.stringify(no(A, '1006').map(([k, v]) => [k, v.coluna, v.inicio]))})`),
      ck(no(A, '1006').some(([k, v]) => v.coluna === 'coluna-normalizados' && v.hora_fim === '08:46'), 'a normalizada antiga continua intacta'),
      ck(JSON.stringify(no(A, '1006').map(([k, v]) => [k, v.coluna]).sort()) === antes, 'reprocessar não cria outra'),
    ]); A.dom.window.close(); }

  // ── Linha sem início não apaga o início conhecido (C1) ─────────────────
  { const A = await subir(novoFb());
    await proc(A, rel([L('1017', t('12:22'))]));
    await proc(A, rel([L('1017', '')]));
    const n1 = no(A, '1017');
    const c = dec(A, 'NIT-14', '1017');
    await proc(A, rel([L('1017', t('12:22'))]));
    reg('SEM INÍCIO 1', 'Linha sem início não apaga o início do card', [
      ck(n1.length === 1 && n1[0][1].inicio === t('12:22'), `o card continua com início 12:22 (obs: ${JSON.stringify(n1.map(([k, v]) => [k, v.inicio]))})`),
      eq(titulo(c), '⚠ 1017 SEM HORA DE INÍCIO', 'NIT-14 pergunta à fonte'),
      ck(!naTela(A, '1017')[0]?.querySelector('.card-retificado'), 'sem etiqueta de "início corrigido"'),
      ck(toastsTxt(A).includes('ℹ 1017 RESOLVIDO.') && no(A, '1017').length === 1, 'relatório certo: resolvido, mesmo card'),
    ]); A.dom.window.close(); }

  // ── NIT-12 veio 2 vezes: PERGUNTAR → ⏳ PERGUNTADO → resolvido (NIT-07) ─
  { const fb = novoFb(); const A = await subir(fb); const cp = capturarCopia(A);
    await proc(A, rel([L('790', t('08:00'))]));
    const R2 = rel([L('790', t('08:00')), L('790', t('09:10'))]);
    await proc(A, R2);
    const c = dec(A, 'NIT-12', '790');
    const checks = [
      eq(titulo(c), 'ℹ 790 VEIO 2 VEZES', 'título (azul: só para saber)'),
      ck(c?.classList.contains('nd-azul'), 'card azul'),
      eq(linha2(c), 'Pendente às 08:00 e às 09:10. Nada a fazer: o NIT ficou com 08:00. Some quando a fonte corrigir.', 'linha 2'),
      eq(botoes(c).join(' | '), '📋 PERGUNTAR', 'botão único'),
    ];
    await clicar(A, c, 'PERGUNTAR');
    const c2 = dec(A, 'NIT-12', '790');
    checks.push(
      eq(cp.texto, 'O 790 aparece 2 vezes como pendente (08:00 e 09:10). O início certo é 08:00 ou 09:10?', 'pergunta copiada'),
      ck(c2?.classList.contains('nd-perguntado') && /^⏳ PERGUNTADO \d{2}:\d{2}$/.test(txt(c2.querySelector('.nd-estado'))), `card translúcido "⏳ PERGUNTADO HH:MM" (obs: ${txt(c2?.querySelector('.nd-estado'))})`),
    );
    await proc(A, R2);
    checks.push(ck(dec(A, 'NIT-12', '790')?.classList.contains('nd-perguntado'), 'reprocessar o mesmo relatório: continua PERGUNTADO'));
    const B = await subir(fb); await proc(B, R2);
    checks.push(ck(dec(B, 'NIT-12', '790')?.classList.contains('nd-perguntado'), 'outro operador vê que já foi perguntado'));
    B.dom.window.close();
    await clicar(A, dec(A, 'NIT-12', '790'), 'PERGUNTAR');
    checks.push(eq(cp.texto, 'O 790 aparece 2 vezes como pendente (08:00 e 09:10). O início certo é 08:00 ou 09:10?', 'clicar de novo copia de novo (cobrar)'));
    await proc(A, rel([L('790', t('08:00'))]));
    checks.push(
      ck(toastsTxt(A).includes('ℹ 790 RESOLVIDO.'), `NIT-07 "ℹ 790 RESOLVIDO." (obs: ${toastsTxt(A).slice(-2).join(' | ')})`),
      ck(!dec(A, 'NIT-12', '790'), 'card some sozinho'),
    );
    reg('NIT-12/07', 'Veio 2 vezes → perguntado → resolvido', checks); A.dom.window.close(); }

  // ── NIT-13 horário não fecha ──────────────────────────────────────────
  { const A = await subir(novoFb()); const cp = capturarCopia(A);
    await proc(A, rel([], [L('468', t('10:00'), t('09:30'))]));
    const c = dec(A, 'NIT-13', '468');
    const checks = [
      eq(titulo(c), '⚠ 468 HORÁRIO NÃO FECHA', 'título'),
      eq(linha2(c), 'Início 10:00, fim 09:30.', 'linha 2'),
      eq(botoes(c).join(' | '), '📋 PERGUNTAR', 'botão'),
    ];
    if (c) await clicar(A, c, 'PERGUNTAR');
    checks.push(eq(cp.texto, 'O 468 diz início 10:00 e fim 09:30. Qual é o certo?', 'pergunta copiada'));
    // sobreposição: fim de uma depois do início da outra aberta
    await proc(A, rel([L('469', t('10:00'))]));
    await proc(A, rel([L('469', t('10:15'))], [L('469', t('10:00'), t('10:30'))]));
    const c2 = dec(A, 'NIT-13', '469');
    checks.push(eq(linha2(c2), 'Início 10:00, fim 10:30 · Início 10:15, sem fim.', 'sobreposição: linha 2 lista os horários'));
    reg('NIT-13', 'Horário não fecha', checks); A.dom.window.close(); }

  // ── NIT-14 sem hora de início ─────────────────────────────────────────
  { const A = await subir(novoFb()); const cp = capturarCopia(A);
    await proc(A, rel([L('602', '')]));
    const c = dec(A, 'NIT-14', '602');
    const checks = [
      eq(titulo(c), '⚠ 602 SEM HORA DE INÍCIO', 'título'),
      eq(linha2(c), 'Veio sem a hora que começou.', 'linha 2'),
    ];
    if (c) await clicar(A, c, 'PERGUNTAR');
    checks.push(eq(cp.texto, 'O 602 veio sem hora de início. Que horas começou?', 'pergunta copiada'));
    reg('NIT-14', 'Sem hora de início', checks); A.dom.window.close(); }

  // ── NIT-16 dois cards (registro anterior) ─────────────────────────────
  { const base = { codigo: '323', dataReferencia: D, coluna: 'coluna-espera', status: 'PENDENTE', problema: 'APAGADO', endereco: 'RUA 323', tipo: 'INVESTIGANDO' };
    const estado = { kanban: {
      '323_16102026_0800': { ...base, eventoId: '323_16102026_0800', inicio: t('08:00') },
      '323_16102026_0910': { ...base, eventoId: '323_16102026_0910', inicio: t('09:10') },
    } };
    const A = await subir(h.criarFirebaseFalso(estado, h.criarRelogio(RELOGIO)));
    await proc(A, rel([L('323', t('09:10'))]));
    const c = dec(A, 'NIT-16', '323');
    const checks = [
      eq(titulo(c), '⚠ 323 TEM 2 CARDS', 'título'),
      eq(linha2(c), 'Um de 08:00 e outro de 09:10.', 'linha 2'),
      eq(botoes(c).join(' | '), 'EXCLUIR O DE 08:00 | MANTER OS 2', 'botões (sem pergunta: não é erro da fonte)'),
    ];
    if (c) await clicar(A, c, 'TIRAR');
    checks.push(
      eq(confirmacao(A), '✓ 323 DE 08:00 EXCLUÍDO DO PAINEL. Agora: 1 pendente · 0 normalizados', 'confirmação'),
      ck(naTela(A, '323').length === 1 && naTela(A, '323')[0]?.dataset.inicio === t('09:10'), 'ficou só o de 09:10'),
    );
    await desfazer(A);
    checks.push(ck(naTela(A, '323').length === 2, 'DESFAZER: os dois de volta'));
    reg('NIT-16', 'Dois cards do mesmo semáforo', checks); A.dom.window.close(); }

  // ── Relatório sem novidade, com decisão antiga pendente → ✓ PRONTO + NIT-22 ─
  { const A = await subir(novoFb());
    const R2 = rel([L('530', t('11:00'))]);
    await proc(A, rel([L('973', t('10:54')), L('530', t('11:00'))])); await proc(A, R2);
    const n = toastsTxt(A).length;
    await proc(A, R2);
    reg('NIT-06/22', 'Sem novidade: não repete "RELATÓRIO ALTERADO!"', [
      eq(cabTitulo(A), '⚠ 1 SEMÁFORO ESPERA SUA RESPOSTA', 'linha NIT-22'),
      ck(toastsTxt(A).slice(n).includes('✓ PRONTO · 2 pendentes · 0 normalizados'), `✓ PRONTO (obs: ${toastsTxt(A).slice(n).join(' | ')})`),
      ck(!!dec(A, 'NIT-10', '973'), 'a decisão antiga continua no painel'),
    ]); A.dom.window.close(); }

  // ── NIT-22 + PERGUNTAR TODAS ──────────────────────────────────────────
  { const A = await subir(novoFb()); const cp = capturarCopia(A);
    await proc(A, rel([L('790', t('08:00')), L('973', t('10:54'))]));
    await proc(A, rel([L('790', t('08:00')), L('790', t('09:10')), L('602', '')]));
    const checks = [
      eq(cabTitulo(A), 'RELATÓRIO ALTERADO!', 'título'),
      eq(cabSub(A), '2 semáforos precisam de você', 'subtítulo (o "veio 2 vezes" é azul e não conta)'),
    ];
    const todas = doc(A).querySelector('#nit-integridade-processamento button[data-acao="PERGUNTAR_TODAS"]');
    checks.push(eq(txt(todas), '📋 PERGUNTAR TODAS', 'botão para copiar todas'));
    await clicar(A, dec(A, 'NIT-14', '602'), 'PERGUNTAR');
    checks.push(eq(cabTitulo(A), '⚠ 1 SEMÁFORO ESPERA SUA RESPOSTA', 'NIT-22 depois de responder um'));
    doc(A).querySelector('#nit-integridade-processamento button[data-acao="PERGUNTAR_TODAS"]')?.click(); await h.dormir(200);
    const linhas = (cp.texto || '').split('\n');
    checks.push(
      ck(linhas.length === 3 && linhas.every(l => /^O (973|790|602) /.test(l)), `copia todas, uma por linha (obs: ${JSON.stringify(cp.texto)})`),
      ck(cardsDec(A).filter(x => /^NIT-1[234]$/.test(x.dataset.msg) || x.dataset.msg === 'NIT-10').every(x => x.classList.contains('nd-perguntado')), 'todas ficam PERGUNTADO'),
      ck(!/ESPERA/.test(cabTitulo(A)), `todas perguntadas: ninguém espera resposta do operador (obs: ${cabTitulo(A) || 'sem linha'})`),
    );
    reg('NIT-22', 'Linha fixa e perguntar todas', checks); A.dom.window.close(); }

  // ── Coluna ⚠ DECIDIR e colunas recolhíveis ───────────────────────────
  { const A = await subir(novoFb());
    const board = () => doc(A).querySelector('#tab-semaforo .kanban-board');
    const colunas = () => [...board().children].filter(c => c.classList.contains('kanban-column')).map(c => c.id);
    await proc(A, rel([L('973', t('10:54')), L('530', t('11:00'))]));
    const semColuna = !doc(A).getElementById('coluna-decidir');
    const grade1 = board().style.gridTemplateColumns;
    await proc(A, rel([L('530', t('11:00'))]));
    const col = doc(A).getElementById('coluna-decidir');
    const checks = [
      ck(semColuna, 'sem alerta: a coluna não existe'),
      ck(colunas()[0] === 'coluna-decidir', `com alerta: é a primeira coluna do kanban (obs: ${colunas().join(', ')})`),
      ck(!!col?.querySelector('#nit-integridade-processamento .nd-card[data-codigo="973"]'), 'os cards de decisão estão dentro da coluna'),
      eq(txt(col?.querySelector('.header-text')), '⚠ DECIDIR', 'cabeçalho'),
      eq(txt(doc(A).getElementById('count-decidir')), '1', 'contador'),
      ck(board().style.gridTemplateColumns.split(' ').length > grade1.split(' ').length || /minmax\(260px/.test(board().style.gridTemplateColumns), `a grade do kanban ganhou a coluna (obs: ${board().style.gridTemplateColumns})`),
    ];
    col.querySelector('.kanban-column-header').click(); await h.dormir(100);
    checks.push(ck(col.classList.contains('collapsed') && /^36px/.test(board().style.gridTemplateColumns), 'clicar no cabeçalho recolhe (faixa de 36px)'));
    col.querySelector('.kanban-column-header').click(); await h.dormir(100);
    checks.push(ck(!col.classList.contains('collapsed'), 'clicar de novo expande'));
    col.querySelector('.kanban-column-header').click(); await h.dormir(100);
    await proc(A, rel([L('530', t('11:00')), L('602', '')]));
    checks.push(ck(!doc(A).getElementById('coluna-decidir').classList.contains('collapsed'), 'recolhida + chega decisão nova → abre sozinha'));
    await clicar(A, dec(A, 'NIT-10', '973'), 'TIRAR'); await clicar(A, dec(A, 'NIT-14', '602'), 'PERGUNTAR');
    checks.push(ck(!!doc(A).getElementById('coluna-decidir'), 'com confirmação/DESFAZER na tela, a coluna continua'));
    const sn = doc(A).getElementById('coluna-sem-necessidade');
    checks.push(ck(['coluna-vl', 'coluna-amc', 'coluna-sem-necessidade'].every(id => !doc(A).getElementById(id).classList.contains('collapsed')), 'colunas vazias NÃO recolhem sozinhas (20/10: só manual)'));
    sn.querySelector('.kanban-column-header').click(); await h.dormir(100);
    checks.push(ck(sn.classList.contains('collapsed') && board().style.gridTemplateColumns.includes('36px'), 'clicar recolhe'));
    sn.querySelector('.kanban-column-header').click(); await h.dormir(100);
    checks.push(ck(!sn.classList.contains('collapsed'), 'clicar de novo expande'));
    checks.push(ck(/minmax\(230px/.test(board().style.gridTemplateColumns), 'largura mínima de 230px'));
    const ids4 = ['coluna-espera', 'coluna-vl', 'coluna-amc', 'coluna-sem-necessidade'];
    for (const id of ids4) doc(A).querySelector(`#${id} .kanban-column-header`).click();
    await h.dormir(100);
    checks.push(ck(ids4.every(id => doc(A).getElementById(id).classList.contains('collapsed')), 'AGUARDANDO, VIA LIVRE, AMC e SEM NECESSIDADE recolhem à mão'));
    await proc(A, rel([L('530', t('11:00')), L('602', ''), L('777', t('11:20'))]));
    checks.push(ck(ids4.every(id => doc(A).getElementById(id).classList.contains('collapsed')), 'recolhida pelo operador continua recolhida mesmo chegando card (só o operador abre)'));
    for (const id of ids4) doc(A).querySelector(`#${id} .kanban-column-header`).click();
    await h.dormir(100);
    checks.push(ck(ids4.every(id => !doc(A).getElementById(id).classList.contains('collapsed')), 'e expandem à mão'));
    checks.push(ck(typeof A.w.NitColunas.automatico === 'undefined', 'o recolher automático não existe mais'));
    reg('COLUNA', 'Coluna ⚠ DECIDIR e recolher/expandir', checks); A.dom.window.close(); }

  // ── NIT-02: destaque no botão seguro ──────────────────────────────────
  { const A = await subir(novoFb());
    await h.processar(A, rel([L('9901', '15/10/2026 08:00')], [], '15/10/2026'));
    const ok = doc(A).getElementById('btn-confirmar-generico-ok'), can = doc(A).getElementById('btn-confirmar-generico-cancel');
    const destaqueCancelar = /color-info/.test(can.getAttribute('style') || '') && /transparent/.test(ok.getAttribute('style') || '');
    await h.responderModal(A, false);
    reg('NIT-02 botões', 'Destaque no CANCELAR; volta ao padrão depois', [
      ck(destaqueCancelar, 'CANCELAR em destaque, USAR neutro'),
      ck(/color-danger/.test(ok.getAttribute('style') || ''), 'depois de fechar, o modal genérico volta ao estilo padrão'),
    ]); A.dom.window.close(); }

  // ── LOTE 19/10: 📜 O QUE MUDOU ───────────────────────────────────────
  { const fb = novoFb(); const A = await subir(fb), B = await subir(fb);
    await proc(A, rel([L('973', t('10:54')), L('530', t('11:00')), L('112', t('06:10'))], [L('111', t('06:00'), t('06:40'))]));
    await proc(A, rel([L('530', t('11:05')), L('105', t('11:10'))], [L('111', t('06:00'), t('06:45')), L('112', t('06:10'), t('07:00'))]));
    await clicar(A, dec(A, 'NIT-10', '973'), 'TIRAR'); await h.dormir(300);
    const abrirDiario = async n => { doc(n).getElementById('nit-diario-btn')?.click(); await h.dormir(250);
      return [...doc(n).querySelectorAll('#nit-diario .nit-diario-item')].map(e => txt(e)); };
    const dA = await abrirDiario(A), dB = await abrirDiario(B);
    const tudo = dA.join(' || ');
    reg('DIÁRIO', '📜 O QUE MUDOU consultável e igual nas duas janelas', [
      eq(txt(doc(A).getElementById('nit-diario-btn')), '📜 LINHA DO TEMPO', 'botão no topo'),
      ck(/processou o relatório · 3 pendentes · 2 normalizados/.test(tudo), `entrada do processamento com totais (obs: ${dA[1] || dA[0]})`),
      ck(/＋ Entraram: 105/.test(tudo) && /✓ Normalizaram: 112/.test(tudo), 'novos e normalizados'),
      ck(/⟲ Início corrigido no relatório: 530 \(11:00 → 11:05\)/.test(tudo), 'início corrigido pela fonte'),
      ck(/⟲ Fim corrigido no relatório: 111 \(06:40 → 06:45\)/.test(tudo), 'fim corrigido pela fonte'),
      ck(/⚠ Informações incompletas: 973 não veio/.test(tudo), 'erros da fonte'),
      ck(/973 EXCLUÍDO DO PAINEL/.test(dA[0] || ''), `decisão do operador é a mais recente (obs: ${dA[0]})`),
      ck(dB.length === dA.length && dB.length >= 3, `janela B vê o mesmo diário (${dB.length} entradas)`),
    ]); A.dom.window.close(); B.dom.window.close(); }

  // ── LOTE 19/10: coluna ⚠ DECIDIR igual nas duas janelas ──────────────
  { const fb = novoFb(); const A = await subir(fb), B = await subir(fb);
    await proc(A, rel([L('973', t('10:54')), L('530', t('11:00'))])); await h.dormir(150);
    await proc(A, rel([L('530', t('11:00'))])); await h.dormir(400);
    const cB = dec(B, 'NIT-10', '973');
    await clicar(B, cB, 'MANTER'); await h.dormir(400);
    reg('DECIDIR 2 JANELAS', 'O B vê os cards do A sem processar', [
      ck(!!cB, 'o card 973 aparece na janela B'),
      ck(!dec(A, 'NIT-10', '973'), 'B decidiu → o card some também na janela A'),
    ]); A.dom.window.close(); B.dom.window.close(); }

  // ── DESFAZER depois que o relatório (do outro operador) já mudou o card ─
  { const fb = novoFb(); const A = await subir(fb), B = await subir(fb);
    const R1 = rel([L('973', t('10:54')), L('530', t('11:00'))]);
    await proc(A, R1); await proc(A, rel([L('530', t('11:00'))]));
    await clicar(A, dec(A, 'NIT-10', '973'), 'TIRAR'); await h.dormir(200);
    await proc(B, rel([L('530', t('11:00'))], [L('973', t('10:54'), t('11:30'))])); await h.dormir(300);
    await desfazer(A); await h.dormir(200);
    const n = no(A, '973')[0]?.[1] || {};
    reg('DESFAZER TARDE', 'DESFAZER não desfaz o que o relatório já corrigiu', [
      eq(confirmacao(A), 'ℹ 973 JÁ FOI ATUALIZADO PELO RELATÓRIO. Nada a desfazer. Agora: 1 pendente · 1 normalizado', 'mensagem'),
      ck(n.coluna === 'coluna-normalizados' && n.hora_fim === '11:30' && !n.retirado, 'o card fica como o relatório trouxe'),
      ck(naTela(A, '973')[0]?.closest('#coluna-normalizados') && naTela(B, '973')[0]?.closest('#coluna-normalizados'), 'A e B iguais'),
    ]); A.dom.window.close(); B.dom.window.close(); }

  // ── LOTE 19/10: lembrete ao gerar o relatório com decisão aberta ─────
  { const A = await subir(novoFb());
    await proc(A, rel([L('973', t('10:54')), L('530', t('11:00'))])); await proc(A, rel([L('530', t('11:00'))]));
    doc(A).getElementById('btn-visualizar-relatorio').click(); await h.dormir(200);
    const m = h.modalAberto(A);
    const ok = txt(doc(A).getElementById('btn-confirmar-generico-ok')), can = txt(doc(A).getElementById('btn-confirmar-generico-cancel'));
    await h.responderModal(A, false);
    const fechado = !doc(A).getElementById('modal-relatorio').classList.contains('visible');
    doc(A).getElementById('btn-visualizar-relatorio').click(); await h.dormir(200);
    await h.responderModal(A, true);
    const relTxt = doc(A).getElementById('modal-relatorio-texto').value;
    reg('VER RELATÓRIO', 'Lembrete sem bloquear e relatório limpo', [
      eq(m?.titulo, '⚠ 973 AINDA ESPERA A RESPOSTA DA FONTE.', 'título do lembrete'),
      eq(m?.msg, 'O relatório pode sair diferente do da fonte.', 'mensagem'),
      ck(ok === 'GERAR ASSIM MESMO' && can === 'ESPERAR', `botões (obs: ${ok} / ${can})`),
      ck(fechado, 'ESPERAR: não abre o relatório'),
      ck(doc(A).getElementById('modal-relatorio').classList.contains('visible') && /973/.test(relTxt) && !/confirmar/i.test(relTxt), 'GERAR ASSIM MESMO: abre o relatório, sem marcação'),
    ]); A.dom.window.close(); }

  // ── LOTE 19/10: NORMALIZOU abre a janela de normalizar ───────────────
  { const A = await subir(novoFb());
    const R2 = rel([L('530', t('11:00'))]);
    await proc(A, rel([L('973', t('10:54')), L('530', t('11:00'))])); await proc(A, R2);
    await clicar(A, dec(A, 'NIT-10', '973'), 'NORMALIZOU');
    const aberta = doc(A).getElementById('modal-normalizar').classList.contains('visible');
    doc(A).getElementById('norm-hora-fim').value = '12:30';
    doc(A).getElementById('btn-norm-confirmar').click(); await h.dormir(5800);   // janela de desfazer do normalizar (5 s)
    const n = no(A, '973')[0]?.[1] || {};
    const conf = confirmacao(A);
    await proc(A, R2);
    reg('NORMALIZOU', 'Normalizar pelo card "não veio"', [
      ck(aberta, 'abre a janela de normalizar (o operador informa o fim)'),
      ck(n.coluna === 'coluna-normalizados' && n.hora_fim === '12:30', `normalizado com fim 12:30 (obs: ${n.coluna} ${n.hora_fim})`),
      eq(conf, '✓ 973 NORMALIZADO ÀS 12:30. Agora: 1 pendente · 1 normalizado', 'confirmação'),
      ck(!dec(A, 'NIT-10', '973'), 'mesmo relatório de novo: não pergunta outra vez'),
    ]); A.dom.window.close(); }

  // ── 20/10: normalizado à mão é provisório até a fonte confirmar ──────
  { const fb = novoFb(); const A = await subir(fb), B = await subir(fb);
    const R1 = rel([L('303', t('07:00')), L('530', t('11:00'))]);
    await proc(A, R1);
    naTela(A, '303')[0].querySelector('.btn-card-action.complete').click(); await h.dormir(200);
    const aberta = doc(A).getElementById('modal-normalizar').classList.contains('visible');
    doc(A).getElementById('norm-hora-fim').value = '07:40';
    doc(A).getElementById('btn-norm-confirmar').click(); await h.dormir(5800);
    const tag = txt(naTela(A, '303')[0]?.querySelector('.card-manual')), tagB = txt(naTela(B, '303')[0]?.querySelector('.card-manual'));
    await proc(A, R1);                                       // a fonte ainda diz pendente
    const c17 = dec(A, 'NIT-17', '303');
    const semNit11 = !dec(A, 'NIT-11', '303');
    const continua = naTela(A, '303')[0]?.closest('#coluna-normalizados');
    const nT = toastsTxt(A).length;
    await proc(A, rel([L('530', t('11:00'))], [L('303', t('07:00'), t('07:45'))]));   // a fonte manda o fim
    const n = no(A, '303')[0]?.[1] || {};
    reg('MANUAL PROVISÓRIO', 'Normalizado à mão vale até a fonte; o horário da fonte prevalece', [
      ck(aberta, 'botão ✓ do card abre a janela de normalizar'),
      eq(tag, '✋ normalizado à mão · aguardando a fonte', 'etiqueta no card (A)'),
      eq(tagB, '✋ normalizado à mão · aguardando a fonte', 'etiqueta no card (B)'),
      ck(continua && semNit11, 'fonte ainda diz pendente: o card NÃO volta e ninguém pergunta "voltou atrás"'),
      eq(titulo(c17), 'ℹ 303 NORMALIZADO À MÃO', 'aviso azul'),
      eq(linha2(c17), 'Você normalizou às 07:40. A fonte ainda diz pendente. Nada a fazer: quando a fonte mandar o fim, vale o horário dela.', 'linha 2'),
      ck(c17?.classList.contains('nd-azul') && !/precisam|ESPERA/.test(cabTitulo(A) + cabSub(A)), 'azul: não conta como pendência do operador'),
      ck(n.hora_fim === '07:45' && !n.normManual, `a fonte mandou o fim: vale 07:45 e deixa de ser provisório (obs: ${n.hora_fim})`),
      eq(txt(naTela(A, '303')[0]?.querySelector('.card-retificado')), '⟲ fim corrigido 07:40 → 07:45', 'etiqueta do fim corrigido'),
      ck(!naTela(A, '303')[0]?.querySelector('.card-manual') && !dec(A, 'NIT-17', '303'), 'etiqueta ✋ e aviso somem'),
      ck(toastsTxt(A).slice(nT).some(x => /PRONTO/.test(x)), 'sem decisão nova: ✓ PRONTO'),
    ]); A.dom.window.close(); B.dom.window.close(); }

  // ── 20/10: REABRIR no aviso azul (o operador se enganou) ─────────────
  { const A = await subir(novoFb());
    const R1 = rel([L('303', t('07:00')), L('530', t('11:00'))]);
    await proc(A, R1);
    naTela(A, '303')[0].querySelector('.btn-card-action.complete').click(); await h.dormir(200);
    doc(A).getElementById('norm-hora-fim').value = '07:40';
    doc(A).getElementById('btn-norm-confirmar').click(); await h.dormir(5800);
    await proc(A, R1);
    await clicar(A, dec(A, 'NIT-17', '303'), 'REABRIR');
    const n = no(A, '303')[0]?.[1] || {};
    const conf = confirmacao(A);
    await desfazer(A);
    const n2 = no(A, '303')[0]?.[1] || {};
    reg('MANUAL REABRIR', 'Desfazer a normalização manual pelo aviso azul', [
      eq(conf, '✓ 303 REABRIU. Agora: 2 pendentes · 0 normalizados', 'confirmação'),
      ck(n.coluna !== 'coluna-normalizados' && !n.normManual, 'voltou a pendente, sem a marca de manual'),
      ck(n2.coluna === 'coluna-normalizados' && n2.normManual && n2.hora_fim === '07:40', 'DESFAZER: normalizado à mão de novo, 07:40'),
    ]); A.dom.window.close(); }

  // ── LOTE 19/10: excluídos em dias anteriores são apagados de vez ─────
  { const ontem = Date.parse('2026-10-15T20:00:00-03:00');
    const base = { codigo: '444', dataReferencia: '15/10/2026', coluna: 'coluna-espera', status: 'PENDENTE', problema: 'APAGADO', endereco: 'RUA 444', tipo: 'INVESTIGANDO', inicio: '15/10/2026 08:00' };
    const estado = { kanban: { '444_151020260800': { ...base, eventoId: '444_151020260800', retirado: { ts: ontem, por: 'X', msg: 'NIT-10' } },
                               '445_161020260800': { ...base, codigo: '445', dataReferencia: D, inicio: t('08:00'), eventoId: '445_161020260800', retirado: { ts: Date.parse('2026-10-16T09:00:00-03:00'), por: 'X', msg: 'NIT-10' } } } };
    const A = await subir(h.criarFirebaseFalso(estado, h.criarRelogio(RELOGIO)));
    await proc(A, rel([L('530', t('11:00'))])); await h.dormir(300);
    const k = A.fb.estado().kanban || {};
    reg('LIMPEZA', 'Excluído ontem é apagado; excluído hoje fica (DESFAZER)', [
      ck(!k['444_151020260800'], 'excluído em dia anterior: apagado do banco'),
      ck(!!k['445_161020260800'], 'excluído hoje: continua (ainda dá para desfazer)'),
    ]); A.dom.window.close(); }

  // ── NIT-30..34 salvamento ─────────────────────────────────────────────
  { const ind = nit => txt(doc(nit).getElementById('nit-gravacao-status'));
    const R1 = rel([L('9901', t('08:00')), L('9902', t('08:30'))]);
    const checks = [];
    { const fb = novoFb(); const A = await subir(fb); await proc(A, R1); await h.dormir(1700);
      checks.push(eq(ind(A), '✓ SALVO', 'NIT-30')); A.dom.window.close(); }
    { const fb = novoFb(); const A = await subir(fb); fb.controle.atrasoMs = 3000; await proc(A, R1); await h.dormir(1800);
      checks.push(eq(ind(A), '⏳ ENVIANDO… Não feche a aba.', 'NIT-31')); await h.dormir(1500); A.dom.window.close(); }
    { const fb = novoFb(); const A = await subir(fb); fb.controle.definirOnline(false); await h.dormir(100);
      checks.push(eq(ind(A), '📵 SEM INTERNET. Não feche a aba.', 'NIT-32 (já ao cair)'));
      await proc(A, R1); await h.dormir(1800);
      checks.push(eq(ind(A), '📵 SEM INTERNET. Não feche a aba.', 'NIT-32 (com fila)'));
      fb.controle.definirOnline(true); await h.dormir(300);
      checks.push(eq(ind(A), '✓ SALVO', 'internet voltou → ✓ SALVO')); A.dom.window.close(); }
    { const fb = novoFb(); const A = await subir(fb); await proc(A, R1); await h.dormir(200);
      fb.controle.codigoRecusa = 'WRITE_CANCELED'; fb.controle.recusar = p => /kanban\/9902_/.test(p);
      await proc(A, rel([L('9901', t('08:00')), L('9902', t('08:40'))])); await h.dormir(300);
      checks.push(eq(ind(A), '❌ 9902 NÃO SALVOU. Avise o desenvolvedor do NIT.', 'NIT-33 indicador'),
                  ck(toastsTxt(A).includes('❌ 9902 NÃO SALVOU. Avise o desenvolvedor do NIT.'), 'NIT-33 toast'));
      A.dom.window.close(); }
    { const fb = novoFb(); const A = await subir(fb); await proc(A, R1); await h.dormir(200);
      fb.controle.recusar = p => /kanban\/9902_/.test(p);
      await proc(A, rel([L('9901', t('08:00')), L('9902', t('08:40'))])); await h.dormir(300);
      checks.push(eq(ind(A), '❌ SEU LOGIN NÃO TEM ACESSO. Fale com o gestor.', 'NIT-34 (PERMISSION_DENIED)'));
      A.dom.window.close(); }
    reg('NIT-30..34', 'Salvamento', checks); }

  // ── Removidos ─────────────────────────────────────────────────────────
  { const fb = novoFb(); const A = await subir(fb);
    await proc(A, rel([L('9901', t('08:00'))]));
    await proc(A, rel([L('790', t('08:00')), L('790', t('09:10')), L('602', '')]));
    const p = txt(painelDec(A));
    reg('REMOVIDOS', 'Textos e botões que saíram', [
      ck(!doc(A).getElementById('nit-recuperar-relatorio'), 'sem botão "Recuperar último relatório"'),
      ck(A.w.localStorage.getItem('nit-ultimo-relatorio-v1') == null, 'não guarda relatório no computador'),
      ck(!/ABERTAS|Conferir no relatório|O NIT identificou|Conferência|divergên|AVISEI/i.test(p), `painel sem textos antigos (obs: ${p.slice(0, 160)})`),
      ck(!toastsTxt(A).some(x => /Conferir no relatório|Registrado:|nova\(s\) adicionada|conferido/.test(x)), `sem toast antigo/duplicado (obs: ${toastsTxt(A).join(' | ')})`),
    ]); A.dom.window.close(); }

  const resumo = R.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
  console.log('RESUMO 13.2', resumo);
  fs.writeFileSync(path.join(__dirname, 'bateria-13-2-resultado.json'), JSON.stringify(R, null, 2));
  process.exit(0);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
