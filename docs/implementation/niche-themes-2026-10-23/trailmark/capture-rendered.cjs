const {chromium}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const port=Number(process.argv[2]);
const supplemental=process.argv[3]==='supplemental';
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Provide the coordinator-allocated localhost port.');
const root='docs/implementation/niche-themes-2026-10-23/trailmark';
const fixture=JSON.parse(fs.readFileSync(path.join(root,'render-fixtures.json'),'utf8'));
const origin='http://127.0.0.1:'+port;
const screenshotDirectory=supplemental?'screenshots-supplemental':'screenshots';
const output=path.join(root,screenshotDirectory);fs.mkdirSync(output,{recursive:true});
function measure(){
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height||s.display==='none'||s.visibility==='hidden')return false;if(e.closest('[aria-hidden="true"]'))return false;if(e.classList.contains('lb-skip-link')&&document.activeElement!==e&&r.right<0)return false;const nav=e.closest('.lb-header__nav');return !(nav&&nav.closest('lb-mobile-nav')?.dataset.open!=='true'&&nav.getBoundingClientRect().left>=innerWidth-1);};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
  const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
  const luminance=color=>rgba(color).slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const contrast=[['.tm-hero h1',3],['.tm-hero .tm-button',4.5],['.tm-card-facts',4.5],['.lb-header__nav-links>a',4.5],['.lb-predictive-search input',4.5]].flatMap(([selector,minimum])=>{const element=document.querySelector(selector);if(!element||!visible(element))return[];let parent=element,bg='white';while(parent){const candidate=getComputedStyle(parent).backgroundColor;if(rgba(candidate)[3]===255){bg=candidate;break;}parent=parent.parentElement;}const fg=getComputedStyle(element).color;const a=luminance(fg),b=luminance(bg);return[{selector,foreground:fg,background:bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),minimum}];});
  if(document.activeElement instanceof HTMLElement&&document.activeElement.matches(':focus-visible')){let parent=document.activeElement.parentElement,bg='white';while(parent){const candidate=getComputedStyle(parent).backgroundColor;if(rgba(candidate)[3]===255){bg=candidate;break;}parent=parent.parentElement;}const fg=getComputedStyle(document.activeElement).outlineColor,a=luminance(fg),b=luminance(bg);contrast.push({selector:'Focused control outline',foreground:fg,background:bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),minimum:3});}
  const textBounds=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){const node=walker.currentNode,parent=node.parentElement;if(!node.textContent.trim()||!parent||!visible(parent)||parent.closest('.lb-sr-only,.sr-only,script,style'))continue;const range=document.createRange();range.selectNodeContents(node);for(const rect of range.getClientRects()){if(rect.width>0&&(rect.left< -1||rect.right>innerWidth+1))textBounds.push({text:node.textContent.trim().slice(0,100),tag:parent.tagName,left:rect.left,right:rect.right});}range.detach();}
  const glyphProbes=[...document.querySelectorAll('h1,.tm-fact-tiles strong')].map(element=>{const style=getComputedStyle(element);const range=document.createRange();range.selectNodeContents(element);const bounds=[...range.getClientRects()].map(rect=>({left:rect.left,right:rect.right,width:rect.width,height:rect.height}));ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;const actualFont=ctx.font,actualProbeWidth=ctx.measureText('Hamburgefontsiv0123456789').width;ctx.font=`${style.fontWeight} ${style.fontSize} Arial`;return{text:element.textContent,fontFamily:style.fontFamily,fontWeight:style.fontWeight,fontSize:style.fontSize,actualFont,actualProbeWidth,fallbackProbeWidth:ctx.measureText('Hamburgefontsiv0123456789').width,bounds};});
  return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,fonts:{status:document.fonts.status,regular:document.fonts.check('400 16px Inter'),bold:document.fonts.check('700 32px Inter'),heading:getComputedStyle(document.querySelector('h1')).fontFamily,faces:[...document.fonts].map(face=>({family:face.family,weight:face.weight,status:face.status})),glyphProbes},textBounds,contrast,smallControls:[...document.querySelectorAll('button,input,select,summary')].filter(e=>{const r=e.getBoundingClientRect();return visible(e)&&(r.width<43.5||r.height<43.5);}).map(e=>({tag:e.tagName,label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,60),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return visible(e)&&(r.left< -1||r.right>innerWidth+1);}).slice(0,35).map(e=>({tag:e.tagName,class:e.className.baseVal??e.className,text:e.textContent.trim().slice(0,100),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})),h1:document.querySelector('h1')?.textContent,grid:[...document.querySelectorAll('.tm-grid,.tm-discovery,.lb-product-detail__layout')].map(e=>({class:e.className,display:getComputedStyle(e).display,columns:getComputedStyle(e).gridTemplateColumns}))};
}
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;for(let y=0;y<document.documentElement.scrollHeight;y+=innerHeight){scrollTo(0,y);await new Promise(r=>requestAnimationFrame(r));}await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));scrollTo(0,0);});}
(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,chromiumSandbox:true});
  const results=[],stress=[],errors=[];
  try{
    const context=await browser.newContext({deviceScaleFactor:1,reducedMotion:'reduce'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    const devices=supplemental?[['mobile',390,844],['narrow',320,844]]:[['desktop',1440,1000],['tablet',834,1112],['mobile',390,844],['narrow',320,844]];
    const scenes=supplemental?fixture.files.filter(row=>['product','product-sleeve','product-clothing'].includes(row.scene)):fixture.files;
    for(const [device,width,height] of devices){
      await page.setViewportSize({width,height});
      for(const row of scenes){const url=origin+'/'+path.basename(row.file);await page.goto(url,{waitUntil:'networkidle'});await settle(page);const metrics=await page.evaluate(measure);const screenshot=screenshotDirectory+'/'+row.scene+'-'+device+'.png';await page.screenshot({path:path.join(root,screenshot),fullPage:true,animations:'disabled'});let measurementDetail;if(supplemental&&row.scene==='product'){measurementDetail=screenshotDirectory+'/measurement-tiles-'+device+'.png';await page.locator('.tm-fact-tiles').screenshot({path:path.join(root,measurementDetail)});}results.push({scene:row.scene,device,...metrics,screenshot,measurementDetail});console.log(row.scene+' '+device+' '+metrics.documentWidth+'/'+width);}
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto(origin+'/home.html');await settle(page);
    await page.locator('[data-lb-nav-toggle]').focus();
    const headerFocus=(await page.evaluate(measure)).contrast.find(pair=>pair.selector==='Focused control outline');
    const headerFocusScreenshot=screenshotDirectory+'/header-focus-mobile.png';
    await page.screenshot({path:path.join(root,headerFocusScreenshot),animations:'disabled'});
    const closedNavTabs=[];
    for(let step=0;step<18;step++){await page.keyboard.press('Tab');closedNavTabs.push(await page.evaluate(()=>({label:document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent?.trim().slice(0,80),inClosedPanel:Boolean(document.activeElement?.closest('[data-lb-nav-panel]'))})));}
    await page.goto(origin+'/product.html');await settle(page);
    const variants=page.locator('button[data-lb-variant-option]');await variants.last().focus();
    const keyboard={headerFocus,headerFocusScreenshot,closedNavTabs,closedNavSkipped:closedNavTabs.every(row=>!row.inClosedPanel),variantFocus:await variants.last().evaluate(e=>({active:document.activeElement===e,outline:getComputedStyle(e).outlineStyle,outlineWidth:getComputedStyle(e).outlineWidth})),nativeDisclosure:false,scope:'Native browser controls and current island markup. No hydration/purchase claim.'};
    const detail=page.locator('.tm-facts details').first();const before=await detail.evaluate(e=>e.open);await detail.locator('summary').focus();await page.keyboard.press('Enter');keyboard.nativeDisclosure=(await detail.evaluate(e=>e.open))!==before;
    const stressCases=supplemental?[['product','text200']]:[['product','text200'],['collection','text200'],['product','hindi-long-title'],['home','long-store-name'],['home','mobile-menu-state'],['home','search-state']];
    for(const [scene,kind] of stressCases){
      await page.goto(origin+'/'+scene+'.html');await settle(page);
      if(kind==='text200')await page.evaluate(()=>{for(const e of [...document.querySelectorAll('body *')].reverse()){const size=parseFloat(getComputedStyle(e).fontSize);if(!['svg','path'].includes(e.tagName.toLowerCase()))e.style.fontSize=size*2+'px';}});
      else if(kind==='hindi-long-title')await page.locator('h1').evaluate(e=>{document.documentElement.lang='hi';e.textContent='मनोरंजन के लिए बैडमिंटन उपकरण — सही माप, उपयोग की शर्तें और अपनी पसंद के विकल्प की पूरी जानकारी';});
      else if(kind==='long-store-name')await page.locator('.lb-header__brand').evaluate(e=>e.textContent='TrailmarkRecreationalEquipmentAndEverydayMovement');
      else if(kind==='mobile-menu-state')await page.locator('lb-mobile-nav').evaluate(e=>e.dataset.open='true');
      else if(kind==='search-state')await page.locator('[data-lb-search-overlay]').evaluate(e=>{e.hidden=false;e.querySelector('input').value='Rally68';});
      const metrics=await page.evaluate(measure);const screenshot=screenshotDirectory+'/'+scene+'-'+kind+'.png';await page.screenshot({path:path.join(root,screenshot),fullPage:true,animations:'disabled'});stress.push({scene,kind,...metrics,screenshot,stateOnly:kind.endsWith('-state')?'Forced presentation state; no hydration interaction claim':undefined});
      if(supplemental&&kind==='text200')await page.locator('.tm-fact-tiles').screenshot({path:path.join(output,'measurement-tiles-text200.png')});
    }
    const failures=[...results,...stress].filter(row=>row.documentWidth>row.width||row.bodyWidth>row.width||row.brokenImages.length||row.overflow.length||row.textBounds.length||row.smallControls.length||row.contrast.some(pair=>pair.ratio<pair.minimum)||!row.fonts.regular||!row.fonts.bold);
    const report={scope:fixture.scope,fixtureContext:fixture.fixtureContext,sources:fixture.sources,generatedAt:new Date().toISOString(),results,stress,keyboard,pageErrors:errors,failures:failures.map(row=>({scene:row.scene,device:row.device,kind:row.kind,documentWidth:row.documentWidth,width:row.width,overflow:row.overflow,brokenImages:row.brokenImages})),status:failures.length||errors.length||!keyboard.headerFocus||keyboard.headerFocus.ratio<3||!keyboard.nativeDisclosure||!keyboard.closedNavSkipped||!keyboard.variantFocus.active||keyboard.variantFocus.outline==='none'||keyboard.variantFocus.outlineWidth==='0px'?'needs_repair':'pass'};
    fs.writeFileSync(path.join(root,supplemental?'browser-supplemental-audit.json':'browser-audit.json'),JSON.stringify(report,null,2)+'\n');
    if(report.status!=='pass')process.exitCode=1;
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
