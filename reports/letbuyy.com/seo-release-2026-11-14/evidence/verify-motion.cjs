const assert = require('node:assert/strict')
const { chromium } = require(process.cwd() + '/node_modules/@playwright/test')
;(async()=>{
const browser=await chromium.launch()
const evidence=[]
try {
for(const width of [320,375,1366]) for(const colorScheme of ['light','dark']) {
 const context=await browser.newContext({viewport:{width,height:900},colorScheme,hasTouch:width<768,isMobile:width<768})
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'&&['GET','HEAD'].includes(r.request().method())?r.continue():r.abort())
 const p=await context.newPage()
 await p.goto('http://127.0.0.1:9021/in')
 const b=p.locator('.cmap-motion-control')
 await b.scrollIntoViewIfNeeded()
 await b.waitFor()
 const check=async(active)=>{
  await p.waitForFunction(playing=>Boolean(document.querySelector('#capabilities animateMotion'))===playing,active,{timeout:8000}).catch(async e=>{throw Error('Expected graph '+active+' at '+width+' '+colorScheme+', count '+await p.locator('#capabilities animateMotion').count()+', button '+await b.innerText(),{cause:e})})
 }
 console.error('initial',width,colorScheme,await b.innerText(),await p.locator('#capabilities animateMotion').count())
 await check(true)
 if(width<768) await b.tap(); else await b.click()
 console.error('after touch or click',width,colorScheme,await b.innerText()); await check(false)
 assert.match(await b.innerText(),/Continue/)
 await b.focus()
 await b.press('Enter')
 await check(true)
 assert.match(await b.innerText(),/Pause/)
 await p.emulateMedia({reducedMotion:'reduce'})
 await b.waitFor({state:'hidden'})
 await check(false)
 evidence.push({width,colorScheme,input:width<768?'touch':'pointer',keyboard:true,pauseStopsGraph:true,reducedMotion:true})
 await context.close()
}
} finally {await browser.close();console.log(JSON.stringify(evidence,null,2))}
})().catch(error=>{console.error(error.message);process.exitCode=1})
