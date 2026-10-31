'use client';
import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import {prepareWarehouseCommand} from '@letbuyy/commerce-core';
import {WarehouseCommandResultSchema,type WarehouseCommandOperation,type WarehouseCommandResult,type WarehouseCommandIntent} from '@letbuyy/shared-types';
import {useMerchantSecurityContext} from '@/components/security/MerchantSecurityContext';
import {completeWarehouseCommand,readPendingWarehouseCommand,retainWarehouseCommand,warehouseIntentFingerprint,warehouseCommandSlot,
 type SavedWarehouseCommand,type WarehouseScope} from './warehouse-command-journal';

type Scope=WarehouseScope&{identity:string;active:boolean};
export type WarehouseSubmit=(operation:WarehouseCommandOperation,target:string|null,body:Record<string,unknown>)=>Promise<WarehouseCommandResult>;
export class WarehouseRequestStoppedError extends Error {
 constructor(){super('The original warehouse request was stopped before it applied.');this.name='WarehouseRequestStoppedError';}
}
export class WarehouseCommandValidationError extends Error {
 constructor(operation:WarehouseCommandOperation){super(operation==='purchase_order.create'
  ?'Choose valid products and a destination warehouse. Use whole quantities and costs with at most two decimal places.'
  :operation==='transfer.create'?'Choose different source and destination warehouses, valid products and whole quantities.'
  :operation.endsWith('.receive')?'Enter whole receiving quantities for the selected lines.'
  :'Reload the current store record before shipping.');this.name='WarehouseCommandValidationError';}
}
const dependencies=()=>{
 if(!navigator.locks?.request)throw new Error('Browser request recovery is unavailable.');
 return {storage:window.localStorage,locks:navigator.locks};
};
const changed=()=>new Error('Account or store access changed. Reopen this workspace.');
export function useWarehouseCommands(store:string) {
 const {actorId,siteId}=useMerchantSecurityContext(store),identity=`${actorId}:${siteId??'unavailable'}:${store}`;
 const scope=useRef<Scope|null>(null),busy=useRef(false);
 const [state,setState]=useState({identity:'',ready:false,busy:false,pending:null as SavedWarehouseCommand|null,error:null as string|null});
 const current=useCallback((captured:Scope)=>scope.current===captured&&captured.active,[]);
 const check=useCallback((captured:Scope)=>{if(!current(captured))throw changed();},[current]);
 const restore=useCallback(async(captured:Scope)=>{
  if(!current(captured)||busy.current)return;
  setState({identity:captured.identity,ready:false,busy:false,pending:null,error:null});
  try {
   const {storage,locks}=dependencies(),pending=await readPendingWarehouseCommand(captured,storage,locks,()=>check(captured));
   if(current(captured))setState({identity:captured.identity,ready:true,busy:false,pending,error:null});
  }catch{
   if(current(captured))setState({identity:captured.identity,ready:false,busy:false,pending:null,
    error:'The saved warehouse request could not be read. Keep this browser data and check storage and account access.'});
  }
 },[check,current]);
 useLayoutEffect(()=>{
  const captured:Scope={actorId,siteId:siteId??'',store,identity,active:true};scope.current=captured;busy.current=false;
  void restore(captured);
  const storageChanged=(event:StorageEvent)=>{if(event.key===warehouseCommandSlot(captured))void restore(captured);};
  window.addEventListener('storage',storageChanged);
  return ()=>{captured.active=false;window.removeEventListener('storage',storageChanged);};
 },[actorId,siteId,store,identity,restore]);

 const send=useCallback(async(saved:SavedWarehouseCommand,captured:Scope,stop:boolean):Promise<WarehouseCommandResult>=>{
  check(captured);
  const intent=saved.intent,base=`/api/stores/${encodeURIComponent(captured.store)}`;
  const stopPath=`/api/v1/stores/${encodeURIComponent(captured.store)}/inventory/commands/stop`;
  const path=intent.operation==='purchase_order.create'?`${base}/purchase-orders`
   :intent.operation==='transfer.create'?`${base}/transfers`
   :`${base}/${intent.operation.startsWith('purchase_order.')?'purchase-orders':'transfers'}/${encodeURIComponent(intent.target_id!)}/${intent.operation.endsWith('.ship')?'ship':'receive'}`;
  const stopBody={store_id:saved.siteId,idempotency_key:saved.key,...intent};
  const body:Record<string,unknown>={...intent.command,idempotency_key:saved.key};
  if(intent.operation.endsWith('.create')) {
   body.store_id=saved.siteId;
   for(const key of ['notes','expected_at'])if(body[key]===null)delete body[key];
  }else if(body.lines===null)delete body.lines;
  const dispatch=async(cancelling:boolean)=>{
   const response=await fetch(cancelling?stopPath:path,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(20_000),
    headers:{'Content-Type':'application/json','X-Idempotency-Key':saved.key,'X-LetBuyy-Merchant-Context':saved.actorId},
    body:JSON.stringify(cancelling?stopBody:body)});
   const value:unknown=await response.json().catch(()=>null);check(captured);
   return {response,value:value as {data?:unknown;error?:{code?:string}}|null};
  };
  let reply=await dispatch(stop);
  if(!stop&&!reply.response.ok&&reply.value?.error?.code==='WAREHOUSE_REQUEST_STOPPED')reply=await dispatch(true);
  const parsed=WarehouseCommandResultSchema.safeParse(reply.value?.data);
  if(!reply.response.ok||!parsed.success)throw new Error('The original warehouse outcome could not be confirmed.');
  const ack=parsed.data.command_receipt;
  if(ack.actor_id!==saved.actorId||ack.site_id!==saved.siteId||ack.key!==saved.key||
   warehouseIntentFingerprint({operation:ack.operation,target_id:intent.target_id===null?null:ack.target_id,command:ack.command})!==warehouseIntentFingerprint(intent))
   throw new Error('The original warehouse acknowledgement could not be confirmed.');
  const {storage,locks}=dependencies();await completeWarehouseCommand(saved,storage,locks,()=>check(captured));
  check(captured);setState({identity:captured.identity,ready:true,busy:true,pending:null,error:null});return parsed.data;
 },[check]);
 const run=useCallback(async(saved:SavedWarehouseCommand,captured:Scope,stop:boolean)=>{
  setState(s=>({...s,busy:true,pending:saved,error:null}));
  try{return await send(saved,captured,stop);}
  catch(error){if(current(captured))setState(s=>({...s,error:'The outcome is still unconfirmed. The original request is saved in this browser. Check your connection and owner access, then retry or stop it.'}));throw error;}
 },[current,send]);
 const submit:WarehouseSubmit=useCallback(async(operation,target,body)=>{
  const captured=scope.current;if(!captured||captured.identity!==identity||!current(captured)||busy.current)throw changed();
  let intent:WarehouseCommandIntent;
  try{intent=prepareWarehouseCommand(operation,target,{...body,store_id:captured.siteId,idempotency_key:'warehouse-intent-v1'});}
  catch{throw new WarehouseCommandValidationError(operation);}
  busy.current=true;setState(s=>({...s,busy:true,error:null}));
  try {
   let saved:SavedWarehouseCommand;
   try{const {storage,locks}=dependencies();saved=await retainWarehouseCommand(captured,intent,storage,locks,()=>check(captured));}
   catch(error){if(current(captured))setState(s=>({...s,ready:false,error:'The original request could not be saved or confirmed. Check saved requests before continuing.'}));throw error;}
   const result=await run(saved,captured,false);
   if(result.command_receipt.outcome==='cancelled')throw new WarehouseRequestStoppedError();
   return result;
  }finally{if(current(captured)){busy.current=false;setState(s=>({...s,busy:false}));}}
 },[check,current,identity,run]);
 const recover=useCallback(async(stop:boolean)=>{
  const captured=scope.current;if(!captured||captured.identity!==identity||!current(captured)||busy.current)throw changed();
  busy.current=true;setState(s=>({...s,busy:true,error:null}));
  try {
   const {storage,locks}=dependencies(),saved=await readPendingWarehouseCommand(captured,storage,locks,()=>check(captured));
   if(!saved)throw new Error('No warehouse request is awaiting confirmation.');
   return await run(saved,captured,stop);
  }finally{if(current(captured)){busy.current=false;setState(s=>({...s,busy:false}));}}
 },[check,current,identity,run]);
 const visible=state.identity===identity;
 return {identity,scopeToken:scope.current,ready:visible&&state.ready,busy:visible&&state.busy,
  pending:visible?state.pending:null,error:visible?state.error:null,
  blocked:!visible||!state.ready||state.busy||state.pending!==null,submit,recover,
  checkSaved:()=>{const captured=scope.current;if(captured)void restore(captured);}};
}
