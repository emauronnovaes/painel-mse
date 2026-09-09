const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const crypto = require('node:crypto');

const OBRAS = [106, 110, 94, 107, 108, 91, 114];
const ROOT = path.resolve(__dirname, '..');
const BASELINE = pathToFileURL(path.join(ROOT, 'backups/pre-refactor-20260904-133720/prototipo/index.html')).href;
const CURRENT = pathToFileURL(path.join(ROOT, 'prototipo/index.html')).href;

const normalize = text => (text || '').replace(/\s+/g, ' ').trim();
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);

async function waitForSupply(page) {
  await page.waitForSelector('.tabs-scroll', { timeout: 45_000 });
  // React/Babel ainda pode não ter montado o setor quando as abas aparecem.
  // Aguarda o módulo efetivamente iniciar antes de observar seu estado final.
  await page.waitForFunction(() => /CARREGANDO ITENS DE RMI/i.test(document.body.innerText) ||
    !![...document.querySelectorAll('table')].find(el => el.offsetParent !== null && /status/i.test(el.innerText)) ||
    /ERRO AO CARREGAR|NENHUM MATERIAL/i.test(document.body.innerText), null, { timeout: 45_000 });
  await page.waitForFunction(() => !/CARREGANDO ITENS DE RMI/i.test(document.body.innerText), null, { timeout: 90_000 });
  // Itens e requisições são consultas independentes; a tabela pode aparecer
  // antes de os status finais chegarem. O snapshot só é válido após ambas.
  await page.waitForLoadState('networkidle', { timeout: 45_000 });
  await page.waitForTimeout(500);
}

async function snapshot(page) {
  const base = await page.evaluate(() => {
    const norm = text => (text || '').replace(/\s+/g, ' ').trim();
    const table = [...document.querySelectorAll('table')].find(el => el.offsetParent !== null && /status/i.test(el.innerText));
    const rows = table ? [...table.querySelectorAll('tbody tr')].map(el => norm(el.innerText)).filter(Boolean) : [];
    const badges = [...document.querySelectorAll('.status-badge-rmi')]
      .filter(el => el.offsetParent !== null).map(el => norm(el.innerText));
    const status = {};
    for (const label of badges) status[label] = (status[label] || 0) + 1;
    const headings = [...document.querySelectorAll('h1,h2,h3')].map(el => norm(el.innerText)).filter(Boolean);
    return {
      state: /ERRO AO CARREGAR/i.test(document.body.innerText) ? 'erro' : table ? 'dados' : 'vazio',
      rows,
      status,
      headings,
      bodySignals: [...document.querySelectorAll('.mono')].map(el => norm(el.innerText))
        .filter(text => /TOTAL|ITEM|MATERIAL|PENDENTE|ANDAMENTO|FINALIZADO|ENTREGUE|COMPRADO/i.test(text))
        .slice(0, 80),
    };
  });
  const filters = {};
  const labels = await page.evaluate(() => {
    const statuses = ['Atrasado', 'Pendente', 'Requisitado', 'Em cotação', 'Em Andamento', 'Comprado Parcial', 'Comprado', 'Entregue Parcial', 'Entregue'];
    return statuses.filter(status => [...document.querySelectorAll('button')].some(button =>
      button.offsetParent !== null && new RegExp(`^${status}\\s+\\d+$`, 'i').test((button.innerText || '').replace(/\s+/g, ' ').trim())
    ));
  });
  for (const label of labels) {
    await page.evaluate(status => {
      const button = [...document.querySelectorAll('button')].find(candidate =>
        candidate.offsetParent !== null && new RegExp(`^${status}\\s+\\d+$`, 'i').test((candidate.innerText || '').replace(/\s+/g, ' ').trim())
      );
      button?.click();
    }, label);
    await page.waitForTimeout(300);
    filters[label] = await page.evaluate(() => {
      const table = [...document.querySelectorAll('table')].find(el => el.offsetParent !== null && /status/i.test(el.innerText));
      return table ? [...table.querySelectorAll('tbody tr')].filter(row => row.offsetParent !== null).length : 0;
    });
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find(candidate =>
        candidate.offsetParent !== null && /LIMPAR/i.test(candidate.innerText || '')
      );
      button?.click();
    });
    await page.waitForTimeout(300);
  }
  return { ...base, filters };
}

(async () => {
  const browser = await chromium.launch();
  const report = [];
  try {
    for (const obra of OBRAS) {
      console.error(`Comparando obra ${obra}...`);
      const oldPage = await browser.newPage();
      const newPage = await browser.newPage();
      await Promise.all([
        oldPage.goto(`${BASELINE}#/obra/${obra}/suprimentos-criticos`),
        newPage.goto(`${CURRENT}#/obra/${obra}/suprimentos-criticos`),
      ]);
      await Promise.all([waitForSupply(oldPage), waitForSupply(newPage)]);
      const [before, after] = await Promise.all([snapshot(oldPage), snapshot(newPage)]);
      await oldPage.close();
      await newPage.close();

      const fields = ['state', 'rows', 'status', 'headings', 'bodySignals', 'filters'];
      const differences = fields.filter(field => field !== 'filters' && JSON.stringify(before[field]) !== JSON.stringify(after[field]));
      const commonFilters = Object.keys(before.filters).filter(label => Object.hasOwn(after.filters, label));
      if (commonFilters.some(label => before.filters[label] !== after.filters[label])) differences.push('filters');
      const filterCoverage = {
        common: commonFilters,
        onlyBefore: Object.keys(before.filters).filter(label => !Object.hasOwn(after.filters, label)),
        onlyAfter: Object.keys(after.filters).filter(label => !Object.hasOwn(before.filters, label)),
      };
      const rowDifferences = differences.includes('rows') ? before.rows.map((row, index) => ({
        index,
        before: row,
        after: after.rows[index],
      })).filter(item => item.before !== item.after) : [];
      report.push({
        obra,
        equal: differences.length === 0,
        differences,
        filterCoverage,
        rowDifferences,
        before: { state: before.state, rows: before.rows.length, status: before.status, filters: before.filters, hash: hash(before) },
        after: { state: after.state, rows: after.rows.length, status: after.status, filters: after.filters, hash: hash(after) },
      });
    }
  } finally { await browser.close(); }

  console.log(JSON.stringify(report, null, 2));
  if (report.some(item => !item.equal || item.before.state === 'erro')) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
