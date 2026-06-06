import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    appComplianceWebhookEventIdPrefix,
    buildAppComplianceWebhookPayload,
    dispatchAppLifecycleSubscriptions,
} from '../../services/api-gateway/src/routes/app-store/shared';

const testDir = dirname(fileURLToPath(import.meta.url));
const complianceRouteSource = readFileSync(
    join(testDir, '../../services/api-gateway/src/routes/app-store/compliance-routes.ts'),
    'utf8',
);
const installLifecycleSource = readFileSync(
    join(testDir, '../../services/api-gateway/src/routes/app-store/install-lifecycle-routes.ts'),
    'utf8',
);
const appStoreRootSource = readFileSync(join(testDir, '../../services/api-gateway/src/routes/app-store.ts'), 'utf8');
const developerSurfaceSource = readFileSync(join(testDir, '../../apps/developer-portal/src/lib/developer-surface.ts'), 'utf8');

test('app compliance webhook dispatch sends mandatory topics to eligible app subscriptions', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown>; headers: Record<string, string> }> = [];
    const env = {
        INTERNAL_API_SECRET: 'internal-secret',
        WEBHOOK_SERVICE: {
            fetch: async (url: string, init: RequestInit) => {
                calls.push({
                    url,
                    body: JSON.parse(String(init.body || '{}')) as Record<string, unknown>,
                    headers: Object.fromEntries(new Headers(init.headers).entries()),
                });
                return new Response(null, { status: 202 });
            },
        },
    };
    const payload = buildAppComplianceWebhookPayload({
        eventType: 'customers/data_request',
        storeId: 'site_001',
        occurredAt: '2026-06-05T21:00:00.000Z',
        requestId: 'req_compliance_001',
        triggerSource: 'merchant',
        actorId: 'merchant_001',
        customerId: 'customer_001',
        reason: 'customer_export_requested',
    });
    const delivered = await dispatchAppLifecycleSubscriptions(env as never, {
        eventType: 'customers/data_request',
        installationId: 'install_001',
        eventIdPrefix: appComplianceWebhookEventIdPrefix({
            eventType: 'customers/data_request',
            storeId: 'site_001',
            idempotencyKey: 'compliance-key-001',
        }),
        payload,
        requestId: 'req_compliance_001',
        subscriptions: [
            {
                target_url: 'https://partner.example/webhooks/letbuyy',
                signing_secret: 'app-signing-secret',
                event_types: ['app.installed', 'customers/data_request', 'customers/redact', 'shop/redact'],
            },
            {
                target_url: 'https://partner.example/other',
                signing_secret: 'app-signing-secret',
                event_types: ['customers/redact'],
            },
        ],
    });

    assert.equal(delivered, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://webhook-service/app-lifecycle/dispatch');
    assert.equal(calls[0].headers['x-letbuyy-internal-secret'], 'internal-secret');
    assert.equal(calls[0].body.event_type, 'customers/data_request');
    assert.equal(calls[0].body.event_id, 'app-compliance:customers/data_request:site_001:compliance-key-001:0');
    assert.deepEqual(calls[0].body.payload, payload);
});

test('app compliance routes require ownership, idempotency, configured delivery, and app-platform subscriptions', () => {
    for (const marker of [
        "router.post('/compliance/customers/data-request'",
        "router.post('/compliance/customers/redact'",
        "router.post('/compliance/shop/redact'",
        'AppComplianceWebhookRequestSchema',
        "c.req.header('X-Idempotency-Key')",
        'verifySiteOwnership(',
        ".contains('event_types', [eventType])",
        ".contains('metadata', { source: 'app-platform' })",
        'SERVER_MISCONFIGURED',
        'dispatchAppLifecycleSubscriptions(c.env',
    ]) {
        assert.ok(complianceRouteSource.includes(marker), `missing compliance route marker: ${marker}`);
    }

    assert.match(appStoreRootSource, /registerAppStoreComplianceRoutes\(router\)/);
});

test('app uninstall emits shop redact before disabling app webhook subscriptions', () => {
    const shopRedactIndex = installLifecycleSource.indexOf("eventType: 'shop/redact'");
    const disableIndex = installLifecycleSource.indexOf("status: 'disabled'");

    assert.ok(shopRedactIndex >= 0, 'missing uninstall shop/redact dispatch');
    assert.ok(disableIndex >= 0, 'missing webhook subscription disable update');
    assert.ok(shopRedactIndex < disableIndex, 'shop/redact must be emitted before app webhook subscriptions are disabled');
    assert.match(installLifecycleSource, /triggerSource: 'app_uninstall'/);
    assert.match(installLifecycleSource, /appComplianceWebhookEventIdPrefix/);
});

test('developer docs describe compliance topics as emitted, not only subscribed', () => {
    assert.match(developerSurfaceSource, /POST \/v1\/app-store\/compliance\/customers\/data-request/);
    assert.match(developerSurfaceSource, /POST \/v1\/app-store\/compliance\/customers\/redact/);
    assert.match(developerSurfaceSource, /POST \/v1\/app-store\/compliance\/shop\/redact/);
    assert.match(developerSurfaceSource, /uninstall emits shop\/redact before app webhook subscriptions are disabled/);
});
