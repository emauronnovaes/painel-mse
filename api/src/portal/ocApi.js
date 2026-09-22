// Orçamentos Complementares (OC/CO) direto da API do Portal, sem passar por
// `oc_orcamentos`.
//
// Microserviço SEPARADO do hub_mse: URL e token próprios (a doc do Portal avisa
// que chave de um serviço no outro dá 403 — foi assim com rmi_api x
// mapa_compras_api).
//
// São DOIS recursos, como o fluxo n8n já fazia: a lista de OCs e o resumo
// (totais por status). O front consome `ocs` e `resumo.data`.
//
// ⚠️ OC/CO é dado FINANCEIRO com restrição por obra (docs/15). Trocar a fonte
// não afrouxa nada: o guard `exigirAcessoFinanceiroObra` continua na rota,
// antes de qualquer chamada daqui. E ver `filtrarDaObra` abaixo — a API tem uma
// armadilha que torna esse filtro obrigatório.
import { buscarComCache } from './clientePortal.js';

const BASE = (process.env.OC_API_URL || 'https://portalmse.com.br/microservices/orcamentos_complementares_api')
  .replace(/\/+$/, '');

// Caminhos confirmados contra a API real (18/09/2026, sondagem com token do
// .env). Ficam em env por precaução, mas os defaults são os que respondem.
//
// ⚠️ NÃO trocar `obra_id` por `id_obra` na query: com `id_obra` a API IGNORA o
// filtro e devolve as 301 OCs de TODAS as obras, com HTTP 200 e sem aviso.
// E `v1/orcamentos_complementares/{n}` não é "por obra" — `{n}` ali é o id da
// OC (pedir 91 devolve a OC nº 61, da obra 107).
const CAMINHO_OCS = process.env.OC_API_PATH || 'v1/orcamentos_complementares?obra_id={id_obra}';
const CAMINHO_RESUMO = process.env.OC_API_RESUMO_PATH || 'v1/resumo?obra_id={id_obra}';
const TOKEN = () => process.env.OC_API_TOKEN || '';

const numero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(typeof v === 'string' ? v.trim().replace(',', '.') : v);
  return Number.isFinite(x) ? x : null;
};

function buscar(caminhoTemplate, idObra, sufixoChave, { desembrulhar = true } = {}) {
  const caminho = caminhoTemplate.replace('{id_obra}', String(idObra));
  return buscarComCache({
    url: `${BASE}/${caminho.replace(/^\/+/, '')}`,
    token: TOKEN(),
    chave: `oc:${sufixoChave}:${idObra}`,
    servico: 'ocApi',
    desembrulhar,
  });
}

/**
 * Descarta o que não é da obra pedida.
 *
 * Não é paranoia: a mesma API responde 200 com a lista de TODAS as obras se o
 * parâmetro do filtro vier com o nome errado. Como esta rota é financeira e
 * restrita por obra, um caminho mal configurado no .env viraria vazamento de
 * dado de outras obras para quem só tem acesso a uma. Filtrando aqui, o pior
 * caso vira "lista vazia", não "lista dos outros".
 */
function filtrarDaObra(lista, idObra) {
  const daObra = lista.filter((oc) => numero(oc.obra_id ?? oc.id_obra) === idObra);
  if (daObra.length !== lista.length) {
    console.warn(`[ocApi] obra ${idObra}: ${lista.length - daObra.length} de ${lista.length} OCs vieram de outra obra e foram descartadas — confira OC_API_PATH no .env`);
  }
  return daObra;
}

/**
 * OC/CO de uma obra — substitui a leitura de `oc_orcamentos`.
 *
 * Devolve `{ocs, resumo, total}` porque é exatamente o que a tabela guardava e
 * o que a rota já entregava ao front (que lê `rows[0].ocs` e `rows[0].resumo.data`).
 */
export async function ocDaObra(idObra) {
  // Em paralelo: são dois recursos independentes do mesmo serviço.
  const [lista, resumo] = await Promise.all([
    buscar(CAMINHO_OCS, idObra, 'lista'),
    // O resumo é acessório: se só ele falhar, a tela ainda funciona sem os
    // totais (o front trata `resumo` nulo). A lista, não — sem ela não há o
    // que mostrar, e o erro sobe.
    // `desembrulhar: false`: aqui `data` e' o conteudo (os totais), nao o
    // envelope — e o front le exatamente `resumo.data`.
    buscar(CAMINHO_RESUMO, idObra, 'resumo', { desembrulhar: false }).catch((err) => {
      console.warn(`[ocApi] resumo da obra ${idObra} falhou (${err.message}); seguindo sem os totais`);
      return null;
    }),
  ]);

  const bruto = lista.dados?.ocs ?? lista.dados?.orcamentos ?? (Array.isArray(lista.dados) ? lista.dados : null);
  if (!Array.isArray(bruto)) {
    throw new Error(`Formato inesperado em OC da obra ${idObra}: ${JSON.stringify(Object.keys(lista.dados || {}))}`);
  }
  const ocs = filtrarDaObra(bruto, idObra);

  // `resumo` volta no mesmo envelope que a tabela guardava (`{data, time,
  // obra_id}`) — o front lê `resumo.data`.
  const envelopeResumo = resumo?.dados ?? null;
  const resumoDaObra = envelopeResumo && numero(envelopeResumo.obra_id) !== idObra
    ? (console.warn(`[ocApi] resumo veio da obra ${envelopeResumo.obra_id}, esperado ${idObra} — descartado`), null)
    : envelopeResumo;

  return {
    ocs,
    resumo: resumoDaObra,
    total: numero(resumoDaObra?.data?.total_ocs) ?? ocs.length,
    doCache: lista.doCache,
    velho: Boolean(lista.velho),
    idadeSegundos: lista.idadeSegundos,
  };
}
