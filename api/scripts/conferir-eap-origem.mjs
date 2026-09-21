import dotenv from 'dotenv';
import { consultarOrigem } from './lib/supabase-auditoria.mjs';
dotenv.config({ path: new URL('../.env', import.meta.url), override: true });
const { pool } = await import('../src/db/pool.js');
try {
  const old = await consultarOrigem('SELECT id,id_eap FROM public."EAP"');
  const [current] = await pool.query('SELECT id,id_eap FROM eap_tarefas');
  const known = new Set(current.map(r => String(r.id)));
  const missing = old.filter(r => !known.has(String(r.id)));
  for (const id of [...new Set(missing.map(r => r.id_eap))]) {
    const r = await fetch(`https://portalmse.com.br/microservices/hub_mse/api_avancos/v1/tarefas/${id}`, {
      headers: { Authorization: `Bearer ${process.env.AVANCOS_API_TOKEN}` }, signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error(`Hub EAP ${id}: HTTP ${r.status}`);
    const payload = await r.json();
    const body = payload.data ?? payload;
    if (!Array.isArray(body.tarefas)) throw new Error('Lista de tarefas ausente');
    const active = new Set(body.tarefas.map(t => String(t.id)));
    const stale = missing.filter(t => t.id_eap === id);
    console.log(JSON.stringify({ eap: id, diferencas: stale.length,
      ainda_na_origem: stale.filter(t => active.has(String(t.id))).length,
      ausentes_na_origem: stale.filter(t => !active.has(String(t.id))).length }));
  }
} catch (e) { console.error(e.code || e.message); process.exitCode = 1; }
finally { await pool.end(); }
