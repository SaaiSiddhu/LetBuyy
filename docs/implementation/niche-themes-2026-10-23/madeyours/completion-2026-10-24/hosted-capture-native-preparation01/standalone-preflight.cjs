// PREPARED ONLY. A later Themes activation is mandatory. Never imports tests,
// calls a Worker entry, invokes a runner, or starts/inspects a database.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
const root=arg('--root'),manifestPath=arg('--manifest'),activationPath=arg('--activation'),out=arg('--out');
const own=__dirname,vendorPath=path.join(own,'VENDOR_STORE_CLOSURE.json');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report={classification:'STANDALONE_ACTUAL_MODULE_PREFLIGHT_ONLY_NO_NATIVE',root,startedAt:new Date().toISOString(),nativeExecuted:false,databaseActions:0,workerRequests:0,providerCalls:0};
let fetchCalls=0,socketCalls=0,subprocessCalls=0,envReadsDenied=0;
try{
 const assert=require('node:assert/strict');
 assert.ok(root&&manifestPath&&activationPath&&out,'all reviewed parameters required');assert.ok(!fs.existsSync(out),'exclusive new output required');
 const activation=JSON.parse(fs.readFileSync(activationPath,'utf8'));
 assert.equal(activation.status,'GRANTED_STANDALONE_PREFLIGHT_ONLY');
 assert.equal(activation.owner,'01a164ba-e017-7b90-9053-efc5357459a6');
 assert.equal(activation.nativeExecutionGranted,false);
 const selected=activation.materializations.find(x=>x.root===root);assert.ok(selected);assert.equal(hash(manifestPath),selected.manifestSha256);
 const material=JSON.parse(fs.readFileSync(manifestPath,'utf8')),vendor=JSON.parse(fs.readFileSync(vendorPath,'utf8'));
 assert.equal(material.root,root);assert.equal(hash(vendorPath),activation.vendorClosureSha256);
 const witness='services/api-gateway/src/__tests__/owned-db/hosted-checkout-buyer-ownership.postgres.test.ts';assert.equal(hash(path.join(root,witness)),activation.acceptedWitnessTestSha256);
 const input=new Map(material.files.map(f=>[path.join(root,f.path),f.sha256]));
 for(const f of material.files){const q=path.join(root,f.path);assert.ok(!fs.lstatSync(q).isSymbolicLink(),f.path);assert.equal(hash(q),f.sha256,f.path);}
 for(const row of material.links){assert.equal(fs.readlinkSync(path.join(root,row.path)),row.target,row.path);assert.equal(fs.realpathSync(path.join(root,row.path)),row.resolved,row.path);}
 const vendorFiles=new Map();for(const f of vendor.files){const q=path.join(vendor.store,f.path);assert.equal(hash(q),f.sha256,q);vendorFiles.set(q,f.sha256);}
 for(const row of vendor.links)assert.equal(fs.readlinkSync(path.join(vendor.store,row.path)),row.target,row.path);
 const exclusions=JSON.parse(fs.readFileSync(path.join(own,'ENV_DECLARATION_EXCLUSIONS.json'),'utf8')).excluded;
 for(const row of exclusions)assert.ok(!fs.existsSync(path.join(root,row.path)),row.path);
 const migrations=material.files.filter(f=>/^database\/supabase\/migrations\/[^/]+\.sql$/.test(f.path));assert.equal(migrations.length,322);assert.equal(Math.max(...migrations.map(f=>Number(path.basename(f.path).split('_')[0]))),393);
 const admission=JSON.parse(fs.readFileSync(path.join(root,'docs/implementation/niche-theme-programme/completion-2026-10-24/SHARED_RUNTIME_ADMISSION.json'),'utf8'));assert.equal(admission.upProposals.length,4);for(const q of admission.upProposals)assert.equal(hash(path.join(root,q.path)),q.sha256);
 assert.equal(fs.realpathSync(process.execPath),activation.nodeRealPath);assert.equal(hash(process.execPath),activation.nodeSha256);assert.equal(process.version,activation.nodeVersion);
 // Discard inherited service/provider values in this child without inspecting
 // or printing them. No global shell/application environment is modified.
 for(const key of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY','DATABASE_URL','RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET','RESEND_API_KEY','CHECKOUT_SIGNING_SECRET','STORE_ACCESS_SIGNING_KEY','INTERNAL_API_SECRET'])delete process.env[key];
 // Install application-phase guards after compiler CLI initialization. The
 // reviewed tsx CLI may create its own compiler/IPC control process before this
 // file; this is not claimed as a zero-process bootstrap.
 globalThis.fetch=async()=>{fetchCalls++;throw Error('preflight forbids requests');};
 const net=require('node:net'),tls=require('node:tls'),cp=require('node:child_process');
 net.Socket.prototype.connect=function(){socketCalls++;throw Error('preflight forbids sockets');};
 for(const k of ['connect','createConnection'])net[k]=()=>{socketCalls++;throw Error('preflight forbids sockets');};
 tls.connect=()=>{socketCalls++;throw Error('preflight forbids TLS');};
 for(const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[k]=()=>{subprocessCalls++;throw Error('preflight forbids application subprocesses');};
 const originalRead=fs.readFileSync;
 fs.readFileSync=function(file,...rest){if(typeof file==='string'&&(exclusions.some(r=>path.resolve(file)===path.join(root,r.path))||/^(\.env($|\.)|\.npmrc$)/.test(path.basename(file)))){envReadsDenied++;throw Error('preflight refuses excluded environment input');}return originalRead.call(fs,file,...rest);};
 const runtimeLoads=[];
 assert.equal(typeof Module.registerHooks,'function','reviewed Node runtime must support synchronous load tracing');
 const {fileURLToPath}=require('node:url');
 const trace=Module.registerHooks({load(url,context,nextLoad){
  if(url.startsWith('file:')){
   const file=fs.realpathSync(fileURLToPath(url)),expected=input.get(file)||vendorFiles.get(file);
   assert.ok(expected,'unclosed CJS/ESM runtime load '+file);assert.equal(hash(file),expected);
   assert.ok(!/\.d\.[cm]?ts$/.test(file));assert.ok(!file.includes('/__tests__/'));
   runtimeLoads.push({path:file,sha256:expected,format:context.format});
  }else assert.ok(url.startsWith('node:'),'unexpected virtual runtime source '+url.slice(0,80));
  return nextLoad(url,context);
 }});
 const req=Module.createRequire(path.join(root,'services/api-gateway/package.json'));
 const checkout=req('@letbuyy/checkout-core'),direct=req(path.join(root,'packages/checkout-core/src/index.ts'));
 assert.equal(typeof checkout.canonicalCheckoutBuyerBinding,'function');assert.equal(checkout.canonicalCheckoutBuyerBinding,direct.canonicalCheckoutBuyerBinding);
 assert.equal(typeof req('hono/cors').cors,'function');assert.equal(typeof req('hono/factory').createFactory,'function');
 assert.equal(typeof req('./src/routes/checkout.ts').default.fetch,'function');assert.equal(typeof req('./src/index.ts').default.fetch,'function');
 const catalog=req(path.join(root,'scripts/governance/test-suite-catalog.mjs'));
 assert.equal(typeof catalog.discoverGatewayDatabaseSuites,'function');
 const registeredSuiteInventory=catalog.discoverGatewayDatabaseSuites(root);
 assert.ok(registeredSuiteInventory.length>0);
 assert.equal(new Set(registeredSuiteInventory).size,registeredSuiteInventory.length);
 const loaded=[];for(const file of Object.keys(require.cache)){
  if(file===__filename)continue;
  if(file.startsWith(root+'/')){assert.ok(input.has(file),'unmanifested private load '+file);assert.equal(hash(file),input.get(file));assert.ok(!/\.d\.[cm]?ts$/.test(file));assert.ok(!file.includes('/__tests__/'),'test module must not execute in preflight');loaded.push({path:file,sha256:hash(file),kind:'PRIVATE'});}
  else if(file.startsWith(vendor.store+'/')){assert.ok(vendorFiles.has(file),'unmanifested vendor load '+file);assert.equal(hash(file),vendorFiles.get(file));loaded.push({path:file,sha256:hash(file),kind:'VENDOR'});}
  else throw Error('unclosed application module '+file);
 }
 assert.equal(fetchCalls+socketCalls+subprocessCalls+envReadsDenied,0);
 trace.deregister();
 Object.assign(report,{status:'PASS_STANDALONE_PREFLIGHT_ONLY',activationSha256:hash(activationPath),manifestSha256:hash(manifestPath),vendorClosureSha256:hash(vendorPath),actualExportChecks:7,registeredSuiteInventory,loaded,runtimeLoads,sourceFiles:material.files.length,vendorFiles:vendor.files.length,migrations:322,maxMigration:393,ups:4,node:process.version,guardedApplicationPhase:{fetchCalls,socketCalls,subprocessCalls,envReadsDenied}});
}catch(error){report.status='REFUSED_BEFORE_NATIVE';report.error={name:error.name,code:error.code??null,message:String(error.message).slice(0,700)};report.guardedApplicationPhase={fetchCalls,socketCalls,subprocessCalls,envReadsDenied};process.exitCode=1;}
if(out&&!fs.existsSync(out))fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,root,error:report.error??null,nativeExecuted:false,guardedApplicationPhase:report.guardedApplicationPhase}));
