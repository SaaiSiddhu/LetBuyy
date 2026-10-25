// Private read-only Main discovery; candidate/document writes only. No native import, process, DB, build or emission.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,relative,dirname,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),candidate=resolve(here,'..'),index=JSON.parse(readFileSync(candidate+'/candidate-index.json','utf8'));
const main=index.mainRoot,overlay=index.overlayRoot,ts=createRequire(main+'/package.json')('typescript');
const hash=b=>createHash('sha256').update(b).digest('hex'),files=new Map(),edges=[],external=new Set(),nonliteral=[],runtimeAudit=[],queue=[],visited=new Set();
function physical(path){const p=join(overlay,path);return existsSync(p)?p:join(main,path);}
function internal(abs){return abs.startsWith(main+'/')&&!abs.includes('/node_modules/');}
function fileExists(abs){return internal(abs)?existsSync(physical(relative(main,abs))):existsSync(abs);}
function readAbs(abs){if(!internal(abs))return existsSync(abs)?readFileSync(abs,'utf8'):undefined;const p=relative(main,abs),actual=physical(p);if(!existsSync(actual))return undefined;return readFileSync(actual,'utf8');}
function add(path,traverse=true){
 assert(!path.startsWith('/')&&!path.split('/').includes('..'),path);const actual=physical(path),bytes=readFileSync(actual),sha256=hash(bytes);
 if(files.has(path)){assert.equal(files.get(path).sha256,sha256,'Source moved during capture: '+path);if(traverse&&/\.(?:[cm]?[jt]sx?)$/.test(path)&&!/\.d\.(?:ts|mts|cts)$/.test(path)&&!visited.has(path)&&!queue.includes(path))queue.push(path);return;}
 const origin=actual.startsWith(overlay+'/')?'candidate-overlay':'Main-current393';files.set(path,{path,sha256,origin,actual});
 if(traverse&&/\.(?:[cm]?[jt]sx?)$/.test(path)&&!/\.d\.(?:ts|mts|cts)$/.test(path))queue.push(path);
}
for(const p of [index.suitePath,'scripts/governance/run-executable-suites.mjs','scripts/governance/test-suite-catalog.mjs','services/api-gateway/tsconfig.json','tsconfig.base.json','package.json','pnpm-lock.yaml','services/api-gateway/package.json','services/api-gateway/runtime.manifest.json'])add(p);
for(const p of readdirSync(join(main,index.proposalDirectory)))add(index.proposalDirectory+p,false);
const manifest=JSON.parse(readFileSync(physical(index.proposalDirectory+'manifest.json'),'utf8'));
for(const p of Object.keys(manifest.sourceHashes))add(p,false);
const archivePath='docs/implementation/niche-theme-programme/release-playfield201/catalog394-qualification/private03/frozen-builder-inputs.json';
add(archivePath,false);for(const row of JSON.parse(readFileSync(join(main,archivePath),'utf8')).files)add(row.archivePath,false);
for(const p of readdirSync(join(main,manifest.originalProposal.directory)))if(existsSync(join(main,manifest.originalProposal.directory,p)))add(manifest.originalProposal.directory+p,false);
add(manifest.previous.file,false);add('services/api-gateway/src/__tests__/owned-db/playfield201-promotion-qualification.manual.ts',false);
for(const p of ['docs/implementation/niche-theme-programme/playfield201-proposal-admission.json',manifest.publisher393Prerequisite.rootQualification,'docs/implementation/niche-theme-programme/release-playfield201/native-qualification/canonical-update-repair/source-release.json','docs/implementation/niche-theme-programme/release-playfield201/native-qualification/tenant-correction/source-release.json'])add(p,false);
for(const d of ['database/supabase/migrations','database/supabase/rollback','database/supabase/bootstrap','database/supabase/deploy']){
 if(!existsSync(join(main,d)))continue;
 for(const p of readdirSync(join(main,d),{recursive:true}))if(p.endsWith('.sql')||p.endsWith('.json'))add(join(d,p),false);
}
const cfg=ts.readConfigFile(join(main,'services/api-gateway/tsconfig.json'),ts.sys.readFile);assert(!cfg.error);
const options=ts.parseJsonConfigFileContent(cfg.config,ts.sys,join(main,'services/api-gateway')).options;
const resolver={fileExists,readFile:readAbs,directoryExists:ts.sys.directoryExists,getDirectories:ts.sys.getDirectories,realpath:ts.sys.realpath};
while(queue.length){
 const p=queue.shift();if(visited.has(p))continue;visited.add(p);const source=ts.createSourceFile(p,readFileSync(physical(p),'utf8'),ts.ScriptTarget.Latest,true);assert.equal(source.parseDiagnostics.length,0,p);
 for(const reference of source.referencedFiles){
  const target=relative(main,resolve(main,dirname(p),reference.fileName));assert(!target.startsWith('..'),'Reference outside Main');
  edges.push({from:p,specifier:reference.fileName,to:target,kind:'literal-triple-slash-reference'});add(target,false);
 }
 function walk(n){
  let specifier;
  if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier))specifier=n.moduleSpecifier.text;
  else if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')){
   if(n.arguments.length===1&&ts.isStringLiteral(n.arguments[0]))specifier=n.arguments[0].text;
   else nonliteral.push({path:p,line:source.getLineAndCharacterOfPosition(n.pos).line+1,expression:n.getText(source).slice(0,180)});
  }
  if(specifier&&!specifier.startsWith('node:')){
   const result=ts.resolveModuleName(specifier,join(main,p),options,resolver).resolvedModule?.resolvedFileName;
   if(/\.(?:mjs|cjs|js)$/.test(specifier)){
    const runtime=createRequire(join(main,p)).resolve(specifier);
    assert(!/\.d\.(?:ts|mts|cts)$/.test(runtime),'Node resolved a declaration as runtime: '+specifier);
    if(internal(runtime)){
     const target=relative(main,runtime);assert(!target.startsWith('apps/'),'Runtime app import forbidden');
     add(target);edges.push({from:p,specifier,to:target,kind:'Node-tsx-runtime'});
     const direct=specifier.startsWith('.')?resolve(main,dirname(p),specifier):null;
     if(direct&&existsSync(direct))assert.equal(resolve(runtime),direct,'Existing exact JavaScript extension must execute that file');
     runtimeAudit.push({from:p,line:source.getLineAndCharacterOfPosition(n.pos).line+1,specifier,runtimeTarget:target,runtimeSha256:hash(readFileSync(runtime)),typescriptTarget:result&&internal(result)?relative(main,result):result||null,typescriptDeclaration:!!result&&/\.d\.(?:ts|mts|cts)$/.test(result),resolution:'Actual Node createRequire(importer).resolve under --import tsx; resolution only, no module execution'});
    }else{external.add(specifier);runtimeAudit.push({from:p,line:source.getLineAndCharacterOfPosition(n.pos).line+1,specifier,external:true,runtimeNodePath:runtime,boundBy:'package manifests+pnpm lock'});}
   }
   if(result&&internal(result)){
    const target=relative(main,result);assert(!target.startsWith('apps/'),'Application runtime import forbidden: '+p+' -> '+target);edges.push({from:p,specifier,to:target});add(target);
   }else{assert(!specifier.startsWith('.')&&!specifier.startsWith('@letbuyy/'),'Unresolved internal: '+p+' -> '+specifier);external.add(specifier);}
  }
  ts.forEachChild(n,walk);
 }
 walk(source);
 if(p.startsWith('packages/')){let dir=dirname(p);while(dir.startsWith('packages/')){const manifest=join(dir,'package.json');if(existsSync(join(main,manifest))){add(manifest,false);break;}dir=dirname(dir);}}
}
assert.equal(nonliteral.length,0,'Nonliteral module edges require explicit review');
const migrations=[...files.keys()].filter(p=>p.startsWith('database/supabase/migrations/')&&p.endsWith('.sql'));assert.equal(migrations.length,322);assert.equal(Math.max(...migrations.map(p=>Number(p.split('/').at(-1).match(/^\d+/)[0]))),393);
assert(![...files.keys()].some(p=>/^database\/supabase\/(?:migrations|rollback)\/394_/.test(p)));
for(const f of files.values()){
 assert.equal(hash(readFileSync(f.actual)),f.sha256,'Input changed after discovery: '+f.path);
 const dest=join(here,'inputs',f.origin==='candidate-overlay'?'candidate-overlay':'Main-current393',f.path);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,readFileSync(f.actual));
}
const closure={status:'PRIVATE394_RUNTIME_AND_DECLARATION_INVENTORY_V4_NOT_ROOT_ADMISSION_NOT_NATIVE_QUALIFICATION',suitePath:index.suitePath,sourceMigrationMaximum:393,sourceMigrationCount:322,migrationCeiling:null,candidateMigration:394,candidateOutsideMigrationScan:true,discovery:'V4: every literal.mjs/.cjs/.js edge uses actual Node/tsx runtime resolution PLUS TypeScript declaration resolution, recursively capturing actual runtime source. Complete literal TypeScript import/export/require closure from candidate manual as its future Main-relative path, resolved only against current393 Main after exactsourceapply;61 immutable factory pins and old five catalog artifacts included as data;all currentUP/DOWN/bootstrap/provider-fence SQL and runner/package/lock included. Explicitly admitted Maincheckout08 and sharedsuccessors included; old frozen61builder data separately archived. No runtime/DB execution.',files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)).map(({path,sha256})=>({path,sha256})),nativeExecuted:false};
const bytes=JSON.stringify(closure,null,2)+'\n';
writeFileSync(join(here,'source-input-closure.v4.json'),bytes);
writeFileSync(join(here,'literal-import-graph.v4.json'),JSON.stringify({suitePath:index.suitePath,runtimeModules:[...visited].sort(),edges,runtimeAudit,thirdPartyModuleSpecifiers:[...external].sort(),nonliteralImports:nonliteral,unresolvedInternal:0,applicationImports:0},null,2)+'\n');
writeFileSync(join(here,'input-materialization.v4.json'),JSON.stringify({mainRoot:main,privateRoot:here,files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path))},null,2)+'\n');
writeFileSync(join(here,'capture-receipt.v4.json'),JSON.stringify({status:closure.status,files:files.size,literalEdges:edges.length,literalJsRuntimeEdgesAudited:runtimeAudit.length,nonliteral:nonliteral.length,sourceMigrationCount:322,maximum:393,closureSha256:hash(bytes),beforeAfterDiscoveryExact:true,noMainWrites:true,noNativeOrBuild:true},null,2)+'\n');
process.stdout.write(JSON.stringify({files:files.size,literalEdges:edges.length,nonliteral:0,closureSha256:hash(bytes),sourceMigrationCount:322,maximum:393})+'\n');
