/** Exclusive coordinator slot1, owned fresh Chromium/server; no external requests or live state. */
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve('docs/implementation/niche-themes-2026-10-23/marginalia');
const assets = path.resolve('apps/commerce/web/public/theme-assets/marginalia/v2');
const fonts = path.resolve('docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/marginalia-storybook/assets');
const origin = 'http://127.0.0.1:43277';
const preflight = process.argv.includes('--preflight');
const output = preflight ? 'browser-preflight' : 'browser-captures';
const mime = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webp': 'image/webp' };
function serve(req, res) {
  const url = new URL(req.url, origin); let file;
  if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (/^\/[a-z-]+\.html$/.test(url.pathname)) file = path.join(root, 'browser-rendered', path.basename(url.pathname));
  else if (url.pathname === '/navigation.js') file = path.join(root, 'browser-rendered/navigation.js');
  else if (/^\/fixture-fonts\/[a-z-]+\.(ttf|woff2)$/.test(url.pathname)) file = path.join(fonts, path.basename(url.pathname));
  else if (/^\/theme-assets\/marginalia\/v2\/[a-z-]+\.webp$/.test(url.pathname)) file = path.join(assets, path.basename(url.pathname));
  if (!file || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res);
}
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise(done => requestAnimationFrame(done)); }
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    scrollTo(0, 0); await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}
async function metrics(page) {
  return page.evaluate(() => {
    const visible = element => {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !element.closest('[hidden],[aria-hidden="true"]') && !(style.position === 'absolute' && style.clip !== 'auto') && !element.classList.contains('lb-skip-link');
    };
    const target = element => ({ tag: element.tagName, class: element.getAttribute('class'), text: element.textContent.trim().slice(0, 65), width: +element.getBoundingClientRect().width.toFixed(2), height: +element.getBoundingClientRect().height.toFixed(2) });
    const overflow = [...document.querySelectorAll('body *')].filter(visible).filter(element => { const box = element.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1; }).slice(0, 24).map(target);
    const textOverflow = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let text;
    while ((text = walker.nextNode())) {
      if (!text.textContent.trim() || !text.parentElement || !visible(text.parentElement)) continue;
      const range = document.createRange(); range.selectNodeContents(text);
      if ([...range.getClientRects()].some(box => box.left < -1 || box.right > innerWidth + 1)) textOverflow.push({ parent: target(text.parentElement), text: text.textContent.slice(0, 70) });
      if (textOverflow.length >= 12) break;
    }
    const controls = [...document.querySelectorAll('button,input:not([type=hidden]),select,summary,a')].filter(visible).map(target);
    return { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, overflow, textOverflow, brokenImages: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src), smallTargets: controls.filter(control => control.height < 43.9 || control.width < 43.9), loadedFontFaces: [...document.fonts].filter(face => face.status === 'loaded').map(face => ({ family: face.family, weight: face.weight })), headingFont: getComputedStyle(document.querySelector('h1') || document.body).fontFamily, bodyFont: getComputedStyle(document.querySelector('.mg-theme') || document.body).fontFamily };
  });
}
async function doubleText(page) {
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('body *')].filter(element => element instanceof HTMLElement && !['SCRIPT','STYLE','SVG','IMG'].includes(element.tagName));
    const sizes = nodes.map(element => { const style = getComputedStyle(element); return [element, parseFloat(style.fontSize), style.lineHeight]; });
    for (const [element, font, line] of sizes) { element.style.fontSize = `${font * 2}px`; if (line !== 'normal') element.style.lineHeight = `${parseFloat(line) * 2}px`; }
  });
}
async function main() {
  fs.mkdirSync(path.join(root, output), { recursive: true });
  const server = http.createServer(serve); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(43277, '127.0.0.1', resolve); });
  let browser; const rows = [], pageErrors = [], failedRequests = [];
  try {
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    const context = await browser.newContext({ deviceScaleFactor: 1, locale: 'en-IN' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(); page.on('pageerror', error => pageErrors.push(error.message)); page.on('requestfailed', req => failedRequests.push(req.url()));
    const scenes = preflight ? ['home','book'] : ['home','collection','book','stationery','missing','empty','essays'];
    const sizes = preflight ? [['mobile',390,844]] : [['desktop',1440,1000],['tablet',834,1112],['mobile',390,844],['narrow',320,844]];
    async function capture(scene, label, width, height, text2x = false) {
      await page.setViewportSize({ width, height }); await page.goto(`${origin}/${scene}.html`, { waitUntil: 'networkidle' }); await settle(page);
      if (text2x) { await doubleText(page); await settle(page); }
      const row = { scene, label, text2x, ...await metrics(page), screenshot: `${output}/${scene}-${label}${text2x ? '-text2x' : ''}.png` };
      await page.screenshot({ path: path.join(root, row.screenshot), fullPage: true }); rows.push(row);
    }
    for (const [label,width,height] of sizes) { for (const scene of scenes) await capture(scene,label,width,height); console.log(JSON.stringify({ captured: label, pages: scenes.length, mode: preflight ? 'preflight' : 'final' })); }
    if (!preflight) {
      for (const scene of ['home','collection','book','stationery','empty']) await capture(scene,'mobile',390,844,true);
      for (const scene of ['long-english','long-hindi']) for (const width of [390,320]) { await capture(scene,String(width),width,844); await capture(scene,String(width),width,844,true); }
    }
    await page.setViewportSize({ width:390,height:844 }); await page.goto(`${origin}/book.html`); await settle(page);
    const closed = await page.locator('[data-lb-nav-panel]').evaluate(panel => { const link = panel.querySelector('a'); link.focus(); return { visibility:getComputedStyle(panel).visibility, linkFocusable:document.activeElement===link }; });
    const closedTabOrder=[];await page.locator('[data-lb-nav-toggle]').focus();
    for(let i=0;i<8;i++){await page.keyboard.press('Tab');closedTabOrder.push(await page.evaluate(()=>({tag:document.activeElement?.tagName,class:document.activeElement?.getAttribute('class'),insideClosedPanel:document.querySelector('[data-lb-nav-panel]').contains(document.activeElement)})));}
    await page.locator('[data-lb-nav-toggle]').click();
    const opened = await page.locator('[data-lb-nav-panel]').evaluate(panel => ({ visible:getComputedStyle(panel).visibility, focusWithin:panel.contains(document.activeElement), expanded:document.querySelector('[data-lb-nav-toggle]').getAttribute('aria-expanded') }));
    await page.keyboard.press('Shift+Tab');const shiftTabTrapped=await page.locator('[data-lb-nav-panel]').evaluate(panel=>panel.contains(document.activeElement));
    await page.keyboard.press('Tab');const tabTrapped=await page.locator('[data-lb-nav-panel]').evaluate(panel=>panel.contains(document.activeElement));
    await page.keyboard.press('Escape');
    const escaped = await page.locator('[data-lb-nav-toggle]').evaluate(toggle => ({ expanded:toggle.getAttribute('aria-expanded'), focusReturned:document.activeElement===toggle }));
    const summary = page.locator('.lb-product-detail__accordion summary').first(); await summary.focus();
    const before = await summary.evaluate(node => node.parentElement.open); await page.keyboard.press('Enter');
    const disclosure = { toggled:await summary.evaluate(node => node.parentElement.open)!==before, focusVisible:await summary.evaluate(node => ({ outline:getComputedStyle(node).outlineStyle, width:getComputedStyle(node).outlineWidth })) };
    if (!preflight) await page.screenshot({ path:path.join(root, output, 'book-description-open-mobile.png'),fullPage:true });
    const edition = [];
    for (const label of ['English paperback','English illustrated hardback','Hindi paperback']) {
      await page.locator(`[data-variant-value="${label}"]`).click();
      if (!preflight) await page.screenshot({path:path.join(root,output,`edition-${label.toLowerCase().replaceAll(' ','-')}-mobile.png`),fullPage:true});
      edition.push(await page.evaluate(() => ({ selection:document.querySelector('[data-lb-variant-option][aria-pressed=true]')?.textContent, price:document.querySelector('.lb-product-detail__price-current')?.textContent, status:document.querySelector('[data-lb-variant-status]')?.textContent, purchaseDisabled:document.querySelector('[data-lb-add-to-cart]')?.hasAttribute('disabled') })));
    }
    await page.locator('[data-variant-value="English paperback"]').click();
    const contrast = await page.evaluate(() => {
      const rgb = input => (input.match(/[\d.]+/g)||[]).map(Number);
      const luminance = input => rgb(input).slice(0,3).map(value => { value/=255; return value<=.04045 ? value/12.92 : ((value+.055)/1.055)**2.4; }).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
      const ratio = (a,b) => { const x=luminance(a),y=luminance(b); return +((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2); };
      return ['.lb-header__brand','.mg-author','.mg-facts dt','.mg-facts dd','.mg-reading cite','.lb-product-detail__cta--primary','[data-lb-variant-option]'].map(selector => {
        const element=document.querySelector(selector), style=getComputedStyle(element); let node=element,background='rgb(255,255,255)';
        while(node){const bg=getComputedStyle(node).backgroundColor,channels=rgb(bg);if(channels.length<4||channels[3]!==0){background=bg;break;}node=node.parentElement;}
        let adjacent=element.parentElement,adjacentBackground='rgb(255,255,255)';
        while(adjacent){const bg=getComputedStyle(adjacent).backgroundColor,channels=rgb(bg);if(channels.length<4||channels[3]!==0){adjacentBackground=bg;break;}adjacent=adjacent.parentElement;}
        return {selector,foreground:style.color,background,ratio:ratio(style.color,background),fontSize:style.fontSize,adjacentBackground,fillVsAdjacent:ratio(background,adjacentBackground),borderVsAdjacent:style.borderTopStyle==='none'?null:ratio(style.borderTopColor,adjacentBackground)};
      });
    });
    const cdp = await context.newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    async function glyphs(selector) { const doc=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});return nodeId?(await cdp.send('CSS.getPlatformFontsForNode',{nodeId})).fonts:[]; }
    const glyphFonts = { heading:await glyphs('h1'),body:await glyphs('.mg-author'),price:await glyphs('.lb-product-detail__price-current') };
    const fontGate = { heading:glyphFonts.heading.some(font=>font.isCustomFont && /Libre Baskerville/i.test(font.familyName)), body:glyphFonts.body.some(font=>font.isCustomFont && /Source Sans 3/i.test(font.familyName)) };
    if (!preflight) { await page.goto(`${origin}/long-hindi.html`); await settle(page); glyphFonts.hindi=await glyphs('h1'); }
    await page.emulateMedia({reducedMotion:'reduce'});
    const reducedMotion=await page.locator('.mg-theme').first().evaluate(node=>({requested:matchMedia('(prefers-reduced-motion: reduce)').matches,scrollBehavior:getComputedStyle(node).scrollBehavior}));
    await context.close(); await browser.close(); browser=null;
    const report={generatedAt:new Date().toISOString(),origin,preflight,browser:'fresh isolated Chromium; no user profile/shared IAB',rows,pageErrors,failedRequests,keyboard:{closed,closedTabOrder,opened,shiftTabTrapped,tabTrapped,escaped,disclosure},edition,glyphFonts,fontGate,contrast,reducedMotion,interactionScreenshots:preflight?[]:[`${output}/book-description-open-mobile.png`,...['english-paperback','english-illustrated-hardback','hindi-paperback'].map(name=>`${output}/edition-${name}-mobile.png`)],scope:'Actual bound Liquid and canonical assembly. Only unchanged canonical mobile-nav/variant-picker classes and pure helpers loaded in isolation. No cart/customer/order/network persistence; no full app/release lifecycle certification.'};
    fs.writeFileSync(path.join(root,preflight?'browser-preflight.json':'browser-validation.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({rows:rows.length,overflowRows:rows.filter(row=>row.documentWidth>row.viewport.width+1||row.bodyWidth>row.viewport.width+1||row.overflow.length||row.textOverflow.length).map(row=>`${row.scene}-${row.label}-${row.text2x}`),brokenImages:rows.reduce((sum,row)=>sum+row.brokenImages.length,0),pageErrors,closed,fontGate,resourcesClosed:true}));
    const rowFailures=rows.filter(row=>row.documentWidth>row.viewport.width+1||row.bodyWidth>row.viewport.width+1||row.overflow.length||row.textOverflow.length||row.smallTargets.length||row.brokenImages.length);
    if(!fontGate.heading || !fontGate.body || rowFailures.length || pageErrors.length || failedRequests.length || closed.linkFocusable || closedTabOrder.some(item=>item.insideClosedPanel) || !shiftTabTrapped || !tabTrapped || !escaped.focusReturned || !disclosure.toggled) process.exitCode=1;
  } finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
