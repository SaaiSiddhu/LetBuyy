// Mounted Gateway -> real owned PostgreSQL/PostgREST. Public catalogue scope;
// independent buyer-history/marketplace channel authority is not substituted.
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();let gateway:Gateway;
const q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
before(async()=>{gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{NEXT_PUBLIC_STORE_ROOT_DOMAIN:'letbuyy.store',FEATURE_GRAPHQL:'true'}));});
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
