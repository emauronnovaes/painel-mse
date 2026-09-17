import { Router } from 'express';
import { pool } from '../db/pool.js';

export const restricoesRouter = Router();

// Leitura pública (mesmo nível de acesso do `anon` no Supabase hoje) — o
// domínio Restrições EAP não tem RLS por obra/e-mail, então não há controle
// de acesso a reproduzir aqui. Autenticação por sessão (portada na Etapa 0,
// `auth/portalSso.js`) só passa a valer nas leituras quando a Etapa 5 cortar
// o SSO para a API nova; até lá, o consumo do `prototipo` continua sem
// token nas rotas de leitura, igual está hoje contra o Supabase.
restricoesRouter.get('/', async (req, res) => {
  const id_obra = Number(req.query.id_obra);
  if (!Number.isInteger(id_obra)) return res.status(400).json({ erro: 'id_obra invalido.' });

  try {
    const [rows] = await pool.query(
      'SELECT restricoes, atualizado_em FROM rest_restricoes WHERE id_obra = ?',
      [id_obra],
    );
    // Sem linha para a obra é estado válido (ainda sem sync/sem restrição
    // cadastrada) — não é erro, o `prototipo` trata como lista vazia.
    if (rows.length === 0) return res.status(404).json({ erro: 'Sem restricoes para esta obra.' });
    res.json({ restricoes: rows[0].restricoes, atualizado_em: rows[0].atualizado_em });
  } catch (err) {
    console.error('[restricoes] falha ao ler', err);
    res.status(500).json({ erro: 'Falha ao ler restricoes.' });
  }
});
