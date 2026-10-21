import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const script='scripts/liquid-parity/build-letbuyy-core-bundle.mjs';
const migration='database/supabase/migrations/368_core_section_catalog_refresh.sql';
const rollback='database/supabase/rollback/368_core_section_catalog_refresh.rollback.sql';
const historical='database/supabase/migrations/200_letbuyy_core_liquid_bundle_attach.sql';
const seed='database/supabase/seeds/generated/letbuyy-core-liquid-bundle.json';
function fixture(){
 const dir=mkdtempSync(resolve(tmpdir(),'letbuyy-core-generator-'));
 for(const path of [script,migration,rollback,historical,seed]){mkdirSync(dirname(resolve(dir,path)),{recursive:true});writeFileSync(resolve(dir,path),readFileSync(resolve(root,path)));}
 mkdirSync(resolve(dir,'packages'),{recursive:true});symlinkSync(resolve(root,'packages/theme-engine'),resolve(dir,'packages/theme-engine'),'dir');symlinkSync(resolve(root,'node_modules'),resolve(dir,'node_modules'),'dir');
 return dir;
}
function run(dir,args=[]){return execFileSync(process.execPath,['--import','tsx',resolve(dir,script),...args],{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
test('Core regeneration checks current artifact and preserves historical migration200 bytes',()=>{
 const dir=fixture();try{
  const before=readFileSync(resolve(dir,historical),'utf8'),a=readFileSync(resolve(dir,migration),'utf8');
  assert.equal(JSON.parse(run(dir,['--check'])).check,true);run(dir);
  assert.equal(readFileSync(resolve(dir,historical),'utf8'),before);assert.equal(readFileSync(resolve(dir,migration),'utf8'),a);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Core generator refuses an altered accepted migration before changing any artifact',()=>{
 const dir=fixture();try{
  const before=readFileSync(resolve(dir,seed),'utf8'),old=readFileSync(resolve(dir,historical),'utf8');writeFileSync(resolve(dir,migration),'-- synthetic reviewed different migration\n');
  assert.throws(()=>run(dir),error=>String(error.stderr).includes('Refusing to rewrite accepted migration'));
  assert.equal(readFileSync(resolve(dir,seed),'utf8'),before);assert.equal(readFileSync(resolve(dir,historical),'utf8'),old);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
