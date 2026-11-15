import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {createRequire} from 'node:module';
const {createContentSecurityPolicy}=createRequire(import.meta.url)('../../../../config/security/next-security-headers.ts');
const prior=process.env.NODE_ENV;process.env.NODE_ENV='production';
const banner=`const compile=WebAssembly.compile.bind(WebAssembly);WebAssembly.compile=(bytes)=>compile(bytes).catch(error=>{self.postMessage({diagnostic:true,name:error.name,message:error.message.slice(0,500)});throw error;});`;
const bundle=await build({entryPoints:['apps/merchant/web/src/components/reels/client-file-sha256.worker.ts'],bundle:true,write:false,platform:'browser',format:'iife',banner:{js:banner}});
const runner=`window.result=new Promise(resolve=>{const messages=[];const worker=new Worker('/worker.js');worker.onmessage=event=>{messages.push(event.data);if(!event.data.diagnostic){worker.terminate();resolve(messages)}};worker.postMessage({requestId:'owned-csp-probe',file:new File(['abc'],'synthetic.png',{type:'image/png'}),maxBytes:104857600});});`;
const policy=createContentSecurityPolicy();
const server=createServer((req,res)=>{res.setHeader('Content-Security-Policy',policy);if(req.url==='/worker.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].contents)}else if(req.url==='/runner.js'){res.setHeader('Content-Type','application/javascript');res.end(runner)}else{res.setHeader('Content-Type','text/html');res.end('<script src="/runner.js"></script>')}});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert(address&&typeof address==='object');const origin=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});
try{const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());const page=await context.newPage();await page.goto(origin);console.log(JSON.stringify({policy_has_wasm_allowance:policy.includes("'wasm-unsafe-eval'"),result:await page.evaluate(()=> (window as unknown as {result:Promise<unknown>}).result)}));}
finally{await browser.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(prior===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=prior;}
