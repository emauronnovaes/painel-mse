import { defineConfig, devices } from '@playwright/test';

// A suíte testa o WORKING COPY, não produção.
//
// Até 08/09/2026 o `baseURL` apontava para https://painel-mse-prototipo.web.app,
// e dois specs traziam essa URL escrita à mão. O resultado é que o portão de
// merge definido no docs/12 ("rodar test:all antes do merge") validava o DEPLOY
// ANTERIOR, não o código sendo mergeado — uma regressão introduzida na branch
// passava batido em tudo que é nível de navegador.
//
// Não era hipótese: produção está numa versão pré-refatoração (lib/panel-config.js
// responde 404 lá), então a suíte vinha validando um app que já não existe na
// branch, e a branch acumulou 20 commits sem nunca ser exercitada.
//
// O `webServer` sobe o scripts/serve-local.js sozinho. Servidor de verdade é
// necessário, não `file://`: os tiles do Deep Zoom falham por CORS em file:// e
// o OAuth não redireciona pra lá.
//
// Produção continua coberta, mas explicitamente: tests/smoke-producao.spec.js,
// rodado por `npm run test:smoke`, separado do portão de merge.
export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/unit/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  webServer: {
    command: 'node scripts/serve-local.js',
    url: 'http://localhost:8899',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  use: {
    baseURL: 'http://localhost:8899',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
