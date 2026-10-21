// Actual bundled workerd, native Cache API and owned REST/PostgreSQL.
// Seeded synthetic store/owner for focused runtime diagnosis; not signup proof.
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {expect} from '@playwright/test';
import {createStorefrontGateToken,createStorefrontPreviewToken} from '@letbuyy/auth-core';
import {NativeGateway} from '../helpers/native-owned-gateway';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {gatewayEnv,newIdentityKeys,signedIdentityHeaders,INTERNAL_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {hashStoreAccessPassword} from '../../services/api-gateway/src/lib/store-access-password';
const owned=requireOwnedDatabase(),key='synthetic-native-access-signing-key';
const q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
let gateway:NativeGateway;
before(async()=>{gateway=await NativeGateway.create(gatewayEnv(owned,await newIdentityKeys(),{NEXT_PUBLIC_STORE_ROOT_DOMAIN:'letbuyy.store',STORE_ACCESS_SIGNING_KEY:key,PREVIEW_SIGNING_KEY:key}),async()=>{throw new Error('No provider call belongs to this access fixture');});});
after(async()=>{await gateway?.settle();});
async function read(path:string,headers:HeadersInit={}){const response=await gateway.dispatch(path,{headers});const text=await response.text();return{status:response.status,cache:response.headers.get('x-storefront-cache'),text};}

test('native owner password creation persists Argon2id and the native verifier accepts it',async()=>{
 const t=newSyntheticTenant('native-pass-create');seedSyntheticTenant(owned.psql,t);const actor=crypto.randomUUID(),email='synthetic-native-'+actor+'@example.invalid';
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name)VALUES(${q(actor)},${q(email)},true,'Synthetic native owner');UPDATE sites SET custom_user_id=${q(actor)} WHERE id=${q(t.siteId)};`);
 const response=await gateway.dispatch('/v1/store-access',{method:'PUT',headers:{...await signedIdentityHeaders(actor,email,t.siteId),'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({site_id:t.siteId,access_mode:'password',password:'Synthetic-native-password-42!'})});
 const status=response.status;await response.arrayBuffer();assert.equal(status,200,'real Worker must create a password rather than swallowing a hash runtime failure');
 assert.equal(owned.psql(`SELECT access_password_hash LIKE '$argon2id$%' FROM sites WHERE id=${q(t.siteId)};`),'t');
 const verify=await gateway.dispatch('/v1/internal/store-access/verify',{method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({site_id:t.siteId,host:t.subdomain+'.letbuyy.store',password:'Synthetic-native-password-42!'})});assert.equal(verify.status,200);await verify.arrayBuffer();
});

test('native verifier accepts an existing Node-generated Argon2id hash and refuses the wrong password',async()=>{
 const t=newSyntheticTenant('native-pass-compat');seedSyntheticTenant(owned.psql,t);const password='Synthetic-existing-password-42!',hash=await hashStoreAccessPassword(password);
 owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);
 const verify=async(value:string)=>{const r=await gateway.dispatch('/v1/internal/store-access/verify',{method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({site_id:t.siteId,host:t.subdomain+'.letbuyy.store',password:value})});const status=r.status;await r.arrayBuffer();return status;};
 assert.equal(await verify('Synthetic-wrong-password'),401);assert.equal(await verify(password),200,'an actual supported hash must not be mistaken for bad credentials');
});

test('actual warmed native catalogue CacheAPI never skips current password, preview revocation or offline policy',async()=>{
 const t=newSyntheticTenant('native-access-cache');seedSyntheticTenant(owned.psql,t);const id=crypto.randomUUID(),marker='Synthetic native cached private product',host=t.subdomain+'.letbuyy.store';
 owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES(${q(id)},${q(t.siteId)},${q(t.siteId)},${q(marker)},'native-cached-product',100,5,true,'active');`);
 const path='/v1/storefront/'+t.subdomain+'/products';
 await expect.poll(async()=>{const result=await read(path);assert.equal(result.status,200);return result.cache;},{timeout:10_000,intervals:[50,100,250]}).toBe('HIT');
 const hash=await hashStoreAccessPassword('Synthetic-cache-password-42!');owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);
 let refused=await read(path);assert.equal(refused.status,401);assert.equal(refused.text.includes(marker),false);
 const revision=owned.psql(`SELECT encode(sha256(convert_to(${q(hash)},'UTF8')),'hex');`),exp=Math.floor(Date.now()/1000)+600;
 const gate=await createStorefrontGateToken({sid:t.siteId,host,revision,exp},key);const allowed=await read(path,{'X-LetBuyy-Storefront-Gate':gate});assert.equal(allowed.status,200);assert.equal(allowed.cache,'HIT');assert.equal(allowed.text.includes(marker),true);
 owned.psql(`UPDATE sites SET access_password_hash='synthetic-rotated-hash' WHERE id=${q(t.siteId)};`);assert.equal((await read(path,{'X-LetBuyy-Storefront-Gate':gate})).status,401);
 const jti=crypto.randomUUID();owned.psql(`UPDATE sites SET access_mode='preview_only' WHERE id=${q(t.siteId)};INSERT INTO site_preview_links(site_id,jti,scope,expires_at)VALUES(${q(t.siteId)},${q(jti)},'share-link',to_timestamp(${exp}));`);
 const preview=await createStorefrontPreviewToken({sid:t.siteId,host,jti,scope:'share-link',exp},key),headers={'X-LetBuyy-Storefront-Preview':preview};assert.equal((await read(path,headers)).status,200);
 owned.psql(`UPDATE site_preview_links SET revoked_at=now() WHERE jti=${q(jti)};`);refused=await read(path,headers);assert.equal(refused.status,401);assert.equal(refused.text.includes(marker),false);
 owned.psql(`UPDATE site_preview_links SET revoked_at=NULL WHERE jti=${q(jti)};UPDATE sites SET access_mode='offline' WHERE id=${q(t.siteId)};`);assert.equal((await read(path,headers)).status,503);
 owned.psql(`UPDATE sites SET access_mode='public' WHERE id=${q(t.siteId)};`);assert.equal((await read(path)).status,200);
 console.info('OWNED_NATIVE_ACCESS_CACHE '+JSON.stringify({actualCacheHit:true,passwordDenialBeforeCache:true,passwordProofHit:true,rotationRevoked:true,previewRevoked:true,offlineDenied:true,publicRecovered:true}));
});
