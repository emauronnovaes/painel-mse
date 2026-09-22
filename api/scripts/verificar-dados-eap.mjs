// Comparação somente leitura dos dados importados e teste HTTP real, sem cron.
import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import express from 'express';
import { criarDadosEapRouter, ADERENCIA_SQL } from '../src/routes/eapDados.js';
import { consultarOrigem } from './lib/supabase-auditoria.mjs';
dotenv.config({ path: new URL('../.env', import.meta.url), override: true });
const { pool } = await import('../src/db/pool.js');
const app = express(); app.use('/eap', criarDadosEapRouter(pool));
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}/eap`;
async function pages(path) {
  const rows = [];
  for (let i = 0; ; i += 1000) {
    const r = await fetch(`${base}/${path}`, { headers: { Range: `${i}-${i + 999}` }, signal: AbortSignal.timeout(20000) });
    assert.equal(r.status, 200, path.split('?')[0]);
    const page = await r.json(); rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}
try {
  for (const spec of [
    { pg: 'Apontamentos', my: 'eap_apontamentos', date: 'data_do_input', id: 'id', route: 'apontamentos', keys: ['id', 'data_do_input'], fields: ['id', 'data_do_input', 'status_qualidade', 'avanco_diario', 'meta_diaria'] },
    { pg: 'apontamento_efetivo', my: 'eap_apontamento_efetivo', date: 'data_consulta', id: 'tarefa_id', route: 'alocacoes', keys: ['tarefa_id', 'funcionario_id', 'data_consulta'], fields: ['tarefa_id', 'funcionario_id', 'data_consulta', 'funcionario_nome', 'nome_funcao'] },
  ]) {
    const source = await consultarOrigem(`SELECT ${spec.fields.join(',')}${spec.id === 'id' ? ', round(LEAST(avanco_diario::numeric / NULLIF(meta_diaria::numeric,0),1.2),4) AS aderencia' : ''} FROM public."${spec.pg}" WHERE ${spec.date} >= '2026-09-01' AND ${spec.date} < '2026-10-01'`);
    const ids = [...new Set(source.map(r => r[spec.id]))];
    const rows = [];
    for (let i = 0; i < ids.length; i += 200) rows.push(...await pages(`${spec.route}?ids=${ids.slice(i, i + 200).join(',')}&desde=2026-09-01&ate=2026-09-30`));
    const pk = r => spec.keys.map(k => String(r[k])).join('|');
    const map = new Map(rows.map(r => [pk(r), r]));
    assert.equal(map.size, rows.length);
    const diffs = {}, maxDiff = {};
    for (const r of source) {
      const other = map.get(pk(r)); assert.ok(other, 'Chave de setembro ausente');
      for (const f of [...spec.fields, ...(spec.id === 'id' ? ['aderencia'] : [])]) {
        const x = r[f], y = other[f === 'aderencia' ? 'ADERENCIA_LINEAR' : f];
        if (String(x ?? '') === String(y ?? '')) continue;
        if (x != null && y != null && Number.isFinite(Number(x)) && Number.isFinite(Number(y))) {
          const diff = Math.abs(Number(x) - Number(y));
          if (diff < 1e-12) continue;
          maxDiff[f] = Math.max(maxDiff[f] || 0, diff);
        }
        diffs[f] = (diffs[f] || 0) + 1;
      }
    }
    console.log(JSON.stringify({ tabela: spec.my, origem: source.length, api: rows.length, divergencias: diffs, maior_diferenca: maxDiff }));
    assert.deepEqual(diffs, {}, 'Divergencia em campos consumidos');
  }
  const aderencia = await pages('aderencia?desde=2026-09-01&ate=2026-09-30');
  const [[n]] = await pool.query("SELECT count(*) AS total FROM eap_apontamentos WHERE data_do_input >= '2026-09-01' AND data_do_input < '2026-10-01'");
  assert.equal(aderencia.length, n.total);
  // Garante a semântica NULL/zero do Postgres, não só os casos da amostra real.
  for (const [avanco, meta, expected] of [[null, 1, 1.2], [1, 0, 1.2], [1, null, 1.2], [0, 1, 0], [2, 1, 1.2], [1, 3, 0.3333]]) {
    const [[r]] = await pool.query(`SELECT ${ADERENCIA_SQL} AS resultado FROM (SELECT ? AS avanco_diario, ? AS meta_diaria) a`, [avanco, meta]);
    assert.equal(Number(r.resultado), expected);
  }
  const [obras] = await pool.query('SELECT id_obra, COUNT(*) AS total FROM eap_tarefas WHERE id_obra IS NOT NULL GROUP BY id_obra');
  for (const obra of obras) assert.equal((await pages(`tarefas?id_obra=${obra.id_obra}`)).length, obra.total);
  console.log(JSON.stringify({ status: 'ok', aderencia: aderencia.length, obras_eap: obras.length, casos_formula: 6 }));
} catch (e) { console.error(e.code || e.message); process.exitCode = 1; }
finally { await new Promise(resolve => server.close(resolve)); await pool.end(); }
