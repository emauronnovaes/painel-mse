// Servidor estático pra simular o bucket público do Supabase Storage
// (`ortofoto-porto`) enquanto ele não é criado de verdade — serve
// `bucket-local/` com CORS liberado, igual o endpoint /object/public/ do
// Supabase faz pra qualquer origem. Uso: copiar os tiles pra bucket-local/
// (ver scripts/publicar-ortofoto.js) e apontar o teste pra esta porta.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'bucket-local');
const PORT = 8900;

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.dzi': 'application/xml', '.xml': 'application/xml' };

http.createServer((req, res) => {
  const reqPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(ROOT, reqPath);
  fs.readFile(filePath, (err, data) => {
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (err) { res.writeHead(404, headers); res.end('not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { ...headers, 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`bucket local (teste) em http://localhost:${PORT}`));
