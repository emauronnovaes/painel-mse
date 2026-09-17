// Paginação genérica contra as APIs do PortalMSE (rmi_api, mapa_compras_api
// — mesma família, mesmo envelope `{page, per_page, total, data}`).
// Extraído de `sync-rmi.js` pra reusar em `sync-mapa-compras.js` sem
// duplicar a lógica de retry/backoff — achada e ajustada ao testar RMI
// com dado real: TODA chamada a essas APIs leva ~20-30s (não é rate
// limit, é latência real do lado de origem), e ocasionalmente a conexão
// cai (`fetch failed`/`ECONNRESET`) sem padrão fixo de quantas
// requisições aguenta antes.

export function dormir(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

/** Busca uma página com retry (backoff 500ms/1s/2s/4s/8s). 4xx (exceto 429)
 *  não é retentado — token errado ou obra inexistente não se resolve
 *  tentando de novo. 429/5xx/erro de rede são tratados como transitórios. */
export async function buscarComRetry(url, token, { maxTentativas = 5 } = {}) {
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok && r.status !== 429 && r.status < 500) {
        throw new Error(`HTTP ${r.status} em ${url}`);
      }
      if (!r.ok) throw new Error(`HTTP ${r.status} (transitório) em ${url}`);
      return await r.json();
    } catch (err) {
      const ultimaTentativa = tentativa === maxTentativas;
      const naoRepetir = err.message.startsWith('HTTP') && !err.message.includes('transitório');
      if (ultimaTentativa || naoRepetir) throw err;
      const espera = 500 * 2 ** (tentativa - 1);
      console.log(`    falhou (${err.message}), tentativa ${tentativa}/${maxTentativas}, esperando ${espera}ms...`);
      await dormir(espera);
    }
  }
}

/**
 * Percorre um recurso paginado inteiro, chamando `onPagina(dados)` a cada
 * página recebida (pra gravar e descartar antes de pedir a próxima —
 * pegada de memória pequena e constante, o motivo desta migração toda).
 * `montarUrl(page, perPage)` monta a URL de cada página.
 * Retorna `{ recebidos, totalDeclarado }`.
 */
export async function paginarRecurso({ montarUrl, token, perPage = 200, intervaloMs = 400, maxTentativas = 5, onPagina }) {
  let page = 1;
  let recebidos = 0;
  let totalDeclarado = null;

  for (;;) {
    const envelope = await buscarComRetry(montarUrl(page, perPage), token, { maxTentativas });
    const dados = Array.isArray(envelope.data) ? envelope.data : [];
    totalDeclarado = envelope.total ?? totalDeclarado;

    if (!dados.length) break;

    await onPagina(dados);
    recebidos += dados.length;

    if (dados.length < perPage) break; // última página
    page++;
    await dormir(intervaloMs);
  }

  return { recebidos, totalDeclarado };
}
