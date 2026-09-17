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

// Colunas que o Apps Script de Medições ("Saldo a Faturar") envia — extra
// como `atualizado_em` no payload é ignorado de propósito: quem controla
// esse timestamp é o MySQL (`ON UPDATE CURRENT_TIMESTAMP`), não o cliente.
const COLUNAS_MED_CONTRATOS = [
  'cp_codigo', 'gestor', 'contrato_nome', 'valor_contrato',
  'valor_contrato_original', 'valor_ocs', 'valor_total', 'iss_fracao',
  'prazo_vencimento_dias', 'nota_planilha',
];
const COLUNAS_MED_BOLETINS = [
  'cp_codigo', 'linha_planilha', 'bm_label', 'periodo_inicio', 'periodo_fim',
  'valor_previsto', 'tendencia', 'valor_medido', 'desconto_fd', 'retencao',
  'valor_faturado', 'data_faturamento', 'status_faturamento', 'iss_valor',
  'desconto_adiantamento', 'valor_recebimento_previsto', 'valor_recebimento_real',
  'vencimento', 'data_recebimento', 'status_recebimento', 'saldo_previsto_acumulado',
  'saldo_realizado_acumulado_medido', 'avanco_previsto_acumulado',
  'avanco_realizado_acumulado', 'observacao',
];

function montarLinhas(itens, colunas) {
  return itens.map(item => colunas.map(c => (item[c] === undefined ? null : item[c])));
}

// Upsert em lote: o Apps Script resubstitui o snapshot inteiro a cada
// sincronização manual/agendada, sempre por (cp_codigo) ou
// (cp_codigo, linha_planilha) — nunca por número de BM, que pode se
// repetir dentro do mesmo contrato (ver comentário no .gs de origem).
ingestRouter.post('/medicoes/contratos', async (req, res) => {
  const itens = req.body;
  if (!Array.isArray(itens) || !itens.length) {
    return res.status(400).json({ erro: 'Envie um array de contratos, nao vazio.' });
  }
  if (itens.some(i => !i || typeof i.cp_codigo !== 'string' || !i.cp_codigo.trim())) {
    return res.status(400).json({ erro: 'Todo item precisa de cp_codigo.' });
  }

  const linhas = montarLinhas(itens, COLUNAS_MED_CONTRATOS);
  const atualiza = COLUNAS_MED_CONTRATOS.filter(c => c !== 'cp_codigo').map(c => `${c} = VALUES(${c})`).join(', ');

  try {
    await pool.query(
      `INSERT INTO med_contratos (${COLUNAS_MED_CONTRATOS.join(', ')}) VALUES ?
       ON DUPLICATE KEY UPDATE ${atualiza}`,
      [linhas],
    );
    res.json({ ok: true, gravados: itens.length });
  } catch (err) {
    console.error('[ingest/medicoes/contratos] falha ao gravar', err);
    res.status(500).json({ erro: 'Falha ao gravar contratos.' });
  }
});

ingestRouter.post('/medicoes/boletins', async (req, res) => {
  const itens = req.body;
  if (!Array.isArray(itens) || !itens.length) {
    return res.status(400).json({ erro: 'Envie um array de boletins, nao vazio.' });
  }
  if (itens.some(i => !i || typeof i.cp_codigo !== 'string' || !Number.isInteger(i.linha_planilha))) {
    return res.status(400).json({ erro: 'Todo item precisa de cp_codigo e linha_planilha (inteiro).' });
  }

  const linhas = montarLinhas(itens, COLUNAS_MED_BOLETINS);
  const atualiza = COLUNAS_MED_BOLETINS
    .filter(c => c !== 'cp_codigo' && c !== 'linha_planilha')
    .map(c => `${c} = VALUES(${c})`).join(', ');

  try {
    await pool.query(
      `INSERT INTO med_boletins (${COLUNAS_MED_BOLETINS.join(', ')}) VALUES ?
       ON DUPLICATE KEY UPDATE ${atualiza}`,
      [linhas],
    );
    res.json({ ok: true, gravados: itens.length });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ erro: 'cp_codigo referenciado nao existe em med_contratos — envie os contratos primeiro.' });
    }
    console.error('[ingest/medicoes/boletins] falha ao gravar', err);
    res.status(500).json({ erro: 'Falha ao gravar boletins.' });
  }
});
