// A docs-only control-flow model. It runs no child process, filesystem key read, CA or TLS handshake.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Script, createContext } from 'node:vm';
import ts from '../../../../../node_modules/typescript/lib/typescript.js';
const here=new URL('./',import.meta.url);
const source=readFileSync(new URL('owned-db-support.ts.proposed',here),'utf8');
const functions=source.slice(source.indexOf('function requirePrivateCheckoutTlsPath'),source.indexOf('\ntype ClientKind')).replace('export function createOwnedCheckoutTlsCertificate','function createOwnedCheckoutTlsCertificate');
const js=ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.deepEqual(js.diagnostics,[]);
function model(change={}) {
 const calls=[],removed=[],reads=[];const uid=501,dir='/private/tmp/letbuyy-owned-checkout-tls-MODEL',ca=`/private/tmp/letbuyy-owned-checkout-ca-${uid}`;
 const info=path=>({uid:change.owner??uid,mode:path===ca||path===dir?0o40700:change.mode??0o100600,nlink:change.links??1,size:change.size??100,dev:1,ino:7,isSymbolicLink:()=>Boolean(change.symlink),isDirectory:()=>path===ca||path===dir,isFile:()=>path!==ca&&path!==dir});
 const owned={container:'MODEL-container',database:'MODEL-database',runId:'a1b2c3d4e5f'};
 class Cert {constructor(){this.subjectAltName=change.san??'DNS:checkout.localhost';this.ca=change.ca??false;this.validFrom=new Date(Date.now()-60000).toISOString();this.validTo=new Date(Date.now()+(change.expired?-60000:86400000)).toISOString();this.keyUsage=change.eku??['1.3.6.1.5.5.7.3.1'];this.publicKey={export:()=>Buffer.from('PUBLIC-CONTROL-MODEL')};}checkHost(_h,o){return change.badHost?undefined:'checkout.localhost';}checkPrivateKey(){return !change.badKey;}}
 const context=createContext({Buffer,Date,join,createHash,X509Certificate:Cert,createPrivateKey:()=>({type:'MODEL-NOT-A-KEY'}),process:{platform:change.platform??'darwin',getuid:()=>uid,execPath:'/MODEL/node',env:{LETBUYY_THEME_EDITOR_BROWSER_HOLD:change.hold??'1',...(change.qa?{LETBUYY_THREADLINE_QA:'1'}:{})}},requireOwnedDatabase:()=>owned,clientFixtureEnv:{MODEL:'fixture'},GUARD:'/MODEL/guard',
 lstatSync:path=>{if(change.missingCA&&path.startsWith(ca))throw Error('MODEL missing CA');return info(path);},realpathSync:path=>change.realpath?'/MODEL/foreign':path,
 openSync:()=>3,fstatSync:()=>info(dir+'/key.pem'),closeSync:()=>{},fsConstants:{O_RDONLY:0,O_NOFOLLOW:256},
 readFileSync:path=>{reads.push(path);if(typeof path!=='number')throw Error('MODEL unexpected path read');return Buffer.from('CONTROL-MODEL-NOT-KEY-OR-CERT');},
 mkdtempSync:()=>dir,chmodSync:()=>{},rmSync:path=>removed.push(path),tmpdir:()=>'/MODEL/tmp',
 execFileSync:(cmd,args,opts)=>{calls.push({cmd,args,env:opts.env});if(cmd==='/MODEL/node')return JSON.stringify({...owned,pgContainer:change.badBinding?'foreign':owned.container});if(cmd==='/usr/bin/security'&&change.untrusted)throw Error('MODEL OS trust denial');if(cmd==='/opt/homebrew/bin/mkcert'&&change.toolMissing)throw Error('MODEL missing tool');return Buffer.alloc(0);}});
 new Script(js.outputText+'\nthis.invoke=createOwnedCheckoutTlsCertificate;').runInContext(context);
 return {owned,calls,removed,reads,invoke:(mode)=>context.invoke(owned,mode),forged:()=>context.invoke({...owned},'manual-os-trusted')};
}
const results=[];function check(name,fn){fn();results.push({name,result:'PASS',classification:'CONTROL_FLOW_MODEL_ONLY'});}
check('manual opt-in uses only fixed issuer command and OS verification, with no trust installation',()=>{const m=model();m.invoke('manual-os-trusted');assert.deepEqual(m.calls.map(x=>x.cmd),['/MODEL/node','/opt/homebrew/bin/mkcert','/usr/bin/security']);const issue=m.calls[1];assert.deepEqual([...issue.args].filter(x=>!x.startsWith('/private/tmp/')),['-cert-file','-key-file','checkout.localhost']);assert.equal(issue.env.CAROOT,'/private/tmp/letbuyy-owned-checkout-ca-501');const verify=m.calls[2];assert.deepEqual([...verify.args],['verify-cert','-c','/private/tmp/letbuyy-owned-checkout-tls-MODEL/cert.pem','-p','ssl','-n','checkout.localhost','-L','-q']);assert.equal(m.reads.length,2);assert.ok(m.reads.every(x=>typeof x==='number'));assert.equal(m.removed.length,1);});
for(const [name,cfg] of [['no manual hold',{hold:'0'}],['QA profile',{qa:true}],['other platform',{platform:'linux'}],['missing CA',{missingCA:true}],['symlink',{symlink:true}],['foreign owner',{owner:502}],['loose mode',{mode:0o100644}],['hardlink',{links:2}],['empty file',{size:0}],['oversize file',{size:65537}],['changed realpath',{realpath:true}]])check(name+' refuses before issuer execution',()=>{const m=model(cfg);assert.throws(()=>m.invoke('manual-os-trusted'));assert.equal(m.calls.filter(x=>x.cmd==='/opt/homebrew/bin/mkcert').length,0);});
for(const [name,cfg] of [['extra SAN',{san:'DNS:checkout.localhost, DNS:other.invalid'}],['wildcard SAN',{san:'DNS:*.localhost'}],['CA leaf',{ca:true}],['name mismatch',{badHost:true}],['expired leaf',{expired:true}],['client-auth EKU',{eku:['1.3.6.1.5.5.7.3.2']}],['mismatched key',{badKey:true}]])check(name+' refuses before OS-trust evaluation and cleans generated directory',()=>{const m=model(cfg);assert.throws(()=>m.invoke('manual-os-trusted'));assert.equal(m.calls.filter(x=>x.cmd==='/usr/bin/security').length,0);assert.equal(m.removed.length,1);});
for(const [name,cfg] of [['OS trust denial',{untrusted:true}],['issuer unavailable',{toolMissing:true}]])check(name+' fails closed without fallback and cleans generated directory',()=>{const m=model(cfg);assert.throws(()=>m.invoke('manual-os-trusted'));assert.equal(m.calls.filter(x=>x.cmd==='openssl').length,0);assert.equal(m.removed.length,1);});
check('forged owned handle refuses before guard/tool/file work',()=>{const m=model();assert.throws(m.forged);assert.equal(m.calls.length,0);assert.equal(m.reads.length,0);});
check('changed fixture binding refuses before TLS work',()=>{const m=model({badBinding:true});assert.throws(()=>m.invoke('manual-os-trusted'));assert.equal(m.calls.length,1);assert.equal(m.reads.length,0);});
check('unknown modes refuse after ownership proof without issuer/file work',()=>{const m=model();assert.throws(()=>m.invoke('../arbitrary-command'));assert.equal(m.calls.length,1);assert.equal(m.reads.length,0);});
check('default native generation body remains byte-identical in unapplied patch',()=>{const checkpoint=JSON.parse(readFileSync(new URL('source-checkpoint.json',here),'utf8'));assert.equal(checkpoint.defaultNativeGenerationBodyUnchanged,true);});
const report={classification:'UNAPPLIED_PROPOSAL_CONTROL_FLOW_MODEL_ONLY_NOT_CRYPTO_OS_TRUST_TLS_OR_BROWSER_ACCEPTANCE',passed:results.length,failed:0,checks:results,actualCommandsExecuted:[],actualPrivateFilesRead:[],certificatesGenerated:0,trustChanges:0,realCryptoAndOwnedIntegration:'NOT_RUN_REQUIRES_REVIEW_AND_AUTHORIZED_OWNED_LANE',browser:'NOT_RUN_REQUIRES_EDITOR_LEASE_AND_HUMAN_TRUST_DECISION'};
writeFileSync(new URL('proposal-control-test-results.json',here),JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify({classification:report.classification,passed:report.passed,failed:0,commandsExecuted:[],trustChanges:0})+'\n');
