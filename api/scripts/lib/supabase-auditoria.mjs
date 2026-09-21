// Credencial de administração somente no processo local, nunca no navegador.
export async function consultarOrigem(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN ausente');
  const r = await fetch('https://api.supabase.com/v1/projects/gebjlhkywtnpfqjrakok/database/query', {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`Origem: HTTP ${r.status}`);
  const rows = await r.json();
  if (!Array.isArray(rows)) throw new Error('Resposta da origem nao e array');
  return rows;
}
