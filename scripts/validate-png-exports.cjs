const { chromium } = require('playwright');
const sharp = require('sharp');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const APP = pathToFileURL(path.join(ROOT, 'prototipo/index.html')).href;
const SUPPLY_EXPORT_WORKS = [106, 110, 107, 108, 91, 114];

async function waitForApp(page) {
  await page.waitForSelector('.tabs-scroll', { timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});
}

async function inspectPng(filePath, expected) {
  const input = await fs.readFile(filePath);
  const metadata = await sharp(input).metadata();
  const stats = await sharp(input).stats();
  const result = {
    file: path.basename(filePath),
    bytes: input.length,
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    channels: metadata.channels,
    entropy: Number(stats.entropy.toFixed(3)),
  };
  if (metadata.format !== 'png') throw new Error(`${result.file}: formato ${metadata.format}, esperado PNG`);
  if (expected.width && metadata.width !== expected.width) throw new Error(`${result.file}: largura ${metadata.width}, esperada ${expected.width}`);
  if (expected.height && metadata.height !== expected.height) throw new Error(`${result.file}: altura ${metadata.height}, esperada ${expected.height}`);
  if (input.length < 10_000 || stats.entropy < 0.1) throw new Error(`${result.file}: imagem vazia ou uniforme`);
  return result;
}

async function downloadFrom(page, buttonText, outputDir, expected) {
  const button = page.getByRole('button', { name: buttonText, exact: true });
  await button.waitFor({ state: 'visible', timeout: 90_000 });
  await page.waitForFunction(text => {
    const candidate = [...document.querySelectorAll('button')].find(el =>
      el.offsetParent !== null && el.innerText.replace(/\s+/g, ' ').trim() === text);
    return candidate && !candidate.disabled;
  }, buttonText, { timeout: 90_000 });
  const downloadPromise = page.waitForEvent('download', { timeout: 45_000 });
  await button.click();
  const download = await downloadPromise;
  const filePath = path.join(outputDir, download.suggestedFilename());
  await download.saveAs(filePath);
  return inspectPng(filePath, expected);
}

async function buttonState(page, buttonText) {
  return page.evaluate(text => {
    const button = [...document.querySelectorAll('button')].find(el =>
      el.offsetParent !== null && el.innerText.replace(/\s+/g, ' ').trim() === text);
    return button ? { present: true, disabled: button.disabled } : { present: false, disabled: null };
  }, buttonText);
}

(async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'painel-mse-png-'));
  const browser = await chromium.launch();
  const report = { outputDir, supplies: [], other: [], porto: null };
  try {
    for (const obra of SUPPLY_EXPORT_WORKS) {
      console.error(`Validando slide de suprimentos da obra ${obra}...`);
      const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
      await page.goto(`${APP}#/obra/${obra}/suprimentos-criticos`);
      await waitForApp(page);
      await page.waitForFunction(() => !/CARREGANDO ITENS DE RMI/i.test(document.body.innerText), null, { timeout: 90_000 });
      const png = await downloadFrom(page, 'Gráficos PNG ↓', outputDir, { width: 3840, height: 2160 });
      report.supplies.push({ obra, ...png });
      await page.close();
    }

    const porto = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await porto.goto(`${APP}#/obra/94/suprimentos-criticos`);
    await waitForApp(porto);
    report.porto = { obra: 94, exportButtonAbsent: await porto.getByRole('button', { name: 'Gráficos PNG ↓', exact: true }).count() === 0 };
    if (!report.porto.exportButtonAbsent) throw new Error('Porto (94): botão de exportação deveria estar ausente');
    await porto.close();

    let encarregadosValidado = false;
    for (const obra of [106, 107, 108, 110, 91, 114]) {
      const encarregados = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
      await encarregados.goto(`${APP}#/obra/${obra}/encarregados`);
      await waitForApp(encarregados);
      await encarregados.waitForFunction(() => !/CARREGANDO ENCARREGADOS/i.test(document.body.innerText), null, { timeout: 90_000 });
      const state = await buttonState(encarregados, 'Baixar PNG ↓');
      if (state.present && !state.disabled) {
        report.other.push({ module: 'encarregados', obra, ...await downloadFrom(encarregados, 'Baixar PNG ↓', outputDir, { width: 2300 }) });
        encarregadosValidado = true;
        await encarregados.close();
        break;
      }
      await encarregados.close();
    }
    if (!encarregadosValidado) report.other.push({ module: 'encarregados', skipped: 'nenhuma obra testada apresentou ranking habilitado no estado atual' });

    const histograma = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
    await histograma.goto(`${APP}#/obra/106/histograma`);
    await waitForApp(histograma);
    await histograma.waitForFunction(() => !document.querySelector('.skel'), null, { timeout: 90_000 });
    report.other.push({ module: 'histograma', ...await downloadFrom(histograma, 'Exportar PNG', outputDir, {}) });
    await histograma.close();
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
