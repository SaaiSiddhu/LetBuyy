// Mounted Gateway and owned PostgREST; signed identity is an explicit fixture.
import assert from 'node:assert/strict';
import test from 'node:test';
import {requireOwnedDatabase} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();

test('registered content reads have a positive owner control and reject inherited registry names',async()=>{
 const a=newSyntheticTenant('content-section'),owner=crypto.randomUUID(),email=`syn-content-${owner}@example.invalid`;
 seedSyntheticTenant(owned.psql,a);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email}',true);UPDATE sites SET custom_user_id='${owner}'WHERE id='${a.siteId}';`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
 try{
  const positive=await gateway.request('/v1/resume/section/projects?store_id='+a.siteId,{headers:await signedIdentityHeaders(owner,email,a.siteId)});
  assert.equal(positive.status,200,positive.text);assert.ok(Array.isArray(positive.json?.data));
  for(const section of ['constructor','toString','__proto__','hasOwnProperty']){
   const refused=await gateway.request('/v1/resume/section/'+section+'?store_id='+a.siteId,{headers:await signedIdentityHeaders(owner,email,a.siteId)});
   assert.equal(refused.status,400,'unregistered content section '+section+' must not reach a table adapter');
   assert.equal(refused.json?.error.code,'VALIDATION');
  }
 }finally{await gateway.settle();}
});
