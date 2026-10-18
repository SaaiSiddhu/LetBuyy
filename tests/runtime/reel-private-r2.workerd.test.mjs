// Native local runtime proof; requires reviewed resource grant before execution.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import ts from 'typescript';
import { Miniflare, createFetchMock } from 'miniflare';
const source = readFileSync(new URL('../../packages/infrastructure/storage-adapter/reel-private-r2.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
assert.equal(compiled.diagnostics?.length ?? 0, 0);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const mp4 = size => { const b = new Uint8Array(size); b.set([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0]); return b; };
const worker = compiled.outputText + `
function fields(o) { return {key:o.key,version:o.version,etag:o.etag,size:o.size,httpMetadata:o.httpMetadata,customMetadata:o.customMetadata,checksums:o.checksums}; }
export default { async fetch(request, env) {
 const mode = request.headers.get('x-fixture-mode') || 'transfer';
 const intent = JSON.parse(request.headers.get('x-fixture-intent'));
 const budget = JSON.parse(request.headers.get('x-fixture-budget'));
 const real = env.ORIGINALS;
 const bucket = {head:k=>real.head(k),put:(...args)=>real.put(...args),get:async(...args)=>{
   const o=await real.get(...args); if(!o||!('body' in o)) return o;
   if(mode==='tampered-readback') return {...fields(o),body:new ReadableStream({type:'bytes',start(c){const b=new Uint8Array(intent.bytes);b.set([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0]);b[b.length-1]=1;c.enqueue(b);c.close();}})};
   return o;
 }};
 let body=request.body;
 if(mode==='native-stream-fault') body=new ReadableStream({type:'bytes',pull(c){c.error(new Error('SYNTHETIC_READ_FAILURE'));}});
 if(mode==='native-stall') body=new ReadableStream({type:'bytes',pull(){}});
 try {
   const proof=mode==='inspect'||mode==='tampered-readback'
     ? await inspectPrivateOriginal(bucket,intent,budget,request.signal)
     : await transferPrivateOriginal(bucket,intent,body,budget,request.signal);
   return Response.json({proof});
 } catch(e) { return Response.json({error:String(e.message).startsWith('PRIVATE_R2_')?e.message:'PRIVATE_R2_IO_ERROR'}, {status:409}); }
}};`;

async function setup(run) {
  const fetchMock = createFetchMock(); fetchMock.disableNetConnect();
  const mf = new Miniflare({ modules: true, script: worker, compatibilityDate: '2026-05-25', cf: false,
    r2Buckets: ['ORIGINALS'], r2Persist: false, fetchMock });
  try { await run(mf, await mf.getR2Bucket('ORIGINALS')); } finally { await mf.dispose(); }
}
function intent(bytes) {
  return { siteId: randomUUID(), intentId: randomUUID(), objectNonce: randomUUID(), profileDigest: 'b'.repeat(64),
    bytes: bytes.length, sha256: hash(bytes), contentType: 'video/mp4', expectedVersion: null };
}
const key = i => `private-reel-originals/${i.siteId}/${i.intentId}/${i.objectNonce}`;
async function call(mf, i, bytes, mode='transfer', budget={maxBytes:2*1024*1024,maxWallMs:5000}) {
  // The numbers above are synthetic test budgets only, not proposed product or
  // account policy. dispatchFetch exercises native workerd, not a JS R2 mock.
  const response = await mf.dispatchFetch('http://fixture.invalid/', {method:'PUT', headers:{
    'Content-Type':i.contentType,'x-fixture-intent':JSON.stringify(i),'x-fixture-mode':mode,'x-fixture-budget':JSON.stringify(budget)
  },body:bytes});
  return {status:response.status,...await response.json()};
}

test('native R2 + FixedLengthStream + DigestStream preserve exact bytes/version/hash and permit same-key recovery', async()=>setup(async(mf,bucket)=>{
  const bytes=mp4(128*1024+7),i=intent(bytes),result=await call(mf,i,bytes);
  assert.equal(result.status,200,JSON.stringify(result));
  const stored=await bucket.get(key(i));assert.ok(stored);
  const actual=new Uint8Array(await stored.arrayBuffer());
  assert.deepEqual(actual,bytes);assert.equal(result.proof.actualSha256,hash(actual));
  assert.equal(result.proof.actualBytes,bytes.length);assert.equal(result.proof.objectVersion,stored.version);
  assert.equal(result.proof.signatureConsistentContentType,'video/mp4');
  assert.equal(result.proof.publicUrl,undefined);assert.equal(result.proof.ready,undefined);
  const replay=await call(mf,{...i,expectedVersion:stored.version},bytes);
  assert.equal(replay.status,200);assert.equal(replay.proof.objectVersion,stored.version);
  assert.equal((await bucket.list()).objects.length,1);
  // Signature consistency only: this is not a decoded WebM/video-validity claim.
  const webm=new Uint8Array(4096);webm.set([0x1a,0x45,0xdf,0xa3,0x42,0x82,0x84,0x77,0x65,0x62,0x6d]);
  const w={...intent(webm),contentType:'video/webm'},received=await call(mf,w,webm);
  assert.equal(received.status,200,JSON.stringify(received));assert.equal(received.proof.signatureConsistentContentType,'video/webm');assert.equal(received.proof.actualSha256,hash(webm));
}));

test('actual native conditional create keeps the first object and never overwrites a same-key competitor',async()=>setup(async(mf,bucket)=>{
  const bytes=mp4(512*1024),i=intent(bytes);
  const results=await Promise.all([call(mf,i,bytes),call(mf,i,bytes)]);
  for(const r of results)assert.equal(r.status,200,JSON.stringify(r));
  assert.equal(results[0].proof.objectVersion,results[1].proof.objectVersion);
  assert.equal((await bucket.list()).objects.length,1);
  assert.equal(hash(new Uint8Array(await(await bucket.get(key(i))).arrayBuffer())),i.sha256);
}));

test('too short/long, wrong digest and incompatible container never return a verified-original proof',async()=>setup(async(mf,bucket)=>{
  for(const kind of ['short','long','digest','container']){
    const bytes=mp4(4096),i=intent(bytes);let sent=bytes;
    if(kind==='short')sent=bytes.subarray(0,4000);
    if(kind==='long')sent=new Uint8Array(4100);
    if(kind==='digest')i.sha256='c'.repeat(64);
    if(kind==='container'){sent=new Uint8Array(4096);i.sha256=hash(sent);}
    const result=await call(mf,i,sent);assert.equal(result.status,409);assert.equal(result.proof,undefined);
    // Record actual local R2 outcome, don't assume a failed HTTP response means
    // no object can exist. No object is manually deleted to force acceptance.
    const object=await bucket.head(key(i));if(object)assert.equal(object.key,key(i));
  }
}));

test('native stream fault/idle deadline returns no custody; same-key retry can reconcile or restart',async()=>setup(async(mf,bucket)=>{
  for(const mode of ['native-stream-fault','native-stall']){
    const bytes=mp4(4096),i=intent(bytes);
    const failed=await call(mf,i,bytes,mode,{maxBytes:8192,maxWallMs:40});
    assert.equal(failed.status,409);assert.equal(failed.proof,undefined);
    const retried=await call(mf,i,bytes);assert.equal(retried.status,200,JSON.stringify(retried));
    assert.equal(retried.proof.actualSha256,i.sha256);
    assert.ok(await bucket.head(key(i)));
  }
}));

test('independent full readback digest rejects forged matching metadata and changed returned bytes',async()=>setup(async(mf)=>{
  const bytes=mp4(4096),i=intent(bytes);assert.equal((await call(mf,i,bytes)).status,200);
  const result=await call(mf,i,bytes,'tampered-readback');
  assert.equal(result.status,409);assert.equal(result.error,'PRIVATE_R2_CHECKSUM_MISMATCH');
}));

test('external same-content overwrite has a new version and cannot replay a canonical pinned version',async()=>setup(async(mf,bucket)=>{
  const bytes=mp4(4096),i=intent(bytes),first=await call(mf,i,bytes);assert.equal(first.status,200);
  const old=await bucket.head(key(i));
  // Fixture-only out-of-band mutation models a privileged provider operator.
  await bucket.put(key(i),bytes,{sha256:Uint8Array.from(i.sha256.match(/../g),h=>parseInt(h,16)).buffer,
    httpMetadata:old.httpMetadata,customMetadata:old.customMetadata});
  assert.notEqual((await bucket.head(key(i))).version,old.version);
  const result=await call(mf,{...i,expectedVersion:old.version},bytes,'inspect');
  assert.equal(result.status,409);assert.equal(result.error,'PRIVATE_R2_OBJECT_MISMATCH');
}));

test('private object survives simulated local-commit loss and is fully verified again without another key',async()=>setup(async(mf,bucket)=>{
  const bytes=mp4(4096),i=intent(bytes),first=await call(mf,i,bytes);assert.equal(first.status,200);
  // Drop the proof instead of committing it; this is an adapter reconciliation
  // control, not the required owned-DB mandatory audit/outbox fault test.
  const recovered=await call(mf,i,new Uint8Array(0),'inspect');assert.equal(recovered.status,200);
  assert.equal(recovered.proof.objectVersion,first.proof.objectVersion);
  assert.equal(recovered.proof.actualSha256,i.sha256);assert.equal((await bucket.list()).objects.length,1);
}));
