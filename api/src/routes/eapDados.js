import { Router } from 'express';

export const INICIO_HISTORICO = '2026-09-01';
// Postgres LEAST ignora NULL: meta zero/nula ou avanço nulo dá 1.2 na
// vw_dados_tv original. MySQL LEAST propagaria NULL; COALESCE preserva a regra.
export const ADERENCIA_SQL = 'ROUND(LEAST(COALESCE(a.avanco_diario / NULLIF(a.meta_diaria, 0), 1.2), 1.2), 4)';
const TAREFAS = `id, id_obra, nome_obra, id_eap, edt, tarefa, disciplina, local, unidade,
  qtd, saldo_qtd, efetivo_previsto, ponderacao_reais, ponderacao_hht, avanco_atual,
  desvio, data_inicio, data_termino, data_inicio_reprogramado, data_termino_reprogramado,
  meta_diaria, avanco_diario, encarregado_nome, status_qualidade, hht_consumido`;

const fontes = {
  tarefas: { from: 'eap_tarefas a', select: TAREFAS, id: 'a.id', order: 'a.id' },
  apontamentos: { from: 'eap_apontamentos a', date: 'a.data_do_input', id: 'a.id',
    select: `a.id, a.id_eap, a.data_do_input, a.status_qualidade, a.avanco_diario, a.meta_diaria, ${ADERENCIA_SQL} AS ADERENCIA_LINEAR`,
    order: 'a.data_do_input DESC, a.id' },
  alocacoes: { from: 'eap_apontamento_efetivo a', date: 'a.data_consulta', id: 'a.tarefa_id',
    select: 'a.tarefa_id, a.funcionario_id, a.funcionario_nome, a.nome_funcao, a.data_consulta',
    order: 'a.data_consulta DESC, a.tarefa_id, a.funcionario_id' },
  aderencia: { from: 'eap_apontamentos a LEFT JOIN eap_tarefas e ON e.id = a.id', date: 'a.data_do_input', id: 'a.id',
    select: `a.nome_obra AS OBRA, e.encarregado_nome AS \`RESPONSÁVEL\`, a.edt AS EDT,
      a.data_do_input AS DATA, a.meta_diaria AS \`META DO DIA\`, a.avanco_diario AS \`AVANÇO REGISTRADO\`, ${ADERENCIA_SQL} AS ADERENCIA_LINEAR`,
    order: 'a.data_do_input ASC, a.id' },
};

const idValido = v => typeof v === 'string' && /^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v));
export function diaValido(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
}

// RLS conferida em 21/09/2026: EAP/alocação têm SELECT public true;
// Apontamentos permite leitura anon true. Só campos já consumidos pelo painel.
export function criarDadosEapRouter(db) {
  const router = Router();
  for (const [name, spec] of Object.entries(fontes)) {
    router.get(`/${name}`, async (req, res) => {
      const where = [], params = [];
      const allowed = spec.date ? ['ids', 'desde', 'ate'] : ['ids', 'id_obra', 'id_eap', 'edt'];
      if (Object.keys(req.query).some(k => !allowed.includes(k))) return res.status(400).json({ erro: 'Filtro desconhecido.' });
      if (req.query.ids !== undefined) {
        const ids = typeof req.query.ids === 'string' ? req.query.ids.split(',') : [];
        if (!ids.length || ids.length > 200 || ids.some(v => !idValido(v))) return res.status(400).json({ erro: 'ids invalidos (maximo 200).' });
        where.push(`${spec.id} IN (?)`); params.push([...new Set(ids.map(Number))]);
      }
      if (spec.date) {
        const { desde, ate } = req.query;
        if (!diaValido(desde) || !diaValido(ate) || desde > ate) return res.status(400).json({ erro: 'Intervalo de datas invalido.' });
        if (desde < INICIO_HISTORICO) return res.status(422).json({ erro: 'Historico MySQL inicia em 2026-09-01.' });
        where.push(`${spec.date} >= ? AND ${spec.date} <= ?`); params.push(desde, ate);
        if (name !== 'aderencia' && !req.query.ids) return res.status(400).json({ erro: 'Informe ids.' });
      } else {
        for (const key of ['id_obra', 'id_eap']) {
          if (req.query[key] === undefined) continue;
          if (!idValido(req.query[key])) return res.status(400).json({ erro: `${key} invalido.` });
          where.push(`a.${key} = ?`); params.push(Number(req.query[key]));
        }
        if (req.query.edt !== undefined) {
          if (!req.query.id_eap || typeof req.query.edt !== 'string' || !req.query.edt.trim() || req.query.edt.length > 64) {
            return res.status(400).json({ erro: 'edt exige id_eap e texto de ate 64 caracteres.' });
          }
          where.push('a.edt = ?'); params.push(req.query.edt);
        }
        if (!where.length) return res.status(400).json({ erro: 'Informe ids, id_obra ou id_eap.' });
      }
      const match = /^(\d+)-(\d+)$/.exec(req.get('Range') || '0-999');
      const start = match ? Number(match[1]) : NaN, end = match ? Number(match[2]) : NaN;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start || end - start >= 1000 ||
          (req.get('Range-Unit') && req.get('Range-Unit') !== 'items')) {
        return res.status(400).json({ erro: 'Range invalido (maximo 1000 itens).' });
      }
      try {
        const [rows] = await db.query(`SELECT ${spec.select} FROM ${spec.from} WHERE ${where.join(' AND ')} ORDER BY ${spec.order} LIMIT ? OFFSET ?`, [...params, end - start + 1, start]);
        res.set('X-Data-Source', 'mysql').json(rows);
      } catch (e) {
        console.error(`[eap/${name}]`, e.code || 'falha de banco');
        res.status(503).json({ erro: 'Falha ao consultar dados EAP no MySQL.' });
      }
    });
  }
  return router;
}
