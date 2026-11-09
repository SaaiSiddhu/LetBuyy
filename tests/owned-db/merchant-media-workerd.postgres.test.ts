// Actual bundled canonical Gateway in workerd + real isolated PG/PostgREST +
// ephemeral local R2. No device, browser, external provider or hosted claim.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import test from 'node:test';
import {NativeGateway} from '../helpers/native-owned-gateway';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {gatewayEnv,newIdentityKeys,signedIdentityHeaders} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
const owned=requireOwnedDatabase();
test('compiled workerd hashes, replays and recovers one upload in owned local R2, then denies revocation', async()=>{
 const tenant=newSyntheticTenant('media-workerd'), owner=randomUUID(), replacement=randomUUID();
 const email=`syn-${owner}@example.invalid`, key=randomUUID();
 seedSyntheticTenant(owned.psql,tenant);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES ('${owner}','${email}',true),('${replacement}','syn-${replacement}@example.invalid',true); UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
 const gateway=await NativeGateway.create(gatewayEnv(owned,await newIdentityKeys()) as unknown as Record<string,unknown>, async()=>{throw new Error('Media may not send email');});
 try {
  const bytes=JSON.stringify({asset:{version:'2.0'}}), digest=createHash('sha256').update(bytes).digest('hex');
  async function upload(){
   const headers=await signedIdentityHeaders(owner,email,tenant.siteId); delete headers['Content-Type'];headers['X-Idempotency-Key']=key;
   const form=new FormData();form.set('store_id',tenant.siteId);form.set('folder','media');form.set('sha256_hex',digest);
   form.set('file',new File([bytes],'owned.gltf',{type:'model/gltf+json'}));
   const wire=new Request('https://gateway.test/v1/upload',{method:'POST',headers,body:form});
   return gateway.dispatch('/v1/upload',{method:'POST',headers:wire.headers,body:await wire.arrayBuffer()});
  }
  const first=await upload();const original=await first.json() as {data:{key:string}};
  assert.equal(first.status,201,JSON.stringify(original));
  const repeat=await upload();assert.equal(repeat.status,201);assert.deepEqual(await repeat.json(),original);
  const bucket=await gateway.mf.getR2Bucket('R2_BUCKET');
  const object=await bucket.get(original.data.key);assert.ok(object);assert.equal(await object.text(),bytes);
  assert.equal((await bucket.list()).objects.length,1);
  const input={store_id:tenant.siteId,idempotency_key:key,filename:'owned.gltf',folder:'media',content_type:'model/gltf+json',byte_size:Buffer.byteLength(bytes),sha256_hex:digest};
  const recover=async()=>gateway.dispatch('/v1/upload/recover',{method:'POST',headers:await signedIdentityHeaders(owner,email,tenant.siteId),body:JSON.stringify(input)});
  const recovered=await recover();assert.equal(recovered.status,200);assert.deepEqual(await recovered.json(),original);
  assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${tenant.siteId}'`),'1');
  owned.psql(`UPDATE sites SET custom_user_id='${replacement}' WHERE id='${tenant.siteId}'`);
  assert.equal((await upload()).status,403);assert.equal((await recover()).status,403);
  assert.equal((await bucket.list()).objects.length,1);
 } finally {await gateway.settle();}
});

test('compiled workerd recovers a lost SQL upload acknowledgement and returns a strict private KYC projection', async()=>{
 const tenant=newSyntheticTenant('media-kyc-native'), owner=randomUUID(), key=randomUUID();
 const email=`syn-${owner}@example.invalid`;
 seedSyntheticTenant(owned.psql,tenant);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES ('${owner}','${email}',true); UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
 let loseCompletion=true;
 const gateway=await NativeGateway.create(gatewayEnv(owned,await newIdentityKeys(),{KYC_UPLOAD_ENABLED:'true'}) as unknown as Record<string,unknown>,
  async()=>{throw new Error('Upload proof may not send email');}, async(request,forward)=>{
   if(loseCompletion&&request.method==='PATCH'&&new URL(request.url).pathname.endsWith('/idempotency_keys')){
    const body=await request.clone().json() as {status?:string};
    if(body.status==='completed'){loseCompletion=false;return Response.json({code:'XX000',message:'Synthetic acknowledgement outage'},{status:503});}
   }
   return forward();
  });
 try{
  const bytes=JSON.stringify({asset:{version:'2.0'}}),digest=createHash('sha256').update(bytes).digest('hex');
  const headers=await signedIdentityHeaders(owner,email,tenant.siteId);delete headers['Content-Type'];headers['X-Idempotency-Key']=key;
  const form=new FormData();form.set('store_id',tenant.siteId);form.set('folder','media');form.set('sha256_hex',digest);form.set('file',new File([bytes],'owned.gltf',{type:'model/gltf+json'}));
  const wire=new Request('https://gateway.test/v1/upload',{method:'POST',headers,body:form});
  const first=await gateway.dispatch('/v1/upload',{method:'POST',headers:wire.headers,body:await wire.arrayBuffer()});
  assert.equal(first.status,503,await first.text());
  const publicBucket=await gateway.mf.getR2Bucket('R2_BUCKET');assert.equal((await publicBucket.list()).objects.length,1);
  assert.equal(owned.psql(`SELECT status FROM idempotency_keys WHERE site_id='${tenant.siteId}' AND key='${key}'`),'processing');
  const recovered=await gateway.dispatch('/v1/upload/recover',{method:'POST',headers:await signedIdentityHeaders(owner,email,tenant.siteId),body:JSON.stringify({store_id:tenant.siteId,idempotency_key:key,filename:'owned.gltf',folder:'media',content_type:'model/gltf+json',byte_size:Buffer.byteLength(bytes),sha256_hex:digest})});
  assert.equal(recovered.status,200,await recovered.text());assert.equal((await publicBucket.list()).objects.length,1);
  assert.equal(owned.psql(`SELECT status FROM idempotency_keys WHERE site_id='${tenant.siteId}' AND key='${key}'`),'completed');
  // Separate test-only private R2 binding: no India/AWS/provider-readiness claim.
  const proof=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);
  const kycHeaders=await signedIdentityHeaders(owner,email,tenant.siteId);delete kycHeaders['Content-Type'];kycHeaders['X-Idempotency-Key']=randomUUID();
  const kycForm=new FormData();kycForm.set('store_id',tenant.siteId);kycForm.set('document_type','business_pan');kycForm.set('document_number_last4','1234');kycForm.set('file',new File([proof],'owned-private-proof.png',{type:'image/png'}));
  const kycWire=new Request('https://gateway.test/v1/kyc/documents/upload',{method:'POST',headers:kycHeaders,body:kycForm});
  const uploaded=await gateway.dispatch('/v1/kyc/documents/upload',{method:'POST',headers:kycWire.headers,body:await kycWire.arrayBuffer()});
  const result=await uploaded.json() as {data:{overview:unknown;document:{status:string;has_private_upload:boolean}}};
  assert.equal(uploaded.status,201,JSON.stringify(result));assert.equal(result.data.document.status,'submitted');assert.equal(result.data.document.has_private_upload,true);
  const {MerchantKycOverviewSchema}=await import('@letbuyy/shared-types');
  const projection=MerchantKycOverviewSchema.parse(result.data.overview);assert.equal(projection.documents.length,1);
  const privateBucket=await gateway.mf.getR2Bucket('KYC_PRIVATE_BUCKET');assert.equal((await privateBucket.list()).objects.length,1);assert.equal((await publicBucket.list()).objects.length,1);
  const target=process.env.LETBUYY_KYC_PUBLIC_FIXTURE_OUT;
  if(target){
   const {writeFileSync,realpathSync,statSync}=await import('node:fs');const {dirname,basename}=await import('node:path');const {tmpdir}=await import('node:os');
   const outputRoot=realpathSync(process.env.LETBUYY_KYC_PUBLIC_FIXTURE_ROOT||tmpdir());
   assert.equal(realpathSync(dirname(target)),outputRoot);assert.equal(statSync(outputRoot).mode&0o077,0,'private owned evidence directory required');
   assert.match(basename(target),/^kyc-workerd-public-v[0-9]+\.json$/);
   writeFileSync(target,JSON.stringify(projection,null,2)+'\n',{flag:'wx',mode:0o600});
  }
 }finally{await gateway.settle();}
});
