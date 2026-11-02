import {NextRequest,NextResponse} from 'next/server';
import {StopWarehouseCommandSchema} from '@letbuyy/commerce-core';
import {createMerchantApiClient,merchantApiErrorResponse} from '@/lib/api/client';
import {merchantWarehouseScope,merchantWarehouseResponse} from '@/lib/api/merchant-warehouse-scope';
import {privateSecurityResponse} from '@/lib/api/merchant-security-scope';

export async function POST(request:NextRequest,{params}:{params:Promise<{store:string}>}) {
 try {
  const body:unknown=await request.json(),scope=await merchantWarehouseScope(request,params,body);
  if(scope.error)return scope.error;
  const parsed=StopWarehouseCommandSchema.safeParse(body);
  if(!parsed.success)return privateSecurityResponse(NextResponse.json({error:{code:'VALIDATION_ERROR',
   message:'Supply the complete original warehouse request.'}},{status:400}));
  const data=await createMerchantApiClient().inventory.stopCommand(parsed.data,{storeId:scope.storeId,idempotencyKey:scope.idempotencyKey});
  return merchantWarehouseResponse(data,scope);
 }catch(error){return privateSecurityResponse(merchantApiErrorResponse(error,'Unable to confirm the warehouse request.'));}
}
