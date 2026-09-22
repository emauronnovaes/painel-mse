import { Router } from 'express';

// Snapshot sincronizado pelo GitHub Actions (mse-avancos-sync). Políticas
// conferidas em pg_policies em 21/09/2026: cards_ativos permite SELECT público
// (qual=true). Não expor colunas administrativas nem usar SELECT *.
const CAMPOS = `card_id, id_eap_tabela, nome_eap, id_obra, nome_obra, edt,
  tarefa, resp_planejamento, responsavel_encarregado, supervisor_coordenador`;

export function criarCardsRouter(db) {
  const router = Router();
  router.get('/', async (req, res) => {
    const where = [], values = [];
    const permitidos = new Set(['id_obra', 'id_eap', 'encarregado', 'com_encarregado']);
    if (Object.keys(req.query).some(key => !permitidos.has(key))) {
      return res.status(400).json({ erro: 'Filtro desconhecido.' });
    }
    for (const [param, coluna] of [['id_obra', 'id_obra'], ['id_eap', 'id_eap_tabela']]) {
      if (req.query[param] === undefined) continue;
      const value = req.query[param];
      if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
        return res.status(400).json({ erro: `${param} invalido.` });
      }
      where.push(`${coluna} = ?`); values.push(Number(value));
    }
    if (req.query.com_encarregado !== undefined) {
      if (!['true', 'false'].includes(req.query.com_encarregado)) {
        return res.status(400).json({ erro: 'com_encarregado invalido.' });
      }
      if (req.query.com_encarregado === 'true') where.push('responsavel_encarregado IS NOT NULL');
    }
    if (req.query.encarregado !== undefined) {
      const nome = req.query.encarregado;
      if (typeof nome !== 'string' || !nome.trim() || nome.length > 255) {
        return res.status(400).json({ erro: 'encarregado invalido.' });
      }
      // Busca parcial sem interpolação de SQL nem curingas fornecidos pelo usuário.
      // as_ci: ignora caixa, mas preserva acentos como o ILIKE da origem.
      where.push("responsavel_encarregado COLLATE utf8mb4_0900_as_ci LIKE ? ESCAPE '!'");
      values.push(`%${nome.trim().replace(/[!%_]/g, '!$&')}%`);
    }
    const range = req.get('Range') || '0-999';
    const match = /^(\d+)-(\d+)$/.exec(range);
    const inicio = match ? Number(match[1]) : NaN;
    const fim = match ? Number(match[2]) : NaN;
    if ((req.get('Range-Unit') && req.get('Range-Unit') !== 'items') ||
        !Number.isSafeInteger(inicio) || !Number.isSafeInteger(fim) ||
        fim < inicio || fim - inicio >= 1000) {
      return res.status(400).json({ erro: 'Range invalido: use inicio-fim, no maximo 1000 itens.' });
    }
    try {
      const [rows] = await db.query(
        `SELECT ${CAMPOS} FROM eap_cards_ativos${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
         ORDER BY nome_obra ASC, edt ASC, card_id ASC LIMIT ? OFFSET ?`,
        [...values, fim - inicio + 1, inicio],
      );
      // Array + página final vazia preservam o contrato de fetchPaginado.
      // Sem fallback silencioso para Hub/Supabase: erro não é lista vazia.
      return res.set('X-Data-Source', 'mysql').json(rows);
    } catch (err) {
      console.error('[eap/cards] consulta falhou:', err.code || 'erro de banco');
      return res.status(503).json({ erro: 'Falha ao consultar cards ativos no MySQL.' });
    }
  });
  return router;
}
