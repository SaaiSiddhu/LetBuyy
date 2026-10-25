const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const server=require('./static-server.cjs');
const root=__dirname, fixture=JSON.parse(fs.readFileSync(path.join(root,'browser-fixtures.json'),'utf8'));
const out=path.join(root,'browser-screenshots');fs.mkdirSync(out,{recursive:true});
const devices=[['desktop',1440,1000],['tablet',834,1112],['mobile',390,844],['narrow',320,844]];
async function ready(page){await page.evaluate(async()=>{document.querySelectorAll('img').forEach(image=>image.loading='eager');await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));});}
function measure(){
 const visible=e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return false;for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||s.display==='none'||s.visibility==='hidden'||s.opacity==='0')return false;if(p.tagName==='DETAILS'&&!p.open&&p!==e&&!p.querySelector(':scope > summary')?.contains(e))return false;}return true;};
 const ignore=e=>e.closest('.lb-sr-only')||(e.closest('.lb-skip-link')&&e!==document.activeElement);
 const describe=e=>{const r=e.getBoundingClientRect();return{tag:e.tagName,class:String(e.className),label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,90),left:r.left,right:r.right,width:r.width,height:r.height};};
 const bounds=[...document.querySelectorAll('body *')].filter(e=>visible(e)&&!ignore(e)).filter(e=>{const r=e.getBoundingClientRect();return r.left<-.75||r.right>innerWidth+.75;}).map(describe);
 const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 const textBounds=[],textClips=[],contrastFailures=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()){
  const e=node.parentElement;if(!e||!node.textContent.trim()||!visible(e)||ignore(e)||['SCRIPT','STYLE','OPTION'].includes(e.tagName))continue;
  const range=document.createRange();range.selectNodeContents(node);const rectangles=[...range.getClientRects()];
  for(const r of rectangles){if(r.width&&(r.left<-.75||r.right>innerWidth+.75))textBounds.push({text:node.textContent.trim().slice(0,90),class:String(e.className),left:r.left,right:r.right});
   for(let ancestor=e;ancestor&&ancestor!==document.body;ancestor=ancestor.parentElement){const s=getComputedStyle(ancestor);if(['hidden','clip'].includes(s.overflowX)){const a=ancestor.getBoundingClientRect();if(r.left<a.left-.75||r.right>a.right+.75)textClips.push({text:node.textContent.trim().slice(0,90),class:String(ancestor.className),textLeft:r.left,textRight:r.right,left:a.left,right:a.right});}}
  }
  const style=getComputedStyle(e),fg=rgb(style.color);let ancestor=e,bg=[255,255,255];while(ancestor){const c=rgb(getComputedStyle(ancestor).backgroundColor);if(c.length>=3&&(c.length<4||c[3]>=.99)){bg=c;break;}ancestor=ancestor.parentElement;}
  let opacity=fg[3]??1;for(let p=e;p;p=p.parentElement)opacity*=Number(getComputedStyle(p).opacity);
  const effective=fg.slice(0,3).map((value,index)=>value*opacity+bg[index]*(1-opacity));const a=lum(effective),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),minimum=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700)?3:4.5;
  if(!e.closest(':disabled')&&ratio+.01<minimum)contrastFailures.push({text:node.textContent.trim().slice(0,90),class:String(e.className),foreground:style.color,background:bg,opacity,ratio,minimum});
 }
 const smallTargets=[...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary')].filter(e=>visible(e)&&!ignore(e)).filter(e=>{const r=e.getBoundingClientRect();return r.width<43.5||r.height<43.5;}).map(describe);
 const closedNavigation=[...document.querySelectorAll('[aria-expanded="false"][aria-controls]')].filter(visible).map(trigger=>{const target=document.getElementById(trigger.getAttribute('aria-controls'));return{label:trigger.getAttribute('aria-label'),visible:!!target&&visible(target),tabbableDescendants:target?[...target.querySelectorAll('a,button,input,select,[tabindex]')].filter(e=>visible(e)&&!e.disabled&&e.tabIndex>=0).length:0};});
 return{width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,bounds,textBounds,textClips,contrastFailures,smallTargets,closedNavigation,brokenImages:[...document.images].filter(image=>!image.complete||!image.naturalWidth).map(image=>image.getAttribute('src')),media:[...document.images].map(image=>({src:image.getAttribute('src'),naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight})),fonts:{status:document.fonts.status,body:getComputedStyle(document.querySelector('.pn-theme')).fontFamily,loaded:[...document.fonts].filter(face=>face.status==='loaded').map(face=>({family:face.family,weight:face.weight}))},title:document.querySelector('h1')?.textContent};
}
async function scaleText(page){await page.evaluate(()=>{const sizes=[...document.querySelectorAll('body *')].filter(e=>!['STYLE','SCRIPT','IMG','svg','path'].includes(e.tagName)).map(e=>({e,size:parseFloat(getComputedStyle(e).fontSize),line:parseFloat(getComputedStyle(e).lineHeight)}));for(const{e,size,line}of sizes){e.style.fontSize=size*2+'px';if(Number.isFinite(line))e.style.lineHeight=line*2+'px';}});}
(async()=>{
 let browser;const results=[],keyboard=[],navigation=[],disclosures=[],errors=[],requests=[],platformFonts=[];let origin,port;
 try{
  if(!server.listening)await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});port=server.address().port;origin='http://127.0.0.1:'+port;
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,chromiumSandbox:true});
  const context=await browser.newContext({deviceScaleFactor:1,reducedMotion:'reduce'});await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)requests.push({url:response.url(),status:response.status()});});
  for(const[device,width,height]of devices){await page.setViewportSize({width,height});for(const scene of fixture.files){for(const textScale of [1,2]){
   await page.goto(origin+'/'+scene.scene+'.html',{waitUntil:'networkidle'});await ready(page);if(textScale===2){await scaleText(page);await ready(page);}
   const metrics=await page.evaluate(measure);const save=(['home','collection','product','hindi','missing-variant','sold-out'].includes(scene.scene)&&textScale===1)||(device==='narrow'&&['home','product','hindi'].includes(scene.scene)&&textScale===2);let screenshot;
   if(save){screenshot=`browser-screenshots/${scene.scene}-${device}-${textScale}x.png`;await page.screenshot({path:path.join(root,screenshot),fullPage:true,animations:'disabled'});}
   results.push({scene:scene.scene,device,textScale,...metrics,screenshot});console.log(`${scene.scene}/${device}/${textScale}x: width=${metrics.documentWidth}, bounds=${metrics.bounds.length}, text=${metrics.textBounds.length}, clip=${metrics.textClips.length}, contrast=${metrics.contrastFailures.length}, small=${metrics.smallTargets.length}`);
   if(scene.scene==='hindi'&&textScale===1){const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const doc=await cdp.send('DOM.getDocument');const node=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'h1'});platformFonts.push({device,...await cdp.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId})});await cdp.detach();}
  }}
   await page.goto(origin+'/product.html');await ready(page);
   for(const selector of ['.pn-pack-options','.lb-product-detail__accordion']){const detail=page.locator(selector).first();if(await detail.count()){const summary=detail.locator(':scope > summary');await summary.focus();await page.keyboard.press('Enter');assert.equal(await detail.evaluate(e=>e.open),true);const focus=await summary.evaluate(e=>({style:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth}));disclosures.push({device,selector,opens:true,focus});}}
   if(width<768){await page.goto(origin+'/home.html');await ready(page);for(let i=0;i<22;i++){await page.keyboard.press('Tab');keyboard.push(await page.evaluate(()=>({label:document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent.trim().slice(0,70),inClosedPanel:!!document.activeElement?.closest('[data-lb-nav-panel]'),outline:getComputedStyle(document.activeElement).outlineStyle,outlineWidth:getComputedStyle(document.activeElement).outlineWidth})));}
    const toggle=page.locator('[data-lb-nav-toggle]');await toggle.click();const opened=await page.locator('lb-mobile-nav').evaluate(e=>({open:e.dataset.open,focusInside:!!document.activeElement?.closest('[data-lb-nav-panel]'),scrollLock:document.body.style.overflow}));await page.keyboard.press('Escape');const closed=await toggle.evaluate(e=>({expanded:e.getAttribute('aria-expanded'),focusReturned:document.activeElement===e,scrollLock:document.body.style.overflow}));navigation.push({device,opened,closed});
   }
  }
  const failures=results.filter(r=>r.documentWidth>r.width||r.bodyWidth>r.width||r.bounds.length||r.textBounds.length||r.textClips.length||r.contrastFailures.length||r.smallTargets.length||r.brokenImages.length||!r.fonts.loaded.some(face=>face.family==='Inter')||r.closedNavigation.some(nav=>nav.visible||nav.tabbableDescendants));
  const navFailures=keyboard.filter(step=>step.inClosedPanel);const status=failures.length||navFailures.length||errors.length||requests.length?'needs_repair':'pass';
  fs.writeFileSync(path.join(root,'browser-audit.json'),JSON.stringify({scope:fixture.scope,context:fixture.context,browser:browser.version(),port,results,keyboard,navigation,disclosures,platformFonts,pageErrors:errors,failedRequests:requests,status,failures:failures.map(r=>({scene:r.scene,device:r.device,textScale:r.textScale,bounds:r.bounds,textBounds:r.textBounds,textClips:r.textClips,contrast:r.contrastFailures,small:r.smallTargets,closedNavigation:r.closedNavigation,broken:r.brokenImages})),closedNavigationTabFailures:navFailures.length},null,2)+'\n');
  console.log(JSON.stringify({status,cases:results.length,failures:failures.length,closedNavigationTabFailures:navFailures.length}));if(status!=='pass')process.exitCode=1;
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(root,'browser-resource-endstate.json'),JSON.stringify({owner:'Pantry',port,browserClosed:true,serverListening:server.listening},null,2)+'\n');console.log('Pantry owned browser and server closed.');}
})().catch(error=>{console.error(error);process.exitCode=1;});
