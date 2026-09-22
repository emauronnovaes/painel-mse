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
import { suprimentosRouter } from './routes/suprimentos.js';
import { eapRouter } from './routes/eap.js';
import { iniciarAgendador } from './scheduler.js';

const app = express();
// CORS aberto: o `prototipo` é servido de outra origem (Firebase/portal em
// iframe) e as leituras aqui reproduzem o mesmo nível de acesso público que
// o `anon` key do Supabase já tinha — não é uma regressão de segurança.
app.use(cors());
app.use(express.json());

// Além do banco, informa quais integrações têm token configurado — só
// true/false, nunca o valor. Serve para conferir um deploy sem acesso ao
// servidor: desde que Restrições e OC/CO passaram a consultar o Portal direto
// (sem fallback pra tabela), `.env` sem esses tokens = essas duas telas fora do
// ar. Melhor descobrir por aqui do que pelo usuário reclamando.
async function health(req, res) {
  const integracoes = {
    avancos_token: Boolean(process.env.AVANCOS_API_TOKEN),
    oc_token: Boolean(process.env.OC_API_TOKEN),
    rmi_token: Boolean(process.env.RMI_API_TOKEN),
    mapa_compras_token: Boolean(process.env.MAPA_COMPRAS_API_TOKEN),
  };
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'painelmse', integracoes });
  } catch (err) {
    res.status(503).json({ status: 'erro', detalhe: err.message, integracoes });
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
  app.use(`${prefixo}/suprimentos`, suprimentosRouter);
  app.use(`${prefixo}/eap`, eapRouter);
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

// Agendamento embutido (RMI/Mapa de Compras) — pedido explícito: "só fazer
// o deploy e já está funcionando", sem depender de cron/systemd externo
// configurado à parte. Ver src/scheduler.js.
iniciarAgendador();

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API painel-mse ouvindo na porta ${port}`);
});
