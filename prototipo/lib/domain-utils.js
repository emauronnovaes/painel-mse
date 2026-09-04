(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MSEDomain = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  function parseValNum(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isNaN(number) ? null : number;
  }
  function parseDataFlexivel(value) {
    if (!value) return null;
    const text = String(value).slice(0, 10);
    if (text.includes('/')) {
      const [day, month, yearRaw] = text.split('/');
      const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
    if (text.includes('-')) {
      const [year, month, day] = text.split('-');
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return null;
  }
  function normalizarNomeParaMatch(value) {
    return String(value || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function corDesvio(percentual) {
    if (percentual >= 0) return 'green';
    if (percentual >= -5) return 'amber';
    return 'red';
  }
  function aderenciaSemanal(row) {
    const previsto = row.SemPrevisto;
    const realizado = row.SemRealizado;
    if (previsto == null && realizado == null) return null;
    if (!previsto) return !realizado ? 100 : null;
    return (realizado || 0) / previsto * 100;
  }
  function calcularMetaSemana(linhasCurva, janelaInicio, fator = 1.15) {
    if (!linhasCurva || linhasCurva.length === 0) return { acumulado: null, metaSemanal: null, metaDiaria: null };
    const comReal = linhasCurva.filter(row => (row.Realizado || 0) > 0);
    const antes = comReal.filter(row => {
      const data = parseDataFlexivel(row.data);
      return data && data < janelaInicio;
    });
    const corte = antes.length ? antes[antes.length - 1] : (comReal[0] || null);
    if (!corte) return { acumulado: null, metaSemanal: null, metaDiaria: null };
    const acumulado = corte.Realizado * 100;
    const previsto100 = linhasCurva.find(row => (row.Previsto || 0) >= 0.999) || linhasCurva[linhasCurva.length - 1];
    const semanasFaltantes = Math.max(0, (previsto100.semana || 0) - (corte.semana || 0));
    if (acumulado >= 100) return { acumulado, metaSemanal: 0, metaDiaria: 0 };
    const saldo = 100 - acumulado;
    let metaSemanal = semanasFaltantes <= 0 ? saldo * fator : (saldo / semanasFaltantes) * fator;
    metaSemanal = Math.min(metaSemanal, saldo);
    return { acumulado, metaSemanal, metaDiaria: metaSemanal / 5 };
  }
  return Object.freeze({ parseValNum, parseDataFlexivel, normalizarNomeParaMatch, corDesvio, aderenciaSemanal, calcularMetaSemana });
}));
