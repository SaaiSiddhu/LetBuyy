// Focused source/actual-admission-helper checks only. The native test modules
// are parsed, never imported; no owned DB, HTTP, app or browser is started.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root=new URL('../../../../../',import.meta.url);
const {z}=createRequire(new URL('services/api-gateway/package.json',root).pathname)('zod');
const base='docs/implementation/threadline-2026-10-22/shared-group-durability/dependent-latest392/';
const read=path=>readFileSync(new URL(path,root),'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
const archive=JSON.parse(read(base+'historical-before-active-392/archive-manifest.json'));
const template=JSON.parse(read(base+'admission.template.actual-qualified392.json'));
const consumers=Object.keys(template.revisedSuitePins);
const actualNativePath='docs/implementation/niche-theme-programme/circuit-search392-native-admission.json';
const actualQualificationPath='docs/implementation/niche-themes-2026-10-23/circuit/discovery/search392/native-qualification.json';

function loader(path, admission=template, replacements={}) {
 const text=read(path),source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 assert.deepEqual(source.parseDiagnostics,[]);
 const declarations=[];
 for(const node of source.statements){
  if(ts.isFunctionDeclaration(node)&&node.name?.text==='qualified392Dependency')declarations.push(node.getText(source));
  if(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text==='record'))declarations.push(node.getText(source));
 }
 assert.equal(declarations.length,2);
 // Bind exactly this source module's URL when evaluating its extracted helper.
 // This does not change the source file or bypass its actual source hash check.
 const code=declarations.join('\n').replaceAll('import.meta.url','consumerModuleUrl');
 const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const readControlled=target=>target===base+'admission.json'?JSON.stringify(admission):Object.hasOwn(replacements,target)?replacements[target]:read(target);
 return new Function('assert','z','read','readFileSync','sha','sha256','consumerModuleUrl',js+';return qualified392Dependency;')
  (assert,z,readControlled,readFileSync,hash,hash,pathToFileURL(new URL(path,root).pathname).href);
}

test('31 historical snapshots and all old root/admission records remain byte-exact after only two active consumer edits',()=>{
 assert.equal(archive.fileCount,31);
 for(const row of archive.files){
  assert.equal(hash(read(row.archivePath)),row.sha256);
  if(!consumers.includes(row.originalPath))assert.equal(hash(read(row.originalPath)),row.sha256);
 }
 assert.equal(template.historicalSuitePins[consumers[0]],'d549131349081802288196440f21bf1f7387543da126a1e5460cc44117a6044c');
 assert.equal(template.historicalSuitePins[consumers[1]],'c162f341fae53183bb73606322ebb291e339700562cd5f499918dd8602376739');
});

test('actual392 receipt has no migration field and binds exact run8/0/0, qualification bytes and SQL body/pair',()=>{
 const native=JSON.parse(read(actualNativePath));assert.equal(Object.hasOwn(native,'migration'),false);
 assert.equal(native.status,'ROOT_NATIVE392_THROUGH391_QUALIFIED_SOURCE_AND_RAW_PROOFS_VERIFIED');
 assert.equal(native.runId,'3273631a2c5b');assert.equal(native.pass,8);assert.equal(native.fail,0);assert.equal(native.skip,0);
 assert.equal(hash(read(actualNativePath)),template.rootNativeReceiptSha256);
 assert.equal(native.qualification.path,actualQualificationPath);assert.equal(hash(read(actualQualificationPath)),template.rootQualificationSha256);
 assert.equal(template.rootQualificationSha256,'b44f4d9ad37798dcdca3c31ad30dfeb93bebbf60fd0c843274da18945d342aa2');
 assert.equal(hash(read(template.upPath)),template.upSha256);assert.equal(hash(read(template.downPath)),template.downSha256);
});

for(const path of consumers){
 const name=path.includes('theme-shared-groups')?'391':'promotion';
 test(name+': actual extracted helper accepts the real qualified392 schema and exact revised source',()=>{
  const result=loader(path)(path);
  assert.equal(result.admission.qualifiedRunId,'3273631a2c5b');
  assert.equal(hash(result.up),template.upSha256);assert.equal(hash(result.down),template.downSha256);
  assert.equal(hash(read(path)),template.revisedSuitePins[path]);
 });
 test(name+': controlled pending admission fails closed before and after root admits the real file',()=>{
  const pending={status:'AWAITING_QUALIFIED392_PAIR_AND_ROOT_ACTIVE_SOURCE_LEASE',scope:'Controlled negative fixture, never written to the actual admission.'};
  assert.throws(()=>loader(path,pending)(path));
 });
 test(name+': wrong source/pair/receipt/qualification/run and tampered proof bytes all refuse',()=>{
  for(const mutate of [
   a=>{a.upSha256='0'.repeat(64);},a=>{a.downSha256='0'.repeat(64);},
   a=>{a.rootNativeReceiptSha256='0'.repeat(64);},a=>{a.rootQualificationSha256='0'.repeat(64);},
   a=>{a.qualifiedRunId='000000000000';},a=>{a.rootNativeReceiptStatus='ROOT_ACCEPTED_FOR_OWNED_NATIVE_QUALIFICATION';},
   a=>{a.rootNativeReceiptPath='../foreign.json';},a=>{a.revisedSuitePins[path]='0'.repeat(64);},
  ]){const candidate=structuredClone(template);mutate(candidate);assert.throws(()=>loader(path,candidate)(path));}
  const forged=JSON.parse(read(actualNativePath));forged.pass=7;
  assert.throws(()=>loader(path,template,{[actualNativePath]:JSON.stringify(forged)})(path));
  const resultPath=JSON.parse(read(actualQualificationPath)).result.path;
  const skipped=JSON.parse(read(resultPath));skipped.skipped=1;
  assert.throws(()=>loader(path,template,{[resultPath]:JSON.stringify(skipped)})(path));
 });
 test(name+': every original child phase remains and dependency ordering preserves full native profile guards',()=>{
  const row=archive.files.find(x=>x.originalPath===path);assert(row);
  const old=read(row.archivePath),current=read(path);
  const phases=value=>[...value.matchAll(/await stage\('([^']+)'/g)].map(x=>x[1]);
  assert.deepEqual(phases(current),phases(old));assert.equal(phases(current).length,name==='391'?5:4);
  assert.equal((current.match(/^test\(/gm)||[]).length,(old.match(/^test\(/gm)||[]).length);
  assert(!/\.skip\(|\.todo\(/.test(current));assert(!current.includes('native.migration'));
  const body=current.slice(current.indexOf("test('"));
  if(name==='391'){
   assert(body.indexOf('owned.script(dependency392.down)')<body.indexOf('owned.script(down)'));
   assert(body.lastIndexOf('owned.script(dependency392.up)')>body.lastIndexOf('owned.script(up)'));
   assert(current.includes("assert.equal(admission.suiteSha256, 'd549131349081802288196440f21bf1f7387543da126a1e5460cc44117a6044c'"));
  }else{
   assert(body.indexOf('owned.script(dependency392.down)')<body.indexOf('owned.script(measurementDown)'));
   assert(body.indexOf('owned.script(measurementDown)')<body.indexOf('owned.scriptLarge(pair.down)'));
   assert(body.lastIndexOf('owned.script(dependency392.up)')>body.lastIndexOf('owned.script(measurementUp)'));
   assert(current.includes('assert.equal(fullEditor391Profile(), preservedEditor391Profile'));
  }
  for(const token of ["to_jsonb(p)-'prosrc'",'pg_depend','pg_shdepend','prosrc','entryDiscovery','dependent392Rows','assertActual392Emission'])assert(current.includes(token));
 });
 test(name+': unknown body guards precede the first dependency DDL and original phase count is unchanged',()=>{
  const current=read(path),body=current.slice(current.indexOf("test('"));
  const firstDdl=body.indexOf('owned.script(dependency392.down)');assert(firstDdl>0);
  for(const guard of name==='391'?["unknown editor body refuses before any DDL","unknown browse body refuses before any DDL"]:["unknown discovery state refuses before DDL","unknown editor body refuses before DDL"])
   assert(body.indexOf(guard)>0&&body.indexOf(guard)<firstDdl);
  assert(current.includes('search392Profile(), entryDiscovery'));
 });
}
