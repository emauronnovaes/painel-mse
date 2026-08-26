// Baixa TODAS as linhas de itens_rmi de uma obra, paginando com o mesmo
// esquema (Range header, páginas de 1000) que `fetchPaginado` usa no
// index.html — pra inspecionar localmente sem risco de cortar dados por
// causa do limite padrão do PostgREST (1000 linhas por request).
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://gebjlhkywtnpfqjrakok.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYmpsaGt5d3RucGZxanJha29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDMwMjEsImV4cCI6MjA5MjQxOTAyMX0.jmoyrAsH9XHgAx2vLizQMcwWwEyMEBwSKFH5EEyP6tM';

const obraId = process.argv[2];
const saidaPath = process.argv[3];
if (!obraId || !saidaPath) { console.error('uso: node baixar-rmi-obra.js <id_obra> <caminho_saida.json>'); process.exit(1); }

async function fetchPaginado(url, headers, tamanhoPagina = 1000) {
  const todas = [];
  let inicio = 0;
  while (true) {
    const resp = await fetch(url, { headers: { ...headers, 'Range-Unit': 'items', Range: `${inicio}-${inicio + tamanhoPagina - 1}` } });
    if (!resp.ok) { console.error('HTTP', resp.status); return inicio === 0 ? null : todas; }
    const pagina = await resp.json();
    todas.push(...pagina);
    if (pagina.length < tamanhoPagina) break;
    inicio += tamanhoPagina;
  }
  return todas;
}

async function main() {
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const rows = await fetchPaginado(`${SUPABASE_URL}/rest/v1/itens_rmi?id_obra=eq.${obraId}&select=id,raw`, headers);
  console.log('total baixado:', rows ? rows.length : null);
  fs.writeFileSync(saidaPath, JSON.stringify(rows));
}
main();
