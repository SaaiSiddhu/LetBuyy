// Source/tool metadata only. Never imports discovered modules or starts a child.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync,realpathSync,readlinkSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname,relative,basename,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire,builtinModules} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {release,version as osVersion} from 'node:os';

export const root='/private/tmp/letbuyy-five-theme211-native-source-20261025-02';
export const here=dirname(fileURLToPath(import.meta.url));
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const closurePath=join(here,'native-source-closure.json');
const builtin=new Set(builtinModules.flatMap(x=>[x,x.replace(/^node:/,''),'node:'+x.replace(/^node:/,'')]));
const envDeclaration=name=>name.startsWith('.env')||name.includes('.env.')||name.endsWith('.env')||(/env/i.test(name)&&/(example|template)/i.test(name));
const packageName=specifier=>specifier.startsWith('@')?specifier.split('/').slice(0,2).join('/'):specifier.split('/')[0];
const sort=rows=>rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const req=createRequire(join(root,'package.json'));
// TypeScript is a pinned discovery tool; discovered application modules are never loaded.
const ts=req('typescript');

export function collect(){
 const closure=JSON.parse(readFileSync(closurePath,'utf8'));
 const files=new Map(),packages=new Map(),externalEdges=[],sourceEdges=[],missing=[],omitted=[],queue=[];
 const inside=p=>p===root||p.startsWith(root+'/');
 function file(path,kind){
  const lexical=resolve(path);assert(!envDeclaration(basename(lexical)),'Excluded environment dependency '+lexical);
  const actual=realpathSync(lexical);const bytes=readFileSync(actual),stat=lstatSync(lexical);
  const row={path:lexical,realPath:actual,sha256:sha(bytes),bytes:bytes.length,mode:stat.mode&0o777,linkTarget:stat.isSymbolicLink()?readlinkSync(lexical):null,kind};
  if(files.has(lexical))assert.equal(files.get(lexical).sha256,row.sha256,'Changed while inventorying '+lexical);
  else files.set(lexical,row);
  return row;
 }
 function workspaceMetadata(path){
  assert(inside(path)&&!path.includes('/node_modules/'),'Workspace containment '+path);
  file(path,'workspace');let directory=dirname(path);
  while(inside(directory)){
   const p=join(directory,'package.json');if(existsSync(p))file(p,'workspace-package-exports');
   if(directory===root)break;directory=dirname(directory);
  }
 }
 function packageRoot(path){
  let directory=lstatSync(path).isDirectory()?realpathSync(path):dirname(realpathSync(path));
  while(directory!==dirname(directory)){
   if(existsSync(join(directory,'package.json'))){
    const manifest=JSON.parse(readFileSync(join(directory,'package.json'),'utf8'));
    if(typeof manifest.name==='string'&&typeof manifest.version==='string')return directory;
   }
   directory=dirname(directory);
  }
  throw Error('No package manifest for '+path);
 }
 function addPackage(path,reason){
  const directory=packageRoot(path);
  if(inside(directory)&&!directory.includes('/node_modules/')){workspaceMetadata(join(directory,'package.json'));return;}
  assert(directory.includes('/node_modules/'),'Unreviewed external source '+directory);
  if(packages.has(directory)){packages.get(directory).reasons.add(reason);return;}
  const manifest=JSON.parse(readFileSync(join(directory,'package.json'),'utf8'));
  packages.set(directory,{root:directory,name:manifest.name,version:manifest.version,reasons:new Set([reason]),manifest});queue.push(directory);
 }
 function dependencyDirectory(name,from){
  let current=from;
  while(true){const p=join(current,'node_modules',name,'package.json');if(existsSync(p))return dirname(realpathSync(p));if(current===dirname(current))break;current=dirname(current);}
  return null;
 }
 const config=ts.readConfigFile(join(root,'services/api-gateway/tsconfig.json'),ts.sys.readFile);assert(!config.error);
 const options=ts.parseJsonConfigFileContent(config.config,ts.sys,join(root,'services/api-gateway')).options;
 for(const row of closure.files){const got=file(join(root,row.path),'workspace');assert.equal(got.sha256,row.sha256,row.path);workspaceMetadata(join(root,row.path));}
 for(const path of closure.runtimeModules){
  const from=join(root,path),source=ts.createSourceFile(path,readFileSync(from,'utf8'),ts.ScriptTarget.Latest,true);assert.equal(source.parseDiagnostics.length,0);
  function visit(node){
   let specifier,typeOnly=false;
   if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
    specifier=node.moduleSpecifier.text;typeOnly=Boolean(node.isTypeOnly||node.importClause?.isTypeOnly);
    const named=node.importClause?.namedBindings||node.exportClause;if(named?.elements?.length&&!node.importClause?.name&&named.elements.every(x=>x.isTypeOnly))typeOnly=true;
   }else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')){
    assert(node.arguments.length===1&&ts.isStringLiteral(node.arguments[0]),'Nonliteral import '+path);specifier=node.arguments[0].text;
   }
   if(specifier&&!specifier.startsWith('node:')&&!builtin.has(specifier)){
    const targets=[];
    const typed=ts.resolveModuleName(specifier,from,options,ts.sys).resolvedModule?.resolvedFileName;
    if(typed)targets.push({kind:'TypeScript',target:realpathSync(typed)});
    if(!typeOnly){targets.push({kind:'Node-require-tsx-export',target:realpathSync(createRequire(from).resolve(specifier))});const esm=import.meta.resolve(specifier,pathToFileURL(from).href);assert(esm.startsWith('file:'),'Nonfile ESM dependency '+specifier);targets.push({kind:'Node-ESM-tsx-export',target:realpathSync(fileURLToPath(esm))});}
    assert(targets.length,'Unresolved source import '+path+' -> '+specifier);
    for(const target of targets){
     const edge={from:path,specifier,...target};
     if(inside(target.target)&&!target.target.includes('/node_modules/')){workspaceMetadata(target.target);sourceEdges.push(edge);}
     else {addPackage(target.target,path+' -> '+specifier);externalEdges.push(edge);}
    }
   }
   ts.forEachChild(node,visit);
  }visit(source);
 }
 // The canonical runner invokes this exact .bin wrapper; pin it and its package.
 const tsxEntry=createRequire(join(root,'package.json')).resolve('tsx/cli');
 const tsxLoader=createRequire(join(root,'package.json')).resolve('tsx');
 addPackage(tsxEntry,'canonical runner tsx CLI');addPackage(req.resolve('typescript'),'source resolver tool');
 const tools=[file(process.execPath,'node-executable'),file('/opt/homebrew/bin/node','PATH-node-alias'),file(join(root,'node_modules/.bin/tsx'),'tsx-canonical-runner-entry'),file(tsxEntry,'tsx-actual-entry'),file(tsxLoader,'tsx-discovery-loader'),file('/usr/bin/env','tsx-entry-interpreter'),file('/Applications/Docker.app/Contents/Resources/bin/docker','future-docker-cli-not-executed')];
 // Parse Mach-O metadata as bytes. Homebrew's small node executable loads most
 // runtime code from libnode and other dylibs; hashing only bin/node is insufficient.
 const linkage=[],binaryVisited=new Set();
 function macho(path,inherited=[],executable=realpathSync(process.execPath)){
  const actual=realpathSync(path);if(binaryVisited.has(actual))return;binaryVisited.add(actual);
  const bytes=readFileSync(actual);let start=0;
  if([0xcafebabe,0xcafebabf].includes(bytes.readUInt32BE(0))){
   const wide=bytes.readUInt32BE(0)===0xcafebabf,stride=wide?32:20,cpu=process.arch==='arm64'?0x0100000c:0x01000007;
   let found=false;for(let i=0;i<bytes.readUInt32BE(4);i++){const at=8+i*stride;if(bytes.readUInt32BE(at)===cpu){start=wide?Number(bytes.readBigUInt64BE(at+8)):bytes.readUInt32BE(at+8);found=true;break;}}assert(found,'Tool lacks host architecture '+actual);
  }
  assert.equal(bytes.readUInt32LE(start),0xfeedfacf,'Expected64-bit Mach-O '+actual);
  let cursor=start+32;const dependencies=[],rpaths=[];
  const cstring=(offset,end)=>bytes.subarray(offset,end).toString('utf8').split('\0')[0];
  for(let i=0;i<bytes.readUInt32LE(start+16);i++){
   const command=bytes.readUInt32LE(cursor),size=bytes.readUInt32LE(cursor+4);assert(size>=8&&cursor+size<=bytes.length);
   if([0xc,0x80000018,0x8000001f,0x80000023].includes(command))dependencies.push(cstring(cursor+bytes.readUInt32LE(cursor+8),cursor+size));
   if(command===0x8000001c)rpaths.push(cstring(cursor+bytes.readUInt32LE(cursor+8),cursor+size));cursor+=size;
  }
  const expand=value=>value.replace(/^@loader_path(?=\/|$)/,dirname(actual)).replace(/^@executable_path(?=\/|$)/,dirname(executable));
  const search=[...rpaths.map(expand),...inherited];
  for(const dependency of dependencies){
   const candidates=dependency.startsWith('@rpath/')?search.map(r=>join(r,dependency.slice(7))):[expand(dependency)];
   const resolved=candidates.find(existsSync);
   if(!resolved){assert(dependency.startsWith('/usr/lib/')||dependency.startsWith('/System/Library/'),'Unresolved non-system dylib '+dependency);linkage.push({from:actual,dependency,systemDyldCache:true,systemBuildBound:true});continue;}
   file(resolved,'tool-linked-dylib');linkage.push({from:actual,dependency,target:realpathSync(resolved),systemDyldCache:false});macho(resolved,search,executable);
  }
 }
 for(const tool of tools.filter(x=>['node-executable','tsx-entry-interpreter','future-docker-cli-not-executed'].includes(x.kind)))macho(tool.path,[],tool.realPath);
 const systemBuild=file('/System/Library/CoreServices/SystemVersion.plist','host-system-build');
 while(queue.length){
  const directory=queue.shift(),entry=packages.get(directory),manifest=entry.manifest;
  function walk(current){
   for(const item of readdirSync(current,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const p=join(current,item.name);
    // Installed package-local .bin wrappers are real vendor content too.
    if(item.name==='.git')continue;
    if(envDeclaration(item.name)){const s=lstatSync(p);assert(s.isFile(),'Unexpected excluded declaration type');omitted.push({path:p,sha256:sha(readFileSync(p)),bytes:s.size,contentParsedOrDisplayed:false});continue;}
    if(item.isDirectory())walk(p);
    else if(item.isSymbolicLink()){
     const target=realpathSync(p);assert(target===directory||target.startsWith(directory+'/'),'External vendor symlink '+p);
     if(lstatSync(target).isFile())file(p,'vendor-internal-symlink');
    }else if(item.isFile())file(p,'vendor-package-content');
   }
  }walk(directory);
  const dependencies={...manifest.peerDependencies,...manifest.optionalDependencies,...manifest.dependencies};
  for(const [name,range] of Object.entries(dependencies).sort()){
   const target=dependencyDirectory(name,directory),optional=Boolean(manifest.optionalDependencies?.[name]||manifest.peerDependenciesMeta?.[name]?.optional);
   const kind=manifest.dependencies?.[name]?'dependency':manifest.optionalDependencies?.[name]?'optional':'peer';
   if(!target){missing.push({from:directory,name,range,kind,optional});assert(optional||kind==='peer','Missing required installed dependency '+manifest.name+' -> '+name);continue;}
   externalEdges.push({from:directory,specifier:name,kind,range,target});addPackage(target,manifest.name+' '+kind+' '+name);
  }
 }
 const links=[];
 function workspaceLinks(current){
  for(const item of readdirSync(current,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   if(['.habitat-native-preflight','.five211-native-preflight'].includes(item.name))continue;
   const p=join(current,item.name);
   if(item.isSymbolicLink())links.push({path:relative(root,p),target:readlinkSync(p),realPath:realpathSync(p)});
   else if(item.isDirectory())workspaceLinks(p);
   else if(item.isFile()&&!p.includes('/node_modules/')){
    if(envDeclaration(item.name)){omitted.push({path:p,sha256:sha(readFileSync(p)),bytes:lstatSync(p).size,contentParsedOrDisplayed:false});continue;}
    file(p,'additional-private-source-copy');
   }
  }
 }workspaceLinks(root);
 const migrations=closure.sqlSets['database/supabase/migrations'].filter(x=>x.endsWith('.sql')).map(path=>({name:basename(path),prefix:parseInt(basename(path),10),sha256:sha(readFileSync(join(root,path)))})).sort((a,b)=>a.prefix-b.prefix||a.name.localeCompare(b.name));
 assert.equal(migrations.length,322);assert.equal(Math.max(...migrations.map(x=>x.prefix)),393);
 for(const row of files.values())assert.equal(sha(readFileSync(row.path)),row.sha256,'Input changed after capture '+row.path);
 return {classification:'SOURCE_VENDOR_TOOL_CLOSURE_ONLY_NO_RESOURCE_OR_MODULE_EXECUTION',root,workspaceClosureSha256:sha(readFileSync(closurePath)),node:{execPath:process.execPath,realPath:realpathSync(process.execPath),version:process.version,versions:process.versions,platform:process.platform,arch:process.arch},host:{release:release(),version:osVersion(),systemBuild},toolLinkage:sort(linkage),files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)),workspaceLinks:links,packages:[...packages.values()].map(({manifest,reasons,...rest})=>({...rest,reasons:[...reasons].sort(),packageJsonSha256:sha(readFileSync(join(rest.root,'package.json')))})).sort((a,b)=>a.root.localeCompare(b.root)),tools,sourceResolutionEdges:sort(sourceEdges),externalResolutionEdges:sort(externalEdges),absentDeclaredDependencies:sort(missing),omittedEnvironmentDeclarations:sort(omitted),migrations:{count:322,maximum:393,ceiling:null,ordered:migrations,orderedSha256:sha(JSON.stringify(migrations)),orderSource:'scripts/governance/owned-database-provision.mjs:listMigrations'},nativeModuleEvaluation:false,childProcessesStarted:0,resourcesChecked:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const inventory=collect();writeFileSync(join(here,'SOURCE_VENDOR_TOOL_INVENTORY.json'),JSON.stringify(inventory,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'CAPTURED_SOURCE_ONLY',files:inventory.files.length,packages:inventory.packages.length,workspaceLinks:inventory.workspaceLinks.length,externalEdges:inventory.externalResolutionEdges.length,absentDependencies:inventory.absentDeclaredDependencies.length,envDeclarationsOmitted:inventory.omittedEnvironmentDeclarations.length,migrations:322,maximum:393,resourcesChecked:false}));
}
