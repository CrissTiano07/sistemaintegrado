// Gerador de "mundo" para a bateria de estresse (13.2).
// Simula os semáforos de verdade ao longo do dia e produz o relatório CEMOB
// cumulativo de cada momento, com os erros que a fonte costuma cometer.
// Tudo é determinístico a partir de uma semente (para reproduzir qualquer falha).

const T = '\t';

function rng(semente) {               // mulberry32
  let a = semente >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const p2 = n => String(n).padStart(2, '0');
// minutos desde 00:00 do dia 0 → 'dd/mm/aaaa hh:mm'
function quando(base, min) {
  const d = new Date(Date.UTC(base.a, base.m - 1, base.d) + min * 60000);
  return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}
const dataDe = (base, min) => quando(base, min).slice(0, 10);
const isoDe = (base, min) => { const s = quando(base, min); return `${s.slice(6, 10)}-${s.slice(3, 5)}-${s.slice(0, 2)}T${s.slice(11)}:00`; };

const linha = ({ cod, ini, fim, tipo = 'INVESTIGANDO', prob = 'APAGADO' }) =>
  `${tipo}${T}*🚦${T}${cod}${T}🚦${T}RUA ${cod} & AV ESTRESSE${T}●${T}${prob}${T}●*${T}Início:${T}${ini || ''}${fim ? `${T}Fim:${T}${fim}` : `${T}${T}`}${T}"\n"${T}\n`;
const montar = (data, pend, norm) =>
  `*🚦PLANTÃO CEMOB*${T}${data}${T}\n*PLANTONISTA* ${T}ESTRESSE${T}\n${T}${T}\n*PENDENTES*❌${T}${T}\n\n` +
  pend.map(linha).join('') + `${T}${T}\n*NORMALIZADOS*✅${T}${T}\n\n` + norm.map(linha).join('');

class Mundo {
  constructor(semente, { codigos = 20, base = { a: 2026, m: 10, d: 18 }, inicioMin = 6 * 60 } = {}) {
    this.r = rng(semente);
    this.base = base;
    this.agora = inicioMin;
    this.cods = Array.from({ length: codigos }, (_, i) => String(1001 + i));
    this.ocs = [];                      // { cod, ini (min), fim (min|null) }
    // começa o dia com alguns abertos
    for (const c of this.cods) if (this.r() < 0.25) this.ocs.push({ cod: c, ini: this.agora - Math.floor(this.r() * 120) - 5, fim: null });
  }
  _aberta(c) { return this.ocs.find(o => o.cod === c && o.fim == null); }
  avancar(min = 30) {
    const fimJanela = this.agora + min;
    for (const c of this.cods) {
      const ab = this._aberta(c);
      if (ab && this.r() < 0.3) ab.fim = Math.max(ab.ini + 1, fimJanela - Math.floor(this.r() * (min - 1)) - 1);
      else if (!ab && this.r() < 0.12) {
        const ultimo = this.ocs.filter(o => o.cod === c).reduce((m, o) => Math.max(m, o.fim || 0), 0);
        const ini = Math.max(ultimo + 1, this.agora + 1 + Math.floor(this.r() * (min - 2)));
        if (ini < fimJanela) this.ocs.push({ cod: c, ini, fim: null });
      }
    }
    this.agora = fimJanela;
  }
  // relatório limpo do momento: o dia de hoje é cumulativo; pendências de dias anteriores continuam
  relatorioLimpo() {
    const hoje = dataDe(this.base, this.agora);
    const pend = [], norm = [];
    for (const o of this.ocs.slice().sort((a, b) => a.ini - b.ini)) {
      if (o.fim == null) pend.push({ cod: o.cod, ini: quando(this.base, o.ini) });
      else if (dataDe(this.base, o.fim) === hoje) norm.push({ cod: o.cod, ini: quando(this.base, o.ini), fim: quando(this.base, o.fim) });
    }
    return { data: hoje, pend, norm };
  }
  iso() { return isoDe(this.base, this.agora); }
  // ocorrência encerrada num dia anterior (o relatório de hoje não traz mais o fim)
  fechouOntem(cod) { const hj = this.hoje(); return this.ocs.some(o => o.cod === cod && o.fim != null && dataDe(this.base, o.fim) !== hj); }
  hoje() { return dataDe(this.base, this.agora); }
  ontem() { return dataDe(this.base, this.agora - 24 * 60); }

  // Erros da fonte. Os "temporários" valem só para este relatório; a "retificação" muda a verdade.
  mutar(rel, tipo, conhecidos = null) {
    const r = this.r, m = JSON.parse(JSON.stringify(rel));
    // conhecidos: linhas que o NIT já viu (cod|ini) — erro em linha nunca vista é invisível para qualquer sistema
    const pega = arr0 => { const arr = conhecidos ? arr0.filter(x => conhecidos.has(`${x.cod}|${x.ini}`)) : arr0; return arr.length ? arr[Math.floor(r() * arr.length)] : null; };
    const somaMin = (s, k) => { const [d, h] = s.split(' '); const [dd, mm, aa] = d.split('/').map(Number); const [hh, mi] = h.split(':').map(Number);
      const t = new Date(Date.UTC(aa, mm - 1, dd, hh, mi) + k * 60000); return `${p2(t.getUTCDate())}/${p2(t.getUTCMonth() + 1)}/${t.getUTCFullYear()} ${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}`; };
    const pegaQualquer = arr => arr.length ? arr[Math.floor(r() * arr.length)] : null;
    let d = null;
    switch (tipo) {
      case 'omitir': { const lista = r() < 0.5 && m.pend.length ? m.pend : m.norm; const x = pega(lista); if (x) { lista.splice(lista.indexOf(x), 1); d = `omitiu ${x.cod}`; } break; }
      case 'duplicar': { const x = pega(m.pend); if (x && x.ini) { m.pend.push({ cod: x.cod, ini: somaMin(x.ini, 7) }); d = `duplicou ${x.cod}`; } break; }
      case 'semInicio': { const x = pega(m.pend); if (x) { x.ini = ''; d = `sem início ${x.cod}`; } break; }
      case 'fimAntes': { const x = pega(m.norm); if (x) { x.fim = somaMin(x.ini, -15); d = `fim antes do início ${x.cod}`; } break; }
      case 'apagouFim': { const x = pega(m.norm); if (x) { m.norm.splice(m.norm.indexOf(x), 1); m.pend.push({ cod: x.cod, ini: x.ini }); d = `apagou o fim ${x.cod}`; } break; }
      case 'retificar': {   // a fonte corrige o início de uma aberta (vira verdade)
        const abertas = this.ocs.filter(o => o.fim == null);
        const o = pegaQualquer(abertas);
        if (o) { o.ini = o.ini + (r() < 0.5 ? 10 : -10); const lim = this.ocs.filter(x => x.cod === o.cod && x !== o).reduce((mx, x) => Math.max(mx, x.fim || 0), 0); if (o.ini <= lim) o.ini = lim + 1; d = `retificou início ${o.cod}`; return { rel: this.relatorioLimpo(), d, permanente: true }; }
        break;
      }
      case 'corrigirFim': {  // a fonte corrige o fim de uma normalizada (vira verdade)
        const fechadas = this.ocs.filter(o => o.fim != null && dataDe(this.base, o.fim) === this.hoje());
        const o = pegaQualquer(fechadas);
        if (o) { const prox = this.ocs.filter(x => x.cod === o.cod && x.ini > o.ini).reduce((mn, x) => Math.min(mn, x.ini), Infinity);
          const novo = o.fim + 5; if (novo < prox && novo <= this.agora) { o.fim = novo; d = `corrigiu fim ${o.cod}`; return { rel: this.relatorioLimpo(), d, permanente: true }; } }
        break;
      }
    }
    return { rel: m, d, permanente: false };
  }
}

module.exports = { Mundo, montar, rng, quando };
