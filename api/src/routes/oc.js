import { Router } from 'express';
import { pool } from '../db/pool.js';
import { exigirAcessoFinanceiroObra } from '../auth/financeiroSupabase.js';

export const ocRouter = Router();

// OC/CO é financeiro (docs/15, "financeiro por obra", mesma restrição de
// Medições) — exige sessão válida + acesso ao id_obra pedido. Devolve
// ARRAY (0 ou 1 item), igual o `select=*` do Supabase devolvia.
ocRouter.use(exigirAcessoFinanceiroObra);

ocRouter.get('/', async (req, res) => {
  const idObra = Number(req.query.id_obra);
  if (!Number.isInteger(idObra)) return res.status(400).json({ erro: 'id_obra invalido.' });

  try {
    const [rows] = await pool.query(
      'SELECT ocs, resumo, total, atualizado_em FROM oc_orcamentos WHERE id_obra = ?',
      [idObra],
    );
    res.json(rows);
  } catch (err) {
    console.error('[oc] falha ao ler', err);
    res.status(500).json({ erro: 'Falha ao ler orcamentos complementares.' });
  }
});
