import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach, before } from 'node:test';
import { issueCustomerSession, LETBUYY_CUSTOMER_SESSION_COOKIE } from '@letbuyy/auth-core';
import { Gateway, gatewayEnv, newIdentityKeys, tapRest, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const site = newSyntheticTenant('addr-atomicity');
const sessionSecret = 'synthetic-customer-address-session-secret';
let keys: IdentityKeys;
let gateway: Gateway;

before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(owned.psql, site);
    gateway = new Gateway(gatewayEnv(owned, keys, { CUSTOMER_SESSION_SECRET: sessionSecret }));
});

afterEach(async () => { await gateway.settle(); });

async function fixture() {
    const customerId = crypto.randomUUID();
    const email = `address-${customerId}@example.invalid`;
    owned.psql(`INSERT INTO store_customers (id,store_id,email,status) VALUES ('${customerId}','${site.siteId}','${email}','active');`);
    const session = await issueCustomerSession({ storeId: site.siteId, customerId }, sessionSecret);
    const csrf = crypto.randomUUID();
    return {
        customerId,
        email,
        headers: {
            Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${session.token}; letbuyy_csrf=${csrf}`,
            'X-CSRF-Token': csrf,
            'Content-Type': 'application/json',
        },
    };
}

function addressBody(customerId: string, email: string, extra: Record<string, unknown> = {}) {
    return {
        customer_id: customerId,
        customer_email: email,
        store_id: site.siteId,
        full_name: 'Synthetic Address Owner',
        address_line1: '1 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560001',
        country: 'IN',
        ...extra,
    };
}

async function createDefault(headers: Record<string, string>, customerId: string, email: string, extra: Record<string, unknown> = {}) {
    return gateway.request('/v1/storefront/customer/addresses', {
        method: 'POST', headers, body: JSON.stringify(addressBody(customerId, email, { label: 'home', is_default: true, ...extra })),
    });
}

test('failed create of a default address preserves the existing default', async () => {
    const owner = await fixture();
    const initial = await createDefault(owner.headers, owner.customerId, owner.email);
    assert.equal(initial.status, 201, initial.text);
    const priorDefaultId = initial.json?.data?.address?.id as string;

    const failed = await createDefault(owner.headers, owner.customerId, owner.email, { label: 'invalid' });
    assert.equal(failed.status, 500);
    assert.equal(owned.psql(`SELECT count(*) FROM customer_addresses WHERE store_id='${site.siteId}' AND customer_email='${owner.email}' AND is_default;`), '1');
    assert.equal(owned.psql(`SELECT id FROM customer_addresses WHERE store_id='${site.siteId}' AND customer_email='${owner.email}' AND is_default;`), priorDefaultId);
});

test('foreign address update cannot clear the caller\'s default', async () => {
    const owner = await fixture();
    const stranger = await fixture();
    const ownAddress = await createDefault(owner.headers, owner.customerId, owner.email);
    const foreignAddress = await createDefault(stranger.headers, stranger.customerId, stranger.email);
    assert.equal(ownAddress.status, 201, ownAddress.text);
    assert.equal(foreignAddress.status, 201, foreignAddress.text);

    const attempted = await gateway.request(`/v1/storefront/customer/addresses/${foreignAddress.json?.data?.address?.id}`, {
        method: 'PATCH', headers: owner.headers,
        body: JSON.stringify(addressBody(owner.customerId, owner.email, { is_default: true, label: 'work' })),
    });
    assert.equal(attempted.status, 404);
    assert.equal(owned.psql(`SELECT id FROM customer_addresses WHERE store_id='${site.siteId}' AND customer_email='${owner.email}' AND is_default;`), ownAddress.json?.data?.address?.id);
    assert.equal(owned.psql(`SELECT is_default::text FROM customer_addresses WHERE id='${foreignAddress.json?.data?.address?.id}';`), 'true');
});

test('concurrent default-address creates leave exactly one default', async () => {
    const owner = await fixture();
    let arrivals = 0;
    let release!: () => void;
    let opened!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const bothArrived = new Promise<void>((resolve) => { opened = resolve; });
    let arrivalTimer: ReturnType<typeof setTimeout> | undefined;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if ((call.resource === 'customer_addresses' && call.method === 'PATCH')
            || (call.resource === 'rpc/mutate_store_customer_address' && call.method === 'POST')) {
            arrivals += 1;
            if (arrivals === 2) opened();
            await gate;
        }
        return forward();
    });
    try {
        const creates = [
            createDefault(owner.headers, owner.customerId, owner.email, { address_line1: '1 First Street' }),
            createDefault(owner.headers, owner.customerId, owner.email, { address_line1: '2 Second Street' }),
        ];
        await Promise.race([bothArrived, new Promise((_, reject) => {
            arrivalTimer = setTimeout(() => reject(new Error('address mutations did not overlap')), 5000);
        })]);
        if (arrivalTimer) clearTimeout(arrivalTimer);
        release();
        const results = await Promise.all(creates);
        assert.deepEqual(results.map((result) => result.status), [201, 201], results.map((result) => result.text).join('\n'));
    } finally {
        release();
        tap.restore();
    }
    assert.equal(owned.psql(`SELECT count(*) FROM customer_addresses WHERE store_id='${site.siteId}' AND customer_email='${owner.email}' AND is_default;`), '1');
    assert.equal(arrivals, 2);
});

test('a customer disabled after session lookup cannot mutate an address', async () => {
    const owner = await fixture();
    const initial = await createDefault(owner.headers, owner.customerId, owner.email);
    assert.equal(initial.status, 201, initial.text);
    const priorDefaultId = initial.json?.data?.address?.id as string;
    let disabledBeforeWrite = false;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'rpc/mutate_store_customer_address' && !disabledBeforeWrite) {
            disabledBeforeWrite = true;
            owned.psql(`UPDATE store_customers SET status='disabled' WHERE id='${owner.customerId}' AND store_id='${site.siteId}';`);
        }
        return forward();
    });
    try {
        const response = await createDefault(owner.headers, owner.customerId, owner.email, { address_line1: '2 Must Not Save Street' });
        assert.equal(response.status, 403);
    } finally {
        tap.restore();
    }
    assert.equal(owned.psql(`SELECT count(*) FROM customer_addresses WHERE store_id='${site.siteId}' AND customer_email='${owner.email}';`), '1');
    assert.equal(owned.psql(`SELECT id FROM customer_addresses WHERE store_id='${site.siteId}' AND customer_email='${owner.email}' AND is_default;`), priorDefaultId);
    assert.equal(disabledBeforeWrite, true);
});

test('mutation RPC is backend-only and rollback/reapply leaves saved addresses unchanged', () => {
    const ownerId = crypto.randomUUID();
    const email = `rpc-${ownerId}@example.invalid`;
    owned.psql(`INSERT INTO store_customers (id,store_id,email,status) VALUES ('${ownerId}','${site.siteId}','${email}','active');`);
    owned.psql(`INSERT INTO customer_addresses (store_id,customer_email,full_name,address_line1,city,state,postal_code,is_default) VALUES ('${site.siteId}','${email}','Synthetic Rollback Buyer','1 Saved Street','Bengaluru','Karnataka','560001',true);`);
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.equal(owned.psql(`SELECT has_function_privilege('${role}', 'public.mutate_store_customer_address(uuid,uuid,text,uuid,jsonb)', 'EXECUTE');`), 'f');
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT public.mutate_store_customer_address(NULL,NULL,NULL,NULL,'{}');`), /permission denied/);
    }
    assert.equal(owned.psql("SELECT has_function_privilege('service_role', 'public.mutate_store_customer_address(uuid,uuid,text,uuid,jsonb)', 'EXECUTE');"), 't');
    assert.equal(owned.psql("SELECT prosecdef FROM pg_proc WHERE oid='public.mutate_store_customer_address(uuid,uuid,text,uuid,jsonb)'::regprocedure;"), 'f');

    const beforeRows = owned.psql(`SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM customer_addresses a WHERE store_id='${site.siteId}' AND customer_email='${email}';`);
    owned.psql(readFileSync(new URL('../../../../../database/supabase/rollback/286_store_customer_address_atomic_default.rollback.sql', import.meta.url), 'utf8'));
    assert.equal(owned.psql("SELECT to_regprocedure('public.mutate_store_customer_address(uuid,uuid,text,uuid,jsonb)') IS NULL;"), 't');
    assert.equal(owned.psql(`SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM customer_addresses a WHERE store_id='${site.siteId}' AND customer_email='${email}';`), beforeRows);
    owned.psql(readFileSync(new URL('../../../../../database/supabase/migrations/286_store_customer_address_atomic_default.sql', import.meta.url), 'utf8'));
    assert.equal(owned.psql("SELECT to_regprocedure('public.mutate_store_customer_address(uuid,uuid,text,uuid,jsonb)') IS NOT NULL;"), 't');
    assert.equal(owned.psql(`SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM customer_addresses a WHERE store_id='${site.siteId}' AND customer_email='${email}';`), beforeRows);
});
