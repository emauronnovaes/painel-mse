import { Router } from 'express';
import { pool } from '../db/pool.js';
import { cardsAtivosDaEap } from '../portal/hubAvancos.js';
import { cacheEstatisticas, ttlPadraoSegundos } from '../portal/clientePortal.js';
import { criarCardsRouter } from './eapCards.js';
import { criarDadosEapRouter } from './eapDados.js';

export const eapRouter = Router();
// /cards lê o snapshot MySQL. /cards-ativos conserva o contrato legado do Hub.
eapRouter.use('/cards', criarCardsRouter(pool));
eapRouter.use(criarDadosEapRouter(pool));

// Leitura pública, mesmo nível das outras rotas de leitura (restricoes/
// suprimentos): cards ativos não têm RLS por obra no Supabase — conferido em
// `pg_policies` antes de expor, como manda a lição de Medições no docs/16.
//
// A diferença desta rota para todas as outras: a fonte NÃO é o MySQL, é a API
// do Hub na hora do pedido. O banco entra só para responder "quais EAPs são
// desta obra" (ver abaixo).

// O front raciocina por obra; o Hub, por EAP. Esse de-para hoje só existe em
// dois lugares: a lista manual dentro dos fluxos n8n e a própria `eap_tarefas`,
// que carrega `id_eap` + `id_obra` vindos do próprio Hub. Usar a tabela evita
// mais uma lista hardcoded para alguém esquecer de atualizar quando entrar obra
// nova. É a única leitura de banco que sobra neste caminho — se um dia
// `eap_tarefas` também virar chamada direta, isto aqui vira uma tabela de
// catálogo de 15 linhas, não um problema.
async function eapsDaObra(idObra) {
  const [rows] = await pool.query(
    'SELECT DISTINCT id_eap FROM eap_tarefas WHERE id_obra = ? AND id_eap IS NOT NULL ORDER BY id_eap',
    [idObra],
  );
  return rows.map((r) => r.id_eap);
}

eapRouter.get('/cards-ativos', async (req, res) => {
  const idEapDireto = req.query.id_eap !== undefined ? Number(req.query.id_eap) : null;
  const idObra = req.query.id_obra !== undefined ? Number(req.query.id_obra) : null;

  if (idEapDireto === null && idObra === null) {
    return res.status(400).json({ erro: 'Informe id_obra ou id_eap.' });
  }
  if (idEapDireto !== null && !Number.isInteger(idEapDireto)) {
    return res.status(400).json({ erro: 'id_eap invalido.' });
  }
  if (idObra !== null && !Number.isInteger(idObra)) {
    return res.status(400).json({ erro: 'id_obra invalido.' });
  }

  try {
    const eaps = idEapDireto !== null ? [idEapDireto] : await eapsDaObra(idObra);
    if (eaps.length === 0) {
      return res.json({ cards: [], eaps: [], origem: 'hub_mse', aviso: 'Nenhuma EAP conhecida para esta obra.' });
    }

    // Em paralelo de propósito: são poucas EAPs por obra (1 a 3) e cada chamada
    // ao Hub é lenta; em série o pior caso seria a soma, não o máximo. O cache
    // do módulo já impede que chamadas repetidas virem tráfego repetido.
    const resultados = await Promise.allSettled(eaps.map((id) => cardsAtivosDaEap(id)));

    const cards = [];
    const falhas = [];
    let algumVelho = false;
    let idadeMax = 0;

    resultados.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        cards.push(...r.value.cards);
        if (r.value.velho) algumVelho = true;
        idadeMax = Math.max(idadeMax, r.value.idadeSegundos || 0);
      } else {
        falhas.push({ id_eap: eaps[i], erro: r.reason?.message || String(r.reason) });
      }
    });

    // Falha parcial é resposta 200 com a lista do que deu certo + `falhas`
    // preenchido: o Hub é reconhecidamente instável (ver docs/16, Mapa de
    // Compras), e derrubar a tela inteira porque uma EAP não respondeu seria
    // pior do que mostrar o resto. Mas a falha NÃO fica escondida — o front
    // tem como avisar, e o log registra.
    if (falhas.length) console.warn('[eap/cards-ativos] EAPs sem resposta:', falhas);
    if (falhas.length === eaps.length) {
      return res.status(502).json({ erro: 'Hub MSE nao respondeu.', falhas });
    }

    res.json({
      cards,
      eaps,
      origem: 'hub_mse',
      cache: { velho: algumVelho, idade_segundos: idadeMax },
      falhas,
    });
  } catch (err) {
    console.error('[eap/cards-ativos] falha', err);
    res.status(500).json({ erro: 'Falha ao consultar cards ativos.' });
  }
});

// Índice financeiro por tarefa num dia — substitui a leitura direta que o
// front fazia da view `v_indices_financeiros_diario` no Supabase.
//
// Lê do MySQL, NÃO da API do Portal, e isso foi medido antes de decidir
// (21/09/2026): `receita_custos` responde em ~10s para EAP pequena mas leva
// **73 a 96 segundos** para a `id_eap` 51 (obra 91), independente da janela
// pedida — 180 dias não voltou nem em 120s. Consulta direta na hora, como em
// `/cards-ativos`, não se sustenta nesse tempo. Quem paga a espera é o fluxo
// n8n "Financeiro API - Relatório de custos", de madrugada.
//
// `dia` é a Data de Status que a tela já resolveu (pela Aderência). Quem
// decide o dia é o front, não esta rota: ela não tem como saber qual dia a
// tela está exibindo, e inventar um aqui reintroduziria a divergência entre
// tabela e popup que existiu de 10/09 a 21/09.
const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;

eapRouter.get('/indices-financeiros', async (req, res) => {
  const idEapDireto = req.query.id_eap !== undefined ? Number(req.query.id_eap) : null;
  const idObra = req.query.id_obra !== undefined ? Number(req.query.id_obra) : null;
  const dia = String(req.query.dia || '');

  if (idEapDireto === null && idObra === null) {
    return res.status(400).json({ erro: 'Informe id_obra ou id_eap.' });
  }
  if (idEapDireto !== null && !Number.isInteger(idEapDireto)) {
    return res.status(400).json({ erro: 'id_eap invalido.' });
  }
  if (idObra !== null && !Number.isInteger(idObra)) {
    return res.status(400).json({ erro: 'id_obra invalido.' });
  }
  if (!ISO_DIA.test(dia)) {
    return res.status(400).json({ erro: 'Informe dia no formato YYYY-MM-DD.' });
  }

  try {
    const eaps = idEapDireto !== null ? [idEapDireto] : await eapsDaObra(idObra);
    if (eaps.length === 0) {
      return res.json({ indices: [], eaps: [], dia, origem: 'mysql', aviso: 'Nenhuma EAP conhecida para esta obra.' });
    }

    // DATE_FORMAT em vez de devolver o DATE cru: o driver converteria para
    // `Date`, o JSON viraria ISO com hora, e o front compara string de 10
    // caracteres. Formatar aqui tira o fuso da equação.
    const [linhas] = await pool.query(
      `SELECT tarefa_id,
              id_eap,
              DATE_FORMAT(data_referencia, '%Y-%m-%d') AS data,
              avanco_total,
              receita,
              custo_incorrido,
              indice_receita_custo_incorrido,
              sem_custo
         FROM fin_medicao_acumulada
        WHERE data_referencia = ?
          AND id_eap IN (?)`,
      [dia, eaps],
    );

    // Dia sem nenhuma linha não é erro: pode ser fim de semana, feriado, ou o
    // fluxo ainda não ter rodado para esse dia. O front já trata "sem valor"
    // como "—", o mesmo que fazia quando a view não tinha a linha.
    res.json({
      indices: linhas.map((l) => ({
        tarefa_id: Number(l.tarefa_id),
        id_eap: l.id_eap === null ? null : Number(l.id_eap),
        data: l.data,
        avanco_total: l.avanco_total === null ? null : Number(l.avanco_total),
        receita: l.receita === null ? null : Number(l.receita),
        custo_incorrido: l.custo_incorrido === null ? null : Number(l.custo_incorrido),
        indice_receita_custo_incorrido: l.indice_receita_custo_incorrido === null
          ? null : Number(l.indice_receita_custo_incorrido),
        sem_custo: Boolean(l.sem_custo),
      })),
      eaps,
      dia,
      origem: 'mysql',
      falhas: [],
    });
  } catch (err) {
    console.error('[eap/indices-financeiros] falha', err);
    res.status(500).json({ erro: 'Falha ao consultar indices financeiros.' });
  }
});

// Diagnóstico: o que está em cache e há quanto tempo. Útil para conferir se a
// tela está vendo dado fresco sem precisar de log do servidor.
eapRouter.get('/cache', (req, res) => res.json({ ttl_padrao_segundos: ttlPadraoSegundos(), entradas: cacheEstatisticas() }));
