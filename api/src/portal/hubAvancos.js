// Domínios servidos direto pela API de Avanços do Hub MSE (api_avancos), sem
// passar por tabela.
//
// Por que existe: até aqui todo dado do Hub chegava ao painel por ingestão
// (n8n grava numa tabela, o front lê a tabela). Para o dado que é RETRATO DO
// AGORA — não tem histórico a preservar — essa volta custa um fluxo, uma tabela
// e um atraso igual ao intervalo do agendamento. Aqui a API pergunta na hora.
//
// O que NÃO pode vir por aqui: qualquer coisa com série temporal (Curva S,
// avanço por dia, efetivo diário, produtividade semanal). O endpoint só devolve
// o agora; o passado só existe porque alguém gravou.
import { buscarComCache } from './clientePortal.js';

const BASE = (process.env.AVANCOS_API_URL || 'https://portalmse.com.br/microservices/hub_mse/api_avancos/v1')
  .replace(/\/+$/, '');
const TOKEN = () => process.env.AVANCOS_API_TOKEN || '';

const texto = (v, max) => {
  if (v === null || v === undefined || typeof v === 'object') return null;
  const t = String(v).trim();
  return t === '' ? null : (t.length > max ? t.slice(0, max) : t);
};
const numero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(typeof v === 'string' ? v.trim().replace(',', '.') : v);
  return Number.isFinite(x) ? x : null;
};

function buscar(caminho) {
  return buscarComCache({
    url: `${BASE}/${caminho.replace(/^\/+/, '')}`,
    token: TOKEN(),
    chave: `avancos:${caminho}`,
    servico: 'hubAvancos',
  });
}

/**
 * Restrições de uma obra — substitui a leitura de `rest_restricoes`.
 *
 * Mantém o formato que a rota já devolvia (`{restricoes, total, atualizado_em}`)
 * para o `prototipo` não precisar mudar junto. `atualizado_em` agora significa
 * "quando este retrato foi buscado do Hub", não "quando o n8n gravou" — é mais
 * honesto, e continua servindo para a tela mostrar idade do dado.
 */
export async function restricoesDaObra(idObra) {
  const { dados, doCache, velho, idadeSegundos } = await buscar(`restricoes/${idObra}`);
  const lista = dados?.restricoes ?? (Array.isArray(dados) ? dados : null);
  if (!Array.isArray(lista)) {
    throw new Error(`Formato inesperado em restricoes/${idObra}: ${JSON.stringify(Object.keys(dados || {}))}`);
  }
  return {
    restricoes: lista,
    total: numero(dados?.total) ?? lista.length,
    buscadoHaSegundos: idadeSegundos,
    doCache,
    velho: Boolean(velho),
  };
}

/**
 * Cards ativos de uma EAP, no MESMO formato que o front lê de `cards_ativos`.
 *
 * O mapeamento está duplicado em relação ao fluxo n8n de propósito: a API não
 * importa código de workflow, e enquanto os dois caminhos coexistirem é melhor
 * cada um ser explícito.
 */
export async function cardsAtivosDaEap(idEap) {
  const { dados, doCache, velho, idadeSegundos } = await buscar(`cards_ativos/${idEap}`);
  const bruto = dados?.cards ?? dados?.cards_ativos ?? (Array.isArray(dados) ? dados : null);
  if (!Array.isArray(bruto)) {
    throw new Error(`Formato inesperado em cards_ativos/${idEap}: ${JSON.stringify(Object.keys(dados || {}))}`);
  }

  const cards = bruto.map((c) => ({
    card_id: texto(c.card_id ?? c.id_card ?? c.id, 30),
    id_eap_tabela: numero(dados?.id_eap_tabela ?? dados?.id_eap ?? c.id_eap_tabela ?? idEap),
    nome_eap: texto(dados?.nome_eap ?? c.nome_eap, 120),
    id_obra: numero(dados?.id_obra ?? c.id_obra),
    nome_obra: texto(dados?.nome_obra ?? c.nome_obra, 120),
    edt: texto(c.edt, 60),
    tarefa: texto(c.tarefa ?? c.tarefa_nome ?? c.nome_tarefa, 255),
    resp_planejamento: texto(c.resp_planejamento ?? c.responsavel_planejamento, 120),
    responsavel_encarregado: texto(c.responsavel_encarregado ?? c.encarregado, 120),
    supervisor_coordenador: texto(c.supervisor_coordenador ?? c.supervisor ?? c.coordenador, 120),
  })).filter((c) => c.card_id !== null);

  // Consultando direto, "card fantasma" deixa de existir: o que não veio na
  // resposta não está na lista. Todo o mecanismo de DELETE do fluxo n8n perde
  // a razão de ser.
  return { cards, doCache, velho: Boolean(velho), idadeSegundos };
}
