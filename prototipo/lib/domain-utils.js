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
  return Object.freeze({ parseValNum, parseDataFlexivel, normalizarNomeParaMatch, corDesvio });
}));
