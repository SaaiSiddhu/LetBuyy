// Explicitly leased isolated slot1. Own new Chromium + localhost43271 only; close in finally.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net'),{createRequire}=require('node:module');
const {server,requests,manifest,repo}=require('./server.cjs');
const {chromium}=createRequire(path.join(repo,'package.json'))('@playwright/test');
const {StorefrontDiscoveryQuerySchema,storefrontDiscoveryQueryFromEntries,storefrontDiscoveryUrl}=createRequire(path.join(repo,'apps/commerce/web/package.json'))('@letbuyy/commerce-core');
const out=path.join(__dirname,'screenshots');fs.mkdirSync(out,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const ledger={slot:1,task:'playfield-browser-css-accessibility-follow-up',port:43271,host:'127.0.0.1',nodePid:process.pid,startedAt:new Date().toISOString(),browserCreated:false,serverCreated:false,browserClosed:false,serverClosed:false,sourceFrozen:true};
const records=[],screenshots=[],errors=[],blockedRequests=[];let browser;
const check=(test,message)=>{if(!test)throw Error(message);};
async function ready(page){await page.evaluate(async()=>{document.querySelectorAll('img[loading="lazy"]').forEach(img=>img.loading='eager');await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});}
async function snapshot(page,file){await page.screenshot({path:path.join(out,file),fullPage:true});screenshots.push({file,sha256:sha(fs.readFileSync(path.join(out,file)))});return file;}
async function metrics(page){return page.evaluate(()=>{
 const shown=el=>{if(!el)return false;const b=el.getBoundingClientRect(),s=getComputedStyle(el);return !!el.getClientRects().length&&b.width>1&&b.height>1&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0;};
 const target=el=>{if(el.id)return `[id=${JSON.stringify(el.id)}]`;const f=el.closest('form'),base=f?.className?'form.'+f.className.split(/\s+/).join('.'):el.closest('aside.ct-desktop-facets')?'aside.ct-desktop-facets':el.closest('details.ct-mobile-facets')?'details.ct-mobile-facets':'';return base+' '+el.tagName.toLowerCase()+(el.name?`[name=${JSON.stringify(el.name)}]`:'')+(el.type==='radio'||el.type==='checkbox'?`[value=${JSON.stringify(el.value)}]`:'');};
 const focus=document.activeElement,b=focus.getBoundingClientRect(),s=getComputedStyle(focus);
 return {viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,devicePixelRatio,scrollY,fonts:[...document.fonts].filter(face=>face.status==='loaded').map(face=>({family:face.family,weight:face.weight})),h1:document.querySelector('h1')?.textContent,focus:{tag:focus.tagName,panel:focus.closest('aside.ct-desktop-facets')?'desktop':focus.closest('details.ct-mobile-facets')?'mobile':null,selector:target(focus),name:focus.getAttribute('aria-label')||focus.textContent?.trim().slice(0,90),rect:{left:b.left,top:b.top,width:b.width,height:b.height,right:b.right},shown:shown(focus),underAriaHidden:!!focus.closest('[aria-hidden="true"],[hidden],[inert]'),outline:s.outline,boxShadow:s.boxShadow},brokenImages:[...document.images].filter(img=>!img.complete||!img.naturalWidth).map(img=>img.src)};
 });}
async function axFor(page,selector){const session=await page.context().newCDPSession(page);try{await session.send('DOM.enable');await session.send('Accessibility.enable');const{root}=await session.send('DOM.getDocument');const{nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});if(!nodeId)return {exists:false};const{node}=await session.send('DOM.describeNode',{nodeId});const{nodes}=await session.send('Accessibility.getPartialAXTree',{backendNodeId:node.backendNodeId,fetchRelatives:false});return {exists:true,nodes:nodes.map(row=>({ignored:row.ignored,ignoredReasons:row.ignoredReasons,role:row.role?.value,name:row.name?.value,properties:row.properties}))};}finally{await session.detach();}}
async function resetFocus(page){await page.evaluate(()=>{document.activeElement?.blur();document.body.tabIndex=-1;document.body.focus();document.body.removeAttribute('tabindex');});}
async function tabTrace(page,max=80){await resetFocus(page);const trace=[];let first;
 for(let i=0;i<max;i++){await page.keyboard.press('Tab');const row=(await metrics(page)).focus;const key=row.selector+'|'+row.tag;if(first===key)break;if(!first)first=key;trace.push(row);if(row.tag==='BODY')break;}
 return trace;
}
async function navigateByEnter(page,locator){const navigation=page.waitForNavigation({waitUntil:'load',timeout:15000});await locator.focus();await page.keyboard.press('Enter');const response=await navigation;check(response?.status()===200,'Native GET did not resolve to admitted pre-rendered fixture');await ready(page);return {url:page.url(),status:response.status(),query:StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(new URL(page.url()).searchParams))};}
async function hrefLocator(page,href){const all=page.locator('a[href]');const index=await all.evaluateAll((els,wanted)=>els.findIndex(el=>el.getAttribute('href')===wanted),href);check(index>=0,'Missing clear link '+href);return all.nth(index);}
async function r01(page,scene,width){
 if(!(scene.owner==='circuit'||scene.name==='habitat-search'||scene.name==='habitat-search-physical'||scene.name==='madeyours-search'||scene.name==='playfield-search'))return {status:'NOT_APPLICABLE'};
 const selector=scene.owner==='circuit'?'form.ct-search input[name="search"]':'form[data-lb-search-form] input[name="search"]';
 const field=page.locator(selector);check(await field.count()===1,'R01 target not unique');const before=await field.inputValue();if(!before)await field.fill('Model guide');
 const observation=await field.evaluate(input=>{
  const form=input.form,labels=[...input.labels];const visible=el=>{const b=el.getBoundingClientRect(),s=getComputedStyle(el);return b.width>2&&b.height>2&&s.display!=='none'&&s.visibility!=='hidden'&&!/rect\(0(px)?,? ?0/.test(s.clip);};
  const button=form.querySelector('button'),svg=button?.querySelector('svg'),span=button?.querySelector('.lb-sr-only');
  return {value:input.value,placeholder:input.placeholder,rect:input.getBoundingClientRect().toJSON(),labelObservations:labels.map(label=>({text:label.textContent.trim(),rect:label.getBoundingClientRect().toJSON(),visible:visible(label),style:{position:getComputedStyle(label).position,clip:getComputedStyle(label).clip,width:getComputedStyle(label).width}})),button:{text:button?.textContent.trim(),rect:button?.getBoundingClientRect().toJSON(),visible:button?visible(button):false,iconVisible:svg?visible(svg):false,hiddenTextClipped:span?getComputedStyle(span).clip:null},formBounds:form.getBoundingClientRect().toJSON(),font:getComputedStyle(input).fontFamily};
 });
 const ax=await axFor(page,selector);check(ax.nodes?.some(node=>!node.ignored&&node.name?.startsWith('Search')),'Search has no exposed browser AX name');
 const file=await snapshot(page,`${scene.name}-${width}-r01-filled.png`);if(!before)await field.fill(before);
 return {status:'NOT_RUN_VISUAL_ADJUDICATION',selector,observation,ax,screenshot:file,reason:'Exact CSS/geometry/AX observed; visible purpose is adjudicated from screenshot and visible Search word/icon, not from sr-only class alone.'};
}
async function circuitReview(page,scene,width){
 const desktop=page.locator('aside.ct-desktop-facets'),mobile=page.locator('details.ct-mobile-facets');const dVisible=await desktop.isVisible(),mVisible=await mobile.isVisible();
 check(dVisible===(width>900)&&mVisible===(width<=900),'Responsive facet exposure unexpected');
 const desktopSelector='aside.ct-desktop-facets input[name="power_input_w"][value="100"]',mobileSelector='details.ct-mobile-facets input[name="power_input_w"][value="100"]';
 const initialAX={desktop:await axFor(page,desktopSelector),mobile:await axFor(page,mobileSelector)};
 check(initialAX.mobile.nodes?.every(node=>node.ignored),'Initially hidden/collapsed mobile copy exposed to AX');
 if(!dVisible)check(initialAX.desktop.nodes?.every(node=>node.ignored),'Hidden desktop copy exposed to AX');
 const initialTrace=await tabTrace(page);check(!initialTrace.some(row=>row.selector.startsWith('form.ct-facets')&&width<=900),'Collapsed/mobile or hidden form entered initial Tab order');
 let openedScreenshot=null;
 if(mVisible){const summary=mobile.locator('summary');await summary.focus();await page.keyboard.press('Enter');check(await mobile.getAttribute('open')!==null,'Native details did not open');openedScreenshot=await snapshot(page,`${scene.name}-${width}-drawer-open.png`);}
 const panel=dVisible?'aside.ct-desktop-facets':'details.ct-mobile-facets';const trace=await tabTrace(page);
 const hiddenPrefix=dVisible?'details.ct-mobile-facets':'aside.ct-desktop-facets';
 // Actual selectors additionally include the ancestor panel to distinguish duplicated native forms.
 const inactivePanel=dVisible?'mobile':'desktop';const hiddenVisits=trace.filter(row=>row.panel===inactivePanel);check(hiddenVisits.length===0,'Tab focused inactive panel');
 const clippedHelper=await page.locator(`${panel} .lb-sr-only`).first().evaluate(el=>({position:getComputedStyle(el).position,clip:getComputedStyle(el).clip,width:getComputedStyle(el).width,height:getComputedStyle(el).height}));check(clippedHelper.position==='absolute'&&clippedHelper.width==='1px','Count helper CSS clipping not applied');
 const names=[];
 for(const key of ['electronics_kind','connector','power_input_w','pass_through_output_w','data_rate_mbps','length_mm']){
  const values=scene.metadata.electronics_facets.filter(row=>row.key===key);
  for(const facet of values){const selector=`${panel} input[name="${key}"][value="${facet.value}"]`;const ax=await axFor(page,selector);const exposed=ax.nodes?.find(node=>!node.ignored);check(exposed?.name===`${facet.label} (${facet.count} matching product${facet.count===1?'':'s'})`,'Browser AX name incorrect '+selector);names.push({selector,name:exposed.name,role:exposed.role});}
 }
 const box=page.locator(`${panel} input[name="connector"][value="usb-c"]`);const checked=await box.isChecked();await box.focus();await page.keyboard.press('Space');check(await box.isChecked()!==checked,'Native checkbox Space failed');await page.keyboard.press('Space');check(await box.isChecked()===checked,'Checkbox restore failed');
 const hub=page.locator(`${panel} input[name="electronics_kind"][value="hub"]`),charger=page.locator(`${panel} input[name="electronics_kind"][value="charger"]`);await hub.focus();await page.keyboard.press('ArrowDown');check(await charger.isChecked(),'Native radio ArrowDown failed');await page.keyboard.press('ArrowUp');check(await hub.isChecked(),'Native radio restore failed');
 const apply=await navigateByEnter(page,page.locator(`${panel} form.ct-facets button[type="submit"]`));check(apply.query.page===1,'Apply did not reset page');
 const current=manifest.rendered.find(row=>row.url===storefrontDiscoveryUrl(new URL(page.url()).pathname,apply.query));
 const clear=current.metadata.active_filters.find(filter=>filter.key==='power_input_w');const cleared=await navigateByEnter(page,await hrefLocator(page,clear.clear_url));check(cleared.query.power_input_w===undefined&&cleared.query.connector?.length===2,'Independent clear dropped unrelated connector values');
 let close={status:'NOT_APPLICABLE'};
 if(mVisible){await page.goto('http://127.0.0.1:43271'+scene.url);await ready(page);const sum=page.locator('details.ct-mobile-facets > summary');await sum.focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');close={status:'PASS',closed:await page.locator('details.ct-mobile-facets').getAttribute('open')===null,focusOnSummary:await sum.evaluate(el=>el===document.activeElement)};check(close.closed&&close.focusOnSummary,'Disclosure close/focus recovery failed');}
 return {status:'PASS',desktopVisible:dVisible,mobileVisible:mVisible,initialAX,initialTrace,openTrace:trace,inactivePanelTabVisits:hiddenVisits,clippedHelper,browserAccessibleNames:names,checkboxSpace:'PASS',radioArrows:'PASS',apply,independentClear:cleared,close,openedScreenshot};
}
async function playfieldReview(page,scene){
 const empty=scene.name.endsWith('-empty'),start='http://127.0.0.1:43271'+scene.url;
 if(!empty){for(const name of ['age_band','interest']){const select=page.locator(`form.pf-filters select[name="${name}"]`);const before=await select.inputValue();await select.focus();await page.keyboard.press('ArrowUp');check(await select.inputValue()==='','Native select clear via ArrowUp failed');await page.keyboard.press('ArrowDown');check(await select.inputValue()===before,'Native select restore failed');}}
 else check(await page.locator('form.pf-filters select[name="age_band"],form.pf-filters select[name="interest"]').count()===0,'Empty fixture invented chooser');
 const trace=await tabTrace(page);const apply=await navigateByEnter(page,page.locator('form.pf-filters button[type="submit"]'));check(apply.query.page===1,'Playfield Apply page reset failed');check(apply.query.age_band===scene.query.age_band&&apply.query.interest===scene.query.interest,'Apply lost adult choices');
 const clears=[];
 for(const key of ['age_band','interest']){await page.goto(start);await ready(page);const filter=scene.metadata.active_filters.find(row=>row.key===key);const navigation=await navigateByEnter(page,await hrefLocator(page,filter.clear_url));check(navigation.query[key]===undefined,'Independent clear did not remove '+key);const other=key==='age_band'?'interest':'age_band';check(navigation.query[other]===scene.query[other]&&navigation.query.limit===scene.query.limit&&navigation.query.country_of_origin===scene.query.country_of_origin,'Independent clear lost another value');clears.push({key,...navigation});}
 let recovery=null;if(empty){await page.goto(start);await ready(page);recovery=await navigateByEnter(page,await hrefLocator(page,scene.metadata.clear_filters_url));check(await page.locator('.pf-card').count()>0,'Clear-all empty recovery did not reach rendered products');}
 return {status:'PASS',nativeSelect:empty?'NOT_APPLICABLE':'PASS',emptyResult:empty,trace,apply,independentClears:clears,recovery};
}
async function main(){
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(43271,'127.0.0.1',resolve);});ledger.serverCreated=true;
  browser=await chromium.launch({headless:true,chromiumSandbox:true});ledger.browserCreated=true;ledger.browserVersion=browser.version();
  console.log('Owned slot1 browser '+browser.version()+' /127.0.0.1:43271');
  for(const width of [320,768,1440]){
   const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
   await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin==='http://127.0.0.1:43271')return route.continue();blockedRequests.push({host:url.hostname,path:url.pathname});return route.abort();});
   const page=await context.newPage();page.on('pageerror',error=>errors.push({width,message:String(error)}));
   for(const scene of manifest.rendered.filter(row=>row.primary)){
    const record={scene:scene.name,owner:scene.owner,width,status:'PASS'};
    try{
     const response=await page.goto('http://127.0.0.1:43271'+scene.url);check(response?.status()===200,'Initial fixture not served');await ready(page);
     record.initial=await metrics(page);record.screenshot=await snapshot(page,`${scene.name}-${width}-initial.png`);record.r01=await r01(page,scene,width);
     if(scene.owner==='circuit')record.r02=await circuitReview(page,scene,width);
     if(scene.owner==='playfield')record.playfield=await playfieldReview(page,scene);
    }catch(error){record.status='FAIL';record.error=String(error);}
    records.push(record);console.log(`${scene.name}/${width}: ${record.status}${record.error?' '+record.error:''}`);
   }
   await context.close();
  }
 }finally{
  if(browser){await browser.close();ledger.browserClosed=true;}
  if(server.listening){await new Promise(resolve=>server.close(resolve));ledger.serverClosed=true;}else ledger.serverClosed=true;
  ledger.endedAt=new Date().toISOString();
  for(const source of manifest.sources){const actual=sha(fs.readFileSync(path.join(repo,source.path)));if(actual!==source.sha256){ledger.sourceFrozen=false;errors.push({source:source.path,message:'Source drift during capture'});}}
  fs.writeFileSync(path.join(__dirname,'resource-ledger.json'),JSON.stringify(ledger,null,2)+'\n');
  fs.writeFileSync(path.join(__dirname,'browser-report.json'),JSON.stringify({scope:'Isolated current Liquid/CSS browser observations with finite admitted static responses. No hydration/live SQL/commerce or screen-reader speech.',slot:1,browser:ledger.browserVersion,records,screenshots,requests,blockedRequests,errors,resources:ledger},null,2)+'\n');
  console.log('Owned browser/server closed; source frozen='+ledger.sourceFrozen);
 }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
