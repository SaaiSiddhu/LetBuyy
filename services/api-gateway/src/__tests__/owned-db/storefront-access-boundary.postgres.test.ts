import {loadCartFactSources} from '../../lib/cart-product-facts';
import {holdOwnedStorefrontSqlSnapshot} from './owned-storefront-snapshot';
import {DEFAULT_STOREFRONT_DOMAIN} from '@letbuyy/shared-types';
// Mounted Gateway -> real owned PostgreSQL/PostgREST. Public catalogue scope;
// independent buyer-history/marketplace channel authority is not substituted.
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET,tapRest,restJson,signedIdentityHeaders,type RestTap} from './gateway-harness';
import {createStorefrontGateToken,createStorefrontPreviewToken} from '@letbuyy/auth-core';
import {hashStoreAccessPassword} from '../../lib/store-access-password';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticProductInventory} from './synthetic-tenant';
const owned=requireOwnedDatabase();let gateways:Record<'sql'|'rest',Gateway>,proxy:OwnedPooledSqlProxy,tap:RestTap;
const q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const key='synthetic-visitor-shared-key-fixture';
let faultResource='',faultCode='',faultMethod='GET';
before(async()=>{
 proxy=await startOwnedPooledSqlProxy(owned);const keys=await newIdentityKeys();const env={NEXT_PUBLIC_STORE_ROOT_DOMAIN:DEFAULT_STOREFRONT_DOMAIN,FEATURE_GRAPHQL:'true',STORE_ACCESS_SIGNING_KEY:key,PREVIEW_SIGNING_KEY:key};
 gateways={rest:new Gateway(gatewayEnv(owned,keys,{...env,...proxy.env(),STOREFRONT_POOLED_SQL:'off'})),sql:new Gateway(gatewayEnv(owned,keys,{...env,...proxy.env()}))};
 tap=tapRest(owned.restUrl,async(call,forward)=>{if(call.method===faultMethod&&call.resource===faultResource)return restJson(faultCode?404:503,{code:faultCode||'SYNTHETIC_DEPENDENCY',message:'Synthetic private host resolution failure'});const response=await forward();if(!response.ok)console.info('OWNED_CART_DEPENDENCY_FAILURE '+JSON.stringify({resource:call.resource,status:response.status,body:await response.clone().text()}));return response;});
});
after(async()=>{await Promise.all(Object.values(gateways??{}).map(g=>g.settle()));tap?.restore();await closePooledSqlClients();await proxy?.stop();});
for(const lane of ['sql','rest'] as const){
for(const mode of ['public','password','preview_only','offline'])test(`${lane}: current ${mode} policy controls direct catalogue HTTP paths`,async()=>{
 const gateway=gateways[lane];const start=tap.calls.length;
 const t=newSyntheticTenant(lane+'-'+mode.replace('_','-'));seedSyntheticTenant(owned.psql,t);const id=crypto.randomUUID(),marker='Synthetic protected catalogue '+mode;
 owned.psql(`UPDATE sites SET access_mode=${q(mode)},template_config=jsonb_build_object('privateMarker',${q(marker)}) WHERE id=${q(t.siteId)};
 INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES(${q(id)},${q(t.siteId)},${q(t.siteId)},${q(marker)},'synthetic-access-product',100,5,true,'active');`);
 const paths=[`/${t.subdomain}`,`/${t.subdomain}?projection=render-v1`,`/store/${t.siteId}`,`/store/${t.siteId}/products`,`/${t.subdomain}/products`,`/${t.subdomain}/products/${id}`,`/${t.subdomain}/collections`,`/${t.subdomain}/navigation`,`/${t.subdomain}/policies`,`/${t.subdomain}/pages`,`/${t.subdomain}/categories`,`/reviews?store_id=${t.siteId}&product_id=${id}`];
 const expected=mode==='public'?200:mode==='offline'?503:401;
 const results=[];
 for(const path of paths){
  const before=tap.calls.length,result=await gateway.request('/v1/storefront'+path);
  const reads=tap.calls.slice(before).filter(call=>call.resource==='sites');
  assert.ok(reads.length>=1&&reads.length<=2,'each catalogue request must use bounded current site authority before content');
  assert.ok(reads.every(call=>call.search.get('subdomain')==='eq.'+t.subdomain||call.search.get('id')==='eq.'+t.siteId),'authority reads stay on the exact requested handle or resolved site');
  results.push({path:path.replace(t.subdomain,':store').replace(t.siteId,':site').replace(id,':product'),status:result.status,expected,markerReturned:result.text.includes(marker)});
 }
 console.info('OWNED_STOREFRONT_ACCESS_MATRIX '+JSON.stringify({lane,mode,results,siteRestReads:tap.calls.slice(start).filter(c=>c.resource==='sites').length}));
 assert.deepEqual(results.filter(r=>r.status!==r.expected),[],'every catalogue path must honor current visitor policy');
 if(mode!=='public')assert.equal(results.some(r=>r.markerReturned),false);
 const status=await gateway.request(`/v1/storefront/${t.subdomain}/status`);assert.equal(status.status,200);assert.equal('template_config'in status.json!.data,false);
});

test(`${lane}: password proof admits its store, refuses spoofing/foreign hosts and stops after password rotation or mode change`,async()=>{
 const gateway=gateways[lane];
 const t=newSyntheticTenant(lane+'-password-ok');seedSyntheticTenant(owned.psql,t);const host=t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,password=crypto.randomUUID()+crypto.randomUUID();
 const hash=await hashStoreAccessPassword(password);owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);
 const verify=await gateway.request('/v1/internal/store-access/verify',{method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({site_id:t.siteId,host,password,ip:'2001:db8::42'})});assert.equal(verify.status,200);
 const revision=verify.json!.data.access_revision;assert.match(revision,/^[a-f0-9]{64}$/);
 const token=await createStorefrontGateToken({sid:t.siteId,host,exp:Math.floor(Date.now()/1000)+3600,revision},key);
 const path=`/v1/storefront/${t.subdomain}?projection=render-v1`;
 const read=(proof=token)=>gateway.request(path,{headers:{'X-LetBuyy-Storefront-Gate':proof}});
 const allowed=await read();assert.equal(allowed.status,200);assert.equal(allowed.headers.get('Cache-Control'),'no-store');assert.doesNotMatch(allowed.text,/access_password_hash|\$argon2id/);
 const spoof=await gateway.request(path,{headers:{'X-Client':'storefront-web','X-Internal-API-Secret':INTERNAL_SECRET,Origin:'https://'+host}});assert.equal(spoof.status,401);
 const wrongHost=await createStorefrontGateToken({sid:t.siteId,host:`foreign.${DEFAULT_STOREFRONT_DOMAIN}`,exp:Math.floor(Date.now()/1000)+3600,revision},key);assert.equal((await read(wrongHost)).status,401);
 const newHash=await hashStoreAccessPassword('Synthetic-rotated-password-42!');owned.psql(`UPDATE sites SET access_password_hash=${q(newHash)} WHERE id=${q(t.siteId)};`);assert.equal((await read()).status,401);
 owned.psql(`UPDATE sites SET access_password_hash=${q(hash)},access_mode='preview_only' WHERE id=${q(t.siteId)};`);
 assert.equal((await gateway.request(path,{headers:{'X-LetBuyy-Storefront-Preview':token}})).status,401,'same signing key cannot promote password proof into preview');
});

test(`${lane}: preview reads require a current matching link and stop immediately after revocation, expiry, deletion or offline mode`,async()=>{
 const gateway=gateways[lane];
 const t=newSyntheticTenant(lane+'-preview-ok');seedSyntheticTenant(owned.psql,t);const host=t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,jti=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+600;
 owned.psql(`UPDATE sites SET access_mode='preview_only',status='draft',published=false WHERE id=${q(t.siteId)};INSERT INTO site_preview_links(site_id,jti,scope,expires_at)VALUES(${q(t.siteId)},${q(jti)},'share-link',to_timestamp(${exp}));`);
 const token=await createStorefrontPreviewToken({sid:t.siteId,host,jti,scope:'share-link',exp},key);
 const read=()=>gateway.request(`/v1/storefront/${t.subdomain}?projection=render-v1`,{headers:{'X-LetBuyy-Storefront-Preview':token}});
 assert.equal((await read()).status,200,'legitimate unpublished preview remains available');
 owned.psql(`UPDATE sites SET status='published',published=true WHERE id=${q(t.siteId)};`);
 for(const mutation of ["revoked_at=now()","expires_at=now()-interval '1 second'","deleted_at=now()"]){
  owned.psql(`UPDATE site_preview_links SET revoked_at=NULL,deleted_at=NULL,expires_at=to_timestamp(${exp}) WHERE jti=${q(jti)};UPDATE site_preview_links SET ${mutation} WHERE jti=${q(jti)};`);
  assert.equal((await read()).status,401);
 }
 owned.psql(`UPDATE site_preview_links SET deleted_at=NULL,expires_at=to_timestamp(${exp}) WHERE jti=${q(jti)};UPDATE sites SET access_mode='offline' WHERE id=${q(t.siteId)};`);assert.equal((await read()).status,503);
});

}


test('canonical host resolution reports dependency failures as unavailable and recovers instead of false store absence',async()=>{
 const gateway=gateways.rest,t=newSyntheticTenant('host-fault');seedSyntheticTenant(owned.psql,t);
 const read=(host:string)=>gateway.request('/v1/internal/store-access/resolve?host='+encodeURIComponent(host),{headers:{'X-Internal-API-Secret':INTERNAL_SECRET}});
 try {
  for(const [resource,host] of [['sites',t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN],['site_domains','unknown-synthetic.example.invalid']]){
   faultResource=resource;faultCode='';const failed=await read(host);assert.equal(failed.status,503,resource+': '+failed.text);assert.doesNotMatch(failed.text,/Synthetic private|SQLSTATE|PostgREST/);
   faultResource='';assert.equal((await read(host)).status,resource==='sites'?200:404);
  }
  faultResource='site_domains';faultCode='PGRST205';assert.equal((await read('missing-table.example.invalid')).status,404,'only recognized legacy missing-alias-table compatibility is absence');
 }finally{faultResource='';faultCode='';}
});

test('normal owner preview issuance binds the current host; revoke stops data and foreign hosts never create links',async()=>{
 const gateway=gateways.rest,t=newSyntheticTenant('preview-issuer'),foreign=newSyntheticTenant('preview-foreign');seedSyntheticTenant(owned.psql,t);seedSyntheticTenant(owned.psql,foreign);
 const actor=crypto.randomUUID(),email='synthetic-preview-'+actor+'@example.invalid';
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name)VALUES(${q(actor)},${q(email)},true,'Synthetic preview owner');UPDATE sites SET custom_user_id=${q(actor)},access_mode='preview_only',status='draft',published=false WHERE id=${q(t.siteId)};`);
 const issue=async(host:string)=>gateway.request('/v1/store-access/preview-links',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,t.siteId),'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({site_id:t.siteId,scope:'share-link',host})});
 const good=await issue(t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN);assert.equal(good.status,200,good.text);const {token,jti}=good.json!.data;
 const read=()=>gateway.request('/v1/storefront/'+t.subdomain,{headers:{'X-LetBuyy-Storefront-Preview':token}});assert.equal((await read()).status,200);
 const before=owned.psql(`SELECT count(*) FROM site_preview_links WHERE site_id=${q(t.siteId)};`);
 const wrong=await issue(foreign.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN);assert.equal(wrong.status,400);assert.equal(owned.psql(`SELECT count(*) FROM site_preview_links WHERE site_id=${q(t.siteId)};`),before);
 const revoked=await gateway.request('/v1/store-access/preview-links/'+jti+'?site_id='+t.siteId,{method:'DELETE',headers:{...await signedIdentityHeaders(actor,email,t.siteId),'X-Idempotency-Key':crypto.randomUUID()}});assert.equal(revoked.status,200);assert.equal((await read()).status,404,'unpublished store stays absent once its normal share link is revoked');
});

for(const lane of ['sql','rest'] as const)test(`${lane}: both GraphQL aliases honor catalogue gates and forwarded proof`,async()=>{
 const gateway=gateways[lane],t=newSyntheticTenant(lane+'-graphql-access');seedSyntheticTenant(owned.psql,t);const marker='Synthetic GraphQL visitor product',id=crypto.randomUUID();
 const hash=await hashStoreAccessPassword('Synthetic-GraphQL-password-42!');owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES(${q(id)},${q(t.siteId)},${q(t.siteId)},${q(marker)},'graphql-access-product',100,5,true,'active');`);
 seedSyntheticProductInventory(owned.psql,t.siteId);
 const revision=owned.psql(`SELECT encode(sha256(convert_to(${q(hash)},'UTF8')),'hex');`);
 const token=await createStorefrontGateToken({sid:t.siteId,host:t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,exp:Math.floor(Date.now()/1000)+600,revision},key);
 for(const path of ['/v1/storefront/graphql','/v1/graphql/storefront']){
  const request=(proof?:string)=>gateway.request(path,{method:'POST',headers:{'Content-Type':'application/json',...(proof?{'X-LetBuyy-Storefront-Gate':proof}:{})},body:JSON.stringify({query:'query { products { edges { node { id name } } } }',variables:{storeHandle:t.subdomain,first:5}})});
  const denied=await request();assert.equal(denied.status,200);assert.ok(denied.json!.errors);assert.equal(denied.text.includes(marker),false);assert.equal(denied.json!.data,undefined);
  const allowed=await request(token);assert.equal(allowed.status,200);assert.equal(allowed.json!.errors,undefined,allowed.text);assert.equal(allowed.text.includes(marker),true);
  owned.psql(`UPDATE sites SET access_mode='offline' WHERE id=${q(t.siteId)};`);const closed=await request(token);assert.ok(closed.json!.errors);assert.equal(closed.text.includes(marker),false);owned.psql(`UPDATE sites SET access_mode='password' WHERE id=${q(t.siteId)};`);
 }
});


for(const lane of ['sql','rest'] as const)test(`${lane}: primary and secondary domain capabilities follow current ownership and alias state`,async()=>{
 const gateway=gateways[lane],t=newSyntheticTenant(lane+'-domain-bind'),foreign=newSyntheticTenant(lane+'-domain-other');seedSyntheticTenant(owned.psql,t);seedSyntheticTenant(owned.psql,foreign);
 const primary='primary-'+t.siteId+'.example.invalid',alias='alias-'+t.siteId+'.example.invalid',foreignHost='foreign-'+foreign.siteId+'.example.invalid';
 const hash=await hashStoreAccessPassword('Synthetic-domain-password-42!');
 owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)},custom_domain=${q(primary)},custom_domain_status='active' WHERE id=${q(t.siteId)};INSERT INTO site_domains(site_id,domain,status,role,redirect_to)VALUES(${q(t.siteId)},${q(alias)},'active','redirect',${q(primary)}),(${q(foreign.siteId)},${q(foreignHost)},'active','redirect',NULL);`);
 seedSyntheticProductInventory(owned.psql,t.siteId);
 const revision=owned.psql(`SELECT encode(sha256(convert_to(${q(hash)},'UTF8')),'hex');`);
 const make=(host:string)=>createStorefrontGateToken({sid:t.siteId,host,exp:Math.floor(Date.now()/1000)+600,revision},key);
 const primaryToken=await make(primary),aliasToken=await make(alias),foreignToken=await make(foreignHost);
 const read=(token:string)=>gateway.request('/v1/storefront/'+t.subdomain+'/products',{headers:{'X-LetBuyy-Storefront-Gate':token}});
 assert.equal((await read(primaryToken)).status,200);owned.psql(`UPDATE sites SET custom_domain_status='pending' WHERE id=${q(t.siteId)};`);assert.equal((await read(primaryToken)).status,401);
 assert.equal((await read(aliasToken)).status,200);assert.equal((await read(foreignToken)).status,401,'another site alias is never a host binding for this store');
 for(const mutation of ["status='pending'","deleted_at=now()"]){
  owned.psql(`UPDATE site_domains SET status='active',deleted_at=NULL WHERE site_id=${q(t.siteId)};UPDATE site_domains SET ${mutation} WHERE site_id=${q(t.siteId)};`);assert.equal((await read(aliasToken)).status,401);
 }
 owned.psql(`UPDATE site_domains SET status='active',deleted_at=NULL WHERE site_id=${q(t.siteId)};`);
 try{faultResource='site_domains';assert.equal((await read(aliasToken)).status,503);}finally{faultResource='';}assert.equal((await read(aliasToken)).status,200);
});

for(const lane of ['sql','rest'] as const)test(`${lane}: malformed foreign and expired proofs refuse; live preview dependencies fail unavailable and recover`,async()=>{
 const gateway=gateways[lane],t=newSyntheticTenant(lane+'-proof-refuse');seedSyntheticTenant(owned.psql,t);const host=t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,hash=await hashStoreAccessPassword('Synthetic-proof-password-42!');
 owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);
 seedSyntheticProductInventory(owned.psql,t.siteId);
 const revision=owned.psql(`SELECT encode(sha256(convert_to(${q(hash)},'UTF8')),'hex');`),exp=Math.floor(Date.now()/1000)+600;
 const read=(proof:string)=>gateway.request('/v1/storefront/'+t.subdomain+'/products',{headers:{'X-LetBuyy-Storefront-Gate':proof}});
 const good=await createStorefrontGateToken({sid:t.siteId,host,exp,revision},key);
 for(const proof of ['synthetic.invalid',await createStorefrontGateToken({sid:crypto.randomUUID(),host,exp,revision},key),await createStorefrontGateToken({sid:t.siteId,host,exp:1,revision},key),await createStorefrontGateToken({sid:t.siteId,host,exp,revision:'0'.repeat(64)},key),await createStorefrontGateToken({sid:t.siteId,host,exp,revision},'synthetic-wrong-signing-key')])assert.equal((await read(proof)).status,401);
 assert.equal((await gateway.request('/v1/storefront/'+t.subdomain+'/products',{headers:{Cookie:'__Host-lb_store_gate='+good}})).status,200);
 const duplicate=await gateway.request('/v1/storefront/reviews?store_id='+t.siteId+'&store_id='+crypto.randomUUID());assert.equal(duplicate.status,400);
 const jti=crypto.randomUUID();owned.psql(`UPDATE sites SET access_mode='preview_only' WHERE id=${q(t.siteId)};INSERT INTO site_preview_links(site_id,jti,scope,expires_at)VALUES(${q(t.siteId)},${q(jti)},'share-link',to_timestamp(${exp}));`);
 const preview=await createStorefrontPreviewToken({sid:t.siteId,host,exp,jti,scope:'share-link'},key);
 const previewRead=()=>gateway.request('/v1/storefront/'+t.subdomain+'/products',{headers:{'X-LetBuyy-Storefront-Preview':preview}});
 assert.equal((await previewRead()).status,200);try{faultResource='site_preview_links';const failed=await previewRead();assert.equal(failed.status,503);assert.doesNotMatch(failed.text,/Synthetic private/);}finally{faultResource='';}assert.equal((await previewRead()).status,200);
});

for(const mode of ['password','preview_only','offline'] as const)test(`commerce: current ${mode} policy refuses new and recovered storefront cart data before effects`,async()=>{
 const gateway=gateways.rest,t=newSyntheticTenant('cart-'+mode.replace('_','-'));seedSyntheticTenant(owned.psql,t);
 const productId=crypto.randomUUID(),marker='Synthetic cart access product';
 owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES(${q(productId)},${q(t.siteId)},${q(t.siteId)},${q(marker)},'synthetic-cart-access',100,5,true,'active');`);
 const path='/v1/storefront/'+t.subdomain;
 seedSyntheticProductInventory(owned.psql,t.siteId);
 assert.equal((await loadCartFactSources(gateway.env,t.siteId,crypto.randomUUID(),[productId])).has(productId),true,'positive canonical cart source before policy denials');
 const send=(suffix:string,method='GET',body?:unknown)=>gateway.request(path+suffix,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const initial=await send('/cart','POST',{lines:[{product_id:productId,quantity:1}]});assert.equal(initial.status,201,initial.text);
 const token=initial.json!.data.cart_token;assert.equal(typeof token,'string');
 owned.psql(`UPDATE sites SET access_mode=${q(mode)} WHERE id=${q(t.siteId)};`);
 const before=owned.psql(`SELECT jsonb_build_object('carts',(SELECT count(*) FROM carts WHERE store_id=${q(t.siteId)}),'events',(SELECT count(*) FROM outbox_events WHERE site_id=${q(t.siteId)}))::text;`);
 const cases:[string,string,unknown?][]=[['/cart','POST',{lines:[{product_id:productId,quantity:1}]}],[`/cart/${token}`,'GET'],[`/cart/${token}`,'PATCH',{lines:[{product_id:productId,quantity:2}]}],[`/cart/${token}/buyer-identity`,'PUT',{buyer_email:'synthetic-cart@example.invalid'}],[`/cart/${token}/discount-codes`,'POST',{coupon_codes:[]}],[`/cart/${token}/checkout-url`,'GET'],[`/cart/${token}/checkout-url`,'POST']];
 const results=[];for(const[suffix,method,body]of cases){const r=await send(suffix,method,body);results.push({route:suffix.replace(token,':cart'),method,status:r.status,productReturned:r.text.includes(marker)});}
 const after=owned.psql(`SELECT jsonb_build_object('carts',(SELECT count(*) FROM carts WHERE store_id=${q(t.siteId)}),'events',(SELECT count(*) FROM outbox_events WHERE site_id=${q(t.siteId)}))::text;`);
 console.info('OWNED_COMMERCE_ACCESS_BASELINE '+JSON.stringify({mode,expected:mode==='offline'?503:401,before:JSON.parse(before),after:JSON.parse(after),results}));
 assert.deepEqual(results.map(r=>r.status),cases.map(()=>mode==='offline'?503:401),'every storefront cart path must honor live visitor policy');assert.equal(after,before,'denied cart requests must not add carts or events');
});

for(const lane of ['sql','rest'] as const)test(`${lane}: fresh cart proof survives normal unlock but stops after rotation, unpublish and metadata outage`,async()=>{
 const gateway=gateways[lane],t=newSyntheticTenant(lane+'-cart-proof');seedSyntheticTenant(owned.psql,t);const productId=crypto.randomUUID();
 const hash=await hashStoreAccessPassword(crypto.randomUUID());owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES(${q(productId)},${q(t.siteId)},${q(t.siteId)},'Synthetic gated cart','synthetic-gated-cart',100,5,true,'active');UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);
 seedSyntheticProductInventory(owned.psql,t.siteId);
 const revision=owned.psql(`SELECT encode(sha256(convert_to(${q(hash)},'UTF8')),'hex');`),host=t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN;
 const token=await createStorefrontGateToken({sid:t.siteId,host,revision,exp:Math.floor(Date.now()/1000)+600},key);
 const path='/v1/storefront/'+t.subdomain;
 const create=(proof?:string)=>gateway.request(path+'/cart',{method:'POST',headers:{'Content-Type':'application/json',...(proof?{'X-LetBuyy-Storefront-Gate':proof}:{})},body:JSON.stringify({channel:'api',lines:[{product_id:productId,quantity:1}]})});
 const start=tap.calls.length;assert.equal((await create()).status,401,'client acquisition channel never bypasses storefront policy');const good=await create(token);assert.equal(good.status,201,good.text);
 assert.ok(tap.calls.slice(start).some(c=>c.resource==='sites'),'even successful pooled SQL cannot replace current REST policy admission');
 const cartToken=good.json!.data.cart_token;
 const read=()=>gateway.request(path+'/cart/'+cartToken,{headers:{'X-LetBuyy-Storefront-Gate':token}});
 assert.equal((await read()).status,200);
 const changed=await hashStoreAccessPassword(crypto.randomUUID());owned.psql(`UPDATE sites SET access_password_hash=${q(changed)} WHERE id=${q(t.siteId)};`);assert.equal((await read()).status,401);assert.equal((await create(token)).status,401);
 owned.psql(`UPDATE sites SET access_mode='public',published=false WHERE id=${q(t.siteId)};`);assert.equal((await create(token)).status,404);
 owned.psql(`UPDATE sites SET access_mode='public',published=true WHERE id=${q(t.siteId)};`);
 try{faultResource='sites';faultCode='';const failed=await create(token);assert.equal(failed.status,503);assert.doesNotMatch(failed.text,/Synthetic private/);}finally{faultResource='';faultCode='';}
 assert.equal((await create()).status,201,'public recovery admits again');
});

for(const lane of ['sql','rest'] as const)test(`${lane}: a valid read-preview link never becomes storefront purchase authority`,async()=>{
 const gateway=gateways[lane],t=newSyntheticTenant(lane+'-preview-cart');seedSyntheticTenant(owned.psql,t);const host=t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,jti=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+600;
 owned.psql(`INSERT INTO site_preview_links(site_id,jti,scope,expires_at)VALUES(${q(t.siteId)},${q(jti)},'share-link',to_timestamp(${exp}));`);
 const token=await createStorefrontPreviewToken({sid:t.siteId,host,jti,scope:'share-link',exp},key);
 for(const mode of ['preview_only','password']){
  owned.psql(`UPDATE sites SET access_mode=${q(mode)} WHERE id=${q(t.siteId)};`);
  const headers={'X-LetBuyy-Storefront-Preview':token,'Content-Type':'application/json'};
  assert.equal((await gateway.request('/v1/storefront/'+t.subdomain,{headers})).status,200,'preview read remains valid');
  assert.equal((await gateway.request('/v1/storefront/'+t.subdomain+'/cart',{method:'POST',headers,body:JSON.stringify({lines:[]})})).status,401,'read capability cannot create even an empty purchase cart');
 }
 assert.equal(owned.psql(`SELECT count(*) FROM carts WHERE store_id=${q(t.siteId)};`),'0');
});

for(const mode of ['password','preview_only','offline','unpublished'] as const)test(`hosted: issued public handoff stops new access after ${mode}`,async()=>{
 const gateway=gateways.rest,t=newSyntheticTenant('hosted-'+mode.replace('_','-'));seedSyntheticTenant(owned.psql,t);const id=crypto.randomUUID(),marker='Synthetic hosted private line';
 owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES(${q(id)},${q(t.siteId)},${q(t.siteId)},${q(marker)},'synthetic-hosted-private',100,5,true,'active');`);
 seedSyntheticProductInventory(owned.psql,t.siteId);
 const cart=await gateway.request('/v1/storefront/'+t.subdomain+'/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[{product_id:id,quantity:1}]})});assert.equal(cart.status,201,cart.text);
 const token=cart.json!.data.cart_token,cartId=cart.json!.data.id;
 const issued=await gateway.request('/v1/storefront/'+t.subdomain+'/cart/'+token+'/checkout-url');assert.equal(issued.status,200,issued.text);
 const query=new URL(issued.json!.data.checkout_url).searchParams.toString(),base='/v1/checkout/'+cartId;
 assert.equal((await gateway.request(base+'/verify-handoff?'+query)).status,200);
 owned.psql(mode==='unpublished'?`UPDATE sites SET published=false WHERE id=${q(t.siteId)};`:`UPDATE sites SET access_mode=${q(mode)} WHERE id=${q(t.siteId)};`);
 const before=owned.psql(`SELECT jsonb_build_object('sessions',(SELECT count(*) FROM checkout_sessions WHERE site_id=${q(t.siteId)}),'claims',(SELECT count(*) FROM idempotency_keys WHERE site_id=${q(t.siteId)}))::text;`);
 const read=await gateway.request(base+'/verify-handoff?'+query);
 const contact=await gateway.request(base+'/contact?'+query,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idempotency_key:crypto.randomUUID(),email:'synthetic-hosted-access@example.invalid',name:'Synthetic hosted shopper'})});
 const after=owned.psql(`SELECT jsonb_build_object('sessions',(SELECT count(*) FROM checkout_sessions WHERE site_id=${q(t.siteId)}),'claims',(SELECT count(*) FROM idempotency_keys WHERE site_id=${q(t.siteId)}))::text;`);
 const expected=mode==='offline'?503:mode==='unpublished'?404:401;
 console.info('OWNED_HOSTED_ACCESS_BASELINE '+JSON.stringify({mode,expected,read:read.status,privateLineReturned:read.text.includes(marker),contact:contact.status,before:JSON.parse(before),after:JSON.parse(after)}));
 assert.equal(read.status,expected,'signed checkout read must honor current store policy');assert.equal(contact.status,expected,'no new session/claim may begin after store refusal');assert.equal(before,after);
});

for(const lane of ['sql','rest'] as const)test(`${lane}: password handoff carries only server-issued admission and stops after rotation, expiry, mismatch and dependency failure`,async()=>{
 const gateway=gateways[lane],t=newSyntheticTenant(lane+'-hosted-proof');seedSyntheticTenant(owned.psql,t);const id=crypto.randomUUID();
 owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES(${q(id)},${q(t.siteId)},${q(t.siteId)},'Synthetic password checkout','synthetic-password-checkout',100,5,true,'active');`);
 seedSyntheticProductInventory(owned.psql,t.siteId);
 const cart=await gateway.request('/v1/storefront/'+t.subdomain+'/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[{product_id:id,quantity:1}]})});assert.equal(cart.status,201,cart.text);
 const cartId=cart.json!.data.id,cartPath='/v1/storefront/'+t.subdomain+'/cart/'+cart.json!.data.cart_token+'/checkout-url';
 const publicLink=await gateway.request(cartPath);assert.equal(publicLink.status,200);const oldQuery=new URL(publicLink.json!.data.checkout_url).searchParams.toString();
 const hash=await hashStoreAccessPassword(crypto.randomUUID());owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);
 seedSyntheticProductInventory(owned.psql,t.siteId);
 const revision=owned.psql(`SELECT encode(sha256(convert_to(${q(hash)},'UTF8')),'hex');`),gate=await createStorefrontGateToken({sid:t.siteId,host:t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,revision,exp:Math.floor(Date.now()/1000)+600},key);
 const issue=()=>gateway.request(cartPath,{headers:{'X-LetBuyy-Storefront-Gate':gate}});
 const issued=await issue();assert.equal(issued.status,200,issued.text);const query=new URL(issued.json!.data.checkout_url).searchParams.toString();
 const read=(input=query)=>gateway.request('/v1/checkout/'+cartId+'/verify-handoff?'+input);
 const display=await read();assert.equal(display.status,200,'hosted origin needs no forwarded tenant cookie');
 assert.equal(display.json!.data.presentation.id,t.siteId);assert.equal(display.json!.data.presentation.subdomain,t.subdomain);
 assert.equal('template_config' in display.json!.data.presentation,false);assert.equal('site_settings' in display.json!.data.presentation,false);assert.equal('sections' in display.json!.data.presentation,false);
 assert.ok(display.json!.data.presentation.themeSettings.primaryColor);
 assert.equal((await read(oldQuery)).status,401,'old public URL cannot borrow admission from newly issued private URL');
 const metadata=owned.psql(`SELECT checkout_handoff::text FROM carts WHERE id=${q(cartId)};`);assert.equal(metadata.includes(gate),false);assert.equal(metadata.includes(hash),false);
 const changed=await hashStoreAccessPassword(crypto.randomUUID());owned.psql(`UPDATE sites SET access_password_hash=${q(changed)} WHERE id=${q(t.siteId)};`);assert.equal((await read()).status,401);owned.psql(`UPDATE sites SET access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);
 for(const patch of [{signature:'invalid-issued-signature'},{expires_at:Math.floor(Date.now()/1000)-1},{host:'foreign.example.invalid'}]){
  const value=JSON.parse(metadata);Object.assign(value.storefront_admission,patch);owned.psql(`UPDATE carts SET checkout_handoff=${q(JSON.stringify(value))}::jsonb WHERE id=${q(cartId)};`);assert.equal((await read()).status,401);
 }
 owned.psql(`UPDATE carts SET checkout_handoff=${q(metadata)}::jsonb WHERE id=${q(cartId)};`);
 try{faultResource='sites';faultMethod='GET';assert.equal((await read()).status,503);}finally{faultResource='';faultMethod='GET';}
 assert.equal((await read()).status,200);
 try{faultResource='carts';faultMethod='PATCH';assert.equal((await issue()).status,503,'unpersisted admission must never be acknowledged');}finally{faultResource='';faultMethod='GET';}
 assert.equal(owned.psql(`SELECT checkout_handoff::text FROM carts WHERE id=${q(cartId)};`),metadata);
 owned.psql(`UPDATE carts SET checkout_handoff='{}'::jsonb WHERE id=${q(cartId)};`);assert.equal((await read()).status,401,'legacy unbound link is not password authority');owned.psql(`UPDATE sites SET access_mode='public' WHERE id=${q(t.siteId)};`);assert.equal((await read()).status,200,'public legacy link remains compatible only while currently public');
});

for(const mode of ['password','preview_only','offline'] as const)test(`delete: current ${mode} storefront policy refuses clearing a cart without authority`,async()=>{
 const t=newSyntheticTenant('delete-'+mode.replace('_','-'));seedSyntheticTenant(owned.psql,t);const gateway=gateways.rest;
 const created=await gateway.request('/v1/storefront/'+t.subdomain+'/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[],buyer_email:'synthetic-delete@example.invalid'})});assert.equal(created.status,201);const cart=created.json!.data;
 owned.psql(`UPDATE sites SET access_mode=${q(mode)} WHERE id=${q(t.siteId)};`);
 const before=owned.psql(`SELECT row_to_json(c)::text FROM carts c WHERE id=${q(cart.id)};`);const result=await gateway.request('/v1/storefront/'+t.subdomain+'/cart/'+cart.cart_token,{method:'DELETE'});const after=owned.psql(`SELECT row_to_json(c)::text FROM carts c WHERE id=${q(cart.id)};`);
 console.info('OWNED_PRIVATE_CART_DELETE_BASELINE '+JSON.stringify({mode,status:result.status,contactReturned:result.text.includes('synthetic-delete@example.invalid'),rowChanged:before!==after}));assert.equal(result.status,mode==='offline'?503:401);assert.equal(after,before);
});

test('a current password grant permits active storefront cart clearing and retains its origin',async()=>{
 const t=newSyntheticTenant('delete-password-ok');seedSyntheticTenant(owned.psql,t);const gateway=gateways.rest;
 const created=await gateway.request('/v1/storefront/'+t.subdomain+'/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[]})});assert.equal(created.status,201);const cart=created.json!.data;
 const hash=await hashStoreAccessPassword(crypto.randomUUID());owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);const revision=owned.psql(`SELECT encode(sha256(convert_to(${q(hash)},'UTF8')),'hex');`);const proof=await createStorefrontGateToken({sid:t.siteId,host:t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,revision,exp:Math.floor(Date.now()/1000)+600},key);
 const cleared=await gateway.request('/v1/storefront/'+t.subdomain+'/cart/'+cart.cart_token,{method:'DELETE',headers:{'X-LetBuyy-Storefront-Gate':proof}});assert.equal(cleared.status,200,cleared.text);assert.equal(cleared.json!.data.status,'active');assert.equal(cleared.json!.data.sales_origin,'storefront');
});


test('held SQL public metadata and full bootstrap never authorize changed private/offline/unpublished catalogue',async()=>{
 const t=newSyntheticTenant('held-sql-policy');seedSyntheticTenant(owned.psql,t);const product=crypto.randomUUID(),marker='Synthetic held SQL private catalogue';owned.psql(`UPDATE sites SET template_config=jsonb_build_object('privateMarker',${q(marker)}) WHERE id=${q(t.siteId)};INSERT INTO products(id,site_id,store_id,name,price,stock,is_active,status)VALUES(${q(product)},${q(t.siteId)},${q(t.siteId)},${q(marker)},100,8,true,'active');`);
 const held=holdOwnedStorefrontSqlSnapshot(owned,t.siteId,t.subdomain),results=[];
 try{
  for(const[mode,published,expected]of [['password',true,401],['preview_only',true,401],['offline',true,503],['public',false,404]]as const){
   owned.psql(`UPDATE sites SET access_mode=${q(mode)},published=${published} WHERE id=${q(t.siteId)};`);assert.equal(held.read().metadata!.access_mode,'public');assert.equal(held.read().store!.published,true);
   for(const path of [`/${t.subdomain}`,`/${t.subdomain}?projection=render-v1`,`/${t.subdomain}/products`,`/store/${t.siteId}`,`/store/${t.siteId}/products`,`/reviews?store_id=${t.siteId}&product_id=${product}`]){
    const r=await gateways.sql.request('/v1/storefront'+path);results.push({mode,published,path:path.replaceAll(t.subdomain,':store').replaceAll(t.siteId,':site').replaceAll(product,':product'),status:r.status,expected,markerReturned:r.text.includes(marker)});
   }
   for(const path of ['/v1/storefront/graphql','/v1/graphql/storefront']){const r=await gateways.sql.request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'query { products { edges { node { id name } } } }',variables:{storeHandle:t.subdomain,first:5}})});results.push({mode,published,path,status:r.status,expected:200,markerReturned:r.text.includes(marker),errors:Boolean(r.json!.errors)});}
  }
 }finally{held.restore();}
 console.info('OWNED_STALE_SQL_POLICY '+JSON.stringify(results));assert.deepEqual(results.filter(r=>r.status!==r.expected||r.markerReturned||'errors'in r&&!r.errors),[]);
});

test('held SQL password revision cannot admit an old gate or reject a current gate',async()=>{
 const t=newSyntheticTenant('held-sql-revision');seedSyntheticTenant(owned.psql,t);const hash=await hashStoreAccessPassword(crypto.randomUUID()),next=await hashStoreAccessPassword(crypto.randomUUID()),host=t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN;
 owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);
 const make=async(value:string)=>createStorefrontGateToken({sid:t.siteId,host,exp:Math.floor(Date.now()/1000)+600,revision:owned.psql(`SELECT encode(sha256(convert_to(${q(value)},'UTF8')),'hex');`)},key);
 const oldGate=await make(hash),newGate=await make(next),held=holdOwnedStorefrontSqlSnapshot(owned,t.siteId,t.subdomain),results=[];
 try{owned.psql(`UPDATE sites SET access_password_hash=${q(next)} WHERE id=${q(t.siteId)};`);assert.deepEqual(held.read(),held.snapshot);
  for(const path of ['', '/products'])for(const[proof,expected]of [[oldGate,401],[newGate,200]]as const){const r=await gateways.sql.request('/v1/storefront/'+t.subdomain+path,{headers:{'X-LetBuyy-Storefront-Gate':proof}});results.push({path:path||'/bootstrap',currentProof:proof===newGate,status:r.status,expected});}
 }finally{held.restore();}
 console.info('OWNED_STALE_SQL_REVISION '+JSON.stringify(results));assert.deepEqual(results.filter(r=>r.status!==r.expected),[]);
});

test('held SQL primary domain cannot retain a revoked host binding',async()=>{
 const t=newSyntheticTenant('held-sql-domain');seedSyntheticTenant(owned.psql,t);const host='held-'+t.siteId+'.example.invalid',hash=await hashStoreAccessPassword(crypto.randomUUID());owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)},custom_domain=${q(host)},custom_domain_status='active' WHERE id=${q(t.siteId)};`);
 const gate=await createStorefrontGateToken({sid:t.siteId,host,exp:Math.floor(Date.now()/1000)+600,revision:owned.psql(`SELECT encode(sha256(convert_to(${q(hash)},'UTF8')),'hex');`)},key),held=holdOwnedStorefrontSqlSnapshot(owned,t.siteId,t.subdomain);let status=0;
 try{owned.psql(`UPDATE sites SET custom_domain_status='pending' WHERE id=${q(t.siteId)};`);assert.equal(held.read().metadata!.custom_domain_status,'active');status=(await gateways.sql.request('/v1/storefront/'+t.subdomain+'/products',{headers:{'X-LetBuyy-Storefront-Gate':gate}})).status;}finally{held.restore();}
 console.info('OWNED_STALE_SQL_DOMAIN '+JSON.stringify({status,expected:401}));assert.equal(status,401);
});

test('held SQL success never substitutes for an unavailable live authority lookup',async()=>{
 const t=newSyntheticTenant('held-sql-outage');seedSyntheticTenant(owned.psql,t);const held=holdOwnedStorefrontSqlSnapshot(owned,t.siteId,t.subdomain);let status=0;
 try{faultResource='sites';status=(await gateways.sql.request('/v1/storefront/'+t.subdomain+'/products')).status;}finally{faultResource='';held.restore();}
 assert.equal((await gateways.sql.request('/v1/storefront/'+t.subdomain+'/products')).status,200);console.info('OWNED_STALE_SQL_AUTHORITY_OUTAGE '+JSON.stringify({status,expected:503,recovered:true}));assert.equal(status,503);
});

test('held SQL handle reassignment cannot return the former tenant bootstrap or products',async()=>{
 const old=newSyntheticTenant('held-sql-former'),current=newSyntheticTenant('held-sql-current');seedSyntheticTenant(owned.psql,old);seedSyntheticTenant(owned.psql,current);const marker='Synthetic former private tenant',id=crypto.randomUUID();owned.psql(`UPDATE sites SET template_config=jsonb_build_object('privateMarker',${q(marker)}) WHERE id=${q(old.siteId)};INSERT INTO products(id,store_id,site_id,name,price,stock,is_active,status)VALUES(${q(id)},${q(old.siteId)},${q(old.siteId)},${q(marker)},100,3,true,'active');`);const held=holdOwnedStorefrontSqlSnapshot(owned,old.siteId,old.subdomain),results=[];
 try{owned.psql(`UPDATE sites SET subdomain=${q(old.subdomain+'-former')},access_mode='password' WHERE id=${q(old.siteId)};UPDATE sites SET subdomain=${q(old.subdomain)} WHERE id=${q(current.siteId)};`);assert.equal(held.read().store!.id,old.siteId);
  for(const compact of [false,true]){const r=await gateways.sql.request('/v1/storefront/'+old.subdomain+(compact?'?projection=render-v1':''));results.push({compact,status:r.status,currentSite:r.json?.data?.id===current.siteId,markerReturned:r.text.includes(marker)});}
  const products=await gateways.sql.request('/v1/storefront/'+old.subdomain+'/products');results.push({compact:false,status:products.status,currentSite:!products.text.includes(marker),markerReturned:products.text.includes(marker)});
 }finally{held.restore();}
 console.info('OWNED_STALE_SQL_REASSIGNED_HANDLE '+JSON.stringify(results));assert.deepEqual(results.filter(r=>r.status!==200||!r.currentSite||r.markerReturned),[]);
});

test('held SQL absence cannot hide a newly published real store',async()=>{
 const t=newSyntheticTenant('held-sql-absence');seedSyntheticTenant(owned.psql,t);owned.psql(`UPDATE sites SET published=false,status='draft' WHERE id=${q(t.siteId)};`);const held=holdOwnedStorefrontSqlSnapshot(owned,t.siteId,t.subdomain),results=[];assert.deepEqual(held.snapshot,{metadata:null,store:null});
 try{owned.psql(`UPDATE sites SET published=true,status='published' WHERE id=${q(t.siteId)};`);assert.deepEqual(held.read(),held.snapshot);
  for(const path of ['', '?projection=render-v1','/products']){const r=await gateways.sql.request('/v1/storefront/'+t.subdomain+path);results.push({path:path||'/bootstrap',status:r.status});}
 }finally{held.restore();}
 console.info('OWNED_STALE_SQL_ABSENCE '+JSON.stringify(results));assert.deepEqual(results.filter(r=>r.status!==200),[]);
});

test('current canonical Core publish pointer wins over held full-site SQL content',async()=>{
 const t=newSyntheticTenant('held-sql-publish');seedSyntheticTenant(owned.psql,t);const actor=crypto.randomUUID(),email='synthetic-held-publisher-'+actor+'@example.invalid';owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES(${q(actor)},${q(email)},true);UPDATE sites SET custom_user_id=${q(actor)} WHERE id=${q(t.siteId)};`);
 const request=async(path:string,method='GET',body?:unknown)=>gateways.sql.request(path,{method,headers:await signedIdentityHeaders(actor,email,t.siteId),...(body?{body:JSON.stringify(body)}:{})});
 const publish=async(name:'Forge'|'Sense')=>{const loaded=await request('/v1/themes/letbuyy-core/editor?store_id='+t.siteId);assert.equal(loaded.status,200,loaded.text);let config=loaded.json!.data.template_config;const presets=config.liquidBundle.config.settings_data.presets,current={...config.themeSettings,...presets[name]};config={...config,experienceId:name.toLowerCase(),themeSettings:current,settings_data:{...config.settings_data,current,presets},config:{...config.config,settings_data:{...config.config?.settings_data,current,presets}}};const saved=await request('/v1/themes/letbuyy-core/editor/draft','PUT',{store_id:t.siteId,template_key:'index',template_config:config,base_version:loaded.json!.data.version,idempotency_key:crypto.randomUUID(),client:'api'});assert.equal(saved.status,200,saved.text);const published=await request('/v1/themes/letbuyy-core/publish','POST',{store_id:t.siteId,base_version:saved.json!.data.version,idempotency_key:crypto.randomUUID(),make_store_live:true});assert.equal(published.status,200,published.text);return current.primaryColor;};
 await publish('Forge');const held=holdOwnedStorefrontSqlSnapshot(owned,t.siteId,t.subdomain),results=[];
 try{const color=await publish('Sense');const release=owned.psql(`SELECT current_theme_release_id FROM sites WHERE id=${q(t.siteId)};`);assert.notEqual(release,held.snapshot.store!.current_theme_release_id);assert.deepEqual(held.read(),held.snapshot);
  for(const compact of [false,true]){const r=await gateways.sql.request('/v1/storefront/'+t.subdomain+(compact?'?projection=render-v1':''));results.push({compact,status:r.status,currentRelease:r.json?.data?.current_theme_release?.id===release,currentPrimary:r.json?.data?.template_config?.themeSettings?.primaryColor===color});}
 }finally{held.restore();}
 console.info('OWNED_STALE_SQL_PUBLISHED_POINTER '+JSON.stringify(results));assert.deepEqual(results.filter(r=>r.status!==200||!r.currentRelease||!r.currentPrimary),[]);
});
