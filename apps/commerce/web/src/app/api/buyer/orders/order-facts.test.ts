import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { buyerCookieHeader, SITE_ID, installGatewayFake, jsonResponse } from '@/lib/api/gateway-fetch-fake.test-support';
import { savedFacts } from '@/lib/order-facts.test-support';
const origin='https://facts-store.example.test';
async function run(cookie: string|null, upstream: unknown, status=200) {
    const old=process.env.INTERNAL_API_SECRET;process.env.INTERNAL_API_SECRET='synthetic-order-facts-test';
    const fake=installGatewayFake(request=>request.url.pathname.endsWith('/internal/store-access/resolve')?jsonResponse({data:{site_id:SITE_ID}}):jsonResponse(upstream,{status}));
    try{
        const headers=new Headers({host:new URL(origin).host});if(cookie!==null)headers.set('cookie',cookie);
        const response=await GET(new NextRequest(origin+'/api/buyer/orders?order_id=saved-order',{headers}));
        return {response,body:await response.json(),requests:fake.requests};
    }finally{fake.restore();if(old===undefined)delete process.env.INTERNAL_API_SECRET;else process.env.INTERNAL_API_SECRET=old;}
}
test('actual private buyer BFF retains only canonical approved facts and never raw snapshots/private metadata',async()=>{
    const result=await run(buyerCookieHeader(),{data:{order:{id:'saved-order',total:520,items:[{name:'Saved tint',quantity:1,unit_price:520,niche_snapshot:savedFacts(),product_snapshot:{private_supplier:'PRIVATE-SUPPLIER'},private_cost:12345}],internal_notes:'PRIVATE-NOTES'}}});
    assert.equal(result.response.status,200);assert.equal(result.response.headers.get('cache-control'),'no-store');
    assert.deepEqual(result.body.order.items[0].niche_snapshot,savedFacts());assert.doesNotMatch(JSON.stringify(result.body),/product_snapshot|PRIVATE-SUPPLIER|private_cost|PRIVATE-NOTES/);
    const forwarded=result.requests.find(request=>request.url.pathname.includes('/storefront/buyer/storefront-orders/'))!;
    assert.equal(forwarded.url.searchParams.get('store_id'),SITE_ID);assert.equal(forwarded.headers.has('cookie'),false);
});
test('malformed approved snapshot is omitted even if a valid raw snapshot is also supplied upstream',async()=>{
    const result=await run(buyerCookieHeader(),{data:{order:{id:'saved-order',items:[{name:'Legacy',niche_snapshot:{...savedFacts(),private:'PRIVATE'},product_snapshot:{niche:savedFacts()}}]}}});
    assert.equal(result.response.status,200);assert.equal(Object.hasOwn(result.body.order.items[0],'niche_snapshot'),false);assert.equal(Object.hasOwn(result.body.order.items[0],'product_snapshot'),false);
});
test('missing session, host/site mismatch and denied order cannot reveal saved facts',async()=>{
    for(const cookie of [null,buyerCookieHeader(undefined,'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa')]){
        const result=await run(cookie,{data:{order:{id:'saved-order',items:[{niche_snapshot:savedFacts()}]}}});assert.equal(result.response.status,401);
        assert.doesNotMatch(JSON.stringify(result.body),/PC02|Asha/);assert.equal(result.requests.some(request=>request.url.pathname.includes('/storefront/buyer/storefront-orders/')),false);
    }
    const denied=await run(buyerCookieHeader(),{error:{message:'PRIVATE'}},404);assert.equal(denied.response.status,404);assert.doesNotMatch(JSON.stringify(denied.body),/PRIVATE|PC02|Asha/);
});
