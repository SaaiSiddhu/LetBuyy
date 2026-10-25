// Read-only runtime resolution/export preflight. Never imports a test suite.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,realpathSync,writeFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root='/private/tmp/madeyours-checkout-reentry-proposal-20261024-06';
const receipts=join(root,'packaging-receipts');
const material=JSON.parse(readFileSync(join(receipts,'materialization.json'),'utf8'));
const graph=JSON.parse(readFileSync(join(receipts,'sealed05-literal-import-graph.json'),'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
let fetchCalls=0;
globalThis.fetch=async()=>{fetchCalls++;throw Error('Runtime preflight forbids network');};
const failures=[],workspace=[],external=[],relativeEdges=[];
const candidatePath=p=>p===root||p.startsWith(root+'/');
const vendorPath=p=>p.startsWith('/Volumes/Projects/LetBuyy/node_modules/.pnpm/');
const mainSourcePath=p=>p.startsWith('/Volumes/Projects/LetBuyy/')&&!vendorPath(p);
const fail=(kind,data)=>failures.push({kind,...data});
for(const f of material.files){const p=join(root,f.path);assert(!lstatSync(p).isSymbolicLink(),f.path);assert.equal(hash(p),f.sha256,'Copied source moved '+f.path);assert(candidatePath(realpathSync(p)),f.path);}
for(const p of material.sharedThirdPartyPackages)assert.equal(hash(join(p.realPath,'package.json')),p.packageJsonSha256,'Shared vendor metadata moved '+p.name);
for(const link of material.dependencyLinks){const target=realpathSync(join(root,link.path));assert.equal(target,link.realPath);assert(link.kind==='CANDIDATE_WORKSPACE'?candidatePath(target):vendorPath(target),link.path);}
const rootReq=createRequire(join(root,'package.json'));
const ts=rootReq('typescript');
function typeOnly(from,specifier){
 const src=ts.createSourceFile(from,readFileSync(join(root,from),'utf8'),ts.ScriptTarget.Latest,true);
 const matches=src.statements.filter(n=>(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier?.text===specifier);
 return matches.length>0&&matches.every(n=>n.isTypeOnly||ts.isImportDeclaration(n)&&(n.importClause?.isTypeOnly||n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)&&n.importClause.namedBindings.elements.length>0&&n.importClause.namedBindings.elements.every(e=>e.isTypeOnly)));
}
for(const e of graph.workspaceRuntimeEntryChecks){
 try{const req=createRequire(join(root,e.from)),resolved=req.resolve(e.specifier),real=realpathSync(resolved),logical=relative(root,real);
 const row={from:e.from,specifier:e.specifier,resolved:logical,insideCandidate:candidatePath(real),expectedSealed05NativeEntry:e.nativeNodeDefaultEntry,sha256:hash(real),typeOnly:typeOnly(e.from,e.specifier)};
 workspace.push(row);if(!row.insideCandidate||logical!==e.nativeNodeDefaultEntry||/\.d\.[cm]?ts$/.test(real))fail('WORKSPACE_RUNTIME_ESCAPE_OR_IDENTITY_MISMATCH',row);
 }catch(error){fail('WORKSPACE_RUNTIME_RESOLUTION_FAILURE',{...e,error:String(error.message)});}
}
for(const e of graph.externalModuleEdges){
 try{const req=createRequire(join(root,e.from)),resolved=req.resolve(e.specifier),real=realpathSync(resolved),isTypeOnly=typeOnly(e.from,e.specifier);
 const row={from:e.from,specifier:e.specifier,resolved:real,sha256:hash(real),typeOnly:isTypeOnly,kind:candidatePath(real)?'PRIVATE_PACKAGE_IMPORT_MAP':vendorPath(real)?'SHARED_THIRD_PARTY':'UNAPPROVED'};
 external.push(row);if(mainSourcePath(real)||row.kind==='UNAPPROVED'||!isTypeOnly&&/\.d\.[cm]?ts$/.test(real))fail('EXTERNAL_RUNTIME_ESCAPE_OR_DECLARATION',row);
 }catch(error){if(typeOnly(e.from,e.specifier))external.push({from:e.from,specifier:e.specifier,typeOnly:true,runtimeNotApplicable:true,reason:String(error.message)});else fail('EXTERNAL_RUNTIME_RESOLUTION_FAILURE',{...e,error:String(error.message)});}
}
for(const e of graph.edges.filter(e=>e.specifier.startsWith('.'))){
 try{const resolved=createRequire(join(root,e.from)).resolve(e.specifier),real=realpathSync(resolved),isTypeOnly=typeOnly(e.from,e.specifier);
 const row={from:e.from,specifier:e.specifier,resolved:relative(root,real),insideCandidate:candidatePath(real),typeOnly:isTypeOnly};
 relativeEdges.push(row);if(!row.insideCandidate||!isTypeOnly&&/\.d\.[cm]?ts$/.test(real))fail('RELATIVE_RUNTIME_ESCAPE_OR_DECLARATION',row);
 }catch(error){fail('RELATIVE_RUNTIME_RESOLUTION_FAILURE',{...e,error:String(error.message)});}
}
const exportsProof=[];
if(failures.length===0){
 const gatewayReq=createRequire(join(root,'services/api-gateway/package.json'));
 const bound=gatewayReq('@letbuyy/checkout-core');
 const direct=gatewayReq(join(root,'packages/checkout-core/src/index.ts'));
 for(const name of ['canonicalCheckoutBuyerBinding']){
  const row={specifier:'@letbuyy/checkout-core',export:name,type:typeof bound[name],sameAsDirectPrivateExport:bound[name]===direct[name]};exportsProof.push(row);if(row.type!=='function'||!row.sameAsDirectPrivateExport)fail('ACTUAL_EXPORT_UNAVAILABLE',row);
 }
 for(const [specifier,name]of [['hono/cors','cors'],['hono/factory','createFactory']]){
  const mod=gatewayReq(specifier),row={specifier,export:name,type:typeof mod[name],resolved:gatewayReq.resolve(specifier)};exportsProof.push(row);if(row.type!=='function'||/\.d\.[cm]?ts$/.test(row.resolved))fail('ACTUAL_VENDOR_RUNTIME_EXPORT_UNAVAILABLE',row);
 }
 for(const path of ['./src/routes/checkout.ts','./src/index.ts'])try{const mod=gatewayReq(path);const row={specifier:path,export:'default',type:typeof mod.default,fetchType:typeof mod.default?.fetch,resolved:gatewayReq.resolve(path)};exportsProof.push(row);if(row.type!=='object'||row.fetchType!=='function')fail('ACTUAL_ROUTER_OR_WORKER_UNAVAILABLE',row);}catch(error){fail('ACTUAL_ROUTER_OR_WORKER_IMPORT_FAILURE',{path,error:String(error.stack||error)});}
}
const cachePaths=Object.keys(rootReq.cache||{}).filter(p=>/\.[cm]?[jt]sx?$/.test(p));
const loadedWorkspace=cachePaths.filter(p=>candidatePath(p)&&!p.includes('/node_modules/'));
const escapedWorkspace=cachePaths.filter(mainSourcePath);
const executedDeclarations=cachePaths.filter(p=>/\.d\.[cm]?ts$/.test(p));
if(escapedWorkspace.length)fail('LOADED_MAIN_SOURCE',{paths:escapedWorkspace});
if(executedDeclarations.length)fail('EXECUTED_DECLARATION_FILES',{paths:executedDeclarations});
if(fetchCalls)fail('UNEXPECTED_NETWORK',{fetchCalls});
const report={classification:'ACTUAL_RUNTIME_MODULE_ADMISSION_PREFLIGHT_NO_TEST_SUITE_OR_DATABASE',createdAt:new Date().toISOString(),candidate:root,node:process.version,
 loader:'candidate-local node --import tsx; no inherited NODE_PATH/NODE_OPTIONS/TSX_TSCONFIG_PATH; canonical package exports select actual runtime, not gateway declaration aliases',
 preflightSha256:hash(fileURLToPath(import.meta.url)),materializationSha256:hash(join(receipts,'materialization.json')),
 summary:{sourceFilesVerified:material.files.length,workspaceResolutions:workspace.length,externalResolutions:external.length,relativeResolutions:relativeEdges.length,actualExportChecks:exportsProof.length,loadedWorkspaceModules:loadedWorkspace.length,loadedMainSource:escapedWorkspace.length,executedDeclarations:executedDeclarations.length,fetchCalls,failures:failures.length},
 workspace,external,relativeEdges,exportsProof,loadedWorkspaceModules:loadedWorkspace.map(p=>({path:relative(root,p),sha256:hash(p)})),failures,
 admission:failures.length===0?'PASS_PREFLIGHT_ONLY_REVIEWER_NATIVE22_NEXT':'REFUSED_BEFORE_ANY_NATIVE_OR_DATABASE_START',nativeExecuted:false,databaseStarted:false,browser:false,providerCalls:0};
writeFileSync('/Volumes/Projects/LetBuyy/docs/implementation/niche-theme-programme/completion-2026-10-24/checkout-revision6-independent-preflight.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({classification:report.classification,summary:report.summary,admission:report.admission,failures:failures.slice(0,12)}));
if(failures.length)process.exitCode=1;
