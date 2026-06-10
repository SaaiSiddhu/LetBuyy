import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    LETBUYY_APP_MANIFEST_SCHEMA_VERSION,
    createExampleLetbuyyAppManifest,
    planAppManifestRegistration,
    planMarketplaceAppSubmission,
} from '../../packages/shared-types/src/app-platform.ts';

const testDir = dirname(fileURLToPath(import.meta.url));
const developerRouteSource = readFileSync(join(testDir, '../../services/api-gateway/src/routes/app-store/developer-routes.ts'), 'utf8');
const apiClientSource = readFileSync(join(testDir, '../../packages/typescript/api-client/src/index.ts'), 'utf8');
const developerSurfaceSource = readFileSync(join(testDir, '../../apps/developer-portal/src/lib/developer-surface.ts'), 'utf8');
const referenceSource = readFileSync(join(testDir, '../../apps/developer-portal/src/lib/reference.ts'), 'utf8');

test('app manifest validation is package-owned and produces registration plans', () => {
    const manifest = createExampleLetbuyyAppManifest();
    const plan = planAppManifestRegistration('app_manifest_test', manifest);

    assert.equal(manifest.schema_version, LETBUYY_APP_MANIFEST_SCHEMA_VERSION);
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.ok(plan.value.extensionRecords.length > 0);
    assert.ok(plan.value.functionRecords.length > 0);
    assert.deepEqual(plan.value.manifest.scopes, [...manifest.scopes].sort());
});

test('marketplace app submission accepts a matching manifest and rejects slug drift', () => {
    const manifest = createExampleLetbuyyAppManifest();
    const valid = planMarketplaceAppSubmission({
        name: manifest.app.name,
        slug: manifest.app.slug,
        tagline: 'Rewards and loyalty automation',
        description: 'Adds merchant-controlled loyalty blocks and checkout functions.',
        category_id: '11111111-1111-4111-8111-111111111111',
        app_url: 'https://apps.example.com/loyalty',
        privacy_policy_url: 'https://apps.example.com/privacy',
        screenshots: ['https://apps.example.com/media/loyalty-dashboard.webp'],
        data_handling_summary: 'Reads product and checkout metadata to render loyalty rewards and does not store customer data outside the merchant installation.',
        data_collected: ['Products', 'Checkout metadata'],
        pricing_model: 'free',
        manifest,
    }, '22222222-2222-4222-8222-222222222222');

    assert.equal(valid.ok, true);
    if (!valid.ok) return;
    assert.deepEqual(valid.value.api_scopes, [...manifest.scopes].sort());
    assert.equal(valid.value.version, manifest.app.version);

    const drift = planMarketplaceAppSubmission({
        name: manifest.app.name,
        slug: 'different-slug',
        tagline: 'Rewards and loyalty automation',
        description: 'Adds merchant-controlled loyalty blocks and checkout functions.',
        category_id: '11111111-1111-4111-8111-111111111111',
        app_url: 'https://apps.example.com/loyalty',
        privacy_policy_url: 'https://apps.example.com/privacy',
        screenshots: ['https://apps.example.com/media/loyalty-dashboard.webp'],
        pricing_model: 'free',
        manifest,
    }, '22222222-2222-4222-8222-222222222222');

    assert.equal(drift.ok, false);
    if (drift.ok) return;
    assert.match(drift.message, /manifest app\.slug must match/);
});

test('developer app routes validate manifests and persist hash-only show-once credentials', () => {
    assert.match(developerRouteSource, /\/developers\/apps\/manifest\/validate/);
    assert.match(developerRouteSource, /planAppManifestRegistration\('manifest_validation_preview'/);
    assert.match(developerRouteSource, /persistSubmittedAppManifest/);
    assert.match(developerRouteSource, /persistDeveloperAppCredentials/);
    assert.match(developerRouteSource, /sha256Hex\(clientSecret\)/);
    assert.match(developerRouteSource, /sha256Hex\(apiKey\)/);
    assert.match(developerRouteSource, /plaintext_persisted: false/);
    assert.match(developerRouteSource, /show_once: true/);
    assert.match(developerRouteSource, /\/developers\/apps\/:id\/api-key/);
    assert.doesNotMatch(developerRouteSource, /client_secret_hash:\s*clientSecret/);
    assert.doesNotMatch(developerRouteSource, /api_key_hash:\s*apiKey/);
});

test('api client exposes manifest validation, key rotation, and minimal app SDK helpers', () => {
    assert.match(apiClientSource, /validateDeveloperAppManifest/);
    assert.match(apiClientSource, /\/app-store\/developers\/apps\/manifest\/validate/);
    assert.match(apiClientSource, /rotateDeveloperAppKey/);
    assert.match(apiClientSource, /\/app-store\/developers\/apps\/\$\{encodePathSegment\(appId\)\}\/api-key/);
    assert.match(apiClientSource, /export function createLetbuyyAppSdk/);
    assert.match(apiClientSource, /products: client\.appApi\.products/);
    assert.match(apiClientSource, /orders: client\.appApi\.orders/);
    assert.match(apiClientSource, /updateInstallationMetadata: client\.appApi\.updateInstallationMetadata/);
});

test('developer portal documents no-credential tooling honestly', () => {
    assert.match(developerSurfaceSource, /\/v1\/app-store\/developers\/apps\/manifest\/validate/);
    assert.match(developerSurfaceSource, /show-once developer API key/);
    assert.match(developerSurfaceSource, /hash-only persistence/);
    assert.match(developerSurfaceSource, /createLetbuyyAppSdk/);
    assert.match(referenceSource, /Minimal App SDK wrapper/);
    assert.match(referenceSource, /createLetbuyyAppSdk/);
    assert.match(referenceSource, /POST \/v1\/app-store\/developers\/apps\/:id\/api-key/);
    assert.doesNotMatch(referenceSource, /No partner API key inventory, create, revoke, or rotate endpoint is present/);
});
