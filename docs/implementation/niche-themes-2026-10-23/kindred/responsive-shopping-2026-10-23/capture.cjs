const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const {measure,settle}=require('../capture-rendered.cjs');
const {StorefrontDiscoveryQuerySchema,storefrontDiscoveryQueryFromEntries,storefrontDiscoveryUrl}=require('../../../../../packages/commerce-core/src/index.ts');
const root='docs/implementation/niche-themes-2026-10-23/kindred/responsive-shopping-2026-10-23';
const port=Number(process.argv[2]);assert.equal(port,43275);const origin='http://127.0.0.1:'+port;
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'fixture-manifest.json'),'utf8'));
fs.mkdirSync(path.join(root,'screenshots'),{recursive:true});
const normalize=q=>JSON.parse(JSON.stringify({...q,...(Array.isArray(q.connector)?{connector:[...q.connector].sort()}: {})}));
function parsed(url){const result=StorefrontDiscoveryQuerySchema.safeParse(storefrontDiscoveryQueryFromEntries(new URL(url).searchParams));assert.ok(result.success,JSON.stringify(result.error?.issues));return result.data;}
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,chromiumSandbox:true});
 const rows=[],errors=[],blocked=[];let report;
 try{
  const context=await browser.newContext({deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();blocked.push(route.request().url());return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  const sourceRequests=[];page.on('response',res=>{if(res.status()>=400)sourceRequests.push({url:res.url(),status:res.status()});});
  async function nativeQuery(form){return page.locator(form).evaluate(e=>[...new FormData(e)].map(([k,v])=>[k,String(v)]));}
  async function navigateClick(selector){await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}),page.locator(selector).first().click()]);await settle(page);return page.url();}
  for(const width of[320,768,1440])for(const state of['filters','cross-query','empty','long-labels'])for(const route of['collection','search']){
   const row={width,state,route,status:'PASS',checks:[],defects:[],notRun:[{check:'installed API/SQL result correctness',reason:'Admitted synthetic static-response exporter; no DB or installed runtime'},{check:'header custom-element hydration/menu activation',reason:'Static export does not load application hydration'}]};
   const pathname=`/store/kindred-qa-${state}/${route==='search'?'search':'products'}`;
   const url=origin+storefrontDiscoveryUrl(pathname,fixtures.initial[state]);
   try{
    await page.setViewportSize({width,height:width===320?844:width===768?1024:1000});await page.goto(url,{waitUntil:'networkidle'});await settle(page);
    row.metrics=await page.evaluate(measure);
    row.formState=await page.locator('form').evaluateAll(forms=>forms.map(form=>({class:form.className,action:form.action,entries:[...new FormData(form)].map(([key,value])=>[key,String(value)])})));
    row.visibleGiftChoices=await page.locator('select[name="occasion"],select[name="recipient"]').evaluateAll(nodes=>nodes.map(node=>({name:node.name,choices:[...node.options].map(o=>({value:o.value,label:o.textContent,selected:o.selected}))})));
    row.chipBounds=await page.locator('a.kr-chip').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return{selector:`a[data-kindred-clear="${e.dataset.kindredClear}"][data-kindred-value="${e.dataset.kindredValue}"]`,label:e.textContent,width:r.width,height:r.height,left:r.left,right:r.right};}));
    const screenshot=`screenshots/${route}-${state}-${width}.png`;await page.screenshot({path:path.join(root,screenshot),fullPage:true,animations:'disabled'});row.screenshot=screenshot;
    const m=row.metrics;
    if(m.width!==width||m.documentWidth>width||m.bodyWidth>width||m.overflow.length||m.textOverflow.length)row.defects.push({check:'viewport/layout',selector:m.overflow[0]?.class||m.textOverflow[0]?.parent||'html',observed:{documentWidth:m.documentWidth,overflow:m.overflow,textOverflow:m.textOverflow},reproduction:url});
    for(const control of[...m.smallControls,...row.chipBounds.filter(c=>c.width<43.5||c.height<43.5)])row.defects.push({check:'44px target',selector:control.selector||control.class,observed:control,reproduction:url});
    if(m.brokenImages.length||m.hiddenPainted.length)row.defects.push({check:'media/hidden state',selector:'img,[hidden]',observed:{broken:m.brokenImages,painted:m.hiddenPainted},reproduction:url});
    if(m.contrast.some(c=>c.ratio<c.minimum))row.defects.push({check:'contrast',observed:m.contrast.filter(c=>c.ratio<c.minimum),reproduction:url});
    const tabs=[];for(let i=0;i<18;i++){await page.keyboard.press('Tab');tabs.push(await page.evaluate(()=>{const e=document.activeElement,p=e?.closest('[data-lb-nav-panel]'),s=e?getComputedStyle(e):null;return{tag:e?.tagName,name:e?.getAttribute('name'),label:e?.getAttribute('aria-label')||e?.textContent?.trim().slice(0,100),hiddenPanel:p?getComputedStyle(p).visibility==='hidden':false,outline:s?.outlineStyle,width:s?.outlineWidth};}));}
    row.keyboard=tabs;if(tabs.some(t=>t.hiddenPanel))row.defects.push({check:'keyboard',selector:'[data-lb-nav-panel]',reproduction:url});
    const expectedBefore=fixtures.initial[state];for(const f of row.formState.filter(form=>/kr-filter-form|kr-search-form/.test(form.class))){const params=new URLSearchParams(f.entries);const result=StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(params));const normalizedExpected=StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(new URLSearchParams(Object.entries({...expectedBefore,page:1}).flatMap(([k,v])=>(Array.isArray(v)?v:[v]).map(item=>[k,String(item)])))));assert.deepEqual(normalize(result),normalize(normalizedExpected));for(const key of new Set(params.keys()))if(key!=='connector')assert.equal(params.getAll(key).length,1);}
    const sort=page.locator('.kr-filter-form select[name="sort"]');await sort.selectOption('name');
    const occasion=page.locator('.kr-filter-form select[name="occasion"]');if(await occasion.count())await occasion.selectOption('thank-you');
    await page.locator('.kr-filter-form input[name="min_price"]').fill('1100');
    await page.locator('.kr-filter-form button').focus();row.applyFocus=await page.locator('.kr-filter-form button').evaluate(e=>({active:document.activeElement===e,outline:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth}));
    assert.ok(row.applyFocus.active&&row.applyFocus.outline!=='none'&&row.applyFocus.width!=='0px');
    const submitted=await nativeQuery('.kr-filter-form');const expected=StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(submitted));
    const appliedUrl=await navigateClick('.kr-filter-form button');assert.deepEqual(normalize(parsed(appliedUrl)),normalize(expected));row.checks.push({check:'native Apply/sort',status:'PASS',entries:submitted,actualUrl:appliedUrl,parsed:parsed(appliedUrl)});
    const clear=page.locator('a[data-kindred-clear="occasion"]').first();const target=await clear.getAttribute('href');assert.ok(target);const clearedUrl=await navigateClick('a[data-kindred-clear="occasion"]');assert.deepEqual(normalize(parsed(clearedUrl)),normalize(parsed(new URL(target,origin))));row.checks.push({check:'independent clear URL',status:'PASS',actualUrl:clearedUrl,parsed:parsed(clearedUrl)});
    const allTarget=await page.locator('[data-kindred-clear-all]').getAttribute('href');assert.ok(allTarget);const allUrl=await navigateClick('[data-kindred-clear-all]');assert.deepEqual(normalize(parsed(allUrl)),normalize(parsed(new URL(allTarget,origin))));row.checks.push({check:'clear-all/recovery',status:'PASS',actualUrl:allUrl,parsed:parsed(allUrl),productCards:await page.locator('.kr-product-card,.kr-card').count()});
    const next=page.locator('.kr-pagination a').filter({hasText:'Next'});assert.equal(await next.count(),1);const nextUrl=await navigateClick('.kr-pagination a:last-of-type');assert.equal(parsed(nextUrl).page,2);const previousUrl=await navigateClick('.kr-pagination a:first-of-type');assert.equal(parsed(previousUrl).page,1);row.checks.push({check:'native pagination',status:'PASS',nextUrl,previousUrl});
    if(state==='empty'||state==='cross-query')row.checks.push({check:'admitted initial empty response',status:'PASS',observedInitialHeading:row.metrics.h1,initialVisibleChoices:row.visibleGiftChoices.length});
    if(state==='long-labels'){assert.equal(await page.locator('script,[onerror]').count(),0);row.checks.push({check:'hostile labels inert',status:'PASS'});}
   }catch(error){row.defects.push({check:'interaction/render assertion',selector:'.kr-filter-form / native links',observed:String(error),reproduction:url});}
   if(row.defects.length)row.status='FAIL';rows.push(row);console.info(JSON.stringify({width,state,route,status:row.status,defects:row.defects.length,actions:row.checks.length}));
  }
  report={generatedAt:new Date().toISOString(),scope:fixtures.scope,sourceHashes:fixtures.sourceHashes,rows,status:rows.some(r=>r.status==='FAIL')||errors.length?'FAIL':'PASS',pageErrors:errors,httpErrors:sourceRequests,blockedExternalRequests:blocked,resources:'browser_closed_in_finally',notRun:'Installed lifecycle is prepared separately; no tokens/UUIDs/orders were minted.'};
 }finally{await browser.close();if(report){report.browserClosed=true;fs.writeFileSync(path.join(root,'browser-report.json'),JSON.stringify(report,null,2)+'\n');}}
})().catch(error=>{console.error(error);process.exitCode=1;});
