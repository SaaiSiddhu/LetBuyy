import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire(new URL('../../../../../../../package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scenes=JSON.parse(await fs.readFile(path.join(root,'scenes.json'),'utf8'));
const devices={desktop:{width:1440,height:1000},tablet:{width:834,height:1112},mobile:{width:390,height:844}};
const sample=process.argv.includes('--sample');
const selectedScene=process.argv.find(a=>a.startsWith('--scene='))?.slice(8);
const browser=await chromium.launch({headless:true,chromiumSandbox:true});
const audit=[],exports=[];
try{
 for(const scene of scenes){
  if(selectedScene&&scene.id!==selectedScene)continue;
  if(sample&&!['01-home-top','03-collection','05-product-contents','09-checkout-review','15-addresses'].includes(scene.id))continue;
  for(const [device,viewport] of Object.entries(devices)){
   const context=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
   const page=await context.newPage();
   await page.goto(pathToFileURL(path.join(root,scene.source)).href,{waitUntil:'load'});
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
   const actual=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,documentWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src')),fontsReady:document.fonts.status==='loaded',fontFamily:getComputedStyle(document.querySelector('.identity-page')||document.body).fontFamily,expectedFontFamily:document.querySelector('.identity-page')?'Geist':'Inter',expectedFontReady:document.fonts.check('400 16px '+(document.querySelector('.identity-page')?'Geist':'Inter'))&&document.fonts.check('700 16px '+(document.querySelector('.identity-page')?'Geist':'Inter')),fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>({family:f.family,weight:f.weight})),interReady:document.fonts.check('400 16px Inter')&&document.fonts.check('700 16px Inter')}));
   const file=`images/${scene.id}-${device}.png`;
   await page.screenshot({path:path.join(root,file),fullPage:true,type:'png',animations:'disabled'});
   const buffer=await fs.readFile(path.join(root,file));const pngWidth=buffer.readUInt32BE(16),pngHeight=buffer.readUInt32BE(20);
   const sha=async f=>createHash('sha256').update(await fs.readFile(path.join(root,f))).digest('hex');
   const additionalStylesheets=['10-sign-in','11-sign-up'].includes(scene.id)?{'source/identity.css':await sha('source/identity.css')}:{};
   const record={scene:scene.id,device,...actual,viewport:{...viewport,dpr:1},file,screenshotWidth:pngWidth,screenshotHeight:pngHeight,capturedAt:new Date().toISOString(),sourceSha256:await sha(scene.source),stylesheetSha256:await sha('source/styles.css'),additionalStylesheets,scriptSha256:await sha('source/interactions.js'),pngSha256:await sha(file),captureMethod:'Isolated Playwright Chromium fullPage PNG; fresh nonpersistent context; file URL; chromiumSandbox:true',requestedViewport:viewport,imageReadiness:'All img.decode settled before capture',fontReadiness:'document.fonts.ready + expected Inter/Geist 400/700 face checks'};
   if(actual.width!==viewport.width||actual.height!==viewport.height||actual.scrollWidth>actual.width||actual.brokenImages.length||!actual.expectedFontReady||pngWidth!==viewport.width||pngHeight<viewport.height)throw new Error('Capture audit failed: '+JSON.stringify(record));
   audit.push(record);exports.push({scene:scene.id,title:scene.title,device,file,width:pngWidth,height:pngHeight,viewport:{...viewport,dpr:1},capture:'full-page'});
   console.log(`${scene.id} ${device} ${pngWidth}x${pngHeight}`);
   await context.close();
  }
 }
 const prior=async file=>JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
 const merge=(old,current)=>[...old.filter(r=>r.scene!==selectedScene),...current].sort((a,b)=>a.scene.localeCompare(b.scene)||['desktop','tablet','mobile'].indexOf(a.device)-['desktop','tablet','mobile'].indexOf(b.device));
 await fs.writeFile(path.join(root,sample?'sample-audit.json':'responsive-audit.json'),JSON.stringify(selectedScene?merge(await prior('responsive-audit.json'),audit):audit,null,2)+'\n');
 if(!sample)await fs.writeFile(path.join(root,'exports.json'),JSON.stringify(selectedScene?merge(await prior('exports.json'),exports):exports,null,2)+'\n');
}finally{await browser.close();}
