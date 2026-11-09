import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { CollectionMetadataSchema, CollectionMetadataCommandIntentSchema, confirmCollectionMetadataReceipt, SmartCollectionPageSchema, SmartCollectionPreviewSchema } from '@letbuyy/shared-types';
const f = JSON.parse(readFileSync(new URL('../../../../tests/fixtures/collection-metadata-contracts.json',import.meta.url),'utf8'));
test('TS/Dart canonical collection fixtures preserve unknown dates, private command identity and partial populations',()=>{
    assert.equal(CollectionMetadataSchema.parse(f.row).created_at,null);
    assert.equal(SmartCollectionPageSchema.parse(f.page).meta.total,1);
    assert.equal(SmartCollectionPreviewSchema.parse(f.preview).count_is_exact,false);
    assert.deepEqual(confirmCollectionMetadataReceipt(CollectionMetadataCommandIntentSchema.parse(f.intent),f.receipt,f.actor),f.receipt);
});
test('collection receipt cannot clear an original request with a rebound actor/site/operation/revision/target/kind or rule body',()=>{
    for(const patch of [{actor_id:f.command.store_id},{store_id:f.actor},{operation:'create'},{version:7},{expected_version:6},{id:f.actor},{collection_type:'manual'},{request:{...f.receipt.request,conditions:[]}}]){
        assert.throws(()=>confirmCollectionMetadataReceipt(f.intent,{...f.receipt,...patch},f.actor));
    }
    assert.throws(()=>confirmCollectionMetadataReceipt(f.intent,{...f.receipt,request:{...f.receipt.request,unexpected:true}},f.actor));
});
test('fabricated exact totals, preview scope/count arithmetic and unknown rule vocabulary fail closed',()=>{
    for(const patch of [{total:0},{total_is_exact:false},{has_next:true}])assert(!SmartCollectionPageSchema.safeParse({...f.page,meta:{...f.page.meta,...patch}}).success);
    for(const patch of [{count_is_exact:true},{catalog_count:0},{sample_product_ids:[f.actor]}])assert(!SmartCollectionPreviewSchema.safeParse({...f.preview,...patch}).success);
    for(const conditions of [[{field:'__proto__',op:'execute',value:'x'}],[{field:'title',op:'equals',value:1}]])assert(!CollectionMetadataCommandIntentSchema.safeParse({...f.intent,command:{...f.command,conditions}}).success);
});

test('immutable collection type alone is not a reviewed metadata update',()=>{
 assert(!CollectionMetadataCommandIntentSchema.safeParse({operation:'update',collection_id:f.row.id,command:{store_id:f.command.store_id,idempotency_key:f.command.idempotency_key,version:7,collection_type:'smart'}}).success);
});
