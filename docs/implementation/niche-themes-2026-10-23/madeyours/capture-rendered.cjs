const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const server = require('./static-server.cjs');
const root = __dirname, origin = 'http://127.0.0.1:43276';
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'render-fixtures.json'), 'utf8'));
const output = path.join(root, 'screenshots'); fs.mkdirSync(output, { recursive: true });
const devices = [['desktop', 1440, 1000], ['tablet', 834, 1112], ['mobile', 390, 844], ['narrow', 320, 844]];
async function ready(page) { await page.evaluate(async () => { document.querySelectorAll('img').forEach(image => image.loading = 'eager'); await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); }); }
function measure() {
  const visible = e => { const r=e.getBoundingClientRect(); if(!r.width||!r.height)return false; for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||s.display==='none'||s.visibility==='hidden'||s.opacity==='0')return false;if(p.tagName==='DETAILS'&&!p.open&&p!==e&&!p.querySelector(':scope > summary')?.contains(e))return false;}return true; };
  const ignore = e => e.closest('.lb-sr-only') || (e.closest('.lb-skip-link') && e !== document.activeElement);
  const rgb = s => (s.match(/[\d.]+/g)||[]).map(Number);
  const lum = c => c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const describe = e => { const r=e.getBoundingClientRect();return{tag:e.tagName,class:String(e.className),label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,70),left:r.left,right:r.right,width:r.width,height:r.height}; };
  const bounds = [...document.querySelectorAll('body *')].filter(e=>visible(e)&&!ignore(e)).filter(e=>{const r=e.getBoundingClientRect();return r.left<-.75||r.right>innerWidth+.75;}).map(describe);
  const textBounds=[],contrastFailures=[]; const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){
    const e=node.parentElement;if(!e||!node.textContent.trim()||!visible(e)||ignore(e)||['STYLE','SCRIPT','OPTION'].includes(e.tagName))continue;
    const range=document.createRange();range.selectNodeContents(node);
    for(const r of range.getClientRects())if(r.width&&(r.left<-.75||r.right>innerWidth+.75))textBounds.push({text:node.textContent.trim().slice(0,90),class:String(e.className),left:r.left,right:r.right});
    const style=getComputedStyle(e),fg=rgb(style.color);let ancestor=e,bg=[255,255,255];
    while(ancestor){const c=rgb(getComputedStyle(ancestor).backgroundColor);if(c.length>=3&&(c.length<4||c[3]>=.99)){bg=c;break;}ancestor=ancestor.parentElement;}
    let opacity=fg[3]??1;for(let parent=e;parent;parent=parent.parentElement)opacity*=Number(getComputedStyle(parent).opacity);
    const effective=fg.slice(0,3).map((value,index)=>value*opacity+bg[index]*(1-opacity));
    const a=lum(effective),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),minimum=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700)?3:4.5;
    if(!e.closest(':disabled')&&ratio+.01<minimum)contrastFailures.push({text:node.textContent.trim().slice(0,90),class:String(e.className),foreground:style.color,effectiveOpacity:opacity,background:bg,ratio,minimum});
  }
  const smallTargets=[...document.querySelectorAll('a,button,input:not([type=hidden]),select,textarea,summary')].filter(e=>visible(e)&&!ignore(e)).filter(e=>{const r=e.getBoundingClientRect();return r.width<43.5||r.height<43.5;}).map(describe);
  const closedNavigation=[...document.querySelectorAll('[aria-expanded="false"][aria-controls]')].filter(visible).map(trigger=>{const target=document.getElementById(trigger.getAttribute('aria-controls'));return{trigger:trigger.getAttribute('aria-label'),visible:!!target&&visible(target),tabbableDescendants:target?[...target.querySelectorAll('a,button,input,select,[tabindex]')].filter(e=>visible(e)&&!e.disabled&&e.tabIndex>=0).length:0};});
  return{width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,bounds,textBounds,contrastFailures,smallTargets,closedNavigation,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),media:[...document.images].map(i=>({src:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight})),fonts:{status:document.fonts.status,body:getComputedStyle(document.querySelector('.my-theme')).fontFamily,loaded:[...document.fonts].filter(f=>f.status==='loaded').map(f=>({family:f.family,weight:f.weight}))},title:document.querySelector('h1')?.textContent};
}
async function scaleText(page){await page.evaluate(()=>{const snapshots=[...document.querySelectorAll('body *')].filter(e=>!['STYLE','SCRIPT','IMG','svg','path'].includes(e.tagName)).map(e=>({e,size:parseFloat(getComputedStyle(e).fontSize),line:parseFloat(getComputedStyle(e).lineHeight)}));for(const{e,size,line}of snapshots){e.style.fontSize=size*2+'px';if(Number.isFinite(line))e.style.lineHeight=line*2+'px';}});}
(async()=>{
  let browser;const results=[],interactions=[],keyboard=[],errors=[],requests=[];
  try{
    if(!server.listening)await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
    browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,chromiumSandbox:true});
    const context=await browser.newContext({deviceScaleFactor:1,reducedMotion:'reduce'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)requests.push({url:response.url(),status:response.status()});});
    const capture=async(scene,device,kind='baseline')=>{const metrics=await page.evaluate(measure);const file=`${scene}-${device}-${kind}.png`;await page.screenshot({path:path.join(output,file),fullPage:true,animations:'disabled'});results.push({scene,device,kind,...metrics,screenshot:'screenshots/'+file});console.log(`${scene}/${device}/${kind}: width${metrics.documentWidth}, bounds${metrics.bounds.length}, text${metrics.textBounds.length}, contrast${metrics.contrastFailures.length}, targets${metrics.smallTargets.length}`);};
    const goto=async scene=>{await page.goto(origin+'/'+scene+'.html',{waitUntil:'networkidle'});await ready(page);};
    for(const[device,width,height]of devices){
      await page.setViewportSize({width,height});
      for(const row of fixture.files){await goto(row.scene);await capture(row.scene,device);}
      for(const scene of ['home','collection','product']){await goto(scene);await scaleText(page);await capture(scene,device,'text2x');}
      await goto('product');await page.locator('h1').evaluate(e=>{document.documentElement.lang='hi';e.textContent='आपके अपने शब्दों से बने रोज़मर्रा के सामान — नाम, तरीका, शैली और स्थान की पूरी जानकारी ध्यान से जाँचें';});await capture('product',device,'long-hindi');
      await goto('product');assert.equal(await page.evaluate(()=>window.madeyoursFixture.draft()),null);
      const input=page.locator('[data-lb-personalization-text]'),review=page.locator('[data-lb-personalization-review]'),purchase=page.locator('[data-lb-add-to-cart]');
      await input.fill('Asha');assert.equal(await purchase.isDisabled(),true);await review.focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-lb-personalization-summary-text]').textContent(),'Asha');assert.equal((await page.evaluate(()=>window.madeyoursFixture.draft())).text,'Asha');await capture('product',device,'review');
      await page.locator('[data-lb-personalization-edit]').click();assert.equal(await input.evaluate(e=>document.activeElement===e),true);await input.fill('Asha ✦');
      assert.equal(await input.inputValue(),'Asha ✦');assert.equal(await page.locator('[data-lb-personalization-preview-text]').textContent(),'Asha');assert.equal(await purchase.isDisabled(),true);assert.equal(await page.evaluate(()=>window.madeyoursFixture.draft()),null);await capture('product',device,'invalid');
      await input.fill('Kabir');await review.click();assert.equal((await page.evaluate(()=>window.madeyoursFixture.draft())).text,'Kabir');interactions.push({device,review:true,editFocus:true,invalidDraftRetained:true,lastValidPreview:'Asha',staleReviewRejected:true,correctedReview:'Kabir'});
    }
    await page.setViewportSize({width:390,height:844});
    await goto('notebook');await page.locator('[data-lb-personalization-text]').fill('ABCDEFGHIJKLM');await page.locator('[data-lb-personalization-review]').click();assert.match(await page.locator('[data-lb-personalization-error]').textContent(),/1–12/);assert.equal(await page.locator('[data-lb-add-to-cart]').isDisabled(),true);interactions.push({scenario:'notebook13CharactersRejected',pass:true});
    await goto('unicode');await page.locator('[data-lb-personalization-text]').fill('Jose\u0301');await page.locator('[data-lb-personalization-review]').click();assert.equal(await page.locator('[data-lb-personalization-text]').inputValue(),'Jose\u0301');assert.equal(await page.evaluate(()=>window.madeyoursFixture.draft()),null);await page.locator('[data-lb-personalization-normalize]').click();assert.equal(await page.evaluate(()=>window.madeyoursFixture.draft()),null);await page.locator('[data-lb-personalization-review]').click();assert.equal((await page.evaluate(()=>window.madeyoursFixture.draft())).text,'José');await capture('unicode','mobile','normalized-review');interactions.push({scenario:'NFCRequiresExplicitActionAndReview',pass:true});
    await goto('unavailable');await page.locator('[data-lb-personalization-text]').fill('Asha');await page.locator('[data-lb-personalization-review]').click();assert.equal(await page.locator('[data-lb-add-to-cart]').isDisabled(),true);assert.equal(await page.evaluate(()=>window.madeyoursFixture.draft()),null);interactions.push({scenario:'unavailableBaseRemainsBlockedAfterReview',pass:true});
    await goto('product');const details=page.locator('.lb-product-detail__accordion').first();await details.locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await details.evaluate(e=>e.open),true);await capture('product','mobile','description-open');
    await page.locator('[data-lb-personalization-text]').focus();await page.keyboard.press('Tab');const focus=await page.evaluate(()=>({outline:getComputedStyle(document.activeElement).outlineStyle,width:getComputedStyle(document.activeElement).outlineWidth}));assert.notEqual(focus.outline,'none');assert.notEqual(focus.width,'0px');interactions.push({scenario:'nativeDisclosureAndKeyboardFocus',pass:true,focus});
    await goto('home');for(let i=0;i<22;i++){await page.keyboard.press('Tab');keyboard.push(await page.evaluate(()=>({label:document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent.trim().slice(0,70),inClosedPanel:!!document.activeElement?.closest('[data-lb-nav-panel]')})));}
    const failed=results.filter(r=>r.documentWidth>r.width||r.bodyWidth>r.width||r.bounds.length||r.textBounds.length||r.contrastFailures.length||r.smallTargets.length||r.brokenImages.length||!r.fonts.loaded.some(f=>f.family==='Inter')||r.closedNavigation.some(nav=>nav.visible||nav.tabbableDescendants));
    const status=failed.length||errors.length||requests.length||keyboard.some(step=>step.inClosedPanel)?'needs_repair':'pass';
    fs.writeFileSync(path.join(root,'browser-audit.json'),JSON.stringify({scope:fixture.scope,context:fixture.context,generatedAt:new Date().toISOString(),sources:fixture.sources,results,interactions,keyboard,pageErrors:errors,failedRequests:requests,status,failures:failed.map(r=>({scene:r.scene,device:r.device,kind:r.kind,bounds:r.bounds,textBounds:r.textBounds,contrast:r.contrastFailures,small:r.smallTargets,closedNavigation:r.closedNavigation,broken:r.brokenImages}))},null,2)+'\n');
    console.log(JSON.stringify({status,captures:results.length,failures:failed.length,interactions:interactions.length}));if(status!=='pass')process.exitCode=1;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));console.log('MadeYours owned browser and server closed.');}
})().catch(error=>{console.error(error);process.exitCode=1;});
