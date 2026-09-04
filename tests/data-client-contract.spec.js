const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const htmlPath = path.join(__dirname, '..', 'prototipo', 'index.html');

test('cliente de dados mantém paginação e timeout centralizados', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  expect(html).toContain('const FETCH_TIMEOUT_MS = 20000');
  expect(html).toContain('new AbortController()');
  expect(html).toContain("'Range-Unit': 'items'");
  expect(html).toContain('fetchPaginadoCompat');

  // A única chamada nativa permitida é interna ao próprio fetchComTimeout.
  // Qualquer novo fetch direto em um módulo contorna timeout/paginação.
  const chamadasNativas = html.match(/\bfetch\(/g) || [];
  expect(chamadasNativas).toHaveLength(1);
});
