// Static resolution only: this never evaluates a project/application module,
// imports a test, invokes the canonical runner, or contacts any service.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
const main='/Volumes/Projects/LetBuyy',ts=Module.createRequire(main+'/package.json')('typescript');
const own=__dirname,hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const builtins=new Set(Module.builtinModules.flatMap(x=>[x,x.replace(/^node:/,''),'node:'+x.replace(/^node:/,'')]));
const originalTS=Module._extensions['.ts'],originalTSX=Module._extensions['.tsx'];
Module._extensions['.ts']=()=>{throw Error('Static closure forbids module evaluation');};Module._extensions['.tsx']=Module._extensions['.ts'];
const reports=[];
for(const label of ['red','green']){
 const manifest=JSON.parse(fs.readFileSync(path.join(own,label+'-materialization.json'),'utf8')),root=manifest.root,allowed=new Map(manifest.files.map(r=>[r.path,r.sha256]));
 const queue=['scripts/governance/run-executable-suites.mjs','services/api-gateway/src/__tests__/owned-db/hosted-checkout-capture-proof-qualification.manual.ts','services/api-gateway/src/index.ts'],seen=new Set(),edges=[],dynamic=[],failures=[],metadata=new Map();
 function resolve(from,spec){
  if(builtins.has(spec)||Module.isBuiltin(spec))return{kind:'NODE_BUILTIN',path:spec};
  const req=Module.createRequire(from);let resolved;
  try{resolved=req.resolve(spec);}catch(error){
   if(spec.startsWith('.')){
    const base=path.resolve(path.dirname(from),spec),candidates=[base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx')];
    if(/\.[cm]?js$/.test(base))candidates.push(base.replace(/\.[cm]?js$/,'.ts'),base.replace(/\.[cm]?js$/,'.mts'),base.replace(/\.[cm]?js$/,'.cts'));
    resolved=candidates.find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
   }
   if(!resolved)throw error;
  }
  resolved=fs.realpathSync(resolved);
  if(resolved.startsWith(root+'/'))return{kind:'PRIVATE_SOURCE',path:path.relative(root,resolved),sha256:hash(resolved)};
  if(resolved.startsWith(main+'/node_modules/.pnpm/'))return{kind:'PINNED_VENDOR_ENTRY_FULL_STORE_CLOSED',path:resolved,sha256:hash(resolved)};
  throw Error('Unclosed runtime resolution: '+resolved);
 }
 while(queue.length){
  const rel=queue.pop();if(seen.has(rel))continue;seen.add(rel);
  const absolute=path.join(root,rel);if(!allowed.has(rel)||!fs.existsSync(absolute)){failures.push({file:rel,reason:'Unmanifested static source input'});continue;}
  if(hash(absolute)!==allowed.get(rel)){failures.push({file:rel,reason:'Source hash mismatch'});continue;}
  const text=fs.readFileSync(absolute,'utf8');if(!/\.[cm]?[jt]sx?$/.test(rel))continue;
  const ast=ts.createSourceFile(absolute,text,ts.ScriptTarget.Latest,true);
  function add(spec,typeOnly,form){
   if(typeOnly){edges.push({from:rel,specifier:spec,typeOnly:true,form});return;}
   try{const r=resolve(absolute,spec);edges.push({from:rel,specifier:spec,typeOnly:false,form,...r});if(r.kind==='PRIVATE_SOURCE'){
    if(/\.d\.[cm]?ts$/.test(r.path))throw Error('Runtime declaration entry '+r.path);
    if(!allowed.has(r.path))throw Error('Missing private transitive source '+r.path);
    queue.push(r.path);
   }}catch(error){failures.push({from:rel,specifier:spec,form,reason:String(error.message)});}
  }
  function visit(node){
   if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){
    if(node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
     const c=node.importClause,typeOnly=Boolean(node.isTypeOnly||c?.isTypeOnly||(c?.namedBindings&&ts.isNamedImports(c.namedBindings)&&!c.name&&c.namedBindings.elements.length&&c.namedBindings.elements.every(e=>e.isTypeOnly)));
     add(node.moduleSpecifier.text,typeOnly,ts.isImportDeclaration(node)?'import':'export');
    }
   }else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require'))){
    const arg=node.arguments[0];if(arg&&ts.isStringLiteralLike(arg))add(arg.text,false,'literal-runtime-load');else dynamic.push({from:rel,expression:node.getText(ast).slice(0,200),closure:'Full candidate source universe +complete installed vendor store; actual loaded-file admission required in separately activated preflight.'});
   }
   ts.forEachChild(node,visit);
  }
  visit(ast);
  let dir=path.dirname(absolute);
  while(dir.startsWith(root)){
   for(const file of ['package.json','runtime.manifest.json','tsconfig.json']){const candidate=path.join(dir,file);if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile())metadata.set(path.relative(root,candidate),hash(candidate));}
   if(dir===root)break;dir=path.dirname(dir);
  }
 }
 reports.push({label,root,classification:'STATIC_RECURSIVE_FIRST_PARTY_NODE_EXPORT_RESOLUTION_NOT_APPLICATION_RUNTIME_PREFLIGHT',sourceFilesSeen:seen.size,edges,dynamicLoads:dynamic,metadata:[...metadata].map(([file,sha256])=>({file,sha256})),failures});
 console.log(JSON.stringify({label,firstPartyFiles:seen.size,edges:edges.length,dynamicLoads:dynamic.length,failures:failures.length}));
}
Module._extensions['.ts']=originalTS;Module._extensions['.tsx']=originalTSX;
fs.writeFileSync(path.join(own,'STATIC_RESOLUTION_CLOSURE.json'),JSON.stringify({reports,applicationModulesEvaluated:0,runnerExecuted:false,nativeExecuted:false},null,2)+'\n');
if(reports.some(r=>r.failures.length))process.exitCode=1;
