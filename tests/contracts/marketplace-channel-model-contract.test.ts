// Cross-artifact contract for migration 217 (phase MKT-0, docs/architecture/MARKETPLACE_CHANNEL_MODEL.md).
//
// marketplace_feed() is the ONE designed cross-tenant read in the schema: SECURITY DEFINER, callable by
// anon, joining three tenant-scoped tables. The thing that keeps it safe is not RLS (the definer bypasses
// it by design) but the column allowlist it returns. That allowlist is bounded by the storefront's own
// public product constant, PRODUCT_SELECT_FULL (services/api-gateway/src/routes/storefront.ts): the
// marketplace must never reveal a product column the merchant's storefront does not already reveal.
// Nothing else pins that relationship — a later "just add cost_price to the feed" would compile, deploy
// and leak. This test runs in the default gate with no database, so drift is caught on every run; the
// behavioural half (real Postgres, real roles, real RLS) is
// tests/executable/marketplace-channel-listings-postgres.test.mjs.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const MIGRATION = 'database/supabase/migrations/217_marketplace_channel_listings.sql';
const ROLLBACK = 'database/supabase/rollback/217_marketplace_channel_listings.rollback.sql';
const STOREFRONT = 'services/api-gateway/src/routes/storefront.ts';
const REGISTRY = 'services/api-gateway/src/tenant/tenant-tables.registry.ts';

// The allowlist MARKETPLACE_CHANNEL_MODEL.md §5.2 documents, by origin. Widening the feed means
// editing this test AND the document in the same change, which is the review moment this guard exists for.
// `currency` is in PRODUCT_SELECT_FULL but no migration ever added it to products (105 added it to
// marketplace_apps); the storefront only survives through its COMPAT/MINIMAL fallbacks. A SQL function
// is validated at creation, so the feed must not name it — see MARKETPLACE_CHANNEL_MODEL.md §5.2.
const PRODUCT_COLUMNS = ['product_id', 'name', 'slug', 'images', 'price', 'compare_price'];
// The exact RETURNS TABLE order the document and the migration share.
const FEED_ALLOWLIST = [
    'listing_id',
    'product_id',
    'site_id',
    'store_name',
    'subdomain',
    'name',
    'slug',
    'images',
    'price',
    'compare_price',
    'category_slug',
    'approved_at',
];
// Feed column -> products column it is read from (product_id is products.id).
const PRODUCT_SOURCE: Record<string, string> = {
    product_id: 'id',
    name: 'name',
    slug: 'slug',
    images: 'images',
    price: 'price',
    compare_price: 'compare_price',
};

const TENANT_TABLES = ['channel_listings', 'channel_listing_moderation_events'];
const ALL_TABLES = ['marketplace_categories', ...TENANT_TABLES];

function read(relativePath: string): string {
    const absolute = join(repoRoot, relativePath);
    assert.equal(existsSync(absolute), true, `${relativePath} must exist`);
    return readFileSync(absolute, 'utf8');
}

// The migration explains itself in `--` comments that quote the very shapes asserted below. Strip
// them so only SQL Postgres will run can satisfy an assertion.
function executableSql(source: string): string {
    return source
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n');
}

function feedReturnsTable(migration: string): string[] {
    const match = migration.match(
        /CREATE OR REPLACE FUNCTION public\.marketplace_feed\s*\([\s\S]*?\)\s*RETURNS TABLE\s*\(([\s\S]*?)\)\s*LANGUAGE/,
    );
    assert.ok(match, `${MIGRATION} must declare marketplace_feed(...) RETURNS TABLE (...)`);
    return [...match[1].matchAll(/^\s*([a-z_]+)\s+[a-z]/gm)].map((m) => m[1]);
}

function productSelectFull(storefront: string): string[] {
    const match = storefront.match(/const PRODUCT_SELECT_FULL: string =\s*'([^']+)'/);
    assert.ok(match, `${STOREFRONT} must declare PRODUCT_SELECT_FULL as a single-quoted column list`);
    return match[1].split(',').map((c) => c.trim());
}

function functionBody(migration: string, name: string): string {
    const match = migration.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\s*\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`));
    assert.ok(match, `${MIGRATION} must define ${name}() with a $$-quoted body`);
    return match[1];
}

test('marketplace_feed returns exactly the documented allowlist, and nothing the storefront does not already expose', () => {
    const migration = executableSql(read(MIGRATION));
    const returned = feedReturnsTable(migration);

    assert.deepEqual(returned, FEED_ALLOWLIST, 'the RETURNS TABLE list must equal MARKETPLACE_CHANNEL_MODEL.md §5.2, in order');

    const storefrontColumns = productSelectFull(read(STOREFRONT));
    for (const column of PRODUCT_COLUMNS) {
        const source = PRODUCT_SOURCE[column];
        assert.ok(
            storefrontColumns.includes(source),
            `feed column ${column} reads products.${source}, which PRODUCT_SELECT_FULL does not expose on the storefront`,
        );
    }

    // The SELECT list must read product values only through the aliased product columns above —
    // a raw `p.<anything>` that is not in PRODUCT_SOURCE is a leak even if the RETURNS TABLE looks right.
    const body = functionBody(migration, 'marketplace_feed');
    const productReads = [...body.matchAll(/\bp\.([a-z_]+)/g)].map((m) => m[1]);
    const allowedProductReads = new Set([...Object.values(PRODUCT_SOURCE), 'is_active', 'deleted_at']);
    for (const column of productReads) {
        assert.ok(allowedProductReads.has(column), `marketplace_feed reads products.${column}, which is neither an allowlisted output nor a visibility filter`);
    }

    // Every products column the feed reads must actually exist in the schema: the baseline CREATE TABLE
    // or a later ALTER TABLE public.products ADD COLUMN. PRODUCT_SELECT_FULL is not proof of existence
    // (it names `currency`, which no migration ever added to products), and a SQL function that names a
    // missing column fails at CREATE FUNCTION time — in production, not in a unit test.
    const migrations = readdirSync(join(repoRoot, 'database/supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
    const baseline = read('database/supabase/migrations/000_baseline.sql');
    const productsDdl = baseline.match(/CREATE TABLE public\.products \(([\s\S]*?)\n\);/);
    assert.ok(productsDdl, '000_baseline.sql must define CREATE TABLE public.products');
    const knownProductColumns = new Set([...productsDdl[1].matchAll(/^\s+([a-z_]+) /gm)].map((m) => m[1]));
    for (const file of migrations) {
        const text = executableSql(read(`database/supabase/migrations/${file}`));
        for (const alter of text.matchAll(/ALTER TABLE (?:ONLY )?public\.products\b([\s\S]*?);/g)) {
            for (const added of alter[1].matchAll(/ADD COLUMN (?:IF NOT EXISTS )?([a-z_]+)/g)) knownProductColumns.add(added[1]);
        }
    }
    for (const column of new Set(productReads)) {
        assert.ok(knownProductColumns.has(column), `marketplace_feed reads products.${column}, but no migration defines that column`);
    }
});

test('marketplace_feed mirrors the storefront visibility filters and never invents a stricter or looser rule', () => {
    const body = functionBody(executableSql(read(MIGRATION)), 'marketplace_feed');
    for (const filter of [
        "cl.channel = 'marketplace'",
        "cl.status = 'approved'",
        "cl.visibility = 'public'",
        'p.is_active = true',
        'p.deleted_at IS NULL',
        "s.status = 'published'",
        's.deleted_at IS NULL',
    ]) {
        assert.ok(body.includes(filter), `marketplace_feed must filter on ${filter}`);
    }
    assert.doesNotMatch(body, /p\.status\s*=/, 'the storefront applies no products.status filter (storefront.ts:706); the feed must not either');
    assert.match(body, /LIMIT GREATEST\(1, LEAST\(COALESCE\(p_limit, 20\), 100\)\)/, 'the page size must be clamped to 1..100');
    assert.match(body, /ORDER BY cl\.approved_at DESC, cl\.id DESC/, 'keyset pagination needs a total order on (approved_at, id)');
});

test('every new table has RLS ENABLE + FORCE, the moderation log is append-only, and no non-service policy is USING (true)', () => {
    const migration = executableSql(read(MIGRATION));

    for (const table of ALL_TABLES) {
        assert.ok(migration.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`), `${table} must ENABLE RLS`);
        assert.ok(migration.includes(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`), `${table} must FORCE RLS`);
    }
    for (const table of TENANT_TABLES) {
        assert.match(
            migration,
            new RegExp(`CREATE POLICY [a-z_]+ ON public\\.${table}\\s+FOR (ALL|SELECT) TO app_tenant, authenticated\\s+USING \\(site_id = public\\.current_site_id\\(\\)\\)`),
            `${table} must scope reads to site_id = current_site_id() for app_tenant and authenticated`,
        );
    }

    // USING (true) may only ever be granted to service_role (163's shape). Anything else is ART-09 / R-3.
    for (const policy of migration.matchAll(/CREATE POLICY [a-z_]+ ON public\.[a-z_]+\s+FOR [A-Z]+ TO ([a-z_, ]+)\s+USING \(true\)/g)) {
        assert.equal(policy[1].trim(), 'service_role', `USING (true) reaches ${policy[1].trim()} — only service_role may have it`);
    }

    assert.match(
        migration,
        /REVOKE UPDATE, DELETE ON public\.channel_listing_moderation_events FROM PUBLIC;/,
        'the moderation log must revoke UPDATE/DELETE from PUBLIC',
    );
    assert.match(
        migration,
        /FOREACH v_role IN ARRAY ARRAY\['anon', 'authenticated', 'service_role', 'app_tenant'\] LOOP\s+IF EXISTS[\s\S]*?REVOKE UPDATE, DELETE ON public\.channel_listing_moderation_events FROM %I/,
        'the moderation log must revoke UPDATE/DELETE from every role, app_tenant included (164 default privileges)',
    );
    assert.doesNotMatch(
        migration,
        /CREATE POLICY [a-z_]+ ON public\.channel_listing_moderation_events\s+FOR (UPDATE|DELETE|ALL) TO (app_tenant|authenticated)/,
        'no merchant-realm policy may allow UPDATE or DELETE on the moderation log',
    );
});

test('transition_channel_listing locks before it looks, fences the realms, and is not callable by anon', () => {
    const migration = executableSql(read(MIGRATION));
    const body = functionBody(migration, 'transition_channel_listing');

    const lockAt = body.indexOf('pg_advisory_xact_lock(hashtextextended(');
    const lookupAt = body.indexOf('FROM public.channel_listing_moderation_events');
    assert.ok(lockAt > 0 && lookupAt > 0, 'the RPC must take the advisory lock and look up the idempotency key');
    assert.ok(lockAt < lookupAt, 'the advisory lock must be taken BEFORE the idempotency lookup (206:114 pattern)');

    assert.match(body, /public\.current_site_id\(\) <> p_site_id/, 'merchant edges must be bound to the tenant GUC');
    assert.match(body, /current_user = 'app_tenant'/, 'operator edges must be refused when the effective role is app_tenant');
    assert.match(body, /set_config\('app\.channel_listing_transition', 'rpc', true\)/, 'the RPC must set the marker the status trigger checks');
    assert.match(migration, /BEFORE UPDATE OF status ON public\.channel_listings/, 'a status trigger must exist so direct UPDATEs cannot skip the event log');

    assert.match(
        migration,
        /REVOKE ALL ON FUNCTION public\.transition_channel_listing\(uuid, uuid, text, text, uuid, text, text\) FROM PUBLIC;/,
    );
    assert.match(
        migration,
        /FOREACH v_role IN ARRAY ARRAY\['app_tenant', 'authenticated', 'service_role'\] LOOP\s+IF EXISTS[\s\S]*?GRANT EXECUTE ON FUNCTION public\.transition_channel_listing/,
        'only app_tenant, authenticated and service_role may execute the transition RPC',
    );
    assert.match(
        migration,
        /FOREACH v_role IN ARRAY ARRAY\['anon', 'authenticated', 'app_tenant', 'service_role'\] LOOP\s+IF EXISTS[\s\S]*?GRANT EXECUTE ON FUNCTION public\.marketplace_feed/,
        'anon must be able to execute the feed (the one designed cross-tenant read)',
    );
});

test('both tenant tables are in the generated registry with site_id as the tenant column', () => {
    const registry = read(REGISTRY);
    for (const table of TENANT_TABLES) {
        const entry = registry.match(new RegExp(`"table": "${table}",\\s*"scopeColumns": \\[([\\s\\S]*?)\\],\\s*"tenantColumn": "([a-z_]+)"`));
        assert.ok(entry, `${REGISTRY} must list ${table} — run scripts/generators/generate-tenant-table-registry.mjs`);
        assert.equal(entry[2], 'site_id', `${table} must be tenant-scoped by site_id`);
    }
    assert.doesNotMatch(registry, /"table": "marketplace_categories"/, 'the platform taxonomy has no site_id and must not be registered as a tenant table');
});

test('the rollback drops exactly what 217 created, with full function signatures', () => {
    const rollback = executableSql(read(ROLLBACK));
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.marketplace_feed\(text, text, integer, timestamp with time zone, uuid\);/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.transition_channel_listing\(uuid, uuid, text, text, uuid, text, text\);/);
    for (const table of ALL_TABLES) {
        assert.match(rollback, new RegExp(`DROP TABLE IF EXISTS public\\.${table};`));
    }
    // Dependency order: events before listings before categories.
    const order = ['channel_listing_moderation_events', 'channel_listings', 'marketplace_categories'].map((t) => rollback.indexOf(`DROP TABLE IF EXISTS public.${t};`));
    assert.ok(order[0] < order[1] && order[1] < order[2], 'tables must be dropped in reverse dependency order');
    assert.doesNotMatch(rollback, /products|sites\b/, 'the rollback must not touch products or sites');
});
