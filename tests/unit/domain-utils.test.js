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
test('criticidadeBase classifica prazo nos quatro estados', () => {
  const hoje = new Date(2026, 8, 4, 12);
  assert.equal(domain.criticidadeBase(new Date(2026, 8, 3, 12), hoje).nivel, 'urgente');
  assert.equal(domain.criticidadeBase(new Date(2026, 8, 10, 12), hoje).nivel, 'alta');
  assert.equal(domain.criticidadeBase(new Date(2026, 8, 20, 12), hoje).nivel, 'moderada');
  assert.equal(domain.criticidadeBase(new Date(2026, 10, 1, 12), hoje).nivel, 'baixa');
});
test('monitoramentoBase só calcula restrições abertas e prioriza atraso', () => {
  const hoje = new Date(2026, 8, 4, 12);
  assert.equal(domain.monitoramentoBase('2026-09-10', 'Concluída', 'Alta', hoje), null);
  assert.equal(domain.monitoramentoBase('2026-09-03', 'Aberto', 'Baixa', hoje).texto, 'Atrasado');
  assert.equal(domain.monitoramentoBase('2026-09-20', 'Aberto', 'Alta', hoje).texto, 'Em risco');
  assert.equal(domain.monitoramentoBase('2026-10-01', 'Aberto', 'Baixa', hoje).texto, 'No prazo');
});
test('statusItemFolha aplica precedência de finalizado e status da requisição', () => {
  const hoje = new Date(2026, 8, 4, 12);
  assert.equal(domain.statusItemFolha({ finalizado: true }, [], hoje), 'Entregue');
  assert.equal(domain.statusItemFolha({ dataNecessidadeCompra: '2026-09-03' }, [], hoje), 'Atrasado');
  assert.equal(domain.statusItemFolha({ dataNecessidadeCompra: '2026-09-03' }, [{ status_requisicao: 'Aprovado', data_cadastro: '2026-09-01' }], hoje), 'Comprado');
  assert.equal(domain.statusItemFolha({}, [{ status_requisicao: 'EmAprovacao', data_cadastro: '2026-09-01' }], hoje), 'Em cotação');
});
test('statusAutomaticoItem agrega entrega parcial e compra', () => {
  const reqs = folha => folha.req ? [folha.req] : [];
  assert.equal(domain.statusAutomaticoItem([{ finalizado: true }, { finalizado: false }], reqs), 'Entregue Parcial');
  assert.equal(domain.statusAutomaticoItem([{ req: { status_requisicao: 'Comprado', data_cadastro: '2026-09-01' } }, { finalizado: false }], reqs), 'Comprado');
});
