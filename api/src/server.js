import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db/pool.js';
import { aplicarMigracoes } from './db/migrate.js';
import { authRouter } from './routes/auth.js';
import { ingestRouter } from './routes/ingest.js';
import { restricoesRouter } from './routes/restricoes.js';
import { medicoesRouter } from './routes/medicoes.js';
import { ocRouter } from './routes/oc.js';

const app = express();
// CORS aberto: o `prototipo` é servido de outra origem (Firebase/portal em
// iframe) e as leituras aqui reproduzem o mesmo nível de acesso público que
// o `anon` key do Supabase já tinha — não é uma regressão de segurança.
app.use(cors());
app.use(express.json());

async function health(req, res) {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'painelmse' });
  } catch (err) {
    res.status(503).json({ status: 'erro', detalhe: err.message });
  }
}

// Montado tanto na raiz quanto sob /api: em produção o domínio
// (painelmse.portalmse.com.br) expõe a API em /api, mas ainda não está
// definido se o proxy reverso remove esse prefixo antes de repassar pro
// Node. Registrar nos dois lugares evita depender dessa configuração —
// funciona igual não importa qual dos dois jeitos o proxy escolher.
for (const prefixo of ['', '/api']) {
  app.use(`${prefixo}/auth`, authRouter);
  app.use(`${prefixo}/ingest`, ingestRouter);
  app.use(`${prefixo}/restricoes`, restricoesRouter);
  app.use(`${prefixo}/medicoes`, medicoesRouter);
  app.use(`${prefixo}/oc`, ocRouter);
  app.get(`${prefixo}/health`, health);
}

// Migrations rodam sozinhas no boot (idempotente — `CREATE TABLE IF NOT
// EXISTS` em cada arquivo), pra nenhum deploy esquecer de aplicar migration
// nova. Se falhar, o servidor NÃO sobe — melhor um deploy visivelmente
// quebrado (systemd reinicia e loga) do que uma API no ar sem tabela.
try {
  await aplicarMigracoes();
} catch (err) {
  console.error('[migrate] falha ao aplicar migrations, servidor nao vai subir', err);
  process.exit(1);
}

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API painel-mse ouvindo na porta ${port}`);
});
