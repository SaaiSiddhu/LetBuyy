// SEC-1 — the always-on guard against merchant-internal product columns reaching anonymous callers.
//
// The storefront public router is mounted BEFORE authMiddleware, so every column its product selects
// name is served to whoever asks. That list carried cost_price, sku and barcode, and the handler
// returned the row as read; the behavioural half of this fix lives in
// services/api-gateway/src/__tests__/storefront-product-detail.test.ts, which drives the real router
// and asserts on the response body.
//
// This half needs no database and no fake, and exists because the leak survived seven passing
// end-to-end tests for one reason: their fixture set the sensitive fields to null. A guard that
// reads the source cannot be defeated that way. It fails if anyone re-adds one of these columns to a
// public select, reintroduces a wildcard select on products, or removes the projection.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const PUBLIC_ROUTES = 'services/api-gateway/src/routes/storefront/public-routes.ts';
const PRODUCT_VIEW = 'services/api-gateway/src/lib/public-product-view.ts';
const INDEX = 'services/api-gateway/src/index.ts';

// Margin data and stock-keeping identifiers. A shopper needs none of them to buy a product.
const MERCHANT_INTERNAL_COLUMNS = ['cost_price', 'cost_per_item', 'sku', 'barcode'] as const;

function read(relativePath: string): string {
    const absolute = join(repoRoot, relativePath);
    assert.equal(existsSync(absolute), true, `${relativePath} must exist`);
    return readFileSync(absolute, 'utf8');
}

function executableTs(source: string): string {
    return source.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
}

// Every `'a,b,c'` column-list literal assigned to a *_SELECT* constant, in either file. Scanning
// both means moving the list back into the router, or adding a second one anywhere, is still caught.
function productSelectLiterals(source: string): { name: string; columns: string[] }[] {
    return [...source.matchAll(/const (\w*SELECT\w*): string =\s*\n?\s*'([^']+)'/g)]
        .filter((match) => match[2].includes(','))
        .map((match) => ({ name: match[1], columns: match[2].split(',').map((column) => column.trim()) }));
}

test('the storefront public router is mounted before authMiddleware — which is why its selects are a security boundary', () => {
    const index = executableTs(read(INDEX));
    const mount = index.indexOf("api.route('/storefront', storefrontRouter)");
    const auth = index.indexOf("api.use('/*', authMiddleware)");
    assert.notEqual(mount, -1, 'the storefront router must be mounted');
    assert.notEqual(auth, -1, 'authMiddleware must be applied');
    assert.ok(
        mount < auth,
        'the storefront router is public by design; if this ever changes, revisit whether these column rules are still the right shape',
    );
});

test('no public product select names a merchant-internal column', () => {
    const selects = [
        ...productSelectLiterals(executableTs(read(PRODUCT_VIEW))),
        ...productSelectLiterals(executableTs(read(PUBLIC_ROUTES))),
    ];
    assert.ok(selects.length > 0, 'the public product column allowlist must exist as a literal');
    for (const select of selects) {
        for (const column of MERCHANT_INTERNAL_COLUMNS) {
            assert.ok(
                !select.columns.includes(column),
                `${select.name} must not request ${column}: this router is unauthenticated, so the column would be served to any visitor`,
            );
        }
    }
});

test('no public route selects every column from products', () => {
    const source = executableTs(read(PUBLIC_ROUTES));
    // `.select('*')` on a public read serves whatever the table happens to hold, including columns
    // added by future migrations that nobody reviewed against this boundary.
    // The select expression may be a ternary containing its own parentheses (`enabled(c.env) ? a : b`),
    // so this scans a bounded window of any characters rather than "up to the next paren" — an earlier
    // version stopped at `c.env)` and could therefore never fail, which is the defect class this file
    // exists to prevent.
    assert.doesNotMatch(
        source,
        /\.from\('products'\)[\s\S]{0,400}?\.select\([\s\S]{0,300}?'\*'/,
        'a public products read must name its columns explicitly, never \'*\'',
    );
});

test('the public product projection exists and is applied before serialisation', () => {
    const view = executableTs(read(PRODUCT_VIEW));
    const source = executableTs(read(PUBLIC_ROUTES));
    assert.match(view, /export const PUBLIC_PRODUCT_FIELDS: ReadonlySet<string>/, 'the response allowlist must exist');
    assert.match(view, /export function toPublicProduct/, 'the projection must exist');
    // The backstop is only a backstop if it actually wraps the response body.
    assert.match(
        source,
        /body: success\(toPublicProduct\(/,
        'the product detail response must be projected — the select list alone does not survive a hydration step attaching new keys',
    );
    for (const column of MERCHANT_INTERNAL_COLUMNS) {
        assert.ok(
            !new RegExp(`PUBLIC_PRODUCT_FIELDS[\\s\\S]{0,600}?'${column}'`).test(view),
            `${column} must not be added to the public field allowlist`,
        );
    }
});
