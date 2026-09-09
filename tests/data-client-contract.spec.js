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

test('módulos compartilhados são carregados antes do app', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const dominio = html.indexOf('lib/domain-utils.js');
  const configuracao = html.indexOf('lib/panel-config.js');
  const auth = html.indexOf('lib/auth.js');
  // O que importa é a ordem contra o SCRIPT DO APP, não contra a tag da
  // biblioteca do Babel. A tag `babel.min.js` só carrega o transpilador e fica
  // no <head> antes dos módulos de propósito; o que consome MSEConfig/MSEDomain/
  // MSEAuth é o `<script type="text/babel">`, que roda depois do parse do <body>.
  //
  // A asserção antiga comparava com `babel.min.js` e por isso falhava desde que
  // foi escrita (707e803), sem ninguém notar: este spec ficou FORA do `test:all`,
  // que era o portão de merge. Duas falhas de método se cobrindo.
  const appScript = html.indexOf('<script type="text/babel"');
  expect(dominio).toBeGreaterThanOrEqual(0);
  expect(configuracao).toBeGreaterThan(dominio);
  expect(auth).toBeGreaterThanOrEqual(0);
  expect(appScript).toBeGreaterThan(configuracao);
  expect(appScript).toBeGreaterThan(auth);
});
