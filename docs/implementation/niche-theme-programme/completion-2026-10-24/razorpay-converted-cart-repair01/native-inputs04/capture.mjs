// Read-only recursive source discovery. Does not import discovered modules or
// runner, execute a build, read environment files, or contact a database.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = process.cwd(), here = dirname(fileURLToPath(import.meta.url));
const suite = 'services/api-gateway/src/__tests__/owned-db/hosted-checkout-buyer-ownership.postgres.test.ts';
const base = 'docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const internal = path => path.startsWith(root + '/') && !path.includes('/node_modules/');
const config = ts.readConfigFile(resolve(root,'services/api-gateway/tsconfig.json'),ts.sys.readFile);assert.ok(!config.error);
const options = ts.parseJsonConfigFileContent(config.config,ts.sys,resolve(root,'services/api-gateway')).options;
const dataPaths = ['services/api-gateway/src/__tests__/hosted-checkout-confirmation.test.ts'];
export function discover() {
  const files=new Map(),queue=[],visited=new Set(),edges=[],external=new Set();
  function add(path,traverse=true) {
    assert(!path.startsWith('/')&&!path.split('/').includes('..'));
    const bytes=readFileSync(resolve(root,path)),digest=sha(bytes);
    if(files.has(path))assert.equal(files.get(path).sha256,digest,'Source changed during discovery: '+path);
    else files.set(path,{path,sha256:digest,bytes:bytes.length});
    // Data admission cannot suppress later traversal as a real runtime input.
    if(traverse&&/\.(?:[cm]?[jt]sx?)$/.test(path)&&!/\.d\.(?:ts|mts|cts)$/.test(path)&&!visited.has(path)&&!queue.includes(path))queue.push(path);
  }
  for(const path of dataPaths)add(path,false);
  for(const path of [suite,'scripts/governance/run-executable-suites.mjs','scripts/governance/test-suite-catalog.mjs'])add(path);
  for(const path of ['package.json','pnpm-lock.yaml','tsconfig.base.json','services/api-gateway/tsconfig.json','services/api-gateway/package.json','services/api-gateway/runtime.manifest.json'])add(path,false);
  const sqlSets={};
  for(const dir of ['database/supabase/migrations','database/supabase/rollback','database/supabase/bootstrap','database/supabase/deploy']){
    const paths=existsSync(resolve(root,dir))?readdirSync(resolve(root,dir),{recursive:true}).filter(path=>/\.(sql|json)$/.test(path)).map(path=>dir+'/'+path).sort():[];
    sqlSets[dir]=paths;for(const path of paths)add(path,false);
  }
  while(queue.length){
    const path=queue.shift();if(visited.has(path))continue;visited.add(path);
    const text=readFileSync(resolve(root,path),'utf8'),source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);assert.equal(source.parseDiagnostics.length,0,path);
    for(const reference of source.referencedFiles){const target=relative(root,resolve(root,dirname(path),reference.fileName));add(target,false);edges.push({from:path,specifier:reference.fileName,to:target,kind:'declaration-reference'});}
    function visit(node){
      let specifier,typeOnly=false;
      if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
        specifier=node.moduleSpecifier.text;typeOnly=Boolean(node.isTypeOnly||node.importClause?.isTypeOnly);
        const named=node.importClause?.namedBindings||node.exportClause;
        if(named?.elements?.length&&!node.importClause?.name&&named.elements.every(e=>e.isTypeOnly))typeOnly=true;
      }else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')){
        assert(node.arguments.length===1&&ts.isStringLiteral(node.arguments[0]),'Nonliteral import needs explicit review: '+path);specifier=node.arguments[0].text;
      }
      if(specifier&&!specifier.startsWith('node:')){
        const typed=ts.resolveModuleName(specifier,resolve(root,path),options,ts.sys).resolvedModule?.resolvedFileName;
        if(typed&&internal(typed)){const target=relative(root,typed);assert(!target.startsWith('apps/'),'App runtime import forbidden');add(target);edges.push({from:path,specifier,to:target,kind:'TypeScript'});}
        else {assert(!specifier.startsWith('.')&&!specifier.startsWith('@letbuyy/'),'Unresolved internal import '+path+' -> '+specifier);external.add(specifier);}
        if(!typeOnly){
          const runtime=createRequire(resolve(root,path)).resolve(specifier);
          if(internal(runtime)){
            assert(!/\.d\.(ts|mts|cts)$/.test(runtime),'Declaration cannot stand in for actual runtime');
            const target=relative(root,runtime);assert(!target.startsWith('apps/'),'App runtime import forbidden');add(target);edges.push({from:path,specifier,to:target,kind:'Node-tsx-runtime'});
          }else external.add(specifier);
        }
      }
      ts.forEachChild(node,visit);
    }
    visit(source);
    if(path.startsWith('packages/')){let dir=dirname(path);while(dir.startsWith('packages/')){const manifest=join(dir,'package.json');if(existsSync(resolve(root,manifest))){add(manifest,false);break;}dir=dirname(dir);}}
  }
  for(const file of files.values())assert.equal(sha(readFileSync(resolve(root,file.path))),file.sha256,'Source changed after discovery: '+file.path);
  const migrations=sqlSets['database/supabase/migrations'].filter(path=>path.endsWith('.sql'));
  return {classification:'CURRENT_MAIN_RECURSIVE_SOURCE_INVENTORY_PREPARED_NOT_NATIVE_ADMISSION',suitePath:suite,entryPoints:[suite,'scripts/governance/run-executable-suites.mjs','scripts/governance/test-suite-catalog.mjs'],files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)),runtimeModules:[...visited].sort(),edges,thirdPartySpecifiers:[...external].sort(),sqlSets,migrationCount:migrations.length,migrationMaximum:Math.max(...migrations.map(path=>Number(path.split('/').at(-1).match(/^\d+/)[0]))),migrationCeiling:null,discoveredModulesExecuted:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const closure=discover();writeFileSync(resolve(here,'source-closure.json'),JSON.stringify(closure,null,2)+'\n',{flag:'wx'});
 process.stdout.write(JSON.stringify({files:closure.files.length,runtimeModules:closure.runtimeModules.length,edges:closure.edges.length,migrationCount:closure.migrationCount,migrationMaximum:closure.migrationMaximum,nativeExecuted:false})+'\n');
}
