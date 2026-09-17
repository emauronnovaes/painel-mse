import { Router } from 'express';
import { pool } from '../db/pool.js';
import { exigirAcessoFinanceiroCp } from '../auth/financeiroSupabase.js';

export const medicoesRouter = Router();

// Medições é financeiro (docs/15, "financeiro por obra") — diferente de
// Restrições, que não tem recorte nenhum. Exige sessão válida + acesso ao
// cp_codigo pedido (ver auth/financeiroSupabase.js). Devolve ARRAY (0 ou 1
// item), igual o `select=*` do Supabase devolvia — minimiza a mudança do
// lado do `prototipo`.
medicoesRouter.use(exigirAcessoFinanceiroCp);

medicoesRouter.get('/contrato', async (req, res) => {
  const cpCodigo = String(req.query.cp_codigo || '').trim();
  if (!cpCodigo) return res.status(400).json({ erro: 'cp_codigo invalido.' });

  try {
    const [rows] = await pool.query('SELECT * FROM med_contratos WHERE cp_codigo = ?', [cpCodigo]);
    res.json(rows);
  } catch (err) {
    console.error('[medicoes/contrato] falha ao ler', err);
    res.status(500).json({ erro: 'Falha ao ler contrato.' });
  }
});

medicoesRouter.get('/boletins', async (req, res) => {
  const cpCodigo = String(req.query.cp_codigo || '').trim();
  if (!cpCodigo) return res.status(400).json({ erro: 'cp_codigo invalido.' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM med_boletins WHERE cp_codigo = ? ORDER BY linha_planilha ASC',
      [cpCodigo],
    );
    res.json(rows);
  } catch (err) {
    console.error('[medicoes/boletins] falha ao ler', err);
    res.status(500).json({ erro: 'Falha ao ler boletins.' });
  }
});
