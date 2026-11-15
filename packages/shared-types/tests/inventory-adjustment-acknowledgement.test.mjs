import assert from 'node:assert/strict';
import test from 'node:test';
import {InventoryAdjustmentAcknowledgementSchema,InventoryBatchAdjustmentResultSchema} from '../src/index.ts';
const product='c1111111-1111-4111-8111-111111111111';
const level={id:'c2222222-2222-4222-8222-222222222222',store_id:'c3333333-3333-4333-8333-333333333333',product_id:product,variant_id:null,location_id:'c4444444-4444-4444-8444-444444444444',available:5,reserved:1,available_quantity:4,reserved_quantity:1,on_hand_quantity:5};
test('stock confirmation preserves physical/free/held counters and additional canonical SQL fields',()=>{
 const result=InventoryAdjustmentAcknowledgementSchema.parse({...level,free_quantity:4,updated_at:'2026-11-04T00:00:00Z'});
 assert.equal(result.available,5);assert.equal(result.available_quantity,4);assert.equal(result.free_quantity,4);
});
test('confirmation refuses free quantity substituted for physical, lost holds and inconsistent stock mirrors',()=>{
 for(const invalid of [{available:4},{reserved:6},{available_quantity:5},{reserved_quantity:0},{on_hand_quantity:4},{available:-1},{available:5.1},{variant_id:undefined},{location_id:undefined}])assert.equal(InventoryAdjustmentAcknowledgementSchema.safeParse({...level,...invalid}).success,false,JSON.stringify(invalid));
});
test('batch confirmation preserves ordered mixed outcomes and refuses count or result ambiguity',()=>{
 const results=[{product_id:product,status:'adjusted',level},{product_id:product,status:'not_found'},{product_id:product,status:'failed',level:null,error:'Inventory adjustment failed'}];
 assert.deepEqual(InventoryBatchAdjustmentResultSchema.parse({results,total:3}),{results,total:3});
 for(const invalid of [{results,total:2},{results:[],total:0},{results:[{product_id:product,status:'adjusted',level:null}],total:1},{results:[{product_id:product,status:'failed',error:'raw database details'}],total:1}])assert.equal(InventoryBatchAdjustmentResultSchema.safeParse(invalid).success,false);
});
