// Núcleo compartilhado das consultas diretas às APIs do PortalMSE.
//
// Cada microserviço do Portal (api_avancos, orcamentos_complementares_api,
// rmi_api, mapa_compras_api) tem URL e TOKEN PRÓPRIOS — a doc avisa que usar a
// chave de um no outro dá 403 —, então quem chama passa os dois. O que é comum,
// e mora aqui, é a política de cache.
//
// O cache não é otimização prematura: está medido em scripts/lib/
// paginar-portalmse.js que uma chamada ao PortalMSE leva 20-30s e que a origem
// cai sozinha sem padrão. Sem cache, cada abertura de tela pagaria esse tempo;
// sem `stale`, uma instabilidade da origem viraria tela vazia.
import { buscarComRetry } from '../../scripts/lib/paginar-portalmse.js';

const TTL_PADRAO_MS = Number(process.env.PORTAL_CACHE_TTL_SEGUNDOS || 600) * 1000;
const STALE_MAX_MS = Number(process.env.PORTAL_CACHE_STALE_MAX_SEGUNDOS || 21600) * 1000;

/** @type {Map<string, {valor: any, buscadoEm: number, emVoo: Promise<any>|null}>} */
const cache = new Map();

export function cacheEstatisticas() {
  const agora = Date.now();
  return [...cache.entries()].map(([chave, e]) => ({
    chave,
    idade_segundos: Math.round((agora - e.buscadoEm) / 1000),
    fresco: agora - e.buscadoEm < TTL_PADRAO_MS,
  }));
}

export function limparCache() { cache.clear(); }
export const ttlPadraoSegundos = () => TTL_PADRAO_MS / 1000;

// Injetável para teste: o módulo não deve exigir rede nem token para ser
// exercitado. Em produção nunca é trocado.
let buscarJson = (url, token) => buscarComRetry(url, token);
export function _usarBuscador(fn) { buscarJson = fn; }

/**
 * GET com cache, coalescência e fallback para valor velho.
 *
 * A coalescência pesa mais aqui do que num cache comum: com resposta de 20-30s,
 * cinco pessoas abrindo a mesma obra ao mesmo tempo virariam cinco chamadas
 * idênticas à origem. `emVoo` faz todas esperarem a mesma promessa.
 *
 * Devolve `{dados, doCache, velho, idadeSegundos}` — `velho: true` significa
 * "a origem falhou e isto aqui é o último retrato bom", e quem chama decide se
 * avisa na tela.
 */
export async function buscarComCache({ url, token, chave, ttlMs = TTL_PADRAO_MS, servico = 'portal', desembrulhar = true }) {
  if (!token) throw new Error(`Token do serviço "${servico}" não configurado no .env da API.`);

  const id = chave || url;
  const agora = Date.now();
  const entrada = cache.get(id);

  if (entrada && entrada.valor !== undefined && agora - entrada.buscadoEm < ttlMs) {
    return { dados: entrada.valor, doCache: true, velho: false, idadeSegundos: Math.round((agora - entrada.buscadoEm) / 1000) };
  }
  if (entrada?.emVoo) {
    return { dados: await entrada.emVoo, doCache: false, velho: false, idadeSegundos: 0 };
  }

  const promessa = (async () => {
    const resposta = await buscarJson(url, token);
    // As APIs do Portal costumam embrulhar em `data`; algumas devolvem direto.
    // Mas `data` nem sempre e' envelope: no resumo de OC ele e' campo de
    // negocio (`{time, obra_id, data:{totais}}`), e desembrulhar ali jogaria
    // fora o `obra_id` que a checagem de obra usa. Por isso e' opcional.
    if (!desembrulhar) return resposta;
    return resposta?.data ?? resposta;
  })();

  cache.set(id, { valor: entrada?.valor, buscadoEm: entrada?.buscadoEm ?? 0, emVoo: promessa });

  try {
    const dados = await promessa;
    cache.set(id, { valor: dados, buscadoEm: Date.now(), emVoo: null });
    return { dados, doCache: false, velho: false, idadeSegundos: 0 };
  } catch (err) {
    // 404 não é instabilidade, é resposta: a obra/EAP não existe naquele
    // serviço. Servir o retrato velho aqui seria mentir, e insistir também —
    // sobe marcado, e cada rota decide o que isso significa no seu contrato
    // (para Restrições é "sem snapshot", para OC é "lista vazia").
    if (/^HTTP 404/.test(err.message || '')) {
      cache.delete(id);
      err.naoEncontrado = true;
      throw err;
    }
    const idade = entrada?.valor !== undefined ? Date.now() - entrada.buscadoEm : Infinity;
    if (idade < STALE_MAX_MS) {
      // Mantém o valor velho com a idade ORIGINAL: assim ele não rejuvenesce a
      // cada falha, e continua envelhecendo até estourar o limite de stale.
      cache.set(id, { valor: entrada.valor, buscadoEm: entrada.buscadoEm, emVoo: null });
      console.warn(`[${servico}] ${id} falhou (${err.message}); servindo cache de ${Math.round(idade / 1000)}s atrás`);
      return { dados: entrada.valor, doCache: true, velho: true, idadeSegundos: Math.round(idade / 1000) };
    }
    cache.delete(id);
    throw err;
  }
}
