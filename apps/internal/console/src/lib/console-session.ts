import {LETBUYY_PLATFORM_SESSION_COOKIE,LETBUYY_PLATFORM_SESSION_TTL_SECONDS} from '@letbuyy/auth-core';
import {verifyIdentityPlatformSession,type PlatformSession} from '@letbuyy/auth-core/platform-identity';
export const CONSOLE_SESSION_COOKIE=LETBUYY_PLATFORM_SESSION_COOKIE;
export const CONSOLE_SESSION_MAX_AGE_SECONDS=LETBUYY_PLATFORM_SESSION_TTL_SECONDS;
export type ConsoleSession=PlatformSession;
export async function readConsoleSession(cookieValue:string|undefined|null):Promise<ConsoleSession|null>{
 return verifyIdentityPlatformSession(cookieValue,{issuer:process.env.LETBUYY_IDENTITY_ISSUER,publicJwks:process.env.LETBUYY_IDENTITY_PUBLIC_JWKS});
}
