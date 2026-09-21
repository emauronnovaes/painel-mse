// Importação delimitada e não destrutiva. Por padrão apenas audita.
// --aplicar: insere chaves ausentes. Nas existentes só recompõe números cuja
// diferença é comprovadamente o arredondamento do antigo DECIMAL (compare-and-set).
// Duas tabelas na mesma transação; qualquer falha/aviso/validação faz rollback.
import dotenv from 'dotenv';
import { consultarOrigem } from './lib/supabase-auditoria.mjs';
import ajustarPrecisao from '../src/db/migrations/013_precisao_apontamentos.js';
dotenv.config({ path: new URL('../.env', import.meta.url), override: true });
const { pool } = await import('../src/db/pool.js');
const INICIO = '2026-09-01', FIM = '2026-10-01';
const APPLY = process.argv.includes('--aplicar');
const specs = [
  { pg: 'Apontamentos', my: 'eap_apontamentos', date: 'data_do_input', keys: ['id', 'data_do_input'] },
  { pg: 'apontamento_efetivo', my: 'eap_apontamento_efetivo', date: 'data_consulta', keys: ['data_consulta', 'tarefa_id', 'funcionario_id'] },
];
const key = (row, keys) => keys.map(k => String(row[k])).join('|');
let conn;
try {
  conn = await pool.getConnection();
  // DDL fora da transação de carga (MySQL faz commit implícito em ALTER).
  // Idempotente e limitado aos três campos que perdiam precisão no schema real.
  if (APPLY) await ajustarPrecisao(conn);
  const plans = [];
  for (const spec of specs) {
    const source = await consultarOrigem(`SELECT * FROM public."${spec.pg}" WHERE ${spec.date} >= '${INICIO}' AND ${spec.date} < '${FIM}' ORDER BY ${spec.keys.join(',')}`);
    const totals = await consultarOrigem(`SELECT count(*) AS total FROM public."${spec.pg}" WHERE ${spec.date} >= '${INICIO}' AND ${spec.date} < '${FIM}'`);
    if (source.length !== Number(totals[0].total)) throw new Error(`${spec.pg}: origem truncada ou mudou durante leitura; repita`);
    const [columns] = await conn.query(`SHOW COLUMNS FROM ${spec.my}`);
    const fields = columns.filter(c => !['criado_em', 'atualizado_em', 'uuid'].includes(c.Field)).map(c => c.Field);
    if (!source.length) throw new Error(`${spec.pg}: setembro vazio na origem`);
    if (fields.some(c => !(c in source[0]))) throw new Error(`${spec.pg}: campo da origem ausente`);
    const seen = new Set();
    for (const row of source) {
      if (spec.keys.some(k => row[k] == null || row[k] === '')) throw new Error(`${spec.pg}: chave nula`);
      if (!/^2026-09-\d{2}$/.test(row[spec.date])) throw new Error(`${spec.pg}: formato de data inesperado`);
      const pk = key(row, spec.keys);
      if (seen.has(pk)) throw new Error(`${spec.pg}: chave duplicada`);
      seen.add(pk);
    }
    const [existing] = await conn.query(`SELECT * FROM ${spec.my} WHERE ${spec.date} >= ? AND ${spec.date} < ?`, [INICIO, FIM]);
    const existingKeys = new Set(existing.map(r => key(r, spec.keys)));
    const absent = source.filter(r => !existingKeys.has(key(r, spec.keys)));
    const existingMap = new Map(existing.map(r => [key(r, spec.keys), r]));
    const precision = [];
    if (spec.my === 'eap_apontamentos') for (const row of source) {
      const old = existingMap.get(key(row, spec.keys));
      if (!old) continue;
      for (const [field, scale] of [['qtd', 4], ['avanco_diario', 6], ['meta_diaria', 6]]) {
        const x = row[field], y = old[field];
        if (x == null || y == null || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) continue;
        if (Math.abs(Number(x) - Number(y)) <= 1e-12) continue;
        if (Number(Number(x).toFixed(scale)) === Number(y)) precision.push({ row, field, old: y, value: x });
      }
    }
    const conversoes = {};
    for (const col of columns) {
      const match = /^decimal\((\d+),(\d+)\)/.exec(col.Type);
      if (!match) continue;
      for (const row of source) {
        const value = row[col.Field];
        if (value == null || value === '') continue;
        const n = Number(value), rounded = Number(n.toFixed(Number(match[2])));
        if (!Number.isFinite(n)) throw new Error(`${spec.pg}: numero invalido em ${col.Field}`);
        if (n !== rounded) {
          const s = conversoes[col.Field] ||= { linhas: 0, max_diferenca: 0, viraria_zero: 0 };
          s.linhas++; s.max_diferenca = Math.max(s.max_diferenca, Math.abs(n - rounded));
          if (rounded === 0 && n !== 0) s.viraria_zero++;
        }
      }
    }
    console.log(JSON.stringify({ tabela: spec.my, conversoes_decimais: conversoes }));
    console.log(JSON.stringify({ tabela: spec.my, origem_setembro: source.length, destino_setembro: existing.length,
      inserir: absent.length, recompor_precisao: precision.length, extras_destino: existing.filter(r => !seen.has(key(r, spec.keys))).length, aplicar: APPLY }));
    plans.push({ ...spec, fields, source, absent, columns, precision });
  }
  if (APPLY) {
    await conn.beginTransaction();
    for (const plan of plans) {
      for (const fix of plan.precision) {
        const [r] = await conn.query(`UPDATE ${plan.my} SET ${fix.field} = ? WHERE ${plan.keys.map(k => k + ' = ?').join(' AND ')} AND ${fix.field} <=> ?`,
          [fix.value, ...plan.keys.map(k => fix.row[k]), fix.old]);
        if (r.affectedRows !== 1 || r.warningStatus) throw new Error('Dado mudou durante recomposicao de precisao; repita auditoria');
      }
      for (let offset = 0; offset < plan.absent.length; offset += 200) {
        const batch = plan.absent.slice(offset, offset + 200);
        const values = batch.map(row => plan.fields.map(field => {
          const value = row[field];
          const col = plan.columns.find(c => c.Field === field);
          if (value === '' && /^(decimal|double|float|int|bigint)/.test(col.Type)) return null;
          return value;
        }));
        const [r] = await conn.query(
          `INSERT INTO ${plan.my} (${plan.fields.map(c => '`' + c + '`').join(',')}) VALUES ? ON DUPLICATE KEY UPDATE ${plan.keys[0]}=${plan.keys[0]}`,
          [values],
        );
        if (r.warningStatus) {
          const [warnings] = await conn.query('SHOW WARNINGS');
          console.log(JSON.stringify({ avisos_codigos: [...new Set(warnings.map(w => w.Code))] }));
          throw new Error(`${plan.my}: aviso de conversao; importacao cancelada`);
        }
      }
      // Valida cada chave dentro da transação, antes do COMMIT.
      const [now] = await conn.query(`SELECT ${plan.keys.join(',')} FROM ${plan.my} WHERE ${plan.date} >= ? AND ${plan.date} < ?`, [INICIO, FIM]);
      const loaded = new Set(now.map(r => key(r, plan.keys)));
      if (plan.source.some(r => !loaded.has(key(r, plan.keys)))) throw new Error(`${plan.my}: cobertura incompleta`);
    }
    await conn.commit();
    console.log('COMMIT: setembro importado; snapshots preservados (exceto precisao comprovada); nenhuma exclusao.');
  }
} catch (e) {
  if (conn && APPLY) await conn.rollback();
  // Mensagens de drivers podem conter valores pessoais. Não as imprimir.
  console.error(e.code || e.message); process.exitCode = 1;
} finally { conn?.release(); await pool.end(); }
