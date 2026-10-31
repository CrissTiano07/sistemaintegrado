// Monta o texto do relatório CEMOB a partir das linhas da BancoFalhas do CTA (valores exibidos A..Q).
// Regra (conferida com o relatório real de 23/10): entra no dia D toda linha com início ≤ fim do dia D
// e (fim ≥ início do dia D, ou sem fim). Pendente = sem fim.
function _ord(d, h) { const m = String(d).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); const t = String(h).match(/(\d{1,2})\D(\d{2})/);
  if (!m) return null; return `${m[3]}${m[2].padStart(2,'0')}${m[1].padStart(2,'0')}${t ? t[1].padStart(2,'0') + t[2] : '0000'}`; }
function montarRelatorio(linhas, D, ate) {           // D = 'dd/mm/yyyy'; ate = 'HH:MM' (opcional: só o que já existia até essa hora)
  const [dd, mm, yy] = D.split('/'); const d0 = `${yy}${mm}${dd}0000`, d1 = `${yy}${mm}${dd}2359`;
  const corte = ate ? `${yy}${mm}${dd}${ate.replace(':', '')}` : d1;
  const T = '\t', P = [], N = [], conferir = [];
  let plantonista = '';
  for (const r of linhas) {
    const scn = String(r[0]).trim(); if (!scn) continue;
    const ini = _ord(r[6], r[7]); if (!ini || ini > corte) continue;
    const temFim = String(r[9]).trim() !== '' || String(r[10]).trim() !== '';
    let fim = temFim ? _ord(r[9], r[10]) : null;
    if (temFim && (!fim || !/\d{1,2}\D\d{2}/.test(String(r[10])))) { conferir.push(`${scn} início ${r[6]} ${r[7]}: fim ilegível "${r[9]} ${r[10]}"`); continue; }
    if (fim && fim > corte) fim = null;                // depois do corte: ainda estava pendente
    if (fim && fim < d0) continue;                     // encerrada antes do dia
    const item = { scn, end: String(r[1]).trim(), prob: String(r[4]).trim(), causa: String(r[5]).trim(),
      ini: `${String(r[6]).trim()} ${String(r[7]).trim()}`, fim: fim ? `${String(r[9]).trim()} ${String(r[10]).trim()}` : '',
      obs: String(r[16] || '').replace(/\r?\n/g, ' ').trim(), ord: ini };
    (fim ? N : P).push(item);
    if (String(r[3]).trim() && (String(r[2]).trim() === D || !plantonista)) plantonista = String(r[3]).trim();
  }
  const porIni = (a, b) => a.ord.localeCompare(b.ord);
  P.sort(porIni); N.sort(porIni);
  const furtos = P.filter(i => /FURTO/i.test(i.causa)).length, invest = P.filter(i => /INVESTIG/i.test(i.causa)).length;
  const cab = (s) => s.charAt(0) + s.slice(1).toLowerCase();
  const L = [];
  L.push(`🚦🚦 *PLANTÃO CEMOB* 🚦🚦${T}${D}${T}`);
  L.push(`*PLANTONISTA* ${T}${plantonista ? cab(plantonista) : ''}${T}`);
  L.push(`${T}${T}`);
  L.push(`*Ocorrências de Apagados/Piscantes* ⚠️${T}${T}(${P.length + N.length})`);
  L.push(`${T}${T}`);
  L.push(`*Pendentes*    ${T}${T}(${P.length})`);
  L.push(`*Furtos*     ${T}${T}(${furtos})`);
  L.push(`*Outros motivos*     ${T}${T}(${P.length - furtos - invest})`);
  L.push(`*Investigando*     ${T}${T}(${invest})`);
  L.push(`${T}${T}`);
  L.push(`*Normalizados*     ${T}${T}(${N.length})`);
  L.push(`${T}${T}`, `${T}${T}`, `${T}${T}`);
  L.push(`*PENDENTES*❌${T}${T}`, `${T}${T}`);
  const linha = i => `${i.causa}${T}*🚦${T}${i.scn}${T}🚦${T}${i.end}${T}●${T}${i.prob}${T}●*${T}Início:${T}${i.ini}`;
  for (const i of P) { L.push(`${linha(i)}${T}${T}${T}${T}${T}${i.obs}${T}"`, `"${T}${T}${T}`, `${T}${T}`); }
  L.push(`*NORMALIZADOS*✅${T}${T}`, '');
  for (const i of N) { L.push(`${linha(i)}${T}Fim:${T}${i.fim}${T}"`, `"${T}*Obs:*${T}${i.obs}${T}"`, `"${T}`); }
  return { texto: L.join('\n'), pendentes: P.length, normalizados: N.length, codigosP: P.map(i => i.scn), codigosN: N.map(i => i.scn), conferir,
    itens: P.concat(N).map(i => ({ c: i.scn, i: i.ini, f: i.fim })) };
}
if (typeof module !== 'undefined') module.exports = { montarRelatorio };
