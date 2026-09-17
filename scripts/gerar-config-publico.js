// Gera prototipo/lib/config-publico.js a partir de api/.env.
//
// Por que existe: o navegador não lê arquivo `.env` (não há bundler neste
// projeto — o `index.html` é servido exatamente como está no disco). Este
// script é a ponte: roda em Node (que lê o `.env` normalmente), pega os
// valores públicos (não-segredo) que o front-end precisa, e escreve um
// arquivo JS gerado que o `index.html` carrega como um <script> comum.
//
// Rodar sempre que `PUBLIC_API_URL` mudar no `.env`, antes de testar/deployar
// o front: `node scripts/gerar-config-publico.js` (ou `npm run gerar-config`).
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', 'api', '.env');
const SAIDA = path.join(__dirname, '..', 'prototipo', 'lib', 'config-publico.js');

function lerEnv(caminho) {
  const bruto = fs.readFileSync(caminho, 'utf8');
  const vars = {};
  for (const linha of bruto.split(/\r?\n/)) {
    const l = linha.trim();
    if (!l || l.startsWith('#')) continue;
    const idx = l.indexOf('=');
    if (idx === -1) continue;
    vars[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
  }
  return vars;
}

const env = lerEnv(ENV_PATH);
const apiUrl = env.PUBLIC_API_URL;
if (!apiUrl) {
  console.error('[gerar-config-publico] PUBLIC_API_URL ausente em api/.env — nada gerado.');
  process.exit(1);
}

const conteudo = `// GERADO por scripts/gerar-config-publico.js a partir de api/.env — não editar
// à mão, e não versionado (o valor muda por ambiente). Rodar o script de novo
// sempre que PUBLIC_API_URL mudar.
window.MSE_CONFIG_PUBLICO = { API_MYSQL_URL: ${JSON.stringify(apiUrl)} };
`;

fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, conteudo);
console.log(`[gerar-config-publico] ${SAIDA} gerado com API_MYSQL_URL=${apiUrl}`);
