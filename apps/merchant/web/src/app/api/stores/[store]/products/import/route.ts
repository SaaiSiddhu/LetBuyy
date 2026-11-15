import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'
import { ProductCsvImportSchema, ProductImportRegistrationStopSchema, ProductImportJobCommandSchema, ProductImportHistoryQuerySchema,
    ProductImportRowsQuerySchema, PRODUCT_IMPORT_MAX_BYTES, UuidSchema, type ProductImportJob } from '@letbuyy/shared-types'

type RouteParams = {params:Promise<{store:string}>}
async function readImportJson(request:NextRequest) {
    const failure=(large=false)=>({error:privateSecurityResponse(NextResponse.json({error:{code:large?'IMPORT_TOO_LARGE':'VALIDATION_ERROR',
        message:large?'Split this CSV into smaller files; each request must fit one MiB.':'A valid import request is required.'}},{status:large?413:400}))})
    const length=request.headers.get('content-length')
    if(length&&(!/^\d+$/.test(length)||Number(length)>PRODUCT_IMPORT_MAX_BYTES))return failure(true)
    if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return failure()
    const reader=request.body?.getReader();if(!reader)return failure()
    let timer:ReturnType<typeof setTimeout>|undefined
    try {
        const chunks:Uint8Array[]=[];let size=0
        const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>undefined);reject(new Error('Request deadline'))},10000)})
        while(true){const next=await Promise.race([reader.read(),deadline]);if(next.done)break
            size+=next.value.byteLength;if(size>PRODUCT_IMPORT_MAX_BYTES){void reader.cancel().catch(()=>undefined);return failure(true)}chunks.push(next.value)}
        const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
        return {body:JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)) as unknown}
    }catch{return failure()}
    finally{if(timer)clearTimeout(timer);reader.releaseLock()}
}
function acknowledged(job:ProductImportJob|null,scope:{actorId:string;storeId:string}) {
    if(job&&(job.actor_id!==scope.actorId||job.store_id!==scope.storeId))throw new Error('Import acknowledgement scope changed.')
    return job
}
export async function GET(request:NextRequest,{params}:RouteParams) {
    try {
        const scope=await merchantSecurityScope(request,params,false);if(scope.error)return scope.error
        const client=createMerchantApiClient(),query=Object.fromEntries(request.nextUrl.searchParams)
        let data:unknown
        if(query.view==='capabilities') {
            if(Object.keys(query).length!==1)throw new Error('Invalid capability query')
            const capabilities=await client.productImports.capabilities(scope.storeId)
            if(capabilities.actor_id!==scope.actorId)throw new Error('Import capability context changed.')
            data=capabilities
        } else if(query.view==='key') {
            if(Object.keys(query).sort().join(',')!=='key,view'||!UuidSchema.safeParse(query.key).success)return privateSecurityResponse(NextResponse.json({error:{message:'An original import key is required.'}},{status:400}))
            data={job:acknowledged((await client.productImports.byKey(scope.storeId,query.key)).job,scope)}
        } else if(query.view==='job') {
            if(Object.keys(query).sort().join(',')!=='id,view'||!UuidSchema.safeParse(query.id).success)return privateSecurityResponse(NextResponse.json({error:{message:'Choose a valid import.'}},{status:400}))
            data={job:acknowledged((await client.productImports.get(scope.storeId,query.id)).job,scope)}
        } else if(query.view==='rows') {
            const {view,id,...rest}=query
            if(!UuidSchema.safeParse(id).success)return privateSecurityResponse(NextResponse.json({error:{message:'Choose a valid import.'}},{status:400}))
            const q=ProductImportRowsQuerySchema.safeParse({...rest,store_id:scope.storeId})
            if(!q.success)return privateSecurityResponse(NextResponse.json({error:{message:'Review the rows page.'}},{status:400}))
            const page=await client.productImports.rows(id,q.data)
            if(page.meta.actor_id!==scope.actorId)throw new Error('Import rows context changed.')
            data=page
        } else {
            const q=ProductImportHistoryQuerySchema.safeParse({...query,store_id:scope.storeId})
            if(!q.success)return privateSecurityResponse(NextResponse.json({error:{message:'Review the import page.'}},{status:400}))
            const page=await client.productImports.history(q.data)
            if(page.meta.actor_id!==scope.actorId)throw new Error('Import history context changed.')
            data=page
        }
        return privateSecurityResponse(NextResponse.json({data}))
    }catch(error){return privateSecurityResponse(merchantApiErrorResponse(error,'Unable to confirm imports'))}
}
export async function POST(request:NextRequest,{params}:RouteParams) {
    try {
        const scope=await merchantSecurityScope(request,params);if(scope.error)return scope.error
        const input=await readImportJson(request);if('error'in input)return input.error
        const body=input.body
        const parsed=ProductCsvImportSchema.safeParse(body)
        if(!parsed.success||parsed.data.store_id!==scope.storeId||parsed.data.idempotency_key!==request.headers.get('X-Idempotency-Key'))return privateSecurityResponse(NextResponse.json({error:{code:'PRODUCT_IMPORT_REQUEST_MISMATCH',message:'Keep the original import and selected store.'}},{status:400}))
        const {job}=await createMerchantApiClient().productImports.register(parsed.data)
        return privateSecurityResponse(NextResponse.json({data:{job:acknowledged(job,scope)}},{status:202}))
    }catch(error){return privateSecurityResponse(merchantApiErrorResponse(error,'The import outcome could not be confirmed. Keep the original file and request.'))}
}
export async function PATCH(request:NextRequest,{params}:RouteParams) {
    try {
        const scope=await merchantSecurityScope(request,params);if(scope.error)return scope.error
        const envelope=await readImportJson(request);if('error'in envelope)return envelope.error
        const body=envelope.body
        if(!body||typeof body!=='object'||Array.isArray(body)||!('action'in body))return privateSecurityResponse(NextResponse.json({error:{message:'Choose retry or stop.'}},{status:400}))
        const action=body.action
        if(action!=='retry'&&action!=='stop')return privateSecurityResponse(NextResponse.json({error:{message:'Choose retry or stop.'}},{status:400}))
        const {action:_,...input}=body
        const parsed=ProductImportJobCommandSchema.safeParse(input)
        if(!parsed.success||parsed.data.store_id!==scope.storeId||parsed.data.idempotency_key!==request.headers.get('X-Idempotency-Key'))return privateSecurityResponse(NextResponse.json({error:{code:'PRODUCT_IMPORT_REQUEST_MISMATCH',message:'Use the original import identity.'}},{status:400}))
        const {job}=await createMerchantApiClient().productImports.command(parsed.data,action)
        return privateSecurityResponse(NextResponse.json({data:{job:acknowledged(job,scope)}},{status:action==='stop'?200:202}))
    }catch(error){return privateSecurityResponse(merchantApiErrorResponse(error,'The recovery outcome could not be confirmed. Reload the original import.'))}
}

export async function PUT(request:NextRequest,{params}:RouteParams) {
    try {
        const scope=await merchantSecurityScope(request,params);if(scope.error)return scope.error
        const envelope=await readImportJson(request);if('error'in envelope)return envelope.error
        const parsed=ProductImportRegistrationStopSchema.safeParse(envelope.body)
        if(!parsed.success||parsed.data.store_id!==scope.storeId||parsed.data.idempotency_key!==request.headers.get('X-Idempotency-Key'))return privateSecurityResponse(NextResponse.json({error:{code:'PRODUCT_IMPORT_REQUEST_MISMATCH',message:'Use the original import identity.'}},{status:400}))
        const {job}=await createMerchantApiClient().productImports.stopRegistration(parsed.data)
        return privateSecurityResponse(NextResponse.json({data:{job:acknowledged(job,scope)}}))
    }catch(error){return privateSecurityResponse(merchantApiErrorResponse(error,'The original stop could not be confirmed. Keep the request for recovery.'))}
}
