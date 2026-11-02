'use client';
import {useCallback,useState} from 'react';
import {useReadRequest} from '@/lib/api/use-read-request';
import {useMerchantSecurityContext} from '@/components/security/MerchantSecurityContext';

/** Fresh action preparation only; command authority is checked again at dispatch. */
export function useWarehouseDocument(store:string) {
 const {actorId,siteId}=useMerchantSecurityContext(store),beginRead=useReadRequest(store);
 const [loading,setLoading]=useState(false);
 const load=useCallback(async<T extends {id:string;site_id:string}>(resource:'purchase-orders'|'transfers',id:string,
  schema:{safeParse(value:unknown):{success:true;data:T}|{success:false}}):Promise<T>=>{
  const request=beginRead();setLoading(true);
  try{
   const response=await fetch(`/api/stores/${encodeURIComponent(store)}/${resource}/${encodeURIComponent(id)}`,{
    method:'GET',cache:'no-store',signal:AbortSignal.any([request.signal,AbortSignal.timeout(15_000)]),
    headers:{'X-LetBuyy-Merchant-Context':actorId}});
   const body:unknown=await response.json();
   if(!request.isCurrent())throw new Error('The current account or store changed.');
   const parsed=schema.safeParse(body&&typeof body==='object'&&'data'in body?body.data:undefined);
   if(!response.ok||!parsed.success||parsed.data.id!==id||parsed.data.site_id!==siteId)
    throw new Error('The current warehouse record could not be confirmed.');
   return parsed.data;
  }finally{if(request.isCurrent())setLoading(false);}
 },[actorId,siteId,store,beginRead]);
 return {load,loading};
}
