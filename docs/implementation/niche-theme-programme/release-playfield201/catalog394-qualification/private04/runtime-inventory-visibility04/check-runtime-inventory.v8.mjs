// Resolve-only independent runtime/type inventory audit. Never imports a native module or executes resolved code.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),candidate=resolve(here,'..'),i=JSON.parse(readFileSync(candidate+'/candidate-index.json','utf8')),main=i.mainRoot;
const ts=createRequire(main+'/package.json')('typescript'),sha=b=>createHash('sha256').update(b).digest('hex');
const config=ts.readConfigFile(main+'/services/api-gateway/tsconfig.json',ts.sys.readFile);assert(!config.error);const options=ts.parseJsonConfigFileContent(config.config,ts.sys,main+'/services/api-gateway').options;
const internal=abs=>abs.startsWith(main+'/')&&!abs.includes('/node_modules/');
export function checkInventory(inventory,graph){
 assert.equal(inventory.files.length,new Set(inventory.files.map(f=>f.path)).size);const pins=new Map(inventory.files.map(f=>[f.path,f.sha256]));
 for(const f of inventory.files){assert(!f.path.startsWith('/')&&!f.path.split('/').includes('..'));assert.equal(sha(readFileSync(join(main,f.path))),f.sha256,'Actual source hash mismatch: '+f.path);}
 const audited=[];
 for(const f of inventory.files){
  if(!/\.(?:[cm]?[jt]sx?)$/.test(f.path)||/\.d\.(?:ts|mts|cts)$/.test(f.path))continue;
  const source=ts.createSourceFile(f.path,readFileSync(join(main,f.path),'utf8'),ts.ScriptTarget.Latest,true);assert.equal(source.parseDiagnostics.length,0,f.path);
  function walk(n){
   let specifier;
   if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier))specifier=n.moduleSpecifier.text;
   else if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')&&n.arguments.length===1&&ts.isStringLiteral(n.arguments[0]))specifier=n.arguments[0].text;
   if(specifier&&/\.(?:mjs|cjs|js)$/.test(specifier)){
    const runtime=createRequire(join(main,f.path)).resolve(specifier),type=ts.resolveModuleName(specifier,join(main,f.path),options,ts.sys).resolvedModule?.resolvedFileName;
    assert(!/\.d\.(?:ts|mts|cts)$/.test(runtime),'A declaration cannot stand in for runtime');
    if(internal(runtime)){
     const target=relative(main,runtime);assert(pins.has(target),'Actual Node runtime implementation missing: '+f.path+' -> '+specifier+' -> '+target);assert.equal(pins.get(target),sha(readFileSync(runtime)));
     if(type&&internal(type)){const t=relative(main,type);assert(pins.has(t),'TypeScript declaration/source also required: '+t);}
     const row={from:f.path,line:source.getLineAndCharacterOfPosition(n.pos).line+1,specifier,runtimeTarget:target,typescriptTarget:type&&internal(type)?relative(main,type):type||null};
     audited.push(row);
    }
   }
   ts.forEachChild(n,walk);
  }
  walk(source);
 }
 const actual=(graph.runtimeAudit||[]).filter(x=>!x.external).map(({from,line,specifier,runtimeTarget,typescriptTarget})=>({from,line,specifier,runtimeTarget,typescriptTarget}));
 const sorted=a=>a.map(v=>JSON.stringify(v)).sort();assert.deepEqual(sorted(actual),sorted(audited),'Runtime audit must enumerate every actual literal JS edge; no omission or substitution');
 for(const name of ['executable-pg-fixture','owned-next-directory','supabase-faithful-bootstrap'])for(const extension of ['.mjs','.d.mts'])assert(pins.has('scripts/governance/'+name+extension),'Runtime+declaration explicit pin required: '+name+extension);
 const up=inventory.files.filter(f=>f.path.startsWith('database/supabase/migrations/')&&f.path.endsWith('.sql'));assert.equal(up.length,322);assert.equal(Math.max(...up.map(f=>Number(f.path.split('/').at(-1).match(/^\d+/)[0]))),393);assert(!inventory.files.some(f=>/^database\/supabase\/(?:migrations|rollback)\/394_/.test(f.path)));
 return{status:'PRIVATE_V8_RUNTIME_TYPE_SOURCE_CHECK_PASS_NOT_EXECUTION_ADMISSION',files:inventory.files.length,literalJavaScriptEdgesAudited:audited.length,actualRuntimeAndDeclarationsBound:true,allActualMainHashesExact:true,sourceMigrationCount:322,sourceMaximum:393,nodeVersion:process.version,resolvedModulesExecuted:false,nativeExecuted:false,MainMetadataChanged:false};
}
const calledAsProgram=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(calledAsProgram){
 const inventory=JSON.parse(readFileSync(process.argv[2]||here+'/source-input-closure.v8.json','utf8')),graph=JSON.parse(readFileSync(process.argv[3]||here+'/literal-import-graph.v8.json','utf8'));
 try{const out=checkInventory(inventory,graph);process.stdout.write(JSON.stringify(out)+'\n');if(process.argv[4])writeFileSync(process.argv[4],JSON.stringify(out,null,2)+'\n');}
 catch(error){process.stderr.write((error instanceof Error?error.stack:String(error))+'\n');process.exitCode=1;}
}
