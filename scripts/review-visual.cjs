const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

// Visual review of the local implementation, including responsive overflow.
(async () => {
  const browser = await chromium.launch();
  const sectors = ['curva-s', 'encarregados', 'desvios', 'restricoes', 'histograma', 'suprimentos-criticos', 'oc-co', 'medicoes', 'tour-360'];
  const results = [];
  try {
    for (const width of [1440, 768, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve(__dirname, '../prototipo/index.html')).href + '#/obra/106/curva-s');
      await page.waitForSelector('.tabs-scroll');
      for (const sector of sectors) {
        await page.evaluate(s => { location.hash = '/obra/106/' + s; }, sector);
        await page.waitForTimeout(1800);
        const state = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 2,
          active: document.querySelector('.tab-btn.ativo')?.textContent,
          content: !!document.querySelector('.app-main')?.children.length,
        }));
        await page.screenshot({ path: path.resolve(__dirname, '../playwright-report/visual', `${width}-${sector}.png`) });
        results.push({ width, sector, ...state });
      }
      results.push({ width, errors });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify(results, null, 2));
  if (results.some(r => r.overflow || r.content === false || r.errors?.length)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
