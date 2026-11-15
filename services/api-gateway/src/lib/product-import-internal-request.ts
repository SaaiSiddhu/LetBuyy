import type { Context } from 'hono';
import { z } from 'zod';
import { domainReconcileEnvironment, PRODUCT_IMPORT_REQUEST_MAX_BYTES,
    validProductImportRequestSecret, verifyProductImportRequest } from '@letbuyy/auth-core';
import type { Env } from '../index';
import { claimInternalAuthReplayJti } from './supabase';

const admitted = new WeakSet<Request>();
const Empty = z.object({}).strict();
export const admittedProductImportRequest = (request:Request) => admitted.has(request);
export function productImportRecoveryConfigured(env:Env):boolean {
    // A dedicated binding admits only this fixed-purpose operation. Existing
    // encrypted app/Identity keyrings are never read, rotated or repurposed.
    return !!domainReconcileEnvironment(env)
        && validProductImportRequestSecret(env.PRODUCT_IMPORT_REQUEST_SECRET);
}

export async function authenticateProductImportRequest(c:Context<{Bindings:Env}>):Promise<'accepted'|'denied'|'unavailable'> {
    const environment=domainReconcileEnvironment(c.env);
    if(!environment || !productImportRecoveryConfigured(c.env)) return 'unavailable';
    const length=c.req.header('Content-Length');
    if(length && (!/^\d+$/.test(length)||Number(length)>PRODUCT_IMPORT_REQUEST_MAX_BYTES))return 'denied';
    const reader=c.req.raw.clone().body?.getReader();
    let timer:ReturnType<typeof setTimeout>|undefined;
    try {
        const chunks:Uint8Array[]=[];let size=0;
        if(reader){
            const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>undefined);reject(new Error('Body deadline'));},3000);});
            while(true){const next=await Promise.race([reader.read(),deadline]);if(next.done)break;
                size+=next.value.byteLength;if(size>PRODUCT_IMPORT_REQUEST_MAX_BYTES){void reader.cancel().catch(()=>undefined);return 'denied';}chunks.push(next.value);}
        }
        const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
        let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytes));}catch{return 'denied';}
        if(!Empty.safeParse(value).success)return 'denied';
        const verified=await verifyProductImportRequest({secret:c.env.PRODUCT_IMPORT_REQUEST_SECRET,
            environment,method:c.req.method,url:c.req.url,body:bytes,headers:c.req.raw.headers});
        if(verified.status!=='accepted')return verified.status;
        const claimed=await claimInternalAuthReplayJti(c.env,{kind:'app:product-import-request',jti:verified.jti,ttlSeconds:240});
        if(claimed!=='claimed')return claimed==='unavailable'?'unavailable':'denied';
        admitted.add(c.req.raw);return 'accepted';
    }catch{return 'unavailable';}
    finally{if(timer)clearTimeout(timer);reader?.releaseLock();}
}
