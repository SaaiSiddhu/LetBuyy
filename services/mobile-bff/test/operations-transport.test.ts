// Actual BFF transport with a synthetic service binding. Gateway/database and
// device proofs remain separate; no authorization is invented in the BFF.
import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/index';

const paths=['supplier-metrics','warehouse-metrics','transfer-metrics','operations-summary'];
const token='a'.repeat(32);
test('four exact authenticated operations reads retain query/store and translate mobile credentials',async()=>{
    const seen:string[]=[];
    const env={INTERNAL_API_SECRET:'synthetic-operations-transport-secret',API_GATEWAY_SERVICE:{fetch:async(request:Request)=>{
        const url=new URL(request.url);seen.push(url.pathname);
        assert.equal(request.method,'GET');assert.equal(url.search,'?store_id=site-a&page=2&limit=20');
        assert.equal(request.headers.get('X-Store-ID'),'site-a');assert.equal(request.headers.get('Authorization'),null);assert.equal(request.headers.get('Cookie'),null);
        assert.equal(request.headers.get('X-LetBuyy-Session-Token'),null);assert.equal(request.headers.get('X-LetBuyy-Internal-Session-Token'),token);
        assert.ok(request.headers.get('X-LetBuyy-Internal-Signature'));assert.ok(request.headers.get('X-LetBuyy-Internal-Timestamp'));
        return Response.json({success:true,data:{store_id:'site-a',forwarded:url.pathname}});
    }}};
    for(const path of paths){
        const response=await app.fetch(new Request(`https://mobile-bff.test/v1/commerce-analytics/${path}?store_id=site-a&page=2&limit=20`,{headers:{Authorization:`Bearer ${token}`,Cookie:`lb_session=${token}`,'X-Store-ID':'site-a'}}),env as never);
        assert.equal(response.status,200);const body=await response.json() as {data:{forwarded:string}};assert.equal(body.data.forwarded,`/v1/commerce-analytics/${path}`);
    }
    assert.equal(seen.length,4);
});
test('operations transport requires a session and closes write methods and adjacent paths before the binding',async()=>{
    let calls=0;const env={INTERNAL_API_SECRET:'synthetic-operations-transport-secret',API_GATEWAY_SERVICE:{fetch:async()=>{calls++;return Response.json({});}}};
    for(const path of paths){
        assert.equal((await app.fetch(new Request(`https://mobile-bff.test/v1/commerce-analytics/${path}`),env as never)).status,401);
        for(const method of ['POST','PUT','PATCH','DELETE','HEAD'])assert.equal((await app.fetch(new Request(`https://mobile-bff.test/v1/commerce-analytics/${path}`,{method,headers:{Authorization:`Bearer ${token}`}}),env as never)).status,404);
    }
    for(const path of ['/v1/commerce-analytics','/v1/commerce-analytics/private','/v1/commerce-analytics/operations-summary/private','/v1/commerce-analytics/operations-summary-export','/commerce-analytics/operations-summary'])assert.equal((await app.fetch(new Request('https://mobile-bff.test'+path,{headers:{Authorization:`Bearer ${token}`}}),env as never)).status,404);
    assert.equal(calls,0);
});
test('operations transport preserves current Gateway denial and unavailable responses',async()=>{
    for(const status of [401,403,503]){
        const body={success:false,error:{code:status===503?'METRICS_UNAVAILABLE':'FORBIDDEN',message:'Synthetic boundary response'}};
        const env={INTERNAL_API_SECRET:'synthetic-operations-transport-secret',API_GATEWAY_SERVICE:{fetch:async()=>Response.json(body,{status})}};
        const response=await app.fetch(new Request('https://mobile-bff.test/v1/commerce-analytics/operations-summary',{headers:{Authorization:`Bearer ${token}`}}),env as never);
        assert.equal(response.status,status);assert.deepEqual(await response.json(),body);
    }
});
