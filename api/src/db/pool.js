import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  // Sem isso, DATE/DATETIME viram objeto Date do JS e o `res.json()` os
  // serializa como ISO com hora e `Z` (ex.: "2025-03-11T03:00:00.000Z") —
  // conversão de fuso que nao existe no dado original (era só uma data).
  // Como string, o driver devolve exatamente o que está na coluna
  // ("2025-03-11", "2026-09-17 13:56:05"), sem reinterpretar fuso nenhum.
  dateStrings: true,
});
