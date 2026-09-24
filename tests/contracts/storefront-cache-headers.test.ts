// APPID-P4c — what commerce/web's next.config tells caches, path by path.
//
// Found while building storefront sign-in: the "all pages" rule `/:path*` also matched /api/* and
// /_next/*, and a Cache-Control set in next.config wins over the one a route handler sets. So every
// storefront API answer, customer and buyer sessions and profiles included, went out
// `public, max-age=300, stale-while-revalidate=3600` whatever the route said; and in production the
// same rule cut Next's year-long immutable asset cache to five minutes.
//
// This evaluates the REAL config's rules with Next's own path matcher, in both environments, and
// asserts the Cache-Control each kind of path ends up with: the last matching rule that sets it wins.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const appRequire = createRequire(join(root, 'apps/commerce/web/package.json'));
const { getPathMatch } = appRequire('next/dist/shared/lib/router/utils/path-match') as {
    getPathMatch: (path: string, options?: { strict?: boolean; removeUnnamedParams?: boolean }) => (pathname: string) => unknown;
};

type Rule = { source: string; headers: { key: string; value: string }[] };

async function rules(nodeEnv: 'production' | 'development'): Promise<Rule[]> {
    const saved = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv;
    try {
        const config = (await import('../../apps/commerce/web/next.config')).default as { headers: () => Promise<Rule[]> };
        return await config.headers();
    } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = saved;
    }
}

function header(all: Rule[], pathname: string, key: string): string | undefined {
    let value: string | undefined;
    for (const rule of all) {
        if (!getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(pathname)) continue;
        const found = rule.headers.find((h) => h.key.toLowerCase() === key.toLowerCase());
        if (found) value = found.value;
    }
    return value;
}

const PAGE = 'public, max-age=300, stale-while-revalidate=3600';

test('API answers carry no caching directive from the config, in either environment', async () => {
    for (const env of ['production', 'development'] as const) {
        const all = await rules(env);
        for (const path of ['/api/buyer-auth/session', '/api/buyer-auth/start', '/api/customer/session', '/api/customer/profile', '/api/cart']) {
            assert.equal(header(all, path, 'Cache-Control'), undefined, `${env} ${path}: the route must decide`);
            assert.ok(header(all, path, 'X-Content-Type-Options'), `${env} ${path}: security headers still apply`);
        }
    }
});

test('pages keep their short public cache', async () => {
    const all = await rules('production');
    for (const path of ['/', '/products/handloom-kurta', '/collections/summer', '/store/store-one']) {
        assert.equal(header(all, path, 'Cache-Control'), PAGE, path);
    }
    // Paths that merely START with the excluded words are ordinary pages.
    assert.equal(header(all, '/apiary-honey', 'Cache-Control'), PAGE);
    assert.equal(header(all, '/_nextgen-shoes', 'Cache-Control'), PAGE);
});

test("Next's assets: immutable for a year in production, nothing from the config in development", async () => {
    const production = await rules('production');
    assert.equal(header(production, '/_next/static/chunks/app/layout-9f8e7d.js', 'Cache-Control'), 'public, max-age=31536000, immutable');
    assert.equal(header(production, '/_next/image', 'Cache-Control'), 'public, max-age=86400, stale-while-revalidate=604800');
    const development = await rules('development');
    assert.equal(header(development, '/_next/static/chunks/app/layout.js', 'Cache-Control'), undefined,
        'development chunks keep one name across versions, so any config cache shows a developer stale code');
});
