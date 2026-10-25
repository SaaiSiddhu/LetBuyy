// Local static design-artifact rendering. No user browser, network, profile or application state.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(process.cwd(),'package.json'));
const {chromium}=require('@playwright/test');
const scenes=JSON.parse(await fs.readFile(path.join(root,'scenes.json'),'utf8'));
const devices={desktop:{width:1440,height:1000},tablet:{width:834,height:1112},mobile:{width:390,height:844}};
const preflight=process.argv.includes('--preflight');
const stressOnly=process.argv.includes('--stress-only');
const browser=await chromium.launch({headless:true,chromiumSandbox:true});
const context=await browser.newContext({deviceScaleFactor:1,locale:'en-IN'});
await context.route('**/*',route=>route.request().url().startsWith('file:')?route.continue():route.abort());
const page=await context.newPage();
const errors=[]; page.on('pageerror',error=>errors.push(error.message));
async function ready(){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});}
async function metrics(){return page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,documentWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,bodyWidth:document.body.scrollWidth,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),fontsReady:document.fonts.status==='loaded',fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})),bodyFont:getComputedStyle(document.body).fontFamily,headingFont:getComputedStyle(document.querySelector('h1')||document.body).fontFamily,overflowElements:[...document.querySelectorAll('main *,header *,footer *')].filter(e=>{const s=getComputedStyle(e);const r=e.getBoundingClientRect();return s.position!=='absolute'&&r.width&&((r.left<-.5)||(r.right>innerWidth+.5));}).slice(0,15).map(e=>({tag:e.tagName,class:e.className,text:e.textContent?.slice(0,70)})),images:[...document.images].map(i=>({source:i.getAttribute('src'),naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight}))}));}
try{
 let audit=[],exports=[];
 if(!stressOnly){
 for(const scene of scenes.filter((s,i)=>!preflight||[0,2,3,4,7,8,10,14].includes(i))){
  for(const [device,viewport] of Object.entries(devices)){
   await page.setViewportSize(viewport);await page.goto(pathToFileURL(path.join(root,scene.source)).href);await ready();
   const actual=await metrics();const file=`images/${scene.id}-${device}.png`;
   if(actual.width!==viewport.width||actual.height!==viewport.height||actual.scrollWidth>actual.width||actual.brokenImages.length||!actual.fontsReady) throw Error(JSON.stringify({scene:scene.id,device,...actual}));
   if(!preflight){await page.screenshot({path:path.join(root,file),type:'png',fullPage:true});const b=await fs.readFile(path.join(root,file));exports.push({scene:scene.id,title:scene.title,device,file,width:b.readUInt32BE(16),height:b.readUInt32BE(20),viewport:{...viewport,dpr:1},capture:'full-page',sha256:crypto.createHash('sha256').update(b).digest('hex')});}
   audit.push({scene:scene.id,device,requestedViewport:{...viewport,dpr:1},...actual,captureMethod:'Isolated Playwright Chromium; file://; fresh temporary profile; chromiumSandbox:true; network blocked',captureTime:new Date().toISOString()});
  }
 }
 await fs.writeFile(path.join(root,preflight?'preflight.json':'responsive-audit.json'),JSON.stringify(audit,null,2));
 if(!preflight) await fs.writeFile(path.join(root,'exports.json'),JSON.stringify(exports,null,2));
 console.log(JSON.stringify({stage:preflight?'preflight':'capture',records:audit.length,errors}));
 }
 if(!preflight){
  const stress=[]; const stressScenes=['01-home-top','03-collection','04-product-main','05-product-dimensions','08-checkout-address','11-sign-up','15-addresses'];
  for(const sid of stressScenes){
   await page.setViewportSize({width:320,height:844});await page.goto(pathToFileURL(path.join(root,`source/${sid}.html`)).href);await ready();stress.push({scene:sid,test:'320px reflow',...await metrics()});
  }
  await page.setViewportSize(devices.mobile);await page.goto(pathToFileURL(path.join(root,'source/05-product-dimensions.html')).href);await ready();
  await page.getByRole('button',{name:'Smoked teak'}).click();
  stress.push({test:'finish invariants',scene:'05-product-dimensions',selected:await page.locator('[data-finish-label]').textContent(),package:await page.locator('[data-package]').textContent(),commonAssembledWidth:await page.locator('td').allTextContents(),...await metrics()});
  await page.screenshot({path:path.join(root,'comparisons/finish-smoked-mobile.png'),fullPage:true});
  await page.goto(pathToFileURL(path.join(root,'source/04-product-main.html')).href);await ready();
  await page.locator('.menu-toggle').click();await page.keyboard.press('Escape');stress.push({test:'mobile menu Escape/focus return',closed:await page.locator('#mobile-menu').evaluate(e=>e.hidden),focusReturned:await page.locator('.menu-toggle').evaluate(e=>e===document.activeElement)});
  await page.emulateMedia({reducedMotion:'reduce'});stress.push({test:'reduced motion',matches:await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),scrollBehavior:await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior)});
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const [sid,selector,text] of [['03-collection','.product h3 a','घर के शांत कोने के लिए प्राकृतिक सागौन की आरामदायक कुर्सी — विस्तृत माप और सामग्री की जानकारी के साथ'],['04-product-main','.pdp-info h1','Aara solid teak lounge chair with removable oatmeal linen cushion for a compact living space and quiet reading corner']]){
   await page.goto(pathToFileURL(path.join(root,`source/${sid}.html`)).href);await ready();await page.locator(selector).first().evaluate((e,t)=>{e.textContent=t;e.lang=t.charCodeAt(0)>127?'hi':'en';},text);stress.push({test:'language / long title expansion',scene:sid,...await metrics()});await page.screenshot({path:path.join(root,`comparisons/${sid}-content-stress.png`),fullPage:true});
  }
  for(const sid of ['05-product-dimensions','08-checkout-address','15-addresses']){
   await page.goto(pathToFileURL(path.join(root,`source/${sid}.html`)).href);await ready();
   await page.evaluate(()=>{const elements=[...document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,label,input,select,td,th,legend,summary,strong,small')];const sizes=elements.map(e=>({e,size:parseFloat(getComputedStyle(e).fontSize)}));for(const {e,size} of sizes){e.style.fontSize=(size*2)+'px';e.style.lineHeight='1.5';}});
   stress.push({test:'200% text-only enlargement (computed sizes doubled)',scene:sid,...await metrics()});await page.screenshot({path:path.join(root,`comparisons/${sid}-text-200.png`),fullPage:true});
  }
  await page.goto(pathToFileURL(path.join(root,'source/03-collection.html')).href);await ready();await page.locator('.product-media img').first().evaluate(e=>{const placeholder=document.createElement('div');placeholder.style='aspect-ratio:4/3;display:grid;place-items:center;padding:25px;text-align:center;background:#e9e2d5';placeholder.textContent='Product photograph not supplied';placeholder.setAttribute('role','img');placeholder.setAttribute('aria-label','Product photograph not supplied');e.replaceWith(placeholder);});stress.push({test:'missing media fallback concept',...await metrics()});await page.screenshot({path:path.join(root,'comparisons/missing-media-mobile.png'),fullPage:true});
  await fs.writeFile(path.join(root,'stress-audit.json'),JSON.stringify(stress,null,2));
  console.log(JSON.stringify({stage:'stress',records:stress.length,overflow:stress.filter(s=>s.scrollWidth>s.width).map(s=>({test:s.test,scene:s.scene,scrollWidth:s.scrollWidth,width:s.width,overflowElements:s.overflowElements}))}));
 }
}finally{await browser.close();}
