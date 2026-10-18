// Test-only synthetic Identity issuer and authenticated accounts transport.
// This is never normal browser/factor/inbox acceptance. Production verifiers
// expose no mint function or shared-secret human credential fallback.
import {SignJWT} from 'jose';
import {createLetbuyyInternalAppHeaders} from '@letbuyy/auth-core';
import {verifyIdentityPlatformSession} from '@letbuyy/auth-core/platform-identity';
import {Gateway,INTERNAL_SECRET,IDENTITY_ISSUER,newIdentityKeys,type IdentityKeys} from './gateway-harness';
const keys=new Map<string,Promise<IdentityKeys>>();
export function operatorIdentityKeys(label:string){let value=keys.get(label);if(!value){value=newIdentityKeys();keys.set(label,value);}return value;}
export async function createLetbuyyPlatformSessionToken(input:{email:string;userId?:string|null;mfaVerified:boolean},label:string|undefined,options:{nowSeconds?:number;ttlSeconds?:number}={}){
 const key=await operatorIdentityKeys(label||''),now=options.nowSeconds??Math.floor(Date.now()/1000);
 return new SignJWT({realm:'platform',token_use:'platform_session',email:input.email,mfa_verified:input.mfaVerified,mfa_verified_at:input.mfaVerified?now:null})
 .setProtectedHeader({alg:'ES256',typ:'JWT',kid:key.kid}).setIssuer(IDENTITY_ISSUER).setAudience('letbuyy:platform-session').setSubject(input.userId||crypto.randomUUID())
 .setIssuedAt(now).setExpirationTime(now+(options.ttlSeconds??28800)).setJti(crypto.randomUUID()).sign(key.privateKey);
}
export async function createLetbuyyPlatformMagicLinkToken(email:string,label:string){
 const key=await operatorIdentityKeys(label),now=Math.floor(Date.now()/1000);
 return new SignJWT({realm:'platform',token_use:'platform_magic_link',email}).setProtectedHeader({alg:'ES256',typ:'JWT',kid:key.kid})
 .setIssuer(IDENTITY_ISSUER).setAudience('letbuyy:platform-magic-link').setSubject(crypto.randomUUID()).setIssuedAt(now).setExpirationTime(now+900).setJti(crypto.randomUUID()).sign(key.privateKey);
}
export async function verifyLetbuyyPlatformSessionToken(token:string,label:string|undefined){
 const key=await operatorIdentityKeys(label||'');const payload=await verifyIdentityPlatformSession(token,{issuer:IDENTITY_ISSUER,publicJwks:key.jwks});return {accepted:!!payload,payload};
}
export class TrustedOperatorGateway extends Gateway {
 override async request(path:string,init:RequestInit={},env=this.env){
  const headers=new Headers(init.headers);
  if(path==='/v1/internal/console/sessions/register'||path==='/v1/internal/console/sessions/mfa'
   ||path==='/v1/internal/console/approvals'&&init.method==='POST'&&typeof init.body==='string'&&JSON.parse(init.body).action==='operator.mfa.reset'){
   const plan=await createLetbuyyInternalAppHeaders({app:'accounts',secret:INTERNAL_SECRET});
   if(!plan.ok||!plan.headers)throw new Error('Synthetic accounts transport unavailable');
   for(const [key,value]of Object.entries(plan.headers))headers.set(key,value);
  }
  return super.request(path,{...init,headers},env);
 }
}
