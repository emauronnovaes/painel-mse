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
