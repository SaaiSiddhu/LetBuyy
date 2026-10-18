// The normal Identity web wizard persists into the canonical Gateway onboarding aggregate.
import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const { psql, psqlExpectError } = owned;
const ownerId = crypto.randomUUID();
const otherId = crypto.randomUUID();
const storeId = crypto.randomUUID();
const otherStoreId = crypto.randomUUID();
let keys: IdentityKeys;
let gateway: Gateway;

before(async () => {
    keys = await newIdentityKeys();
    psql(`
      INSERT INTO users_custom (id,email,email_verified,full_name) VALUES
        ('${ownerId}','onboarding-owner-${ownerId}@example.invalid',true,'Synthetic Onboarding Owner'),
        ('${otherId}','onboarding-other-${otherId}@example.invalid',true,'Synthetic Other Owner');
      INSERT INTO sites (id,custom_user_id,name,store_name,site_type,subdomain,status,published,currency,locale,created_at,updated_at)
        VALUES ('${storeId}','${ownerId}','Synthetic Draft Store','syn-onboarding-${ownerId.slice(0,8)}','store','syn-onboarding-${ownerId.slice(0,8)}','draft',false,'INR','en-IN',now(),now()),
               ('${otherStoreId}','${otherId}','Synthetic Other Store','syn-other-${otherId.slice(0,8)}','store','syn-other-${otherId.slice(0,8)}','draft',false,'INR','en-IN',now(),now());
    `);
    gateway = new Gateway(gatewayEnv(owned, keys));
});

afterEach(async () => { await gateway.settle(); });

async function headers(userId: string) {
    return signedIdentityHeaders(userId, `onboarding-${userId}@example.invalid`);
}

async function completionHeaders(userId: string, idempotencyKey: string) {
    return { ...(await headers(userId)), 'X-Idempotency-Key': idempotencyKey };
}

async function save(userId: string, draft: Record<string, unknown>) {
    return gateway.request('/v1/onboarding/web-draft', {
        method: 'PUT',
        headers: await headers(userId),
        body: JSON.stringify(draft),
    });
}

test('web draft is account-bound, resumable and saved under one serialized attempt', async () => {
    const initial = await save(ownerId, { step: 1, store_name: '', subdomain: '', industry: 'general' });
    assert.equal(initial.status, 200, initial.text);
    const attemptId = initial.json?.data?.attempt_id as string;
    assert.match(attemptId, /^[0-9a-f-]{36}$/i);

    const update = await save(ownerId, {
        step: 3,
        store_name: 'South India Coffee',
        subdomain: 'south-india-coffee',
        industry: 'food',
        channels: ['online', 'social', 'marketplace'],
    });
    assert.equal(update.status, 200, update.text);
    assert.equal(update.json?.data?.attempt_id, attemptId);

    const loaded = await gateway.request('/v1/onboarding/web-draft', { headers: await headers(ownerId) });
    assert.equal(loaded.status, 200, loaded.text);
    assert.deepEqual(loaded.json?.data?.attempt?.draft, {
        version: 1,
        store_name: 'South India Coffee',
        subdomain: 'south-india-coffee',
        industry: 'food',
    });
    assert.deepEqual(loaded.json?.data?.attempt?.channels, ['marketplace', 'online', 'social']);
    assert.equal(psql(`SELECT survey_data->'channels' = '["marketplace","online","social"]'::jsonb FROM onboarding_attempts WHERE id='${attemptId}';`), 't');
    assert.equal(loaded.json?.data?.attempt?.attempt_id, attemptId);
    assert.doesNotMatch(loaded.text, /ip_address|user_agent|failure_reason|error_details/);

    const crossAccount = await gateway.request('/v1/onboarding/web-draft', { headers: await headers(otherId) });
    assert.equal(crossAccount.status, 200);
    assert.equal(crossAccount.json?.data?.attempt, null);

    const parallel = await Promise.all([
        save(ownerId, { step: 2, store_name: 'First Draft', subdomain: 'first-draft', industry: 'books' }),
        save(ownerId, { step: 2, store_name: 'Second Draft', subdomain: 'second-draft', industry: 'fashion' }),
    ]);
    assert.deepEqual(parallel.map((response) => response.status), [200, 200]);
    assert.ok(parallel.every((response) => response.json?.data?.attempt_id === attemptId));
    assert.equal(psql(`SELECT count(*) FROM onboarding_attempts WHERE user_id='${ownerId}' AND status='in_progress' AND survey_data ? 'web_draft';`), '1');
});

test('web draft rejects invalid subdomains and completion requires an owned store', async () => {
    const invalid = await save(ownerId, { step: 2, store_name: 'Invalid', subdomain: 'bad..handle', industry: 'general' });
    assert.equal(invalid.status, 400);

    const invalidChannel = await save(ownerId, { step: 2, store_name: 'Invalid channel', subdomain: 'invalid-channel', industry: 'general', channels: ['courier'] });
    assert.equal(invalidChannel.status, 400);
    assert.match(psqlExpectError(`SELECT public.save_storefront_web_onboarding_draft('${ownerId}',2,'Invalid channel','invalid-channel','general',ARRAY['courier']::text[]);`), /Invalid sales channel selection/);
    assert.match(psqlExpectError(`SELECT public.save_storefront_web_onboarding_draft('${ownerId}',2,'Invalid channel','invalid-channel','general',ARRAY[NULL]::text[]);`), /Invalid sales channel selection/);

    const ownedSubdomain = `syn-onboarding-${ownerId.slice(0, 8)}`;
    const created = await save(ownerId, { step: 3, store_name: 'Ready Store', subdomain: ownedSubdomain, industry: 'general' });
    assert.equal(created.status, 200, created.text);
    const attemptId = created.json?.data?.attempt_id as string;

    const crossOwner = await gateway.request('/v1/onboarding/web-draft/complete', {
        method: 'POST',
        headers: await completionHeaders(ownerId, `draft-complete-cross-owner-${attemptId}`),
        body: JSON.stringify({ attempt_id: attemptId, store_id: otherStoreId }),
    });
    assert.equal(crossOwner.status, 404);
    assert.equal(psql(`SELECT status FROM onboarding_attempts WHERE id='${attemptId}';`), 'in_progress');

    const crossAccount = await gateway.request('/v1/onboarding/web-draft/complete', {
        method: 'POST',
        headers: await completionHeaders(otherId, `draft-complete-cross-account-${attemptId}`),
        body: JSON.stringify({ attempt_id: attemptId, store_id: otherStoreId }),
    });
    assert.equal(crossAccount.status, 404);
    assert.equal(psql(`SELECT status FROM onboarding_attempts WHERE id='${attemptId}';`), 'in_progress');

    const mismatchedStoreId = crypto.randomUUID();
    const mismatchedSubdomain = `syn-mismatch-${ownerId.slice(0, 8)}`;
    psql(`INSERT INTO sites (id,custom_user_id,name,store_name,site_type,subdomain,status,published,currency,locale,created_at,updated_at)
      VALUES ('${mismatchedStoreId}','${ownerId}','Synthetic Mismatched Store','${mismatchedSubdomain}','store','${mismatchedSubdomain}','draft',false,'INR','en-IN',now(),now());`);
    const mismatchedHandle = await gateway.request('/v1/onboarding/web-draft/complete', {
        method: 'POST',
        headers: await completionHeaders(ownerId, `draft-complete-mismatch-${mismatchedStoreId}`),
        body: JSON.stringify({ attempt_id: attemptId, store_id: mismatchedStoreId }),
    });
    assert.equal(mismatchedHandle.status, 409);
    assert.equal(psql(`SELECT status FROM onboarding_attempts WHERE id='${attemptId}';`), 'in_progress');

    const completed = await gateway.request('/v1/onboarding/web-draft/complete', {
        method: 'POST',
        headers: await completionHeaders(ownerId, `draft-complete-owner-${attemptId}`),
        body: JSON.stringify({ attempt_id: attemptId, store_id: storeId }),
    });
    assert.equal(completed.status, 200, completed.text);
    assert.equal(psql(`SELECT status || ':' || store_id::text FROM onboarding_attempts WHERE id='${attemptId}';`), `completed:${storeId}`);

    const replay = await gateway.request('/v1/onboarding/web-draft/complete', {
        method: 'POST',
        headers: await completionHeaders(ownerId, `draft-complete-owner-${attemptId}`),
        body: JSON.stringify({ attempt_id: attemptId, store_id: storeId }),
    });
    assert.equal(replay.status, 200, replay.text);

    const finished = await gateway.request('/v1/onboarding/web-draft', { headers: await headers(ownerId) });
    assert.equal(finished.status, 200);
    assert.equal(finished.json?.data?.attempt, null);
});

test('GET reconciles a draft after store creation succeeded but finalization response was lost', async () => {
    const subdomain = `recovered-${ownerId.slice(0, 8)}`;
    const draft = await save(ownerId, { step: 3, store_name: 'Recovered Store', subdomain, industry: 'general' });
    assert.equal(draft.status, 200, draft.text);
    const attemptId = draft.json?.data?.attempt_id as string;
    const recoveredStoreId = crypto.randomUUID();

    // Model the existing canonical /stores insert succeeding before its completion call is lost.
    psql(`INSERT INTO sites (id,custom_user_id,name,store_name,site_type,subdomain,status,published,currency,locale,created_at,updated_at)
      VALUES ('${recoveredStoreId}','${ownerId}','Recovered Store','${subdomain}','store','${subdomain}','draft',false,'INR','en-IN',now(),now());`);

    const resumed = await gateway.request('/v1/onboarding/web-draft', { headers: await headers(ownerId) });
    assert.equal(resumed.status, 200, resumed.text);
    assert.equal(resumed.json?.data?.attempt, null);
    assert.equal(resumed.json?.data?.completed_store?.id, recoveredStoreId);
    assert.equal(psql(`SELECT status || ':' || store_id::text FROM onboarding_attempts WHERE id='${attemptId}';`), `completed:${recoveredStoreId}`);
});

test('storefront creation refuses an unverified merchant contact and succeeds after email verification', async () => {
    const merchantId = crypto.randomUUID();
    const email = `onboarding-contact-${merchantId}@example.invalid`;
    const subdomain = `verified-${merchantId.slice(0, 8)}`;
    psql(`INSERT INTO users_custom (id,email,email_verified,full_name) VALUES ('${merchantId}','${email}',false,'Synthetic Contact Merchant');`);

    const request = async () => gateway.request('/v1/stores', {
        method: 'POST',
        headers: await signedIdentityHeaders(merchantId, email),
        body: JSON.stringify({
            name: 'Verified Contact Store',
            subdomain,
            site_type: 'store',
            theme_id: 'modern',
            template_config: {},
        }),
    });

    const denied = await request();
    assert.equal(denied.status, 403, denied.text);
    assert.match(denied.text, /EMAIL_VERIFICATION_REQUIRED/);
    assert.equal(psql(`SELECT count(*) FROM sites WHERE custom_user_id='${merchantId}';`), '0');

    psql(`UPDATE users_custom SET email_verified=true WHERE id='${merchantId}';`);
    const created = await request();
    assert.equal(created.status, 201, created.text);
    assert.equal(psql(`SELECT count(*) FROM sites WHERE custom_user_id='${merchantId}' AND subdomain='${subdomain}' AND status='draft';`), '1');
});
