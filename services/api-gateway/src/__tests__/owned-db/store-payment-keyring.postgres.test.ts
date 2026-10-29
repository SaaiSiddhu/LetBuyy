import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {randomUUID} from 'node:crypto';
import {requireOwnedDatabase} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
import {PAYMENT_KEYRING_PREFIX,paymentEncryptionKeyring} from '../../lib/payment-encryption-keyring';

const owned=requireOwnedDatabase();let gateway:Gateway;
after(async()=>{await gateway?.settle();});

test('real configuration saves survive wrapping-key rotation without rewriting encrypted history or inferring bank approval',async t=>{
 const site=newSyntheticTenant('keyring-save');seedSyntheticTenant(owned.psql,site);
 const actor=randomUUID(),email=`syn-keyring-${actor}@example.invalid`,old=randomUUID(),active=randomUUID();
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Synthetic Rotation Owner');
  UPDATE sites SET custom_user_id='${actor}',online_payment_enabled=false WHERE id='${site.siteId}';`);
 gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{PAYMENT_CONFIG_ENCRYPTION_KEY:old}));
 const original=globalThis.fetch;let verifications=0;
 t.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  if(url.hostname==='api.razorpay.com'){verifications++;return Response.json({entity:'collection',items:[]});}
  return original(input,init);
 });
 const body={key_id:['rzp','test',randomUUID().replaceAll('-','')].join('_'),key_secret:randomUUID().replaceAll('-',''),test_mode:true};
 const request=async(method:string,payload?:Record<string,unknown>)=>gateway.request(`/v1/stores/${site.siteId}/payment-config`,{
  method,headers:{...await signedIdentityHeaders(actor,email,site.siteId),'X-Idempotency-Key':randomUUID()},...(payload?{body:JSON.stringify(payload)}:{})});
 const pointer=()=>owned.psql(`SELECT payment_settings->'razorpay'->>'credential_id' FROM sites WHERE id='${site.siteId}';`);
 const cipher=(id:string)=>owned.psql(`SELECT encrypted_credentials->>'key_secret_ciphertext' FROM payment_credentials WHERE id='${id}' AND site_id='${site.siteId}';`);
 let first='',saved='',second='';
 await t.test('former raw key writes canonical V3 and the rotated configuration still reads that exact saved version',async()=>{
  const save=await request('POST',body);assert.equal(save.status,200,save.text);first=pointer();saved=cipher(first);
  const before=owned.psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id='${site.siteId}';`);
  gateway.env.PAYMENT_CONFIG_ENCRYPTION_KEY=PAYMENT_KEYRING_PREFIX+JSON.stringify({active,previous:[old]});
  const read=await request('GET');assert.equal(read.status,200,read.text);assert.equal(read.json?.data.setup.can_enable_online,true);
  assert.equal(read.json?.data.setup.bank_verification,'not_confirmed');assert.equal(cipher(first),saved);
  assert.equal(owned.psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id='${site.siteId}';`),before);
 });
 await t.test('next save appends a new version encrypted by the new wrapping key and preserves the old encrypted bytes',async()=>{
  const save=await request('POST',body);assert.equal(save.status,200,save.text);second=pointer();assert.notEqual(second,first);
  assert.equal(cipher(first),saved);assert.equal(cipher(second).split(':')[1],(await paymentEncryptionKeyring(active)).active.version);
  assert.equal(owned.psql(`SELECT count(*) FROM payment_credentials WHERE site_id='${site.siteId}' AND connection_id='${first}';`),'2');
  assert.equal(save.json?.data.online_payment_enabled,false);
  for(const secret of [old,active,body.key_secret])assert.equal(save.text.includes(secret),false);
 });
 await t.test('retiring an old reader cannot silently read an old pointer with the new key',async()=>{
  gateway.env.PAYMENT_CONFIG_ENCRYPTION_KEY=PAYMENT_KEYRING_PREFIX+JSON.stringify({active,previous:[]});
  assert.equal((await request('GET')).json?.data.setup.can_enable_online,true);
  owned.psql(`UPDATE sites SET payment_settings=jsonb_set(payment_settings,'{razorpay,credential_id}',to_jsonb('${first}'::text)) WHERE id='${site.siteId}';`);
  const oldRead=await request('GET');assert.equal(oldRead.status,200,oldRead.text);assert.equal(oldRead.json?.data.setup.can_enable_online,false);
  assert.ok(oldRead.json?.data.setup.blocking_reasons.includes('credentials_unusable'));
  assert.equal(cipher(first),saved);
  owned.psql(`UPDATE sites SET payment_settings=jsonb_set(payment_settings,'{razorpay,credential_id}',to_jsonb('${second}'::text)) WHERE id='${site.siteId}';`);
 });
 await t.test('malformed private configuration fails a save without persistence or secret disclosure',async()=>{
  const before=owned.psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id='${site.siteId}';`);
  const count=owned.psql(`SELECT count(*) FROM payment_credentials WHERE site_id='${site.siteId}';`);
  const calls=verifications;
  gateway.env.PAYMENT_CONFIG_ENCRYPTION_KEY=PAYMENT_KEYRING_PREFIX+'{"active":'+active;
  const failed=await request('POST',body);assert.equal(failed.status,503,failed.text);
  assert.equal(failed.json?.error.code,'PAYMENT_CONFIG_UNAVAILABLE');assert.equal(verifications,calls,'known private configuration faults never reach the provider');
  for(const secret of [old,active,body.key_secret])assert.equal(failed.text.includes(secret),false);
  assert.equal(owned.psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id='${site.siteId}';`),before);
  assert.equal(owned.psql(`SELECT count(*) FROM payment_credentials WHERE site_id='${site.siteId}';`),count);
 });
});
