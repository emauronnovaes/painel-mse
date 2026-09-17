import { Router } from 'express';
import { pool } from '../db/pool.js';

export const ingestRouter = Router();

// Autenticação simples por chave estática, server-to-server (n8n -> API).
// Não é o mesmo mecanismo de sessão de usuário (JWT do /auth) — ingestão não
// tem "usuário logado", tem um processo confiável com uma chave própria.
function exigirChaveIngestao(req, res, next) {
  const chave = req.headers['x-ingest-key'];
  if (!process.env.INGEST_API_KEY) {
    console.error('[ingest] INGEST_API_KEY nao configurada');
    return res.status(500).json({ erro: 'Funcao mal configurada.' });
  }
  if (chave !== process.env.INGEST_API_KEY) {
    return res.status(401).json({ erro: 'Chave de ingestao invalida.' });
  }
  next();
}

ingestRouter.use(exigirChaveIngestao);

// Sempre upsert por id_obra: o sync do PortalMSE resubstitui o snapshot
// inteiro a cada execução, não faz append.
ingestRouter.post('/restricoes', async (req, res) => {
  const { id_obra, total, restricoes } = req.body ?? {};

  if (!Number.isInteger(id_obra)) return res.status(400).json({ erro: 'id_obra invalido.' });
  if (restricoes === undefined || restricoes === null) {
    return res.status(400).json({ erro: 'restricoes e obrigatorio.' });
  }

  try {
    await pool.query(
      `INSERT INTO rest_restricoes (id_obra, total, restricoes)
       VALUES (?, ?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE total = VALUES(total), restricoes = VALUES(restricoes)`,
      [id_obra, total ?? null, JSON.stringify(restricoes)],
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ erro: `id_obra ${id_obra} nao existe em obras.` });
    }
    console.error('[ingest/restricoes] falha ao gravar', err);
    res.status(500).json({ erro: 'Falha ao gravar restricoes.' });
  }
});
