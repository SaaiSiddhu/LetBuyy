import {StopWarehouseCommandSchema} from '@letbuyy/commerce-core';
import {UuidSchema,type WarehouseCommandIntent} from '@letbuyy/shared-types';

export type WarehouseScope={actorId:string;siteId:string;store:string};
export type SavedWarehouseCommand=WarehouseScope&{version:1;key:string;intent:WarehouseCommandIntent};
export type WarehouseStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type WarehouseLocks={request<T>(name:string,callback:()=>Promise<T>|T):Promise<T>};
export const warehouseCommandSlot=(scope:WarehouseScope)=>`letbuyy.warehouse-command.v1:${scope.actorId}:${scope.siteId}`;
const slot=warehouseCommandSlot;
const unavailable=()=>new Error('The saved warehouse request needs recovery. Keep this browser data.');
function ordered(value:unknown):unknown {
 if(Array.isArray(value))return value.map(ordered);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,ordered(v)]));
 return value;
}
export const warehouseIntentFingerprint=(value:WarehouseCommandIntent)=>JSON.stringify(ordered(value));
function capture(value:SavedWarehouseCommand):SavedWarehouseCommand {
 const frozen=JSON.parse(JSON.stringify(value)) as SavedWarehouseCommand;
 function freeze(value:unknown){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}}
 freeze(frozen);return frozen;
}
function checkedScope(scope:WarehouseScope) {
 if(!UuidSchema.safeParse(scope.actorId).success||!UuidSchema.safeParse(scope.siteId).success||!scope.store||scope.store.length>200)throw unavailable();
}
function read(scope:WarehouseScope,storage:WarehouseStorage):SavedWarehouseCommand|null {
 checkedScope(scope);const raw=storage.getItem(slot(scope));if(raw===null)return null;
 try {
  const value=JSON.parse(raw) as SavedWarehouseCommand;
  if(!value||Object.keys(value).sort().join(',')!=='actorId,intent,key,siteId,store,version'||value.version!==1||
   value.actorId!==scope.actorId||value.siteId!==scope.siteId||typeof value.store!=='string'||!value.store||value.store.length>200||!UuidSchema.safeParse(value.key).success||
   !value.intent||Object.keys(value.intent).sort().join(',')!=='command,operation,target_id')throw unavailable();
  const parsed=StopWarehouseCommandSchema.safeParse({store_id:scope.siteId,idempotency_key:value.key,...value.intent});
  if(!parsed.success)throw unavailable();
  return capture(value);
 }catch{throw unavailable();}
}
export function readPendingWarehouseCommand(scope:WarehouseScope,storage:WarehouseStorage,locks:WarehouseLocks,check:()=>void) {
 return locks.request(slot(scope),()=>{check();const value=read(scope,storage);check();return value;});
}
export function retainWarehouseCommand(scope:WarehouseScope,intent:WarehouseCommandIntent,storage:WarehouseStorage,
 locks:WarehouseLocks,check:()=>void,mint=()=>crypto.randomUUID()):Promise<SavedWarehouseCommand> {
 return locks.request(slot(scope),()=>{
  check();const old=read(scope,storage);
  if(old){if(warehouseIntentFingerprint(old.intent)!==warehouseIntentFingerprint(intent))
   throw new Error('Resolve the original warehouse request before changing its details.');return old;}
  const value=capture({actorId:scope.actorId,siteId:scope.siteId,store:scope.store,version:1,key:mint(),intent});
  if(!UuidSchema.safeParse(value.key).success||!StopWarehouseCommandSchema.safeParse({store_id:scope.siteId,idempotency_key:value.key,...intent}).success)throw unavailable();
  const encoded=JSON.stringify(value);check();storage.setItem(slot(scope),encoded);
  if(storage.getItem(slot(scope))!==encoded)throw unavailable();check();return value;
 });
}
export function completeWarehouseCommand(value:SavedWarehouseCommand,storage:WarehouseStorage,locks:WarehouseLocks,check:()=>void) {
 return locks.request(slot(value),()=>{
  check();const old=read(value,storage);
  if(old===null)return;
  if(old.key!==value.key||warehouseIntentFingerprint(old.intent)!==warehouseIntentFingerprint(value.intent))throw unavailable();
  check();storage.removeItem(slot(value));if(storage.getItem(slot(value))!==null)throw unavailable();check();
 });
}
