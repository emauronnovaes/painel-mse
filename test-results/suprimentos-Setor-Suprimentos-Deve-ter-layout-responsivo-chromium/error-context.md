# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: suprimentos.spec.js >> Setor Suprimentos >> Deve ter layout responsivo
- Location: tests\suprimentos.spec.js:125:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e7]:
    - generic [ref=e8]:
      - img "MSE Logo" [ref=e9]
      - generic [ref=e11]:
        - generic [ref=e12]: MSE Engenharia
        - generic [ref=e13]: Painel de Obra
    - generic [ref=e14]:
      - button "Portal MSE" [ref=e15] [cursor=pointer]
      - button "Obra · id 106 CNPEM - Faseado ▾" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]:
          - generic [ref=e21]: Obra · id 106
          - generic [ref=e22]: CNPEM - Faseado
        - generic [ref=e23]: ▾
  - generic [ref=e24]:
    - button "‹" [ref=e25] [cursor=pointer]
    - generic [ref=e26]:
      - button "1 Curva S" [ref=e27] [cursor=pointer]:
        - generic [ref=e28]: "1"
        - generic [ref=e29]: Curva S
      - button "2 Encarregados" [ref=e30] [cursor=pointer]:
        - generic [ref=e31]: "2"
        - generic [ref=e32]: Encarregados
      - button "3 Histograma" [ref=e33] [cursor=pointer]:
        - generic [ref=e34]: "3"
        - generic [ref=e35]: Histograma
      - button "4 Suprimentos" [ref=e36] [cursor=pointer]:
        - generic [ref=e37]: "4"
        - generic [ref=e38]: Suprimentos
      - button "5 OC / CO" [ref=e40] [cursor=pointer]:
        - generic [ref=e41]: "5"
        - generic [ref=e42]: OC / CO
      - button "6 Desvios" [ref=e43] [cursor=pointer]:
        - generic [ref=e44]: "6"
        - generic [ref=e45]: Desvios
      - button "7 Restrições" [ref=e46] [cursor=pointer]:
        - generic [ref=e47]: "7"
        - generic [ref=e48]: Restrições
      - button "8 Medições" [ref=e49] [cursor=pointer]:
        - generic [ref=e50]: "8"
        - generic [ref=e51]: Medições
      - button "9 Tour 360°" [ref=e52] [cursor=pointer]:
        - generic [ref=e53]: "9"
        - generic [ref=e54]: Tour 360°
    - button "›" [ref=e55] [cursor=pointer]
  - generic [ref=e56]: Carregando suprimentos…
```

# Test source

```ts
  32  |   });
  33  | 
  34  |   test('Deve ter tabela com colunas de suprimentos', async ({ page }) => {
  35  |     const table = page.locator('table');
  36  |     const isVisible = await table.isVisible().catch(() => false);
  37  | 
  38  |     if (isVisible) {
  39  |       // Verifica se as colunas esperadas existem
  40  |       const columns = ['Item', 'Fornecedor', 'Prazo', 'Status', 'Crítico', 'Impacto'];
  41  | 
  42  |       for (const col of columns) {
  43  |         const header = page.locator(`th:has-text("${col}")`);
  44  |         expect(await header.isVisible().catch(() => false)).toBe(true);
  45  |       }
  46  |     }
  47  |   });
  48  | 
  49  |   test('Deve ter KPIs visíveis', async ({ page }) => {
  50  |     const kpis = page.locator('text=/Total de Itens|Críticos|Prazo Médio|Impacto Total/');
  51  |     const count = await kpis.count();
  52  | 
  53  |     // Pelo menos alguns KPIs devem estar visíveis
  54  |     expect(count).toBeGreaterThanOrEqual(0);
  55  |   });
  56  | 
  57  |   test('Deve permitir ordenação por coluna', async ({ page }) => {
  58  |     const table = page.locator('table');
  59  |     const isVisible = await table.isVisible().catch(() => false);
  60  | 
  61  |     if (isVisible) {
  62  |       const headers = page.locator('th');
  63  |       const count = await headers.count();
  64  | 
  65  |       // Deve ter pelo menos 1 cabeçalho clicável
  66  |       expect(count).toBeGreaterThan(0);
  67  | 
  68  |       // Tenta clicar no primeiro header
  69  |       if (count > 0) {
  70  |         await headers.first().click();
  71  |         await page.waitForTimeout(500);
  72  |         // Se chegou aqui sem erro, a ordenação funciona
  73  |         expect(true).toBe(true);
  74  |       }
  75  |     }
  76  |   });
  77  | 
  78  |   test('Deve ter filtro de busca funcional', async ({ page }) => {
  79  |     const searchInput = page.locator('input[placeholder*="Buscar"]');
  80  |     const isVisible = await searchInput.isVisible().catch(() => false);
  81  | 
  82  |     if (isVisible) {
  83  |       await searchInput.fill('teste');
  84  |       await page.waitForTimeout(500);
  85  | 
  86  |       // Verifica se algum resultado ou "nenhum item encontrado" aparece
  87  |       const results = page.locator('text=/nenhum item encontrado|de/');
  88  |       expect(await results.isVisible().catch(() => false)).toBe(true);
  89  |     }
  90  |   });
  91  | 
  92  |   test('Deve preservar agregados ao filtrar', async ({ page }) => {
  93  |     const table = page.locator('table');
  94  |     const isVisible = await table.isVisible().catch(() => false);
  95  | 
  96  |     if (isVisible) {
  97  |       // Obtém os valores dos KPIs antes de filtrar
  98  |       const totalAntes = page.locator('text=/Total de Itens/').locator('..').locator('div').last();
  99  |       const totalBeforeText = await totalAntes.textContent().catch(() => '');
  100 | 
  101 |       // Filtra por algo
  102 |       const searchInput = page.locator('input[placeholder*="Buscar"]');
  103 |       if (await searchInput.isVisible()) {
  104 |         await searchInput.fill('xyz123');
  105 |         await page.waitForTimeout(500);
  106 | 
  107 |         // Os agregados devem continuar os mesmos
  108 |         const totalDepois = page.locator('text=/Total de Itens/').locator('..').locator('div').last();
  109 |         const totalAfterText = await totalDepois.textContent().catch(() => '');
  110 | 
  111 |         // Verifica que o total não muda ao filtrar (agregados preservados)
  112 |         expect(totalBeforeText).toBe(totalAfterText);
  113 |       }
  114 |     }
  115 |   });
  116 | 
  117 |   test('Deve navegar entre setores', async ({ page }) => {
  118 |     // Tenta ir para setor anterior/próximo
  119 |     const navArrows = page.locator('button.nav-arrow');
  120 |     const count = await navArrows.count();
  121 | 
  122 |     expect(count).toBeGreaterThanOrEqual(0);
  123 |   });
  124 | 
  125 |   test('Deve ter layout responsivo', async ({ page }) => {
  126 |     // Testa em viewport mobile
  127 |     await page.setViewportSize({ width: 375, height: 667 });
  128 | 
  129 |     const heading = page.locator('text=/Suprimentos/i');
  130 |     const isVisible = await heading.isVisible().catch(() => false);
  131 | 
> 132 |     expect(isVisible).toBe(true);
      |                       ^ Error: expect(received).toBe(expected) // Object.is equality
  133 |   });
  134 | });
  135 | 
```