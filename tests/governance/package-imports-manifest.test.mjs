import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const validator=fileURLToPath(new URL('../../scripts/validators/dependency-manifest-validator.mjs',import.meta.url));
function fixture(imports,dependencies={}){
 const root=mkdtempSync(join(tmpdir(),'letbuyy-package-imports-'));
 const write=(p,s)=>{const f=join(root,p);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,s);};
 write('services/api-gateway/package.json',JSON.stringify({name:'@letbuyy/api-gateway',imports,dependencies}));
 write('services/api-gateway/src/index.ts',"import {value} from '#runtime';");write('services/api-gateway/src/worker.ts','export const value=1;');
 write('tests/private.ts','export const value=2;');
 assert.equal(spawnSync('git',['init','-q'],{cwd:root}).status,0);
 return{root,run:()=>spawnSync(process.execPath,[validator],{cwd:root,encoding:'utf8',timeout:20_000}),close:()=>rmSync(root,{recursive:true,force:true})};
}
test('exact conditional imports validate owned local and declared external targets',()=>{
 const f=fixture({'#runtime':{workerd:'./src/worker.ts',default:'hash-wasm'}},{'hash-wasm':'4.12.0'});try{const r=f.run();assert.equal(r.status,0,r.stderr);}finally{f.close();}
});
for(const [name,imports,pattern]of [
 ['undeclared alias',{},/no resolvable exact/],
 ['undeclared external',{'#runtime':{workerd:'./src/worker.ts',default:'missing-lib'}},/undeclared dependency/],
 ['missing local',{'#runtime':'./src/missing.ts'},/missing or out-of-package/],
 ['traversal',{'#runtime':'./../../tests/private.ts'},/missing or out-of-package/],
 ['cycle',{'#runtime':'#next','#next':'#runtime'},/no resolvable exact/],
 ['missing conditional alias',{'#runtime':{workerd:'#missing',default:'node:crypto'}},/no resolvable exact/],
 ['conditional cycle',{'#runtime':{workerd:'#next',default:'node:crypto'},'#next':'#runtime'},/no resolvable exact/],
])test(`package imports refuse ${name}`,()=>{const f=fixture(imports);try{const r=f.run();assert.equal(r.status,1,r.stdout);assert.match(r.stderr,pattern);}finally{f.close();}});
test('an owned-looking symlink cannot turn a local alias into a root-test dependency',()=>{
 const f=fixture({'#runtime':'./src/escape.ts'});try{symlinkSync(join(f.root,'tests/private.ts'),join(f.root,'services/api-gateway/src/escape.ts'));const r=f.run();assert.equal(r.status,1);assert.match(r.stderr,/missing or out-of-package/);}finally{f.close();}
});
