import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { before } from 'node:test';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import { dispatchPushNotificationToDevices } from '../../services/queue-workers/src/push-dispatcher';
import { Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant,seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned=requireOwnedDatabase(),site=newSyntheticTenant('push-pref'),other=newSyntheticTenant('push-other'),actor=randomUUID();
let gateway:Gateway,db:ReturnType<typeof createSupabaseServiceClient>;
before(async()=>{
  for(const s of [site,other])seedSyntheticTenant(owned.psql,s);
  owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','syn-${actor}@example.invalid',true); UPDATE sites SET custom_user_id='${actor}' WHERE id IN ('${site.siteId}','${other.siteId}');`);
  const env=gatewayEnv(owned,await newIdentityKeys());gateway=new Gateway(env);db=createSupabaseServiceClient(env);
  const r=await gateway.request('/v1/notifications/device-tokens',{method:'POST',headers:{...await signedIdentityHeaders(actor,`syn-${actor}@example.invalid`),'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({token:'synthetic-push-test-'+randomUUID(),platform:'android'})});
  assert.equal(r.status,201,r.text);
});
async function setPreference(category:string,enabled:boolean,storeId=site.siteId){
  const r=await gateway.request('/v1/notifications/preferences',{method:'PUT',headers:{...await signedIdentityHeaders(actor,`syn-${actor}@example.invalid`),'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({store_id:storeId,channel:'push',category,enabled})});
  assert.equal(r.status,200,r.text);
}
async function dispatch(){return dispatchPushNotificationToDevices(db,{PUSH_DISPATCH_MODE:'dry-run'},{userId:actor,siteId:site.siteId,category:'order_created',title:'Synthetic',message:'Synthetic only',data:{}});}
test('real persisted master push switch suppresses dispatch and re-enable restores its dry-run plan',async()=>{
  await setPreference('system',false);let r=await dispatch();assert.equal(r.sent,0);assert.equal(r.skipped,1);
  await setPreference('system',true);r=await dispatch();assert.equal(r.sent,1);assert.equal(r.dryRun,true);
});
test('event-specific push preference persists and gates sends; another store cannot suppress this store',async()=>{
  await setPreference('order_created',false);assert.equal((await dispatch()).skipped,1);
  await setPreference('order_created',true);await setPreference('system',false,other.siteId);
  const r=await dispatch();assert.equal(r.sent,1);assert.equal(r.skipped,0);
});
