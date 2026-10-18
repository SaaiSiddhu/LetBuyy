// Cross-artifact contract between migration 217 and the gateway routes that call it (phase MKT-1).
//
// Two wire contracts live across file boundaries and nothing else pins them:
//   1. transition_channel_listing is called POSITIONALLY from routes/channel-listings.ts through the
//      tenant transaction (sql.unsafe with $1..$7). Reorder one argument on either side and every
//      merchant transition silently writes the wrong site, actor or key — Postgres will not complain
//      about two uuids swapped. The parameter ORDER of 217's CREATE FUNCTION is therefore asserted
//      against the ORDER of the route's argument array, name by name.
//   2. marketplace_feed is called by NAMED parameters (PostgREST rpc) from the storefront's public
//      routes; a renamed key on either side fails at runtime with "function does not exist".
// The behavioural halves are services/api-gateway/src/__tests__/channel-listings.test.ts (routes
// driven through Hono with fakes) and tests/executable/marketplace-channel-listings-postgres.test.mjs
// (the RPCs on real Postgres). This half runs in the default gate with no database.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const MIGRATION = 'database/supabase/migrations/217_marketplace_channel_listings.sql';
const LISTINGS_ROUTE = 'services/api-gateway/src/routes/channel-listings.ts';
const PUBLIC_ROUTES = 'services/api-gateway/src/routes/storefront/public-routes.ts';
const SCHEMA = 'services/api-gateway/src/schemas/channel-listing.schema.ts';
const INDEX = 'services/api-gateway/src/index.ts';

function read(relativePath: string): string {
    const absolute = join(repoRoot, relativePath);
    assert.equal(existsSync(absolute), true, `${relativePath} must exist`);
    return readFileSync(absolute, 'utf8');
}

// Strip line comments so a comment quoting a shape can never satisfy an assertion about code.
function executableSql(source: string): string {
    return source.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n');
}
function executableTs(source: string): string {
    return source.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
}

function sqlParameterNames(migration: string, fn: string): string[] {
    const signature = migration.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\s*\\(([\\s\\S]*?)\\)\\s*RETURNS`));
    assert.ok(signature, `${MIGRATION} must declare CREATE OR REPLACE FUNCTION public.${fn}(...) RETURNS ...`);
    return [...signature[1].matchAll(/(p_[a-z_]+)\s+[a-z]/g)].map((m) => m[1]);
}

// The route's positional argument array, as the source tokens it binds, in order.
function routeTransitionArguments(route: string): string[] {
    const call = route.match(/sql\.unsafe\(TRANSITION_SQL,\s*\[([\s\S]*?)\]\)/);
    assert.ok(call, `${LISTINGS_ROUTE} must call sql.unsafe(TRANSITION_SQL, [ ... ])`);
    return call[1]
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);
}

// What each positional slot must carry, by 217's parameter name.
const TRANSITION_ARGUMENT_BY_PARAMETER: Record<string, RegExp> = {
    p_site_id: /^scope\.siteId$/,
    p_listing_id: /^id$/,
    p_to_status: /^body\.to_status$/,
    p_actor_realm: /^'merchant'$/,
    p_actor_id: /^scope\.customUser\.id$/,
    p_reason: /^body\.reason \?\? null$/,
    p_idempotency_key: /^body\.idempotency_key$/,
};

test('the merchant transition binds 217\'s seven parameters positionally, in the declared order, from the resolved scope', () => {
    const migration = executableSql(read(MIGRATION));
    const route = executableTs(read(LISTINGS_ROUTE));
    const sqlNames = sqlParameterNames(migration, 'transition_channel_listing');
    assert.deepEqual(sqlNames, ['p_site_id', 'p_listing_id', 'p_to_status', 'p_actor_realm', 'p_actor_id', 'p_reason', 'p_idempotency_key']);

    const args = routeTransitionArguments(route);
    assert.equal(args.length, sqlNames.length, 'the route must bind exactly as many arguments as the function declares');
    sqlNames.forEach((name, index) => {
        assert.match(args[index], TRANSITION_ARGUMENT_BY_PARAMETER[name], `positional slot ${index + 1} (${name}) must be bound from the right source`);
    });

    const sql = route.match(/export const TRANSITION_SQL = `([^`]+)`/);
    assert.ok(sql, 'TRANSITION_SQL must be a template literal');
    assert.match(sql[1], /public\.\$\{TRANSITION_CHANNEL_LISTING_RPC\}\(\$1, \$2, \$3, \$4, \$5, \$6, \$7\)$/, 'the SQL must bind $1..$7 and no more');
    assert.match(route, /export const TRANSITION_CHANNEL_LISTING_RPC = 'transition_channel_listing'/);
});

test('the public feed matches 272\'s origin-filter overload and preserves 217\'s compatibility signature', () => {
    const legacyNames = sqlParameterNames(executableSql(read(MIGRATION)), 'marketplace_feed');
    assert.deepEqual(legacyNames,['p_category_slug','p_search','p_limit','p_after_approved_at','p_after_id']);
    const migration = executableSql(read('database/supabase/migrations/272_marketplace_origin_filter.sql'));
    const publicRoutes = executableTs(read(PUBLIC_ROUTES));
    const sqlNames = sqlParameterNames(migration, 'marketplace_feed');
    assert.deepEqual(sqlNames,[...legacyNames,'p_country_of_origin']);
    const call = publicRoutes.match(/db\.rpc\(MARKETPLACE_FEED_RPC,\s*\{([\s\S]*?)\}\s*\)/);
    assert.ok(call, `${PUBLIC_ROUTES} must call db.rpc(MARKETPLACE_FEED_RPC, { ... })`);
    const keys = [...call[1].matchAll(/(p_[a-z_]+)\s*:/g)].map((m) => m[1]);
    // PostgREST passes a JSON object: order is irrelevant, any missing, extra or renamed key breaks the call.
    assert.deepEqual([...keys].sort(), [...sqlNames].sort());
    assert.match(publicRoutes, /export const MARKETPLACE_FEED_RPC = 'marketplace_feed'/);
});

test('the merchant listing routes have no service-role path and run everything inside the tenant transaction', () => {
    const route = executableTs(read(LISTINGS_ROUTE));
    assert.doesNotMatch(route, /getSupabaseAdmin/, 'no admin (service_role) client may appear in the merchant listing routes');
    assert.doesNotMatch(route, /db\.rpc\(/, 'the transition RPC must never be called over REST as service_role');
    assert.doesNotMatch(route, /\.from\('channel_listings'\)/, 'no PostgREST path to channel_listings');
    assert.match(route, /withResolvedTenantTx/, 'reads and writes go through the tenant transaction');
    assert.match(route, /TenantTransactionUnavailableError/, 'the unavailable-pooled-SQL case must be handled explicitly (503), never bypassed');
    // Every sql.unsafe call in the file happens inside a withResolvedTenantTx callback: no bare use.
    const bareUses = route.split('withResolvedTenantTx').length - 1;
    const unsafeUses = route.split('sql.unsafe(').length - 1;
    assert.ok(unsafeUses > 0 && bareUses >= 5, 'each route body opens the tenant transaction before issuing SQL');
});

test('the listing router is imported and mounted exactly once in the gateway', () => {
    const index = executableTs(read(INDEX));
    assert.equal(index.match(/import channelListingsRouter from '\.\/routes\/channel-listings'/g)?.length, 1);
    assert.equal(index.match(/api\.route\('\/channel-listings', channelListingsRouter\)/g)?.length, 1);
});

test('the zod vocabularies repeat 217\'s CHECK lists verbatim, and merchants can never request an operator edge', () => {
    const migration = executableSql(read(MIGRATION));
    const schema = executableTs(read(SCHEMA));
    const checkList = (column: string): string[] => {
        const match = migration.match(new RegExp(`CHECK \\(${column} IN \\(([^)]+)\\)\\)`));
        assert.ok(match, `217 must declare CHECK (${column} IN (...))`);
        return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    };
    const zodEnum = (name: string): string[] => {
        const match = schema.match(new RegExp(`export const ${name} = z\\.enum\\(\\[([^\\]]+)\\]\\)`));
        assert.ok(match, `${SCHEMA} must export ${name} as z.enum([...])`);
        return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    };
    assert.deepEqual(zodEnum('ChannelListingChannelSchema'), checkList('channel'));
    assert.deepEqual(zodEnum('ChannelListingStatusSchema'), checkList('status'));
    assert.deepEqual(zodEnum('ChannelListingVisibilitySchema'), checkList('visibility'));

    // Merchant edges per MARKETPLACE_CHANNEL_MODEL.md §4: the targets a merchant may name. `rejected`
    // is reachable only through an operator decision and must never be requestable here.
    const merchantTargets = zodEnum('MerchantTransitionTargetSchema');
    assert.deepEqual(merchantTargets, ['approved', 'delisted', 'draft', 'paused', 'pending_review']);
    assert.ok(!merchantTargets.includes('rejected'));
    // And the RPC's merchant branch agrees: 'rejected' appears only as a FROM state there.
    const merchantBranch = migration.match(/IF p_actor_realm = 'merchant' THEN\s+v_allowed :=([\s\S]*?);/);
    assert.ok(merchantBranch, '217 must carry the merchant edge matrix');
    assert.doesNotMatch(merchantBranch[1], /p_to_status = 'rejected'/);
    assert.doesNotMatch(merchantBranch[1], /p_to_status IN \([^)]*'rejected'/);
});

// ── ADM-1: the operator half ────────────────────────────────────────────────────────────────────
const OPERATOR_ROUTE = 'services/api-gateway/src/routes/operations/marketplace-listings.ts';

test('the operator decision passes exactly 217\'s parameter names by name, with the literal operator realm', () => {
    const migration = executableSql(read(MIGRATION));
    const route = executableTs(read(OPERATOR_ROUTE));
    const sqlNames = sqlParameterNames(migration, 'transition_channel_listing');
    // The TransitionParams type is the wire object handed to db.rpc — its keys are the contract.
    const typeBlock = route.match(/export type TransitionParams = \{([\s\S]*?)\};/);
    assert.ok(typeBlock, `${OPERATOR_ROUTE} must declare TransitionParams`);
    const keys = [...typeBlock[1].matchAll(/^\s*(p_[a-z_]+):/gm)].map((m) => m[1]);
    assert.deepEqual([...keys].sort(), [...sqlNames].sort(), 'named keys must equal the function\'s parameter names');
    assert.match(typeBlock[1], /p_actor_realm: 'operator'/, 'the realm is a literal type, not a free string');
    assert.match(route, /p_actor_realm: 'operator',/, 'the call site binds the literal operator realm');
    assert.doesNotMatch(route, /p_actor_realm: 'merchant'/, 'an operator route must never bind the merchant realm');
    assert.match(route, /db\.rpc\(TRANSITION_CHANNEL_LISTING_RPC, params\)/, 'the default dependency calls the RPC through the admin client with the named object');
});

test('an operator never acts inside a tenant transaction, every decision route is permission-gated, and the router is mounted once outside the kill switch', () => {
    const route = executableTs(read(OPERATOR_ROUTE));
    assert.doesNotMatch(route, /withResolvedTenantTx|resolveOwnedStoreScope|withTenantTx/, 'no tenant-transaction helper may be imported or called');
    for (const path of ['/:id/approve', '/:id/reject', '/:id/take-down']) {
        assert.match(route, new RegExp(`router\\.post\\('${path.replace(/\//g, '\\/')}', deps\\.permission\\('review:decide'\\)`), `${path} must require review:decide`);
    }
    assert.match(route, /router\.get\('\/', deps\.permission\('review:view'\)/);
    assert.match(route, /router\.get\('\/:id', deps\.permission\('review:view'\)/);
    assert.match(route, /permission: requirePermission,/, 'production wires rbac\'s requirePermission');
    assert.match(route, /validateSensitiveReason\(body\.reason\)/, 'negative decisions go through the shared reason rule');

    const index = executableTs(read(INDEX));
    assert.equal(index.match(/import operationsMarketplaceListingsRouter from '\.\/routes\/operations\/marketplace-listings'/g)?.length, 1);
    assert.equal(index.match(/api\.route\('\/operations\/marketplace-listings', operationsMarketplaceListingsRouter\)/g)?.length, 1);
    assert.doesNotMatch(index, /api\.use\('\/operations\/marketplace-listings[^']*', appPlatformKillSwitch\)/);
});

test('the operator decision targets are exactly 217\'s operator edges', () => {
    const migration = executableSql(read(MIGRATION));
    const route = executableTs(read(OPERATOR_ROUTE));
    const targets = route.match(/export const DECISION_TARGET[^=]*= \{([\s\S]*?)\};/);
    assert.ok(targets);
    const values = [...targets[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(values, ['approved', 'delisted', 'rejected']);
    const operatorBranch = migration.match(/ELSE\s+v_allowed :=([\s\S]*?);/);
    assert.ok(operatorBranch, '217 must carry the operator edge matrix');
    for (const target of values) {
        assert.ok(operatorBranch[1].includes(`'${target}'`), `217's operator branch must allow ${target}`);
    }
    assert.doesNotMatch(operatorBranch[1], /'pending_review'\)|'paused'|'draft'/, 'operator edges never move a listing back into merchant-owned states');
});

// ── ADM-3: marketplace_categories taxonomy management (operator realm) ─────────────────────────
const CATEGORIES_ROUTE = 'services/api-gateway/src/routes/operations/marketplace-categories.ts';

test('marketplace_categories is a service_role-only write table in 217, and the operator router calls it through the admin client, never a tenant transaction', () => {
    const migration = executableSql(read(MIGRATION));
    const route = executableTs(read(CATEGORIES_ROUTE));
    assert.match(migration, /CREATE POLICY service_role_marketplace_categories ON public\.marketplace_categories\s+FOR ALL TO service_role/, '217 must grant service_role the only write policy on this table');
    assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.marketplace_categories FROM app_tenant/, '217 must revoke merchant writes on this table');
    assert.match(route, /getSupabaseAdmin/, 'the router must write through the admin (service_role) client');
    assert.doesNotMatch(route, /withResolvedTenantTx|resolveOwnedStoreScope|withTenantTx/, 'no tenant-transaction helper may be imported or called');
});

test('the categories router requires review:view to list and review:decide to mutate, carries no DELETE route, and is mounted exactly once outside the kill switch', () => {
    const route = executableTs(read(CATEGORIES_ROUTE));
    assert.match(route, /router\.get\('\/', deps\.permission\('review:view'\)/);
    assert.match(route, /router\.post\('\/', deps\.permission\('review:decide'\)/);
    assert.match(route, /router\.patch\('\/:id', deps\.permission\('review:decide'\)/);
    assert.match(route, /permission: requirePermission,/, 'production wires rbac\'s requirePermission');
    assert.doesNotMatch(route, /router\.delete/, 'no DELETE route: both FKs onto this table are ON DELETE RESTRICT and unhandled by design this phase');

    const index = executableTs(read(INDEX));
    assert.equal(index.match(/import operationsMarketplaceCategoriesRouter from '\.\/routes\/operations\/marketplace-categories'/g)?.length, 1);
    assert.equal(index.match(/api\.route\('\/operations\/marketplace-categories', operationsMarketplaceCategoriesRouter\)/g)?.length, 1);
    assert.doesNotMatch(index, /api\.use\('\/operations\/marketplace-categories[^']*', appPlatformKillSwitch\)/);
});

test('the category schemas repeat 217\'s slug format CHECK verbatim, and the create/update bodies can never smuggle an id or mismatched field', () => {
    const migration = executableSql(read(MIGRATION));
    const schema = executableTs(read(SCHEMA));
    const migrationSlugCheck = migration.match(/CONSTRAINT marketplace_categories_slug_format_check CHECK \(slug ~ '([^']+)'\)/);
    assert.ok(migrationSlugCheck, '217 must declare the slug format CHECK');
    // The schema module declares one shared `slug` regex reused by both channel-listing and category schemas.
    const schemaSlugRegex = schema.match(/const slug = z\.string\(\)\.regex\(\/([^/]+)\//);
    assert.ok(schemaSlugRegex, `${SCHEMA} must declare a shared slug regex`);
    assert.equal(schemaSlugRegex[1], migrationSlugCheck[1], 'the zod slug pattern must equal 217\'s CHECK pattern exactly');

    assert.match(schema, /export const CreateMarketplaceCategorySchema = z\s*\.object\(\{[\s\S]*?\}\)\s*\.strict\(\)/, 'create must be .strict()');
    assert.doesNotMatch(schema.match(/export const CreateMarketplaceCategorySchema[\s\S]*?\.strict\(\);/)?.[0] ?? '', /is_active/, 'is_active is not a creatable field — a row is always active on creation');
    assert.match(schema, /export const UpdateMarketplaceCategorySchema = z\s*\.object\(\{[\s\S]*?\}\)\s*\.strict\(\)/, 'update must be .strict()');
    assert.doesNotMatch(schema.match(/export const UpdateMarketplaceCategorySchema[\s\S]*?message: 'nothing to update' \},\s*\);/)?.[0] ?? '', /slug:/, 'slug must be immutable after creation — Update must not accept it');
});

// ── MKT-2: the single-listing read must not drift from the feed ─────────────────────────────────
const DETAIL_ROUTE = 'services/api-gateway/src/routes/storefront/marketplace-detail-routes.ts';

// The WHERE predicates a public marketplace read applies, up to the first parameter-dependent clause.
function visibilityFence(migration: string, fn: string): string {
    const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`);
    assert.notEqual(start, -1, `${MIGRATION} must declare ${fn}`);
    const body = migration.slice(start);
    const where = body.indexOf('WHERE');
    assert.notEqual(where, -1, `${fn} must carry a WHERE clause`);
    const lines: string[] = [];
    for (const line of body.slice(where).split('\n')) {
        const trimmed = line.trim();
        // Stop at the first clause that depends on a parameter — everything above is the fence.
        if (trimmed.startsWith('AND (') || trimmed.startsWith('AND cl.id = p_listing_id') || trimmed.startsWith('ORDER BY') || trimmed.startsWith('LIMIT')) break;
        lines.push(line.trimEnd());
    }
    return lines.join('\n');
}

test('the listing detail and the feed apply a character-identical visibility fence', () => {
    const migrations = executableSql(read(MIGRATION)) + '\n' + executableSql(read('database/supabase/migrations/220_marketplace_listing_detail.sql'));
    const feedFence = visibilityFence(migrations, 'marketplace_feed');
    const detailFence = visibilityFence(migrations, 'marketplace_listing_detail');
    assert.ok(feedFence.includes("cl.status = 'approved'"), 'the feed fence must be recognisable');
    assert.equal(
        detailFence,
        feedFence,
        'a listing hidden from the grid must be unreachable by direct link, and one in the grid must open — two public reads that disagree about "visible" is the defect this pins',
    );
});

test('the listing detail returns no merchant-internal column and no unaudited variants blob', () => {
    const detail = executableSql(read('database/supabase/migrations/220_marketplace_listing_detail.sql'));
    const returns = detail.slice(detail.indexOf('RETURNS TABLE'), detail.indexOf('LANGUAGE sql'));
    for (const column of ['cost_price', 'cost_per_item', 'sku', 'barcode']) {
        assert.ok(!returns.includes(column), `${column} must not be in the public detail's return shape (SEC-1)`);
    }
    assert.ok(!/\bvariants\b/.test(returns), 'products.variants is an unaudited jsonb blob — a new public read must not carry it');
});

test('the detail route calls the RPC by its named parameter and is registered once', () => {
    const route = executableTs(read(DETAIL_ROUTE));
    assert.match(route, /export const MARKETPLACE_LISTING_DETAIL_RPC = 'marketplace_listing_detail'/);
    assert.match(route, /db\.rpc\(MARKETPLACE_LISTING_DETAIL_RPC, \{ p_listing_id: listingId \}\)/, 'named parameter, matching 220\'s declaration');
    assert.match(route, /router\.get\('\/marketplace\/listings\/:id'/);
    // An absent row is a 404; a query failure is a 500. Collapsing the two would hide a schema fault
    // behind an indistinguishable "not found" — the defect PHASE-T3 fixed on the storefront's own detail.
    assert.match(route, /if \(error\) return \{ status: 500/);
    assert.match(route, /status: 404/);
    const publicRoutes = executableTs(read(PUBLIC_ROUTES));
    assert.equal(publicRoutes.match(/registerStorefrontMarketplaceDetailRoutes\(router,/g)?.length, 1, 'registered exactly once');
});

test('MKT-3: the marketplace detail hydrates variants through the shared projection, and 220 still returns none', () => {
    const route = executableTs(read(DETAIL_ROUTE));
    // One definition of a public variant, shared with the storefront path (SEC-2). A second field
    // map here is the drift condition that produced SEC-1 and SEC-2 in the first place.
    assert.match(route, /import \{[^}]*\btoPublicVariant\b[^}]*\} from '\.\.\/\.\.\/lib\/public-product-view'/);
    const variants = route.match(/const publicVariants = [^\n]*\.map\(\(variant\) => \{([\s\S]*?)\n\s*\}\);/);
    assert.ok(variants,'every variant must pass through the canonical mapping callback');
    assert.match(variants[1],/return toPublicVariant\(withPublicPriceObservation\(variant, observation\)\);/,
        'every variant keeps truthful price evidence and the shared public-field projection');
    assert.doesNotMatch(route, /PUBLIC_VARIANT_SELECT[^;]*\b(sku|barcode)\b/, 'the variant select must not request sku or barcode');

    // The SQL shape stays free of variants: hydration belongs in the gateway, where the audited
    // projection lives. Widening 220 would smuggle the unaudited blob back in.
    const detail = executableSql(read('database/supabase/migrations/220_marketplace_listing_detail.sql'));
    const returns = detail.slice(detail.indexOf('RETURNS TABLE'), detail.indexOf('LANGUAGE sql'));
    assert.ok(!/\bvariants\b/.test(returns), 'migration 220 must still return no variants column');
});
