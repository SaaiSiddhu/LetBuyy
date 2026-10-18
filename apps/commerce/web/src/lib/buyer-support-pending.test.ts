import assert from 'node:assert/strict';
import test from 'node:test';
import {SUPPORT_PENDING_PREFIX,readSupportPending,saveSupportPending,clearSupportPending,supportIntentHash,supportReceipt,type SupportPending} from './buyer-support-pending';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002',ticket='20000000-0000-4000-8000-000000000001';
function storage(){const map=new Map<string,string>();return {map,getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};}
async function intent():Promise<SupportPending>{return {version:1,buyer:a,store:'https://store.example.test/demo',operation:'create',target:null,key:'support-key-12345',hash:await supportIntentHash('create',null,'Private subject','Private complaint')};}
test('reload retains an immutable key and hash, never complaint content, and isolates buyer/store',async()=>{
 const saved=storage(),pending=await intent();saveSupportPending(saved,pending);
 assert.deepEqual(readSupportPending(saved,a,pending.store),pending);
 assert.equal(readSupportPending(saved,b,pending.store),null);assert.equal(readSupportPending(saved,a,'https://other.example.test/demo'),null);
 assert.doesNotMatch([...saved.map.values()].join(''),/Private|complaint|subject|body|token|proof|password/);
 assert.equal(saveSupportPending(saved,{...pending,key:'replacement-key'}).key,pending.key);
 assert.throws(()=>saveSupportPending(saved,{...pending,hash:'a'.repeat(64)}),/Recover/);
 assert.throws(()=>saveSupportPending(saved,{...pending,operation:'reply',target:ticket}),/Recover/);
 clearSupportPending(saved,pending);assert.equal(readSupportPending(saved,a,pending.store),null);
});
test('intent hash normalizes text and binds operation, target and content',async()=>{
 const normalized=await supportIntentHash('create',null,'Subject','Body');assert.equal(normalized,await supportIntentHash('create',null,' Subject ',' Body '));
 assert.notEqual(normalized,await supportIntentHash('create',null,'Changed','Body'));
 assert.notEqual(await supportIntentHash('reply',ticket,'','Body'),await supportIntentHash('reply',a,'','Body'));
});
test('corrupt and unavailable persistence block sending rather than erasing unknown actions',async()=>{
 const saved=storage(),pending=await intent();saveSupportPending(saved,pending);const name=[...saved.map.keys()][0];assert.ok(name.startsWith(SUPPORT_PENDING_PREFIX));saved.map.set(name,'{"version":99}');
 assert.throws(()=>readSupportPending(saved,a,pending.store),/paused/);assert.throws(()=>saveSupportPending(saved,pending),/paused/);assert.equal(saved.map.get(name),'{"version":99}');
 assert.throws(()=>saveSupportPending({...saved,setItem:()=>{throw Error('quota');}}, {...pending,buyer:b}),/quota/);
});
test('canonical receipt must bind exact key, operation, ticket and public message result',()=>{
 const row={key:'support-key-12345',operation:'reply',ticket_id:ticket,message_id:a,confirmed_at:'2026-10-18T00:00:00Z'};
 assert.deepEqual(supportReceipt(row,row.key,'reply',ticket,a),row);
 for(const changed of [{key:'other-key'},{operation:'create'},{ticket_id:b},{message_id:'fake'},{confirmed_at:'invalid'}])assert.equal(supportReceipt({...row,...changed},row.key,'reply',ticket,a),null);
});
