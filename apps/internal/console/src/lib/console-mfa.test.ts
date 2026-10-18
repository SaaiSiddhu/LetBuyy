// SUSTAINED-E — console-mfa.ts's rate limit, replay rejection and constant-time comparison.
//
// No `server-only`/Next.js import in the module under test, so this runs as a plain node:test file
// (the same reason apps/commerce/web/src's test files exist as .test.ts beside their source).

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
    matchConsoleTotpCounter,
    getConsoleFactorFingerprint,
    resolveConsoleLoginOutcome,
} from './console-mfa';

const EMAIL = 'operator@letbuyy.test';

// Phase 2 / D04 (Mandate 6, Section 10): the production check must run before the allowlist check
// so a production response never distinguishes "allowed but delivery not configured" from
// "not allowed" -- both must resolve identically, closing an account-enumeration path.
test('production always resolves to magic_link_delivery_not_configured, regardless of allowlist membership', () => {
    assert.deepEqual(resolveConsoleLoginOutcome({ isProduction: true, isAllowed: true }), { kind: 'magic_link_delivery_not_configured' });
    assert.deepEqual(resolveConsoleLoginOutcome({ isProduction: true, isAllowed: false }), { kind: 'magic_link_delivery_not_configured' });
});
test('non-production resolves by allowlist membership: allowed proceeds, not-allowed is denied', () => {
    assert.deepEqual(resolveConsoleLoginOutcome({ isProduction: false, isAllowed: true }), { kind: 'proceed' });
    assert.deepEqual(resolveConsoleLoginOutcome({ isProduction: false, isAllowed: false }), { kind: 'access_denied' });
});

function hotp(secret: Buffer, counter: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));
    const digest = createHmac('sha1', secret).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0xf;
    const code = (
        ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff)
    ) % 1_000_000;
    return code.toString().padStart(6, '0');
}

// PLATFORM_CONSOLE_TOTP_SECRETS accepts a bare (non-base32) secret when base32 decoding would be
// empty/invalid (decodeBase32's fallback) -- using a plain ASCII secret here keeps the test's own
// HOTP independent of base32 decoding, which is not what this phase changed.
const SECRET = 'sustained-e-test-secret';
const SECRET_BYTES = Buffer.from(SECRET);

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
    const previous: Record<string, string | undefined> = {};
    for (const key of Object.keys(vars)) previous[key] = process.env[key];
    for (const [key, value] of Object.entries(vars)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    try {
        fn();
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

function withPrincipalSecret(fn: () => void) {
    withEnv({ PLATFORM_CONSOLE_TOTP_SECRETS: JSON.stringify({ [EMAIL]: SECRET }), PLATFORM_CONSOLE_TOTP_SECRET: undefined }, fn);
}

// Global one-use/attempt/rotation proofs live in actual owned-db/console-mfa-state.
// A pure match exposes only a candidate counter; it never grants a session.
function withClock(fn:()=>void){const original=Date.now;Date.now=()=>1792065600000;try{fn();}finally{Date.now=original;}}
test('current and adjacent configured factor codes return their exact candidate counters',()=>withClock(()=>withPrincipalSecret(()=>{
 const counter=Math.floor(Date.now()/30000);for(const offset of [-1,0,1])
  assert.deepEqual(matchConsoleTotpCounter(hotp(SECRET_BYTES,counter+offset),EMAIL),{ok:true,counter:counter+offset});
})));
test('wrong, malformed and distant factor codes cannot produce a candidate',()=>withClock(()=>withPrincipalSecret(()=>{
 for(const value of ['12','abcdef',hotp(SECRET_BYTES,Math.floor(Date.now()/30000)+100)])
  assert.deepEqual(matchConsoleTotpCounter(value,EMAIL),{ok:false,reason:'invalid'});
})));
test('factor matching is stateless; durable authorization owns replay and attempt accounting',()=>withClock(()=>withPrincipalSecret(()=>{
 const counter=Math.floor(Date.now()/30000),code=hotp(SECRET_BYTES,counter);
 assert.deepEqual(matchConsoleTotpCounter(code,EMAIL),{ok:true,counter});
 assert.deepEqual(matchConsoleTotpCounter(code,EMAIL),{ok:true,counter});
})));
test('missing per-account production factor fails unavailable; global and developer fallbacks cannot authenticate production',()=>withEnv({
 NODE_ENV:'production',PLATFORM_CONSOLE_TOTP_SECRETS:'{}',PLATFORM_CONSOLE_TOTP_SECRET:SECRET,
 PLATFORM_CONSOLE_DEV_MFA_CODE:'123456',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'true',
},()=>assert.deepEqual(matchConsoleTotpCounter('123456',EMAIL),{ok:false,reason:'unavailable'})));
test('explicit development code remains limited to the configured nonproduction development switch',()=>withEnv({
 NODE_ENV:'development',APP_ENV:'test',VERCEL_ENV:'development',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'true',PLATFORM_CONSOLE_DEV_MFA_CODE:'123456',
},()=>assert.deepEqual(matchConsoleTotpCounter('123456',EMAIL),{ok:true,counter:Math.floor(Date.now()/30000)})));


test('configured factor identity is stable across code/time and normalized email, and changes with the actual key',()=>withClock(()=>withPrincipalSecret(()=>{
 const first=getConsoleFactorFingerprint(EMAIL);assert.match(first!,/^[0-9a-f]{64}$/);assert.equal(first,getConsoleFactorFingerprint('  '+EMAIL.toUpperCase()+'  '));
 assert.equal(first,createHmac('sha256',SECRET_BYTES).update('letbuyy-console-factor-v1\0'+EMAIL).digest('hex'));
 withEnv({PLATFORM_CONSOLE_TOTP_SECRETS:JSON.stringify({[EMAIL]:'synthetic-different-key'})},()=>assert.notEqual(first,getConsoleFactorFingerprint(EMAIL)));
})));
test('production cannot derive a factor identity from a global or development fallback',()=>withEnv({NODE_ENV:'production',PLATFORM_CONSOLE_TOTP_SECRETS:'{}',PLATFORM_CONSOLE_TOTP_SECRET:SECRET},()=>assert.equal(getConsoleFactorFingerprint(EMAIL),null)));
