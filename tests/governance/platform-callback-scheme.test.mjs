import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
const validator=fileURLToPath(new URL('../../scripts/validators/platform-domain-literal-validator.mjs',import.meta.url));
// Build synthetic samples here; the child validator inspects their rendered bytes.
const scheme=["com","letbuyy","store","accounts"].join(".");
const host=["accounts","letbuyy","store"].join(".");
const generated='apps/merchant/mobile/lib/services/merchant_auth_contract.g.dart';
function check(file,values){
 const root=mkdtempSync(join(tmpdir(),'merchant-callback-policy-'));
 try{
  const dest=join(root,file);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,values.map(v=>`'${v}',`).join('\n'));
  const result=spawnSync(process.execPath,[validator],{cwd:root,encoding:'utf8',timeout:10000});
  assert.ok(result.status===0||result.status===1,result.stderr);return result.status;
 }finally{rmSync(root,{recursive:true,force:true});}
}
test('only the three exact registered iOS schemes are admitted in the generated contract',()=>{
 assert.equal(check(generated,[`${scheme}://auth/callback`,`${scheme}.staging://auth/callback`,`${scheme}.development://auth/callback`]),0);
});
test('an OS callback exception does not authorize storefront hosts or altered scheme routes',()=>{
 for(const value of [`https://${host}/auth/callback`,`${scheme}.preview://auth/callback`,`${scheme}://auth/other`,`${scheme}://auth/callback?grant=admin`])assert.equal(check(generated,[value]),1,value);
});
test('the same OS scheme is refused outside the one generated consumer',()=>{
 assert.equal(check('apps/merchant/mobile/lib/services/unregistered.dart',[`${scheme}://auth/callback`]),1);
});
