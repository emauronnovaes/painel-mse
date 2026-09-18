// Sobe a API localmente SEM migrations e SEM agendador — só para testar as
// rotas que consultam as APIs do Portal direto (`/restricoes`, `/oc`,
// `/eap/*`), que não dependem do MySQL.
//
// Existe porque o boot normal (src/server.js) aplica migrations e, se o banco
// recusar a conexão, o processo morre de propósito — comportamento certo em
// produção, atrapalha o teste local dessas rotas. NÃO usar isto para subir em
// produção: lá o que vale é `node src/server.js`.
//
//   node scripts/servir-local.mjs
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { restricoesRouter } from '../src/routes/restricoes.js';
import { ocRouter } from '../src/routes/oc.js';
import { eapRouter } from '../src/routes/eap.js';
import { suprimentosRouter } from '../src/routes/suprimentos.js';
import { medicoesRouter } from '../src/routes/medicoes.js';
import { authRouter } from '../src/routes/auth.js';

const app = express();
app.use(cors());
app.use(express.json());

for (const prefixo of ['', '/api']) {
  app.use(`${prefixo}/auth`, authRouter);
  app.use(`${prefixo}/restricoes`, restricoesRouter);
  app.use(`${prefixo}/oc`, ocRouter);
  app.use(`${prefixo}/eap`, eapRouter);
  // Estas continuam lendo MySQL — vão falhar enquanto a credencial local não
  // funcionar. Ficam montadas para o teste refletir o servidor de verdade.
  app.use(`${prefixo}/suprimentos`, suprimentosRouter);
  app.use(`${prefixo}/medicoes`, medicoesRouter);
  app.get(`${prefixo}/health`, (req, res) => res.json({ status: 'ok', modo: 'local-sem-banco' }));
}

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API (modo teste local, sem migrations) em http://localhost:${port}`);
  console.log('  GET /restricoes?id_obra=91');
  console.log('  GET /oc?id_obra=91            (exige sessao: financeiro por obra)');
  console.log('  GET /eap/cards-ativos?id_eap=121');
  console.log('  GET /eap/cache');
});
