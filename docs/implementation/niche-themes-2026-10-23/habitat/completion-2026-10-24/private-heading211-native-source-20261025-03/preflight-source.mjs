// Standalone terminal source check. No child processes, application imports,
// image checks or resources. Invoke using the explicitly pinned Node/tsx tool.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,realpathSync,accessSync,constants} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {collect,sha,root,here} from './inventory.mjs';

const admission=join(root,'docs/implementation/niche-theme-programme/completion-2026-10-24/order-heading211-integration01/NATIVE_ADMISSION.json');
export function verifyInventory(expected,actual){
 assert.equal(expected.root,root);assert.equal(expected.classification,'SOURCE_VENDOR_TOOL_CLOSURE_ONLY_NO_RESOURCE_OR_MODULE_EXECUTION');
 assert.equal(expected.nativeModuleEvaluation,false);assert.equal(expected.childProcessesStarted,0);assert.equal(expected.resourcesChecked,false);
 assert.equal(expected.migrations.count,322);assert.equal(expected.migrations.maximum,393);assert.equal(expected.migrations.ceiling,null);
 assert(expected.packages.length>50&&expected.files.length>7000,'Full vendor inventory required');
 assert(expected.packages.every(p=>p.name&&p.version),'Nested type-only package manifests cannot replace the actual installed package root');
 assert(expected.absentDeclaredDependencies.every(p=>p.optional),'No missing required dependency or required peer may be admitted');
 assert(expected.packages.some(p=>p.name==='@esbuild/darwin-arm64'),'Actual host esbuild binary must be pinned');
 assert(expected.toolLinkage.some(p=>p.dependency.includes('libnode.')&&p.target),'Actual Node runtime dylib required');
 assert.deepEqual(expected,actual,'Complete source/vendor/tool/exports/link/host/migration inventories must match');
}
export function verifySource({negativeControls=false}={}){
 const expected=JSON.parse(readFileSync(join(here,'SOURCE_VENDOR_TOOL_INVENTORY.json'),'utf8'));
 const manifest=JSON.parse(readFileSync(join(here,'PREFLIGHT_SCRIPT_MANIFEST.json'),'utf8'));
 for(const file of manifest.files)assert.equal(sha(readFileSync(join(here,file.path))),file.sha256,'Preflight artifact '+file.path);
 const injected=Object.keys(process.env).filter(k=>/^DYLD_|^NODE_(OPTIONS|PATH)$|^TSX_|^ESBUILD_BINARY_PATH$/.test(k));
 assert.deepEqual(injected,[],'Unadmitted tool configuration keys present; values intentionally never read/output');
 assert(!existsSync(admission),'No actual native admission may exist during this source-preflight stage');
 for(const row of expected.omittedEnvironmentDeclarations)assert(!row.path.startsWith(root+'/'),'Excluded environment declarations must not be copied into private source');
 const resolveCommand=name=>{
  for(const directory of (process.env.PATH||'').split(':')){
   const p=join(directory,name);try{accessSync(p,constants.X_OK);return realpathSync(p);}catch{}
  }throw Error('Tool missing from PATH: '+name);
 };
 assert.equal(resolveCommand('node'),expected.node.realPath,'Actual child Node PATH binding');
 assert.equal(resolveCommand('docker'),expected.tools.find(x=>x.kind==='future-docker-cli-not-executed').realPath,'Actual future Docker CLI PATH binding');
 const actual=collect();verifyInventory(expected,actual);
 const refusals=[];
 if(negativeControls){
  const controls={
   missingVendor:x=>x.files.splice(x.files.findIndex(f=>f.kind==='vendor-package-content'),1),
   corruptTool:x=>{x.tools[0].sha256='0'.repeat(64);},
   missingNodeDylib:x=>{x.toolLinkage=x.toolLinkage.filter(f=>!f.dependency.includes('libnode.'));},
   foreignWorkspaceLink:x=>{x.workspaceLinks[0].realPath='/unadmitted/foreign-source';},
   missingExportEdge:x=>{x.externalResolutionEdges.pop();},
   changedPackage:x=>{x.packages[0].version='0.0.0-unadmitted';},
   missingWorkspace:x=>{x.files.splice(x.files.findIndex(f=>f.kind==='workspace'),1);},
   changedMigrationOrder:x=>{[x.migrations.ordered[0],x.migrations.ordered[1]]=[x.migrations.ordered[1],x.migrations.ordered[0]];},
   excludedDependency:x=>{x.files.push({path:root+'/.env.example',sha256:'0'.repeat(64)});},
   absentHostBinary:x=>{x.packages=x.packages.filter(p=>p.name!=='@esbuild/darwin-arm64');},
  };
  for(const [name,mutate] of Object.entries(controls)){const altered=structuredClone(expected);mutate(altered);assert.throws(()=>verifyInventory(altered,actual),name);refusals.push(name);}
 }
 return {status:'SOURCE_PREFLIGHT_PASS_RESOURCES_NOT_CHECKED',inventorySha256:sha(readFileSync(join(here,'SOURCE_VENDOR_TOOL_INVENTORY.json'))),files:actual.files.length,packages:actual.packages.length,workspaceLinks:actual.workspaceLinks.length,toolDylibEdges:actual.toolLinkage.length,negativeInventoryControls:refusals,migrations:{count:322,maximum:393,ceiling:null,orderedSha256:actual.migrations.orderedSha256},nativeAdmissionAbsent:true,applicationModulesEvaluated:false,childProcesses:0,nativeExecuted:false,resourcesChecked:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifySource({negativeControls:process.argv.includes('--negative-controls')})));
