// Actual disposable non-CA leaf/key + file guards; no DB, trust installation, browser or signing CA.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { createHash, X509Certificate, createPrivateKey } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createContext, Script } from 'node:vm';
import ts from '../../../../../node_modules/typescript/lib/typescript.js';
const here=new URL('./',import.meta.url),root=fs.mkdtempSync('/private/tmp/madeyours-preissued-leaf-tests-');
fs.chmodSync(root,0o700);
const uid=process.getuid(),logical=`/private/tmp/letbuyy-owned-checkout-manual-${uid}`,input=join(root,'input');
fs.mkdirSync(input,{mode:0o700});
const pathOf=p=>p===logical?input:p.startsWith(logical+'/')?join(input,p.slice(logical.length+1)):p;
const unmap=p=>p===input?logical:p.startsWith(input+'/')?logical+p.slice(input.length):p;
const activeSourcePath='services/api-gateway/src/__tests__/owned-db/owned-db-support.ts';
const source=fs.readFileSync(new URL('../../../../../'+activeSourcePath,here),'utf8');
const body=source.slice(source.indexOf('function requirePrivateCheckoutTlsPath'),source.indexOf('export function createOwnedCheckoutTlsCertificate'));
const compiled=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});assert.deepEqual(compiled.diagnostics,[]);
const outcomes=[],commands=[],fixtures={},verifies=[];
const env={PATH:'/usr/bin:/bin',HOME:root,TMPDIR:root,RANDFILE:join(root,'random-state')};
function tool(args){commands.push({tool:'openssl',operation:args[0],hasCAFlag:args.some(x=>x==='-CA'||x==='-CAkey')});return execFileSync('/opt/homebrew/bin/openssl',args,{env,timeout:15000,stdio:['ignore','pipe','pipe'],maxBuffer:65536});}
function leaf(name,san='DNS:checkout.localhost',eku='serverAuth') {
 const key=join(root,name+'-key.pem'),cert=join(root,name+'-cert.pem');
 tool(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-config',join(root,'req.cnf'),'-keyout',key,'-out',cert,'-subj','/CN=checkout.localhost','-addext',`subjectAltName=${san}`,'-addext','basicConstraints=critical,CA:FALSE','-addext',`extendedKeyUsage=${eku}`]);
 fs.chmodSync(key,0o600);fs.chmodSync(cert,0o600);const x=new X509Certificate(fs.readFileSync(cert));assert.equal(x.ca,false);return {key,cert};
}
function install(pair,keyOverride) {
 for(const name of ['cert.pem','key.pem']){const p=join(input,name);try{fs.unlinkSync(p);}catch(e){if(e.code!=='ENOENT')throw e;}}
 fs.chmodSync(input,0o700);fs.copyFileSync(pair.cert,join(input,'cert.pem'));fs.copyFileSync(keyOverride??pair.key,join(input,'key.pem'));
 fs.chmodSync(join(input,'cert.pem'),0o600);fs.chmodSync(join(input,'key.pem'),0o600);
}
function invoke({realOS=false,uidOverride,platform='darwin',hold='1',qa,host}={}) {
 let keyReturned;const observed=[];
 const requestedLogical=`/private/tmp/letbuyy-owned-checkout-manual-${uidOverride??uid}`;
 const mapInput=p=>p===requestedLogical?input:p.startsWith(requestedLogical+'/')?join(input,p.slice(requestedLogical.length+1)):pathOf(p);
 const canonicalInput=p=>{const actual=fs.realpathSync(mapInput(p));return actual===input?requestedLogical:actual.startsWith(input+'/')?requestedLogical+actual.slice(input.length):actual;};
 const context=createContext({Buffer,Date,join,createHash,X509Certificate,createPrivateKey,
 process:{platform,getuid:()=>uidOverride??uid,env:{LETBUYY_THEME_EDITOR_BROWSER_HOLD:hold,...(qa?{LETBUYY_THREADLINE_QA:'1'}:{})}},
 lstatSync:p=>fs.lstatSync(mapInput(p)),realpathSync:canonicalInput,openSync:(p,flags)=>fs.openSync(mapInput(p),flags),fstatSync:fs.fstatSync,closeSync:fs.closeSync,readSync:fs.readSync,fsConstants:fs.constants,
 mkdtempSync:p=>{assert.equal(p,'/private/tmp/letbuyy-owned-checkout-verify-');return fs.mkdtempSync(join(root,'verification-'));},chmodSync:fs.chmodSync,writeFileSync:fs.writeFileSync,rmSync:fs.rmSync,
 execFileSync:(cmd,args,options)=>{observed.push({cmd,args:[...args]});assert.equal(cmd,'/usr/bin/security');assert.deepEqual([...args].filter(x=>!x.startsWith(root)),['verify-cert','-c','-p','ssl','-n','checkout.localhost','-L','-q']);if(realOS){verifies.push({mode:'ACTUAL_OS_VERIFY_UNTRUSTED_NEGATIVE'});return execFileSync(cmd,args,{...options,env,timeout:15000});}verifies.push({mode:'STUBBED_OS_RESULT_CRYPTO_FILE_POSITIVE_ONLY'});return Buffer.alloc(0);}});
 new Script(compiled.outputText+'\nthis.run=createManualOwnedCheckoutTls;').runInContext(context);
 try {const result=context.run(env);keyReturned=result.key;return {result,observed};} finally {keyReturned?.fill(0);}
}
function check(id,name,fn,scope='ACTUAL_LEAF_CRYPTO_AND_FILE_GUARDS_OS_SUCCESS_STUBBED'){fn();outcomes.push({id,name,result:'PASS',scope});}
try {
 fs.writeFileSync(join(root,'req.cnf'),'[req]\ndistinguished_name=dn\n[dn]\n',{mode:0o600});
 fixtures.valid=leaf('valid');fixtures.otherKey=leaf('other-key');fixtures.wrongSAN=leaf('wrong-san','DNS:other.invalid');fixtures.wildcard=leaf('wildcard','DNS:*.localhost');fixtures.extraSAN=leaf('extra-san','DNS:checkout.localhost,DNS:other.invalid');fixtures.clientAuth=leaf('client-auth','DNS:checkout.localhost','clientAuth');
 for(const [name,before,after] of [['expired','20200101000000Z','20200102000000Z'],['future','20990101000000Z','20990102000000Z']]) {
  const cert=join(root,name+'-cert.pem');tool(['x509','-in',fixtures.valid.cert,'-signkey',fixtures.valid.key,'-not_before',before,'-not_after',after,'-out',cert]);fs.chmodSync(cert,0o600);fixtures[name]={key:fixtures.valid.key,cert};assert.equal(new X509Certificate(fs.readFileSync(cert)).ca,false);
 }
 check('C01','Actual valid leaf/key parses and returns matching public SPKI; OS success is stubbed',()=>{install(fixtures.valid);const before=fs.readFileSync(join(input,'key.pem'));const x=new X509Certificate(fs.readFileSync(fixtures.valid.cert));const r=invoke();assert.equal(r.result.spki,createHash('sha256').update(x.publicKey.export({type:'spki',format:'der'})).digest('base64'));assert.equal(createHash('sha256').update(before).digest('hex'),createHash('sha256').update(fs.readFileSync(join(input,'key.pem'))).digest('hex'));assert.equal(r.observed.length,1);assert.ok(fs.existsSync(join(input,'cert.pem')));assert.ok(fs.existsSync(join(input,'key.pem')));before.fill(0);});
 for(const [id,name] of [['C02','wrongSAN'],['C03','wildcard'],['C04','extraSAN'],['C05','clientAuth'],['C06','expired'],['C07','future']])check(id,'Actual '+name+' leaf refuses before OS verification',()=>{install(fixtures[name]);const count=verifies.length;assert.throws(()=>invoke(),/trusted leaf files separately/);assert.equal(verifies.length,count);});
 check('C08','Actual different private key refuses before OS verification',()=>{install(fixtures.valid,fixtures.otherKey.key);const count=verifies.length;assert.throws(()=>invoke());assert.equal(verifies.length,count);});
 check('C09','Actual appended certificate refuses instead of parsing first PEM only',()=>{install(fixtures.valid);fs.appendFileSync(join(input,'cert.pem'),fs.readFileSync(fixtures.valid.cert));assert.throws(()=>invoke());});
 check('C10','Actual malformed key refuses with sanitized error',()=>{install(fixtures.valid);fs.writeFileSync(join(input,'key.pem'),'invalid synthetic key',{mode:0o600});assert.throws(()=>invoke(),e=>e.message==='owned manual checkout TLS unavailable; owner must provision trusted leaf files separately');});
 check('F01','Actual loose input directory refuses',()=>{install(fixtures.valid);fs.chmodSync(input,0o755);assert.throws(()=>invoke());fs.chmodSync(input,0o700);});
 check('F02','Actual readable-by-group key refuses',()=>{install(fixtures.valid);fs.chmodSync(join(input,'key.pem'),0o640);assert.throws(()=>invoke());});
 check('F03','Actual symlink certificate refuses',()=>{install(fixtures.valid);fs.unlinkSync(join(input,'cert.pem'));fs.symlinkSync(fixtures.valid.cert,join(input,'cert.pem'));assert.throws(()=>invoke());});
 check('F04','Actual hardlinked key refuses',()=>{install(fixtures.valid);fs.unlinkSync(join(input,'key.pem'));fs.linkSync(fixtures.valid.key,join(input,'key.pem'));assert.throws(()=>invoke());});
 check('F05','Actual empty certificate refuses',()=>{install(fixtures.valid);fs.truncateSync(join(input,'cert.pem'),0);assert.throws(()=>invoke());});
 check('F06','Actual oversize input refuses before unbounded read',()=>{install(fixtures.valid);fs.writeFileSync(join(input,'cert.pem'),Buffer.alloc(65537),{mode:0o600});assert.throws(()=>invoke());});
 check('F07','Actual missing key refuses without creating replacement',()=>{install(fixtures.valid);fs.unlinkSync(join(input,'key.pem'));assert.throws(()=>invoke());assert.equal(fs.existsSync(join(input,'key.pem')),false);});
 check('F08','Actual input owner mismatch refuses (expected UID varied over own real files, no chown or foreign path)',()=>{install(fixtures.valid);assert.throws(()=>invoke({uidOverride:uid+1}));});
 for(const [id,opts] of [['M01',{hold:'0'}],['M02',{qa:true}],['M03',{platform:'linux'}]])check(id,'Manual profile exclusion '+id,()=>{install(fixtures.valid);const count=verifies.length;assert.throws(()=>invoke(opts));assert.equal(verifies.length,count);});
 check('O01','Actual macOS SSL verification rejects self-signed non-CA leaf without explicit trust anchor',()=>{install(fixtures.valid);assert.throws(()=>invoke({realOS:true}),/trusted leaf files separately/);},'ACTUAL_OS_TRUST_DENIAL_WITH_SELF_SIGNED_LEAF_NO_TRUST_CHANGE');
 check('F09','Verification snapshots cleaned; private preissued input remains intact',()=>{assert.deepEqual(fs.readdirSync(root).filter(n=>n.startsWith('verification-')),[]);assert.ok(fs.existsSync(join(input,'cert.pem')));assert.ok(fs.existsSync(join(input,'key.pem')));});
 const checkpoint=JSON.parse(fs.readFileSync(new URL('source-checkpoint.json',here),'utf8'));check('S01','Shared source hashes still match and native body equality retained',()=>{assert.equal(checkpoint.defaultNativeGenerationBodyUnchanged,true);for(const x of checkpoint.admittedFiles??checkpoint.sourceFiles)assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../../../../../'+x.path,here))).digest('hex'),x.sha256);},'READ_ONLY_SOURCE_CHECK');
} finally {fs.rmSync(root,{recursive:true,force:true});}
const report={classification:'V2_ACTUAL_DISPOSABLE_NON_CA_LEAF_CRYPTO_FILES_AND_OS_DENIAL_NO_TRUST_INSTALL',passed:outcomes.length,failed:0,checks:outcomes,opensslVersion:execFileSync('/opt/homebrew/bin/openssl',['version'],{encoding:'utf8'}).trim(),opensslOperations:commands,actualSigningCaKeyRead:false,caGenerated:false,trustChanges:0,temporaryLeafFixturesRemoved:!fs.existsSync(root),testProcessEditedSource:false,testedSourcePath:activeSourcePath,testedSourceSha256:createHash('sha256').update(source).digest('hex'),osTrustedChainPositive:'NOT_RUN_PENDING_PREISSUED_TRUSTED_LEAF_AND_HUMAN_DECISION',ownedDatabaseBindingIntegration:'NOT_RUN_THREADLINE391_LANE_RESERVED',browser:'NOT_RUN_NO_LEASE',testBoundary:'Real Node crypto and own private filesystem. Fixed input path remapped only in test adapter to disposable own directory; no actual fixed/private provisioned path is read. Positive OS command is stubbed; separate O01 executes genuine local security verify-cert and requires denial.'};
fs.writeFileSync(new URL('proposal-real-leaf-test-results.json',here),JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify({classification:report.classification,passed:report.passed,failed:0,caGenerated:false,trustChanges:0,ownLeafFixturesRemoved:report.temporaryLeafFixturesRemoved,osTrustedPositive:'NOT_RUN'})+'\n');
