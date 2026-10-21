import {DEFAULT_STOREFRONT_DOMAIN} from '@letbuyy/shared-types';
// Actual bundled workerd, native Cache API and owned REST/PostgreSQL.
// Seeded synthetic store/owner for focused runtime diagnosis; not signup proof.
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {expect} from '@playwright/test';
import {createStorefrontGateToken,createStorefrontPreviewToken} from '@letbuyy/auth-core';
import {holdOwnedStorefrontSqlSnapshot} from '../helpers/owned-storefront-snapshot';
import {NativeGateway} from '../helpers/native-owned-gateway';
import {requireOwnedDatabase,startOwnedPooledSqlProxy} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {gatewayEnv,newIdentityKeys,signedIdentityHeaders,INTERNAL_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {hashStoreAccessPassword} from '../../services/api-gateway/src/lib/store-access-password';
const owned=requireOwnedDatabase(),key='synthetic-native-access-signing-key';
const q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
let gateway:NativeGateway;
before(async()=>{gateway=await NativeGateway.create(gatewayEnv(owned,await newIdentityKeys(),{NEXT_PUBLIC_STORE_ROOT_DOMAIN:DEFAULT_STOREFRONT_DOMAIN,STORE_ACCESS_SIGNING_KEY:key,PREVIEW_SIGNING_KEY:key}),async()=>{throw new Error('No provider call belongs to this access fixture');});});
after(async()=>{await gateway?.settle();});
async function read(path:string,headers:HeadersInit={}){const response=await gateway.dispatch(path,{headers});const text=await response.text();return{status:response.status,cache:response.headers.get('x-storefront-cache'),text};}

test('native owner password creation persists Argon2id and the native verifier accepts it',async()=>{
 const t=newSyntheticTenant('native-pass-create');seedSyntheticTenant(owned.psql,t);const password=crypto.randomUUID()+crypto.randomUUID(),actor=crypto.randomUUID(),email='synthetic-native-'+actor+'@example.invalid';
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name)VALUES(${q(actor)},${q(email)},true,'Synthetic native owner');UPDATE sites SET custom_user_id=${q(actor)} WHERE id=${q(t.siteId)};`);
 const response=await gateway.dispatch('/v1/store-access',{method:'PUT',headers:{...await signedIdentityHeaders(actor,email,t.siteId),'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({site_id:t.siteId,access_mode:'password',password})});
 const status=response.status;await response.arrayBuffer();assert.equal(status,200,'real Worker must create a password rather than swallowing a hash runtime failure');
 assert.equal(owned.psql(`SELECT access_password_hash LIKE '$argon2id$%' FROM sites WHERE id=${q(t.siteId)};`),'t');
 const verify=await gateway.dispatch('/v1/internal/store-access/verify',{method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({site_id:t.siteId,host:t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,password})});assert.equal(verify.status,200);await verify.arrayBuffer();
});

test('native verifier accepts an existing Node-generated Argon2id hash and refuses the wrong password',async()=>{
 const t=newSyntheticTenant('native-pass-compat');seedSyntheticTenant(owned.psql,t);const password=crypto.randomUUID()+crypto.randomUUID(),hash=await hashStoreAccessPassword(password);
 owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);
 const verify=async(value:string)=>{const r=await gateway.dispatch('/v1/internal/store-access/verify',{method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({site_id:t.siteId,host:t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,password:value})});const status=r.status;await r.arrayBuffer();return status;};
 assert.equal(await verify('Synthetic-wrong-password'),401);assert.equal(await verify(password),200,'an actual supported hash must not be mistaken for bad credentials');
});

test('actual warmed native catalogue CacheAPI never skips current password, preview revocation or offline policy',async()=>{
 const t=newSyntheticTenant('native-access-cache');seedSyntheticTenant(owned.psql,t);const id=crypto.randomUUID(),marker='Synthetic native cached private product',host=t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN;
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


async function nativeGateTenant(tag:string){const t=newSyntheticTenant(tag);seedSyntheticTenant(owned.psql,t);const password=crypto.randomUUID()+crypto.randomUUID(),hash=await hashStoreAccessPassword(password);owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);return{...t,password,host:t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,ip:'2001:db8::beef'};}
async function gateVerify(t:Awaited<ReturnType<typeof nativeGateTenant>>,override:Record<string,unknown>={}){const r=await gateway.dispatch('/v1/internal/store-access/verify',{method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({site_id:t.siteId,host:t.host,ip:t.ip,password:t.password,...override})});const status=r.status,retry=r.headers.get('Retry-After');await r.arrayBuffer();return{status,retry};}
async function stableQuotaWindow(){const remaining=900_000-Date.now()%900_000;if(remaining<15_000)await new Promise(r=>setTimeout(r,remaining+50));}
test('native exhausted atomic quota refuses before an actual malformed KDF state',async()=>{
 await stableQuotaWindow();const t=await nativeGateTenant('native-gate-limit');
 for(let i=0;i<30;i++)assert.equal((await gateVerify(t)).status,200);
 owned.psql(`UPDATE sites SET access_password_hash='synthetic-corrupt-hash' WHERE id=${q(t.siteId)};`);
 const denied=await gateVerify(t);assert.equal(denied.status,429,'a closed quota must not evaluate corrupt hash and return unavailable');assert.ok(Number(denied.retry)>0);assert.equal((await gateVerify(t,{site_id:t.siteId.toUpperCase(),host:t.host.toUpperCase(),ip:'2001:0db8:0000:0000:0000:0000:0000:beef'})).status,429,'equivalent identifiers share one quota');assert.equal(owned.psql(`SELECT count(*) FROM site_gate_attempts WHERE site_id=${q(t.siteId)};`),'30');
});
test('four actual native requests race for the last quota slot; correct credentials never bypass refusal',async()=>{
 await stableQuotaWindow();const t=await nativeGateTenant('native-gate-race');for(let i=0;i<29;i++)assert.equal((await gateVerify(t)).status,200);
 const results=await Promise.all(Array.from({length:4},()=>gateVerify(t)));assert.deepEqual(results.map(r=>r.status).sort(),[200,429,429,429]);assert.equal(owned.psql(`SELECT count(*) FROM site_gate_attempts WHERE site_id=${q(t.siteId)};`),'30');
 console.info('OWNED_NATIVE_GATE_ADMISSION '+JSON.stringify({race:4,admitted:1,refused:3,correctPasswordCannotBypass:true}));
});

test('native storefront cart admission uses current policy and refuses stale password proof without changing carts',async()=>{
 const t=newSyntheticTenant('native-cart-access');seedSyntheticTenant(owned.psql,t);const productId=crypto.randomUUID();
 owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES(${q(productId)},${q(t.siteId)},${q(t.siteId)},'Synthetic native gated cart','synthetic-native-gated-cart',100,5,true,'active');`);
 const path='/v1/storefront/'+t.subdomain;
 const send=async(suffix:string,method='GET',proof?:string)=>{const response=await gateway.dispatch(path+suffix,{method,headers:{'Content-Type':'application/json',...(proof?{'X-LetBuyy-Storefront-Gate':proof}:{})},...(method==='POST'?{body:JSON.stringify({lines:[{product_id:productId,quantity:1}]})}:{})});const status=response.status,cache=response.headers.get('Cache-Control');const payload=await response.json() as {data?:{cart_token?:string}};return{status,cache,payload};};
 const initial=await send('/cart','POST');assert.equal(initial.status,201);const cartToken=initial.payload.data!.cart_token!;
 for(const mode of ['password','preview_only','offline']){
  owned.psql(`UPDATE sites SET access_mode=${q(mode)} WHERE id=${q(t.siteId)};`);const expected=mode==='offline'?503:401;
  assert.equal((await send('/cart','POST')).status,expected);assert.equal((await send('/cart/'+cartToken)).status,expected);assert.equal((await send('/cart/'+cartToken+'/checkout-url')).status,expected);assert.equal(owned.psql(`SELECT count(*) FROM carts WHERE store_id=${q(t.siteId)};`),'1');
 }
 const jti=crypto.randomUUID(),previewExp=Math.floor(Date.now()/1000)+600;
 owned.psql(`UPDATE sites SET access_mode='preview_only' WHERE id=${q(t.siteId)};INSERT INTO site_preview_links(site_id,jti,scope,expires_at)VALUES(${q(t.siteId)},${q(jti)},'share-link',to_timestamp(${previewExp}));`);
 const preview=await createStorefrontPreviewToken({sid:t.siteId,host:t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,jti,scope:'share-link',exp:previewExp},key);
 const previewCart=await gateway.dispatch(path+'/cart',{method:'POST',headers:{'Content-Type':'application/json','X-LetBuyy-Storefront-Preview':preview},body:JSON.stringify({lines:[]})});assert.equal(previewCart.status,401);await previewCart.arrayBuffer();
 const hash=await hashStoreAccessPassword(crypto.randomUUID());owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);
 const revision=owned.psql(`SELECT encode(sha256(convert_to(${q(hash)},'UTF8')),'hex');`),token=await createStorefrontGateToken({sid:t.siteId,host:t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,revision,exp:Math.floor(Date.now()/1000)+600},key);
 const allowed=await send('/cart/'+cartToken,'GET',token);assert.equal(allowed.status,200);assert.equal(allowed.cache,'no-store');
 owned.psql(`UPDATE sites SET access_password_hash=${q(await hashStoreAccessPassword(crypto.randomUUID()))} WHERE id=${q(t.siteId)};`);assert.equal((await send('/cart/'+cartToken,'GET',token)).status,401);
});

test('native password handoff works without a tenant cookie and retires after current password rotation',async()=>{
 const t=newSyntheticTenant('native-hosted-pass');seedSyntheticTenant(owned.psql,t);const productId=crypto.randomUUID(),hash=await hashStoreAccessPassword(crypto.randomUUID());
 owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES(${q(productId)},${q(t.siteId)},${q(t.siteId)},'Synthetic native hosted cart','synthetic-native-hosted-cart',100,5,true,'active');UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);
 const revision=owned.psql(`SELECT encode(sha256(convert_to(${q(hash)},'UTF8')),'hex');`),gate=await createStorefrontGateToken({sid:t.siteId,host:t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,revision,exp:Math.floor(Date.now()/1000)+600},key);
 const response=await gateway.dispatch('/v1/storefront/'+t.subdomain+'/cart',{method:'POST',headers:{'Content-Type':'application/json','X-LetBuyy-Storefront-Gate':gate},body:JSON.stringify({lines:[{product_id:productId,quantity:1}]})});assert.equal(response.status,201);const cart=await response.json() as {data:{id:string;cart_token:string}};
 const issued=await gateway.dispatch('/v1/storefront/'+t.subdomain+'/cart/'+cart.data.cart_token+'/checkout-url',{headers:{'X-LetBuyy-Storefront-Gate':gate}});assert.equal(issued.status,200);const payload=await issued.json() as {data:{checkout_url:string}};
 const path='/v1/checkout/'+cart.data.id+'/verify-handoff?'+new URL(payload.data.checkout_url).searchParams.toString();
 const read=await gateway.dispatch(path,{});assert.equal(read.status,200);assert.equal(read.headers.get('Cache-Control'),'no-store');const display=await read.json() as {data:{presentation:{id:string;themeSettings:{primaryColor:string}}}};assert.equal(display.data.presentation.id,t.siteId);assert.ok(display.data.presentation.themeSettings.primaryColor);
 owned.psql(`UPDATE sites SET access_password_hash=${q(await hashStoreAccessPassword(crypto.randomUUID()))} WHERE id=${q(t.siteId)};`);const denied=await gateway.dispatch(path,{});assert.equal(denied.status,401);await denied.arrayBuffer();
});

test('native receipt capability survives closed navigation without exposing contact data or accepting a wrong cart',async()=>{
 const t=newSyntheticTenant('native-receipt');seedSyntheticTenant(owned.psql,t);
 const created=await gateway.dispatch('/v1/storefront/'+t.subdomain+'/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[],buyer_email:'syn-native-receipt@example.invalid'})});assert.equal(created.status,201);const payload=await created.json() as {data:{cart_token:string}};
 owned.psql(`UPDATE sites SET access_mode='offline',published=false WHERE id=${q(t.siteId)};`);
 const base='/v1/storefront/'+t.subdomain+'/cart/';const receipt=await gateway.dispatch(base+payload.data.cart_token+'/checkout-status',{});assert.equal(receipt.status,200);assert.equal(receipt.headers.get('Cache-Control'),'no-store');const text=await receipt.text();assert.doesNotMatch(text,/syn-native-receipt|buyer_email|shipping_address|payment_intent/);
 const wrong=await gateway.dispatch(base+'ct_'+crypto.randomUUID().replace(/-/g,'')+'/checkout-status',{});assert.equal(wrong.status,404);await wrong.arrayBuffer();
});

test('native checkout session requires its cart capability and reports a real state-read outage as unavailable',async()=>{
 const t=newSyntheticTenant('native-state-read');seedSyntheticTenant(owned.psql,t);const id=crypto.randomUUID();
 owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES(${q(id)},${q(t.siteId)},${q(t.siteId)},'Synthetic state item','synthetic-state-item',100,5,true,'active');`);
 const created=await gateway.dispatch('/v1/storefront/'+t.subdomain+'/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[{product_id:id,quantity:1}]})});assert.equal(created.status,201);const cart=await created.json() as {data:{id:string;cart_token:string}};
 const issued=await gateway.dispatch('/v1/storefront/'+t.subdomain+'/cart/'+cart.data.cart_token+'/checkout-url',{});assert.equal(issued.status,200);const link=await issued.json() as {data:{checkout_url:string}};
 const contact=await gateway.dispatch('/v1/checkout/'+cart.data.id+'/contact?'+new URL(link.data.checkout_url).searchParams,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idempotency_key:crypto.randomUUID(),email:'synthetic-native-state@example.invalid',name:'Synthetic native state'})});assert.equal(contact.status,200);const session=await contact.json() as {data:{checkout:{id:string}}};
 const base='/v1/checkout/'+session.data.checkout.id+'?site_id='+t.siteId;
 const missing=await gateway.dispatch(base,{});assert.equal(missing.status,401);assert.doesNotMatch(await missing.text(),/synthetic-native-state/);
 const read=async()=>{const r=await gateway.dispatch(base+'&cart_token='+cart.data.cart_token,{});const status=r.status,cache=r.headers.get('Cache-Control');const body=await r.text();return{status,cache,body};};
 const allowed=await read();assert.equal(allowed.status,200);assert.equal(allowed.cache,'no-store');assert.match(allowed.body,/synthetic-native-state/);
 const wrong=await gateway.dispatch(base+'&cart_token=ct_'+crypto.randomUUID().replace(/-/g,''),{});assert.equal(wrong.status,404);await wrong.arrayBuffer();
 try{owned.psql('ALTER TABLE public.checkout_sessions RENAME TO owned_checkout_state_unavailable;');const down=await read();assert.equal(down.status,503);assert.doesNotMatch(down.body,/owned_checkout_state_unavailable|SQLSTATE/);}finally{owned.psql('ALTER TABLE public.owned_checkout_state_unavailable RENAME TO checkout_sessions;');}
 assert.equal((await read()).status,200);
});
test('native cart deletion denies private navigation and preserves a seeded terminal cart instead of resurrecting it',async()=>{
 const t=newSyntheticTenant('native-clear-state');seedSyntheticTenant(owned.psql,t);
 const create=async()=>{const r=await gateway.dispatch('/v1/storefront/'+t.subdomain+'/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[],buyer_email:'synthetic-native-clear@example.invalid'})});assert.equal(r.status,201);return(await r.json() as {data:{id:string;cart_token:string}}).data;};
 const cart=await create(),path='/v1/storefront/'+t.subdomain+'/cart/'+cart.cart_token;
 for(const mode of ['password','preview_only','offline']){owned.psql(`UPDATE sites SET access_mode=${q(mode)} WHERE id=${q(t.siteId)};`);const r=await gateway.dispatch(path,{method:'DELETE'});assert.equal(r.status,mode==='offline'?503:401);assert.doesNotMatch(await r.text(),/synthetic-native-clear/);}
 owned.psql(`UPDATE sites SET access_mode='public' WHERE id=${q(t.siteId)};UPDATE carts SET status='converted' WHERE id=${q(cart.id)};`);const before=owned.psql(`SELECT row_to_json(c)::text FROM carts c WHERE id=${q(cart.id)};`);const closed=await gateway.dispatch(path,{method:'DELETE'});assert.equal(closed.status,409);await closed.arrayBuffer();assert.equal(owned.psql(`SELECT row_to_json(c)::text FROM carts c WHERE id=${q(cart.id)};`),before);
 const patched=await gateway.dispatch(path,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[]})});assert.equal(patched.status,409);await patched.arrayBuffer();assert.equal(owned.psql(`SELECT row_to_json(c)::text FROM carts c WHERE id=${q(cart.id)};`),before);assert.equal(owned.psql(`SELECT count(*) FROM carts WHERE store_id=${q(t.siteId)} AND session_id=${q(cart.cart_token)};`),'1');
 const active=await create();const cleared=await gateway.dispatch('/v1/storefront/'+t.subdomain+'/cart/'+active.cart_token,{method:'DELETE'});assert.equal(cleared.status,200);const payload=await cleared.json() as {data:{status:string;sales_origin:string;lines:unknown[]}};assert.equal(payload.data.status,'active');assert.equal(payload.data.sales_origin,'storefront');assert.deepEqual(payload.data.lines,[]);
});


test('native warmed content cache stays behind current authority while actual SQL site results remain held',async()=>{
 const t=newSyntheticTenant('native-held-sql');seedSyntheticTenant(owned.psql,t);const product=crypto.randomUUID(),marker='Synthetic native held SQL private product';owned.psql(`INSERT INTO products(id,site_id,store_id,name,price,stock,is_active,status)VALUES(${q(product)},${q(t.siteId)},${q(t.siteId)},${q(marker)},100,5,true,'active');`);
 const proxy=await startOwnedPooledSqlProxy(owned);let sqlGateway:NativeGateway|undefined,held:ReturnType<typeof holdOwnedStorefrontSqlSnapshot>|undefined;const results=[];
 try{
  sqlGateway=await NativeGateway.create(gatewayEnv(owned,await newIdentityKeys(),{...proxy.env(),NEXT_PUBLIC_STORE_ROOT_DOMAIN:DEFAULT_STOREFRONT_DOMAIN,STORE_ACCESS_SIGNING_KEY:key,PREVIEW_SIGNING_KEY:key}),async()=>{throw new Error('No provider call belongs to held SQL cache verification');});
  const read=async()=>{const r=await sqlGateway!.dispatch('/v1/storefront/'+t.subdomain+'/products',{});return{status:r.status,cache:r.headers.get('x-storefront-cache'),body:await r.text()};};
  await expect.poll(async()=>{const r=await read();assert.equal(r.status,200);return r.cache;},{timeout:10_000,intervals:[50,100,250]}).toBe('HIT');held=holdOwnedStorefrontSqlSnapshot(owned,t.siteId,t.subdomain);
  for(const[mode,published,expected]of [['password',true,401],['preview_only',true,401],['offline',true,503],['public',false,404]]as const){owned.psql(`UPDATE sites SET access_mode=${q(mode)},published=${published} WHERE id=${q(t.siteId)};`);assert.deepEqual(held.read(),held.snapshot);const r=await read();results.push({mode,published,status:r.status,expected,cache:r.cache,markerReturned:r.body.includes(marker)});}
  owned.psql(`UPDATE sites SET access_mode='public',published=true WHERE id=${q(t.siteId)};`);const recovered=await read();assert.equal(recovered.status,200);assert.equal(recovered.cache,'HIT');console.info('OWNED_NATIVE_STALE_SQL_CACHE '+JSON.stringify({actualNativeCacheHit:true,managedHyperdrive:false,publicRecovered:true,results}));
 }finally{try{held?.restore();}finally{try{await sqlGateway?.settle();}finally{await proxy.stop();}}}
 assert.deepEqual(results.filter(r=>r.status!==r.expected||r.markerReturned),[]);
});
