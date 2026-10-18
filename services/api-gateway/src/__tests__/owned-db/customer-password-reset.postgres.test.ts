// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Password-reset replay must have one database winner across concurrent real-worker requests.
// This drives Gateway HTTP, rate limits, PostgREST and owned PostgreSQL; service_role bypasses RLS.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test, { afterEach, before } from 'node:test';
import * as bcrypt from 'bcryptjs';
import { Gateway, gatewayEnv, newBarrier, newIdentityKeys, tapRest, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('customer-reset');
const secret = 'synthetic-customer-reset-session-secret';
let keys: IdentityKeys;
let gateway: Gateway;

before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(psql, site);
    gateway = new Gateway(gatewayEnv(owned, keys, { CUSTOMER_SESSION_SECRET: secret }));
});
afterEach(async () => { await gateway.settle(); });

test('two simultaneous confirmations consume one reset token and change one customer password', async () => {
    const customerId = crypto.randomUUID();
    const email = `reset-${crypto.randomUUID()}@example.invalid`;
    const token = `reset-${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const tokenHash = createHmac('sha256', secret)
        .update(`customer-password-reset.${site.siteId}.${email}.${token}`)
        .digest('hex');
    const originalHash = await bcrypt.hash('Original-Password-123', 4);
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status,password_hash) VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Reset Buyer','active','${originalHash}');
        INSERT INTO customer_credentials (store_id,email_or_phone,password_hash,reset_token_hash,reset_expires_at,reset_used_at)
        VALUES ('${site.siteId}','${email}','${originalHash}','${tokenHash}',now() + interval '5 minutes',NULL);`);

    const barrier = newBarrier(2);
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'rpc/confirm_customer_password_reset') {
            await barrier.arrive();
        }
        return forward();
    });
    const confirm = () => gateway.request('/v1/storefront/customer/password/confirm-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            store_id: site.siteId,
            email,
            token,
            password: 'Fresh-Password-456',
        }),
    });

    let responses;
    try {
        responses = await Promise.all([confirm(), confirm()]);
    } finally {
        tap.restore();
    }

    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400],
        'one valid reset token must produce at most one successful confirmation');
    const credential = psql(`SELECT password_hash || '|' || (reset_token_hash IS NULL)::text || '|' || (reset_used_at IS NOT NULL)::text
        FROM customer_credentials WHERE store_id='${site.siteId}' AND email_or_phone='${email}';`);
    const [credentialHash, tokenCleared, tokenConsumed] = credential.split('|');
    assert.equal(tokenCleared, 'true');
    assert.equal(tokenConsumed, 'true');
    assert.ok(await bcrypt.compare('Fresh-Password-456', credentialHash));
    assert.equal(psql(`SELECT password_hash FROM store_customers WHERE id='${customerId}' AND store_id='${site.siteId}';`), credentialHash,
        'customer and login credential must commit the same password hash');
    assert.equal(responses.filter((response) => response.headers.get('set-cookie')?.includes('lb_customer_session=')).length, 1,
        'only the winner may receive a new session');
});

test('a required credential-write failure rolls back the password change and leaves the token retryable', async () => {
    const customerId = crypto.randomUUID();
    const email = `reset-fault-${crypto.randomUUID()}@example.invalid`;
    const token = `reset-${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const tokenHash = createHmac('sha256', secret)
        .update(`customer-password-reset.${site.siteId}.${email}.${token}`)
        .digest('hex');
    const originalHash = await bcrypt.hash('Original-Password-123', 4);
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status,password_hash) VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Fault Buyer','active','${originalHash}');
        INSERT INTO customer_credentials (store_id,email_or_phone,password_hash,reset_token_hash,reset_expires_at,reset_used_at)
        VALUES ('${site.siteId}','${email}','${originalHash}','${tokenHash}',now() + interval '5 minutes',NULL);
        CREATE FUNCTION public.synthetic_customer_reset_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
            IF NEW.reset_used_at IS NOT NULL THEN RAISE EXCEPTION 'synthetic reset credential fault'; END IF;
            RETURN NEW;
        END $$;
        CREATE TRIGGER synthetic_customer_reset_fault BEFORE UPDATE ON public.customer_credentials
            FOR EACH ROW EXECUTE FUNCTION public.synthetic_customer_reset_fault();`);

    const confirm = () => gateway.request('/v1/storefront/customer/password/confirm-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: site.siteId, email, token, password: 'Fresh-Password-456' }),
    });
    const failed = await confirm();
    assert.equal(failed.status, 500);
    assert.doesNotMatch(failed.text, /synthetic reset credential fault/);
    assert.equal(psql(`SELECT password_hash FROM store_customers WHERE id='${customerId}';`), originalHash,
        'the earlier customer password update must roll back with the failed credential update');
    assert.equal(psql(`SELECT reset_token_hash || '|' || coalesce(reset_used_at::text,'') FROM customer_credentials WHERE email_or_phone='${email}';`), `${tokenHash}|`,
        'the token claim must roll back and remain unused');

    psql('DROP TRIGGER synthetic_customer_reset_fault ON public.customer_credentials; DROP FUNCTION public.synthetic_customer_reset_fault();');
    const retry = await confirm();
    assert.equal(retry.status, 200, 'the same token can succeed after the database fault is repaired');
    const updatedHash = psql(`SELECT password_hash FROM customer_credentials WHERE email_or_phone='${email}';`);
    assert.ok(await bcrypt.compare('Fresh-Password-456', updatedHash));
    assert.equal(psql(`SELECT password_hash FROM store_customers WHERE id='${customerId}';`), updatedHash);
});

test('the atomic reset RPC is executable by service_role only', () => {
    const signature = 'public.confirm_customer_password_reset(uuid,text,text,text)';
    assert.equal(psql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE')::text;`), 'true');
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        const error = owned.psqlExpectError(`SET ROLE ${role}; SELECT public.confirm_customer_password_reset(NULL,NULL,NULL,NULL);`);
        assert.match(error, /permission denied/i, `${role} must not execute the password reset RPC`);
    }
});
