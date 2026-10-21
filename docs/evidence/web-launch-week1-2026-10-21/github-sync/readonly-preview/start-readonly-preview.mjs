// Local diagnostic surface for the owner's existing public store. No database
// credentials, mutation forwarding, or primary runtime edits. The existing local internal
// access-gate key stays server-side and is used only for the selected host read.
import {createServer} from 'node:http';
import {classifyPreviewRead} from './readonly-preview-policy.mjs';
import {spawn,execFileSync} from 'node:child_process';
import {openSync,closeSync,writeFileSync,readFileSync} from 'node:fs';
const workspace='/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-week1-core-usability';
const evidence='/Users/saai_mithra/Projects/LetBuyy-Workspace/Verification/LetBuyy-Web-Launch-Audit-2026-10-20/week1-core-catalog';
const handle='auditloom20261020';
const saved=JSON.parse(readFileSync('/private/tmp/letbuyy-auditloom-public-payload.json','utf8'));
if(saved.subdomain!==handle||typeof saved.id!=='string')throw new Error('Selected public snapshot identity is unavailable');
const storeId=saved.id;
const appPort=49897,proxyPort=49896;
const localEnv=readFileSync('/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy/apps/commerce/web/.env.local','utf8');
function setting(name){const line=localEnv.split(/\r?\n/).find(line=>line.startsWith(name+'='));if(!line)return '';const raw=line.slice(name.length+1).trim();return /^(["']).*\1$/.test(raw)?raw.slice(1,-1):raw;}
const accessSecret=setting('INTERNAL_API_SECRET');if(!accessSecret)throw new Error('Existing local access-gate key is unavailable');
const storeRoot=setting('NEXT_PUBLIC_STORE_ROOT_DOMAIN')||'letbuyy.com';
const accessHost=handle+'.'+storeRoot.replace(/^https?:\/\//,'').replace(/\/$/,'');

let forwarded=0,denied=0,child,closing=false,receipt;
const record=()=>{if(receipt){receipt.forwarded=forwarded;receipt.denied=denied;writeFileSync(evidence+'/readonly-preview.json',JSON.stringify(receipt,null,2)+'\n');}};
const proxy=createServer(async(req,res)=>{
 const url=new URL(req.url??'/','http://127.0.0.1');
 const kind=classifyPreviewRead(req.method??'',url,{handle,storeId,accessHost});
 const accessRead=kind==='access';
 if(!kind){denied++;record();console.info(JSON.stringify({denied:true,path:url.pathname,host:url.pathname.endsWith('/resolve')?url.searchParams.get('host'):undefined}));res.writeHead(403,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:{code:'LOCAL_READ_ONLY_PREVIEW',message:'This local preview permits public reads of the selected store only.'}}));return;}
 try{
  forwarded++;record();const reply=await fetch('http://127.0.0.1:9010'+url.pathname+url.search,{method:req.method,headers:{accept:'application/json',...(accessRead?{'x-internal-api-secret':accessSecret}:{})},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(accessRead) console.info(JSON.stringify({accessRead:true,status:reply.status,host:url.searchParams.get('host')}));res.writeHead(reply.status,{'content-type':reply.headers.get('content-type')||'application/json','cache-control':'no-store','x-letbuyy-local-preview':'read-only'});res.end(Buffer.from(await reply.arrayBuffer()));
 }catch{res.writeHead(502,{'content-type':'application/json'});res.end('{"error":{"code":"LOCAL_UPSTREAM_UNAVAILABLE"}}');}
});
await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(proxyPort,'127.0.0.1',resolve);});
const api='http://127.0.0.1:'+proxy.address().port+'/v1';
const env=Object.fromEntries(['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL'].flatMap(key=>process.env[key]?[[key,process.env[key]]]:[]));
Object.assign(env,{LETBUYY_SESSION_RUNTIME_NEXT_DIST_DIR:'.next-session-runtime-auditloom-preview',NEXT_TELEMETRY_DISABLED:'1',LETBUYY_API_BASE_URL:api,LETBUYY_API_URL:api,NEXT_PUBLIC_API_BASE_URL:api,NEXT_PUBLIC_STORE_ROOT_DOMAIN:storeRoot,NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES:'localhost',INTERNAL_API_SECRET:accessSecret,NEXT_PUBLIC_STOREFRONT_URL:'http://localhost:'+appPort});
const log=openSync(evidence+'/readonly-preview-server.log','a',0o600);
child=spawn(process.execPath,[workspace+'/apps/commerce/web/node_modules/next/dist/bin/next','dev','--webpack','--hostname','localhost','--port',String(appPort)],{cwd:workspace+'/apps/commerce/web',env,detached:true,stdio:['ignore',log,log]});closeSync(log);
receipt={scope:'Read-only public preview; original9000 and restored data untouched',workspace,head:execFileSync('git',['rev-parse','HEAD'],{cwd:workspace,encoding:'utf8'}).trim(),publicReviewScope:'Selected public store_id and valid product UUID only; no capabilities, duplicate parameters or writes',startedAt:new Date().toISOString(),url:'http://localhost:'+appPort+'/store/'+handle,supervisorPid:process.pid,childPid:child.pid,proxyPort:proxy.address().port,accessGate:'Existing internal key used only for exact selected-host GET; no credential values retained',forwarded,denied};
writeFileSync(evidence+'/readonly-preview.json',JSON.stringify(receipt,null,2)+'\n');
function stop(){if(closing)return;closing=true;try{process.kill(-child.pid,'SIGTERM');}catch{}proxy.closeAllConnections();proxy.close();receipt.stoppedAt=new Date().toISOString();receipt.forwarded=forwarded;receipt.denied=denied;writeFileSync(evidence+'/readonly-preview.json',JSON.stringify(receipt,null,2)+'\n');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);child.once('exit',()=>{stop();process.exitCode=0;});
console.info(JSON.stringify({url:receipt.url,mode:'read-only',primaryPort9000Unchanged:true}));
