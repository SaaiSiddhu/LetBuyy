// Independent recursive reconstruction from execution roots; no resolved module execution.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {dirname,resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkInventory} from './check-runtime-inventory.v6.mjs';
const here=dirname(fileURLToPath(import.meta.url)),index=JSON.parse(readFileSync(join(here,'../candidate-index.json'))),main=index.mainRoot;
export function checkCompleteInventory(inventory,graph){
const base=checkInventory(inventory,graph),pins=new Map(inventory.files.map(f=>[f.path,f.sha256]));
const sha=b=>createHash('sha256').update(b).digest('hex'),internal=p=>p.startsWith(main+'/')&&!p.includes('/node_modules/');
const ts=createRequire(join(main,'package.json'))('typescript'),cfg=ts.readConfigFile(join(main,'services/api-gateway/tsconfig.json'),ts.sys.readFile);
assert(!cfg.error);const options=ts.parseJsonConfigFileContent(cfg.config,ts.sys,join(main,'services/api-gateway')).options;
const queue=[index.suitePath,'scripts/governance/run-executable-suites.mjs','scripts/governance/test-suite-catalog.mjs'],visited=new Set(),edges=[],workspaceRuntime=[];
function required(path,traverse=true){assert(pins.has(path),'Missing actual recursive input: '+path);assert.equal(pins.get(path),sha(readFileSync(join(main,path))));if(traverse&&/\.(?:[cm]?[jt]sx?)$/.test(path)&&!/\.d\.(?:ts|mts|cts)$/.test(path)&&!visited.has(path)&&!queue.includes(path))queue.push(path);}
while(queue.length){
 const path=queue.shift();if(visited.has(path))continue;visited.add(path);required(path,false);
 const tree=ts.createSourceFile(path,readFileSync(join(main,path),'utf8'),ts.ScriptTarget.Latest,true);assert.equal(tree.parseDiagnostics.length,0,path);
 for(const reference of tree.referencedFiles){const target=relative(main,resolve(main,dirname(path),reference.fileName));edges.push({from:path,specifier:reference.fileName,to:target,kind:'literal-triple-slash-reference'});required(target,false);}
 function walk(node){let specifier,typeOnly=false;
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
   specifier=node.moduleSpecifier.text;typeOnly=Boolean(node.isTypeOnly||node.importClause?.isTypeOnly);
   const named=node.importClause?.namedBindings||node.exportClause;if(named?.elements?.length&&!node.importClause?.name&&named.elements.every(x=>x.isTypeOnly))typeOnly=true;
  }else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')){assert(node.arguments.length===1&&ts.isStringLiteral(node.arguments[0]),'Unreviewed nonliteral importer: '+path);specifier=node.arguments[0].text;}
  if(specifier&&!specifier.startsWith('node:')){
   const target=ts.resolveModuleName(specifier,join(main,path),options,ts.sys).resolvedModule?.resolvedFileName;
   if(/\.(?:mjs|cjs|js)$/.test(specifier)){const actual=createRequire(join(main,path)).resolve(specifier);assert(!/\.d\.(?:ts|mts|cts)$/.test(actual));if(internal(actual)){const p=relative(main,actual);edges.push({from:path,specifier,to:p,kind:'Node-tsx-runtime'});required(p);}}
   if(target&&internal(target)){const p=relative(main,target);assert(!p.startsWith('apps/'),'App runtime import');edges.push({from:path,specifier,to:p});required(p);}else assert(!specifier.startsWith('.')&&!specifier.startsWith('@letbuyy/'),'Unresolved internal module');
   if(!typeOnly&&specifier.startsWith('@letbuyy/')){const actual=createRequire(join(main,path)).resolve(specifier);assert(internal(actual),'Workspace runtime outside admitted source');assert(!/\.d\.(?:ts|mts|cts)$/.test(actual),'Workspace declaration cannot stand in for runtime');const p=relative(main,actual);required(p);workspaceRuntime.push({from:path,specifier,to:p});}
  }
  ts.forEachChild(node,walk);
 }walk(tree);
}
const sorted=a=>a.map(x=>JSON.stringify(x)).sort();assert.deepEqual([...visited].sort(),graph.runtimeModules,'Collector must traverse every data entry promoted to runtime');assert.deepEqual(sorted(edges),sorted(graph.edges),'Complete literal runtime/type graph must match independent reconstruction');
const result={...base,status:'COMPLETE_RECURSIVE_CURRENT_SOURCE_INVENTORY_PASS_NOT_NATIVE_QUALIFICATION',runtimeModules:visited.size,literalEdges:edges.length,workspaceRuntimeResolutions:workspaceRuntime.length,builderDataCannotSuppressRuntimeTraversal:true,nativeExecuted:false};
return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const inventory=JSON.parse(readFileSync(join(here,'source-input-closure.v6.json'))),graph=JSON.parse(readFileSync(join(here,'literal-import-graph.v6.json')));
 process.stdout.write(JSON.stringify(checkCompleteInventory(inventory,graph))+'\n');
}
