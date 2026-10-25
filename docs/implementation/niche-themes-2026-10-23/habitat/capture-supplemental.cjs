/** Run only with coordinator's isolated export lease. Own server/profile; no DB or app state. */
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const root = path.resolve('docs/implementation/niche-themes-2026-10-23/habitat');
const fontRoot = path.resolve('docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/habitat-storybook/assets/fonts');
const assetRoot = path.resolve('apps/commerce/web/public/theme-assets/habitat/v2');
const origin = 'http://127.0.0.1:43274';
const faqOnly = process.argv.includes('--faq-only');
const capturePrefix = faqOnly ? 'supplemental/faq-correction/screenshots' : 'supplemental/screenshots';
const scenes = faqOnly ? ['faq'] : ['product','round-product','invalid-product','variant-overrides','faq'];
const mime = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.ttf': 'font/ttf' };
function serve(request, response) {
  const pathname = new URL(request.url, origin).pathname;
  let file;
  if (/^\/[a-z-]+\.html$/.test(pathname)) file = path.join(root, 'rendered', pathname.slice(1));
  else if (/^\/theme-assets\/habitat\/v2\/[a-z-]+\.webp$/.test(pathname)) file = path.join(assetRoot, path.basename(pathname));
  else if (/^\/fixture-fonts\/[a-z-]+-[467]00\.ttf$/.test(pathname)) file = path.join(fontRoot, path.basename(pathname));
  if (!file || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(response);
}
async function metrics(page) {
  return page.evaluate(() => ({
    width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
    faqBounds: document.querySelector('.lb-faq-accordion') ? (()=>{const box=document.querySelector('.lb-faq-accordion').getBoundingClientRect();return {left:box.left,right:box.right,width:box.width};})() : null,
    documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth,
    fonts: [...document.fonts].map(font => ({ family: font.family, weight: font.weight, status: font.status })),
    headingFont: getComputedStyle(document.querySelector('h1') ?? document.body).fontFamily,
    brokenImages: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.getAttribute('src')),
    overflow: [...document.querySelectorAll('body *')].filter(element => {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      if (!box.width || !box.height || style.display === 'none' || style.visibility === 'hidden') return false;
      if (element.closest('[hidden],[aria-hidden="true"]') || (style.position === 'absolute' && style.clip !== 'auto')) return false;
      if (element.classList.contains('lb-skip-link') && document.activeElement !== element && box.right < 0) return false;
      return box.left < -1 || box.right > innerWidth + 1;
    }).slice(0, 25).map(element => ({ tag: element.tagName, class: element.getAttribute('class'), text: element.textContent.trim().slice(0, 90), left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })),
  }));
}
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise(resolve => requestAnimationFrame(resolve)); }
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    scrollTo(0, 0);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function main() {
  fs.mkdirSync(path.join(root, capturePrefix), { recursive: true });
  const trackedSources = ['packages/theme-engine/src/habitat-theme.ts','packages/theme-engine/src/habitat-styles.ts','packages/theme-engine/src/first-party-theme-catalog.ts','packages/theme-engine/src/theme-renderer.ts','apps/commerce/web/src/lib/demo/habitat-demo.ts','apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts','apps/commerce/web/src/lib/theme-engine/variant-options-carrier.ts','apps/commerce/web/src/lib/theme-engine/variant-facts-controller.ts','apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx','packages/commerce-core/src/product-fact-presentation.ts'];
  const sourceHashes = () => Object.fromEntries(trackedSources.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  const sourcesBefore = sourceHashes();
  const server = http.createServer(serve);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(43274, '127.0.0.1', resolve); });
  let browser;
  const results = [], errors = [];
  try {
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    const context = await browser.newContext({ deviceScaleFactor: 1, locale: 'en-IN' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    async function glyphFonts(selector) {
      const document = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: document.root.nodeId, selector });
      return nodeId ? (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts : [];
    }
    for (const [label, width, height] of [['desktop', 1440, 1000], ['tablet', 834, 1112], ['mobile', 390, 844], ['narrow', 320, 844]]) {
      await page.setViewportSize({ width, height });
      for (const scene of scenes) {
        await page.goto(`${origin}/${scene}.html`, { waitUntil: 'networkidle' }); await settle(page);
        if(scene === 'faq') await page.locator('.lb-faq-accordion__item').evaluateAll(items => items.forEach(item => item.open = true));
        const screenshot = `${capturePrefix}/${scene}-${label}.png`;
        results.push({ scene, viewport: label, ...await metrics(page), screenshot });
        await page.screenshot({ path: path.join(root, screenshot), fullPage: true });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/product.html`); await settle(page);
    const fontAudit = { heading: await glyphFonts('h1'), body: await glyphFonts('.hab-quick-facts p') };
    const linkColor = await page.locator('.lb-header__brand').evaluate(element => ({ color: getComputedStyle(element).color, textDecoration: getComputedStyle(element).textDecorationLine }));
    const contrast = await page.evaluate(() => {
      const rgb = value => value.match(/[\d.]+/g).map(Number);
      const luminance = color => rgb(color).slice(0, 3).map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return Math.round((Math.max(x, y) + .05) / (Math.min(x, y) + .05) * 100) / 100; };
      return ['.lb-header__brand', '.hab-quick-facts p', '.hab-link', '.hab-note', '.hab-facts th', '.hab-facts td', '.lb-product-detail__cta--primary', '[data-lb-variant-option]'].map(selector => {
        const element = document.querySelector(selector), style = getComputedStyle(element);
        let node = element, background = 'rgb(255,255,255)';
        while (node) { const candidate = getComputedStyle(node).backgroundColor; const channels = rgb(candidate); if (channels.length < 4 || channels[3] !== 0) { background = candidate; break; } node = node.parentElement; }
        return { selector, foreground: style.color, background, contrast: ratio(style.color, background), fontSize: style.fontSize, height: element.getBoundingClientRect().height, borderContrast: style.borderTopStyle === 'none' ? null : ratio(style.borderTopColor, background) };
      });
    });
    const option = page.locator('[data-lb-variant-option]').first(); await option.focus();
    const keyboard = { variantFocus: await option.evaluate(element => ({ active: document.activeElement === element, outline: getComputedStyle(element).outlineStyle, outlineWidth: getComputedStyle(element).outlineWidth })), scope: 'Native focus only; selected variant/cart hydration requires app integration.' };
    const summary = page.locator('.hab-facts details summary').first(); await summary.focus();
    const before = await summary.evaluate(element => element.parentElement.open); await page.keyboard.press('Enter');
    keyboard.disclosureToggled = await summary.evaluate(element => element.parentElement.open) !== before;
    const nav = page.locator('.lb-mobile-nav');
    keyboard.closedNavigation = await nav.locator('[data-lb-nav-panel]').evaluate(element => { const link = element.querySelector('a'); link.focus(); return { visibility: getComputedStyle(element).visibility, offscreenLinkFocusable: document.activeElement === link }; });
    await nav.evaluate(element => element.setAttribute('data-open', 'true'));
    await page.waitForFunction(() => Math.abs(document.querySelector('[data-lb-nav-panel]').getBoundingClientRect().left) < 1);
    keyboard.openNavigation = await nav.locator('[data-lb-nav-panel]').evaluate(element => ({ visibility: getComputedStyle(element).visibility, left: element.getBoundingClientRect().left }));
    await nav.evaluate(element => element.removeAttribute('data-open'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    keyboard.reducedMotion = await page.locator('.hab-theme').first().evaluate(element => ({ requested: matchMedia('(prefers-reduced-motion: reduce)').matches, scrollBehavior: getComputedStyle(element).scrollBehavior }));
    const textExpansion = [];
    for (const scene of scenes) {
      await page.goto(`${origin}/${scene}.html`); await settle(page);
      if(scene === 'faq') await page.locator('.lb-faq-accordion__item').evaluateAll(items => items.forEach(item => item.open = true));
      await page.evaluate(() => { const elements = [...document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,label,input,select,td,th,dt,dd,summary,strong,small')]; const sizes = elements.map(element => [element, parseFloat(getComputedStyle(element).fontSize)]); for (const [element, size] of sizes) { element.style.fontSize = `${size * 2}px`; element.style.lineHeight = '1.5'; } });
      const record = { scene, test: '200% text-only (computed font sizes doubled)', ...await metrics(page), screenshot: `${capturePrefix}/${scene}-mobile-text-2x.png` };
      await page.screenshot({ path: path.join(root, record.screenshot), fullPage: true }); textExpansion.push(record);
    }
    const sourcesAfter = sourceHashes(); const sourceStable = JSON.stringify(sourcesBefore) === JSON.stringify(sourcesAfter);
    fs.writeFileSync(path.join(root, faqOnly ? 'browser-supplemental-faq-correction.json' : 'browser-supplemental-audit.json'), JSON.stringify({ capturedAt: new Date().toISOString(), scope: 'Allocated final-source supplemental: 4 affected PDPs and editable Core FAQ, from explicit catalog v2 plus actual app mapper/renderer. Static comparison/current common state; controller switching is separately exercised by real-picker DOM tests. Fresh Chromium profile, sandbox enabled, only own local origin allowed. Navigation open-state attribute is exercised directly to verify CSS, not hydrated toggle behavior. No Next app/API/hydration/persistence/lifecycle evidence.', results, keyboard, fontAudit, linkColor, contrast, textExpansion, sourcesBefore, sourcesAfter, sourceStable, errors }, null, 2) + '\n');
    const failures = [...results, ...textExpansion].filter(result => result.bodyWidth > result.width || result.documentWidth > result.width || result.overflow.length || result.brokenImages.length || (result.scene === 'faq' && (!result.faqBounds || result.faqBounds.left < 19 || result.faqBounds.right > result.width - 19)));
    process.stdout.write(JSON.stringify({ screenshots: results.length + textExpansion.length, failures, keyboard, errors }) + '\n');
    if (!sourceStable || failures.length || errors.length || !keyboard.disclosureToggled || !keyboard.variantFocus.active || keyboard.closedNavigation.visibility !== 'hidden' || keyboard.closedNavigation.offscreenLinkFocusable || keyboard.openNavigation.visibility !== 'visible' || contrast.some(row => row.contrast < 4.5)) process.exitCode = 1;
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { process.stderr.write(String(error) + '\n'); process.exitCode = 1; });
