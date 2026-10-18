// Explicit test-only asymmetric issuer; no application imports this module.
import {generateKeyPairSync,sign} from 'node:crypto';
const key=generateKeyPairSync('ec',{namedCurve:'P-256'}),kid='synthetic-console-unit-identity';
export const identityUnitConfig={LETBUYY_IDENTITY_ISSUER:'https://accounts.letbuyy.test',LETBUYY_IDENTITY_PUBLIC_JWKS:JSON.stringify({keys:[{...key.publicKey.export({format:'jwk'}),alg:'ES256',kid}]})};
export async function createConsoleSessionCookieValue(input:{email:string;mfaVerified:boolean}){
 const now=Math.floor(Date.now()/1000),header=Buffer.from(JSON.stringify({alg:'ES256',typ:'JWT',kid})).toString('base64url');
 const claims=Buffer.from(JSON.stringify({iss:identityUnitConfig.LETBUYY_IDENTITY_ISSUER,aud:'letbuyy:platform-session',sub:'0e4851f5-2c96-416d-ae42-25fe5ff01ea4',jti:crypto.randomUUID(),iat:now,exp:now+28800,realm:'platform',token_use:'platform_session',email:input.email,mfa_verified:input.mfaVerified,mfa_verified_at:input.mfaVerified?now:null})).toString('base64url');
 return header+'.'+claims+'.'+sign('sha256',Buffer.from(header+'.'+claims),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
}
