const { test, expect } = require('@playwright/test');
const { abrirPainel, garantirQueNaoEhLogin } = require('./helpers');

const obras = [106, 110, 94, 107, 108, 91, 114];

test.describe('Suprimentos por obra', () => {
  for (const obraId of obras) {
    test(`obra ${obraId} carrega sem erro fatal`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await abrirPainel(page, `/#/obra/${obraId}/suprimentos-criticos`);
      await expect(page.locator('#root')).toBeVisible();
      await expect(page.locator('body')).toContainText(/Suprimentos|MSE/i);
      await garantirQueNaoEhLogin(page, expect);
      expect(pageErrors, pageErrors.join('\n')).toEqual([]);
    });
  }
});
