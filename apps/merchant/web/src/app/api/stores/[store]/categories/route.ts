import {NextRequest,NextResponse}from 'next/server'
import {CreateCategoryCommandSchema,ProductCategoryListQuerySchema}from '@letbuyy/shared-types'
import {createMerchantApiClient,merchantApiErrorResponse}from '@/lib/api/client'
import {merchantSecurityScope,privateSecurityResponse}from '@/lib/api/merchant-security-scope'

export async function GET(request:NextRequest,{params}:{params:Promise<{store:string}>}){
 try{
  const scope=await merchantSecurityScope(request,params,false);if(scope.error)return scope.error
  const query=ProductCategoryListQuerySchema.safeParse({...Object.fromEntries(request.nextUrl.searchParams),store_id:scope.storeId})
  if(!query.success)return privateSecurityResponse(NextResponse.json({error:{code:'VALIDATION_ERROR',message:'Review the category page and search.'}},{status:400}))
  const result=await createMerchantApiClient().categories.page({...query.data,flat:query.data.flat===undefined?undefined:true})
  return privateSecurityResponse(NextResponse.json(result))
 }catch(error){return privateSecurityResponse(merchantApiErrorResponse(error,'Categories are temporarily unavailable.'))}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{store:string}>}){
 try{
  const scope=await merchantSecurityScope(request,params);if(scope.error)return scope.error
  const body:unknown=await request.json().catch(()=>null)
  const parsed=CreateCategoryCommandSchema.safeParse(body)
  if(!parsed.success||parsed.data.store_id!==scope.storeId||parsed.data.idempotency_key!==request.headers.get('X-Idempotency-Key'))
   return privateSecurityResponse(NextResponse.json({error:{code:'VALIDATION_ERROR',message:'Keep the original category request and selected store.'}},{status:400}))
  const data=await createMerchantApiClient().categories.create(parsed.data)
  return privateSecurityResponse(NextResponse.json({data},{status:201}))
 }catch(error){return privateSecurityResponse(merchantApiErrorResponse(error,'The original category save could not be confirmed.'))}
}
