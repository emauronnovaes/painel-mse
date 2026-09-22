import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

// Reaplica TODOS os arquivos toda vez, sem tabela de controle — seguro
// porque SQL usa CREATE TABLE IF NOT EXISTS e migrations JS verificam o
// schema antes de ALTER (ambas precisam ser idempotentes).
// Usado tanto pelo `npm run migrate` (linha de comando) quanto por
// `server.js` no boot, pra nenhum deploy esquecer de rodar migration nova.
export async function aplicarMigracoes() {
  // Conexão própria com multipleStatements habilitado — só para rodar SQL
  // estático de migration, nunca para o pool da aplicação (que roda em
  // src/db/pool.js sem essa flag, por segurança contra injeção).
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
  });

  try {
    const arquivos = readdirSync(migrationsDir)
      .filter((nome) => /\.(sql|js)$/.test(nome))
      .sort();

    for (const arquivo of arquivos) {
      console.log(`Aplicando ${arquivo}...`);
      if (arquivo.endsWith('.js')) {
        const { default: migrar } = await import(pathToFileURL(path.join(migrationsDir, arquivo)).href);
        await migrar(conn);
      } else {
        await conn.query(readFileSync(path.join(migrationsDir, arquivo), 'utf8'));
      }
    }
    console.log('Migrações aplicadas.');
  } finally {
    await conn.end();
  }
}

// Só roda sozinho quando chamado direto (`node src/db/migrate.js` /
// `npm run migrate`) — importado por server.js, não executa nada aqui.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await aplicarMigracoes();
}
