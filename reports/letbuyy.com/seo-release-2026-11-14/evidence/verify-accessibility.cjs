const { chromium } = require(process.cwd()+'/node_modules/@playwright/test')
const fs = require('node:fs')
const axe = process.cwd()+'/node_modules/.pnpm/axe-core@4.11.1/node_modules/axe-core/axe.min.js'
const origin = process.argv[3] || 'http://127.0.0.1:9021'
const paths=['/in/pricing','/in/resources/platform/building-first-letbuyy-store','/in-hi/resources/platform/building-first-letbuyy-store','/in-ta/pricing','/in/legal/privacy','/in/contact']
;(async()=>{
const browser=await chromium.launch();const rows=[]
try {
for (const width of [375,1366]) for(const colorScheme of ['light','dark']){
const context=await browser.newContext({viewport:{width,height:850},colorScheme})
await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'&&['GET','HEAD'].includes(r.request().method())?r.continue():r.abort())
const page=await context.newPage()
for (const path of paths) {
 const response=await page.goto(origin+path)
 await page.evaluate(()=>document.fonts.ready)
 await page.addScriptTag({path:axe})
 const a=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}))
 rows.push({path,width,colorScheme,status:response.status(),violations:a.violations.map(x=>({id:x.id,selectors:x.nodes.map(n=>n.target)})),manualReview:a.incomplete.map(x=>x.id)})
}
await context.close()
}
} finally {await browser.close();fs.writeFileSync(process.argv[2],JSON.stringify({origin,rows},null,2)+'\n')}
let failed=rows.filter(x=>x.status!==200||x.violations.length)
console.log(JSON.stringify({cases:rows.length,failed:failed.length}))
if(failed.length)process.exitCode=1
})().catch(e=>{console.error(e.message);process.exitCode=1})
