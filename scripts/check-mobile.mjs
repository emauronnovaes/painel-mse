/**
 * Validação mobile do Painel MSE — viewports 390×844 e 768×1024.
 * Roda: node scripts/check-mobile.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'prototipo', 'index.html');
const fileUrl = pathToFileURL(htmlPath).href;

const SETORES = [
  'curva-s', 'encarregados', 'histograma', 'suprimentos-criticos',
  'oc-co', 'desvios', 'restricoes', 'medicoes', 'tour-360',
];

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
];

async function checkViewport(browser, vp) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${fileUrl}#/obra/106/curva-s`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.tabs-scroll', { timeout: 30000 });
  // Babel + React boot
  await page.waitForTimeout(2500);

  const shell = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      clientWidth: doc.clientWidth,
      tabsCount: document.querySelectorAll('.tabs-scroll .tab-btn').length,
      hasAppShell: !!document.querySelector('.app-shell'),
    };
  });

  if (shell.tabsCount < 9) errors.push(`${vp.name}: esperava ≥9 abas, achou ${shell.tabsCount}`);
  if (shell.scrollWidth > shell.clientWidth + 2) {
    errors.push(`${vp.name}: overflow horizontal no casco (scrollWidth=${shell.scrollWidth} > clientWidth=${shell.clientWidth})`);
  }

  const reached = [];
  for (const slug of SETORES) {
    await page.evaluate((s) => { window.location.hash = `#/obra/106/${s}`; }, slug);
    await page.waitForTimeout(400);
    const ok = await page.evaluate((s) => {
      const ativo = document.querySelector('.tab-btn.ativo');
      const main = document.querySelector('.app-main');
      const labelOk = !!ativo && (ativo.textContent || '').length > 0;
      const contentOk = !!main && main.children.length > 0;
      const hashOk = window.location.hash.includes(`/${s}`);
      // garante que a aba ativa cabe no scroll das tabs
      if (ativo) ativo.scrollIntoView({ inline: 'center', block: 'nearest' });
      return { labelOk, contentOk, hashOk, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 };
    }, slug);
    if (!ok.hashOk || !ok.contentOk || !ok.labelOk) {
      errors.push(`${vp.name}: setor ${slug} não abriu corretamente (${JSON.stringify(ok)})`);
    } else {
      reached.push(slug);
    }
    if (ok.overflow) {
      errors.push(`${vp.name}: overflow horizontal em ${slug}`);
    }
  }

  // setas alcançam última aba
  for (let i = 0; i < SETORES.length + 2; i++) {
    await page.click('.nav-arrow:last-of-type');
    await page.waitForTimeout(120);
  }
  const afterArrows = await page.evaluate(() => window.location.hash);
  if (!afterArrows.includes('/')) errors.push(`${vp.name}: setas não navegaram`);

  await page.close();
  return { vp: vp.name, reached, errors, shell };
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const vp of VIEWPORTS) {
    results.push(await checkViewport(browser, vp));
  }
} finally {
  await browser.close();
}

let failed = false;
for (const r of results) {
  console.log(`\n=== ${r.vp} ===`);
  console.log(`abas: ${r.shell.tabsCount}, clientWidth=${r.shell.clientWidth}, scrollWidth=${r.shell.scrollWidth}`);
  console.log(`setores ok: ${r.reached.length}/${SETORES.length}`);
  if (r.errors.length) {
    failed = true;
    r.errors.forEach((e) => console.log('FAIL:', e));
  } else {
    console.log('OK');
  }
}

if (failed) {
  process.exit(1);
}
console.log('\nTodos os checks mobile passaram.');
