// Independent local-only failure reproduction. Actual compiled canonical Worker,
// real isolated Postgres/PostgREST and local R2; no device/provider/hosted claim.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {NativeGateway} from '../../../../tests/helpers/native-owned-gateway';
import {requireOwnedDatabase} from '../../../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {gatewayEnv,newIdentityKeys,signedIdentityHeaders} from '../../../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
const owned=requireOwnedDatabase();
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEklEQVR4nGOYNH3Rf2TMQLoAAOM/LKFDq3imAAAAAElFTkSuQmCC','base64');
async function setup(fault:'receipt-completion'|'registry-write'|'none'){
 const tenant=newSyntheticTenant('media-create-'+randomUUID().slice(0,8)),owner=randomUUID(),email=`syn-${randomUUID()}@example.invalid`;
 seedSyntheticTenant(owned.psql,tenant);owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email}',true);UPDATE sites SET custom_user_id='${owner}'WHERE id='${tenant.siteId}';`);
 let fired=false,claimId:string|undefined;
 const gateway=await NativeGateway.create(gatewayEnv(owned,await newIdentityKeys(),{UPLOAD_PUBLIC_BASE_URL:'https://cdn.fixture.invalid/assets'}) as unknown as Record<string,unknown>,async()=>{throw new Error('Media must not send email');},async(request,forward)=>{
  const url=new URL(request.url),table=url.pathname.split('/').pop();
  if(table==='idempotency_keys'&&request.method==='POST'){
   const body=await request.clone().json() as {site_id?:string;scope?:string};const response=await forward();
   if(body.site_id===tenant.siteId&&body.scope==='http:POST:/media'&&response.ok){const row=await response.clone().json() as {id:string}|{id:string}[];claimId=Array.isArray(row)?row[0]?.id:row.id;}
   return response;
  }
  if(!fired&&fault==='receipt-completion'&&claimId&&table==='idempotency_keys'&&request.method==='PATCH'&&url.searchParams.get('id')==='eq.'+claimId){
   const body=await request.clone().json() as {status?:string};if(body.status==='completed'){fired=true;return Response.json({code:'XX000',message:'Synthetic original media acknowledgement outage'},{status:503});}
  }
  if(!fired&&fault==='registry-write'&&table==='media_assets'&&request.method==='POST'){fired=true;return Response.json({code:'XX000',message:'Synthetic registry write outage'},{status:503});}
  return forward();
 });
 try{
 const headers=()=>signedIdentityHeaders(owner,email,tenant.siteId);
 const form=new FormData();form.set('store_id',tenant.siteId);form.set('folder','media');form.set('sha256_hex',createHash('sha256').update(bytes).digest('hex'));form.set('file',new File([bytes],'owned.png',{type:'image/png'}));
 const uploadHeaders=await headers();delete uploadHeaders['Content-Type'];uploadHeaders['X-Idempotency-Key']=randomUUID();
 const wire=new Request('https://gateway.test/v1/upload',{method:'POST',headers:uploadHeaders,body:form});const response=await gateway.dispatch('/v1/upload',{method:'POST',headers:wire.headers,body:await wire.arrayBuffer()});
 assert.equal(response.status,201,await response.clone().text());const uploaded=await response.json() as {data:{key:string;url:string;size:number;content_type:string}};
 const key='media-create-'+randomUUID(),payload={store_id:tenant.siteId,filename:'owned.png',original_name:'owned.png',url:uploaded.data.url,storage_key:uploaded.data.key,mime_type:uploaded.data.content_type,size_bytes:uploaded.data.size,folder:'media',alt_text:'Synthetic owned media',tags:[]};
 const create=async()=>gateway.dispatch('/v1/media',{method:'POST',headers:{...await headers(),'X-Idempotency-Key':key},body:JSON.stringify(payload)});
 return{tenant,gateway,headers,key,create,claim:()=>claimId,fired:()=>fired,rows:()=>Number(owned.psql(`SELECT count(*)FROM media WHERE store_id='${tenant.siteId}'`)),assets:()=>Number(owned.psql(`SELECT count(*)FROM media_assets WHERE site_id='${tenant.siteId}'`)),events:()=>Number(owned.psql(`SELECT count(*)FROM outbox_events WHERE site_id='${tenant.siteId}'AND event_type='media.processed'`))};
 }catch(error){await gateway.settle();throw error;}
}
test('populated real Media control creates and replays one library/registry/outbox effect',async()=>{
 const f=await setup('none');try{const first=await f.create();assert.equal(first.status,201,await first.clone().text());const ack=await first.json();const replay=await f.create();assert.equal(replay.status,201);assert.deepEqual(await replay.json(),ack);assert.equal(f.rows(),1);assert.equal(f.assets(),1);assert.equal(f.events(),1);}finally{await f.gateway.settle();}
});
test('lost original Media creation receipt must not duplicate a library row on the same-key expired-lease retry',async()=>{
 const f=await setup('receipt-completion');try{
  const first=await f.create();assert([500,503].includes(first.status),'Injected unconfirmed completion must never return success');assert(f.fired()&&f.claim());assert.equal(f.rows(),1,'Positive effect control: first request actually committed its library row');
  owned.psql(`UPDATE idempotency_keys SET locked_until=now()-interval '1 second'WHERE id='${f.claim()}'AND site_id='${f.tenant.siteId}';`);
  const retry=await f.create();assert.equal(retry.status,201,await retry.clone().text());assert.equal(f.rows(),1,'One original command must produce exactly one library row');assert.equal(f.assets(),1);assert.equal(f.events(),1);
 }finally{await f.gateway.settle();}
});
test('registry-write failure must not strand a committed library row outside its receipt transaction',async()=>{
 const f=await setup('registry-write');try{const first=await f.create();assert([500,503].includes(first.status));assert(f.fired());assert.equal(f.rows(),0,'Failed registry stage must roll back the library effect');assert.equal(f.assets(),0);assert.equal(f.events(),0);}finally{await f.gateway.settle();}
});
test('Media metadata rejects wrong primitive types before changing its durable row',async()=>{
 const f=await setup('none');try{const created=await f.create();assert.equal(created.status,201);const body=await created.json() as {data:{id:string}};const changed=await f.gateway.dispatch('/v1/media/'+body.data.id,{method:'PATCH',headers:{...await f.headers(),'X-Idempotency-Key':randomUUID()},body:JSON.stringify({alt_text:1234})});assert.equal(changed.status,400,'Numeric alt text must not be coerced into a valid string');assert.equal(owned.psql(`SELECT alt_text FROM media WHERE id='${body.data.id}'`),'Synthetic owned media');}finally{await f.gateway.settle();}
});
