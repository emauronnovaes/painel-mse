const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../../prototipo/lib/panel-config.js');

const obras = [{ id: 106 }, { id: 110 }];
const setores = [{ num: 1, slug: 'curva-s', label: 'Curva S' }];

test('validarConfiguracao aceita configuração válida', () => {
  assert.equal(config.validarConfiguracao(obras, setores), true);
});
test('validarConfiguracao rejeita IDs de obra duplicados', () => {
  assert.throws(() => config.validarConfiguracao([{ id: 106 }, { id: 106 }], setores), /IDs de obra duplicados/);
});
test('validarConfiguracao rejeita slugs inválidos ou duplicados', () => {
  assert.throws(() => config.validarConfiguracao(obras, [{ num: 1, slug: 'Curva S', label: 'Curva S' }]), /slug de setor inválido/);
  assert.throws(() => config.validarConfiguracao(obras, [{ num: 1, slug: 'curva-s', label: 'A' }, { num: 2, slug: 'curva-s', label: 'B' }]), /slugs de setor duplicados/);
});
