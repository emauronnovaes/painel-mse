// Ingestão de Suprimentos — RMI, direto da API do PortalMSE (`rmi_api`)
// pro MySQL, SEM passar pelo n8n. Motivo: o motor de workflow do n8n não
// dava conta do volume (obra 94/Porto Itapoá, a maior, ~8 mil itens só
// nessa tabela) — travava sem erro. Achado ao medir de verdade: TODA
// chamada a essa API leva ~20-30s, em qualquer obra — não é rate limit,
// é latência real do lado de origem, e explica o "roda e não retorna" do
// n8n (provável timeout HTTP padrão do node de workflow batendo na
// borda). ~136 páginas × ~25s ≈ 1h pra sincronizar as 7 obras — aceitável
// pra cron noturno diário, mas nada rápido.
//
// Este script busca PÁGINA A PÁGINA e grava cada página antes de pedir a
// próxima — pegada de memória pequena e constante, não importa o total.
//
// Uso:
//   node scripts/sync-rmi.js          # todas as obras (tabela `obras`)
//   node scripts/sync-rmi.js 91       # só uma obra — testar assim primeiro
//
// Agendamento (substitui o agendamento do n8n, 08:00): cron ou systemd
// timer no servidor da API chamando este script — ver docs/16.
import 'dotenv/config';
// Pool (não uma única `createConnection`) de propósito — achado ao testar
// as 7 obras de verdade: uma conexão só, viva pelo script inteiro
// (minutos, entremeado de chamadas HTTP à API do PortalMSE), tomou
// ECONNRESET no meio e todas as obras seguintes falharam com "connection
// in closed state". O pool descarta a conexão quebrada e abre outra na
// próxima query.
import { pool } from '../src/db/pool.js';
import { paginarRecurso } from './lib/paginar-portalmse.js';

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

async function sincronizarObra(idObra, nomeObra) {
  const montarUrl = (page, perPage) => `${RMI_API_URL}/v1/itens?obra_id=${idObra}&page=${page}&per_page=${perPage}`;

  const { recebidos, totalDeclarado } = await paginarRecurso({
    montarUrl,
    token: RMI_API_TOKEN,
    perPage: PER_PAGE,
    onPagina: async (dados) => {
      const itens = dados
        .filter((item) => item && item.id != null)
        .map((item) => ({ id: item.id, id_obra: idObra, raw: item }));
      if (itens.length) {
        const { sql, valores } = montarSqlUpsert(itens);
        await pool.query(sql, valores);
      }
      console.log(`  [obra ${idObra}] +${dados.length} itens`);
    },
  });

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
