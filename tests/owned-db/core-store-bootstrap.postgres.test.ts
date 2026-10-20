// Real canonical Gateway and owned PostgreSQL; only synthetic verified account credentials.
// No theme/package, storefront, editor release, product or buyer is seeded by this suite.
import assert from 'node:assert/strict';
import test from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
const owned=requireOwnedDatabase();
async function fixture(){
 const id=crypto.randomUUID(),email=`syn-core-bootstrap-${id}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${id}','${email}',true);`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
 return {id,gateway,create:async(theme='letbuyy-core',key=crypto.randomUUID())=>{
  const slug='syn-core-'+crypto.randomUUID().slice(0,8);
  const body={name:'Synthetic Core Store',subdomain:slug,site_type:'store',theme_id:theme,template_config:{survey:{industry:'food'}}};
  const headers=await signedIdentityHeaders(id,email);
  const request=()=>gateway.request('/v1/stores',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Idempotency-Key':key},body:JSON.stringify(body)});
  // Identity headers are short lived and carry unique request JTIs; generate on each replay.
  return {slug,body,key,response:await request(),replay:async()=>gateway.request('/v1/stores',{method:'POST',headers:{...await signedIdentityHeaders(id,email),'Content-Type':'application/json','X-Idempotency-Key':key},body:JSON.stringify(body)})};
 }};
}
test('explicit Core web creation stores a validated Liquid document and replays without new rows',async()=>{
 const f=await fixture();try{
 const r=await f.create();assert.equal(r.response.status,201);
 const siteId=String(r.response.json?.data?.id);assert.match(siteId,/^[a-f0-9-]{36}$/);
 const config=JSON.parse(owned.psql(`SELECT template_config::text FROM sites WHERE id='${siteId}';`));
 assert.equal(config.liquidBundle?.package?.slug,'letbuyy-core-liquid','the new store must use the actual catalog Liquid package');
 assert.equal(Object.keys(config.liquidBundle.config.settings_data.presets).length,10);
 assert.equal(config.survey.industry,'food');assert.equal(config.themeId,'letbuyy-core');
 assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${siteId}';`),'draft');
 const replay=await r.replay();assert.equal(replay.status,201);assert.equal(replay.json?.data?.id,siteId);
 assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE custom_user_id='${f.id}';`),'1');
 const legacy=await f.create('modern');assert.equal(legacy.response.status,201,'explicit older-client theme inputs remain supported');
 assert.equal(owned.psql(`SELECT theme_id FROM sites WHERE id='${legacy.response.json?.data?.id}';`),'modern');
 }finally{await f.gateway.settle();}
});
test('unavailable or invalid Core catalog fails before creating a store and can recover',async()=>{
 const f=await fixture();const original=owned.psql("SELECT default_template::text FROM themes WHERE slug='letbuyy-core';");
 try{
 owned.psql("UPDATE themes SET is_active=false WHERE slug='letbuyy-core';");
 const missing=await f.create();assert.equal(missing.response.status,503,'catalog unavailability is not a successful blank store');
 assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE custom_user_id='${f.id}';`),'0');
 owned.psql("UPDATE themes SET is_active=true,default_template='{}'::jsonb WHERE slug='letbuyy-core';");
 const invalid=await f.create();assert.equal(invalid.response.status,503,'malformed canonical Core cannot fall back to portable-only content');
 assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE custom_user_id='${f.id}';`),'0');
 owned.psql(`UPDATE themes SET default_template='${original.replace(/'/g,"''")}'::jsonb WHERE slug='letbuyy-core';`);
 const recovered=await f.create();assert.equal(recovered.response.status,201);
 }finally{owned.psql(`UPDATE themes SET is_active=true,default_template='${original.replace(/'/g,"''")}'::jsonb WHERE slug='letbuyy-core';`);await f.gateway.settle();}
});
