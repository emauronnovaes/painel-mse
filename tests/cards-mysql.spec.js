const { test, expect } = require('@playwright/test');
const { semLogin } = require('./helpers');

const card = {
  card_id: '9001', id_obra: 106, id_eap_tabela: 64, nome_obra: 'CNPEM-FASEADA',
  edt: '1.1', tarefa: 'Atividade de teste MySQL', responsavel_encarregado: 'ENCARREGADO TESTE',
};

async function preparar(page, status = 200) {
  await semLogin(page);
  const calls = [], legacy = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Isola as fontes secundárias; o objetivo é testar os três consumidores
  // da nova rota e seus estados de falha, não ler dados de produção no CI.
  await page.route('**/rest/v1/**', route => {
    if (new URL(route.request().url()).pathname.endsWith('/cards_ativos')) legacy.push(route.request().url());
    return route.fulfill({ json: [] });
  });
  await page.route('**/functions/v1/efetivo/**', route => route.fulfill({ json: [] }));
  await page.route('**/eap/indices-financeiros?*', route => route.fulfill({ json: { indices: [], falhas: [] } }));
  await page.route('**/eap/tarefas?*', route => route.fulfill({ json: [{ id: 9001, edt: '1.1', tarefa: card.tarefa, disciplina: 'Civil', ponderacao_reais: 100, avanco_atual: 0.5, desvio: 0 }] }));
  await page.route('**/eap/apontamentos?*', route => route.fulfill({ json: [] }));
  await page.route('**/eap/alocacoes?*', route => route.fulfill({ json: [] }));
  await page.route('**/eap/aderencia?*', route => route.fulfill({ json: [] }));
  await page.route('**/eap/cards?*', route => {
    calls.push(new URL(route.request().url()));
    return route.fulfill({ status, json: status === 200 ? [card] : { erro: 'MySQL indisponivel' } });
  });
  return { calls, legacy, errors };
}

test('Encarregados e popup consomem cards MySQL e preservam a atividade', async ({ page }) => {
  const state = await preparar(page);
  await page.goto('/#/obra/106/encarregados');
  const nome = page.getByTitle('Ver cards ativos deste encarregado').filter({ hasText: card.responsavel_encarregado });
  await expect(nome).toBeVisible({ timeout: 45000 });
  await nome.click();
  await expect(page.getByText(card.tarefa, { exact: true })).toBeVisible();
  expect(state.calls.some(url => url.searchParams.get('com_encarregado') === 'true')).toBeTruthy();
  expect(state.calls.some(url => url.searchParams.get('encarregado') === card.responsavel_encarregado)).toBeTruthy();
  expect(state.legacy).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('ranking geral solicita cards ao MySQL', async ({ page }) => {
  const state = await preparar(page);
  await page.goto('/#/ranking');
  await expect.poll(() => state.calls.length, { timeout: 45000 }).toBeGreaterThan(0);
  await expect(page.getByText('Carregando ranking de encarregados…')).toHaveCount(0);
  expect(state.calls[0].searchParams.get('com_encarregado')).toBe('true');
  expect(state.legacy).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('falha MySQL aparece como erro, sem fallback silencioso para Supabase', async ({ page }) => {
  const state = await preparar(page, 503);
  await page.goto('/#/obra/106/encarregados');
  await expect(page.getByText('Erro ao carregar vw_dados_tv / cards_ativos')).toBeVisible({ timeout: 45000 });
  expect(state.legacy).toEqual([]);
  expect(state.errors).toEqual([]);
});
