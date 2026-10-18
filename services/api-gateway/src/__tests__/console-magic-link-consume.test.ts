// Pure transport denial checks for the retired unsigned consume endpoint.
// Canonical positive/race/recovery/expiry/role behavior is proved against the
// actual worker and database in owned-db/operator-identity-exchange.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import internalConsoleRouter from '../routes/internal-console';

const POSTGREST = 'https://console-magic-link-consume.fake-postgrest.test';
const CONSOLE_TOKEN = 'test-console-api-token-not-a-real-secret';


function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        PLATFORM_CONSOLE_API_TOKEN: CONSOLE_TOKEN,
        INTERNAL_API_SECRET: 'internal-secret-for-console-magic-link-consume-tests',
    } as unknown as Env;
}


function app() {
    const api = new Hono<{ Bindings: Env }>();
    api.route('/internal/console', internalConsoleRouter);
    return api;
}

async function consume(body: Record<string, unknown>, token = CONSOLE_TOKEN) {
    const res = await app().request('/internal/console/magic-link/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
    }, env());
    return { res, body: await res.json() as { data?: unknown; error?: { code: string; message: string } } };
}

function future(seconds = 900): string {
    return new Date(Date.now() + seconds * 1000).toISOString();
}

// The old split consume-then-register endpoint is retired. Positive exchange,
// repeated/concurrent proof, exact retry, expiry, distinct links for one actor,
// audit outage and real-role proofs moved to owned-db/operator-identity-exchange.
// The pure lane now guards this obsolete unsigned-body surface against revival.
test('retired split consumption refuses valid, repeated, expired and malformed unsigned bodies without any storage access',async(t)=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('Retired endpoint must never reach storage');};
 const valid={jti:crypto.randomUUID(),email:'operator@example.test',expires_at:future()};
 for(const body of [valid,valid,{...valid,jti:crypto.randomUUID()},{...valid,expires_at:new Date(Date.now()-1000).toISOString()},
  {email:valid.email,expires_at:valid.expires_at},{...valid,jti:'short'},{...valid,email:'not-an-email'},{}]){
  const result=await consume(body);assert.equal(result.res.status,410);assert.equal(result.body.error?.code,'IDENTITY_EXCHANGE_REQUIRED');
 }
 assert.equal(calls,0);
});
test('missing or wrong service credential still fails before the retired endpoint',async(t)=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Service denial must never reach storage');};
 for(const token of ['', 'wrong-token'])assert.equal((await consume({jti:crypto.randomUUID(),email:'operator@example.test',expires_at:future()},token)).res.status,401);
 assert.equal(calls,0);
});
