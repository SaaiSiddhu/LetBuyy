import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPreviewRead}from'./readonly-preview-policy.mjs';
const scope={handle:'synthetic-preview',storeId:'10000000-0000-4000-8000-000000000001',accessHost:'synthetic-preview.localhost'};
const productId='20000000-0000-4000-8000-000000000002';
const reviews='/v1/storefront/reviews?store_id='+scope.storeId+'&product_id='+productId;
const classify=(method,path)=>classifyPreviewRead(method,new URL(path,'http://localhost'),scope);
test('selected public store and its public reviews are readable with GET or HEAD',()=>{
 for(const method of ['GET','HEAD']){
  assert.equal(classify(method,reviews),'reviews');
  assert.equal(classify(method,'/v1/storefront/synthetic-preview/products/'+productId),'store-resource');
  assert.equal(classify(method,'/v1/storefront/synthetic-preview/collections?browse=1'),'store-resource');
  assert.equal(classify(method,'/v1/internal/store-access/resolve?host='+scope.accessHost),'access');
 }
});
test('writes, other stores, private readers, capabilities and ambiguous review queries refuse',()=>{
 for(const method of ['POST','PATCH','PUT','DELETE','OPTIONS']) assert.equal(classify(method,reviews),null);
 const denied=[
 reviews.replace(scope.storeId,'30000000-0000-4000-8000-000000000003'),
 reviews.replace(productId,'not-a-product'),reviews+'&store_id='+scope.storeId,
 reviews+'&extra=1',reviews+'&theme_preview_token=private',
 '/v1/storefront/reviews?product_id='+productId,
 '/v1/storefront/other/products/'+productId,
 '/v1/storefront/synthetic-preview-other/products/'+productId,
 '/v1/storefront/buyer/addresses', '/v1/stores',
 '/v1/storefront/synthetic-preview/theme-preview?token=private',
 '/v1/storefront/synthetic-preview/products/%2fother',
 '/v1/internal/store-access/resolve?host=other.localhost',
 '/v1/internal/store-access/resolve?host='+scope.accessHost+'&host=other.localhost',
 ];
 for(const path of denied)assert.equal(classify('GET',path),null,path);
});
