import assert from 'node:assert/strict'
import test,{beforeEach} from 'node:test'
import {bpsToPercentage,completeLoyaltySave,formatLoyaltyPaise,isLoyaltySnapshot,loyaltyPendingName,percentageToBps,prepareLoyaltySave,readPendingLoyaltySave} from '../src/lib/loyalty/pending-save'
const values=new Map<string,string>()
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}})
beforeEach(()=>values.clear())
const intent={expected_updated_at:null,is_active:true,earn_rate_bps:1000,redeem_cap_bps:5000,point_value_minor:'9007199254740993'}
test('a captured pending save survives a new reader and retains its exact intent/key across another attempt',()=>{
 const first=prepareLoyaltySave('actor-a','store-a',intent)
 assert.deepEqual(readPendingLoyaltySave('actor-a','store-a'),first)
 const retry=prepareLoyaltySave('actor-a','store-a',{...intent,is_active:false})
 assert.deepEqual(retry,first,'an unresolved outcome cannot silently become another intent')
 assert.equal(retry.intent.point_value_minor,'9007199254740993')
 completeLoyaltySave(retry);assert.equal(readPendingLoyaltySave('actor-a','store-a'),null)
})
test('account/store namespaces are independent and a late acknowledgement cannot remove a newer save',()=>{
 const a=prepareLoyaltySave('actor-a','store-a',intent),b=prepareLoyaltySave('actor-b','store-a',intent),c=prepareLoyaltySave('actor-a','store-b',intent)
 assert.notEqual(a.key,b.key);assert.notEqual(a.key,c.key)
 const newer={...a,key:crypto.randomUUID()};values.set(loyaltyPendingName('actor-a','store-a'),JSON.stringify(newer))
 completeLoyaltySave(a);assert.deepEqual(readPendingLoyaltySave('actor-a','store-a'),newer)
 assert.deepEqual(readPendingLoyaltySave('actor-b','store-a'),b)
})
test('corrupt or swapped pending identity fails visibly without allocating another key',()=>{
 for(const raw of ['not-json',JSON.stringify({key:'syn-corrupt-key',actorId:'actor-b',store:'store-a',intent})]){
  const name=loyaltyPendingName('actor-a','store-a');values.set(name,raw)
  assert.throws(()=>prepareLoyaltySave('actor-a','store-a',intent));assert.equal(values.get(name),raw)
 }
})
test('percentage and currency presentation retain integer precision at boundaries',()=>{
 assert.equal(percentageToBps('12.34'),1234);assert.equal(percentageToBps('0.1'),10);assert.equal(percentageToBps('100'),10000)
 for(const value of ['100.01','1.234','-1','','01','true'])assert.equal(percentageToBps(value),null)
 assert.equal(bpsToPercentage(1234),'12.34');assert.equal(formatLoyaltyPaise('150'),'₹1.50');assert.equal(formatLoyaltyPaise('9007199254740993'),'₹9,00,71,99,25,47,409.93')
})
test('an unavailable or malformed snapshot cannot become an empty or zero-balance programme',()=>{
 const empty={store_id:'site',enrolled:false,program:null,outstanding_points:'0',valuation_policy:'block_decrease_while_outstanding',value_decrease_allowed:true}
 assert.equal(isLoyaltySnapshot(empty),true)
 for(const value of [null,{}, {...empty,outstanding_points:0},{...empty,enrolled:true},{...empty,valuation_policy:'unknown'}])assert.equal(isLoyaltySnapshot(value),false)
})
