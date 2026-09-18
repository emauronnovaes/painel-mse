import { Router } from 'express';
import { pool } from '../db/pool.js';
import { cardsAtivosDaEap } from '../portal/hubAvancos.js';
import { cacheEstatisticas, ttlPadraoSegundos } from '../portal/clientePortal.js';

export const eapRouter = Router();

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

// Diagnóstico: o que está em cache e há quanto tempo. Útil para conferir se a
// tela está vendo dado fresco sem precisar de log do servidor.
eapRouter.get('/cache', (req, res) => res.json({ ttl_padrao_segundos: ttlPadraoSegundos(), entradas: cacheEstatisticas() }));
