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
  function criticidadeBase(dataLimite, agora = new Date()) {
    if (!(dataLimite instanceof Date) || Number.isNaN(dataLimite.getTime())) return { nivel: 'desconhecido', label: '—' };
    const diasRestantes = Math.ceil((dataLimite.getTime() - agora.getTime()) / 86400000);
    if (diasRestantes <= 0) return { nivel: 'urgente', label: 'Urgente' };
    if (diasRestantes <= 7) return { nivel: 'alta', label: 'Alta' };
    if (diasRestantes <= 30) return { nivel: 'moderada', label: 'Moderada' };
    return { nivel: 'baixa', label: 'Baixa' };
  }
  function monitoramentoBase(dataConclusao, statusLabel, criticidade, hoje = new Date()) {
    if (!(statusLabel || '').toLowerCase().includes('abert') || !dataConclusao) return null;
    const limite = new Date(`${dataConclusao}T00:00:00`);
    if (Number.isNaN(limite.getTime())) return null;
    hoje = new Date(hoje); hoje.setHours(0, 0, 0, 0);
    const diasRestantes = Math.round((limite - hoje) / 86400000);
    if (diasRestantes < 0) return { texto: 'Atrasado', ordem: 0 };
    if (diasRestantes <= 7 || (criticidade || '').trim().toLowerCase() === 'alta') return { texto: 'Em risco', ordem: 1 };
    return { texto: 'No prazo', ordem: 2 };
  }
  return Object.freeze({ parseValNum, parseDataFlexivel, normalizarNomeParaMatch, corDesvio, aderenciaSemanal, calcularMetaSemana, criticidadeBase, monitoramentoBase });
}));
