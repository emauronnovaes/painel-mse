// Sonda as APIs do Portal com o token do .env e mostra o FORMATO da resposta
// (chaves, tamanhos, 1 item de amostra) — não despeja o payload inteiro.
// Serve para confirmar caminho/shape antes de ligar a tela.
//
//   node scripts/sondar-portal.mjs [id_obra]
import 'dotenv/config';

const idObra = Number(process.argv[2] || 91);

function resumir(valor, profundidade = 0) {
  if (valor === null || valor === undefined) return String(valor);
  if (Array.isArray(valor)) {
    const amostra = valor.length && profundidade < 1 ? ` ex: ${resumir(valor[0], profundidade + 1)}` : '';
    return `array(${valor.length})${amostra}`;
  }
  if (typeof valor === 'object') {
    const chaves = Object.keys(valor);
    if (profundidade >= 2) return `objeto{${chaves.length} chaves}`;
    return `{ ${chaves.map((k) => `${k}: ${resumir(valor[k], profundidade + 1)}`).join(', ')} }`;
  }
  const t = String(valor);
  return typeof valor === 'string' ? `"${t.length > 40 ? t.slice(0, 40) + '…' : t}"` : t;
}

async function sondar(nome, url, token) {
  process.stdout.write(`\n== ${nome}\n   ${url}\n`);
  if (!token) return console.log('   TOKEN AUSENTE no .env');
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000) });
    const ms = Date.now() - t0;
    const texto = await r.text();
    console.log(`   HTTP ${r.status} em ${ms}ms, ${texto.length} bytes`);
    if (!r.ok) return console.log(`   corpo: ${texto.slice(0, 300)}`);
    let json;
    try { json = JSON.parse(texto); } catch { return console.log(`   resposta nao e JSON: ${texto.slice(0, 200)}`); }
    console.log(`   shape: ${resumir(json)}`);
    return json;
  } catch (err) {
    console.log(`   FALHOU apos ${Date.now() - t0}ms: ${err.message}`);
  }
}

const avancos = (process.env.AVANCOS_API_URL || 'https://portalmse.com.br/microservices/hub_mse/api_avancos/v1').replace(/\/+$/, '');
const ocBase = (process.env.OC_API_URL || 'https://portalmse.com.br/microservices/orcamentos_complementares_api').replace(/\/+$/, '');

await sondar('Restricoes', `${avancos}/restricoes/${idObra}`, process.env.AVANCOS_API_TOKEN);

// O caminho do recurso de OC ainda nao foi confirmado: tenta os formatos mais
// prováveis e mostra qual responde, para fixar OC_API_PATH no .env.
const candidatos = [
  process.env.OC_API_PATH ? process.env.OC_API_PATH.replace('{id_obra}', idObra) : null,
  `v1/orcamentos/${idObra}`,
  `v1/orcamentos_complementares/${idObra}`,
  `orcamentos/${idObra}`,
  `v1/obras/${idObra}/orcamentos`,
  `v1/orcamentos?id_obra=${idObra}`,
].filter((c, i, a) => c && a.indexOf(c) === i);

for (const caminho of candidatos) {
  const json = await sondar(`OC/CO  (${caminho})`, `${ocBase}/${caminho}`, process.env.OC_API_TOKEN);
  if (json) { console.log(`\n   >> OC_API_PATH=${caminho.replace(String(idObra), '{id_obra}')}`); break; }
}
