const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarCliente } = require('../../prototipo/lib/eap-data.js');

function client(handler) {
  const calls = [];
  const data = criarCliente({ apiUrl: 'https://api.test', supabaseUrl: 'https://sb.test',
    headers: () => ({ Authorization: 'Bearer teste' }),
    fetchPaginado: async (url, headers) => { calls.push(new URL(url)); assert.equal(headers.Authorization, 'Bearer teste'); return handler ? handler(new URL(url)) : []; },
  });
  return { data, calls };
}
test('histórico: setembro só consulta MySQL', async () => {
  const { data, calls } = client(() => [{ id: 1 }]);
  assert.deepEqual(await data.historico('apontamentos', { ids: ['1'], desde: '2026-09-01', ate: '2026-09-30' }), [{ id: 1 }]);
  assert.equal(calls.length, 1); assert.equal(calls[0].hostname, 'api.test');
  assert.equal(calls[0].searchParams.get('desde'), '2026-09-01');
  assert.equal(calls[0].searchParams.get('ids'), '1');
});
test('histórico: agosto fica no legado', async () => {
  const { data, calls } = client();
  await data.historico('alocacoes', { ids: ['5'], desde: '2026-08-01', ate: '2026-08-31' });
  assert.equal(calls.length, 1); assert.equal(calls[0].hostname, 'sb.test');
  assert.deepEqual(calls[0].searchParams.getAll('data_consulta'), ['gte.2026-08-01', 'lte.2026-08-31']);
  assert.equal(calls[0].searchParams.get('tarefa_id'), 'in.(5)');
});
test('histórico: janela cruzando o corte divide dias sem sobreposição', async () => {
  const { data, calls } = client(url => [{ origem: url.hostname }]);
  const rows = await data.historico('aderencia', { desde: '2026-08-28', ate: '2026-09-05' });
  assert.equal(rows.length, 2);
  assert.deepEqual(calls[0].searchParams.getAll('DATA'), ['gte.2026-08-28', 'lte.2026-08-31']);
  assert.equal(calls[1].searchParams.get('desde'), '2026-09-01');
  assert.equal(calls[1].searchParams.get('ate'), '2026-09-05');
});
test('histórico: falha MySQL não provoca fallback nem sucesso parcial', async () => {
  const { data, calls } = client(url => url.hostname === 'api.test' ? null : [{ id: 1 }]);
  assert.equal(await data.historico('apontamentos', { ids: ['1'], desde: '2026-08-31', ate: '2026-09-02' }), null);
  assert.equal(calls.length, 2);
});
test('histórico: mês vazio não consulta Supabase', async () => {
  const { data, calls } = client();
  assert.deepEqual(await data.historico('apontamentos', { ids: ['1'], desde: '2026-09-01', ate: '2026-09-02' }), []);
  assert.equal(calls.length, 1);
});
test('EAP e histórico repartem IDs em lotes de 200 e tratam lista vazia', async () => {
  const { data, calls } = client();
  const ids = Array.from({ length: 401 }, (_, i) => String(i + 1));
  await data.tarefas({ ids });
  assert.deepEqual(calls.map(u => u.searchParams.get('ids').split(',').length), [200, 200, 1]);
  calls.length = 0;
  await data.historico('alocacoes', { ids, desde: '2026-09-01', ate: '2026-09-21' });
  assert.equal(calls.length, 3);
  calls.length = 0;
  await data.tarefas({ ids: [] });
  await data.historico('apontamentos', { ids: [], desde: '2026-09-01', ate: '2026-09-21' });
  assert.equal(calls.length, 0);
});
test('EAP: filtro id_eap/edt é codificado sem interpolar parâmetros', async () => {
  const { data, calls } = client();
  await data.tarefas({ eapId: 51, edt: '1&ids=2' });
  assert.equal(calls[0].searchParams.get('edt'), '1&ids=2');
  assert.equal(calls[0].searchParams.get('ids'), null);
});

async function api(t, query) {
  const { default: express } = await import('../../api/node_modules/express/index.js');
  const { criarDadosEapRouter } = await import('../../api/src/routes/eapDados.js');
  const app = express(); app.use('/api/eap', criarDadosEapRouter({ query }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (path, headers) => fetch(`http://127.0.0.1:${server.address().port}/api/eap/${path}`, { headers });
}
test('API EAP: paginação e filtros parametrizados', async t => {
  const request = await api(t, async (sql, params) => {
    assert.match(sql, /FROM eap_tarefas/);
    assert.match(sql, /a.id_eap = \? AND a.edt = \?/);
    assert.deepEqual(params, [51, "1' OR 1=1", 1000, 1000]);
    return [[{ id: 42 }]];
  });
  const r = await request(`tarefas?id_eap=51&edt=${encodeURIComponent("1' OR 1=1")}`, { Range: '1000-1999' });
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), [{ id: 42 }]);
});
test('API histórico: valida datas reais, cobertura, IDs e Range antes de consultar', async t => {
  let calls = 0;
  const request = await api(t, async () => { calls++; return [[]]; });
  for (const path of [
    'tarefas', 'tarefas?id_obra=0', 'tarefas?id_obra=-1', 'tarefas?id_eap=NaN',
    'tarefas?ids=1,', 'tarefas?ids=1&ids=2', 'tarefas?edt=1', 'tarefas?id_obra=1&sql=SELECT',
    'apontamentos?ids=1&desde=2026-09-31&ate=2026-10-01',
    'apontamentos?ids=1&desde=2026-09-20&ate=2026-09-01',
    'alocacoes?desde=2026-09-01&ate=2026-09-21',
    'aderencia?desde=2026-02-30&ate=2026-09-21',
  ]) assert.equal((await request(path)).status, 400, path);
  assert.equal((await request('apontamentos?ids=1&desde=2026-08-31&ate=2026-09-21')).status, 422);
  for (const Range of ['abc', '0-1000', '10-0', '0-9007199254740992']) assert.equal((await request('tarefas?id_obra=106', { Range })).status, 400);
  assert.equal(calls, 0);
});
test('API apontamentos: fórmula preserva NULL/zero do Postgres e paginação', async t => {
  const request = await api(t, async (sql, params) => {
    assert.match(sql, /COALESCE\(a.avanco_diario \/ NULLIF\(a.meta_diaria, 0\), 1.2\)/);
    assert.deepEqual(params, [[1, 2], '2026-09-01', '2026-09-30', 1000, 0]);
    return [[]];
  });
  assert.equal((await request('apontamentos?ids=1,2&desde=2026-09-01&ate=2026-09-30')).status, 200);
});
test('API EAP: falha de banco é 503 sem vazar detalhe', async t => {
  const request = await api(t, async () => { throw new Error('senha e dados pessoais'); });
  const r = await request('tarefas?id_obra=106');
  assert.equal(r.status, 503); assert.ok(!(await r.text()).includes('senha'));
});
test('migration de precisão é idempotente e não reduz VARCHAR maior', async () => {
  const { default: migrate } = await import('../../api/src/db/migrations/013_precisao_apontamentos.js');
  let calls = [];
  await migrate({ query: async sql => { calls.push(sql); return [[{ Field: 'qtd', Type: 'varchar(120)' }, { Field: 'avanco_diario', Type: 'double' }, { Field: 'meta_diaria', Type: 'double' }]]; } });
  assert.equal(calls.length, 1);
  calls = [];
  await migrate({ query: async sql => { calls.push(sql); return [[{ Field: 'qtd', Type: 'decimal(16,4)' }, { Field: 'avanco_diario', Type: 'decimal(18,6)' }, { Field: 'meta_diaria', Type: 'decimal(18,6)' }]]; } });
  assert.equal(calls.length, 2);
  assert.match(calls[1], /^ALTER TABLE eap_apontamentos MODIFY COLUMN qtd VARCHAR\(64\) NULL/);
  assert.match(calls[1], /MODIFY COLUMN meta_diaria DOUBLE NULL/);
});
