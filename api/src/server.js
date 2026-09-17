import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db/pool.js';
import { authRouter } from './routes/auth.js';
import { ingestRouter } from './routes/ingest.js';
import { restricoesRouter } from './routes/restricoes.js';

const app = express();
// CORS aberto: o `prototipo` é servido de outra origem (Firebase/portal em
// iframe) e as leituras aqui reproduzem o mesmo nível de acesso público que
// o `anon` key do Supabase já tinha — não é uma regressão de segurança.
app.use(cors());
app.use(express.json());
app.use('/auth', authRouter);
app.use('/ingest', ingestRouter);
app.use('/restricoes', restricoesRouter);

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'painelmse' });
  } catch (err) {
    res.status(503).json({ status: 'erro', detalhe: err.message });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API painel-mse ouvindo na porta ${port}`);
});
