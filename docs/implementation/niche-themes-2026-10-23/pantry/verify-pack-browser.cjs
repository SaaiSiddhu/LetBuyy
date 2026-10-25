const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');const server=require('./static-server.cjs');
(async()=>{let browser,port;const results=[];try{
 if(!server.listening)await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});port=server.address().port;const origin='http://127.0.0.1:'+port;
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,chromiumSandbox:true});const context=await browser.newContext({reducedMotion:'reduce'});await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());const page=await context.newPage();
 for(const width of [1440,834,390,320]){await page.setViewportSize({width,height:1000});
  for(const scene of ['product','missing-variant','sold-out']){await page.goto(origin+'/'+scene+'.html');await page.evaluate(()=>document.fonts.ready);const summary=page.locator('.pn-pack-options > summary');await summary.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.pn-pack-options').evaluate(e=>e.open),true);const rows=await page.locator('.pn-pack-options li').allTextContents();assert.equal(rows.length,2);assert.match(rows[0],/250 g net per pack/);
   if(scene==='missing-variant'){assert.match(rows[1],/net quantity not supplied/);assert.doesNotMatch(rows[1],/500 g net per pack|999|ml/);assert.equal(await page.locator('[data-lb-food-net-quantity]').count(),0);}
   else assert.match(rows[1],/500 g net per pack.*unavailable/);
   const disabled=await page.locator('[data-lb-add-to-cart]').isDisabled();if(scene==='sold-out'){assert.equal(disabled,true);assert.ok(rows.every(row=>row.includes('unavailable')));}
   const focus=await summary.evaluate(e=>({outline:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth}));assert.equal(focus.outline,'solid');assert.notEqual(focus.width,'0px');results.push({width,scene,rows,addButtonDisabled:disabled,focus});
   if(width===390&&scene==='missing-variant')await page.screenshot({path:path.join(__dirname,'browser-screenshots/missing-variant-mobile-disclosure-open.png'),fullPage:true});
  }
  await page.goto(origin+'/unknown-food.html');const facts=await page.locator('.pn-food-facts').textContent();assert.match(facts,/Not supplied by the merchant/);assert.match(facts,/Unknown is not allergen-free/);results.push({width,scene:'unknown-food',ingredientsUnknown:true,allergensUnknown:true});
  for(const[scene,title]of [['pulses','Split red lentils'],['rice-shelf','Basmati rice']]){await page.goto(origin+'/'+scene+'.html');assert.deepEqual(await page.locator('.pn-card h3').allTextContents(),[title]);results.push({width,scene,cardTitles:[title]});}
 }
 fs.writeFileSync(path.join(__dirname,'pack-browser-verification.json'),JSON.stringify({scope:'Actual bound static Liquid browser facts and SSR sold-out eligibility only; no variant/cart/purchase hydration or persisted order claim.',browser:browser.version(),port,passed:true,checks:results.length,results},null,2)+'\n');console.log(JSON.stringify({passed:true,checks:results.length}));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(__dirname,'pack-browser-resource-endstate.json'),JSON.stringify({owner:'Pantry',port,browserClosed:true,serverListening:server.listening},null,2)+'\n');console.log('Pantry pack verification browser/server closed.');}
})().catch(error=>{console.error(error);process.exitCode=1;});
