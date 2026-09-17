import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';

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

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

const arquivos = readdirSync(migrationsDir)
  .filter((nome) => nome.endsWith('.sql'))
  .sort();

for (const arquivo of arquivos) {
  const sql = readFileSync(path.join(migrationsDir, arquivo), 'utf8');
  console.log(`Aplicando ${arquivo}...`);
  await conn.query(sql);
}

console.log('Migrações aplicadas.');
await conn.end();
