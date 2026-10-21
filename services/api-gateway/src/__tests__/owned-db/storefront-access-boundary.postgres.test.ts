// Mounted Gateway -> real owned PostgreSQL/PostgREST. Public catalogue scope;
// independent buyer-history/marketplace channel authority is not substituted.
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET} from './gateway-harness';
import {createStorefrontGateToken,createStorefrontPreviewToken} from '@letbuyy/auth-core';
import {hashStoreAccessPassword} from '../../lib/store-access-password';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();let gateway:Gateway;
const q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const key='synthetic-visitor-shared-key-fixture';
before(async()=>{gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{NEXT_PUBLIC_STORE_ROOT_DOMAIN:'letbuyy.store',FEATURE_GRAPHQL:'true',STORE_ACCESS_SIGNING_KEY:key,PREVIEW_SIGNING_KEY:key}));});
after(()=>gateway?.settle());
for(const mode of ['public','password','preview_only','offline'])test(`current ${mode} policy controls direct catalogue HTTP paths`,async()=>{
 const t=newSyntheticTenant('access-'+mode.replace('_','-'));seedSyntheticTenant(owned.psql,t);const id=crypto.randomUUID(),marker='Synthetic protected catalogue '+mode;
 owned.psql(`UPDATE sites SET access_mode=${q(mode)},template_config=jsonb_build_object('privateMarker',${q(marker)}) WHERE id=${q(t.siteId)};
 INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES(${q(id)},${q(t.siteId)},${q(t.siteId)},${q(marker)},'synthetic-access-product',100,5,true,'active');`);
 const paths=[`/${t.subdomain}`,`/${t.subdomain}?projection=render-v1`,`/store/${t.siteId}`,`/store/${t.siteId}/products`,`/${t.subdomain}/products`,`/${t.subdomain}/products/${id}`,`/${t.subdomain}/collections`,`/${t.subdomain}/navigation`,`/${t.subdomain}/policies`,`/${t.subdomain}/pages`,`/${t.subdomain}/categories`,`/reviews?store_id=${t.siteId}&product_id=${id}`];
 const expected=mode==='public'?200:mode==='offline'?503:401;
 const results=[];
 for(const path of paths){const result=await gateway.request('/v1/storefront'+path);results.push({path:path.replace(t.subdomain,':store').replace(t.siteId,':site').replace(id,':product'),status:result.status,expected,markerReturned:result.text.includes(marker)});}
 console.info('OWNED_STOREFRONT_ACCESS_MATRIX '+JSON.stringify({mode,results}));
 assert.deepEqual(results.filter(r=>r.status!==r.expected),[],'every catalogue path must honor current visitor policy');
 const status=await gateway.request(`/v1/storefront/${t.subdomain}/status`);assert.equal(status.status,200);assert.equal('template_config'in status.json!.data,false);
});

test('password proof admits its store, refuses spoofing/foreign hosts and stops after password rotation or mode change',async()=>{
 const t=newSyntheticTenant('access-password-ok');seedSyntheticTenant(owned.psql,t);const host=t.subdomain+'.letbuyy.store',password='Synthetic-store-password-42!';
 const hash=await hashStoreAccessPassword(password);owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);
 const verify=await gateway.request('/v1/internal/store-access/verify',{method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({site_id:t.siteId,host,password,ip:'2001:db8::42'})});assert.equal(verify.status,200);
 const revision=verify.json!.data.access_revision;assert.match(revision,/^[a-f0-9]{64}$/);
 const token=await createStorefrontGateToken({sid:t.siteId,host,exp:Math.floor(Date.now()/1000)+3600,revision},key);
 const path=`/v1/storefront/${t.subdomain}?projection=render-v1`;
 const read=(proof=token)=>gateway.request(path,{headers:{'X-LetBuyy-Storefront-Gate':proof}});
 const allowed=await read();assert.equal(allowed.status,200);assert.equal(allowed.headers.get('Cache-Control'),'no-store');assert.doesNotMatch(allowed.text,/access_password_hash|\$argon2id/);
 const spoof=await gateway.request(path,{headers:{'X-Client':'storefront-web','X-Internal-API-Secret':INTERNAL_SECRET,Origin:'https://'+host}});assert.equal(spoof.status,401);
 const wrongHost=await createStorefrontGateToken({sid:t.siteId,host:'foreign.letbuyy.store',exp:Math.floor(Date.now()/1000)+3600,revision},key);assert.equal((await read(wrongHost)).status,401);
 const newHash=await hashStoreAccessPassword('Synthetic-rotated-password-42!');owned.psql(`UPDATE sites SET access_password_hash=${q(newHash)} WHERE id=${q(t.siteId)};`);assert.equal((await read()).status,401);
 owned.psql(`UPDATE sites SET access_password_hash=${q(hash)},access_mode='preview_only' WHERE id=${q(t.siteId)};`);
 assert.equal((await gateway.request(path,{headers:{'X-LetBuyy-Storefront-Preview':token}})).status,401,'same signing key cannot promote password proof into preview');
});

test('preview reads require a current matching link and stop immediately after revocation, expiry, deletion or offline mode',async()=>{
 const t=newSyntheticTenant('access-preview-ok');seedSyntheticTenant(owned.psql,t);const host=t.subdomain+'.letbuyy.store',jti=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+600;
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
