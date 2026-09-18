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

// Mesmo padrão de /restricoes: upsert por id_obra, snapshot inteiro
// resubstituído a cada sync do n8n.
ingestRouter.post('/oc', async (req, res) => {
  const { id_obra, total, ocs, resumo } = req.body ?? {};

  if (!Number.isInteger(id_obra)) return res.status(400).json({ erro: 'id_obra invalido.' });
  if (ocs === undefined || ocs === null) return res.status(400).json({ erro: 'ocs e obrigatorio.' });

  try {
    await pool.query(
      `INSERT INTO oc_orcamentos (id_obra, total, ocs, resumo)
       VALUES (?, ?, CAST(? AS JSON), CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE total = VALUES(total), ocs = VALUES(ocs), resumo = VALUES(resumo)`,
      [id_obra, total ?? null, JSON.stringify(ocs), resumo === undefined ? null : JSON.stringify(resumo)],
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ erro: `id_obra ${id_obra} nao existe em obras.` });
    }
    console.error('[ingest/oc] falha ao gravar', err);
    res.status(500).json({ erro: 'Falha ao gravar orcamentos complementares.' });
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

// Reconstrução do fluxo "Avanço físico/EAP" (n8n perdido junto com a
// máquina Oracle Cloud, 18/09/2026). 2 rotas, mesma separação do n8n:
// "estrutura" (o que só muda quando o planejamento muda) e "avanco-diario"
// (o que muda a cada apontamento). Nunca a mesma rota grava as duas coisas,
// pra uma não pisar na outra.
const COLUNAS_EAP_ESTRUTURA = [
  'id', 'id_obra', 'nome_obra', 'id_eap_grupo', 'edt', 'tarefa', 'disciplina',
  'local', 'unidade', 'qtd', 'saldo_qtd', 'efetivo_previsto', 'ponderacao_reais',
  'ponderacao_hht', 'data_inicio', 'data_termino', 'data_inicio_reprogramado',
  'data_termino_reprogramado', 'encarregado_nome',
];
const COLUNAS_CARDS_ATIVOS = [
  'card_id', 'id_eap_grupo', 'nome_eap', 'id_obra', 'nome_obra', 'edt', 'tarefa',
  'resp_planejamento', 'responsavel_encarregado', 'supervisor_coordenador', 'sincronizado_em',
];
const COLUNAS_APONTAMENTO = [
  'tarefa_id', 'id_eap_grupo', 'nome_eap', 'nome_obra', 'data_do_input', 'edt',
  'tarefa', 'qtd', 'unidade', 'avanco_atual', 'avanco_atual_p100', 'avanco_diario',
  'usuario_avanco_diario', 'uuid_origem', 'meta_diaria', 'status_qualidade',
];
// Campos de progresso que TAMBÉM viram um UPDATE em `eap_tarefas` (snapshot
// da tarefa) — o fluxo "estrutura" nunca toca nessas colunas, só este.
const COLUNAS_SNAPSHOT_TAREFA = ['avanco_atual', 'desvio', 'meta_diaria', 'avanco_diario', 'status_qualidade', 'hht_consumido'];

// `eap_tarefas` — upsert por `id` (o próprio id da tarefa na origem, igual
// `sup_rmi`). Nunca inclui as colunas de snapshot (ver `COLUNAS_SNAPSHOT_TAREFA`)
// no INSERT nem no UPDATE, pra não sobrescrever com NULL o que o outro
// fluxo já gravou.
ingestRouter.post('/eap/estrutura', async (req, res) => {
  const itens = req.body;
  if (!Array.isArray(itens) || !itens.length) {
    return res.status(400).json({ erro: 'Envie um array de tarefas, nao vazio.' });
  }
  if (itens.some(i => !i || !Number.isInteger(i.id) || !Number.isInteger(i.id_obra))) {
    return res.status(400).json({ erro: 'Toda tarefa precisa de id e id_obra (inteiros).' });
  }

  const linhas = montarLinhas(itens, COLUNAS_EAP_ESTRUTURA);
  const atualiza = COLUNAS_EAP_ESTRUTURA.filter(c => c !== 'id').map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
  const colunasSql = COLUNAS_EAP_ESTRUTURA.map(c => `\`${c}\``).join(', ');

  try {
    await pool.query(
      `INSERT INTO eap_tarefas (${colunasSql}) VALUES ? ON DUPLICATE KEY UPDATE ${atualiza}`,
      [linhas],
    );
    res.json({ ok: true, gravados: itens.length });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ erro: 'id_obra referenciado nao existe em obras.' });
    }
    console.error('[ingest/eap/estrutura] falha ao gravar', err);
    res.status(500).json({ erro: 'Falha ao gravar estrutura de EAP.' });
  }
});

// `eap_cards_ativos` — mesmo padrão, upsert por `card_id`. Depende de
// `eap_tarefas` já ter a linha correspondente (FK) — sempre chamar
// /eap/estrutura ANTES desta na mesma rodada.
ingestRouter.post('/eap/cards-ativos', async (req, res) => {
  const itens = req.body;
  if (!Array.isArray(itens) || !itens.length) {
    return res.status(400).json({ erro: 'Envie um array de cards, nao vazio.' });
  }
  if (itens.some(i => !i || !Number.isInteger(i.card_id) || !Number.isInteger(i.id_obra))) {
    return res.status(400).json({ erro: 'Todo card precisa de card_id e id_obra (inteiros).' });
  }

  const linhas = montarLinhas(itens, COLUNAS_CARDS_ATIVOS);
  const atualiza = COLUNAS_CARDS_ATIVOS.filter(c => c !== 'card_id').map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
  const colunasSql = COLUNAS_CARDS_ATIVOS.map(c => `\`${c}\``).join(', ');

  try {
    await pool.query(
      `INSERT INTO eap_cards_ativos (${colunasSql}) VALUES ? ON DUPLICATE KEY UPDATE ${atualiza}`,
      [linhas],
    );
    res.json({ ok: true, gravados: itens.length });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ erro: 'id_obra ou card_id (tarefa) referenciado nao existe.' });
    }
    console.error('[ingest/eap/cards-ativos] falha ao gravar', err);
    res.status(500).json({ erro: 'Falha ao gravar cards ativos.' });
  }
});

// `eap_apontamentos` (upsert por tarefa_id+data_do_input) + UPDATE do
// snapshot em `eap_tarefas` — as 2 gravações do "avanço do dia" numa rota
// só, pra garantir que sempre andam juntas (nunca um apontamento gravado
// sem o snapshot da tarefa refletir o mesmo dado, ou vice-versa).
ingestRouter.post('/eap/avanco-diario', async (req, res) => {
  const itens = req.body;
  if (!Array.isArray(itens) || !itens.length) {
    return res.status(400).json({ erro: 'Envie um array de avancos, nao vazio.' });
  }
  if (itens.some(i => !i || !Number.isInteger(i.tarefa_id) || !i.data_do_input)) {
    return res.status(400).json({ erro: 'Todo avanco precisa de tarefa_id (inteiro) e data_do_input.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const linhas = montarLinhas(itens, COLUNAS_APONTAMENTO);
    const atualizaApontamento = COLUNAS_APONTAMENTO
      .filter(c => c !== 'tarefa_id' && c !== 'data_do_input')
      .map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
    const colunasApontamentoSql = COLUNAS_APONTAMENTO.map(c => `\`${c}\``).join(', ');
    await conn.query(
      `INSERT INTO eap_apontamentos (${colunasApontamentoSql}) VALUES ? ON DUPLICATE KEY UPDATE ${atualizaApontamento}`,
      [linhas],
    );

    // Snapshot em eap_tarefas: 1 UPDATE por item (lote tipicamente pequeno,
    // 1 execução do fluxo por tarefa) — não dá pra fazer em lote único
    // porque cada tarefa tem valores diferentes e não é upsert (a linha já
    // existe, criada pelo fluxo de estrutura).
    for (const item of itens) {
      const valores = COLUNAS_SNAPSHOT_TAREFA.map(c => (item[c] === undefined ? null : item[c]));
      await conn.query(
        `UPDATE eap_tarefas SET ${COLUNAS_SNAPSHOT_TAREFA.map(c => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
        [...valores, item.tarefa_id],
      );
    }

    await conn.commit();
    res.json({ ok: true, gravados: itens.length });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ erro: 'tarefa_id referenciado nao existe em eap_tarefas.' });
    }
    console.error('[ingest/eap/avanco-diario] falha ao gravar', err);
    res.status(500).json({ erro: 'Falha ao gravar avanco diario.' });
  } finally {
    conn.release();
  }
});
