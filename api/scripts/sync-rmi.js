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
import mysql from 'mysql2/promise';

const RMI_API_URL = process.env.RMI_API_URL;
const RMI_API_TOKEN = process.env.RMI_API_TOKEN;
const PER_PAGE = 200;

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
  const r = await fetch(url, { headers: { Authorization: `Bearer ${RMI_API_TOKEN}` } });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  return r.json();
}

async function sincronizarObra(conn, idObra, nomeObra) {
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
      await conn.query(sql, valores);
    }

    recebidos += dados.length;
    console.log(`  [obra ${idObra}] página ${page}: +${dados.length} (acumulado ${recebidos}${totalDeclarado != null ? `/${totalDeclarado}` : ''})`);

    if (dados.length < PER_PAGE) break; // última página
    page++;
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

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  try {
    const filtroObra = process.argv[2] ? Number(process.argv[2]) : null;
    const [obras] = await conn.query(
      filtroObra ? 'SELECT id, nome FROM obras WHERE id = ?' : 'SELECT id, nome FROM obras',
      filtroObra ? [filtroObra] : [],
    );
    if (!obras.length) throw new Error(filtroObra ? `Obra ${filtroObra} não encontrada.` : 'Nenhuma obra cadastrada.');

    console.log(`Sincronizando RMI para ${obras.length} obra(s)...`);
    let totalGeral = 0;
    for (const obra of obras) {
      try {
        totalGeral += await sincronizarObra(conn, obra.id, obra.nome);
      } catch (err) {
        // Uma obra com problema não derruba as outras — mesma filosofia
        // do processamento 1-a-1 que já existia no n8n.
        console.error(`  [obra ${obra.id}] FALHOU: ${err.message}`);
      }
    }
    console.log(`Concluído: ${totalGeral} itens no total.`);
  } finally {
    await conn.end();
  }
}

await main();
