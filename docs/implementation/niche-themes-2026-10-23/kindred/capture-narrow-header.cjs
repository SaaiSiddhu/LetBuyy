const {chromium}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {measure,settle}=require('./capture-rendered.cjs');
const port=Number(process.argv[2]);
if(port!==43275)throw new Error('Use the explicit Kindred slot2 allocation on43275.');
const origin='http://127.0.0.1:'+port,root='docs/implementation/niche-themes-2026-10-23/kindred';
fs.mkdirSync(path.join(root,'narrow-screenshots'),{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,chromiumSandbox:true});
 console.log(JSON.stringify({owner:'Kindred',auditPid:process.pid,port}));
 const cases=[],errors=[];
 try{
  const context=await browser.newContext({deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultNavigationTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  async function fonts(selector){const tree=await cdp.send('DOM.getDocument');const node=await cdp.send('DOM.querySelector',{nodeId:tree.root.nodeId,selector});return node.nodeId?(await cdp.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId})).fonts:[];}
  async function capture(scene,width,kind='normal'){
   await page.setViewportSize({width,height:844});await page.goto(origin+'/'+scene+'.html',{waitUntil:'networkidle'});await settle(page);
   if(kind==='long-brand')await page.locator('.lb-header__brand').evaluate(e=>{e.textContent='KindredThoughtfulReadyMadeGiftsAndEverydayCelebrations';});
   if(kind==='hindi-brand')await page.locator('.lb-header__brand').evaluate(e=>{document.documentElement.lang='hi';e.textContent='किंड्रेड विचारपूर्ण तैयार उपहार और रोज़मर्रा के उत्सव';});
   if(kind==='hindi-title')await page.locator('h1').evaluate(e=>{document.documentElement.lang='hi';e.textContent='आपके प्रियजन के लिए तैयार उपहार — हर वस्तु, पैकेजिंग और देखभाल की पूरी जानकारी ध्यान से पढ़ें';});
   if(kind==='text200')await page.evaluate(()=>{for(const e of [...document.querySelectorAll('body *')].reverse()){if(!['svg','path'].includes(e.tagName.toLowerCase()))e.style.fontSize=parseFloat(getComputedStyle(e).fontSize)*2+'px';}});
   const metrics=await page.evaluate(measure);
   const header=await page.locator('.lb-header__brand').evaluate(e=>{const range=document.createRange();range.selectNodeContents(e);const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);return{text:e.textContent.trim(),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,fontSize:getComputedStyle(e).fontSize,lines:new Set(rects.map(r=>Math.round(r.top))).size};});
   const actualFonts={brand:await fonts('.lb-header__brand'),title:await fonts('h1')};
   const screenshot=`narrow-screenshots/${scene}-${width}-${kind}.png`;await page.screenshot({path:path.join(root,screenshot),fullPage:true,animations:'disabled'});
   cases.push({scene,width,kind,...metrics,header,actualFonts,screenshot});console.log(JSON.stringify({scene,width,kind,brandLines:header.lines,bounds:metrics.overflow.length,textBounds:metrics.textOverflow.length,small:metrics.smallControls.length,hidden:metrics.hiddenPainted.length}));
  }
  for(const width of[320,360,390])for(const scene of['home','product','missing-product'])await capture(scene,width);
  for(const[scene,kind]of[['home','long-brand'],['home','hindi-brand'],['product','hindi-title'],['home','text200'],['product','text200'],['collection-filters-presentation','text200']])await capture(scene,320,kind);
  await page.setViewportSize({width:320,height:844});await page.goto(origin+'/home.html');await settle(page);const tabs=[];
  for(let i=0;i<18;i++){await page.keyboard.press('Tab');tabs.push(await page.evaluate(()=>({closedPanel:Boolean(document.activeElement?.closest('[data-lb-nav-panel]')),label:document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent?.trim().slice(0,60)})));}
  await page.goto(origin+'/product.html');await settle(page);await page.locator('[data-lb-variant-option]').last().focus();
  const focus=await page.locator('[data-lb-variant-option]').last().evaluate(e=>({active:document.activeElement===e,outline:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth}));
  const detail=page.locator('.lb-product-detail__accordion').first(),before=await detail.evaluate(e=>e.open);await detail.locator('summary').focus();await page.keyboard.press('Enter');const disclosure=(await detail.evaluate(e=>e.open))!==before;
  const failures=cases.filter(row=>row.documentWidth>row.width||row.bodyWidth>row.width||row.overflow.length||row.textOverflow.length||row.smallControls.length||row.hiddenPainted.length||row.brokenImages.length||row.contrast.some(pair=>pair.ratio<pair.minimum)||(row.kind==='normal'&&row.header.lines!==1));
  const hindi=cases.filter(row=>row.kind.startsWith('hindi')).map(row=>({kind:row.kind,fonts:row.kind==='hindi-brand'?row.actualFonts.brand:row.actualFonts.title}));
  const glyphs=hindi.every(row=>row.fonts.length&&row.fonts.some(font=>font.glyphCount>0)&&row.fonts.every(font=>!/last.?resort/i.test(font.familyName)));
  const status=failures.length||errors.length||tabs.some(row=>row.closedPanel)||!focus.active||focus.outline==='none'||focus.width==='0px'||!disclosure||!glyphs?'needs_repair':'pass';
  fs.writeFileSync(path.join(root,'narrow-browser-audit.json'),JSON.stringify({status,scope:'Actual factory/dispatcher/binder/mapper/Liquid/assembly static fixture; no hydration/query/order/DB claim.',cases,failures:failures.map(row=>({scene:row.scene,width:row.width,kind:row.kind,header:row.header,overflow:row.overflow,textOverflow:row.textOverflow,smallControls:row.smallControls,hiddenPainted:row.hiddenPainted})),hindiPlatformFonts:hindi,actualGlyphFontsPresent:glyphs,tabs,focus,disclosure,pageErrors:errors},null,2)+'\n');
  console.log(JSON.stringify({status,cases:cases.length,failures:failures.length,hindi,focus,disclosure}));if(status!=='pass')process.exitCode=1;
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
