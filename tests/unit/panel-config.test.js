const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../../prototipo/lib/panel-config.js');

const obras = [{ id: 106 }, { id: 110 }];
const setores = [{ num: 1, slug: 'curva-s', label: 'Curva S' }];

test('validarConfiguracao aceita configuração válida', () => {
  assert.equal(config.validarConfiguracao(obras, setores), true);
});
test('SETORES expõe a ordem declarativa do painel', () => {
  assert.equal(config.SETORES.length, 9);
  assert.equal(config.SETORES[0].slug, 'curva-s');
  assert.equal(config.SETORES[8].slug, 'tour-360');
});
test('OBRAS preserva contratos e curvas alternativas', () => {
  assert.equal(config.OBRAS.length, 7);
  assert.equal(config.OBRAS.find(obra => obra.id === 106).origemCP, 'CP029');
  assert.deepEqual(config.OBRAS.find(obra => obra.id === 107).curvas.map(curva => curva.label), ['Estudo', 'PPU']);
  assert.equal(config.OBRAS.find(obra => obra.id === 91).curvas[0].label, 'Take-Off');
  assert.equal(config.OBRAS.find(obra => obra.id === 114).origemCP, undefined);
});
test('configurações de apresentação preservam foto, tour e ortofoto', () => {
  assert.equal(config.OBRA_FOTOS[106], 'assets/images/cnpem-faseado.jpg');
  assert.match(config.OBRA_TOUR_360[106], /^https:\/\/visi\.constructin\.com\.br/);
  assert.deepEqual(config.OBRA_ORTOFOTO[94], { dzi: 'assets/ortofoto-porto/ortofoto.dzi', data: '2026-08-25' });
});
test('configurações de Suprimentos preservam escopo e exportação', () => {
  assert.equal(config.OBRAS_SUPRIMENTOS_VALIDADAS.has(114), true);
  assert.equal(config.OBRAS_STATUS_MANUAL_DESATIVADO.has(114), true);
  assert.equal(config.NIVEL_EXPORTACAO_GRAFICOS_POR_OBRA[107], 'area');
  assert.equal(config.OBRAS_SEM_EXPORTACAO_GRAFICOS.has(94), true);
});
test('vocabulário de status mantém opções e ordem do fluxo', () => {
  assert.deepEqual(config.STATUS_MANUAL_OPCOES, ['Em cotação', 'Comprado Parcial', 'Comprado', 'Entregue Parcial', 'Entregue']);
  assert.equal(config.ORDEM_STATUS_RMI[0], 'Atrasado');
  assert.equal(config.ORDEM_STATUS_RMI.at(-1), 'Entregue');
});
test('validarConfiguracaoSuprimentos rejeita obra desconhecida e tipos inválidos', () => {
  assert.equal(config.validarConfiguracaoSuprimentos({ 106: { escoposPermitidos: [] } }, obras), true);
  assert.throws(() => config.validarConfiguracaoSuprimentos({ 999: {} }, obras), /obra desconhecida/);
  assert.throws(() => config.validarConfiguracaoSuprimentos({ 106: { escoposExcluidos: 'INDIRETOS' } }, obras), /escoposExcluidos/);
});
test('validarConfiguracao rejeita IDs de obra duplicados', () => {
  assert.throws(() => config.validarConfiguracao([{ id: 106 }, { id: 106 }], setores), /IDs de obra duplicados/);
});
test('validarConfiguracao rejeita slugs inválidos ou duplicados', () => {
  assert.throws(() => config.validarConfiguracao(obras, [{ num: 1, slug: 'Curva S', label: 'Curva S' }]), /slug de setor inválido/);
  assert.throws(() => config.validarConfiguracao(obras, [{ num: 1, slug: 'curva-s', label: 'A' }, { num: 2, slug: 'curva-s', label: 'B' }]), /slugs de setor duplicados/);
});
