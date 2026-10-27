import { NextRequest,NextResponse } from 'next/server'
import { identityApiRequest } from '@/lib/api/client'
import { validateCsrf } from '@/lib/auth/csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { createSession,destroySession } from '@/lib/auth/session'
import { prepareIdentityIssuedBuyerSession } from '@/lib/auth/identity-issued-session'
import { setBuyerSessionCookie } from '@/lib/auth/buyer-session'
import { parseAuthorizationRequest } from '@/lib/auth/buyer-authorization'
import { acceptedConnectionRequest,ConnectionBrowserInput,ConnectionProofInput,ConnectionCancelInput,connectionRequestHash,freshConnectionVerifier,hashConnectionValue,retainConnection,connectionProof,clearConnection } from './merchant-buyer-connection'

// Existing /api/auth/login transport only. Business state is owned by the Gateway's atomic RPCs.
export async function startMerchantBuyerConnection(request:NextRequest) {
 let temporarySession:string|null=null,retained=false
 try {
  if(!validateCsrf(request))return NextResponse.json({error:'Refresh this page and try again.'},{status:403})
  const ip=request.headers.get('x-forwarded-for')||'unknown',limit=await checkRateLimit('login',ip)
  if(!limit.allowed)return NextResponse.json({error:'Too many attempts. Please try again later.'},{status:429})
  const input=ConnectionBrowserInput.safeParse(await request.json().catch(()=>null))
  if(!input.success)return NextResponse.json({error:'Check your account details and try again.'},{status:400})
  const v=input.data,authorization=await acceptedConnectionRequest(v.authorization)
  if(!authorization)return NextResponse.json({error:'Start sign-in again from your store.'},{status:400})
  if(!await verifyTurnstileToken(v.turnstileToken,ip))return NextResponse.json({error:'Complete human verification and try again.'},{status:403})
  const authenticated=await identityApiRequest('/auth/custom/users/authenticate',{method:'POST',body:JSON.stringify({email:v.email.toLowerCase().trim(),password:v.password,mfa_code:v.mfaCode})})
  const identity=await authenticated.json() as {data?:{id:string;email_verified:boolean};error?:{code?:string}}|null
  if(!authenticated.ok||!identity?.data?.id||!identity.data.email_verified){
   if(identity?.error?.code==='MFA_REQUIRED')return NextResponse.json({error:'Enter your Merchant authenticator code.',mfaRequired:true},{status:403})
   return NextResponse.json({error:'Unable to sign in. Check your Merchant account details.'},{status:authenticated.status>=500?503:401})
  }
  temporarySession=await createSession(identity.data.id)
  const verifier=freshConnectionVerifier()
  const started=await identityApiRequest('/auth/custom/buyer-connections/start',{method:'POST',
   body:JSON.stringify({merchant_session_token:temporarySession,verifier_hash:hashConnectionValue(verifier),request_hash:connectionRequestHash(authorization)})})
  const payload=await started.json() as {data?:{intent_id:string;email:string}}|null
  if(!started.ok||!payload?.data?.intent_id)return NextResponse.json({error:started.status>=500?'We could not send the connection email. Please try again later.':'Unable to connect this account. Start again from your store.'},{status:started.status>=500?503:401})
  await retainConnection(payload.data.intent_id,verifier);retained=true
  return NextResponse.json({email:payload.data.email,expiresIn:600},{headers:{'Cache-Control':'no-store'}})
 }catch{return NextResponse.json({error:'Account connection is unavailable. Please try again later.'},{status:503})}
 finally{if(temporarySession&&!retained)await destroySession(temporarySession).catch(()=>undefined)}
}

export async function confirmMerchantBuyerConnection(request:NextRequest){
 try{
  if(!validateCsrf(request))return NextResponse.json({error:'Refresh this page and try again.'},{status:403})
  if(!(await checkRateLimit('verify_otp',request.headers.get('x-forwarded-for')||'unknown')).allowed)return NextResponse.json({error:'Too many attempts. Please try again later.'},{status:429})
  const input=ConnectionProofInput.safeParse(await request.json().catch(()=>null)),proof=await connectionProof()
  if(!input.success||!proof)return NextResponse.json({error:'This connection expired. Start again from your store.'},{status:401})
  const authorization=await acceptedConnectionRequest(input.data.authorization)
  if(!authorization)return NextResponse.json({error:'Start sign-in again from your store.'},{status:400})
  const issue=await prepareIdentityIssuedBuyerSession()
  const connected=await identityApiRequest('/auth/custom/buyer-connections/confirm',{method:'POST',body:JSON.stringify({...proof,request_hash:connectionRequestHash(authorization),code:input.data.code,consent:true})})
  const payload=await connected.json() as {data?:{buyer?:{id:string;session_epoch:number}}}|null,buyer=payload?.data?.buyer
  if(!connected.ok||!buyer)return NextResponse.json({error:'This code or connection is not valid. Check the newest email or start again.'},{status:connected.status>=500?503:401})
  await setBuyerSessionCookie(await issue({buyerAccountId:buyer.id,sessionEpoch:buyer.session_epoch}));await clearConnection()
  return NextResponse.json({success:true},{headers:{'Cache-Control':'no-store'}})
 }catch{return NextResponse.json({error:'Account connection is unavailable. Please try again later.'},{status:503})}
}

export async function cancelMerchantBuyerConnection(request:NextRequest){
 if(!validateCsrf(request))return NextResponse.json({error:'Invalid request.'},{status:403})
 try{
  const input=ConnectionCancelInput.safeParse(await request.json().catch(()=>null)),proof=await connectionProof()
  const authorization=input.success?parseAuthorizationRequest(input.data.authorization):null
  if(proof&&authorization)await identityApiRequest('/auth/custom/buyer-connections/cancel',{method:'POST',body:JSON.stringify({...proof,request_hash:connectionRequestHash(authorization)})})
  await clearConnection();return NextResponse.json({cancelled:true},{headers:{'Cache-Control':'no-store'}})
 }catch{return NextResponse.json({error:'Please try again.'},{status:503})}
}
