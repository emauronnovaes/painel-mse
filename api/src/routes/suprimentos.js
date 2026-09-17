import { Router } from 'express';
import { pool } from '../db/pool.js';

export const suprimentosRouter = Router();

// Mesmos 13 campos de `raw` que `ModuloSuprimentos` (prototipo/index.html)
// realmente lê — ver `FIELDS_RAW_ITENS_RMI` lá. Duplicado aqui de propósito
// (a API não importa código do front): achatar em JS, não em SQL, evita
// ambiguidade de tipo do MySQL (`raw->'$.campo'` teria que ser testado pra
// garantir que preserva número/boolean, e a extração em JS já garante
// isso de graça — `raw` chega parseado como objeto normal do mysql2).
const FIELDS_RAW_ITENS_RMI = [
  'id_rmi', 'codigo_seq', 'nivel', 'descricao', 'unidade', 'nome_rmi',
  'subtotal_custo_meta_orcamento', 'saldo_orcamentario', 'desvio_saldo_orcamentario',
  'total_consumido', 'finalizado', 'data_necessidade_compra', 'prazo_entrega',
];

// Leitura pública, mesmo padrão de restricoes.js — RMI não tem RLS
// financeira no Supabase (confirmado antes de expor, ver lição de
// Medições/OC no docs/16). Achata `raw` em campos top-level
// (`{id, codigo_seq, nivel, ...}`), igual ao `select=id,campo:raw->campo`
// que o Supabase fazia — minimiza a mudança do lado do `prototipo`.
suprimentosRouter.get('/rmi', async (req, res) => {
  const idObra = Number(req.query.id_obra);
  if (!Number.isInteger(idObra)) return res.status(400).json({ erro: 'id_obra invalido.' });

  try {
    const [rows] = await pool.query('SELECT id, raw FROM sup_rmi WHERE id_obra = ?', [idObra]);
    const achatado = rows.map((r) => {
      const linha = { id: r.id };
      FIELDS_RAW_ITENS_RMI.forEach((c) => { linha[c] = r.raw[c] ?? null; });
      return linha;
    });
    res.json(achatado);
  } catch (err) {
    console.error('[suprimentos/rmi] falha ao ler', err);
    res.status(500).json({ erro: 'Falha ao ler itens de RMI.' });
  }
});
