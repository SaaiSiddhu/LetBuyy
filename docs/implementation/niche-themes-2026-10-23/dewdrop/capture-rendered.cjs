const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = 'docs/implementation/niche-themes-2026-10-23/dewdrop';
const captures = path.join(root, 'screenshots'); fs.mkdirSync(captures, { recursive: true });
async function metrics(page) {
  return page.evaluate(() => ({
    width: innerWidth, height: innerHeight, bodyWidth: document.body.scrollWidth, documentWidth: document.documentElement.scrollWidth,
    intentionalOffscreenChrome: [...document.querySelectorAll('.lb-header__nav,.lb-skip-link')].filter(e=>e.getBoundingClientRect().left>=innerWidth||e.getBoundingClientRect().right<0).map(e=>({class:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})),
    brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')),
    overflow: [...document.querySelectorAll('body *')].filter(e => { const r=e.getBoundingClientRect(),s=getComputedStyle(e); if(e.classList.contains('lb-skip-link') && document.activeElement!==e && r.right<0)return false; if(e.closest('[aria-hidden="true"]'))return false; const panel=e.closest('.lb-header__nav'); if(panel && panel.closest('lb-mobile-nav')?.dataset.open!=='true' && panel.getBoundingClientRect().left>=innerWidth-1)return false; return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden' && (r.left< -1 || r.right>innerWidth+1); }).slice(0,30).map(e => ({tag:e.tagName, class:e.className.baseVal ?? e.className, text:e.textContent.trim().slice(0,100), left:e.getBoundingClientRect().left, right:e.getBoundingClientRect().right})),
    h1: document.querySelector('h1')?.textContent,
    smallPrimaryControls: [...document.querySelectorAll('button,input:not([type=hidden]),select,summary,.dd-button,.dd-link,.lb-header__account,.lb-header__cart')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&r.left<innerWidth&&r.right>0&&s.visibility!=='hidden'&&s.display!=='none'&&(r.width<44||r.height<44)}).map(e=>({tag:e.tagName,text:e.textContent.trim().slice(0,70),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),
  }));
}
async function settle(page) { await page.evaluate(async () => { await document.fonts.ready; for (let y=0;y<document.documentElement.scrollHeight;y+=innerHeight) { scrollTo(0,y); await new Promise(resolve=>requestAnimationFrame(resolve)); } await Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))); scrollTo(0,0); }); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
(async () => {
  const browser = await chromium.launch({ headless: true, chromiumSandbox: true }); const results=[];
  try {
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:43271' ? route.continue() : route.abort());
    const page = await context.newPage();
    for (const [label,width,height] of [['desktop',1440,1000],['tablet',834,1112],['mobile',390,844],['narrow',320,844]]) {
      await page.setViewportSize({width,height});
      for (const scene of ['home','collection','product','missing-product']) {
        await page.goto(`http://127.0.0.1:43271/${scene}.html`, {waitUntil:'networkidle'}); await settle(page);
        const result = await metrics(page); const screenshot=`screenshots/${scene}-${label}.png`;
        await page.screenshot({path:path.join(root,screenshot),fullPage:true}); results.push({scene,viewport:label,...result,screenshot});
      }
    }
    await page.setViewportSize({width:390,height:844}); await page.goto('http://127.0.0.1:43271/product.html'); await settle(page);
    const shades=page.locator('button[data-lb-variant-option]'); await shades.nth(0).focus(); await page.keyboard.press('Tab');
    const keyboard = { namedShadeTab: await shades.nth(1).evaluate(e => ({active:document.activeElement===e, value:e.getAttribute('data-variant-value'), outline:getComputedStyle(e).outlineStyle, outlineWidth:getComputedStyle(e).outlineWidth})), note:'Native focus and actual canonical island attributes only; hydration/purchase selection is a later app-integration check.' };
    const detail=page.locator('.dd-facts details').first(); await detail.locator('summary').focus(); await page.keyboard.press('Enter'); keyboard.ingredientsDisclosureOpens = await detail.evaluate(e=>e.open);
    await page.emulateMedia({reducedMotion:'reduce'}); keyboard.reducedMotion = await page.locator('.dd-theme').first().evaluate(e=>getComputedStyle(e).scrollBehavior);
    await page.goto('http://127.0.0.1:43271/product.html'); await settle(page); await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    const textExpansion = await metrics(page); await page.screenshot({path:path.join(captures,'product-mobile-text-2x.png'),fullPage:true});
    await page.goto('http://127.0.0.1:43271/home.html'); await settle(page); await page.locator('h1').evaluate(e=>e.textContent='हर दिन की देखभाल। अपनी गति से।');
    const hindi = await metrics(page); await page.screenshot({path:path.join(captures,'home-mobile-hindi.png'),fullPage:true});
    fs.writeFileSync(path.join(root,'browser-audit.json'),JSON.stringify({intentionalExclusions:'Unfocused offscreen skip link; closed offcanvas navigation wholly outside viewport, with raw panel bounds recorded. Body/document widths remain unfiltered.',scope:'Canonical Liquid output plus canonical page assembly served by allocated isolated fixture server; no Next runtime/HTTP catalog query/hydration lifecycle claim.',deviceScaleFactor:1,results,keyboard,textExpansion,hindi},null,2)+'\n');
    console.log(JSON.stringify({screenshots:results.length+2,failures:results.filter(r=>r.bodyWidth>r.width||r.documentWidth>r.width||r.brokenImages.length||r.overflow.length||r.smallPrimaryControls.length),keyboard,textExpansion,hindi}));
    await context.close();
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
