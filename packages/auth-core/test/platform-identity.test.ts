import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {createLetbuyyPlatformSessionToken} from '../src/index';
import {createConsoleIdentityProof,verifyConsoleIdentityProof,verifyIdentityPlatformMagic,verifyIdentityPlatformSession,PLATFORM_MAGIC_AUDIENCE,PLATFORM_SESSION_AUDIENCE} from '../src/platform-identity';
const now=1800000000,issuer='https://accounts.letbuyy.test',sub=crypto.randomUUID(),email='operator@example.invalid';
async function fixture(algorithm:'ES256'|'EdDSA'='ES256'){
 const keys=await generateKeyPair(algorithm,{extractable:true}),kid='synthetic-'+algorithm;
 const jwk={...await exportJWK(keys.publicKey),kid,alg:algorithm},config={issuer,publicJwks:JSON.stringify({keys:[jwk]})};
 async function token(claims:Record<string,unknown>={},header:Record<string,unknown>={}){
  return new SignJWT({iss:issuer,aud:PLATFORM_SESSION_AUDIENCE,sub,jti:crypto.randomUUID(),iat:now,exp:now+28800,realm:'platform',token_use:'platform_session',email,mfa_verified:true,mfa_verified_at:now,...claims})
   .setProtectedHeader({alg:algorithm,typ:'JWT',kid,...header}).sign(keys.privateKey);
 }
 return {...keys,jwk,config,token};
}
for(const algorithm of ['ES256','EdDSA'] as const)test(algorithm+' accepts the public Identity credential and preserves the exact durable session binding',async()=>{
 const f=await fixture(algorithm),token=await f.token(),p=await verifyIdentityPlatformSession(token,f.config,now);
 assert.ok(p);assert.equal(p.userId,sub);assert.equal(p.email,email);assert.equal(p.mfaVerifiedAt,now);assert.equal(p.exp-p.issuedAt,28800);assert.match(p.sessionId,/^[0-9a-f-]{36}$/);
 assert.equal(await verifyIdentityPlatformMagic(token,f.config,now),null);
});
test('purpose, realm, single audience, actor, issued time, expiry and MFA claims fail independently',async()=>{
 const f=await fixture();
 for(const override of [{realm:'merchant'},{token_use:'buyer_session'},{aud:'letbuyy:buyer-session'},{aud:[PLATFORM_SESSION_AUDIENCE,'other']},{sub:'operator'},{jti:'no-session-uuid'},{iss:'https://evil.invalid'},{email:'Operator@example.invalid'},{iat:now+31},{iat:now-1,exp:now+28800},{exp:now},{exp:now+28801},{mfa_verified:'true'},{mfa_verified_at:now-1},{mfa_verified:false},{mfa_verified:false,mfa_verified_at:now},{mfa_verified_at:now+31}]){
  assert.equal(await verifyIdentityPlatformSession(await f.token(override),f.config,now),null,JSON.stringify(override));
 }
 assert.ok(await verifyIdentityPlatformSession(await f.token({mfa_verified:false,mfa_verified_at:null}),f.config,now));
});
test('a magic proof is short-lived and cannot become a session or cross the purpose boundary',async()=>{
 const f=await fixture(),token=await f.token({aud:PLATFORM_MAGIC_AUDIENCE,token_use:'platform_magic_link',exp:now+900});
 const p=await verifyIdentityPlatformMagic(token,f.config,now);assert.equal(p?.userId,sub);assert.equal(p?.email,email);
 assert.equal(await verifyIdentityPlatformSession(token,f.config,now),null);
 assert.equal(await verifyIdentityPlatformMagic(await f.token({aud:PLATFORM_MAGIC_AUDIENCE,token_use:'platform_magic_link',exp:now+901}),f.config,now),null);
});
test('tampering, wrong keys, missing/duplicate/private/symmetric public key configuration and unsupported headers fail closed',async()=>{
 const f=await fixture(),other=await fixture(),token=await f.token();
 assert.equal(await verifyIdentityPlatformSession(token.slice(0,-6)+'xxxxxx',f.config,now),null);
 assert.equal(await verifyIdentityPlatformSession(token,other.config,now),null);
 for(const keys of [[],[f.jwk,f.jwk],[{...f.jwk,d:'private-material'}],[{kty:'oct',k:'secret',kid:'bad',alg:'HS256'}]])assert.equal(await verifyIdentityPlatformSession(token,{issuer,publicJwks:JSON.stringify({keys})},now),null);
 for(const raw of [undefined,'not-json'])assert.equal(await verifyIdentityPlatformSession(token,{issuer,publicJwks:raw},now),null);
 assert.equal(await verifyIdentityPlatformSession(await f.token({},{typ:'unrelated'}),f.config,now),null);
 assert.equal(await verifyIdentityPlatformSession(await f.token({},{kid:'unknown'}),f.config,now),null);
 const legacy=await createLetbuyyPlatformSessionToken({email,userId:sub,mfaVerified:true},'synthetic-old-shared-secret',{nowSeconds:now});
 assert.equal(await verifyIdentityPlatformSession(legacy,f.config,now),null);
 const hmac=await new SignJWT({sub,iat:now,exp:now+60}).setProtectedHeader({alg:'HS256',typ:'JWT',kid:f.jwk.kid}).sign(new TextEncoder().encode('synthetic-shared-secret-32-characters'));
 assert.equal(await verifyIdentityPlatformSession(hmac,f.config,now),null);
});
test('public key rotation accepts the named active and previous asymmetric keys only',async()=>{
 const a=await fixture(),b=await fixture('EdDSA'),config={issuer,publicJwks:JSON.stringify({keys:[a.jwk,b.jwk]})};
 assert.ok(await verifyIdentityPlatformSession(await a.token(),config,now));assert.ok(await verifyIdentityPlatformSession(await b.token(),config,now));
});
test('first-party transport proof binds exact body and purpose with finite clock bounds; durable replay remains a service responsibility',async()=>{
 const secret='synthetic-console-transport-key-32-characters',body=JSON.stringify({operation:'mfa',code:'123456'}),proof=await createConsoleIdentityProof(body,secret,now),headers=new Headers(proof);
 assert.equal(await verifyConsoleIdentityProof(body,headers,secret,now),proof['X-LetBuyy-Console-JTI']);
 assert.equal(await verifyConsoleIdentityProof(body+' ',headers,secret,now),null);
 assert.equal(await verifyConsoleIdentityProof(body,headers,'another-synthetic-transport-key-32-characters',now),null);
 assert.equal(await verifyConsoleIdentityProof(body,headers,secret,now+61),null);
 assert.equal(await verifyConsoleIdentityProof(body,headers,secret,now-31),null);
 assert.equal(await verifyConsoleIdentityProof(body,headers,'short',now),null);
 const changed=new Headers(headers);changed.set('X-LetBuyy-Console-JTI',crypto.randomUUID());assert.equal(await verifyConsoleIdentityProof(body,changed,secret,now),null);
});
