// Coordinator-leased isolated browser/server only. No user browser profile or shared process.
const fs = require('node:fs'), path = require('node:path'), { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '../../../..'), { chromium } = createRequire(path.join(repo, 'package.json'))('@playwright/test');
const server = require('./review-server.cjs');
const out = path.join(__dirname, 'actual-liquid-review');fs.mkdirSync(out, { recursive: true });
const scenes = ['home', 'collection', 'product', 'missing', 'empty', 'invalid'];
const devices = { desktop: { width: 1440, height: 1000 }, tablet: { width: 834, height: 1112 }, mobile: { width: 390, height: 844 }, narrow: { width: 320, height: 844 } };
async function ready(page) { await page.evaluate(async () => { document.querySelectorAll('img[loading=lazy]').forEach(el => el.loading = 'eager');await document.fonts.ready;await Promise.all(Array.from(document.images, image => image.decode().catch(() => {}))); }); }
async function inspect(page) {
  return page.evaluate(() => {
    const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);return el.getClientRects().length > 0 && r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0; };
    const bounds = Array.from(document.querySelectorAll('body *')).filter(visible).map(el => { const r = el.getBoundingClientRect();return { tag: el.tagName, class: String(el.className), left: r.left, right: r.right, width: r.width, text: el.textContent?.trim().slice(0, 75) }; }).filter(r => r.left < -.75 || r.right > innerWidth + .75);
    const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
    const luminance = color => color.slice(0,3).map(n => { n /= 255;return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum,n,i) => sum + n * [.2126,.7152,.0722][i], 0);
    const contrast = [], textBounds = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);let node;
    while (node = walker.nextNode()) {
      const el = node.parentElement;if (!el || !node.textContent.trim() || !visible(el) || ['STYLE','SCRIPT'].includes(el.tagName)) continue;
      if (!el.closest('.lb-sr-only')) { const range = document.createRange();range.selectNodeContents(node);for (const r of range.getClientRects()) if (r.left < -.75 || r.right > innerWidth + .75) textBounds.push({ text: node.textContent.trim().slice(0,75), class: String(el.className), left: r.left, right: r.right }); }
      const style = getComputedStyle(el), color = rgb(style.color);let ancestor = el, background;
      while (ancestor) { const candidate = rgb(getComputedStyle(ancestor).backgroundColor);if (candidate.length >= 3 && (candidate.length < 4 || candidate[3] >= .99)) { background = candidate;break; }ancestor = ancestor.parentElement; }
      background ||= [255,255,255];const a = luminance(color), b = luminance(background), ratio = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      const threshold = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
      if (ratio + .01 < threshold) contrast.push({ text: node.textContent.trim().slice(0,75), class: String(el.className), foreground: style.color, background: background.slice(0,3), ratio: +ratio.toFixed(2), threshold });
    }
    return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, bounds, textBounds, brokenImages: Array.from(document.images).filter(el => !el.complete || !el.naturalWidth).map(el => el.src), fontStatus: document.fonts.status, loadedFonts: Array.from(document.fonts).filter(face => face.status === 'loaded').map(face => ({ family: face.family, weight: face.weight })), primaryFont: getComputedStyle(document.querySelector('.ct-theme')).fontFamily, contrastFailures: contrast, title: document.querySelector('h1')?.textContent, cardCount: document.querySelectorAll('.ct-card').length };
  });
}
(async () => {
  let browser;const audit = [], keyboard = [];
  try {
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    process.stdout.write(`Circuit isolated Chromium ${browser.version()}\n`);
    for (const [device, viewport] of Object.entries(devices)) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' }), page = await context.newPage();
      for (const scene of scenes) {
        await page.goto(`http://127.0.0.1:43272/${scene}.html`);await ready(page);
        const metrics = await inspect(page);audit.push({ scene, device, textScale: 1, metrics });
        await page.screenshot({ path: path.join(out, `${scene}-${device}.png`), fullPage: true });
        process.stdout.write(`${scene}/${device}: bounds=${metrics.bounds.length} contrast=${metrics.contrastFailures.length} images=${metrics.brokenImages.length}\n`);
      }
      if (['mobile','narrow','tablet'].includes(device)) for (const scene of ['home','collection','product']) {
        await page.goto(`http://127.0.0.1:43272/${scene}.html`);await page.evaluate(() => document.documentElement.style.fontSize = '200%');await ready(page);
        const metrics = await inspect(page);audit.push({ scene, device, textScale: 2, metrics });
        if (device === 'mobile') await page.screenshot({ path: path.join(out, `${scene}-${device}-text2x.png`), fullPage: true });
        process.stdout.write(`${scene}/${device}/text2x: bounds=${metrics.bounds.length} contrast=${metrics.contrastFailures.length}\n`);
      }
      if (device === 'mobile') {
        await page.goto('http://127.0.0.1:43272/collection.html');await ready(page);
        for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab');keyboard.push(await page.evaluate(() => { const el = document.activeElement, s = getComputedStyle(el), r = el.getBoundingClientRect();return { tag: el.tagName, label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0,60), outline: s.outlineStyle, outlineWidth: s.outlineWidth, x: r.left, right: r.right, width: r.width }; })); }
      }
      await context.close();
    }
    const failures = audit.filter(r => r.metrics.documentWidth > r.metrics.viewport || r.metrics.bodyWidth > r.metrics.viewport || r.metrics.bounds.length || r.metrics.textBounds.length || r.metrics.brokenImages.length || r.metrics.contrastFailures.length || !r.metrics.loadedFonts.length);
    fs.writeFileSync(path.join(__dirname,'visual-audit.json'),JSON.stringify({ scope:'Actual static Liquid assembly; local M1 font bytes; no hydration, checkout, PSP, API, DB or performance certification', browser:browser.version(), audit, keyboard, failures:failures.map(r=>({scene:r.scene,device:r.device,textScale:r.textScale})), passed:!failures.length },null,2)+'\n');
    process.stdout.write(`Circuit visual audit ${audit.length-failures.length}/${audit.length} cases pass\n`);if (failures.length) process.exitCode = 1;
  } finally { if (browser) await browser.close();await new Promise(resolve=>server.close(resolve)); }
})().catch(error => { process.stderr.write(error.stack+'\n');server.close();process.exitCode=1; });
