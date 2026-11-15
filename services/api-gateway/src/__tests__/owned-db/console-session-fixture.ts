import {operatorIdentityKeys,TrustedOperatorGateway as Gateway} from './operator-identity-fixture';
// Synthetic credentials for owned Gateway/PostgreSQL tests only. These are not
// normal provider inbox or browser login evidence; the separate browser suite
// uses real local forms/TOTP. No application imports this module.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLetbuyyPlatformSessionToken, verifyLetbuyyPlatformSessionToken } from './operator-identity-fixture';
import { gatewayEnv } from './gateway-harness';
import type { OwnedDatabase } from './owned-db-support';

// Explicit trusted-issuer transport fixture; real forms verify actual factor codes.
// Use unused counters in the real permitted clock window. Never reset durable
// one-use state merely to make immediate synthetic re-authentication succeed.
export const fixtureConsoleFactorFingerprint=(actorId:string)=>createHash('sha256').update('synthetic-configured-factor:'+actorId).digest('hex');

export async function nextFixtureConsoleMfaCounter(owned:OwnedDatabase,actorId:string):Promise<number> {
    const last=Number(owned.psql(`SELECT coalesce((metadata->'console_mfa_guard'->>'last_counter')::bigint,-1) FROM principals WHERE realm='admin' AND legacy_user_id='${actorId}' AND deleted_at IS NULL;`)||-1);
    const next=Math.max(Math.floor(Date.now()/30000),last+1);
    const wait=Math.max(0,(next-1)*30000-Date.now()+20);
    if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
    return next;
}

export async function consoleFixture(owned: OwnedDatabase) {
    const bridge = 'synthetic-approval-bridge-' + crypto.randomUUID();
    const secret = 'synthetic-approval-session-secret-' + crypto.randomUUID();
    const env = gatewayEnv(owned, await operatorIdentityKeys(secret), { PLATFORM_CONSOLE_API_TOKEN: bridge, PLATFORM_CONSOLE_SESSION_SECRET: secret });
    const gateway = new Gateway(env);
    async function actor(kind: 'super' | 'lead' | 'viewer' = 'super', elevated = true) {
        const id = crypto.randomUUID(), email = `syn-consent-${id}@example.invalid`;
        owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${id}','${email}',true);`);
        if (kind === 'super') owned.psql(`INSERT INTO super_admin_allowlist(user_id,email,full_name,is_active)
            VALUES('${id}','${email}','Synthetic independent approver',true);`);
        else owned.psql(`INSERT INTO employees(user_id,email,role,store_id,status,is_active)
            VALUES('${id}','${email}','${kind === 'lead' ? 'manager' : 'viewer'}',NULL,'active',true);`);
        // Counter reuse may require a clock wait; mint short-lived sessions afterwards.
        const counter = elevated ? await nextFixtureConsoleMfaCounter(owned,id) : null;
        const initial = await createLetbuyyPlatformSessionToken({ email, userId: id, mfaVerified: false }, secret);
        const token = await createLetbuyyPlatformSessionToken({ email, userId: id, mfaVerified: true }, secret);
        assert.ok(initial && token);
        const headers = { Authorization: `Bearer ${bridge}`, 'X-Platform-Console-Session': elevated ? token : initial, 'Content-Type': 'application/json' };
        for (const session of [
            { ...headers, 'X-Platform-Console-Session': initial },
            ...(elevated ? [{ ...headers, 'X-Platform-Console-Previous-Session': initial }] : []),
        ]) {
            const mfa='X-Platform-Console-Previous-Session' in session;
            const registered = await gateway.request('/v1/internal/console/sessions/'+(mfa?'mfa':'register'), { method: 'POST', headers: session, body: mfa?JSON.stringify({counter,factor_fingerprint:fixtureConsoleFactorFingerprint(id)}):'{}' });
            assert.equal(registered.status, 200, registered.text);
            if(mfa)assert.equal(registered.json?.data.verified,true,registered.text);
        }
        return { id, email, headers, token: elevated ? token : initial };
    }
    async function reauthenticate(current: { id: string; email: string; token: string; headers: Record<string, string> }, reservedCounter?: number) {
        const counter = reservedCounter ?? await nextFixtureConsoleMfaCounter(owned,current.id);
        const token = await createLetbuyyPlatformSessionToken({ email: current.email, userId: current.id, mfaVerified: true }, secret);
        assert.ok(token);
        const headers = { ...current.headers, 'X-Platform-Console-Session': token };
        const result = await gateway.request('/v1/internal/console/sessions/mfa', { method: 'POST',
            headers: { ...headers, 'X-Platform-Console-Previous-Session': current.token }, body: JSON.stringify({counter,factor_fingerprint:fixtureConsoleFactorFingerprint(current.id)}) });
        assert.equal(result.status, 200, result.text);
        assert.equal(result.json?.data.verified,true,result.text);
        return { ...current, token, headers };
    }
    async function signIn(current: { id: string; email: string; token: string; headers: Record<string, string> }) {
        const counter = await nextFixtureConsoleMfaCounter(owned,current.id);
        const initial = await createLetbuyyPlatformSessionToken({ email: current.email, userId: current.id, mfaVerified: false }, secret);
        assert.ok(initial);
        const headers = { ...current.headers, 'X-Platform-Console-Session': initial };
        const result = await gateway.request('/v1/internal/console/sessions/register', { method: 'POST', headers, body: '{}' });
        assert.equal(result.status, 200, result.text);
        return reauthenticate({ ...current, token: initial, headers }, counter);
    }
    // Explicit clock fixture: a previously authenticated session, with matching
    // signed claims/digest/DB timestamps. Not a normal sign-in/provider proof.
    async function seedAgedSession(current: { id: string; email: string; token: string; headers: Record<string, string> }, seconds: number) {
        const token = await createLetbuyyPlatformSessionToken({ email: current.email, userId: current.id, mfaVerified: true }, secret,
            { nowSeconds: Math.floor(Date.now() / 1000) - seconds });
        assert.ok(token);
        const payload = (await verifyLetbuyyPlatformSessionToken(token, secret)).payload!;
        assert.ok(payload?.sessionId);
        const digest = createHash('sha256').update(token).digest('hex');
        owned.psql(`INSERT INTO sessions_v2(id,principal_id,realm,sid,status,issued_at,absolute_expires_at,metadata)
            SELECT '${payload.sessionId}',p.id,'admin','${payload.sessionId}','active',to_timestamp(${payload.issuedAt}),to_timestamp(${payload.exp}),
                jsonb_build_object('protocol','platform-console-v1','cookie_sha256','${digest}','mfa_verified_at',to_timestamp(${payload.mfaVerifiedAt}))
            FROM principals p WHERE p.realm='admin' AND p.legacy_user_id='${current.id}' AND p.deleted_at IS NULL;`);
        return { ...current, token, headers: { ...current.headers, 'X-Platform-Console-Session': token } };
    }
    return { gateway, env, actor, reauthenticate, signIn, seedAgedSession };
}
