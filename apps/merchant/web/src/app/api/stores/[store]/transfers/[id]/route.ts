import {NextRequest,NextResponse} from 'next/server';
import {WarehouseDocumentParamsSchema} from '@letbuyy/shared-types';
import {createMerchantApiClient,merchantApiErrorResponse} from '@/lib/api/client';
import {merchantSecurityScope,privateSecurityResponse} from '@/lib/api/merchant-security-scope';
export async function GET(request:NextRequest,{params}:{params:Promise<{store:string;id:string}>}) {
 try {
  const scope=await merchantSecurityScope(request,params,false);if(scope.error)return scope.error;
  // The route also has a store segment; validate only the document identifier.
  const target=WarehouseDocumentParamsSchema.safeParse({id:(await params).id});
  if(!target.success)return privateSecurityResponse(NextResponse.json({error:{code:'VALIDATION_ERROR',message:'Choose a valid warehouse record.'}},{status:400}));
  const data=await createMerchantApiClient().inventory.transfers.get(target.data.id,{store_id:scope.storeId},{storeId:scope.storeId,cache:'no-store'});
  return privateSecurityResponse(NextResponse.json({data}));
 }catch(error){return privateSecurityResponse(merchantApiErrorResponse(error,'This warehouse record is unavailable.'));}
}
