// Somente leitura. Usa explicitamente api/.env, não credenciais MySQL de
// outro projeto herdadas do terminal. Não imprime chaves nem dados pessoais.
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url), override: true });
const { pool } = await import('../src/db/pool.js');

async function postgres(query) {
  if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN ausente');
  const r = await fetch('https://api.supabase.com/v1/projects/gebjlhkywtnpfqjrakok/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }), signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Auditoria Supabase: HTTP ${r.status}`);
  return r.json();
}

try {
  for (const [pg, my, key, date] of [
    ['EAP', 'eap_tarefas', 'id', null],
    ['cards_ativos', 'eap_cards_ativos', 'card_id', null],
    ['Apontamentos', 'eap_apontamentos', null, 'data_do_input'],
    ['apontamento_efetivo', 'eap_apontamento_efetivo', null, 'data_consulta'],
  ]) {
    const dates = date ? `, MIN(${date}) AS inicio, MAX(${date}) AS fim` : '';
    const [mysql] = await pool.query(`SELECT COUNT(*) AS total${dates} FROM ${my}`);
    const supabase = await postgres(`SELECT COUNT(*) AS total${dates} FROM public."${pg}"`);
    const report = { tabela: pg, mysql: mysql[0], supabase: supabase[0] };
    if (key) {
      const [a] = await pool.query(`SELECT * FROM ${my}`);
      const b = await postgres(`SELECT * FROM public."${pg}"`);
      const byId = new Map(a.map(row => [String(row[key]), row]));
      const otherIds = new Set(b.map(row => String(row[key])));
      report.ausentes_mysql = b.filter(row => !byId.has(String(row[key]))).length;
      report.ausentes_por_eap = {};
      for (const row of b.filter(row => !byId.has(String(row[key])))) {
        const group = `obra=${row.id_obra};eap=${row.id_eap ?? row.id_eap_tabela}`;
        report.ausentes_por_eap[group] = (report.ausentes_por_eap[group] || 0) + 1;
      }
      report.extras_mysql = a.filter(row => !otherIds.has(String(row[key]))).length;
      const ignored = new Set(['criado_em', 'atualizado_em', 'sincronizado_em']);
      const diffs = {};
      const maxNumeric = {};
      for (const row of b) {
        const target = byId.get(String(row[key]));
        if (!target) continue;
        for (const field of Object.keys(row)) {
          if (ignored.has(field) || !(field in target)) continue;
          const x = row[field], y = target[field];
          if (String(x ?? '') === String(y ?? '')) continue;
          // MySQL normaliza datas inválidas/ausentes e arredonda DECIMAL.
          if (String(x).startsWith('0000-00-00') && y == null) continue;
          if (x != null && y != null && x !== '' && y !== '' &&
              Number.isFinite(Number(x)) && Number.isFinite(Number(y)) &&
              Math.abs(Number(x) - Number(y)) < 0.000001) continue;
          diffs[field] = (diffs[field] || 0) + 1;
          if (x != null && y != null && Number.isFinite(Number(x)) && Number.isFinite(Number(y))) {
            maxNumeric[field] = Math.max(maxNumeric[field] || 0, Math.abs(Number(x) - Number(y)));
          }
        }
      }
      report.campos_divergentes = diffs;
      report.maior_diferenca_numerica = maxNumeric;
      report.campos_sem_espelho = b.length && a.length
        ? Object.keys(b[0]).filter(field => !(field in a[0]) && !ignored.has(field)) : [];
    }
    console.log(JSON.stringify(report));
  }
} catch (err) {
  console.error(err.code || err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
