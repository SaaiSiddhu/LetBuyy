import {NextRequest,NextResponse} from 'next/server';
import {type WarehouseCommandResult} from '@letbuyy/shared-types';
import {merchantSecurityScope,privateSecurityResponse} from './merchant-security-scope';

export async function merchantWarehouseScope(request:NextRequest,params:Promise<{store:string}>,body:unknown) {
 const scope=await merchantSecurityScope(request,params);if(scope.error)return scope;
 const key=request.headers.get('X-Idempotency-Key');
 if(!key||!RegExp('^[a-zA-Z0-9-]{8,200}$').test(key)||!body||typeof body!=='object'||
  !('idempotency_key' in body)||body.idempotency_key!==key||
  ('store_id' in body&&body.store_id!==scope.storeId))return {error:privateSecurityResponse(NextResponse.json({
   error:{code:'WAREHOUSE_REQUEST_MISMATCH',message:'Retry the original request from the current store.'}}, {status:400}))};
 return {...scope,idempotencyKey:key};
}
export function merchantWarehouseResponse(data:WarehouseCommandResult,scope:{actorId:string;storeId:string},status=200) {
 if(data.command_receipt.actor_id!==scope.actorId||data.command_receipt.site_id!==scope.storeId)
  return privateSecurityResponse(NextResponse.json({error:{code:'WAREHOUSE_ACKNOWLEDGEMENT_UNVERIFIED',
   message:'The warehouse outcome could not be confirmed. Keep the original request for recovery.'}},{status:502}));
 return privateSecurityResponse(NextResponse.json({data},{status}));
}
