const { test, expect } = require('@playwright/test');

const obraId = 106;
const setores = [
  'curva-s',
  'encarregados',
  'desvios',
  'restricoes',
  'histograma',
  'suprimentos-criticos',
  'oc-co',
  'medicoes',
  'tour-360',
];

test.describe('Baseline de rotas do Painel de Obra', () => {
  for (const setor of setores) {
    test(`${setor} abre sem erro fatal de página`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));

      await page.goto(`/\#/obra/${obraId}/${setor}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#root')).toBeVisible();
      await expect(page.locator('body')).toContainText('MSE');

      expect(pageErrors, pageErrors.join('\n')).toEqual([]);
    });
  }
});
