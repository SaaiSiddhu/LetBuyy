const fs=require('node:fs'),crypto=require('node:crypto'),{createRequire}=require('node:module');const req=createRequire(process.cwd()+'/apps/marketing/web/package.json');const sharp=createRequire(req.resolve('next/package.json'))('sharp');
const {chromium}=require(process.cwd()+'/node_modules/@playwright/test');const w='/tmp/letbuyy-site-20261101';
function assert(ok,message){if(!ok)throw new Error(message)}
async function capture(browser,port,path,width,scheme){
 const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',colorScheme:scheme,deviceScaleFactor:1});
 await ctx.route('**/*',r=>['GET','HEAD'].includes(r.request().method())&&['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 await ctx.addInitScript(value=>localStorage.setItem('letbuyy-theme',value),scheme);
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto(`http://127.0.0.1:${port}${path}`,{waitUntil:'networkidle'});
 if(path==='/in'||path==='/in-hi'||path==='/in-ta')await page.waitForFunction(()=>document.querySelector('.cg-scene')?.dataset.phase==='complete');
 // Exercise progressive decorative rendering through real scrolling before the full-page comparison.
 if(['/in','/in-hi','/in-ta'].includes(path)){
  const legacy=page.locator('.cmap-mobile-accordion');if(await legacy.count())assert(await legacy.evaluate(e=>getComputedStyle(e).display==='none'),'Legacy subtree unexpectedly visible');
  for(let i=0;i<45;i++){const end=await page.evaluate(()=>{window.scrollBy({top:650,behavior:'instant'});return scrollY+innerHeight>=document.documentElement.scrollHeight-2});await page.waitForTimeout(60);if(end)break}
  await page.waitForFunction(()=>Boolean(document.querySelector('.cmap-preview-source .cmap-mock')));
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(150);
 }
 // Visual snapshots require all art available; normal browser/performance tests retain native lazy loading.
 await page.evaluate(async()=>{for(const section of document.querySelectorAll('.marketing-home > section')){section.style.contentVisibility='visible';section.style.containIntrinsicBlockSize='none'}for(const image of document.images)image.loading='eager';await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))});
 await page.waitForTimeout(150);
 await page.screenshot({animations:'disabled'});
 const layout=await page.evaluate(()=>({text:document.body.innerText,lang:document.documentElement.lang,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,elements:[...document.querySelectorAll('h1,h2,h3,p,a,button,figure,img')].filter(el=>!el.closest('.cmap-mobile-accordion')).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{tag:el.tagName,text:el.tagName==='IMG'?el.getAttribute('alt'):el.textContent,visible:r.width>0&&r.height>0,rect:[r.x,r.y,r.width,r.height],font:s.fontSize,weight:s.fontWeight,line:s.lineHeight,spacing:s.letterSpacing,color:s.color,background:s.backgroundColor,border:s.borderRadius}})}));
 layout.text=layout.text.replaceAll('http://127.0.0.1:'+port,'LOCAL_ORIGIN');for(const el of layout.elements)if(typeof el.text==='string')el.text=el.text.replaceAll('http://127.0.0.1:'+port,'LOCAL_ORIGIN');const full=await page.screenshot({fullPage:true,animations:'disabled',caret:'hide'});const viewport=await page.screenshot({animations:'disabled',caret:'hide'});await ctx.close();assert(!errors.length,JSON.stringify(errors));return{layout,full,viewport};
}
(async()=>{const b=await chromium.launch({headless:true}),rows=[];fs.mkdirSync(w+'/visual',{recursive:true});const runs=[];
 for(const width of[320,375,768,1366,1920])for(const scheme of['light','dark'])runs.push({path:'/in/support',width,scheme});
try{for(const run of runs){const before=await capture(b,9038,run.path,run.width,run.scheme),after=await capture(b,9045,run.path,run.width,run.scheme);const differences=[];
 if(before.layout.text!==after.layout.text)differences.push('visible text differs');if(before.layout.height!==after.layout.height)differences.push(`height ${before.layout.height}→${after.layout.height}`);
 if(before.layout.elements.length!==after.layout.elements.length)differences.push('element count differs');
 for(let i=0;i<Math.min(before.layout.elements.length,after.layout.elements.length);i++){const a=before.layout.elements[i],z=after.layout.elements[i];if(a.visible!==z.visible||a.tag!==z.tag||a.text!==z.text||a.rect.some((x,j)=>Math.abs(x-z.rect[j])>.15)||['font','weight','line','spacing','color','background','border'].some(k=>a[k]!==z[k]))differences.push({element:i,before:a,after:z})}
 const a=await sharp(before.full).ensureAlpha().raw().toBuffer({resolveWithObject:true}),z=await sharp(after.full).ensureAlpha().raw().toBuffer({resolveWithObject:true});let different=0,totalDifference=0;
 if(a.info.width===z.info.width&&a.info.height===z.info.height){for(let i=0;i<a.data.length;i+=4){let high=false;for(let c=0;c<4;c++){const diff=Math.abs(a.data[i+c]-z.data[i+c]);totalDifference+=diff;if(diff>3)high=true}if(high)different++}}
 const key=run.path.replaceAll('/','_')+'-'+run.width+'-'+run.scheme;const save=true||differences.length||run.path==='/in'||run.path==='/in/pricing'||run.path==='/in/resources/platform/building-first-letbuyy-store';
 if(save){fs.writeFileSync(w+'/visual/'+key+'-before.png',before.viewport);fs.writeFileSync(w+'/visual/'+key+'-after.png',after.viewport)}
 if(differences.length){fs.writeFileSync(w+'/visual/'+key+'-before-full.png',before.full);fs.writeFileSync(w+'/visual/'+key+'-after-full.png',after.full)}
 const row={...run,dom_differences:differences,geometry_and_copy_equal:!differences.length,pixels_different_over_3:different,pixel_fraction:different/(a.info.width*a.info.height),mean_channel_difference:totalDifference/a.data.length,before_sha256:crypto.createHash('sha256').update(before.full).digest('hex'),after_sha256:crypto.createHash('sha256').update(after.full).digest('hex')};rows.push(row);fs.writeFileSync(w+'/visual-support-final.json',JSON.stringify({captured_at:new Date().toISOString(),method:'Reconstructed unsplit-CSS control9038 versus current split-CSS candidate9045; identical application code and assets, every CSS rule/declaration/condition equal; control preserves recorded pre-split order; fixed reduced-motion light/dark viewports; all art explicitly decoded and all sections fully revealed for visual capture; pixel differences from responsive codec changes retained separately from structural equality; only the measured display:none legacy accordion subtree is excluded from element counts; progressive previews revealed by real scrolling',rows},null,2));console.log(JSON.stringify({...run,dom_differences:differences.length,pixel_fraction:row.pixel_fraction}));}
 }finally{await b.close()};assert(rows.every(x=>x.geometry_and_copy_equal),'Visual layout/copy differences require investigation');
})().catch(e=>{console.error(e);process.exitCode=1});
