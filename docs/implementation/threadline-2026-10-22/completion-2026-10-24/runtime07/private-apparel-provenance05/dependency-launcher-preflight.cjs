// Canonical launcher metadata/control only. No app, Worker, test suite or runner import.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const digest=file=>hash(fs.readFileSync(file));
function chain(file){
 const seen=new Set(),links=[];let current=path.resolve(file);
 for(let n=0;n<32;n++){
  assert(!seen.has(current),'Launcher symlink cycle');seen.add(current);const stat=fs.lstatSync(current);
  if(!stat.isSymbolicLink())return{realpath:fs.realpathSync(current),links,stat};
  const raw=fs.readlinkSync(current),next=path.resolve(path.dirname(current),raw);links.push({path:current,target:raw,resolved:next});current=next;
 }
 throw Error('Launcher symlink chain too deep');
}
function ancestors(file){
 let current=path.dirname(path.resolve(file));const result=[];
 while(true){const stat=fs.lstatSync(current);assert(stat.isDirectory()&&!stat.isSymbolicLink(),'Launcher ancestor must be a real directory');assert.equal(fs.realpathSync(current),current);result.push(current);const parent=path.dirname(current);if(parent===current)break;current=parent;}
 return result;
}
function executable(file){const resolved=chain(file);assert(resolved.stat.isFile(),'Launcher must resolve to a regular file');assert(resolved.stat.mode&0o111,'Launcher is not executable');assert.equal(resolved.stat.mode&0o022,0,'Launcher must not be group/world writable');fs.accessSync(file,fs.constants.X_OK);ancestors(resolved.realpath);return resolved;}
function nodeFromPath(value){for(const dir of String(value||'').split(path.delimiter)){if(!path.isAbsolute(dir))continue;const candidate=path.join(dir,'node');try{fs.accessSync(candidate,fs.constants.X_OK);return candidate;}catch{}}throw Error('No canonical Node on explicit OS PATH');}
function verifyLauncher(root,policy,options={}){
 root=path.resolve(root);assert.equal(root,fs.realpathSync(root));assert.equal(policy.version,1);assert.equal(policy.root,root);
 for(const dir of [root,path.join(root,'node_modules'),path.join(root,'node_modules/.bin')]){const stat=fs.lstatSync(dir);assert(stat.isDirectory()&&!stat.isSymbolicLink(),'Native launcher ancestors must be real directories');assert.equal(stat.uid,process.getuid());assert.equal(stat.mode&0o022,0);assert.equal(fs.realpathSync(dir),dir);}
 const selected=path.join(root,'node_modules/.bin/tsx');assert.equal(policy.launcher.path,selected,'No alternate launcher path');ancestors(selected);
 const cli=executable(selected);assert.equal(cli.realpath,policy.launcher.realpath,'Wrong launcher target');assert.deepEqual(cli.links,policy.launcher.links,'Changed launcher chain');assert.equal(digest(cli.realpath),policy.launcher.sha256,'Changed launcher bytes');assert.equal(cli.stat.mode&0o777,policy.launcher.mode);
 const node=executable(policy.node.path);assert.equal(node.realpath,policy.node.realpath);assert.equal(digest(node.realpath),policy.node.sha256,'Changed Node bytes');
 if(options.processExecPath!==false){assert.equal(fs.realpathSync(options.processExecPath||process.execPath),policy.node.realpath,'Wrong running Node');assert.equal(fs.realpathSync(nodeFromPath(options.pathValue??process.env.PATH)),policy.node.realpath,'CLI shebang would select a different Node');}
 for(const pin of policy.vendorPins){assert(path.isAbsolute(pin.path)&&pin.path.includes('/node_modules/'));assert.equal(digest(pin.path),pin.sha256,'Changed launcher vendor input');}
 const smoke=path.join(root,'dependency-launcher-smoke.ts');assert.equal(digest(smoke),policy.smokeSha256,'Changed harmless smoke');
 return{status:'CANONICAL_NATIVE_LAUNCHER_METADATA_PASS',root,selected,launcherRealpath:cli.realpath,launcherSha256:policy.launcher.sha256,nodeRealpath:node.realpath,nodeSha256:policy.node.sha256,vendorPins:policy.vendorPins.length};
}
function readPolicy(root,expected){assert.match(expected,/^[a-f0-9]{64}$/);const file=path.join(root,'dependency-launcher-provenance.json');assert.equal(digest(file),expected,'Launcher policy pin mismatch');return JSON.parse(fs.readFileSync(file,'utf8'));}
function main(){
 const argv=process.argv.slice(2),arg=name=>argv[argv.indexOf(name)+1];assert(argv.includes('--root')&&argv.includes('--policy-sha'));const root=path.resolve(arg('--root'));assert.equal(root,__dirname);const policy=readPolicy(root,arg('--policy-sha')),proof=verifyLauncher(root,policy);
 const result={...proof,checkedAt:new Date().toISOString(),applicationModulesExecuted:false,nativeStarts:0,databaseActions:0,providerCalls:0};
 if(argv.includes('--smoke')){
  const {spawnSync}=require('node:child_process'),env={TSX_DISABLE_CACHE:'1'};for(const name of ['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL'])if(process.env[name])env[name]=process.env[name];
  result.commands=[];
  for(const args of [['--version'],[path.join(root,'dependency-launcher-smoke.ts')]]){verifyLauncher(root,policy);const run=spawnSync(proof.selected,args,{cwd:root,env,encoding:'utf8',timeout:10000,maxBuffer:65536});result.commands.push({argv:[proof.selected,...args],terminal:run.status,stdout:run.stdout,stderr:run.stderr});assert.equal(run.status,0,'Canonical CLI/smoke failed');}
  assert(result.commands[0].stdout.includes('tsx v'+policy.tsxVersion));assert(result.commands[1].stdout.includes('DEPENDENCY_ONLY_TS_SMOKE_PASS'));
 }
 const out=arg('--out');if(out){assert.equal(path.dirname(path.resolve(out)),path.join(root,'preparation-evidence'));fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});}console.log(JSON.stringify(result));
}
module.exports={chain,ancestors,executable,verifyLauncher,readPolicy};if(require.main===module)main();
