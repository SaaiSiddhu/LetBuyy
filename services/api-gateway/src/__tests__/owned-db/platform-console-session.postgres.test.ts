import {operatorIdentityKeys,TrustedOperatorGateway as Gateway} from './operator-identity-fixture';
import {fixtureConsoleFactorFingerprint} from './console-session-fixture';
// Actual worker/PostgREST/PostgreSQL: synthetic signed Console credentials prove
// persistence and revocation, not provider inbox or ordinary browser login.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createLetbuyyPlatformSessionToken, createLetbuyyPlatformMagicLinkToken, verifyLetbuyyPlatformSessionToken } from './operator-identity-fixture';
import { gatewayEnv } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const secret = 'synthetic-owned-console-session-secret-2026';
const bridge = 'synthetic-console-bridge-' + crypto.randomUUID();
const actor = { id: crypto.randomUUID(), email: `syn-console-${crypto.randomUUID()}@example.invalid` };

test('a signed Console session has durable identity, MFA rotation and irreversible logout across worker instances', async () => {
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor.id}','${actor.email}',true);
        INSERT INTO super_admin_allowlist(user_id,email,full_name,is_active)
        VALUES('${actor.id}','${actor.email}','Synthetic Console operator',true);`);
    const env = gatewayEnv(owned, await operatorIdentityKeys(secret), {
        PLATFORM_CONSOLE_API_TOKEN: bridge, PLATFORM_CONSOLE_SESSION_SECRET: secret,
    });
    const gateway = new Gateway(env);
    const token = await createLetbuyyPlatformSessionToken({ email: actor.email, userId:actor.id, mfaVerified: false }, secret);
    assert.ok(token);
    const headers = { Authorization: `Bearer ${bridge}`, 'X-Platform-Console-Session': token, 'Content-Type': 'application/json' };
    const registered = await gateway.request('/v1/internal/console/sessions/register', { method: 'POST', headers, body: '{}' });
    assert.equal(registered.status, 200, registered.text);
    assert.equal(registered.json?.data?.actor_id, actor.id);
    assert.equal(registered.json?.data?.mfa_verified, false);
    const elevated = await createLetbuyyPlatformSessionToken({ email: actor.email, userId: actor.id, mfaVerified: true }, secret);
    assert.ok(elevated);
    const elevatedHeaders = { ...headers, 'X-Platform-Console-Session': elevated, 'X-Platform-Console-Previous-Session': token };
    assert.equal((await gateway.request('/v1/internal/console/sessions/mfa', { method: 'POST', headers: elevatedHeaders, body: JSON.stringify({counter:Math.floor(Date.now()/30000),factor_fingerprint:fixtureConsoleFactorFingerprint(actor.id)}) })).status, 200);
    const secondWorker = new Gateway(env);
    assert.equal((await secondWorker.request('/v1/internal/console/sessions/current', { headers })).status, 401, 'MFA rotation revokes the pre-MFA session');
    const current = await secondWorker.request('/v1/internal/console/sessions/current', { headers: elevatedHeaders });
    assert.equal(current.status, 200, current.text);
    assert.equal(current.json?.data?.mfa_verified, true);
    assert.equal((await secondWorker.request('/v1/internal/console/sessions/revoke', { method: 'POST', headers: elevatedHeaders, body: '{}' })).status, 200);
    assert.equal((await gateway.request('/v1/internal/console/sessions/current', { headers: elevatedHeaders })).status, 401);
    assert.equal((await gateway.request('/v1/internal/console/sessions/register', { method: 'POST', headers: elevatedHeaders, body: '{}' })).status, 401,
        'registering an already revoked signed cookie cannot resurrect it');
    assert.equal(owned.psql(`SELECT count(*) FROM sessions_v2 s JOIN principals p ON p.id=s.principal_id
        WHERE p.realm='admin' AND p.legacy_user_id='${actor.id}' AND s.status='revoked';`), '2');
});

async function context(kind: 'super' | 'staff' | 'merchant' | 'unverified' = 'super') {
    const id = crypto.randomUUID(), email = `syn-console-${id}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${id}','${email}',${kind !== 'unverified'});`);
    if (kind === 'staff') owned.psql(`INSERT INTO employees(user_id,email,role,store_id,status,is_active)
        VALUES('${id}','${email}','viewer',NULL,'active',true);`);
    else if (kind !== 'merchant') owned.psql(`INSERT INTO super_admin_allowlist(user_id,email,full_name,is_active)
        VALUES('${id}','${email}','Synthetic Console operator',true);`);
    const env = gatewayEnv(owned, await operatorIdentityKeys(secret), { PLATFORM_CONSOLE_API_TOKEN: bridge, PLATFORM_CONSOLE_SESSION_SECRET: secret });
    const gateway = new Gateway(env);
    const token = await createLetbuyyPlatformSessionToken({ email, userId: id, mfaVerified: false }, secret);
    assert.ok(token);
    const headers = { Authorization: `Bearer ${bridge}`, 'X-Platform-Console-Session': token, 'Content-Type': 'application/json' };
    const call = (operation: string, values: Record<string, string> = headers) => gateway.request('/v1/internal/console/sessions/' + operation,
        operation === 'current' ? { headers: values } : { method: 'POST', headers: values, body: operation==='mfa'?JSON.stringify({counter:Math.floor(Date.now()/30000),factor_fingerprint:fixtureConsoleFactorFingerprint(id)}):'{}' });
    const payload = (await verifyLetbuyyPlatformSessionToken(token, secret)).payload!;
    assert.ok(payload.sessionId);
    return { id, email, token, headers, call, gateway, env, sessionId: payload.sessionId };
}

test('MAC/purpose/actor/verified-account/platform-membership gates fail before session or principal creation', async () => {
    const normal = await context();
    const candidates = [
        normal.token.slice(0, -4) + 'xxxx',
        (await createLetbuyyPlatformMagicLinkToken(normal.email, secret))!,
        (await createLetbuyyPlatformSessionToken({ email: normal.email, userId: crypto.randomUUID(), mfaVerified: false }, secret))!,
    ];
    for (const token of candidates) assert.equal((await normal.call('register', { ...normal.headers, 'X-Platform-Console-Session': token })).status, 401);
    for (const kind of ['merchant', 'unverified'] as const) {
        const other = await context(kind);
        assert.equal((await other.call('register')).status, 401);
        assert.equal(owned.psql(`SELECT count(*) FROM principals WHERE realm='admin' AND legacy_user_id='${other.id}';`), '0');
    }
    assert.equal((await normal.gateway.request('/v1/internal/console/sessions/register', {
        method: 'POST', headers: normal.headers, body: JSON.stringify({ user_id: normal.id, mfa_verified: true }),
    })).status, 400);
    assert.equal(owned.psql(`SELECT count(*) FROM sessions_v2 WHERE id='${normal.sessionId}';`), '0');
});

test('concurrent identical registration creates one principal, one session and one mandatory audit', async () => {
    const normal = await context();
    const results = await Promise.all([normal.call('register'), normal.call('register')]);
    assert.deepEqual(results.map(row => row.status), [200, 200]);
    assert.equal(owned.psql(`SELECT count(*) FROM principals WHERE realm='admin' AND legacy_user_id='${normal.id}';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM sessions_v2 WHERE id='${normal.sessionId}';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${normal.sessionId}' AND action='platform_console_session.registered';`), '1');
});

test('MFA elevation requires the same live predecessor and only one racing rotation wins', async () => {
    const normal = await context(), rival = await context();
    assert.equal((await normal.call('register')).status, 200);
    assert.equal((await rival.call('register')).status, 200);
    const elevated = await createLetbuyyPlatformSessionToken({ email: normal.email, userId: normal.id, mfaVerified: true }, secret);
    assert.ok(elevated);
    const headers = { ...normal.headers, 'X-Platform-Console-Session': elevated };
    assert.equal((await normal.call('mfa', headers)).status, 401);
    assert.equal((await normal.call('mfa', { ...headers, 'X-Platform-Console-Previous-Session': rival.token })).status, 401);
    const second = await createLetbuyyPlatformSessionToken({ email: normal.email, userId: normal.id, mfaVerified: true }, secret);
    assert.ok(second);
    const results = await Promise.all([elevated, second].map(token => normal.call('mfa', {
        ...normal.headers, 'X-Platform-Console-Session': token, 'X-Platform-Console-Previous-Session': normal.token,
    })));
    assert.deepEqual(results.map(row => row.status).sort(), [200, 401]);
    assert.equal(owned.psql(`SELECT count(*) FROM sessions_v2 s JOIN principals p ON p.id=s.principal_id
        WHERE p.realm='admin' AND p.legacy_user_id='${normal.id}' AND s.status='active';`), '1');
    assert.equal((await rival.call('current')).status, 200);
});

test('super-admin removal/re-add and staff downgrade revoke existing cookies permanently', async () => {
    for (const kind of ['super', 'staff'] as const) {
        const normal = await context(kind);
        assert.equal((await normal.call('register')).status, 200);
        if (kind === 'super') {
            owned.psql(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${normal.id}';
                UPDATE super_admin_allowlist SET is_active=true WHERE user_id='${normal.id}';`);
        } else owned.psql(`UPDATE employees SET permissions='{"revoked_scope":true}'::jsonb WHERE user_id='${normal.id}';`);
        assert.equal((await new Gateway(normal.env).request('/v1/internal/console/sessions/current', { headers: normal.headers })).status, 401);
        assert.equal((await normal.call('register')).status, 401);
        assert.equal(owned.psql(`SELECT status FROM sessions_v2 WHERE id='${normal.sessionId}';`), 'revoked');
    }
});

test('a mandatory audit outage rolls back registration; exact relation recovery allows the same cookie once', async () => {
    const normal = await context();
    const before = owned.psql("SELECT relacl::text FROM pg_class WHERE oid='public.audit_logs'::regclass;");
    owned.psql('ALTER TABLE public.audit_logs RENAME TO synthetic_console_audit_outage;');
    try {
        assert.equal((await normal.call('register')).status, 503);
        assert.equal(owned.psql(`SELECT count(*) FROM sessions_v2 WHERE id='${normal.sessionId}';`), '0');
        assert.equal(owned.psql(`SELECT count(*) FROM principals WHERE realm='admin' AND legacy_user_id='${normal.id}';`), '0');
    } finally { owned.psql('ALTER TABLE public.synthetic_console_audit_outage RENAME TO audit_logs;'); }
    assert.equal(owned.psql("SELECT relacl::text FROM pg_class WHERE oid='public.audit_logs'::regclass;"), before);
    assert.equal((await normal.call('register')).status, 200);
    assert.equal((await normal.call('register')).status, 200);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${normal.sessionId}' AND action='platform_console_session.registered';`), '1');
});

test('actual API/tenant roles cannot mint or promote a global admin session through RPC or canonical-table DML', async () => {
    const normal = await context();
    const tenant = newSyntheticTenant('console-role'); seedSyntheticTenant(owned.psql, tenant);
    assert.equal((await normal.call('register')).status, 200);
    const principal = owned.psql(`SELECT principal_id FROM sessions_v2 WHERE id='${normal.sessionId}';`);
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        const prefix = `BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('app.site_id','${tenant.siteId}',true);
            SELECT set_config('request.jwt.claims','{"sub":"${normal.id}"}',true);`;
        if (role === 'app_tenant') assert.equal(owned.script(prefix + `SELECT count(*) FROM sites WHERE id='${tenant.siteId}'; ROLLBACK;`).split('\n').at(-1), '1',
            'the tenant role has valid, working store context while global-session forgery is denied');
        assert.match(owned.psqlExpectError(prefix + `SELECT public.console_session_state_v1('${normal.sessionId}','${'0'.repeat(64)}'); ROLLBACK;`), /permission denied/);
        for (const query of [
            `WITH changed AS (UPDATE sessions_v2 SET metadata=metadata||'{"mfa_verified_at":"2026-10-15T00:00:00Z"}'::jsonb WHERE id='${normal.sessionId}' RETURNING id) SELECT count(*) FROM changed;`,
            `WITH changed AS (INSERT INTO sessions_v2(principal_id,realm,sid,absolute_expires_at,metadata) VALUES('${principal}','admin','synthetic-role-forgery',now()+interval '1 hour','{"protocol":"platform-console-v1"}'::jsonb) RETURNING id) SELECT count(*) FROM changed;`,
            `WITH changed AS (UPDATE principals SET status='active' WHERE id='${principal}' RETURNING id) SELECT count(*) FROM changed;`,
            `WITH changed AS (INSERT INTO principals(realm,actor_type,legacy_user_id,email,status) VALUES('admin','platform-operator','${normal.id}','${normal.email}','active') RETURNING id) SELECT count(*) FROM changed;`,
        ]) {
            let result: string;
            try { result = owned.script(prefix + query + 'ROLLBACK;'); }
            catch (error) { assert.match(String(error), /permission denied|row-level security/); continue; }
            assert.equal(result.split('\n').at(-1), '0', `${role}: no canonical authority may be manufactured`);
        }
    }
    assert.equal((await normal.call('current')).status, 200);
});

test('durable expiry overrides an unexpired signed cookie and cannot be re-registered', async () => {
    const normal = await context();
    assert.equal((await normal.call('register')).status, 200);
    owned.psql(`UPDATE sessions_v2 SET absolute_expires_at=now()-interval '1 second' WHERE id='${normal.sessionId}';`);
    assert.equal((await normal.call('current')).status, 401);
    assert.equal((await normal.call('register')).status, 401);
    assert.equal(owned.psql(`SELECT status FROM sessions_v2 WHERE id='${normal.sessionId}';`), 'expired');
});

test('principal disable/re-enable and verified identity change cannot revive an existing Console cookie', async () => {
    for (const change of ['principal', 'identity', 'principal-delete'] as const) {
        const normal = await context(); assert.equal((await normal.call('register')).status, 200);
        if (change === 'principal') owned.psql(`UPDATE principals SET status='disabled' WHERE realm='admin' AND legacy_user_id='${normal.id}';
            UPDATE principals SET status='active' WHERE realm='admin' AND legacy_user_id='${normal.id}';`);
        else if (change === 'identity') owned.psql(`UPDATE users_custom SET email_verified=false WHERE id='${normal.id}'; UPDATE users_custom SET email_verified=true WHERE id='${normal.id}';`);
        else owned.psql(`DELETE FROM principals WHERE realm='admin' AND legacy_user_id='${normal.id}';`);
        assert.equal((await normal.call('current')).status, 401, `${change}: no request in the disabled interval is necessary to revoke the cookie`);
        assert.equal((await normal.call('register')).status, 401);
        if (change === 'principal-delete') assert.equal(owned.psql(`SELECT count(*) FROM sessions_v2 WHERE id='${normal.sessionId}';`), '0');
        else assert.equal(owned.psql(`SELECT status FROM sessions_v2 WHERE id='${normal.sessionId}';`), 'revoked');
    }
});

test('paired rollback/reapply preserves canonical rows, revocation and unrelated privileges', async () => {
    const normal = await context();
    assert.equal((await normal.call('register')).status, 200);
    assert.equal((await normal.call('revoke')).status, 200);
    const records = () => owned.psql(`SELECT md5(jsonb_agg(to_jsonb(s) ORDER BY s.id)::text) FROM sessions_v2 s;`);
    const saved = records();
    const migration = readFileSync('database/supabase/migrations/314_durable_console_sessions.sql', 'utf8');
    owned.script(readFileSync('database/supabase/rollback/314_durable_console_sessions.rollback.sql', 'utf8'));
    try { assert.equal((await normal.call('current')).status, 503); }
    finally { owned.script(migration); }
    await Promise.all([owned.psqlAsync(migration), owned.psqlAsync(migration)]);
    assert.equal(records(), saved);
    assert.equal((await normal.call('current')).status, 401);
    for (const role of ['anon', 'authenticated', 'app_tenant']) assert.equal(owned.psql(`SELECT has_function_privilege('${role}',
        'public.transition_console_session_v1(text,uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text)','EXECUTE');`), 'f');
});
