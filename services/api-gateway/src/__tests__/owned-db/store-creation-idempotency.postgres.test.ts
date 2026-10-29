import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { DEFAULT_STOREFRONT_DOMAIN } from '@letbuyy/shared-types';
import {
    Gateway,
    gatewayEnv,
    newBarrier,
    newIdentityKeys,
    restJson,
    signedIdentityHeaders,
    tapRest,
} from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const { psql } = owned;
const owner = { id: crypto.randomUUID(), email: `store-idempotency-${crypto.randomUUID()}@example.invalid` };
const other = { id: crypto.randomUUID(), email: `store-idempotency-other-${crypto.randomUUID()}@example.invalid` };
let gateway: Gateway;

before(async () => {
    psql(`INSERT INTO users_custom (id,email,email_verified) VALUES
      ('${owner.id}','${owner.email}',true), ('${other.id}','${other.email}',true);`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
});

afterEach(async () => { await gateway.settle(); });

function input(label: string, subdomain = `syn-store-${crypto.randomUUID().slice(0, 12)}`) {
    return {
        name: `Synthetic ${label}`,
        subdomain,
        site_type: 'store',
        tagline: 'Synthetic idempotency test',
        locale: 'en-IN',
        theme_id: 'modern',
        template_config: { onboarding: { source: 'owned-db-test' } },
    };
}

async function create(
    actor: typeof owner,
    body: ReturnType<typeof input>,
    key: string,
) {
    return gateway.request('/v1/stores', {
        method: 'POST',
        headers: { ...await signedIdentityHeaders(actor.id, actor.email), 'X-Idempotency-Key': key },
        body: JSON.stringify(body),
    });
}

function scalar(sql: string): string { return psql(sql); }

test('store creation replays by owner and key, rejects changed payload and isolates owners', async () => {
    const key = crypto.randomUUID();
    const body = input('Replay');
    const first = await create(owner, body, key);
    const replay = await create(owner, body, key);
    assert.equal(first.status, 201, first.text);
    assert.equal(replay.status, 201, replay.text);
    assert.equal(replay.headers.get('x-idempotent-replay'), 'true');
    assert.equal(replay.json?.data?.id, first.json?.data?.id);
    assert.equal(first.json?.meta?.checkout_domain?.hostname, `checkout.${body.subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`);
    assert.equal(scalar(`SELECT count(*) FROM site_domains WHERE site_id='${first.json?.data?.id}' AND purpose='checkout' AND checkout_retired_at IS NULL AND deleted_at IS NULL;`), '1', 'creation and replay persist one automatic provisioning intent');
    assert.equal(scalar(`SELECT published::text FROM sites WHERE id='${first.json?.data?.id}';`), 'false');
    assert.equal(scalar(`SELECT count(*) FROM sites WHERE custom_user_id='${owner.id}' AND store_creation_idempotency_key='${key}';`), '1');
    assert.equal(scalar(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${first.json?.data?.id}' AND event_type='store.created' AND idempotency_key='store.created:${first.json?.data?.id}';`), '1');

    const changed = await create(owner, { ...body, name: 'Different request' }, key);
    assert.equal(changed.status, 409, changed.text);
    assert.match(changed.text, /IDEMPOTENCY_KEY_CONFLICT/);

    const otherBody = input('Other owner');
    const otherResult = await create(other, otherBody, key);
    assert.equal(otherResult.status, 201, otherResult.text);
    assert.notEqual(otherResult.json?.data?.id, first.json?.data?.id);
});

test('concurrent duplicates create one store and a lost committed response is recovered on retry', async () => {
    const concurrentBody = input('Concurrent');
    const concurrentKey = crypto.randomUUID();
    const barrier = newBarrier(4);
    const concurrentTap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.method === 'POST' && call.resource === 'sites') await barrier.arrive();
        return forward();
    });
    let concurrent;
    try {
        concurrent = await Promise.all(Array.from({ length: 4 }, () => create(owner, concurrentBody, concurrentKey)));
    } finally {
        concurrentTap.restore();
    }
    assert.ok(concurrent.every((response) => response.status === 201), concurrent.map((response) => response.text).join('\n'));
    assert.equal(new Set(concurrent.map((response) => response.json?.data?.id)).size, 1);
    assert.equal(scalar(`SELECT count(*) FROM sites WHERE custom_user_id='${owner.id}' AND store_creation_idempotency_key='${concurrentKey}';`), '1');

    const lostBody = input('Lost response');
    const lostKey = crypto.randomUUID();
    let interceptedInsert = false;
    const lostTap = tapRest(owned.restUrl, async (call, forward) => {
        if (!interceptedInsert && call.method === 'POST' && call.resource === 'sites') {
            interceptedInsert = true;
            const committed = await forward();
            assert.equal(committed.status, 201);
            return restJson(503, { code: 'synthetic_lost_response', message: 'Synthetic committed response loss' });
        }
        return forward();
    });
    try {
        const failed = await create(owner, lostBody, lostKey);
        assert.equal(failed.status, 500, failed.text);
        assert.equal(interceptedInsert, true);
    } finally {
        lostTap.restore();
    }

    gateway = new Gateway(gateway.env);
    const recovered = await create(owner, lostBody, lostKey);
    assert.equal(recovered.status, 201, recovered.text);
    assert.equal(recovered.headers.get('x-idempotent-replay'), 'true');
    assert.equal(scalar(`SELECT count(*) FROM sites WHERE custom_user_id='${owner.id}' AND store_creation_idempotency_key='${lostKey}';`), '1');
    assert.equal(scalar(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${recovered.json?.data?.id}' AND event_type='store.created' AND idempotency_key='store.created:${recovered.json?.data?.id}';`), '1');
});
