import assert from 'node:assert/strict'
import test from 'node:test'
import {readCategoryCommand,retainCategoryCommand,clearCategoryCommand,withCategoryExecution}from '../src/lib/products/category-command-journal'
import type {ProductCategoryCommandIntent}from '@letbuyy/shared-types'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,scope={actorId:id(1),siteId:id(2)}
class MemoryStorage{
 data=new Map<string,string>();failWrite=false
 getItem(key:string){return this.data.get(key)??null}
 setItem(key:string,value:string){if(this.failWrite)throw new Error('Unavailable storage');this.data.set(key,value)}
 removeItem(key:string){this.data.delete(key)}
}
function locks(){const tails=new Map<string,Promise<unknown>>();return {request<T>(key:string,work:()=>Promise<T>|T){const task=(tails.get(key)??Promise.resolve()).then(work);tails.set(key,task.catch(()=>undefined));return task}}}
const intent=(key=id(3)):ProductCategoryCommandIntent=>({operation:'create',category_id:null,command:{store_id:scope.siteId,idempotency_key:key,name:'Synthetic cotton',display_order:0,is_visible:true}})
test('two tabs retain only one immutable category intent and remount restores it',async()=>{
 const storage=new MemoryStorage(),lock=locks(),pair=await Promise.allSettled([retainCategoryCommand(scope,intent(),storage,lock,()=>{}),retainCategoryCommand(scope,intent(id(4)),storage,lock,()=>{})])
 assert.equal(pair.filter(r=>r.status==='fulfilled').length,1);const saved=await readCategoryCommand(scope,storage,locks(),()=>{});assert(saved)
 assert.equal(saved.intent.operation,'create');if(saved.intent.operation!=='create')throw new Error('Expected the retained create fixture.')
 assert(Object.isFrozen(saved.intent.command));assert.equal(Reflect.set(saved.intent.command,'name','Mutated'),false)
 assert.equal(saved.intent.command.name,'Synthetic cotton')
 assert.equal((await readCategoryCommand(scope,storage,lock,()=>{}))?.intent.command.idempotency_key,id(3))
 assert.equal(await readCategoryCommand({...scope,actorId:id(9)},storage,lock,()=>{}),null)
 assert.equal(await readCategoryCommand({...scope,siteId:id(9)},storage,lock,()=>{}),null)
})
test('corrupt storage, failed persistence and a retired actor never replace a saved request',async()=>{
 const storage=new MemoryStorage(),lock=locks();storage.failWrite=true
 await assert.rejects(()=>retainCategoryCommand(scope,intent(),storage,lock,()=>{}));assert.equal(storage.data.size,0)
 storage.failWrite=false;const saved=await retainCategoryCommand(scope,intent(),storage,lock,()=>{})
 await assert.rejects(()=>clearCategoryCommand({...saved,intent:intent(id(4))},storage,lock,()=>{}));assert.equal(storage.data.size,1)
 await assert.rejects(()=>clearCategoryCommand(saved,storage,lock,()=>{throw new Error('Retired actor')}));assert.equal(storage.data.size,1)
 const key=[...storage.data.keys()][0];storage.data.set(key,'{invalid')
 await assert.rejects(()=>readCategoryCommand(scope,storage,lock,()=>{}),/original category request/)
 await assert.rejects(()=>retainCategoryCommand(scope,intent(id(4)),storage,lock,()=>{}));assert.equal(storage.data.get(key),'{invalid')
})
test('a queued retry observes completion by another tab before dispatching',async()=>{
 const storage=new MemoryStorage(),lock=locks(),saved=await retainCategoryCommand(scope,intent(),storage,lock,()=>{})
 let release!:()=>void,dispatches=0;const held=new Promise<void>(resolve=>release=resolve)
 const first=withCategoryExecution(scope,lock,()=>{},async()=>{dispatches++;await held;await clearCategoryCommand(saved,storage,lock,()=>{})})
 const second=withCategoryExecution(scope,lock,()=>{},async()=>{if(await readCategoryCommand(scope,storage,lock,()=>{}))dispatches++})
 release();await Promise.all([first,second]);assert.equal(dispatches,1)
})
