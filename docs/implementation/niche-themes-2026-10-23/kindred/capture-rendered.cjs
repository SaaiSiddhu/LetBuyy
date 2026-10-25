const {chromium}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root='docs/implementation/niche-themes-2026-10-23/kindred';
const fixture=JSON.parse(fs.readFileSync(path.join(root,'render-fixtures.json'),'utf8'));
const origin='http://127.0.0.1:43275';
fs.mkdirSync(path.join(root,'screenshots'),{recursive:true});
function measure(){
 const visible=e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height||e.closest('.lb-sr-only'))return false;for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')return false;}if(e.classList.contains('lb-skip-link')&&document.activeElement!==e)return false;return true;};
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
 const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
 const luminance=color=>rgba(color).slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const contrast=[['.kr-intro h1',3],['.kr-button',4.5],['.kr-card-meta',4.5],['.kr-facts p',4.5],['.lb-header__nav-links>a',4.5],['.lb-predictive-search input',4.5],['.lb-footer h3',4.5],['.lb-footer__bottom',4.5]].flatMap(([selector,minimum])=>{
  const e=document.querySelector(selector);if(!e||!visible(e))return[];let parent=e,bg='white';while(parent){const color=getComputedStyle(parent).backgroundColor;if(rgba(color)[3]===255){bg=color;break;}parent=parent.parentElement;}const fg=getComputedStyle(e).color,a=luminance(fg),b=luminance(bg);return[{selector,foreground:fg,background:bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),minimum}];
 });
 const describe=e=>{const r=e.getBoundingClientRect();return{tag:e.tagName,class:typeof e.className==='string'?e.className:'svg',label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,80),left:r.left,right:r.right,width:r.width,height:r.height};};
 const overflow=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return visible(e)&&(r.left < -1||r.right > innerWidth+1);}).slice(0,45).map(describe);
 const textOverflow=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){if(!node.textContent.trim()||!visible(node.parentElement))continue;const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())if(r.width&&r.height&&(r.left < -1||r.right > innerWidth+1)){textOverflow.push({text:node.textContent.trim().slice(0,100),parent:node.parentElement.className,left:r.left,right:r.right});break;}if(textOverflow.length>=35)break;}
 const hiddenPainted=[...document.querySelectorAll('[hidden]')].filter(visible).map(describe);
 const controls='button,input,select,summary,a.kr-button,a.kr-link,.lb-header__nav-links > a';
 return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,fonts:{status:document.fonts.status,body:getComputedStyle(document.querySelector('.kr-theme')).fontFamily,heading:getComputedStyle(document.querySelector('h1')).fontFamily,lato:document.fonts.check('400 16px Lato'),latoBold:document.fonts.check('700 16px Lato'),playfair:document.fonts.check('400 32px "Playfair Display"'),loaded:[...document.fonts].filter(font=>font.status==='loaded').map(font=>font.family+' '+font.weight)},brokenImages:[...document.images].filter(image=>visible(image)&&(!image.complete||!image.naturalWidth)).map(image=>image.getAttribute('src')),contrast,smallControls:[...document.querySelectorAll(controls)].filter(e=>{const r=e.getBoundingClientRect();return visible(e)&&(r.width<43.5||r.height<43.5);}).map(describe),overflow,textOverflow,hiddenPainted,h1:document.querySelector('h1')?.textContent,giftContents:[...document.querySelectorAll('#gift-contents li')].map(e=>e.textContent.trim()),mediaViews:[...document.querySelectorAll('.kr-media-pair figure')].map(e=>({caption:e.querySelector('figcaption')?.textContent,source:e.querySelector('img')?.getAttribute('src')}))};
}
async function settle(page){let timer;try{await Promise.race([page.evaluate(async()=>{await document.fonts.ready;for(let y=0;y<document.documentElement.scrollHeight;y+=innerHeight){scrollTo(0,y);await new Promise(resolve=>requestAnimationFrame(resolve));}await Promise.all([...document.images].filter(image=>!image.closest('[hidden]')).map(image=>image.decode().catch(()=>{})));scrollTo(0,0);}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Bounded fixture readiness timeout')),10000);})]);}finally{clearTimeout(timer);}}
module.exports={measure,settle};
if(require.main===module)(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,chromiumSandbox:true});
 console.log(JSON.stringify({owner:'Kindred',auditPid:process.pid,port:43275}));
 const results=[],stress=[],errors=[];
 try{
  const context=await browser.newContext({deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultNavigationTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  for(const[device,width,height]of[['desktop',1440,1000],['tablet',834,1112],['mobile',390,844],['narrow',320,844]]){
   await page.setViewportSize({width,height});
   for(const row of fixture.files){await page.goto(origin+'/'+path.basename(row.file),{waitUntil:'networkidle'});await settle(page);const metrics=await page.evaluate(measure);const screenshot=`screenshots/${row.scene}-${device}.png`;await page.screenshot({path:path.join(root,screenshot),fullPage:true,animations:'disabled'});results.push({scene:row.scene,device,presentationOnlyCapability:row.presentationOnlyCapability,...metrics,screenshot});console.log(`${row.scene} ${device}: ${metrics.documentWidth}/${width}, bounds=${metrics.overflow.length}, text=${metrics.textOverflow.length}, small=${metrics.smallControls.length}`);}
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+'/home.html');await settle(page);const closedNavTabs=[];
  for(let step=0;step<18;step++){await page.keyboard.press('Tab');closedNavTabs.push(await page.evaluate(()=>({label:document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent?.trim().slice(0,80),inClosedPanel:Boolean(document.activeElement?.closest('[data-lb-nav-panel]'))})));}
  const closedPanel=await page.locator('[data-lb-nav-panel]').evaluate(e=>({visibility:getComputedStyle(e).visibility,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}));
  await page.goto(origin+'/product.html');await settle(page);const variants=page.locator('button[data-lb-variant-option]');await variants.last().focus();
  const keyboard={closedNavTabs,closedNavSkipped:closedNavTabs.every(row=>!row.inClosedPanel),closedPanel,variantFocus:await variants.last().evaluate(e=>({active:document.activeElement===e,outline:getComputedStyle(e).outlineStyle,outlineWidth:getComputedStyle(e).outlineWidth})),nativeDisclosure:false,scope:'Actual native controls/island markup only. No custom-element hydration or purchase claim.'};
  const detail=page.locator('.lb-product-detail__accordion').first();const before=await detail.evaluate(e=>e.open);await detail.locator('summary').focus();await page.keyboard.press('Enter');keyboard.nativeDisclosure=(await detail.evaluate(e=>e.open))!==before;
  for(const[scene,kind]of[['home-finder-presentation','text200'],['collection-filters-presentation','text200'],['product','text200'],['product','long-hindi'],['home','long-store-name'],['home','mobile-menu-state'],['home','search-state']]){
   await page.goto(origin+'/'+scene+'.html');await settle(page);
   if(kind==='text200')await page.evaluate(()=>{for(const e of [...document.querySelectorAll('body *')].reverse()){const size=parseFloat(getComputedStyle(e).fontSize);if(!['svg','path'].includes(e.tagName.toLowerCase()))e.style.fontSize=size*2+'px';}});
   else if(kind==='long-hindi')await page.locator('h1').evaluate(e=>{document.documentElement.lang='hi';e.textContent='आपके प्रियजन के लिए तैयार उपहार — हर वस्तु, पैकेजिंग और देखभाल की पूरी जानकारी ध्यान से पढ़ें';});
   else if(kind==='long-store-name')await page.locator('.lb-header__brand').evaluate(e=>e.textContent='KindredThoughtfulReadyMadeGiftsAndEverydayCelebrations');
   else if(kind==='mobile-menu-state')await page.locator('lb-mobile-nav').evaluate(e=>e.dataset.open='true');
   else if(kind==='search-state')await page.locator('[data-lb-search-overlay]').evaluate(e=>{e.hidden=false;e.querySelector('input').value='Little Pause';});
   const metrics=await page.evaluate(measure);const screenshot=`screenshots/${scene}-${kind}.png`;await page.screenshot({path:path.join(root,screenshot),fullPage:true,animations:'disabled'});stress.push({scene,kind,...metrics,screenshot,stateOnly:kind.endsWith('-state')?'Forced presentation state; no hydration interaction claim':undefined});
  }
  const failed=[...results,...stress].filter(row=>row.documentWidth>row.width||row.bodyWidth>row.width||row.brokenImages.length||row.overflow.length||row.textOverflow.length||row.hiddenPainted.length||row.smallControls.length||row.contrast.some(pair=>pair.ratio<pair.minimum)||!row.fonts.lato||!row.fonts.latoBold||!row.fonts.playfair);
  const status=failed.length||errors.length||!keyboard.closedNavSkipped||!keyboard.nativeDisclosure||!keyboard.variantFocus.active||keyboard.variantFocus.outline==='none'||keyboard.variantFocus.outlineWidth==='0px'?'needs_repair':'pass';
  const report={scope:fixture.scope,fixtureContext:fixture.context,sources:fixture.sources,generatedAt:new Date().toISOString(),results,stress,keyboard,pageErrors:errors,status,failures:failed.map(row=>({scene:row.scene,device:row.device,kind:row.kind,overflow:row.overflow,textOverflow:row.textOverflow,smallControls:row.smallControls,contrast:row.contrast.filter(pair=>pair.ratio<pair.minimum),brokenImages:row.brokenImages}))};
  fs.writeFileSync(path.join(root,'browser-audit.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status,failures:failed.length,keyboard}));if(status!=='pass')process.exitCode=1;
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
