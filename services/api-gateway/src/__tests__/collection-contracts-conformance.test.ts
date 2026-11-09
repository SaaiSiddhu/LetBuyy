import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {CollectionMembershipSnapshotSchema,CollectionListPageSchema} from '@letbuyy/shared-types';
const fixture=JSON.parse(readFileSync(new URL('../../../../tests/fixtures/collection-membership-contracts.json',import.meta.url),'utf8'));
test('the native shared collection fixture is admitted by the canonical schemas',()=>{
 assert.deepEqual(CollectionMembershipSnapshotSchema.parse(fixture.snapshot),fixture.snapshot);
 assert.deepEqual(CollectionListPageSchema.parse(fixture.page),fixture.page);
});
test('complete membership and exact page counts reject native contract corruption',()=>{
 for(const patch of [{products:[]},{unavailable_product_ids:[]},{membership_version:0},
  {product_ids:[fixture.snapshot.product_ids[0],fixture.snapshot.product_ids[0]]}]){
  assert.equal(CollectionMembershipSnapshotSchema.safeParse({...fixture.snapshot,...patch}).success,false);
 }
 for(const key of ['product_count','membership_version']){
  const row={...fixture.page.data[0]};delete row[key];
  assert.equal(CollectionListPageSchema.safeParse({...fixture.page,data:[row]}).success,false);
 }
});
