import {NextRequest,NextResponse} from 'next/server';
import {createMerchantApiClient,merchantApiErrorResponse} from '@/lib/api/client';
import {merchantSecurityScope,privateSecurityResponse} from '@/lib/api/merchant-security-scope';

export async function GET(request:NextRequest,{params}:{params:Promise<{store:string}>}) {
 try {
  const scope=await merchantSecurityScope(request,params,false);if(scope.error)return scope.error;
  const data=await createMerchantApiClient().inventory.capabilities({store_id:scope.storeId},{storeId:scope.storeId,cache:'no-store'});
  if(data.actor_id!==scope.actorId)return privateSecurityResponse(NextResponse.json({error:{code:'WAREHOUSE_PROTOCOL_UNVERIFIED',
   message:'Warehouse request support could not be confirmed.'}},{status:503}));
  return privateSecurityResponse(NextResponse.json({data}));
 }catch(error){return privateSecurityResponse(merchantApiErrorResponse(error,'Warehouse request support is unavailable.'));}
}
