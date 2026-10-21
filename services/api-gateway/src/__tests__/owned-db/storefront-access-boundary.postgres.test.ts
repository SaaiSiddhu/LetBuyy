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
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();let gateways:Record<'sql'|'rest',Gateway>,proxy:OwnedPooledSqlProxy,tap:RestTap;
const q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const key='synthetic-visitor-shared-key-fixture';
let faultResource='',faultCode='';
before(async()=>{
 proxy=await startOwnedPooledSqlProxy(owned);const keys=await newIdentityKeys();const env={NEXT_PUBLIC_STORE_ROOT_DOMAIN:DEFAULT_STOREFRONT_DOMAIN,FEATURE_GRAPHQL:'true',STORE_ACCESS_SIGNING_KEY:key,PREVIEW_SIGNING_KEY:key};
 gateways={rest:new Gateway(gatewayEnv(owned,keys,env)),sql:new Gateway(gatewayEnv(owned,keys,{...env,...proxy.env()}))};
 tap=tapRest(owned.restUrl,async(call,forward)=>call.method==='GET'&&call.resource===faultResource?restJson(faultCode?404:503,{code:faultCode||'SYNTHETIC_DEPENDENCY',message:'Synthetic private host resolution failure'}):forward());
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
 for(const path of paths){const result=await gateway.request('/v1/storefront'+path);results.push({path:path.replace(t.subdomain,':store').replace(t.siteId,':site').replace(id,':product'),status:result.status,expected,markerReturned:result.text.includes(marker)});}
 console.info('OWNED_STOREFRONT_ACCESS_MATRIX '+JSON.stringify({lane,mode,results,siteRestReads:tap.calls.slice(start).filter(c=>c.resource==='sites').length}));
 assert.deepEqual(results.filter(r=>r.status!==r.expected),[],'every catalogue path must honor current visitor policy');
 if(mode!=='public')assert.equal(results.some(r=>r.markerReturned),false);
 if(lane==='sql')assert.equal(tap.calls.slice(start).filter(c=>c.resource==='sites').length,0,'actual SQL metadata succeeds without a sites REST substitute');
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
