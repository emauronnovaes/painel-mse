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
  // Sem isso, DECIMAL/NEWDECIMAL (todo campo de valor em Medições, e
  // qualquer outro domínio numérico futuro) vira STRING no JSON
  // ("9016422.92" em vez de 9016422.92) — o driver evita perda de
  // precisão de ponto flutuante por padrão. O Supabase (Postgres via
  // PostgREST) sempre devolveu `numeric` como número de verdade, e o
  // `prototipo` faz conta direta em cima do valor (`soma()`, por
  // exemplo, com `a + b` sem `Number()`) — string vira concatenação de
  // texto ali, não soma, e qualquer resultado de divisão sai NaN (achado ao
  // testar Medições: "Farol Medido × Físico" mostrando NaN%). Os valores
  // aqui (dezenas de milhões, 2 casas decimais) estão bem dentro da
  // precisão exata de um double do JS — não há perda real de dinheiro
  // por essa conversão.
  decimalNumbers: true,
});
