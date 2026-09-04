const { test, expect } = require('@playwright/test');

const obras = [106, 110, 94, 107, 108, 91, 114];

test.describe('Suprimentos por obra', () => {
  for (const obraId of obras) {
    test(`obra ${obraId} carrega sem erro fatal`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.goto(`https://painel-mse-prototipo.web.app/#/obra/${obraId}/suprimentos-criticos`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#root')).toBeVisible();
      await expect(page.locator('body')).toContainText(/Suprimentos|MSE/i);
      expect(pageErrors).toEqual([]);
    });
  }
});
