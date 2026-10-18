import { SignJWT } from 'jose';
import {z} from 'zod';
import { PLATFORM_MAGIC_AUDIENCE, PLATFORM_MAGIC_TTL, PLATFORM_SESSION_AUDIENCE, PLATFORM_SESSION_TTL,
 verifyIdentityPlatformMagic, verifyIdentityPlatformSession, verifyConsoleIdentityProof } from '@letbuyy/auth-core/platform-identity';
import {identityApiRequest} from '@/lib/api/client';
import {isProductionIdentityRuntime} from '@/lib/dev-auth-bypass';
import {prepareIdentitySigningKey} from './identity-issued-session';
import {getConsoleFactorFingerprint,matchConsoleTotpCounter} from './operator-factor';
const tokenSchema=z.string().min(1).max(4096);
const Command=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('magic'),email:z.string().trim().email().max(254)}).strict(),
 z.object({operation:z.literal('exchange'),magic_token:tokenSchema}).strict(),
 z.object({operation:z.literal('mfa'),current_token:tokenSchema,code:z.string().trim().regex(/^\d{6}$/)}).strict(),
 z.object({operation:z.literal('request_mfa_reset'),current_token:tokenSchema,actor_id:z.string().uuid(),reason:z.string().trim().min(8).max(1000),request_key:z.string().uuid()}).strict(),
]);
class OperatorFailure extends Error {
 constructor(readonly status:number,readonly code:string,message:string){super(message);}
}
function allowed(email:string){return (process.env.PLATFORM_CONSOLE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(email);}
function denied():never {throw new OperatorFailure(401,'OPERATOR_PROOF_REQUIRED','A current operator authentication proof is required.');}
async function gateway<T>(path:string,body?:unknown,token?:string,previous?:string):Promise<T>{
 const headers=new Headers();
 if(token)headers.set('X-Platform-Console-Session',token);
 if(previous)headers.set('X-Platform-Console-Previous-Session',previous);
 if(path.startsWith('/internal/console/'))headers.set('Authorization','Bearer '+(process.env.PLATFORM_CONSOLE_API_TOKEN||''));
 const response=await identityApiRequest<{data?:T;error?:{code?:string;message?:string}}>(path,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
 const result=await response.json();
 if(!response.ok||!result?.data)throw new OperatorFailure(response.status>=400?response.status:503,result?.error?.code||'OPERATOR_STORAGE_UNAVAILABLE',result?.error?.message||'Operator authentication is temporarily unavailable.');
 return result.data;
}
async function verificationConfig(){
 // Public configuration is explicit on verifiers. Identity may derive its own
 // public half from the validated sole private key without publishing OIDC.
 if(process.env.LETBUYY_IDENTITY_PUBLIC_JWKS)return {issuer:process.env.LETBUYY_IDENTITY_ISSUER,publicJwks:process.env.LETBUYY_IDENTITY_PUBLIC_JWKS};
 const prepared=await prepareIdentitySigningKey();
 return {issuer:prepared.issuer,publicJwks:prepared.publicJwks};
}
async function prepareOperatorIssuer(){
 const prepared=await prepareIdentitySigningKey();
 return async(actor:{email:string;userId:string},purpose:'magic'|'session',mfa=false)=>{
  const now=Math.floor(Date.now()/1000),magic=purpose==='magic';
  return new SignJWT({realm:'platform',token_use:magic?'platform_magic_link':'platform_session',email:actor.email,
   ...(!magic?{mfa_verified:mfa,mfa_verified_at:mfa?now:null}:{})})
   .setProtectedHeader({alg:prepared.alg,typ:'JWT',kid:prepared.kid}).setIssuer(prepared.issuer)
   .setAudience(magic?PLATFORM_MAGIC_AUDIENCE:PLATFORM_SESSION_AUDIENCE).setSubject(actor.userId)
   .setIssuedAt(now).setExpirationTime(now+(magic?PLATFORM_MAGIC_TTL:PLATFORM_SESSION_TTL)).setJti(crypto.randomUUID()).sign(prepared.key);
 };
}
export async function executeOperatorConsole(request:Request):Promise<Response>{
 try{
  if(Number(request.headers.get('content-length')||0)>12000)throw new OperatorFailure(413,'INVALID_REQUEST','Invalid operator request.');
  const raw=await request.text();if(raw.length>12000)throw new OperatorFailure(413,'INVALID_REQUEST','Invalid operator request.');
  const jti=await verifyConsoleIdentityProof(raw,request.headers,process.env.PLATFORM_CONSOLE_API_TOKEN||'');
  if(!jti)denied();
  let input:unknown;try{input=JSON.parse(raw);}catch{throw new OperatorFailure(400,'INVALID_REQUEST','Invalid operator request.');}
  const command=Command.safeParse(input);if(!command.success)throw new OperatorFailure(400,'INVALID_REQUEST','Invalid operator request.');
  await gateway('/internal/identity/operator/bridge-claim',{jti});
  const c=command.data;
  if(c.operation==='magic'){
   // Pending approved inbox/provider proof stays a uniform production refusal.
   if(isProductionIdentityRuntime(process.env))throw new OperatorFailure(503,'magic_link_delivery_not_configured','Operator email delivery is not configured.');
   const email=c.email.toLowerCase();if(!allowed(email))denied();
   const issue=await prepareOperatorIssuer();
   const actor=await gateway<{actor_id:string;email:string}>('/internal/identity/operator/lookup',{email});
   return Response.json({ok:true,magic_token:await issue({email:actor.email,userId:actor.actor_id},'magic')},{headers:{'cache-control':'no-store'}});
  }
  const config=await verificationConfig();
  if(c.operation==='exchange'){
   const issue=await prepareOperatorIssuer(); // Before consuming the one-use magic proof.
   const proof=await verifyIdentityPlatformMagic(c.magic_token,config);if(!proof||!allowed(proof.email))denied();
   const token=await issue(proof,'session');
   await gateway('/internal/identity/operator/exchange',{magic_token:c.magic_token},token);
   return Response.json({ok:true,token},{headers:{'cache-control':'no-store'}});
  }
  const current=await verifyIdentityPlatformSession(c.current_token,config);if(!current||!allowed(current.email))denied();
  const live=await gateway<{actor_id:string;email:string}>('/internal/identity/operator/current',undefined,c.current_token);
  if(live.actor_id!==current.userId||live.email!==current.email)denied();
  if(c.operation==='mfa'){
   const issue=await prepareOperatorIssuer();
   const match=matchConsoleTotpCounter(c.code,current.email),fingerprint=getConsoleFactorFingerprint(current.email);
   if(!fingerprint||(!match.ok&&match.reason==='unavailable'))throw new OperatorFailure(503,'mfa_not_configured','Operator authenticator configuration is unavailable.');
   const token=await issue(current,'session',true);
   const result=await gateway<{verified:boolean;reason?:string}>('/internal/identity/operator/mfa',{counter:match.ok?match.counter:null,factor_fingerprint:fingerprint},token,c.current_token);
   // A proposed elevated token never leaves Identity until durable verification.
   if(!result.verified)return Response.json({ok:false,reason:result.reason||'invalid'},{headers:{'cache-control':'no-store'}});
   return Response.json({ok:true,token},{headers:{'cache-control':'no-store'}});
  }
  const targets=await gateway<{items:{actor_id:string;email:string}[]}>('/internal/console/sessions/mfa-reset/targets?actor_id='+c.actor_id,undefined,c.current_token);
  const target=targets.items.find(x=>x.actor_id===c.actor_id);if(!target)denied();
  const fingerprint=getConsoleFactorFingerprint(target.email);if(!fingerprint)throw new OperatorFailure(503,'MFA_CONFIGURATION_UNAVAILABLE','The operator authenticator configuration is unavailable.');
  const result=await gateway('/internal/console/approvals',{action:'operator.mfa.reset',resource_id:c.actor_id,reason:c.reason,request_key:c.request_key,configured_fingerprint:fingerprint},c.current_token);
  return Response.json({ok:true,result},{headers:{'cache-control':'no-store'}});
 }catch(error){
  if(error instanceof OperatorFailure)return Response.json({ok:false,error:{code:error.code,message:error.message}},{status:error.status,headers:{'cache-control':'no-store'}});
  return Response.json({ok:false,error:{code:'OPERATOR_AUTH_UNAVAILABLE',message:'Operator authentication is temporarily unavailable.'}},{status:503,headers:{'cache-control':'no-store'}});
 }
}
