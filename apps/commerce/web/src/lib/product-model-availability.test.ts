import assert from 'node:assert/strict';
import test from 'node:test';
import type {StoreModel}from'@letbuyy/tenant-core';
import {mapStorefrontProduct}from'./product-model';
import {productToLiquidDrop}from'./theme-engine/product-liquid-drop';
import {buildProductJsonLd}from'./seo';
const store={id:'11111111-1111-4111-8111-111111111111',name:'Synthetic inventory store',subdomain:'syn-inventory-model'}as StoreModel;
const product=()=>({id:'22222222-2222-4222-8222-222222222222',store_id:store.id,name:'Synthetic options',price:125,currency:'INR',stock:0,is_active:true,status:'active',images:[],variants:[{id:'33333333-3333-4333-8333-333333333333',title:'M',price:125,stock:3,options:{Code:'M'}},{id:'44444444-4444-4444-8444-444444444444',title:'L',price:125,stock:4,options:{Code:'L'}}]});
test('buyer model, Liquid and offer availability use canonical live-SKU quantity without editing the base DTO',()=>{
 const raw={...product(),catalog_available_quantity:7},before=structuredClone(raw),model=mapStorefrontProduct(raw),drop=productToLiquidDrop(model);assert.equal(model.stock,7);assert.equal(drop?.stock,7);assert.equal(drop?.available,true);assert.equal(drop?.inventory_known,true);assert.equal((buildProductJsonLd(store,model).offers as Record<string,unknown>).availability,'https://schema.org/InStock');assert.deepEqual(raw,before);assert.equal(raw.stock,0);
});
test('a canonical zero stays zero even when the base cache or variant cache is positive',()=>{
 const model=mapStorefrontProduct({...product(),stock:99,catalog_available_quantity:0});assert.equal(model.stock,0);assert.equal(productToLiquidDrop(model)?.inventory_known,true);assert.equal(productToLiquidDrop(model)?.available,false);assert.equal((buildProductJsonLd(store,model).offers as Record<string,unknown>).availability,'https://schema.org/OutOfStock');
});
test('missing, null and malformed inventory remain unknown and never become a zero-stock offer',()=>{
 for(const value of[undefined,null,-1,1.5,'7','',Number.NaN,Number.POSITIVE_INFINITY,Number.MAX_SAFE_INTEGER+1]){
  const model=mapStorefrontProduct({...product(),stock:99,catalog_available_quantity:value}),drop=productToLiquidDrop(model);assert.equal(model.stock,null);assert.equal(drop?.stock,null);assert.equal(drop?.inventory_known,false);assert.equal(drop?.available,false);assert.equal(Object.hasOwn(buildProductJsonLd(store,model).offers as object,'availability'),false);
 }
});
