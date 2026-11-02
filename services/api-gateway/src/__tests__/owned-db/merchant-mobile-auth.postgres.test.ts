import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createLetbuyyInternalAppHeaders, merchantNativeChallenge, merchantNativeHash } from '@letbuyy/auth-core';
import { Gateway, gatewayEnv, newIdentityKeys, mintSession, INTERNAL_SECRET, MERCHANT_SESSION_AUDIENCE } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { hashMerchantPassword } from '../../lib/merchant-password';
import { encryptTextAesGcm } from '../../lib/crypto';

const owned = requireOwnedDatabase();
const verifier = 'v'.repeat(43), state = 's'.repeat(43), launchProof = 'l'.repeat(43), browserProof = 'b'.repeat(43), managementProof = 'm'.repeat(43), code = 'c'.repeat(43);
async function fixture() {
    const code = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
    const userId = crypto.randomUUID(), email = `syn-native-${userId}@example.invalid`;
    const password = 'Synthetic-Native-Password-42!';
    const hash = await hashMerchantPassword(password);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,password_hash) VALUES('${userId}','${email}',true,'${hash}');`);
    const keys = await newIdentityKeys(), gateway = new Gateway(gatewayEnv(owned, keys, { ENVIRONMENT: 'local', APP_ENV: 'development', TOTP_ENCRYPTION_KEY: 'synthetic-merchant-native-totp-encryption-key' }));
    async function call(action: string, body: unknown) {
        const headers = await createLetbuyyInternalAppHeaders({ app: 'accounts', secret: INTERNAL_SECRET });
        return gateway.request('/v1/auth/custom/' + action, { method: 'POST', headers: { ...headers.headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    const tokenFor = (actor = userId) => mintSession(keys, actor, { realm: 'merchant', tokenUse: 'merchant_session', audience: MERCHANT_SESSION_AUDIENCE });
    const sourceToken = await tokenFor();
    assert.equal((await call('sessions/create', { user_id: userId, token: sourceToken })).status, 201);
    const requestId = crypto.randomUUID();
    const request = { id: requestId, clientId: 'merchant_android', callbackId: 'android_https', environment: 'development', purpose: 'login', challenge: await merchantNativeChallenge(verifier), state, launchHash: await merchantNativeHash(launchProof), managementHash: await merchantNativeHash(managementProof) };
    const complete = async () => {
        assert.equal((await call('mobile/requests', request)).status, 201);
        assert.equal((await call('mobile/bind', { requestId, launchProof, browserProof })).status, 200);
        assert.equal((await call('mobile/approve', { requestId, browserProof, sessionToken: sourceToken })).status, 200);
        assert.equal((await call('mobile/complete', { requestId, browserProof, sessionToken: sourceToken, codeHash: await merchantNativeHash(code) })).status, 200);
    };
    const proof = { requestId, clientId: request.clientId, callbackId: request.callbackId, environment: request.environment, state, code, verifier };
    const exchange = async (extra = {}) => call('mobile/exchange', { ...proof, token: await tokenFor(), ...extra });
    return { userId, email, password, gateway, call, tokenFor, sourceToken, requestId, request, proof, complete, exchange };
}

test('first-party handoff reaches canonical session registration; concurrent redemptions register exactly one session', async () => {
    const f = await fixture(); await f.complete();
    const replies = await Promise.all([f.exchange(), f.exchange()]);
    assert.deepEqual(replies.map(r => r.status).sort(), [200, 400]);
    assert.equal(owned.psql(`SELECT count(*) FROM sessions WHERE user_id='${f.userId}';`), '2');
    assert.equal(owned.psql(`SELECT count(*) FROM merchant_session_jti_consumptions WHERE user_id='${f.userId}';`), '2');
    assert.equal((await f.exchange()).status, 400, 'consumed code cannot mint another session');
});

test('browser confirmation is required and a different browser cannot substitute its binding', async () => {
    const f = await fixture();
    assert.equal((await f.call('mobile/requests', f.request)).status, 201);
    assert.equal((await f.call('mobile/bind', { requestId: f.requestId, launchProof, browserProof })).status, 200);
    assert.equal((await f.call('mobile/bind', { requestId: f.requestId, launchProof, browserProof: 'x'.repeat(43) })).status, 400);
    assert.equal((await f.call('mobile/complete', { requestId: f.requestId, browserProof, sessionToken: f.sourceToken, codeHash: await merchantNativeHash(code) })).status, 400);
    assert.equal(owned.psql(`SELECT count(*) FROM sessions WHERE user_id='${f.userId}';`), '1');
});

test('wrong PKCE, state, request, environment, callback or client cannot consume the code', async () => {
    const f = await fixture(); await f.complete();
    for (const change of [{ verifier: 'x'.repeat(43) }, { state: 'x'.repeat(43) }, { requestId: crypto.randomUUID() }, { environment: 'staging' }, { callbackId: 'ios_session' }, { clientId: 'merchant_ios' }, { code: 'x'.repeat(43) }]) {
        assert.equal((await f.exchange(change)).status, 400);
    }
    assert.equal(owned.psql(`SELECT consumed_at IS NULL FROM merchant_mobile_requests WHERE id='${f.requestId}';`), 't');
    assert.equal((await f.exchange()).status, 200, 'denials must leave a valid exchange usable');
});

test('wrong actor or symmetric/forged session cannot be registered by the handoff', async () => {
    const f = await fixture(); await f.complete();
    assert.equal((await f.exchange({ token: await f.tokenFor(crypto.randomUUID()) })).status, 503);
    const forged = await mintSession(await newIdentityKeys(), f.userId, { realm: 'merchant', tokenUse: 'merchant_session', audience: MERCHANT_SESSION_AUDIENCE });
    assert.equal((await f.exchange({ token: forged })).status, 503);
    assert.equal((await f.exchange()).status, 200);
});

test('session insert failure rolls back code AND JTI consumption; the original proof can retry', async () => {
    const f = await fixture(); await f.complete();
    const token = await f.tokenFor();
    owned.script(`CREATE FUNCTION public.synthetic_native_insert_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id='${f.userId}'::uuid THEN RAISE EXCEPTION 'synthetic session insert outage'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER synthetic_native_insert_fault BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION public.synthetic_native_insert_fault();`);
    try {
        const failed = await f.exchange({ token }); assert.equal(failed.status, 503); assert.doesNotMatch(failed.text, /synthetic session insert outage/);
        assert.equal(owned.psql(`SELECT count(*) FROM merchant_session_jti_consumptions WHERE user_id='${f.userId}';`), '1');
        assert.equal(owned.psql(`SELECT consumed_at IS NULL FROM merchant_mobile_requests WHERE id='${f.requestId}';`), 't');
    } finally { owned.script('DROP TRIGGER synthetic_native_insert_fault ON sessions; DROP FUNCTION public.synthetic_native_insert_fault();'); }
    assert.equal((await f.exchange({ token })).status, 200);
});

test('request and code expiry, source logout and cancellation fail closed', async () => {
    for (const mutation of ['request', 'code', 'logout', 'cancel']) {
        const f = await fixture(); await f.complete();
        if (mutation === 'request') owned.psql(`UPDATE merchant_mobile_requests SET expires_at=now()-interval '1 second' WHERE id='${f.requestId}';`);
        if (mutation === 'code') owned.psql(`UPDATE merchant_mobile_requests SET code_expires_at=now()-interval '1 second' WHERE id='${f.requestId}';`);
        if (mutation === 'logout') assert.equal((await f.call('sessions/destroy', { token: f.sourceToken })).status, 200);
        if (mutation === 'cancel') assert.equal((await f.call('mobile/cancel', { requestId: f.requestId, managementProof })).json?.data.cancelled, true);
        assert.equal((await f.exchange()).status, 400, mutation);
    }
});

test('cancellation and exchange serialize; a public request ID cannot cancel or disclose a user', async () => {
    const f = await fixture(); await f.complete();
    assert.equal((await f.call('mobile/cancel', { requestId: f.requestId })).status, 400);
    assert.equal((await f.call('mobile/cancel', { requestId: f.requestId, managementProof: 'x'.repeat(43) })).json?.data.cancelled, false);
    await Promise.all([f.exchange(), f.call('mobile/cancel', { requestId: f.requestId, managementProof })]);
    const counts = owned.psql(`SELECT (consumed_at IS NOT NULL)::int+(cancelled_at IS NOT NULL)::int FROM merchant_mobile_requests WHERE id='${f.requestId}';`);
    assert.equal(counts, '1');
});

test('cancelling a committed lost response revokes only its orphan native session', async () => {
    const f = await fixture(); await f.complete();
    assert.equal((await f.exchange()).status, 200);
    assert.equal((await f.call('mobile/cancel', { requestId: f.requestId, managementProof })).json?.data.cancelled, true);
    assert.equal(owned.psql(`SELECT count(*) FROM sessions WHERE user_id='${f.userId}' AND revoked_at IS NULL;`), '1');
    assert.equal(owned.psql(`SELECT revoked_reason FROM sessions WHERE id=(SELECT native_session_id FROM merchant_mobile_requests WHERE id='${f.requestId}');`), 'mobile_handoff_cancelled');
});

test('native create/security initiation requires current native proof and exact registered callback pair', async () => {
    const f = await fixture();
    for (const purpose of ['create_store', 'manage_security']) assert.equal((await f.call('mobile/requests', { ...f.request, purpose })).status, 401);
    assert.equal((await f.call('mobile/requests', { ...f.request, clientId: 'merchant_ios' })).status, 400);
    assert.equal((await f.call('mobile/requests', { ...f.request, environment: 'production' })).status, 400);
    assert.equal((await f.call('mobile/requests', { ...f.request, purpose: 'create_store', sessionToken: f.sourceToken })).status, 201);
    assert.equal((await f.call('mobile/bind', { requestId: f.requestId, launchProof, browserProof })).status, 200);
    assert.equal((await f.call('mobile/approve', { requestId: f.requestId, browserProof, sessionToken: f.sourceToken })).status, 200);
    assert.equal((await f.call('mobile/complete', { requestId: f.requestId, browserProof, sessionToken: f.sourceToken, codeHash: await merchantNativeHash(code) })).status, 400, 'creating an account is not creating a site');
});

test('native records and operations are denied to public/tenant roles and unsigned HTTP callers', async () => {
    const f = await fixture();
    assert.equal((await f.gateway.request('/v1/auth/custom/mobile/requests', { method: 'POST', body: JSON.stringify(f.request), headers: { 'Content-Type': 'application/json' } })).status, 401);
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT * FROM merchant_mobile_requests;`), /permission denied/);
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT public.create_merchant_mobile_request('{}'::jsonb);`), /permission denied/);
    }
});

test('lost authenticator recovery consumes a code once after password proof and leaves MFA active', async () => {
    const f = await fixture(), factorId = crypto.randomUUID(), recovery = 'AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD';
    const ciphertext = await encryptTextAesGcm('synthetic-merchant-native-totp-encryption-key', 'JBSWY3DPEHPK3PXP');
    owned.psql(`INSERT INTO merchant_2fa_factors(id,custom_user_id,status,secret_ciphertext,recovery_code_hashes) VALUES('${factorId}','${f.userId}','active','${ciphertext}',ARRAY['${await merchantNativeHash(factorId + ':' + recovery)}']);`);
    assert.equal((await f.call('users/authenticate', { email: f.email, password: f.password })).json?.mfa_required, true);
    assert.equal((await f.call('users/authenticate', { email: f.email, password: 'Wrong-Password-42!', recovery_code: recovery })).status, 401);
    const attempts = await Promise.all([1, 2].map(() => f.call('users/authenticate', { email: f.email, password: f.password, recovery_code: recovery })));
    assert.deepEqual(attempts.map(r => r.status).sort(), [200, 401]);
    assert.equal(owned.psql(`SELECT status||':'||cardinality(recovery_code_hashes) FROM merchant_2fa_factors WHERE id='${factorId}';`), 'active:0');
});

test('password setup is one-time even when stale verified browser intents race', async () => {
    const f = await fixture();
    assert.equal((await f.call('password-set-intents/create', { user_id: f.userId, email: f.email })).status, 409);
    owned.psql(`UPDATE users_custom SET password_hash=NULL WHERE id='${f.userId}';`);
    const firstPassword = 'Synthetic-First-Password-42!', secondPassword = 'Synthetic-Second-Password-42!';
    const replies = await Promise.all([firstPassword, secondPassword].map(password => f.call('users/set-password', { user_id: f.userId, email: f.email, password })));
    assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 409]);
    const winningPassword = replies[0].status === 200 ? firstPassword : secondPassword;
    assert.equal((await f.call('users/authenticate', { email: f.email, password: winningPassword })).status, 200);
    assert.equal((await f.call('users/set-password', { user_id: f.userId, email: f.email, password: f.password })).status, 409);
    assert.equal((await f.call('users/authenticate', { email: f.email, password: winningPassword })).status, 200);
});

test('a valid authenticator counter cannot be replayed', async () => {
    const f = await fixture(), factorId = crypto.randomUUID();
    const ciphertext = await encryptTextAesGcm('synthetic-merchant-native-totp-encryption-key', 'JBSWY3DPEHPK3PXP');
    owned.psql(`INSERT INTO merchant_2fa_factors(id,custom_user_id,status,secret_ciphertext) VALUES('${factorId}','${f.userId}','active','${ciphertext}');`);
    const counter = `floor(extract(epoch FROM clock_timestamp())/30)::bigint`;
    const proof = `SELECT public.consume_merchant_login_factor('${f.userId}','${factorId}','${await merchantNativeHash(ciphertext)}',${counter},NULL);`;
    assert.equal(owned.psql(proof), 't');
    assert.equal(owned.psql(proof), 'f', 'durable counter witness rejects replay');
});

test('paired rollback preserves canonical sessions and reapplying restores the handoff', () => {
    const before = owned.psql('SELECT count(*) FROM sessions;');
    owned.script(readFileSync('database/supabase/rollback/416_merchant_accounts_mobile_handoff.rollback.sql', 'utf8'));
    assert.equal(owned.psql('SELECT count(*) FROM sessions;'), before);
    owned.script(readFileSync('database/supabase/migrations/416_merchant_accounts_mobile_handoff.sql', 'utf8'));
    assert.equal(owned.psql("SELECT count(*) FROM information_schema.tables WHERE table_name='merchant_mobile_requests';"), '1');
});
