import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('store publish updates only owned sites to published with a timestamp', () => {
    const routeSource = source('routes/stores.ts');

    assert.match(routeSource, /router\.post\('\/:id\/publish'/);
    assert.match(routeSource, /status:\s*'published'/);
    assert.match(routeSource, /published_at:\s*new Date\(\)\.toISOString\(\)/);
    assert.match(routeSource, /\.eq\('id',\s*storeId\)/);
    assert.match(routeSource, /\.or\(`custom_user_id\.eq\.\$\{customUser\.id\},user_id\.eq\.\$\{customUser\.id\}`\)/);
    assert.match(routeSource, /Store not found or not owned by you/);
});

test('public storefront resolver only exposes published stores by handle', () => {
    const routeSource = source('routes/storefront.ts');

    assert.match(routeSource, /function normalizeStoreHandle/);
    assert.match(routeSource, /\.or\(`subdomain\.eq\.\$\{normalized\},store_name\.eq\.\$\{normalized\}`\)/);
    assert.match(routeSource, /if \(options\.publishedOnly\) query = query\.eq\('status',\s*'published'\)/);
    assert.match(routeSource, /router\.get\('\/:subdomain'/);
    assert.match(routeSource, /loadSiteByHandle\(c,\s*c\.req\.param\('subdomain'\),\s*\{ publishedOnly:\s*true \}\)/);
});

test('merchant publish proxy requires session and encodes store ids', () => {
    const routeSource = repositorySource('apps/merchant-control-plane/src/app/api/themes/publish/route.ts');

    assert.match(routeSource, /const encodedStoreId = encodeURIComponent\(storeId\)/);
    assert.match(routeSource, /workerFetch\(`\/stores\/\$\{encodedStoreId\}\/publish`,\s*\{\s*method:\s*'POST',\s*requireSession:\s*true/);
    assert.match(routeSource, /workerFetch\(`\/stores\/\$\{encodedStoreId\}`,\s*\{\s*method:\s*'PATCH',\s*requireSession:\s*true/);
});

test('storefront proxy rewrites local wildcard hosts into store routes', () => {
    const proxySource = repositorySource('apps/storefront-runtime/src/proxy.ts');

    assert.match(proxySource, /hostname\.includes\('localhost'\)/);
    assert.match(proxySource, /subdomain = parts\[0\]/);
    assert.match(proxySource, /NextResponse\.rewrite\(new URL\(`\/store\/\$\{subdomain\}\$\{path\}`,\s*req\.url\)\)/);
    assert.match(proxySource, /path\.startsWith\('\/store\/'\)/);
});
