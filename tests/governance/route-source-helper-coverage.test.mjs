// The source-contract tests search route files through tests/helpers/app-store-route-source.mjs. The
// lists that helper used to keep by hand drifted: the blog routes (storefront-blog-routes.ts) and the
// app-lifecycle, growth and pricing-plan modules were never in them, so a marker that lives in a split-out
// module made a correct test go red (storefront-cache's blog keys and tags), and a "must not contain"
// check silently skipped whole files. This pins the property the helper exists to give: what it returns
// is the root module plus EVERY module beside it.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readAppStoreRouteSource, readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function assertEveryModuleIsSearched(source, rootFile, directory) {
    const files = [rootFile, ...readdirSync(join(repoRoot, directory)).filter((name) => name.endsWith('.ts')).map((name) => `${directory}/${name}`)];
    assert.ok(files.length > 3, `${directory} has route modules to search`);
    for (const file of files) {
        assert.ok(source.includes(readFileSync(join(repoRoot, file), 'utf8')), `${file} must be part of the searched route source`);
    }
}

test('the storefront route source includes the root module and every module beside it', () => {
    assertEveryModuleIsSearched(readStorefrontRouteSource(), 'services/api-gateway/src/routes/storefront.ts', 'services/api-gateway/src/routes/storefront');
    assert.ok(readStorefrontRouteSource().includes("storefrontRequestCacheKey(c, 'blog'"), 'the blog routes are searched');
});

test('the app-store route source includes the root module and every module beside it', () => {
    assertEveryModuleIsSearched(readAppStoreRouteSource(), 'services/api-gateway/src/routes/app-store.ts', 'services/api-gateway/src/routes/app-store');
});
