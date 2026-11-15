// Actual mounted owner-scoped library, real owned PG/PostgREST and captured package metadata.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {requireOwnedDatabase} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
test('owned library reports captured immutable version after a catalog update, while a foreign owner cannot read it',async()=>{
 const tenant=newSyntheticTenant('library-artwork'),other=newSyntheticTenant('library-foreign');seedSyntheticTenant(owned.psql,tenant);seedSyntheticTenant(owned.psql,other);
 const actor=randomUUID(),foreign=randomUUID(),email=`artwork-${actor}@example.invalid`,foreignEmail=`artwork-${foreign}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Synthetic artwork owner'),('${foreign}','${foreignEmail}',true,'Synthetic other owner');UPDATE sites SET custom_user_id='${actor}' WHERE id='${tenant.siteId}';UPDATE sites SET custom_user_id='${foreign}' WHERE id='${other.siteId}';SET ROLE service_role;SELECT install_owned_theme_v1('${actor}','${tenant.siteId}',t.slug,t.default_template,jsonb_build_object('theme_package_id',p.id,'theme_package_version_id',v.id),'${tenant.siteId}',NULL,'synthetic-owned-library-artwork') FROM themes t JOIN theme_packages p ON p.slug=t.slug AND p.deleted_at IS NULL JOIN theme_package_versions v ON v.theme_package_id=p.id AND v.version=t.version AND v.deleted_at IS NULL WHERE t.slug='letbuyy-forge' AND t.owned_by_site_id IS NULL;RESET ROLE;`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{NODE_ENV:'production'}));
 try{
  const result=await gateway.request('/v1/themes/library?store_id='+tenant.siteId,{headers:await signedIdentityHeaders(actor,email,tenant.siteId)});assert.equal(result.status,200,result.text);
  const circuit=result.json?.data.themes.find((t:{slug:string})=>t.slug==='letbuyy-forge');assert.ok(circuit);assert.equal(circuit.version,'2.1.0');assert.ok(circuit.theme_package_version_id);
  const captured=owned.psql(`SELECT v.version FROM theme_instances i JOIN theme_package_versions v ON v.id=i.theme_package_version_id WHERE i.store_id='${tenant.siteId}' AND i.theme_slug='letbuyy-forge' AND i.deleted_at IS NULL;`);assert.equal(captured,circuit.version);
  owned.psql(`UPDATE themes SET version='3.0.0' WHERE slug='letbuyy-forge' AND owned_by_site_id IS NULL;`);
  const newerCatalog=await gateway.request('/v1/themes/library?store_id='+tenant.siteId,{headers:await signedIdentityHeaders(actor,email,tenant.siteId)});assert.equal(newerCatalog.status,200,newerCatalog.text);assert.equal(newerCatalog.json?.data.themes.find((t:{slug:string})=>t.slug==='letbuyy-forge').version,'2.1.0');
  const denied=await gateway.request('/v1/themes/library?store_id='+tenant.siteId,{headers:await signedIdentityHeaders(foreign,foreignEmail,other.siteId)});assert.equal(denied.status,403,denied.text);assert.doesNotMatch(denied.text,/thumbnail_url|theme_package_version_id/);
 }finally{await gateway.settle();}
});
