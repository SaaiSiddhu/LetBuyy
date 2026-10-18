import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import {
    LETBUYY_CUSTOMER_SESSION_COOKIE,
    createCustomerSessionToken,
    issueCustomerSession,
} from '@letbuyy/auth-core';
import type { Env } from '../index';
import { recordCustomerSessionIssued, requireCustomerSession } from '../middleware/customer-session';

const SECRET = 'customer-session-telemetry-test-only-secret';
const STORE_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';

type Point = { indexes?: Array<ArrayBuffer | string | null>; doubles?: number[]; blobs?: Array<ArrayBuffer | string | null> };

function appForSessionRoute() {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', requireCustomerSession);
    app.get('/v1/storefront/snazz/customer/orders', (c) => c.json({ customer: c.get('customer') }));
    return app;
}

function appForIssueRoute() {
    const app = new Hono<{ Bindings: Env }>();
    app.post('/v1/storefront/customer/login', (c) => {
        recordCustomerSessionIssued(c, 'password_login');
        return c.json({ success: true });
    });
    return app;
}

function testEnv(
    writeDataPoint?: (point: Point | undefined) => void,
    compatibility: Env['CUSTOMER_SESSION_COMPATIBILITY'] = 'both',
): Env {
    return {
        ENVIRONMENT: 'test',
        CUSTOMER_SESSION_SECRET: SECRET,
        CUSTOMER_SESSION_COMPATIBILITY: compatibility,
        RUNTIME_TELEMETRY: writeDataPoint ? { writeDataPoint } : undefined,
    } as Env;
}

test('accepted HS256 session formats emit aggregate format and route-class telemetry without identifiers', async () => {
    const formats = [
        {
            name: 'gateway_hs256_v1',
            token: (await issueCustomerSession({ storeId: STORE_ID, customerId: CUSTOMER_ID }, SECRET)).token,
        },
        {
            name: 'shopper_hs256_legacy',
            token: await createCustomerSessionToken({
                id: CUSTOMER_ID,
                storeId: STORE_ID,
                email: 'private@example.test',
                fullName: 'Private Buyer',
            }, SECRET),
        },
    ];

    for (const item of formats) {
        const points: Point[] = [];
        const response = await appForSessionRoute().request('/v1/storefront/snazz/customer/orders', {
            headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${item.token}` },
        }, testEnv((point) => { if (point) points.push(point); }));

        assert.equal(response.status, 200);
        assert.equal(points.length, 1);
        const point = points[0];
        assert.deepEqual(point.doubles, [1]);
        assert.deepEqual(point.blobs?.slice(-2), [item.name, 'orders']);
        const serialized = JSON.stringify(point);
        for (const privateValue of [item.token, STORE_ID, CUSTOMER_ID, 'private@example.test', 'Private Buyer', 'snazz']) {
            assert.equal(serialized.includes(privateValue), false, `telemetry must omit ${privateValue === item.token ? 'the session token' : 'customer/store data'}`);
        }
    }
});

test('telemetry absence or write failure never changes a valid session decision', async () => {
    const token = (await issueCustomerSession({ storeId: STORE_ID, customerId: CUSTOMER_ID }, SECRET)).token;
    for (const telemetry of [undefined, () => { throw new Error('telemetry unavailable'); }]) {
        const response = await appForSessionRoute().request('/v1/storefront/snazz/customer/orders', {
            headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${token}` },
        }, testEnv(telemetry));
        assert.equal(response.status, 200);
    }
});

test('successful gateway issuance telemetry is aggregate and contains only the fixed operation class', async () => {
    const points: Point[] = [];
    const response = await appForIssueRoute().request('/v1/storefront/customer/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'private@example.test', store_id: STORE_ID, customer_id: CUSTOMER_ID }),
    }, testEnv((point) => { if (point) points.push(point); }));

    assert.equal(response.status, 200);
    assert.equal(points.length, 1);
    assert.deepEqual(points[0].doubles, [1]);
    assert.deepEqual(points[0].blobs?.slice(-2), ['gateway_hs256_v1', 'password_login']);
    const serialized = JSON.stringify(points[0]);
    for (const privateValue of ['private@example.test', STORE_ID, CUSTOMER_ID, '/login']) {
        assert.equal(serialized.includes(privateValue), false);
    }
});

test('missing or failing issuance telemetry never changes the route response', async () => {
    for (const telemetry of [undefined, () => { throw new Error('telemetry unavailable'); }]) {
        const response = await appForIssueRoute().request('/v1/storefront/customer/login', {
            method: 'POST',
        }, testEnv(telemetry));
        assert.equal(response.status, 200);
    }
});

test('malformed customer cookie fails closed and allows a valid explicit session header', async () => {
    const token = (await issueCustomerSession({ storeId: STORE_ID, customerId: CUSTOMER_ID }, SECRET)).token;

    const malformedOnly = await appForSessionRoute().request('/v1/storefront/snazz/customer/orders', {
        headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=%` },
    }, testEnv());
    assert.equal(malformedOnly.status, 401);

    const malformedWithHeader = await appForSessionRoute().request('/v1/storefront/snazz/customer/orders', {
        headers: {
            Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=%`,
            'X-LetBuyy-Customer-Session': token,
        },
    }, testEnv());
    assert.equal(malformedWithHeader.status, 200);
});

test('explicit customer-session compatibility policy accepts only its selected token format', async () => {
    const formats = [
        {
            name: 'gateway_hs256_v1' as const,
            token: (await issueCustomerSession({ storeId: STORE_ID, customerId: CUSTOMER_ID }, SECRET)).token,
        },
        {
            name: 'shopper_hs256_legacy' as const,
            token: await createCustomerSessionToken({
                id: CUSTOMER_ID,
                storeId: STORE_ID,
                email: 'private@example.test',
                fullName: 'Private Buyer',
            }, SECRET),
        },
    ];

    const policies: Array<{
        policy: NonNullable<Env['CUSTOMER_SESSION_COMPATIBILITY']>;
        accepted: typeof formats[number]['name'] | null;
    }> = [
        { policy: 'gateway_hs256_v1', accepted: 'gateway_hs256_v1' },
        { policy: 'shopper_hs256_legacy', accepted: 'shopper_hs256_legacy' },
        { policy: 'disabled', accepted: null },
    ];

    for (const { policy, accepted } of policies) {
        for (const format of formats) {
            const response = await appForSessionRoute().request('/v1/storefront/snazz/customer/orders', {
                headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${format.token}` },
            }, testEnv(undefined, policy));
            assert.equal(response.status, format.name === accepted ? 200 : 401, `${policy} / ${format.name}`);
        }
    }
});

test('verifier transition rehearsal can restore dual-format compatibility after strict mode', async () => {
    const formats = [
        {
            name: 'gateway_hs256_v1',
            token: (await issueCustomerSession({ storeId: STORE_ID, customerId: CUSTOMER_ID }, SECRET)).token,
        },
        {
            name: 'shopper_hs256_legacy',
            token: await createCustomerSessionToken({
                id: CUSTOMER_ID,
                storeId: STORE_ID,
                email: 'private@example.test',
                fullName: 'Private Buyer',
            }, SECRET),
        },
    ] as const;

    const requestWithPolicy = (token: string, compatibility: Env['CUSTOMER_SESSION_COMPATIBILITY']) =>
        appForSessionRoute().request('/v1/storefront/snazz/customer/orders', {
            headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${token}` },
        }, testEnv(undefined, compatibility));

    // Rehearse a reversible configuration change without changing the worker's default.
    for (const format of formats) {
        assert.equal((await requestWithPolicy(format.token, 'both')).status, 200,
            `${format.name} should be accepted by the dual-format baseline`);
    }

    assert.equal((await requestWithPolicy(formats[0].token, 'gateway_hs256_v1')).status, 200);
    assert.equal((await requestWithPolicy(formats[1].token, 'gateway_hs256_v1')).status, 401,
        'the legacy format should be refused during strict-mode rehearsal');

    for (const format of formats) {
        const response = await requestWithPolicy(format.token, 'both');
        assert.equal(response.status, 200, `${format.name} should recover after restoring dual mode`);
    }
});

test('missing policy preserves dual-format behavior, while an invalid policy fails closed', async () => {
    const formats = [
        (await issueCustomerSession({ storeId: STORE_ID, customerId: CUSTOMER_ID }, SECRET)).token,
        await createCustomerSessionToken({ id: CUSTOMER_ID, storeId: STORE_ID, email: 'private@example.test', fullName: 'Private Buyer' }, SECRET),
    ];

    for (const token of formats) {
        const compatible = await appForSessionRoute().request('/v1/storefront/snazz/customer/orders', {
            headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${token}` },
        }, { ...testEnv(), CUSTOMER_SESSION_COMPATIBILITY: undefined });
        assert.equal(compatible.status, 200);

        const invalid = await appForSessionRoute().request('/v1/storefront/snazz/customer/orders', {
            headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${token}` },
        }, { ...testEnv(), CUSTOMER_SESSION_COMPATIBILITY: 'invalid' } as unknown as Env);
        assert.equal(invalid.status, 401);
    }
});
