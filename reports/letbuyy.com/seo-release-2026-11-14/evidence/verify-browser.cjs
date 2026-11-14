const {chromium,expect}=require(process.cwd()+'/node_modules/@playwright/test');
const fs=require('node:fs');
const w='/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy.com/seo-release-2026-11-14/evidence/browser';
(async()=>{
 const browser=await chromium.launch({headless:true}); const rows=[]; const interactions=[]; const blockedMutations=[];
 try {
 for(const locale of ['in','in-hi','in-ta'])for(const width of[320,375,1366])for(const scheme of['light','dark'])for(const kind of['pricing','guide']){
  const path=`/${locale}/${kind==='pricing'?'pricing':'resources/platform/building-first-letbuyy-store'}`;
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,isMobile:width<768,hasTouch:width<768});
  await context.route('**/*',route=>{if(!['GET','HEAD'].includes(route.request().method())){blockedMutations.push({method:route.request().method(),url:new URL(route.request().url()).pathname});return route.abort()}return route.continue()});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(t=>localStorage.setItem('letbuyy-theme',t),scheme);
  const response=await page.goto('http://127.0.0.1:9021'+path);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(900);
  await page.locator('footer').scrollIntoViewIfNeeded();await page.waitForTimeout(200);await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(200);
  const result=await page.evaluate(()=>({title:document.title,lang:document.documentElement.lang,h1:document.querySelector('h1')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth+1,brokenImages:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.currentSrc),font:getComputedStyle(document.querySelector('h1')).fontFamily,heroImage:[...document.querySelectorAll('main img')].find(i=>i.getBoundingClientRect().top<innerHeight)?.currentSrc,mainCount:document.querySelectorAll('main').length,planCards:document.querySelectorAll('.pricing-plan-card:not(.pricing-skel-card)').length}));
  const passed=response.status()===200&&result.mainCount===1&&!result.overflow&&!result.brokenImages.length&&!errors.length&&!!result.h1&&(kind!=='pricing'||result.planCards===4);rows.push({path,width,scheme,status:response.status(),...result,errors,passed});
  if(!passed)throw Error('Page verification failed: '+JSON.stringify(rows.at(-1)));
  if(locale==='in'&&width!==320){
   await page.screenshot({path:`${w}/${kind}-${width}-${scheme}-verified.png`});
   const checks=[];
   const activate=async locator=>width<768?locator.tap():locator.click();
   if(width<768){const menu=page.locator('.mobile-menu-btn');await activate(menu);await expect(menu).toHaveAttribute('aria-expanded','true');await expect(page.locator('.mobile-drawer-nav')).toBeVisible();await page.keyboard.press('Escape');await expect(menu).toHaveAttribute('aria-expanded','false');checks.push('touch-menu-open-escape-close')}
   else{const menu=page.locator('.header-nav button[aria-controls]').first();await activate(menu);await expect(menu).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Escape');await expect(menu).toHaveAttribute('aria-expanded','false');checks.push('desktop-menu-open-escape-close')}
   if(kind==='pricing'){const compare=page.locator('.select-plan-secondary-button');await activate(compare);await expect(compare).toHaveAttribute('aria-expanded','true');await activate(compare);await expect(compare).toHaveAttribute('aria-expanded','false');const links=await page.locator('.pricing-plan-card a').evaluateAll(es=>es.map(e=>({href:e.href,text:e.textContent})));if(links.some(e=>!['http://127.0.0.1:9002','http://localhost:9002'].includes(new URL(e.href).origin)))throw Error('Non-local account handoff');checks.push('real-four-plan-cards','comparison-expand-collapse','local-account-link-targets');
    const [signup] = await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),activate(page.locator('.pricing-plan-card a').first())]);
    if(signup?.status()!==200 || new URL(page.url()).origin !== 'http://127.0.0.1:9002' || new URL(page.url()).pathname!=='/signup')throw Error('Accounts signup route unavailable');
    await page.goBack({waitUntil:'domcontentloaded'});
    await expect(page.locator('.pricing-plan-card:not(.pricing-skel-card)')).toHaveCount(4);
    checks.push('live-local-signup-navigation','back-restores-plans');
}
   else{const tabs=page.getByRole('tab');await tabs.nth(0).scrollIntoViewIfNeeded();await tabs.nth(0).focus();await page.keyboard.press('ArrowRight');await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');await page.keyboard.press('Home');await expect(tabs.nth(0)).toHaveAttribute('aria-selected','true');await page.evaluate(()=>window.scrollTo(0,900));await page.waitForTimeout(300);const contents=page.locator('.adock-contents');await activate(contents);await expect(contents).toHaveAttribute('aria-expanded','true');await activate(page.locator('.adock-sheet-link').nth(1));await expect(contents).toHaveAttribute('aria-expanded','false');checks.push('keyboard-guide-tabs','mobile-desktop-contents-open-jump-close');}
   interactions.push({path,width,scheme,checks,passed:true});
  }
  await context.close();
 }
 for(const width of[375,1366])for(const locale of['in','in-hi','in-ta'])for(const kind of['pricing','guide']){
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:900}});const page=await context.newPage();const path=`/${locale}/${kind==='pricing'?'pricing':'resources/platform/building-first-letbuyy-store'}`;const response=await page.goto('http://127.0.0.1:9021'+path);const result={path,width,noJavaScript:true,status:response.status(),h1:await page.locator('h1').textContent(),planCards:await page.locator('.pricing-plan-card:not(.pricing-skel-card)').count(),bodyTextLength:(await page.locator('main').first().innerText()).length};result.passed=result.status===200&&!!result.h1&&result.bodyTextLength>200&&(kind!=='pricing'||result.planCards===4);rows.push(result);if(!result.passed)throw Error('No-JS content failed '+path);await context.close();
 }
 } finally {await browser.close();fs.writeFileSync(w+'/browser-verification.json',JSON.stringify({capturedAt:new Date().toISOString(),base:'http://127.0.0.1:9021',rows,interactions,blockedMutations},null,2));}
 console.log(JSON.stringify({pageCases:rows.length,interactionCases:interactions.length,allPassed:rows.every(r=>r.passed),blockedMutations:blockedMutations.length}));
})().catch(e=>{console.error(e);process.exit(1)});
