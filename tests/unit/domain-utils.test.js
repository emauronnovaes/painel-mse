const test = require('node:test');
const assert = require('node:assert/strict');
const domain = require('../../prototipo/lib/domain-utils.js');

test('parseValNum aceita números e decimal brasileiro simples', () => {
  assert.equal(domain.parseValNum(12.5), 12.5);
  assert.equal(domain.parseValNum('12,5'), 12.5);
  assert.equal(domain.parseValNum(''), null);
  assert.equal(domain.parseValNum('não-numérico'), null);
});
test('parseDataFlexivel interpreta ISO e data brasileira', () => {
  for (const data of ['2026-09-04', '04/09/2026']) {
    const parsed = domain.parseDataFlexivel(data);
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 8);
    assert.equal(parsed.getDate(), 4);
  }
  assert.equal(domain.parseDataFlexivel(null), null);
});
test('normalizarNomeParaMatch remove acentos sem alterar nome exibido', () => {
  assert.equal(domain.normalizarNomeParaMatch('  João da Silva '), 'JOAO DA SILVA');
  assert.equal(domain.normalizarNomeParaMatch(null), '');
});
test('corDesvio mantém limiares do painel', () => {
  assert.equal(domain.corDesvio(0), 'green');
  assert.equal(domain.corDesvio(-5), 'amber');
  assert.equal(domain.corDesvio(-5.01), 'red');
});
test('aderenciaSemanal aplica a convenção de 100% quando nada foi previsto', () => {
  assert.equal(domain.aderenciaSemanal({ SemPrevisto: 0, SemRealizado: 0 }), 100);
  assert.equal(domain.aderenciaSemanal({ SemPrevisto: 0, SemRealizado: 2 }), null);
  assert.equal(domain.aderenciaSemanal({ SemPrevisto: 4, SemRealizado: 2 }), 50);
});
test('calcularMetaSemana usa o último corte realizado antes da janela', () => {
  const curva = [
    { semana: 1, data: '2026-08-01', Realizado: 0.2, Previsto: 0.2 },
    { semana: 2, data: '2026-08-08', Realizado: 0.3, Previsto: 0.4 },
    { semana: 3, data: '2026-08-15', Realizado: 0.4, Previsto: 1 },
  ];
  const meta = domain.calcularMetaSemana(curva, new Date(2026, 7, 10), 1.15);
  assert.equal(meta.acumulado, 30);
  assert.equal(meta.metaSemanal, 70);
  assert.equal(meta.metaDiaria, 14);
});
