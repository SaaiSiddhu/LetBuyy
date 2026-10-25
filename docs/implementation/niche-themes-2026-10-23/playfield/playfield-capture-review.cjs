// Coordinator-leased slot2. Only this script's browser and localhost server are closed.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '../../../..');
const { chromium } = createRequire(path.join(repo, 'package.json'))('@playwright/test');
const server = require('./playfield-review-server.cjs');
const output = path.join(__dirname, 'actual-liquid-review');fs.mkdirSync(output, { recursive: true });
const scenes = ['home', 'collection', 'collection-all', 'product', 'missing', 'edition-cleared', 'edition-different', 'empty', 'long-copy', 'hindi'];
const devices = { desktop: { width: 1440, height: 1000 }, tablet: { width: 834, height: 1112 }, mobile: { width: 390, height: 844 }, narrow: { width: 320, height: 844 } };
async function ready(page) {
  await page.evaluate(async () => { document.querySelectorAll('img[loading=lazy]').forEach(image => image.loading = 'eager');await document.fonts.ready;await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
}
async function inspect(page) {
  return page.evaluate(() => {
    const visible = element => { const box = element.getBoundingClientRect(), style = getComputedStyle(element);return element.getClientRects().length > 0 && box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0; };
    const ignored = element => element.closest('.lb-sr-only') || (element.closest('.lb-skip-link') && element !== document.activeElement);
    const bounds = [...document.querySelectorAll('body *')].filter(element => visible(element) && !ignored(element)).flatMap(element => { const box = element.getBoundingClientRect();return box.left < -.75 || box.right > innerWidth + .75 ? [{ tag: element.tagName, class: String(element.className), left: box.left, right: box.right, text: element.textContent?.trim().slice(0, 70) }] : []; });
    const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
    const luminance = color => color.slice(0, 3).map(n => { n /= 255;return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, n, index) => sum + n * [.2126, .7152, .0722][index], 0);
    const contrast = [], textBounds = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);let node;
    while (node = walker.nextNode()) {
      const element = node.parentElement;if (!element || !node.textContent.trim() || !visible(element) || ignored(element) || ['STYLE', 'SCRIPT', 'OPTION'].includes(element.tagName)) continue;
      const range = document.createRange();range.selectNodeContents(node);
      for (const box of range.getClientRects()) if (box.left < -.75 || box.right > innerWidth + .75) textBounds.push({ text: node.textContent.trim().slice(0, 70), class: String(element.className), left: box.left, right: box.right });
      const style = getComputedStyle(element), foreground = rgb(style.color);let ancestor = element, background;
      while (ancestor) { const candidate = rgb(getComputedStyle(ancestor).backgroundColor);if (candidate.length >= 3 && (candidate.length < 4 || candidate[3] >= .99)) { background = candidate;break; }ancestor = ancestor.parentElement; }
      background ||= [255, 255, 255]; const a = luminance(foreground), b = luminance(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const threshold = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
      if (ratio + .01 < threshold) contrast.push({ text: node.textContent.trim().slice(0, 70), class: String(element.className), foreground: style.color, background, ratio: +ratio.toFixed(2), threshold });
    }
    const targets = [...document.querySelectorAll('a,button,input:not([type=hidden]),select,textarea,summary')].filter(element => visible(element) && !ignored(element)).flatMap(element => {
      const target = element.matches('[type=checkbox],[type=radio]') ? element.closest('label') || element : element;
      const box = target.getBoundingClientRect();return box.width < 43.5 || box.height < 43.5 ? [{ tag: element.tagName, class: String(element.className), label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 50), width: box.width, height: box.height }] : [];
    });
    const closedNavigation = [...document.querySelectorAll('[aria-expanded="false"][aria-controls]')].filter(visible).map(trigger => {
      const target = document.getElementById(trigger.getAttribute('aria-controls'));
      return { trigger: trigger.getAttribute('aria-label'), target: trigger.getAttribute('aria-controls'), exists: Boolean(target), visible: Boolean(target && visible(target)), tabbableDescendants: target ? [...target.querySelectorAll('a,button,input,select,[tabindex]')].filter(element => visible(element) && !element.disabled && element.tabIndex >= 0).length : 0 };
    });
    return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, bounds, textBounds, contrastFailures: contrast, smallTargets: targets, closedNavigation, brokenImages: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src), loadedFonts: [...document.fonts].filter(face => face.status === 'loaded').map(face => ({ family: face.family, weight: face.weight })), fontStatus: document.fonts.status, primaryFont: getComputedStyle(document.querySelector('.pf-theme')).fontFamily, title: document.querySelector('h1')?.textContent, primaryColor: getComputedStyle(document.querySelector('.pf-theme')).getPropertyValue('--primary').trim() };
  });
}
async function scaleText(page) {
  await page.evaluate(() => { const snapshots = [...document.querySelectorAll('body *')].filter(element => !['STYLE', 'SCRIPT', 'IMG', 'SVG', 'PATH'].includes(element.tagName)).map(element => ({ element, size: parseFloat(getComputedStyle(element).fontSize), lineHeight: parseFloat(getComputedStyle(element).lineHeight) }));for (const { element, size, lineHeight } of snapshots) { element.style.fontSize = size * 2 + 'px';if (Number.isFinite(lineHeight)) element.style.lineHeight = lineHeight * 2 + 'px'; } });
}
(async () => {
  let browser;const audit = [], keyboard = [], captures = [];
  try {
    if (!server.listening) await new Promise((resolve, reject) => { server.once('listening', resolve);server.once('error', reject); });
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    process.stdout.write(`Playfield owned Chromium ${browser.version()} on127.0.0.1:43273\n`);
    for (const [device, viewport] of Object.entries(devices)) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      const page = await context.newPage();
      for (const scene of scenes) {
        await page.goto(`http://127.0.0.1:43273/${scene}.html`);await ready(page);
        const metrics = await inspect(page);audit.push({ scene, device, textScale: 1, metrics });
        const file = `${scene}-${device}.png`;await page.screenshot({ path: path.join(output, file), fullPage: true });
        captures.push({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex') });
        process.stdout.write(`${scene}/${device}: bounds${metrics.bounds.length} text${metrics.textBounds.length} contrast${metrics.contrastFailures.length} targets${metrics.smallTargets.length}\n`);
      }
      if (device !== 'desktop') for (const scene of ['home', 'collection', 'product']) {
        await page.goto(`http://127.0.0.1:43273/${scene}.html`);await ready(page);await scaleText(page);
        const metrics = await inspect(page);audit.push({ scene, device, textScale: 2, metrics });
        if (device === 'mobile') { const file = `${scene}-${device}-text2x.png`;await page.screenshot({ path: path.join(output, file), fullPage: true });captures.push({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex') }); }
        process.stdout.write(`${scene}/${device}/computed-text2x: bounds${metrics.bounds.length} text${metrics.textBounds.length} contrast${metrics.contrastFailures.length} targets${metrics.smallTargets.length}\n`);
      }
      if (device === 'mobile') {
        await page.goto('http://127.0.0.1:43273/collection.html');await ready(page);
        for (let index = 0; index < 22; index++) { await page.keyboard.press('Tab');keyboard.push(await page.evaluate(() => { const element = document.activeElement, box = element.getBoundingClientRect(), style = getComputedStyle(element);return { tag: element.tagName, class: String(element.className), html: element.outerHTML.slice(0, 220), label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 60), left: box.left, right: box.right, width: box.width, height: box.height, outline: style.outlineStyle, outlineWidth: style.outlineWidth, hiddenAncestor: Boolean(element.closest('[hidden],[aria-hidden="true"]')) }; })); }
      }
      await context.close();
    }
    const failures = audit.filter(row => row.metrics.documentWidth > row.metrics.viewport || row.metrics.bodyWidth > row.metrics.viewport || row.metrics.bounds.length || row.metrics.textBounds.length || row.metrics.contrastFailures.length || row.metrics.smallTargets.length || row.metrics.brokenImages.length || !row.metrics.loadedFonts.length || row.metrics.closedNavigation.some(nav => nav.visible || nav.tabbableDescendants));
    // BODY records the browser's tab-cycle boundary, rather than a focusable page control.
    const keyboardFailures = keyboard.filter(row => row.tag !== 'BODY' && (row.hiddenAncestor || row.width === 0 || row.left < -.75 || row.right > 390.75 || row.outline === 'none' || parseFloat(row.outlineWidth) < 2));
    fs.writeFileSync(path.join(__dirname, 'visual-audit.json'), JSON.stringify({ scope: 'Actual static Liquid assembly, real app data binding/mapper; approved local Inter bytes. No hydration/API/DB/transactions/publish/lifecycle/performance or complete accessibility certification.', browser: browser.version(), port: 43273, audit, keyboard, keyboardFailures, captures, failures: failures.map(row => ({ scene: row.scene, device: row.device, textScale: row.textScale })), passed: failures.length === 0 && keyboardFailures.length === 0 }, null, 2) + '\n');
    process.stdout.write(`Playfield visual audit ${audit.length - failures.length}/${audit.length} cases; keyboard failures${keyboardFailures.length}\n`);
    if (failures.length || keyboardFailures.length) process.exitCode = 1;
  } finally { if (browser) await browser.close();await new Promise(resolve => server.close(resolve));process.stdout.write('Owned Playfield browser and server closed.\n'); }
})().catch(error => { process.stderr.write(error.stack + '\n');server.close();process.exitCode = 1; });
