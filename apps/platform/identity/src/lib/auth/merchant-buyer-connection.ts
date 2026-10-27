import { z } from 'zod'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { MERCHANT_BUYER_CONNECTION_COOKIE, MERCHANT_BUYER_CONNECTION_TTL_SECONDS } from '@letbuyy/auth-core'
import { identityApiRequest } from '@/lib/api/client'
import { parseAuthorizationRequest, type BuyerAuthorizationRequest } from './buyer-authorization'

export const ConnectionBrowserInput = z.object({
 authorization:z.record(z.string(),z.unknown()),email:z.string().email().max(254),password:z.string().min(1).max(128),
 mfaCode:z.string().max(64).optional(),turnstileToken:z.string().max(4096),
}).strict()
export const ConnectionProofInput = z.object({authorization:z.record(z.string(),z.unknown()),code:z.string().regex(/^\d{6}$/),consent:z.literal(true)}).strict()
export const ConnectionCancelInput = z.object({authorization:z.record(z.string(),z.unknown())}).strict()
export const hashConnectionValue = (value:string) => createHash('sha256').update(value).digest('hex')
export const freshConnectionVerifier = () => randomBytes(32).toString('hex')
export async function acceptedConnectionRequest(input:Record<string,unknown>):Promise<BuyerAuthorizationRequest|null> {
 const request=parseAuthorizationRequest(input);if(!request)return null
 const check=await identityApiRequest('/storefront/buyer/authorization-codes/check',{method:'POST',body:JSON.stringify({client_id:request.clientId,redirect_uri:request.redirectUri})})
 if(!check.ok)return null
 return request
}
export const connectionRequestHash=(request:BuyerAuthorizationRequest)=>hashConnectionValue(JSON.stringify(request))
export async function retainConnection(intentId:string,verifier:string) {
 const store=await cookies();store.set(MERCHANT_BUYER_CONNECTION_COOKIE,`${intentId}.${verifier}`,{
  httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/auth/login',maxAge:MERCHANT_BUYER_CONNECTION_TTL_SECONDS,
 })
}
export async function connectionProof() {
 const value=(await cookies()).get(MERCHANT_BUYER_CONNECTION_COOKIE)?.value||''
 const parts=/^([0-9a-f-]{36})\.([a-f0-9]{64})$/.exec(value)
 return parts?{intent_id:parts[1],verifier_hash:hashConnectionValue(parts[2])}:null
}
export async function clearConnection() {
 (await cookies()).set(MERCHANT_BUYER_CONNECTION_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/auth/login',maxAge:0})
}
