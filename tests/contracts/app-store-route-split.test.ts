import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readAppStoreRootSource, readAppStoreRouteSource } from '../helpers/app-store-route-source.mjs';

function assertOrdered(source: string, markers: string[]): void {
    let previousIndex = -1;
    for (const marker of markers) {
        const index = source.indexOf(marker);
        assert.ok(index >= 0, `missing app-store route marker: ${marker}`);
        assert.ok(index > previousIndex, `app-store route marker is out of order: ${marker}`);
        previousIndex = index;
    }
}

test('app-store route registrations keep marketplace, installation, billing, OAuth, install, and partner order', () => {
    const source = readAppStoreRouteSource();

    assertOrdered(source, [
        "router.get('/categories'",
        "router.get('/apps'",
        "router.get('/apps/:id'",
        "router.get('/apps/:id/reviews'",
        "router.post('/apps/:id/reviews'",
        "router.get('/installations'",
        "router.get('/installations/:id/extensions'",
        "router.patch('/installations/:id/extensions/:registrationId'",
        "router.patch('/installations/:id/functions/:registrationId'",
        "router.post('/installations/:id/embed-session'",
        "router.post('/bridge/fetch'",
        "router.post('/installations/:id/charges'",
        "router.post('/charges/:id/approve'",
        "router.post('/apps/:id/oauth/authorize'",
        "router.post('/oauth/token'",
        "router.post('/oauth/token-exchange'",
        "router.post('/apps/:id/install'",
        "router.delete('/apps/:id/install'",
        "router.post('/compliance/customers/data-request'",
        "router.post('/compliance/customers/redact'",
        "router.post('/compliance/shop/redact'",
        "router.post('/partners/collaborator-code'",
        "router.get('/developers/me'",
        "router.post('/developers/register'",
        "router.get('/developers/apps'",
        "router.get('/partners/dashboard'",
        "router.post('/developers/apps'",
        "router.get('/developers/:id'",
    ]);
});

test('app-store split keeps critical install, bridge, event, and partner safeguards wired', () => {
    const source = readAppStoreRouteSource();

    for (const marker of [
        "scope: 'app-store.install'",
        "scope: 'app-store.uninstall'",
        "claim.kind === 'replay'",
        'idempotency.complete(',
        'idempotency.fail(',
        'verifyAppScopedAccessToken',
        'createLetbuyyInternalIdentityHeaders',
        "eventType: 'app.installed'",
        "eventType: 'app.uninstalled'",
        "eventType: 'app.charge.created'",
        "eventType: 'app.charge.activated'",
        "eventType: 'app.submitted'",
        "requireRoleCategory('partner')",
        'createMarketplaceReviewRecord(db',
    ]) {
        assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});

test('app-store route module registration order is explicit once split', () => {
    const rootSource = readAppStoreRootSource();
    const moduleMarkers = [
        'registerAppStoreExtensionRoutes(router)',
        'registerAppStoreBillingOAuthRoutes(router)',
        'registerAppStoreInstallLifecycleRoutes(router)',
        'registerAppStoreComplianceRoutes(router)',
        'registerAppStoreDeveloperToolingRoutes(router)',
        'registerAppStoreDeveloperRoutes(router)',
    ];

    if (!moduleMarkers.every((marker) => rootSource.includes(marker))) {
        return;
    }

    assertOrdered(rootSource, moduleMarkers);
});
