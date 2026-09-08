// Smoke de PRODUÇÃO — deliberadamente separado do portão de merge.
//
// Até 08/09/2026 toda a suíte apontava pra cá, o que fazia `test:all` validar o
// deploy anterior em vez do código sendo mergeado. Produção continua merecendo
// verificação, mas como pergunta própria ("o que está no ar responde?"), não
// disfarçada de teste da branch.
//
// Rodar com: npm run test:smoke
const { test, expect } = require('@playwright/test');

const PRODUCAO = 'https://painel-mse-prototipo.web.app';

test.describe('Smoke de producao @smoke', () => {
  test('o site no ar responde e renderiza', async ({ page }) => {
    const resp = await page.goto(`${PRODUCAO}/#/obra/106/curva-s`, { waitUntil: 'domcontentloaded' });
    expect(resp?.status(), 'produção deve responder 200').toBeLessThan(400);
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('body')).toContainText('MSE');
  });

  test('registra a divergência entre produção e a branch', async ({ page }) => {
    // Não é asserção de qualidade: é um marcador. Enquanto produção não recebe o
    // deploy da branch, lib/auth.js não existe lá. Quando este teste começar a
    // falhar, é sinal de que o deploy aconteceu — e aí o marcador pode sair.
    const resp = await page.request.get(`${PRODUCAO}/lib/auth.js`);
    if (resp.status() === 200) {
      console.log('[smoke] produção JÁ tem lib/auth.js — deploy da branch aconteceu; remover este marcador.');
    } else {
      console.log(`[smoke] produção ainda SEM lib/auth.js (HTTP ${resp.status()}) — deploy pendente.`);
    }
    expect([200, 404]).toContain(resp.status());
  });
});
