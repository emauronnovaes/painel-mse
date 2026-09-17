// Ingestão de Suprimentos — RMI, direto da API do PortalMSE (`rmi_api`)
// pro MySQL, SEM passar pelo n8n. Motivo: o motor de workflow do n8n não
// dava conta do volume (obra 94/Porto Itapoá, a maior, ~8 mil itens só
// nessa tabela) — travava sem erro, sintoma de estouro de memória mantendo
// respostas inteiras em JS antes de gravar (ver n8n/rmi-suprimentos.README.md).
// Este script busca PÁGINA A PÁGINA e grava cada página antes de pedir a
// próxima — pegada de memória pequena e constante, não importa o total.
//
// Uso:
//   node scripts/sync-rmi.js          # todas as obras (tabela `obras`)
//   node scripts/sync-rmi.js 91       # só uma obra — testar assim primeiro
//     (mesma recomendação do fluxo antigo de n8n antes de rodar tudo)
//
// Agendamento (substitui o agendamento do n8n, 08:00): cron ou systemd
// timer no servidor da API chamando este script — ver docs/16.
import 'dotenv/config';
// Pool (não uma única `createConnection`) de propósito — achado ao testar
// as 7 obras de verdade: uma conexão só, viva pelo script inteiro
// (minutos, entremeado de chamadas HTTP à API do PortalMSE), tomou
// ECONNRESET no meio e todas as obras seguintes falharam com "connection
// in closed state" (o objeto de conexão morto não se recupera sozinho).
// O pool descarta a conexão quebrada e abre outra na próxima query.
import { pool } from '../src/db/pool.js';

const RMI_API_URL = process.env.RMI_API_URL;
const RMI_API_TOKEN = process.env.RMI_API_TOKEN;
const PER_PAGE = 200;
// Achado ao testar as 7 obras de verdade: a API do PortalMSE derruba a
// conexão (`fetch failed`/`ECONNRESET`) depois de várias requisições em
// sequência rápida — obra 106 aguentou 7 páginas, obra 107 só 3, sem
// padrão fixo de quantidade. Não é o MySQL (isso já foi corrigido com o
// pool) — é rate limit/instabilidade do lado de lá. Mitigado com um
// intervalo entre páginas + retry com backoff em falha de rede.
const INTERVALO_ENTRE_PAGINAS_MS = 400;
const MAX_TENTATIVAS = 5;

function dormir(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function montarSqlUpsert(itens) {
  const tuplas = itens.map(() => '(?, ?, CAST(? AS JSON))').join(', ');
  const valores = itens.flatMap((it) => [it.id, it.id_obra, JSON.stringify(it.raw)]);
  return {
    sql: `INSERT INTO sup_rmi (id, id_obra, raw) VALUES ${tuplas}
          ON DUPLICATE KEY UPDATE id_obra = VALUES(id_obra), raw = VALUES(raw)`,
    valores,
  };
}

async function buscarPagina(idObra, page) {
  const url = `${RMI_API_URL}/v1/itens?obra_id=${idObra}&page=${page}&per_page=${PER_PAGE}`;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${RMI_API_TOKEN}` } });
      // 4xx (exceto 429) é erro de verdade — repetir não resolve token
      // errado nem obra inexistente. 429/5xx/erro de rede são transitórios.
      if (!r.ok && r.status !== 429 && r.status < 500) {
        throw new Error(`HTTP ${r.status} em ${url}`);
      }
      if (!r.ok) throw new Error(`HTTP ${r.status} (transitório) em ${url}`);
      return await r.json();
    } catch (err) {
      const ultimaTentativa = tentativa === MAX_TENTATIVAS;
      const naoRepetir = err.message.startsWith('HTTP') && !err.message.includes('transitório');
      if (ultimaTentativa || naoRepetir) throw err;
      const espera = 500 * 2 ** (tentativa - 1); // 500ms, 1s, 2s, 4s
      console.log(`  [obra ${idObra}] página ${page}: falhou (${err.message}), tentativa ${tentativa}/${MAX_TENTATIVAS}, esperando ${espera}ms...`);
      await dormir(espera);
    }
  }
}

async function sincronizarObra(idObra, nomeObra) {
  let page = 1;
  let recebidos = 0;
  let totalDeclarado = null;

  for (;;) {
    const envelope = await buscarPagina(idObra, page);
    const dados = Array.isArray(envelope.data) ? envelope.data : [];
    totalDeclarado = envelope.total ?? totalDeclarado;

    if (!dados.length) break;

    const itens = dados
      .filter((item) => item && item.id != null)
      .map((item) => ({ id: item.id, id_obra: idObra, raw: item }));

    if (itens.length) {
      const { sql, valores } = montarSqlUpsert(itens);
      await pool.query(sql, valores);
    }

    recebidos += dados.length;
    console.log(`  [obra ${idObra}] página ${page}: +${dados.length} (acumulado ${recebidos}${totalDeclarado != null ? `/${totalDeclarado}` : ''})`);

    if (dados.length < PER_PAGE) break; // última página
    page++;
    await dormir(INTERVALO_ENTRE_PAGINAS_MS);
  }

  if (totalDeclarado != null && recebidos !== totalDeclarado) {
    console.error(`  [obra ${idObra}] AVISO: recebido ${recebidos}, API declarou total=${totalDeclarado} — possível paginação incompleta.`);
  }
  console.log(`  [obra ${idObra}] "${nomeObra}" concluída: ${recebidos} itens.`);
  return recebidos;
}

async function main() {
  if (!RMI_API_URL || !RMI_API_TOKEN) {
    throw new Error('Faltam RMI_API_URL/RMI_API_TOKEN no .env.');
  }

  try {
    const filtroObra = process.argv[2] ? Number(process.argv[2]) : null;
    const [obras] = await pool.query(
      filtroObra ? 'SELECT id, nome FROM obras WHERE id = ?' : 'SELECT id, nome FROM obras',
      filtroObra ? [filtroObra] : [],
    );
    if (!obras.length) throw new Error(filtroObra ? `Obra ${filtroObra} não encontrada.` : 'Nenhuma obra cadastrada.');

    console.log(`Sincronizando RMI para ${obras.length} obra(s)...`);
    let totalGeral = 0;
    for (const obra of obras) {
      try {
        totalGeral += await sincronizarObra(obra.id, obra.nome);
      } catch (err) {
        // Uma obra com problema não derruba as outras — mesma filosofia
        // do processamento 1-a-1 que já existia no n8n.
        console.error(`  [obra ${obra.id}] FALHOU: ${err.message}`);
      }
    }
    console.log(`Concluído: ${totalGeral} itens no total.`);
  } finally {
    await pool.end();
  }
}

await main();
