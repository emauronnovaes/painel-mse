const { test, expect } = require('@playwright/test');
const { semLogin } = require('./helpers');

const tarefa = { id: 9001, id_obra: 106, id_eap: 64, edt: '1.1', tarefa: 'Tarefa atual MySQL',
  disciplina: 'Civil', local: 'Bloco teste', ponderacao_reais: 1000, ponderacao_hht: 80,
  avanco_atual: 0.5, desvio: -0.1, data_inicio: '2026-09-01', data_termino: '2026-09-30', qtd: 100, unidade: 'm' };
const card = { card_id: '9001', id_obra: 106, id_eap_tabela: 64, nome_obra: 'CNPEM-FASEADA',
  edt: '1.1', tarefa: tarefa.tarefa, responsavel_encarregado: 'ENCARREGADO TESTE' };
const dia = '2026-09-18';
const apontamento = { id: 9001, data_do_input: dia, avanco_diario: 5, meta_diaria: 10, status_qualidade: 'Bom', ADERENCIA_LINEAR: 0.5 };

async function preparar(page, fail) {
  await semLogin(page);
  await page.clock.setFixedTime(new Date('2026-09-21T15:00:00Z'));
  const calls = [], legacy = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/rest/v1/**', route => {
    legacy.push(new URL(route.request().url()));
    return route.fulfill({ json: [] });
  });
  await page.route('**/functions/v1/efetivo/**', route => route.fulfill({ json: [] }));
  await page.route('**/eap/**', route => {
    const url = new URL(route.request().url()); calls.push(url);
    const endpoint = url.pathname.split('/').pop();
    const dataset = {
      cards: [card], tarefas: [tarefa], apontamentos: [apontamento],
      alocacoes: [{ tarefa_id: 9001, funcionario_id: 1, funcionario_nome: 'PESSOA TESTE', nome_funcao: 'Função teste', data_consulta: dia }],
      aderencia: [{ OBRA: card.nome_obra, 'RESPONSÁVEL': card.responsavel_encarregado, DATA: dia, EDT: '1.1', ADERENCIA_LINEAR: 0.5 }],
      'indices-financeiros': { indices: [], falhas: [] },
    };
    return route.fulfill({ status: endpoint === fail ? 503 : 200, json: endpoint === fail ? { erro: 'Indisponivel' } : dataset[endpoint] || [] });
  });
  return { calls, legacy, errors };
}

test('Desvios usa EAP MySQL, sem restaurar tarefas antigas do Supabase', async ({ page }) => {
  const state = await preparar(page);
  await page.goto('/#/obra/106/desvios');
  await expect.poll(() => state.calls.some(u => u.pathname.endsWith('/tarefas')), { timeout: 30000 }).toBeTruthy();
  await expect(page.getByRole('cell', { name: /Bloco teste/ })).toBeVisible();
  await page.getByRole('button', { name: '3', exact: true }).click();
  await expect(page.getByText(tarefa.tarefa, { exact: true })).toBeVisible();
  expect(state.calls.find(u => u.pathname.endsWith('/tarefas')).searchParams.get('id_obra')).toBe('106');
  expect(state.legacy.some(u => u.pathname.endsWith('/EAP'))).toBeFalsy();
  expect(state.errors).toEqual([]);
});

test('Encarregados usa o dia exato no MySQL; popup não depende de UUID novo', async ({ page }) => {
  const state = await preparar(page);
  await page.goto('/#/obra/106/encarregados');
  const nome = page.getByTitle('Ver cards ativos deste encarregado').filter({ hasText: card.responsavel_encarregado });
  await expect(nome).toBeVisible({ timeout: 30000 });
  await expect.poll(() => state.calls.some(u => u.pathname.endsWith('/apontamentos') && u.searchParams.get('desde') === dia && u.searchParams.get('ate') === dia)).toBeTruthy();
  await nome.click();
  const popup = page.locator('.modal-card-in').filter({ hasText: tarefa.tarefa });
  await expect(popup.getByText(tarefa.tarefa, { exact: true })).toBeVisible();
  await expect(popup.getByText('Bom', { exact: true }).first()).toBeVisible();
  expect(state.calls.some(u => u.pathname.endsWith('/alocacoes'))).toBeTruthy();
  // A única parte ainda Supabase é estritamente anterior ao corte; nenhum
  // pedido por UUID para cruzar os apontamentos de setembro.
  expect(state.legacy.some(u => u.searchParams.has('ID'))).toBeFalsy();
  for (const url of state.legacy.filter(u => /Apontamentos|apontamento_efetivo|vw_dados_tv/.test(u.pathname))) {
    const values = [...url.searchParams.values()];
    expect(values).toContain('lte.2026-08-31');
  }
  expect(state.errors).toEqual([]);
});

test('data escolhida manualmente permanece mesmo quando a obra não tem lançamento no dia', async ({ page }) => {
  const state = await preparar(page);
  await page.goto('/#/obra/110/encarregados');
  const input = page.locator('input[type="date"]');
  await expect(input).toBeVisible({ timeout: 30000 });
  await input.fill('2026-09-20');
  await expect(input).toHaveValue('2026-09-20');
  // A fixture tem dado em 18/09, mas nenhum em 20/09. A escolha manual não
  // pode recuar para 18/09.
  await expect.poll(() => state.calls.filter(u => u.pathname.endsWith('/aderencia')).at(-1)?.searchParams.get('ate')).toBe('2026-09-20');
  await expect(input).toHaveValue('2026-09-20');
  expect(state.errors).toEqual([]);
});

test('erro de apontamentos não é tratado como qualidade pendente', async ({ page }) => {
  const state = await preparar(page, 'apontamentos');
  await page.goto('/#/obra/106/encarregados');
  await expect(page.getByText('Erro ao carregar EAP / histórico de apontamentos e alocação')).toBeVisible({ timeout: 30000 });
  expect(state.errors).toEqual([]);
});

test('ranking usa EAP e qualidade MySQL; falha de EAP não fica carregando para sempre', async ({ page }) => {
  const state = await preparar(page, 'tarefas');
  await page.goto('/#/ranking');
  await expect(page.getByText('Erro ao carregar EAP / qualidade do período')).toBeVisible({ timeout: 30000 });
  expect(state.errors).toEqual([]);
});

test('ranking calcula qualidade de setembro com o intervalo selecionado', async ({ page }) => {
  const state = await preparar(page);
  await page.goto('/#/ranking');
  await expect.poll(() => state.calls.some(u => u.pathname.endsWith('/apontamentos')), { timeout: 30000 }).toBeTruthy();
  const call = state.calls.find(u => u.pathname.endsWith('/apontamentos'));
  expect(call.searchParams.get('desde')).toMatch(/^2026-09-/);
  expect(call.searchParams.get('ate')).toMatch(/^2026-09-/);
  await expect(page.getByText('Carregando ranking de encarregados…')).toHaveCount(0);
  expect(state.errors).toEqual([]);
});
