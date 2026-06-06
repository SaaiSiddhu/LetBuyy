import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    createAppScopedAccessToken,
    sha256Hex,
    verifyAppScopedAccessToken,
} from '@letbuyy/auth-core';
import { authorizeVerifiedAppInstallation } from '../../services/api-gateway/src/middleware/app-auth';

const testDir = dirname(fileURLToPath(import.meta.url));
const routeSource = readFileSync(join(testDir, '../../services/api-gateway/src/routes/app-api.ts'), 'utf8');
const indexSource = readFileSync(join(testDir, '../../services/api-gateway/src/index.ts'), 'utf8');
const apiClientSource = readFileSync(join(testDir, '../../packages/typescript/api-client/src/index.ts'), 'utf8');
const developerPortalSource = readFileSync(join(testDir, '../../apps/developer-portal/src/lib/developer-surface.ts'), 'utf8');

test('app scoped API accepts matching active installations and rejects missing scopes', async () => {
    const secret = 'app-api-token-secret';
    const accessToken = await createAppScopedAccessToken(
        {
            appId: 'app_loyalty',
            installationId: 'install_loyalty_001',
            storeId: 'site_001',
            installedBy: 'merchant_001',
            scopes: ['read_products', 'write_app_metadata'],
        },
        secret,
        { nowSeconds: 1_700_000_000, ttlSeconds: 600, tokenId: 'app_api_token_001' },
    );
    const tokenHash = await sha256Hex(accessToken);
    const accepted = await verifyAppScopedAccessToken(accessToken, secret, {
        nowSeconds: 1_700_000_100,
        requiredScopes: ['read_products'],
    });

    assert.equal(accepted.accepted, true);
    if (!accepted.accepted) throw new Error(`expected accepted token, got ${accepted.status}`);

    const authorized = authorizeVerifiedAppInstallation({
        payload: accepted.payload,
        tokenHash,
        requiredScopes: ['read_products'],
        installation: {
            id: 'install_loyalty_001',
            app_id: 'app_loyalty',
            store_id: 'site_001',
            installed_by: 'merchant_001',
            status: 'active',
            scopes_granted: ['read_products', 'write_app_metadata'],
            config: { oauth: { access_token_hash: tokenHash } },
        },
    });

    assert.equal(authorized.ok, true);
    if (!authorized.ok) throw new Error(`expected installation authorization, got ${authorized.code}`);
    assert.equal(authorized.context.app.storeId, 'site_001');
    assert.deepEqual(authorized.context.app.scopes, ['read_products', 'write_app_metadata']);

    const missingTokenScope = await verifyAppScopedAccessToken(accessToken, secret, {
        nowSeconds: 1_700_000_100,
        requiredScopes: ['read_orders'],
    });
    assert.equal(missingTokenScope.status, 'insufficient_scope');

    const missingInstallationScope = authorizeVerifiedAppInstallation({
        payload: accepted.payload,
        tokenHash,
        requiredScopes: ['write_app_metadata'],
        installation: {
            id: 'install_loyalty_001',
            app_id: 'app_loyalty',
            store_id: 'site_001',
            installed_by: 'merchant_001',
            status: 'active',
            scopes_granted: ['read_products'],
            config: { oauth: { access_token_hash: tokenHash } },
        },
    });
    assert.equal(missingInstallationScope.ok, false);
    if (missingInstallationScope.ok) throw new Error('expected missing installation scope to fail');
    assert.equal(missingInstallationScope.status, 403);
    assert.equal(missingInstallationScope.code, 'INSUFFICIENT_SCOPE');
});

test('app scoped API rejects revoked token hashes and inactive installations', async () => {
    const secret = 'app-api-token-secret';
    const accessToken = await createAppScopedAccessToken(
        {
            appId: 'app_loyalty',
            installationId: 'install_loyalty_001',
            storeId: 'site_001',
            installedBy: 'merchant_001',
            scopes: ['read_products'],
        },
        secret,
        { nowSeconds: 1_700_000_000, ttlSeconds: 600, tokenId: 'app_api_token_002' },
    );
    const accepted = await verifyAppScopedAccessToken(accessToken, secret, {
        nowSeconds: 1_700_000_100,
        requiredScopes: ['read_products'],
    });

    assert.equal(accepted.accepted, true);
    if (!accepted.accepted) throw new Error(`expected accepted token, got ${accepted.status}`);

    const revoked = authorizeVerifiedAppInstallation({
        payload: accepted.payload,
        tokenHash: await sha256Hex(accessToken),
        requiredScopes: ['read_products'],
        installation: {
            id: 'install_loyalty_001',
            app_id: 'app_loyalty',
            store_id: 'site_001',
            installed_by: 'merchant_001',
            status: 'active',
            scopes_granted: ['read_products'],
            config: { oauth: { access_token_hash: 'different-token-hash' } },
        },
    });
    assert.equal(revoked.ok, false);
    if (revoked.ok) throw new Error('expected revoked token hash to fail');
    assert.equal(revoked.status, 401);

    const inactive = authorizeVerifiedAppInstallation({
        payload: accepted.payload,
        tokenHash: await sha256Hex(accessToken),
        requiredScopes: ['read_products'],
        installation: {
            id: 'install_loyalty_001',
            app_id: 'app_loyalty',
            store_id: 'site_001',
            installed_by: 'merchant_001',
            status: 'uninstalled',
            scopes_granted: ['read_products'],
            config: { oauth: { access_token_hash: await sha256Hex(accessToken) } },
        },
    });
    assert.equal(inactive.ok, false);
    if (inactive.ok) throw new Error('expected inactive installation to fail');
    assert.equal(inactive.status, 401);
});

test('app API routes are bounded to app scopes and mounted before merchant auth', () => {
    assert.match(routeSource, /router\.get\('\/products', appAuthMiddleware\(\['read_products'\]\)/);
    assert.match(routeSource, /router\.get\('\/orders', appAuthMiddleware\(\['read_orders'\]\)/);
    assert.match(routeSource, /router\.patch\('\/installation\/metadata', appAuthMiddleware\(\['write_app_metadata'\]\)/);
    assert.match(routeSource, /SECRET_KEY_PATTERN/);
    assert.doesNotMatch(routeSource, /authMiddleware/);

    const appMountIndex = indexSource.indexOf("api.route('/app', appApiRouter)");
    const merchantAuthIndex = indexSource.indexOf("api.use('/*', authMiddleware)");
    assert.ok(appMountIndex > -1, 'missing /v1/app route mount');
    assert.ok(merchantAuthIndex > -1, 'missing merchant auth middleware mount');
    assert.ok(appMountIndex < merchantAuthIndex, '/v1/app must be mounted before merchant auth middleware');

    for (const marker of [
        'readonly appApi = {',
        "this.requestPaginated<Product>('/app/products'",
        "this.requestPaginated<Order>('/app/orders'",
        "this.requestData<AppApiInstallationMetadataResult>('/app/installation/metadata'",
        '/v1/app/products',
        '/v1/app/orders',
        '/v1/app/installation/metadata',
    ]) {
        const source = marker.startsWith('/v1/app') ? developerPortalSource : apiClientSource;
        assert.ok(source.includes(marker), `missing app API contract marker: ${marker}`);
    }
});
