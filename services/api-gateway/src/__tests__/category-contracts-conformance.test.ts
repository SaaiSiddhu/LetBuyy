import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync}from 'node:fs';
import {ProductCategoryReadSchema,ProductCategoryPageSchema,ProductCategoryCommandReceiptSchema,CreateCategoryCommandSchema,UpdateCategoryCommandSchema}from '@letbuyy/shared-types';
const f=JSON.parse(readFileSync(new URL('../../../../tests/fixtures/product-category-contracts.json',import.meta.url),'utf8'));
test('canonical TS and Dart fixture preserves category revision, hierarchy and exact counts',()=>{
 assert.equal(ProductCategoryReadSchema.parse(f.row).products_count,2);assert.equal(ProductCategoryPageSchema.parse(f.page).meta.total,1);
 assert.equal(ProductCategoryCommandReceiptSchema.parse(f.receipt).affected_products,2);
 for(const key of ['version','products_count','children_count']){const row={...f.row};delete row[key];assert(!ProductCategoryReadSchema.safeParse(row).success);}
 for(const patch of [{version:0},{display_order:-1},{is_visible:'true'},{image_url:'javascript:alert(1)'},{created_at:'2026-11-03'},{slug:'Mixed Slug'}])assert(!ProductCategoryReadSchema.safeParse({...f.row,...patch}).success);
 for(const patch of [{total:0},{total_pages:2},{has_next:true}])assert(!ProductCategoryPageSchema.safeParse({...f.page,meta:{...f.page.meta,...patch}}).success);
 assert(!ProductCategoryCommandReceiptSchema.safeParse({...f.receipt,operation:'delete'}).success);
});
test('category update keeps omissions while create normalizes only its defined defaults',()=>{
 const base={store_id:f.row.store_id,idempotency_key:f.receipt.idempotency_key};
 const create=CreateCategoryCommandSchema.parse({...base,name:' Synthetic category '});assert.equal(create.name,'Synthetic category');assert.equal(create.is_visible,true);
 const update=UpdateCategoryCommandSchema.parse({...base,version:3,description:null});assert(!Object.hasOwn(update,'is_visible'));assert.equal(update.description,null);
 for(const body of [{...base,description:'missing version'},{...base,version:3},{...base,version:3,unknown:true}])assert(!UpdateCategoryCommandSchema.safeParse(body).success);
});
