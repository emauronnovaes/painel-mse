// Integração SOMENTE LEITURA: monta a rota em porta efêmera, sem migrations
// nem cron. Usa o MySQL real e não imprime nomes ou credenciais.
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import express from 'express';
import { criarCardsRouter } from '../src/routes/eapCards.js';
dotenv.config({ path: new URL('../.env', import.meta.url), override: true });
const { pool } = await import('../src/db/pool.js');
const app = express();
app.use('/eap/cards', criarCardsRouter(pool));
const server = await new Promise(resolve => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const url = `http://127.0.0.1:${server.address().port}/eap/cards`;
try {
  const all = [];
  let pages = 0;
  for (let offset = 0; ; offset += 100) {
    const r = await fetch(url, { headers: { Range: `${offset}-${offset + 99}` }, signal: AbortSignal.timeout(20000) });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('x-data-source'), 'mysql');
    const page = await r.json();
    all.push(...page); pages++;
    if (page.length < 100) break;
  }
  const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM eap_cards_ativos');
  assert.equal(all.length, count.total);
  assert.equal(new Set(all.map(r => r.card_id)).size, all.length);
  // Exercita a busca por nome de verdade, mas só publica contagens.
  const sample = all.find(r => r.responsavel_encarregado && r.id_obra && r.id_eap_tabela);
  if (sample) {
    const query = new URLSearchParams({
      id_obra: sample.id_obra, id_eap: sample.id_eap_tabela,
      encarregado: sample.responsavel_encarregado, com_encarregado: 'true',
    });
    const r = await fetch(`${url}?${query}`, { signal: AbortSignal.timeout(20000) });
    assert.equal(r.status, 200);
    const rows = await r.json();
    assert.ok(rows.some(row => row.card_id === sample.card_id));
    assert.ok(rows.every(row => row.id_obra === sample.id_obra && row.id_eap_tabela === sample.id_eap_tabela));
  }
  console.log(JSON.stringify({ status: 'ok', total_cards: all.length, paginas: pages, filtro_real: Boolean(sample) }));
} finally {
  await new Promise(resolve => server.close(resolve));
  await pool.end();
}
