import assert from 'node:assert/strict';
import test from 'node:test';
import { createBoundDomainReconcileHeaders, verifyBoundDomainReconcileSignature, domainReconcileEnvironment } from '../src/index';
const secret='synthetic-domain-job-only-key-01234567890123456789';
const url='https://gateway.test/v1/internal/custom-domain-reconcile/run?limit=1';
const nowMs=1793000000000, body='{}', environment='production' as const;
const verify=async(headers:Record<string,string>,extra:Record<string,unknown>={})=>verifyBoundDomainReconcileSignature({secret,environment,url,method:'POST',body:new TextEncoder().encode(body),headers:new Headers(headers),nowMs,...extra});
test('the dedicated job signs the entire request and explicit environment without revealing the raw key',async()=>{
 const h=await createBoundDomainReconcileHeaders({secret,environment,url,method:'POST',body,nowMs});assert.equal((await verify(h)).status,'accepted');assert.equal(h['X-Internal-API-Secret'],undefined);assert.equal(Object.values(h).includes(secret),false);
});
test('method/path/query/body/caller/audience/version/environment and signature are inseparable',async()=>{
 const h=await createBoundDomainReconcileHeaders({secret,environment,url,method:'POST',body,nowMs});
 for(const extra of [{method:'GET'},{url:url.replace('/run','/run/extra')},{url:url.replace('limit=1','limit=2')},{body:new TextEncoder().encode('{ }')},{environment:'staging' as const},{secret:secret+'foreign'}])assert.notEqual((await verify(h,extra)).status,'accepted');
 for(const key of ['X-LetBuyy-Internal-Caller','X-LetBuyy-Internal-App','X-LetBuyy-Internal-Environment','X-LetBuyy-Internal-Version','X-LetBuyy-Internal-JTI','X-LetBuyy-Internal-Timestamp','X-LetBuyy-Internal-Signature'])assert.notEqual((await verify({...h,[key]:'synthetic-tampered'})).status,'accepted');
});
for(const drift of [-120001,120001])test('finite sender clock window rejects '+drift,async()=>{
 const h=await createBoundDomainReconcileHeaders({secret,environment,url,method:'POST',body,nowMs:nowMs+drift});assert.equal((await verify(h)).status,'expired');
});
test('missing, weak and placeholder keys cannot sign or verify; no other endpoint can be signed',async()=>{
 const h=await createBoundDomainReconcileHeaders({secret,environment,url,method:'POST',body,nowMs});
 for(const key of ['', 'short','SKIP_NEEDS_HUMAN_DOMAIN_RECONCILE_SECRET']){await assert.rejects(createBoundDomainReconcileHeaders({secret:key,environment,url,method:'POST',nowMs}));assert.notEqual((await verify(h,{secret:key})).status,'accepted');}
 for(const input of [{url:url.replace('custom-domain-reconcile/run','console/run'),method:'POST'},{url,method:'GET'},{url,method:'POST',body:'x'.repeat(513)}])await assert.rejects(createBoundDomainReconcileHeaders({secret,environment,nowMs,...input}));
});
test('deployment flags must agree; NODE_ENV never converts staging to production',()=>{
 assert.equal(domainReconcileEnvironment({ENVIRONMENT:'staging',APP_ENV:'staging',DEPLOYMENT_ENV:'staging'}),'staging');
 assert.equal(domainReconcileEnvironment({ENVIRONMENT:'production',APP_ENV:'staging'}),undefined);
 assert.equal(domainReconcileEnvironment({ENVIRONMENT:'unknown'}),undefined);assert.equal(domainReconcileEnvironment({}),undefined);
});
