const { test, expect } = require('@playwright/test');
const { abrirPainel, garantirQueNaoEhLogin } = require('./helpers');

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

      // Rota relativa: o alvo é o baseURL do playwright.config.ts (working copy),
      // não uma URL de produção escrita à mão.
      await abrirPainel(page, `/#/obra/${obraId}/${setor}`);

      // `.tabs-scroll` (garantido por abrirPainel) já prova que o app renderizou.
      // As duas asserções abaixo eram a verificação ANTIGA e sozinhas passavam na
      // tela de login; ficam como reforço, agora que o app é o que está na tela.
      await expect(page.locator('#root')).toBeVisible();
      await expect(page.locator('body')).toContainText('MSE');
      await garantirQueNaoEhLogin(page, expect);

      expect(pageErrors, pageErrors.join('\n')).toEqual([]);
    });
  }
});
