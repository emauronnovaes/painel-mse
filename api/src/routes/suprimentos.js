import { Router } from 'express';
import { pool } from '../db/pool.js';

export const suprimentosRouter = Router();

// Mesmos 13 campos de `raw` que `ModuloSuprimentos` (prototipo/index.html)
// realmente lê — ver `FIELDS_RAW_ITENS_RMI` lá. Duplicado aqui de propósito
// (a API não importa código do front).
const FIELDS_RAW_ITENS_RMI = [
  'id_rmi', 'codigo_seq', 'nivel', 'descricao', 'unidade', 'nome_rmi',
  'subtotal_custo_meta_orcamento', 'saldo_orcamentario', 'desvio_saldo_orcamentario',
  'total_consumido', 'finalizado', 'data_necessidade_compra', 'prazo_entrega',
];

// Extrai os campos DENTRO do SQL (`raw->'$.campo'`), não traz a coluna
// `raw` inteira pro Node pra filtrar depois — achado ao medir: trazer
// `raw` inteiro (20+ campos, alguns grandes) levava 4s pra 6162 linhas;
// só os 13 campos direto no SQL caiu pra ~1,7s (mesmo problema de egress
// que a equipe já tinha resolvido no Supabase com `raw->campo` no
// `select`, reintroduzido aqui sem querer na 1ª versão). `->` (não `->>`)
// preserva o tipo original (número/boolean) — testado contra dado real,
// mysql2 devolve os tipos certos de qualquer forma. Nomes de coluna vêm
// de uma constante fixa no código (nunca de input), sem risco de injeção
// ao interpolar no SQL.
const SELECT_CAMPOS_RAW = FIELDS_RAW_ITENS_RMI.map((c) => `raw->'$.${c}' as ${c}`).join(', ');

// Leitura pública, mesmo padrão de restricoes.js — RMI não tem RLS
// financeira no Supabase (confirmado antes de expor, ver lição de
// Medições/OC no docs/16). Devolve campos top-level (`{id, codigo_seq,
// nivel, ...}`), igual ao `select=id,campo:raw->campo` que o Supabase
// fazia — minimiza a mudança do lado do `prototipo`.
suprimentosRouter.get('/rmi', async (req, res) => {
  const idObra = Number(req.query.id_obra);
  if (!Number.isInteger(idObra)) return res.status(400).json({ erro: 'id_obra invalido.' });

  try {
    const [rows] = await pool.query(
      `SELECT id, ${SELECT_CAMPOS_RAW} FROM sup_rmi WHERE id_obra = ?`,
      [idObra],
    );
    res.json(rows);
  } catch (err) {
    console.error('[suprimentos/rmi] falha ao ler', err);
    res.status(500).json({ erro: 'Falha ao ler itens de RMI.' });
  }
});

// Mapa de Compras — colunas próprias (não `raw`), mesmos campos que o
// `prototipo` já pedia via `select` no Supabase (achado de egress lá:
// CNPEM sozinha tinha 5,6MB de `raw` nessa consulta — o corte continua
// valendo). Sem RLS financeira (conferido antes de expor, mesma checagem
// da lição de Medições/OC).
suprimentosRouter.get('/mapa-compras/requisicoes', async (req, res) => {
  const idObra = Number(req.query.id_obra);
  if (!Number.isInteger(idObra)) return res.status(400).json({ erro: 'id_obra invalido.' });

  try {
    const [rows] = await pool.query(
      `SELECT id, id_rmi, nome_rmi, requisicao, requisicao_tipo, tipo, grupo, categoria,
              descricao, status_requisicao, data_cadastro, data_necessidade, requisitante,
              data_cronograma_fechado, solicitacao_enviada, necessario_contrato,
              necessario_art, total_itens
       FROM sup_mapa_compras_requisicoes WHERE id_obra = ?`,
      [idObra],
    );
    res.json(rows);
  } catch (err) {
    console.error('[suprimentos/mapa-compras/requisicoes] falha ao ler', err);
    res.status(500).json({ erro: 'Falha ao ler requisicoes.' });
  }
});

suprimentosRouter.get('/mapa-compras/itens', async (req, res) => {
  const idObra = Number(req.query.id_obra);
  if (!Number.isInteger(idObra)) return res.status(400).json({ erro: 'id_obra invalido.' });

  try {
    const [rows] = await pool.query(
      `SELECT id, id_mapa_compras, codigo_seq, descricao, unidade, quantidade,
              tem_pedido, fornecedor_ref, subtotal_referencia_bd_s1
       FROM sup_mapa_compras_itens WHERE id_obra = ?`,
      [idObra],
    );
    res.json(rows);
  } catch (err) {
    console.error('[suprimentos/mapa-compras/itens] falha ao ler', err);
    res.status(500).json({ erro: 'Falha ao ler itens de mapa de compras.' });
  }
});
