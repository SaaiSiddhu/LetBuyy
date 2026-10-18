import assert from 'node:assert/strict'
import test from 'node:test'
import {createLetbuyyApiClient,LetbuyyApiError} from '../../packages/typescript/api-client/src/index'

test('merchant loyalty resource preserves exact monetary/version strings and the caller-owned retry key',async()=>{
 const calls:{url:string;init?:RequestInit}[]=[]
 const api=createLetbuyyApiClient({baseUrl:'https://api.letbuyy.test',fetch:async(input,init)=>{
  calls.push({url:String(input),init});return new Response(JSON.stringify({success:true,data:{point_value_minor:'9007199254740993'}}),{headers:{'Content-Type':'application/json'}})
 }})
 const store='11111111-1111-4111-8111-111111111111',version='2026-10-16T05:21:22.123456+00:00'
 await api.loyalty.program(store)
 assert.equal(new URL(calls[0].url).pathname,'/v1/loyalty/program');assert.equal(new URL(calls[0].url).searchParams.get('store_id'),store)
 const input={store_id:store,expected_updated_at:version,point_value_minor:'9007199254740993'}
 const result=await api.loyalty.setProgram(input,{idempotencyKey:'syn-loyalty-resource-key'})
 assert.equal(result.point_value_minor,'9007199254740993');assert.equal(calls[1].init?.method,'PUT')
 assert.equal(new Headers(calls[1].init?.headers).get('X-Idempotency-Key'),'syn-loyalty-resource-key')
 assert.deepEqual(JSON.parse(String(calls[1].init?.body)),input)
})
test('loyalty conflicts remain actionable errors and the client never invents a mutation retry',async()=>{
 for(const code of ['LOYALTY_VERSION_CONFLICT','LOYALTY_VALUE_DECREASE_BLOCKED','IDEMPOTENCY_CONFLICT']){
  let calls=0;const api=createLetbuyyApiClient({baseUrl:'https://api.letbuyy.test',fetch:async()=>{calls++;return new Response(JSON.stringify({error:{code,message:'Reload current settings.'}}),{status:409})}})
  await assert.rejects(api.loyalty.setProgram({store_id:'store',expected_updated_at:null,is_active:true},{idempotencyKey:'syn-loyalty-key'}),error=>error instanceof LetbuyyApiError&&error.code===code)
  assert.equal(calls,1)
 }
})
