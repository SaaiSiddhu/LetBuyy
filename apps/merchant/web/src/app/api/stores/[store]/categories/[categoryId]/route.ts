import {NextRequest,NextResponse}from 'next/server'
import {UpdateCategoryCommandSchema,DeleteCategoryCommandSchema,UuidSchema}from '@letbuyy/shared-types'
import {createMerchantApiClient,merchantApiErrorResponse}from '@/lib/api/client'
import {merchantSecurityScope,privateSecurityResponse}from '@/lib/api/merchant-security-scope'
type Params={params:Promise<{store:string;categoryId:string}>}
export async function GET(request:NextRequest,{params}:Params){
 try{
  const scope=await merchantSecurityScope(request,params,false);if(scope.error)return scope.error
  const id=UuidSchema.safeParse((await params).categoryId)
  if(!id.success)return privateSecurityResponse(NextResponse.json({error:{code:'VALIDATION_ERROR',message:'Choose a valid category.'}},{status:400}))
  return privateSecurityResponse(NextResponse.json({data:await createMerchantApiClient().categories.get(id.data,scope.storeId)}))
 }catch(error){return privateSecurityResponse(merchantApiErrorResponse(error,'The category could not be confirmed.'))}
}
async function mutate(request:NextRequest,{params}:Params,operation:'update'|'delete'){
 try{
  const scope=await merchantSecurityScope(request,params);if(scope.error)return scope.error
  const body:unknown=await request.json().catch(()=>null),id=UuidSchema.safeParse((await params).categoryId)
  const parsed=(operation==='update'?UpdateCategoryCommandSchema:DeleteCategoryCommandSchema).safeParse(body)
  if(!id.success||!parsed.success||parsed.data.store_id!==scope.storeId||parsed.data.idempotency_key!==request.headers.get('X-Idempotency-Key'))
   return privateSecurityResponse(NextResponse.json({error:{code:'VALIDATION_ERROR',message:'Keep the original category request, version and selected store.'}},{status:400}))
  const client=createMerchantApiClient()
  const data=operation==='update'?await client.categories.update(id.data,UpdateCategoryCommandSchema.parse(parsed.data))
   :await client.categories.remove(id.data,DeleteCategoryCommandSchema.parse(parsed.data))
  return privateSecurityResponse(NextResponse.json({data}))
 }catch(error){return privateSecurityResponse(merchantApiErrorResponse(error,'The original category change could not be confirmed.'))}
}
export const PATCH=(request:NextRequest,params:Params)=>mutate(request,params,'update')
export const DELETE=(request:NextRequest,params:Params)=>mutate(request,params,'delete')
