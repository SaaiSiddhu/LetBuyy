import assert from 'node:assert/strict';
import test from 'node:test';
import {prepareWarehouseCommand} from '@letbuyy/commerce-core';
import {readPendingWarehouseCommand,retainWarehouseCommand,completeWarehouseCommand,warehouseCommandSlot,
 type WarehouseScope,type WarehouseLocks} from '../src/lib/inventory/warehouse-command-journal';
const uuid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scope:WarehouseScope={actorId:uuid(1),siteId:uuid(2),store:'synthetic-store'};
class MemoryStorage {
 data=new Map<string,string>();failRead=false;failWrite=false;
 getItem(key:string){if(this.failRead)throw new Error('Storage unavailable');return this.data.get(key)??null;}
 setItem(key:string,value:string){if(this.failWrite)throw new Error('Storage unavailable');this.data.set(key,value);}
 removeItem(key:string){this.data.delete(key);}
}
function locks():WarehouseLocks {
 let tail=Promise.resolve();
 return {request:async(_name,callback)=>{const old=tail;let release!:()=>void;tail=new Promise<void>(resolve=>release=resolve);
  await old;try{return await callback();}finally{release();}}};
}
const input=(quantity=4,cost=0.29)=>({store_id:scope.siteId,location_id:uuid(3),lines:[{product_id:uuid(4),quantity,unit_cost:cost}],idempotency_key:uuid(10)});
const intent=(quantity=4)=>prepareWarehouseCommand('purchase_order.create',null,input(quantity));
test('parallel tabs retain one immutable key and a new mount restores the original request',async()=>{
 const storage=new MemoryStorage(),lock=locks(),desired=intent();let minted=10;
 const [a,b]=await Promise.all([retainWarehouseCommand(scope,desired,storage,lock,()=>{},()=>uuid(++minted)),
  retainWarehouseCommand(scope,desired,storage,lock,()=>{},()=>uuid(++minted))]);
 assert.equal(a.key,b.key);assert.equal(minted,11);
 const restored=await readPendingWarehouseCommand(scope,storage,locks(),()=>{});assert.deepEqual(restored,a);
 assert.throws(()=>{(a.intent.command.lines as Array<Record<string,unknown>>)[0].quantity=999;},TypeError);
 assert.equal((JSON.parse(storage.getItem(warehouseCommandSlot(scope))!).intent.command.lines as Array<Record<string,unknown>>)[0].quantity,4);
});
test('changed details cannot mint another key while a request is unresolved',async()=>{
 const storage=new MemoryStorage(),lock=locks(),first=await retainWarehouseCommand(scope,intent(),storage,lock,()=>{});
 await assert.rejects(()=>retainWarehouseCommand(scope,intent(5),storage,lock,()=>{}),/original|recovery|details/i);
 assert.equal((await readPendingWarehouseCommand(scope,storage,lock,()=>{}))?.key,first.key);
});
test('UI lifecycle metadata is never persisted as part of a recoverable command',async()=>{
 const storage=new MemoryStorage(),lock=locks(),mountedScope={...scope,identity:'render-generation',active:true};
 const saved=await retainWarehouseCommand(mountedScope,intent(),storage,lock,()=>{});
 assert.deepEqual(Object.keys(saved).sort(),['actorId','intent','key','siteId','store','version']);
 mountedScope.active=false;
 assert.equal((await readPendingWarehouseCommand(scope,storage,lock,()=>{}))?.key,saved.key);
});
test('actor and stable site isolate recovery while a legitimate store slug change preserves it',async()=>{
 const storage=new MemoryStorage(),lock=locks(),first=await retainWarehouseCommand(scope,intent(),storage,lock,()=>{});
 assert.equal(await readPendingWarehouseCommand({...scope,actorId:uuid(9)},storage,lock,()=>{}),null);
 assert.equal(await readPendingWarehouseCommand({...scope,siteId:uuid(9)},storage,lock,()=>{}),null);
 assert.equal((await readPendingWarehouseCommand({...scope,store:'renamed-store'},storage,lock,()=>{}))?.key,first.key);
});
test('only the exact saved key and normalized intent can be cleared',async()=>{
 const storage=new MemoryStorage(),lock=locks(),first=await retainWarehouseCommand(scope,intent(),storage,lock,()=>{});
 await assert.rejects(()=>completeWarehouseCommand({...first,key:uuid(90)},storage,lock,()=>{}));
 await assert.rejects(()=>completeWarehouseCommand({...first,intent:intent(5)},storage,lock,()=>{}));
 assert.equal(storage.data.size,1);await completeWarehouseCommand(first,storage,lock,()=>{});assert.equal(storage.data.size,0);
});
test('unreadable saved data is neither overwritten nor silently abandoned',async()=>{
 const storage=new MemoryStorage(),lock=locks(),slot=warehouseCommandSlot(scope);storage.setItem(slot,'{invalid');
 await assert.rejects(()=>readPendingWarehouseCommand(scope,storage,lock,()=>{}));
 await assert.rejects(()=>retainWarehouseCommand(scope,intent(),storage,lock,()=>{}));assert.equal(storage.getItem(slot),'{invalid');
});
test('storage failures and retired account checks prevent dispatch preparation',async()=>{
 const storage=new MemoryStorage(),lock=locks();storage.failWrite=true;
 await assert.rejects(()=>retainWarehouseCommand(scope,intent(),storage,lock,()=>{}));assert.equal(storage.data.size,0);
 storage.failWrite=false;storage.failRead=true;await assert.rejects(()=>retainWarehouseCommand(scope,intent(),storage,lock,()=>{}));
 storage.failRead=false;await assert.rejects(()=>retainWarehouseCommand(scope,intent(),storage,lock,()=>{throw new Error('Retired');}));assert.equal(storage.data.size,0);
});
test('a scope change after saving retains the original recovery intent',async()=>{
 const storage=new MemoryStorage(),lock=locks();let checks=0;
 await assert.rejects(()=>retainWarehouseCommand(scope,intent(),storage,lock,()=>{if(++checks===3)throw new Error('Retired after save');}));
 assert.equal(storage.data.size,1);assert.equal((await readPendingWarehouseCommand(scope,storage,lock,()=>{}))?.intent.command.location_id,uuid(3));
});
test('normalization preserves exact dates, nulls, paise and every explicit receive line',()=>{
 const po=prepareWarehouseCommand('purchase_order.create',null,{...input(),expected_at:'2026-10-31T10:30:00+05:30'});
 assert.equal(po.command.expected_at,'2026-10-31T05:00:00.000Z');assert.equal(po.command.notes,null);assert.equal(po.command.supplier_id,null);
 assert.deepEqual(po.command.lines,[{product_id:uuid(4),variant_id:null,quantity:4,unit_cost:0.29}]);
 assert.throws(()=>prepareWarehouseCommand('purchase_order.create',null,input(4,0.005)));
 const receive=prepareWarehouseCommand('transfer.receive',uuid(8),{lines:[{transfer_line_id:uuid(9),quantity:2}],idempotency_key:uuid(10)});
 assert.deepEqual(receive.command,{lines:[{transfer_line_id:uuid(9),quantity:2}]});
 assert.throws(()=>prepareWarehouseCommand('transfer.receive',uuid(8),{lines:[{transfer_line_id:uuid(9),quantity_received:2}],idempotency_key:uuid(10)}));
});
