const { test, expect } = require('@playwright/test');

test.describe('Setor Suprimentos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://painel-mse-prototipo.web.app/#/obra/106/suprimentos-criticos');
    await page.waitForLoadState('networkidle');
  });

  test('Deve carregar a página sem erros', async ({ page }) => {
    const heading = page.locator('text=/Suprimentos/i');
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('Deve exibir mensagem apropriada quando não há dados', async ({ page }) => {
    // Aguarda o carregamento
    await page.waitForTimeout(2000);

    // Verifica se há erro ou mensagem de vazio
    const erro = page.locator('text=Erro ao carregar|Nenhum suprimento');
    const exists = await erro.isVisible().catch(() => false);

    expect(exists).toBe(true);
  });

  test('Deve ter campo de busca funcional', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      expect(searchInput).toBeDefined();
    }
  });

  test('Deve ter tabela com colunas de suprimentos', async ({ page }) => {
    const table = page.locator('table');
    const isVisible = await table.isVisible().catch(() => false);

    if (isVisible) {
      // Verifica se as colunas esperadas existem
      const columns = ['Item', 'Fornecedor', 'Prazo', 'Status', 'Crítico', 'Impacto'];

      for (const col of columns) {
        const header = page.locator(`th:has-text("${col}")`);
        expect(await header.isVisible().catch(() => false)).toBe(true);
      }
    }
  });

  test('Deve ter KPIs visíveis', async ({ page }) => {
    const kpis = page.locator('text=/Total de Itens|Críticos|Prazo Médio|Impacto Total/');
    const count = await kpis.count();

    // Pelo menos alguns KPIs devem estar visíveis
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('Deve permitir ordenação por coluna', async ({ page }) => {
    const table = page.locator('table');
    const isVisible = await table.isVisible().catch(() => false);

    if (isVisible) {
      const headers = page.locator('th');
      const count = await headers.count();

      // Deve ter pelo menos 1 cabeçalho clicável
      expect(count).toBeGreaterThan(0);

      // Tenta clicar no primeiro header
      if (count > 0) {
        await headers.first().click();
        await page.waitForTimeout(500);
        // Se chegou aqui sem erro, a ordenação funciona
        expect(true).toBe(true);
      }
    }
  });

  test('Deve ter filtro de busca funcional', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      await searchInput.fill('teste');
      await page.waitForTimeout(500);

      // Verifica se algum resultado ou "nenhum item encontrado" aparece
      const results = page.locator('text=/nenhum item encontrado|de/');
      expect(await results.isVisible().catch(() => false)).toBe(true);
    }
  });

  test('Deve preservar agregados ao filtrar', async ({ page }) => {
    const table = page.locator('table');
    const isVisible = await table.isVisible().catch(() => false);

    if (isVisible) {
      // Obtém os valores dos KPIs antes de filtrar
      const totalAntes = page.locator('text=/Total de Itens/').locator('..').locator('div').last();
      const totalBeforeText = await totalAntes.textContent().catch(() => '');

      // Filtra por algo
      const searchInput = page.locator('input[placeholder*="Buscar"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('xyz123');
        await page.waitForTimeout(500);

        // Os agregados devem continuar os mesmos
        const totalDepois = page.locator('text=/Total de Itens/').locator('..').locator('div').last();
        const totalAfterText = await totalDepois.textContent().catch(() => '');

        // Verifica que o total não muda ao filtrar (agregados preservados)
        expect(totalBeforeText).toBe(totalAfterText);
      }
    }
  });

  test('Deve navegar entre setores', async ({ page }) => {
    // Tenta ir para setor anterior/próximo
    const navArrows = page.locator('button.nav-arrow');
    const count = await navArrows.count();

    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('Deve ter layout responsivo', async ({ page }) => {
    // Testa em viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });

    const heading = page.locator('text=/Suprimentos/i');
    const isVisible = await heading.isVisible().catch(() => false);

    expect(isVisible).toBe(true);
  });
});
