import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
test('all ten persisted Core presets save through the real editor API',async()=>{
 const tenant=newSyntheticTenant('preset-save');seedSyntheticTenant(owned.psql,tenant);
 const actor=randomUUID(),email=`syn-preset-${actor}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}' WHERE id='${tenant.siteId}';`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
 const request=async(path:string,method='GET',body?:unknown)=>gateway.request(path,{method,headers:await signedIdentityHeaders(actor,email,tenant.siteId),...(body?{body:JSON.stringify(body)}:{})});
 try {
  const loaded=await request(`/v1/themes/letbuyy-core/editor?store_id=${tenant.siteId}`);assert.equal(loaded.status,200,loaded.text);
  let config=loaded.json!.data.template_config,version=loaded.json!.data.version;
  const presets=config.liquidBundle.config.settings_data.presets;assert.equal(Object.keys(presets).length,10);
  for(const [name,values]of Object.entries(presets)){
   const current={...config.themeSettings,...values as object};
   config={...config,experienceId:name.toLowerCase(),themeSettings:current,settings_data:{...config.settings_data,current,presets},config:{...config.config,settings_data:{...config.config?.settings_data,current,presets}}};
   const saved=await request('/v1/themes/letbuyy-core/editor/draft','PUT',{store_id:tenant.siteId,template_key:'index',template_config:config,base_version:version,idempotency_key:randomUUID(),client:'api'});
   assert.equal(saved.status,200,name+': '+saved.text);version=saved.json!.data.version;
  }
  console.log('WEEK1_CORE_PRESET_API_PASS',JSON.stringify({count:10,realGateway:true,realOwnedDatabase:true}));
 }finally{await gateway.settle();}
});
