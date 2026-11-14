import assert from 'node:assert/strict';
import test from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import {
    newSyntheticTenant,
    seedSyntheticTenant,
    seedSyntheticOrder,
} from './synthetic-tenant';
import {
    Gateway,
    gatewayEnv,
    newIdentityKeys,
    signedIdentityHeaders,
    tapRest,
    restJson,
} from './gateway-harness';
import { consoleFixture } from './console-session-fixture';
const owned = requireOwnedDatabase();

test('catalog edits/removal and line-item attempts cannot rewrite a placed order; foreign tenants are denied', async () => {
    const a = newSyntheticTenant('immutable-a'),
        b = newSyntheticTenant('immutable-b');
    seedSyntheticTenant(owned.psql, a);
    seedSyntheticTenant(owned.psql, b);
    const owner = crypto.randomUUID(),
        email = `syn-order-${owner}@example.invalid`;
    owned.psql(
        `INSERT INTO users_custom(id,email)VALUES('${owner}','${email}');UPDATE sites SET custom_user_id='${owner}'WHERE id='${a.siteId}';`,
    );
    const order = seedSyntheticOrder(owned.psql, a);
    const snapshot = () =>
        owned.psql(
            `SELECT row_to_json(o)::text||(SELECT jsonb_agg(i ORDER BY id)::text FROM order_items i WHERE order_id=o.id)FROM orders o WHERE id='${order.orderId}';`,
        );
    const before = snapshot(),
        line = owned.psql(
            `SELECT id FROM order_items WHERE order_id='${order.orderId}' LIMIT 1;`,
        );
    const gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    const historical = await gateway.request(`/v1/orders/${order.orderId}`, {
        headers: await signedIdentityHeaders(owner, email, a.siteId),
    });
    assert.equal(historical.status, 200, historical.text);
    assert.ok(
        historical.json?.data.items?.length,
        'positive historical item control',
    );
    owned.psql(
        `UPDATE products SET name='Synthetic renamed product',price=999,sku='SYN-CHANGED',is_active=false,deleted_at=now() WHERE id='${order.productId}';`,
    );
    const afterCatalogEdit = await gateway.request(
        `/v1/orders/${order.orderId}`,
        {
            headers: await signedIdentityHeaders(owner, email, a.siteId),
        },
    );
    assert.equal(afterCatalogEdit.status, 200, afterCatalogEdit.text);
    assert.deepEqual(afterCatalogEdit.json?.data, historical.json?.data);
    assert.equal(snapshot(), before);
    const body = JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        lines: [{ order_item_id: line, quantity: 4 }],
        add_items: [],
        remove_line_item_ids: [],
    });
    for (let n = 0; n < 2; n++) {
        const r = await gateway.request(
            `/v1/orders/${order.orderId}/line-items`,
            {
                method: 'PATCH',
                headers: await signedIdentityHeaders(owner, email, a.siteId),
                body,
            },
        );
        assert.equal(r.status, 409, r.text);
        assert.equal(r.json?.error.code, 'ORDER_SNAPSHOT_IMMUTABLE');
        assert.equal(snapshot(), before);
    }
    const foreign = await gateway.request(
        `/v1/orders/${order.orderId}/line-items`,
        {
            method: 'PATCH',
            headers: await signedIdentityHeaders(owner, email, b.siteId),
            body,
        },
    );
    assert.ok([403, 404].includes(foreign.status), foreign.text);
    assert.equal(snapshot(), before);
    assert.equal(
        owned.psql(
            `SELECT count(*) FROM idempotency_keys WHERE scope='orders.line_items:${order.orderId}';`,
        ),
        '0',
    );
});

test('Merchant360 never selects a sibling site subscription and publication comes from releases, not installation', async () => {
    const f = await consoleFixture(owned),
        actor = await f.actor();
    const a = newSyntheticTenant('overview-a'),
        b = newSyntheticTenant('overview-b');
    seedSyntheticTenant(owned.psql, a);
    seedSyntheticTenant(owned.psql, b);
    owned.psql(
        `INSERT INTO users(id,email)VALUES('${actor.id}','${actor.email}');UPDATE sites SET user_id='${actor.id}',custom_user_id='${actor.id}' WHERE id IN('${a.siteId}','${b.siteId}');`,
    );
    const own = crypto.randomUUID(),
        other = crypto.randomUUID();
    owned.psql(`INSERT INTO subscriptions(id,user_id,store_id,plan,status,amount_paid,created_at)VALUES
 ('${own}','${actor.id}','${a.siteId}','free','active',0,now()-interval '1 day'),
 ('${other}','${actor.id}','${b.siteId}','free','cancelled',0,now());`);
    const path = '/v1/internal/console/merchants/' + a.siteId + '/overview';
    const r = await f.gateway.request(path, { headers: actor.headers });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json?.data.subscription.id, own);
    assert.deepEqual(
        r.json?.data.subscriptions.map((x: { id: string }) => x.id),
        [own],
    );
    assert.equal(r.json?.data.ecosystem.published_release, null);
    assert.equal(r.json?.data.ecosystem.active_theme, null);
    const release = crypto.randomUUID(),
        foreignRelease = crypto.randomUUID();
    owned.psql(`INSERT INTO theme_releases(id,store_id,theme_id,release_version,is_current)VALUES
 ('${release}','${a.siteId}','letbuyy-core',1,true),('${foreignRelease}','${b.siteId}','urban-kicks',99,true);`);
    const published = await f.gateway.request(path, { headers: actor.headers });
    assert.equal(published.status, 200, published.text);
    assert.equal(published.json?.data.ecosystem.published_release.id, release);
    assert.equal(published.json?.data.ecosystem.publication_consistent, false);
    owned.psql(
        `UPDATE sites SET current_theme_release_id='${release}'WHERE id='${a.siteId}';`,
    );
    const consistent = await f.gateway.request(path, {
        headers: actor.headers,
    });
    assert.equal(consistent.status, 200, consistent.text);
    assert.equal(consistent.json?.data.ecosystem.publication_consistent, true);
});

test('merchant and Console share one support thread; public projection hides internal notes and duplicate replies are safe', async () => {
    const f = await consoleFixture(owned),
        operator = await f.actor(),
        viewer = await f.actor('viewer');
    const a = newSyntheticTenant('support-a'),
        b = newSyntheticTenant('support-b');
    seedSyntheticTenant(owned.psql, a);
    seedSyntheticTenant(owned.psql, b);
    const owner = crypto.randomUUID(),
        email = `syn-support-${owner}@example.invalid`;
    owned.psql(
        `INSERT INTO users_custom(id,email)VALUES('${owner}','${email}');UPDATE sites SET custom_user_id='${owner}'WHERE id IN('${a.siteId}','${b.siteId}');`,
    );
    const merchant = async (
        path: string,
        method = 'GET',
        body?: unknown,
        key?: string,
    ) =>
        f.gateway.request('/v1/merchant/support/' + path, {
            method,
            headers: {
                ...(await signedIdentityHeaders(owner, email, a.siteId)),
                ...(key ? { 'X-Idempotency-Key': key } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
    const key = crypto.randomUUID(),
        payload = {
            site_id: a.siteId,
            subject: 'Synthetic theme help',
            body: 'Synthetic public request',
            topic: 'themes',
        };
    const created = await merchant('tickets', 'POST', payload, key);
    assert.equal(created.status, 201, created.text);
    const ticket = created.json?.data.ticket.id;
    assert.ok(ticket);
    const duplicate = await merchant('tickets', 'POST', payload, key);
    assert.equal(duplicate.status, 201, duplicate.text);
    assert.equal(duplicate.json?.data.ticket.id, ticket);
    const changed = await merchant(
        'tickets',
        'POST',
        { ...payload, body: 'changed synthetic intent' },
        key,
    );
    assert.equal(changed.status, 409, changed.text);
    const queue = await f.gateway.request(
        '/v1/internal/console/operator/support/tickets?site_id=' + a.siteId,
        { headers: operator.headers },
    );
    assert.equal(queue.status, 200, queue.text);
    assert.equal(queue.json?.data[0].id, ticket);
    assert.equal(queue.json?.capabilities.reply, true);
    const reply = async (visibility: string, body: string, key: string) =>
        f.gateway.request(
            '/v1/internal/console/operator/support/tickets/' +
                ticket +
                '/messages',
            {
                method: 'POST',
                headers: { ...operator.headers, 'Idempotency-Key': key },
                body: JSON.stringify({
                    body,
                    visibility,
                    reason: 'Synthetic support response',
                }),
            },
        );
    const publicKey = crypto.randomUUID();
    assert.equal(
        (await reply('public', 'Synthetic visible answer', publicKey)).status,
        200,
    );
    assert.equal(
        (await reply('public', 'Synthetic visible answer', publicKey)).status,
        200,
    );
    assert.equal(
        (
            await reply(
                'internal',
                'SYNTHETIC-INTERNAL-NEVER-MERCHANT',
                crypto.randomUUID(),
            )
        ).status,
        200,
    );
    const read = await merchant('tickets/' + ticket + '?site_id=' + a.siteId);
    assert.equal(read.status, 200, read.text);
    assert.equal(read.json?.data.messages.length, 2);
    assert.doesNotMatch(
        read.text,
        /SYNTHETIC-INTERNAL|requester_email|assignee_id|metadata/,
    );
    const foreign = await merchant(
        'tickets/' + ticket + '?site_id=' + b.siteId,
    );
    assert.ok([403, 404].includes(foreign.status), foreign.text);
    const denied = await f.gateway.request(
        '/v1/internal/console/operator/support/tickets/' + ticket + '/messages',
        {
            method: 'POST',
            headers: {
                ...viewer.headers,
                'Idempotency-Key': crypto.randomUUID(),
            },
            body: JSON.stringify({
                body: 'not allowed',
                reason: 'Synthetic denied reply',
            }),
        },
    );
    assert.equal(denied.status, 403, denied.text);
    const recovered = await merchant(
        'tickets/recovery',
        'POST',
        { site_id: a.siteId, operation: 'create', target_id: null, key },
        crypto.randomUUID(),
    );
    assert.equal(recovered.status, 200, recovered.text);
    assert.equal(recovered.json?.data.state, 'completed');
    const resolved = await f.gateway.request(
        '/v1/internal/console/operator/support/tickets/' + ticket + '/resolve',
        {
            method: 'POST',
            headers: {
                ...operator.headers,
                'Idempotency-Key': crypto.randomUUID(),
            },
            body: JSON.stringify({
                reason: 'Synthetic issue resolved',
                resolution_note: 'Synthetic issue resolved',
            }),
        },
    );
    assert.equal(resolved.status, 200, resolved.text);
    const after = await merchant('tickets/' + ticket + '?site_id=' + a.siteId);
    assert.equal(after.json?.data.ticket.status, 'resolved');
    const blocked = await merchant(
        'tickets/' + ticket + '/messages',
        'POST',
        { site_id: a.siteId, body: 'Do not silently reopen' },
        crypto.randomUUID(),
    );
    assert.equal(blocked.status, 409, blocked.text);
});

test('merchant support rolls back ticket, message, outbox and receipt on mandatory audit failure; ownership is live on recovery', async () => {
    const f = await consoleFixture(owned),
        a = newSyntheticTenant('support-fault');
    seedSyntheticTenant(owned.psql, a);
    const owner = crypto.randomUUID(),
        other = crypto.randomUUID(),
        email = `syn-support-${owner}@example.invalid`;
    owned.psql(
        `INSERT INTO users_custom(id,email)VALUES('${owner}','${email}'),('${other}','syn-other-${other}@example.invalid');UPDATE sites SET custom_user_id='${owner}'WHERE id='${a.siteId}';`,
    );
    const key = crypto.randomUUID(),
        body = {
            site_id: a.siteId,
            subject: 'Synthetic atomic test',
            body: 'Synthetic request',
        };
    async function create() {
        return f.gateway.request('/v1/merchant/support/tickets', {
            method: 'POST',
            headers: {
                ...(await signedIdentityHeaders(owner, email, a.siteId)),
                'X-Idempotency-Key': key,
            },
            body: JSON.stringify(body),
        });
    }
    owned.psql(
        `CREATE FUNCTION syn_merchant_support_fault()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action LIKE 'merchant.support.%' AND NEW.actor_id='${owner}' THEN RAISE EXCEPTION 'synthetic-support-audit-fault';END IF;RETURN NEW;END$$;CREATE TRIGGER syn_merchant_support_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION syn_merchant_support_fault();`,
    );
    try {
        const failed = await create();
        assert.equal(failed.status, 503, failed.text);
        assert.doesNotMatch(failed.text, /synthetic-support-audit-fault/);
        assert.equal(
            owned.psql(
                `SELECT count(*)FROM support_tickets WHERE site_id='${a.siteId}';`,
            ),
            '0',
        );
        assert.equal(
            owned.psql(
                `SELECT count(*)FROM support_mutation_receipts WHERE actor_id='${owner}';`,
            ),
            '0',
        );
    } finally {
        owned.psql(
            'DROP TRIGGER syn_merchant_support_fault ON audit_logs;DROP FUNCTION syn_merchant_support_fault();',
        );
    }
    const good = await create();
    assert.equal(good.status, 201, good.text);
    owned.psql(
        `UPDATE sites SET custom_user_id='${other}'WHERE id='${a.siteId}';`,
    );
    const revoked = await create();
    assert.ok([403, 404].includes(revoked.status), revoked.text);
    const recovery = await f.gateway.request(
        '/v1/merchant/support/tickets/recovery',
        {
            method: 'POST',
            headers: {
                ...(await signedIdentityHeaders(owner, email, a.siteId)),
                'X-Idempotency-Key': key,
            },
            body: JSON.stringify({
                site_id: a.siteId,
                operation: 'create',
                target_id: null,
                key,
            }),
        },
    );
    assert.ok([403, 404].includes(recovery.status), recovery.text);
});

test('concurrent merchant create and a lost committed HTTP reply retain exactly one canonical ticket/receipt', async () => {
    const f = await consoleFixture(owned),
        a = newSyntheticTenant('support-race');
    seedSyntheticTenant(owned.psql, a);
    const actor = crypto.randomUUID(),
        email = `syn-race-${actor}@example.invalid`,
        key = crypto.randomUUID();
    owned.psql(
        `INSERT INTO users_custom(id,email)VALUES('${actor}','${email}');UPDATE sites SET custom_user_id='${actor}'WHERE id='${a.siteId}';`,
    );
    const payload = {
        site_id: a.siteId,
        subject: 'Synthetic duplicate race',
        body: 'Synthetic same intent',
        topic: 'general',
    };
    const call = async (requestKey = key) =>
        f.gateway.request('/v1/merchant/support/tickets', {
            method: 'POST',
            headers: {
                ...(await signedIdentityHeaders(actor, email, a.siteId)),
                'X-Idempotency-Key': requestKey,
            },
            body: JSON.stringify(payload),
        });
    const results = await Promise.all([call(), call()]);
    for (const r of results) assert.equal(r.status, 201, r.text);
    assert.equal(
        results[0].json?.data.ticket.id,
        results[1].json?.data.ticket.id,
    );
    assert.equal(
        owned.psql(
            `SELECT count(*)FROM support_tickets WHERE site_id='${a.siteId}';`,
        ),
        '1',
    );
    assert.equal(
        owned.psql(
            `SELECT count(*)FROM support_mutation_receipts WHERE actor_id='${actor}';`,
        ),
        '1',
    );
    assert.equal(
        owned.psql(
            `SELECT count(*)FROM audit_logs WHERE actor_id='${actor}'AND action='merchant.support.ticket.create';`,
        ),
        '1',
    );
    const lostKey = crypto.randomUUID();
    let lost = false;
    const tap = tapRest(owned.restUrl, async (c, forward) => {
        const result = await forward();
        if (
            !lost &&
            c.resource === 'rpc/execute_merchant_support_mutation_v1'
        ) {
            lost = true;
            return restJson(503, {
                message: 'synthetic-committed-support-reply-lost',
            });
        }
        return result;
    });
    try {
        assert.equal((await call(lostKey)).status, 503);
    } finally {
        tap.restore();
    }
    const retry = await call(lostKey);
    assert.equal(retry.status, 201, retry.text);
    assert.equal(
        owned.psql(
            `SELECT count(*)FROM support_tickets WHERE site_id='${a.siteId}';`,
        ),
        '2',
    );
    assert.equal(
        owned.psql(
            `SELECT count(*)FROM support_mutation_receipts WHERE actor_id='${actor}';`,
        ),
        '2',
    );
});

test('merchant support function is backend-only and rollback preserves all canonical evidence', async () => {
    const { readFileSync } = await import('node:fs');
    const signature =
        'public.execute_merchant_support_mutation_v1(uuid,uuid,text,uuid,text,jsonb,integer,integer)';
    for (const role of ['anon', 'authenticated', 'app_tenant'])
        assert.equal(
            owned.psql(
                `SELECT has_function_privilege('${role}','${signature}','EXECUTE');`,
            ),
            'f',
        );
    assert.equal(
        owned.psql(
            `SELECT has_function_privilege('service_role','${signature}','EXECUTE');`,
        ),
        't',
    );
    const counts = () =>
        owned.psql(
            "SELECT (SELECT count(*)FROM support_tickets)||'|'||(SELECT count(*)FROM ticket_messages)||'|'||(SELECT count(*)FROM support_mutation_receipts);",
        );
    const before = counts();
    owned.script(
        readFileSync(
            'database/supabase/rollback/370_merchant_support_projection.rollback.sql',
            'utf8',
        ),
    );
    assert.equal(counts(), before);
    owned.script(
        readFileSync(
            'database/supabase/migrations/370_merchant_support_projection.sql',
            'utf8',
        ),
    );
    assert.equal(counts(), before);
    assert.equal(
        owned.psql(
            `SELECT has_function_privilege('authenticated','${signature}','EXECUTE');`,
        ),
        'f',
    );
});
