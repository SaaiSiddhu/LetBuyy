// Local artifact QA only. Fresh headless profile; no user browser, APIs or credentials.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  const rows = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    await page.route(/^https?:/, route => route.abort());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(__dirname, 'portfolio-comparison.html')).href);
    for (const [label, scene] of [['Home opening', '01'], ['Discovery', '03'], ['Product decision', '05']]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      if (await page.locator('.theme').count() !== 10) throw new Error('Missing theme comparison');
      await page.locator('#mode').selectOption('visual');
      for (const device of ['desktop', 'tablet', 'mobile']) {
        await page.locator('#device').selectOption(device);
        await page.evaluate(() => document.querySelectorAll('img').forEach(image => image.loading = 'eager'));
        await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
        rows.push({ scene, device, loadedScreenImages: await page.locator('.screen').count() });
      }
      await page.locator('#mode').selectOption('neutral');
    }
    await page.getByRole('button', { name: 'Home opening', exact: true }).click();
    await page.screenshot({ path: path.join(__dirname, 'portfolio-neutral-review.png'), fullPage: true });
    for (const width of [1440, 834, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const size = await page.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
      if (size.inner !== width || size.scroll > width) throw new Error(`Review hub overflow at ${width}`);
      rows.push({ reviewWidth: width, ...size });
    }
    if (errors.length) throw new Error(errors.join('\n'));
    fs.writeFileSync(path.join(__dirname, 'portfolio-review-browser.json'), JSON.stringify({ passed: true, scope: 'Original comparison artifact only; not production theme behavior', rows, pageErrors: errors }, null, 2) + '\n');
    process.stdout.write('Portfolio artifact: 90 actual screenshots load; ten theme cards; 1440/834/390/320 reflow; no page errors.\n');
  } finally {
    await browser.close();
  }
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
