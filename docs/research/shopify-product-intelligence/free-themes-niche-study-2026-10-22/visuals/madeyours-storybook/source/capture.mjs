import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(new URL('../../../../../../../package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const scenes=JSON.parse(await fs.readFile(path.join(root,'scenes.json'),'utf8'));
const viewports={desktop:{width:1440,height:1000},tablet:{width:834,height:1112},mobile:{width:390,height:844}};
const sample=process.argv.includes('--sample');
const identityOnly=process.argv.includes('--identity');
const correctionScenes=process.argv.includes('--profile')?['12-profile']:process.argv.includes('--corrections')?['07-cart','10-sign-in','11-sign-up']:['10-sign-in','11-sign-up'];
const partial=identityOnly||process.argv.includes('--corrections')||process.argv.includes('--profile');
const stress=process.argv.includes('--stress');
const browser=await chromium.launch({headless:true,chromiumSandbox:true});
const context=await browser.newContext({deviceScaleFactor:1,reducedMotion:'reduce'});
const page=await context.newPage();
let audits=[],exports=[];
if(partial){audits=JSON.parse(await fs.readFile(path.join(root,'responsive-audit.json'),'utf8')).filter(x=>!correctionScenes.includes(x.scene));exports=JSON.parse(await fs.readFile(path.join(root,'exports.json'),'utf8')).filter(x=>!correctionScenes.includes(x.scene));}
async function ready(scene,viewport){
 await page.setViewportSize(viewport);
 await page.goto(pathToFileURL(path.join(root,scene.source)).href,{waitUntil:'load'});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(im=>im.decode().catch(()=>{})));});
}
async function measurement(){return page.evaluate(()=>({
 width:innerWidth,height:innerHeight,dpr:devicePixelRatio,documentWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
 fonts:{family:getComputedStyle(document.querySelector('.identity')||document.body).fontFamily,inter:document.fonts.check('400 16px Inter')&&document.fonts.check('600 24px Inter'),expected:document.querySelector('.identity')?'GeistIdentity':'Inter',expectedLoaded:document.fonts.check(document.querySelector('.identity')?'400 16px GeistIdentity':'400 16px Inter'),status:document.fonts.status,faces:[...document.fonts].filter(f=>f.status==='loaded').map(f=>({family:f.family,weight:f.weight,status:f.status}))},
 brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src')),
 images:[...document.images].map(i=>({source:i.getAttribute('src'),complete:i.complete,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight})),
 gridColumns:[...document.querySelectorAll('.hero,.product-grid,.workspace,.checkout-grid,.account-layout,.addresses-grid')].map(e=>({class:e.className,columns:getComputedStyle(e).gridTemplateColumns})),
 headings:[...document.querySelectorAll('h1,h2')].map(e=>e.textContent),
 clippedText:[...document.querySelectorAll('h1,h2,h3,p,label,button,a,input,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<-.5||r.right>innerWidth+.5)}).map(e=>({text:e.textContent.slice(0,100),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})),
 reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches
 }));}
try{
 if(!stress){
 for(const scene of scenes){if(partial&&!correctionScenes.includes(scene.id))continue;for(const [device,viewport]of Object.entries(viewports)){
  if(sample&&!((scene.id==='01-home-top'&&device==='desktop')||(scene.id==='05-product-specify'&&device==='mobile')||(scene.id==='09-checkout-review'&&device==='tablet')||(scene.id==='14-order-detail'&&device==='mobile')))continue;
  await ready(scene,viewport);const m=await measurement();
  if(m.width!==viewport.width||m.height!==viewport.height||m.dpr!==1||m.scrollWidth>m.width||m.brokenImages.length||!m.fonts.expectedLoaded||m.clippedText.length)throw Error(JSON.stringify({scene:scene.id,device,...m}));
  const file=(sample?'comparisons/development-samples/sample-':'images/')+scene.id+'-'+device+'.png';
  await page.screenshot({path:path.join(root,file),fullPage:true,type:'png',animations:'disabled'});
  const buf=await fs.readFile(path.join(root,file));const width=buf.readUInt32BE(16),height=buf.readUInt32BE(20);
  audits.push({scene:scene.id,device,requested:{id:device,...viewport},...m,screenshot:{width,height,format:'PNG'},capturedAt:new Date().toISOString()});
  exports.push({scene:scene.id,device,file,width,height,viewport:{...viewport,dpr:1},bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex'),renderedIndependently:true});
  console.log(scene.id,device,width+'x'+height);
 }}
 await fs.writeFile(path.join(root,sample?'comparisons/development-samples/sample-audit.json':'responsive-audit.json'),JSON.stringify(audits.sort((a,b)=>a.scene.localeCompare(b.scene)||a.device.localeCompare(b.device)),null,2)+'\n');
 if(!sample)await fs.writeFile(path.join(root,'exports.json'),JSON.stringify(exports.sort((a,b)=>a.scene.localeCompare(b.scene)||a.device.localeCompare(b.device)),null,2)+'\n');
 }else{
 const results=partial?JSON.parse(await fs.readFile(path.join(root,'comparisons/stress-audit.json'),'utf8')).filter(x=>!correctionScenes.includes(x.scene)):[];await fs.mkdir(path.join(root,'comparisons/stress'),{recursive:true});
 for(const mode of ['320px','text-200','hindi-expansion']){
 for(const scene of scenes){
  if(partial&&!correctionScenes.includes(scene.id))continue;
  if(mode==='hindi-expansion'&&!['03-collection','05-product-specify','15-addresses'].includes(scene.id))continue;
  await ready(scene,{width:mode==='320px'?320:390,height:844});
  if(mode==='text-200')await page.evaluate(()=>{
   const els=[...document.querySelectorAll('body *')].filter(e=>!['SCRIPT','STYLE','svg','path'].includes(e.tagName));
   const sizes=els.map(e=>parseFloat(getComputedStyle(e).fontSize));
   els.forEach((e,i)=>{e.style.fontSize=sizes[i]*2+'px';});
  });
  if(mode==='hindi-expansion')await page.evaluate(()=>{
   document.documentElement.lang='hi';
   const h=document.querySelector('h1');if(h)h.textContent='अपनी पसंद का आधार चुनें और अपना नाम जोड़ें';
   document.querySelectorAll('.nav a').forEach((e,i)=>e.textContent=['आधार चुनें','यह कैसे काम करता है','अपना नाम लिखें','उत्पादन और देखभाल'][i]);
   document.querySelectorAll('.field label').forEach((e,i)=>{if(i%2===0)e.textContent=e.textContent+' — कृपया ध्यान से जाँचें';});
   const p=document.querySelector('.sectionhead p,.lead');if(p)p.textContent='अपने उत्पाद का विवरण और स्वीकृत पाठ ध्यान से जाँचें। अपनी जानकारी बदलने के लिए वापस जाएँ।';
  });
  const m=await measurement();
  results.push({scene:scene.id,mode,...m,passed:m.scrollWidth<=m.width&&m.clippedText.length===0&&m.brokenImages.length===0});
  if(['01-home-top','05-product-specify','07-cart','09-checkout-review','14-order-detail','15-addresses'].includes(scene.id)||mode==='hindi-expansion')await page.screenshot({path:path.join(root,'comparisons/stress',scene.id+'-'+mode+'.png'),fullPage:true,type:'png'});
 }
 }
 await fs.writeFile(path.join(root,'comparisons/stress-audit.json'),JSON.stringify(results,null,2)+'\n');console.log('Stress',results.length,'checks;',results.filter(r=>!r.passed).map(x=>({scene:x.scene,mode:x.mode,width:x.width,scroll:x.scrollWidth,clipped:x.clippedText})));
 }
}finally{await browser.close();}
