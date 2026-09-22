const { test } = require('node:test');
const assert = require('node:assert/strict');

async function api(t, query) {
  const { default: express } = await import('../../api/node_modules/express/index.js');
  const { criarCardsRouter } = await import('../../api/src/routes/eapCards.js');
  const app = express();
  const router = criarCardsRouter({ query });
  app.use('/eap/cards', router);
  app.use('/api/eap/cards', router);
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (suffix = '', headers = {}, prefix = '') => fetch(
    `http://127.0.0.1:${server.address().port}${prefix}/eap/cards${suffix}`, { headers },
  );
}

test('cards: array, fonte MySQL, campos explícitos e ordem estável', async t => {
  const request = await api(t, async (sql, params) => {
    assert.match(sql, /FROM eap_cards_ativos/);
    assert.match(sql, /ORDER BY nome_obra ASC, edt ASC, card_id ASC LIMIT \? OFFSET \?/);
    assert.doesNotMatch(sql, /SELECT \*/);
    assert.deepEqual(params, [1000, 0]);
    return [[{ card_id: '42', nome_obra: 'Teste', edt: '1.2' }]];
  });
  for (const prefix of ['', '/api']) {
    const r = await request('', {}, prefix);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('x-data-source'), 'mysql');
    assert.deepEqual(await r.json(), [{ card_id: '42', nome_obra: 'Teste', edt: '1.2' }]);
  }
});

test('cards: filtros parametrizados, inclusivos e curingas escapados', async t => {
  const nome = "D'Ávila 100%_!";
  const request = await api(t, async (sql, params) => {
    assert.match(sql, /id_obra = \? AND id_eap_tabela = \? AND responsavel_encarregado IS NOT NULL/);
    assert.match(sql, /COLLATE utf8mb4_0900_as_ci LIKE \? ESCAPE '!'/);
    assert.ok(!sql.includes(nome));
    assert.deepEqual(params, [106, 64, "%D'Ávila 100!%!_!!%", 1000, 0]);
    return [[]];
  });
  const r = await request(`?id_obra=106&id_eap=64&com_encarregado=true&encarregado=${encodeURIComponent(nome)}`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), []);
});

test('cards: pagina além de 1000 sem truncar nem repetir a primeira página', async t => {
  const dataset = Array.from({ length: 2000 }, (_, i) => ({ card_id: String(i) }));
  const offsets = [];
  const request = await api(t, async (_, [limit, offset]) => {
    offsets.push(offset);
    return [dataset.slice(offset, offset + limit)];
  });
  const result = [];
  for (let i = 0; ; i += 1000) {
    const r = await request('', { Range: `${i}-${i + 999}`, 'Range-Unit': 'items' });
    assert.equal(r.status, 200);
    const page = await r.json();
    result.push(...page);
    if (page.length < 1000) break;
  }
  assert.deepEqual(result, dataset);
  assert.deepEqual(offsets, [0, 1000, 2000]);
});

test('cards: rejeita filtros e intervalos inválidos antes de consultar banco', async t => {
  let calls = 0;
  const request = await api(t, async () => { calls++; return [[]]; });
  for (const suffix of ['?id_obra=0', '?id_obra=-1', '?id_obra=1.5', '?id_obra=',
    '?id_eap=NaN', '?id_eap=9007199254740992', '?id_obra=1&id_obra=2',
    '?encarregado=', '?encarregado=a&encarregado=b', '?com_encarregado=1', '?sql=SELECT']) {
    assert.equal((await request(suffix)).status, 400, suffix);
  }
  for (const range of ['abc', '-1-10', '20-10', '0-1000', '0-9007199254740992']) {
    assert.equal((await request('', { Range: range })).status, 400, range);
  }
  assert.equal((await request('', { 'Range-Unit': 'bytes' })).status, 400);
  assert.equal(calls, 0);
});

test('cards: falha de banco é 503, não sucesso vazio nem detalhe sensível', async t => {
  const request = await api(t, async () => { throw new Error('segredo: senha e consulta'); });
  const r = await request();
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { erro: 'Falha ao consultar cards ativos no MySQL.' });
});

test('cards: com_encarregado=false não exclui registros sem responsável', async t => {
  const request = await api(t, async (sql) => {
    assert.doesNotMatch(sql, /WHERE/);
    return [[{ card_id: '1', responsavel_encarregado: null }]];
  });
  const r = await request('?com_encarregado=false');
  assert.equal((await r.json())[0].responsavel_encarregado, null);
});
