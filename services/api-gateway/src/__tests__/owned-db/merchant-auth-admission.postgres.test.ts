// Real mounted Gateway/owned PostgREST. Signed Accounts transport is a fixture;
// normal email/password/browser acceptance lives in the separate browser suites.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createLetbuyyInternalAppHeaders} from '@letbuyy/auth-core';
import {requireOwnedDatabase} from './owned-db-support';
import {INTERNAL_SECRET,tapRest,restJson} from './gateway-harness';
import {merchantFixture,activeFactor,otp} from './merchant-stepup-fixture';
const owned=requireOwnedDatabase();
const headers=async()=>({'Content-Type':'application/json',...(await createLetbuyyInternalAppHeaders({app:'accounts',secret:INTERNAL_SECRET})).headers});

test('private account lookup reports the current enrolled factor and never exposes its material',async()=>{
 const f=await merchantFixture(owned);
 const lookup=async()=>f.gateway.request('/v1/auth/custom/users/by-email',{method:'POST',headers:await headers(),body:JSON.stringify({email:f.email})});
 const before=await lookup();assert.equal(before.status,200);assert.equal(before.json?.data.mfa_required,false);
 const factor=await activeFactor(f);
 const active=await lookup();assert.equal(active.status,200);assert.equal(active.json?.data.mfa_required,true);
 assert.doesNotMatch(active.text,/secret_ciphertext|otpauth_uri|recovery_codes|password_hash/);
 assert.equal(active.text.includes(factor.secret),false);
 assert.equal((await f.call('POST','/2fa/disable',{factor_id:factor.id,code:otp(factor.secret)})).status,200);
 const disabled=await lookup();assert.equal(disabled.status,200);assert.equal(disabled.json?.data.mfa_required,false);
 const denied=await f.gateway.request('/v1/auth/custom/users/by-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.email})});
 assert.equal(denied.status,401);assert.equal(denied.text.includes(f.email),false);
});

test('factor-read failure cannot declare an account free of MFA',async()=>{
 const f=await merchantFixture(owned);await activeFactor(f);
 for(const status of [503,200]){
 const tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='merchant_2fa_factors'
  ?restJson(status,{message:'synthetic-private-factor-storage-failure'}):forward());
 try{
  const unavailable=await f.gateway.request('/v1/auth/custom/users/by-email',{method:'POST',headers:await headers(),body:JSON.stringify({email:f.email})});
  assert.equal(unavailable.status,503);assert.equal(unavailable.json?.data,undefined);
  assert.doesNotMatch(unavailable.text,/synthetic-private-factor-storage-failure|secret_ciphertext/);
 }finally{tap.restore();}
 }
});
