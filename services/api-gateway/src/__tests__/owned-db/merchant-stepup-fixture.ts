// Synthetic signed transport to the real worker. Not browser/device/provider proof.
import assert from 'node:assert/strict';
import {createHmac}from 'node:crypto';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders}from './gateway-harness';
import type {OwnedDatabase}from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant}from './synthetic-tenant';
export const STEP_SECRET='synthetic-canonical-merchant-step-up-at-least32bytes';
export const TOTP_SECRET='synthetic-canonical-merchant-encryption-at-least32bytes';
export function otp(secret:string,at=Date.now()){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const ch of secret.replace(/=/g,'').toUpperCase())bits+=alphabet.indexOf(ch).toString(2).padStart(5,'0');
 const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(at/30000)));
 const digest=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),offset=digest[digest.length-1]&15;return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
export const explain=(r:{status:number;json:{error?:{code?:unknown}}|null})=>`HTTP${r.status} ${r.json?.error?.code??''}`;
export async function merchantFixture(owned:OwnedDatabase){
 const f=newSyntheticTenant('mfa-'+crypto.randomUUID().slice(0,8));seedSyntheticTenant(owned.psql,f);const owner=crypto.randomUUID(),email=`syn-challenge-${owner}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email}',true);UPDATE sites SET custom_user_id='${owner}'WHERE id='${f.siteId}';`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{STEP_UP_SIGNING_SECRET:STEP_SECRET,TOTP_ENCRYPTION_KEY:TOTP_SECRET}));
 const call=async(method:string,path:string,body?:Record<string,unknown>,headers:Record<string,string>={})=>gateway.request('/v1'+path,{method,headers:{...await signedIdentityHeaders(owner,email,f.siteId),'X-Idempotency-Key':String(body?.idempotency_key??crypto.randomUUID()),...headers},body:body?JSON.stringify(body):undefined});
 return{...f,owner,email,gateway,call};
}
export type MerchantFixture=Awaited<ReturnType<typeof merchantFixture>>;
export async function activeFactor(f:MerchantFixture){
 const enrolled=await f.call('POST','/2fa/totp/enroll');assert.equal(enrolled.status,201,explain(enrolled));const id=String(enrolled.json?.data.factor.id),secret=String(enrolled.json?.data.secret);
 const activated=await f.call('POST','/2fa/totp/verify',{factor_id:id,code:otp(secret)});assert.equal(activated.status,200,explain(activated));return{id,secret};
}
export async function issue(f:MerchantFixture,factor:{id:string;secret:string},key=crypto.randomUUID(),action='refund.approve'){
 return f.call('POST','/security/step-up/challenges',{store_id:f.siteId,factor_id:factor.id,code:otp(factor.secret),idempotency_key:key,action});
}

const factorCache=new WeakMap<Gateway,Map<string,Promise<{id:string;secret:string}>>>();
// Reusable positive fixture for older financial suites: actual enrollment,
// activation and persisted challenge issuance; never a manually minted proof.
export async function merchantApprovalHeaders(gateway:Gateway,actor:string,email:string,site:string,action='refund.approve'){
 const call=async(path:string,body?:Record<string,unknown>)=>gateway.request('/v1'+path,{method:'POST',headers:{...await signedIdentityHeaders(actor,email,site),'X-Idempotency-Key':crypto.randomUUID()},body:body?JSON.stringify(body):undefined});
 let actors=factorCache.get(gateway);if(!actors){actors=new Map();factorCache.set(gateway,actors);}let pending=actors.get(actor);
 if(!pending){pending=(async()=>{const r=await call('/2fa/totp/enroll');assert.equal(r.status,201,explain(r));const id=String(r.json?.data.factor.id),secret=String(r.json?.data.secret);const v=await call('/2fa/totp/verify',{factor_id:id,code:otp(secret)});assert.equal(v.status,200,explain(v));return{id,secret};})();actors.set(actor,pending);}
 const factor=await pending;const r=await call('/security/step-up/challenges',{store_id:site,action,factor_id:factor.id,code:otp(factor.secret),idempotency_key:crypto.randomUUID()});assert.equal(r.status,201,explain(r));
 return{...await signedIdentityHeaders(actor,email,site),'X-Step-Up-Token':String(r.json?.data.step_up_token),'X-Step-Up-Verified-At':String(r.json?.data.verified_at)};
}
