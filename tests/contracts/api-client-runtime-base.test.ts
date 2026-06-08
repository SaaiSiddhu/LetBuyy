import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    LETBUYY_PRODUCTION_API_BASE_URL,
    apiClientInputToLetbuyyApiPath,
    normalizeLetbuyyApiBaseUrl,
    resolveLetbuyyApiBaseUrl,
} from '../../packages/typescript/api-client/src/index';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(relativePath: string): string {
    const absolutePath = join(repoRoot, relativePath);
    assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
    return readFileSync(absolutePath, 'utf8');
}

test('api-client owns framework-free API base URL normalization', () => {
    assert.equal(LETBUYY_PRODUCTION_API_BASE_URL, 'https://api.letbuyy.com/v1');
    assert.equal(normalizeLetbuyyApiBaseUrl('https://api.letbuyy.com'), 'https://api.letbuyy.com/v1');
    assert.equal(normalizeLetbuyyApiBaseUrl('https://api.letbuyy.com/v1/'), 'https://api.letbuyy.com/v1');
    assert.equal(normalizeLetbuyyApiBaseUrl('https://api.letbuyy.com/api'), 'https://api.letbuyy.com/api/v1');
    assert.equal(
        normalizeLetbuyyApiBaseUrl('https://api.letbuyy.com/api/v1', { includeVersionPath: false }),
        'https://api.letbuyy.com/api',
    );
    assert.equal(
        resolveLetbuyyApiBaseUrl([undefined, ''], { fallback: LETBUYY_PRODUCTION_API_BASE_URL }),
        LETBUYY_PRODUCTION_API_BASE_URL,
    );
    assert.throws(
        () => resolveLetbuyyApiBaseUrl([undefined], { requireConfigured: true, errorMessage: 'missing api' }),
        /missing api/,
    );
});

test('api-client path conversion strips the configured versioned base path', () => {
    assert.equal(
        apiClientInputToLetbuyyApiPath('https://api.letbuyy.com/v1/products?limit=10', 'https://api.letbuyy.com/v1'),
        '/products?limit=10',
    );
    assert.equal(
        apiClientInputToLetbuyyApiPath('https://api.letbuyy.com/api/v1/orders', 'https://api.letbuyy.com/api/v1'),
        '/orders',
    );
});

test('active app API wrappers import shared base and path helpers', () => {
    const baseWrapperFiles = [
        'apps/merchant-control-plane/src/lib/api/client.ts',
        'apps/storefront-runtime/src/lib/api/client.ts',
        'apps/identity-platform/src/lib/api/client.ts',
        'apps/app-marketplace/src/lib/api/client.ts',
        'apps/theme-marketplace/src/lib/api/client.ts',
        'apps/platform-console/src/lib/console-api.ts',
        'apps/platform-operations-portal/src/lib/api/client.ts',
        'apps/marketing-site/src/app/create/page.tsx',
    ];

    for (const file of baseWrapperFiles) {
        const source = read(file);
        assert.match(source, /resolveLetbuyyApiBaseUrl/);
        assert.doesNotMatch(source, /\bfunction\s+get(?:Public)?ApiBaseUrl\b/);
        assert.doesNotMatch(source, /\bDEFAULT_(?:PRODUCTION_)?API_BASE_URL\b/);
        assert.doesNotMatch(source, /path\.endsWith\('\/v1'\)/);
    }

    for (const file of [
        'apps/merchant-control-plane/src/lib/api/client.ts',
        'apps/storefront-runtime/src/lib/api/client.ts',
    ]) {
        const source = read(file);
        assert.match(source, /apiClientInputToLetbuyyApiPath/);
        assert.doesNotMatch(source, /\bfunction\s+apiClientInputTo[A-Za-z]+ApiPath\b/);
    }

    const browserClient = read('apps/storefront-runtime/src/lib/api/browser-client.ts');
    assert.match(browserClient, /apiClientInputToLetbuyyApiPath/);
    assert.match(browserClient, /resolveLetbuyyApiBaseUrl/);
    assert.match(browserClient, /`\/api\/storefront\/\$\{encodeURIComponent\(subdomain\)\}\$\{apiPath\}`/);
    assert.doesNotMatch(browserClient, /NEXT_PUBLIC_API_BASE_URL|NEXT_PUBLIC_API_URL|LETBUYY_PRODUCTION_API_BASE_URL/);
});

test('api-client base helper validator is wired into governance', () => {
    const marketingPackage = JSON.parse(read('apps/marketing-site/package.json'));
    const marketingManifest = JSON.parse(read('apps/marketing-site/runtime.manifest.json'));
    const validator = read('scripts/validators/api-client-runtime-base-validator.mjs');
    const governanceRunner = read('scripts/validate-governance.mjs');

    assert.equal(marketingPackage.dependencies['@letbuyy/api-client'], 'workspace:*');
    assert.ok(marketingManifest.allowedDependencies.workspacePackages.includes('@letbuyy/api-client'));
    assert.match(validator, /app API base URL and API-client path helpers/);
    assert.match(governanceRunner, /api-client-runtime-base-validator\.mjs/);
});
