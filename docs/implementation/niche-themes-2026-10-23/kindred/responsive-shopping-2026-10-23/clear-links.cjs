const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const {StorefrontDiscoveryQuerySchema,storefrontDiscoveryQueryFromEntries,storefrontDiscoveryUrl}=require('../../../../../packages/commerce-core/src/index.ts');
const root='docs/implementation/niche-themes-2026-10-23/kindred/responsive-shopping-2026-10-23';
const port=Number(process.argv[2]);assert.equal(port,43275);const origin=`http://127.0.0.1:${port}`;
const fixture=JSON.parse(fs.readFileSync(`${root}/fixture-manifest.json`,'utf8'));
const normalized=q=>JSON.parse(JSON.stringify({...q,...(q.connector?{connector:(Array.isArray(q.connector)?[...q.connector]:[q.connector]).sort()}: {})}));
const parse=url=>StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(new URL(url,origin).searchParams));
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,chromiumSandbox:true});
 const rows=[],blocked=[],errors=[];let report;
 try{
  const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():(blocked.push(route.request().url()),route.abort()));
  const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(String(error)));
  for(const width of [320,768,1440])for(const state of ['filters','cross-query','empty','long-labels'])for(const route of ['collection','search']){
   const pathname=`/store/kindred-qa-${state}/${route==='collection'?'products':'search'}`,initial=fixture.initial[state],url=origin+storefrontDiscoveryUrl(pathname,initial);
   const row={width,state,route,status:'PASS',initialUrl:url,clearLinks:[]};
   try{
    await page.setViewportSize({width,height:900});await page.goto(url,{waitUntil:'domcontentloaded'});
    row.initialDom=await page.locator('body').evaluate(body=>({text:body.textContent,productCards:body.querySelectorAll('.kr-card').length,executableNodes:body.querySelectorAll('script,[onerror],[onclick]').length}));
    row.initialDom.emptyHeading=await page.locator('.kr-empty h2').allTextContents();row.initialDom.noMatchingProducts=row.initialDom.emptyHeading.includes('No matching products.');delete row.initialDom.text;
    assert.equal(row.initialDom.executableNodes,0);
    if(state==='empty'||state==='cross-query'){assert.equal(row.initialDom.productCards,0);assert.equal(row.initialDom.noMatchingProducts,true);}
    else assert.equal(row.initialDom.productCards,1);
    const links=await page.locator('[data-kindred-clear]').evaluateAll(nodes=>nodes.map(node=>({key:node.dataset.kindredClear,value:node.dataset.kindredValue,href:node.getAttribute('href'),text:node.textContent})));
    for(let index=0;index<links.length;index++){
     const link=links[index],expected={...initial,page:1};
     if(link.key==='connector'){expected.connector=initial.connector.filter(value=>value!==link.value);if(!expected.connector.length)delete expected.connector;}
     else delete expected[link.key];
     const canonical=StorefrontDiscoveryQuerySchema.parse(expected);
     assert.deepEqual(normalized(parse(link.href)),normalized(canonical));
     await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('[data-kindred-clear]').nth(index).click()]);
     assert.equal(new URL(page.url()).pathname,pathname);assert.deepEqual(normalized(parse(page.url())),normalized(canonical));
     row.clearLinks.push({...link,status:'PASS',actualUrl:page.url(),parsed:parse(page.url())});
     await page.goto(url,{waitUntil:'domcontentloaded'});
    }
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('[data-kindred-clear-all]').click()]);
    row.recovery={url:page.url(),productCards:await page.locator('.kr-card').count(),parsed:parse(page.url())};assert.equal(row.recovery.productCards,1);
   }catch(error){row.status='FAIL';row.error=String(error);}
   rows.push(row);console.info(JSON.stringify({width,state,route,status:row.status,independentClears:row.clearLinks.length,error:row.error}));
  }
  report={generatedAt:new Date().toISOString(),status:rows.some(row=>row.status!=='PASS')||errors.length?'FAIL':'PASS',sourceHashes:fixture.sourceHashes,rows,pageErrors:errors,blockedExternalRequests:blocked,scope:'Native independent clear clicks and actual admitted empty DOM/recovery; static fixture only, not live SQL/installed correctness.'};
 }finally{await browser.close();if(report){report.browserClosed=true;fs.writeFileSync(`${root}/native-clear-links-report.json`,JSON.stringify(report,null,2)+'\n');}}
})().catch(error=>{console.error(error);process.exitCode=1;});
