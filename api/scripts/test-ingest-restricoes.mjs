import 'dotenv/config';

const chave = process.env.INGEST_API_KEY;

async function enviar(total, restricoes) {
  const r = await fetch('http://localhost:3001/ingest/restricoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ingest-Key': chave },
    body: JSON.stringify({ id_obra: 110, total, restricoes }),
  });
  console.log('status:', r.status, await r.json());
}

await enviar(2, [{ item: 'Aço estrutural', dias: 5 }]);
await enviar(1, [{ item: 'Aço estrutural', dias: 2 }]);
