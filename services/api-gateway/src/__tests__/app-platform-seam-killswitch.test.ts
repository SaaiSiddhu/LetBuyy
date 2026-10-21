import { createTestAdmissionCoordinator } from './helpers/admission-coordinator';
/**
 * ART-22 / ART-16 / NEVER-R3 — app-platform kill switch, SEAM coverage.
 *
 * Companion to app-platform-killswitch.test.ts, which proves the /v1/app-store + /v1/app
 * MOUNT PREFIXES are unreachable. This file closes the adversarially-found gap in that
 * proof: the frozen app platform is ALSO read from three other seams that the prefix
 * middleware can never reach.
 *
 *   SEAM 1 (public, unauthenticated, PRODUCTION shape) — GET /v1/storefront/:subdomain,
 *           GET /v1/storefront/store/:storeId and GET /v1/storefront/:subdomain/theme-preview
 *           all call loadPublicStorefrontAppBlocks (routes/storefront.ts), which reads
 *           app_extension_registrations + app_installations -> marketplace_apps ->
 *           app_extensions and returns third-party blocks with render_mode 'iframe' and an
 *           attacker-controlled iframe_url that the storefront runtime then renders.
 *   SEAM 2 (public, unauthenticated, STAGING shape) — GET /v1/storefront/:subdomain/checkout/extensions
 *           returned the third-party checkout-UI extension registry (source_url, scopes,
 *           capabilities). It was gated ONLY by FEATURE_EXTENSIONS, which is "true" in both
 *           [vars] and [env.staging.vars] and whose unset branch in middleware/featureFlags.ts
 *           is fail-OPEN — the exact defect the kill switch exists to close.
 *   SEAM 3 (operator plane) — /v1/operations/marketplace-reviews/** (writes
 *           marketplace_apps.status = published) and /v1/operations/developers/**
 *           (app_developers moderation, partner_payout_ledger_entries release, payout_disputes).
 *
 * Each test below FAILED (proving it detects the defect) against commit ed6e5167 before the
 * seam gate was added.
 *
 * STRICTLY OFFLINE. globalThis.fetch is replaced before any application import; the only
 * answered origin is an in-process PostgREST stub. Every other egress attempt is recorded
 * and asserted to be zero, so no socket is ever opened and no database is contacted.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');

// ── Offline guard + table-recording PostgREST stub ─────────────────────────────
// Installed BEFORE any application module is imported.
const egressAttempts: string[] = [];
let tablesQueried: string[] = [];

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const APP_ID = '33333333-3333-4333-8333-333333333333';

const SITE_ROW = {
    id: SITE_ID,
    subdomain: 'demo',
    store_name: 'Demo Store',
    status: 'published',
    deleted_at: null,
};

// A hostile third-party app block: this is exactly what leaked to unauthenticated
// production callers before the seam gate.
const APP_INSTALLATION_ROW = {
    id: '22222222-2222-4222-8222-222222222222',
    app_id: APP_ID,
    store_id: SITE_ID,
    status: 'active',
    config: { default_app_block_slot: 'storefront.home.after-hero' },
    marketplace_apps: {
        id: APP_ID,
        name: 'Third Party App',
        slug: 'third-party-app',
        app_url: 'https://third-party.invalid',
        app_extensions: [
            {
                id: '44444444-4444-4444-8444-444444444444',
                type: 'storefront_block',
                target: 'https://third-party.invalid/block',
                label: 'Third Party Block',
                sort_order: 1,
                config: {
                    render_mode: 'iframe',
                    iframe_url: 'https://third-party.invalid/block',
                    slot: 'storefront.home.after-hero',
                    title: 'Third Party Block',
                },
            },
        ],
    },
};

const CHECKOUT_EXTENSION_ROW = {
    id: '55555555-5555-4555-8555-555555555555',
    site_id: SITE_ID,
    app_id: APP_ID,
    installation_id: APP_INSTALLATION_ROW.id,
    extension_handle: 'checkout-upsell',
    extension_type: 'ui_extension',
    surface: 'checkout.ui',
    target: 'checkout.summary',
    renderer: 'iframe',
    source_url: 'https://third-party.invalid/checkout-ext.js',
    source_entrypoint: 'main.js',
    scopes: ['read_orders'],
    capabilities: ['network'],
    settings: {},
    manifest_schema_version: '1.0.0',
    app_version: '1.0.0',
    status: 'enabled',
    sort_order: 1,
};

const THEME_APP_BLOCK_ROW = {
    ...CHECKOUT_EXTENSION_ROW,
    id: '66666666-6666-4666-8666-666666666666',
    surface: 'theme.app_block',
    target: 'storefront.home.after-hero',
    extension_handle: 'home-banner',
};

/** Every table that belongs to the frozen app platform. */
const APP_PLATFORM_TABLES = [
    'marketplace_apps',
    'app_installations',
    'app_extensions',
    'app_extension_registrations',
    'app_developers',
    'app_billing_charges',
    'app_webhooks',
    'partner_payout_ledger_entries',
    'payout_disputes',
    'marketplace_review_records',
];

globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : ((input as Request)?.url ?? String(input));
    if (!url.startsWith('http://supabase.seam.test')) {
        egressAttempts.push(`${init?.method ?? 'GET'} ${url}`);
        throw new Error(`NETWORK_EGRESS_BLOCKED_BY_TEST: ${url}`);
    }

    const parsed = new URL(url);
    const table = parsed.pathname.replace('/rest/v1/', '');
    tablesQueried.push(table);

    const headers = new Headers((init?.headers as HeadersInit) ?? (input as Request)?.headers ?? {});
    const wantsSingle = (headers.get('accept') ?? '').includes('pgrst.object');

    let rows: unknown[] = [];
    if (table === 'sites') rows = [SITE_ROW];
    else if (table === 'app_installations') rows = [APP_INSTALLATION_ROW];
    else if (table === 'app_extension_registrations') {
        rows = url.includes('checkout.ui') ? [CHECKOUT_EXTENSION_ROW] : [THEME_APP_BLOCK_ROW];
    }

    return new Response(wantsSingle ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows), {
        status: 200,
        headers: {
            'content-type': 'application/json',
            'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
        },
    });
}) as typeof fetch;

function makeMemoryKv(): KVNamespace {
    const store = new Map<string, { value: string; expiresAt: number | null }>();
    return {
        async get(key: string, type?: unknown) {
            const hit = store.get(key);
            if (!hit) return null;
            if (hit.expiresAt !== null && hit.expiresAt < Date.now()) {
                store.delete(key);
                return null;
            }
            if (type === 'json' || (type as { type?: string })?.type === 'json') return JSON.parse(hit.value);
            return hit.value;
        },
        async put(key: string, value: string, opts?: { expirationTtl?: number }) {
            const ttl = opts?.expirationTtl;
            store.set(key, { value: String(value), expiresAt: ttl ? Date.now() + ttl * 1000 : null });
        },
        async delete(key: string) {
            store.delete(key);
        },
        async list() {
            return { keys: [...store.keys()].map((name) => ({ name })), list_complete: true, cursor: '' };
        },
        async getWithMetadata(key: string) {
            return { value: await (this as unknown as KVNamespace).get(key), metadata: null };
        },
    } as unknown as KVNamespace;
}

// Env shapes taken VERBATIM from services/api-gateway/wrangler.toml.
const STAGING_VARS: Record<string, string> = {
    ENVIRONMENT: 'staging',
    APP_ENV: 'staging',
    NODE_ENV: 'production',
    NEXT_PUBLIC_ENV: 'staging',
    WORKER_ENV: 'staging',
    DEPLOYMENT_ENV: 'staging',
    TELEMETRY_ENV: 'staging',
    FEATURE_GRAPHQL: 'true',
    FEATURE_EXTENSIONS: 'true',
    FEATURE_LIQUID: 'true',
    FEATURE_AI_CREDIT_PURCHASE: 'false',
    RATE_LIMIT_KV_FALLBACK: 'on',
};

const PRODUCTION_VARS: Record<string, string> = {
    ENVIRONMENT: 'production',
    APP_ENV: 'production',
    NODE_ENV: 'production',
    NEXT_PUBLIC_ENV: 'production',
    WORKER_ENV: 'production',
    DEPLOYMENT_ENV: 'production',
    TELEMETRY_ENV: 'production',
    FEATURE_GRAPHQL: 'false',
    FEATURE_EXTENSIONS: 'false',
    FEATURE_LIQUID: 'false',
    FEATURE_AI_CREDIT_PURCHASE: 'false',
    RATE_LIMIT_KV_FALLBACK: 'on',
};

const DEVELOPER_VARS: Record<string, string> = {
    ENVIRONMENT: 'development',
    APP_ENV: 'development',
    NODE_ENV: 'development',
    RATE_LIMIT_KV_FALLBACK: 'on',
};

// The top-level wrangler.toml [vars] block — what `wrangler deploy` with no --env uses.
const DEFAULT_VARS: Record<string, string> = {
    ENVIRONMENT: 'development',
    APP_ENV: 'development',
    NODE_ENV: 'production',
    FEATURE_GRAPHQL: 'true',
    FEATURE_EXTENSIONS: 'true',
    FEATURE_LIQUID: 'true',
    RATE_LIMIT_KV_FALLBACK: 'on',
};

function buildEnv(vars: Record<string, string>): Record<string, unknown> {
    // NOTE: FEATURE_APP_PLATFORM is deliberately ABSENT unless a shape sets it.
    return {
        ...vars,
        SUPABASE_URL: 'http://supabase.seam.test',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-not-a-real-secret',
        SUPABASE_ANON_KEY: 'test-anon-key-not-a-real-secret',
        CACHE: makeMemoryKv(),
        RUNTIME_COORDINATOR: createTestAdmissionCoordinator(),
    };
}

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };

interface GatewayHandler {
    fetch: (request: Request, env: unknown, executionContext: unknown) => Promise<Response>;
}

// Loaded dynamically (and lazily, once) so the offline guard above is already installed
// when application module-level code runs.
let loaded: Promise<GatewayHandler> | null = null;
function loadGateway() {
    if (!loaded) {
        loaded = import('../index.ts').then((m) => m.default as GatewayHandler);
    }
    return loaded;
}

let requestCounter = 0;

async function call(
    env: Record<string, unknown>,
    method: string,
    path: string,
): Promise<{ status: number; code: string; json: Record<string, unknown> | null; body: string }> {
    const handler = await loadGateway();
    requestCounter += 1;
    tablesQueried = [];
    const headers: Record<string, string> = {
        // Unique client key per request so a shared rate-limit bucket cannot
        // masquerade as the kill switch.
        'CF-Connecting-IP': `198.51.100.${requestCounter % 250}${requestCounter}`,
        origin: 'https://demo.letbuyy.com',
    };
    const init: RequestInit = { method, headers };
    if (method !== 'GET' && method !== 'HEAD') {
        headers['content-type'] = 'application/json';
        init.body = JSON.stringify({});
    }
    const response = await handler.fetch(new Request(`https://gateway.seam.test${path}`, init), env, ctx);
    const body = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
        json = JSON.parse(body) as Record<string, unknown>;
    } catch {
        json = null;
    }
    const code =
        ((json?.error as { code?: string } | undefined)?.code ?? (json as { code?: string } | null)?.code ?? '') || '';
    return { status: response.status, code, json, body: body.slice(0, 400) };
}

function appPlatformTablesTouched(): string[] {
    return [...new Set(tablesQueried.filter((table) => APP_PLATFORM_TABLES.includes(table)))];
}

const FAIL_CLOSED_SHAPES: { name: string; vars: Record<string, string> }[] = [
    { name: 'developer shape (flag absent)', vars: DEVELOPER_VARS },
    { name: 'wrangler top-level [vars] verbatim (flag absent)', vars: DEFAULT_VARS },
    { name: 'wrangler [env.staging.vars] verbatim (flag absent)', vars: STAGING_VARS },
    { name: 'wrangler [env.production.vars] verbatim (flag absent)', vars: PRODUCTION_VARS },
    { name: 'production vars + FEATURE_APP_PLATFORM="false"', vars: { ...PRODUCTION_VARS, FEATURE_APP_PLATFORM: 'false' } },
    { name: 'staging vars + FEATURE_APP_PLATFORM="" (empty)', vars: { ...STAGING_VARS, FEATURE_APP_PLATFORM: '' } },
    { name: 'staging vars + FEATURE_APP_PLATFORM="maybe" (malformed)', vars: { ...STAGING_VARS, FEATURE_APP_PLATFORM: 'maybe' } },
];

// ── SEAM 1: the public storefront app-block reader ──────────────────────────────

const STOREFRONT_APP_BLOCK_ROUTES = [
    `/v1/storefront/${SITE_ROW.subdomain}`,
    `/v1/storefront/store/${SITE_ID}`,
];

for (const shape of FAIL_CLOSED_SHAPES) {
    test(`SEAM 1 — public storefront serves NO marketplace app blocks and queries NO app-platform table — ${shape.name}`, async () => {
        const env = buildEnv(shape.vars);
        for (const path of STOREFRONT_APP_BLOCK_ROUTES) {
            const result = await call(env, 'GET', path);
            const touched = appPlatformTablesTouched();

            assert.equal(
                result.status,
                200,
                `GET ${path} should stay a working public storefront route, got ${result.status} ${result.body}`,
            );

            const data = (result.json?.data ?? {}) as { app_blocks?: unknown };
            assert.ok(
                Array.isArray(data.app_blocks),
                `GET ${path} should still return an app_blocks array (contract preserved), got ${JSON.stringify(data.app_blocks)}`,
            );
            assert.deepEqual(
                data.app_blocks,
                [],
                `GET ${path} LEAKED third-party marketplace app blocks under "${shape.name}": ${JSON.stringify(data.app_blocks)}`,
            );
            assert.doesNotMatch(
                result.body,
                /third-party\.invalid/,
                `GET ${path} leaked a third-party app URL under "${shape.name}"`,
            );
            assert.deepEqual(
                touched,
                [],
                `GET ${path} queried app-platform tables [${touched.join(', ')}] under "${shape.name}" — the gate must short-circuit BEFORE the read`,
            );
        }
    });
}

// ── SEAM 2: the public checkout-UI extension registry ───────────────────────────

for (const shape of FAIL_CLOSED_SHAPES) {
    test(`SEAM 2 — /storefront/:subdomain/checkout/extensions is 404 APP_PLATFORM_DISABLED — ${shape.name}`, async () => {
        const env = buildEnv(shape.vars);
        const result = await call(env, 'GET', `/v1/storefront/${SITE_ROW.subdomain}/checkout/extensions`);
        assert.equal(
            result.status,
            404,
            `expected 404 under "${shape.name}", got ${result.status} ${result.body}`,
        );
        assert.equal(
            result.code,
            'APP_PLATFORM_DISABLED',
            `the APP PLATFORM (not FEATURE_EXTENSIONS) must own this route. Under "${shape.name}" got code "${result.code}" ${result.body}`,
        );
        const touched = appPlatformTablesTouched();
        assert.deepEqual(
            touched,
            [],
            `checkout/extensions queried app-platform tables [${touched.join(', ')}] under "${shape.name}"`,
        );
    });
}

test('SEAM 2 regression witness: the staging shape (FEATURE_EXTENSIONS="true") is the one that used to leak', async () => {
    // Records the exact defect: with FEATURE_EXTENSIONS="true" the old gate let this
    // route run. If the kill switch is ever removed from this path the assertion below
    // fails with EXTENSIONS_DISABLED or 200, not with APP_PLATFORM_DISABLED.
    assert.equal(STAGING_VARS.FEATURE_EXTENSIONS, 'true');
    const result = await call(buildEnv(STAGING_VARS), 'GET', `/v1/storefront/${SITE_ROW.subdomain}/checkout/extensions`);
    assert.equal(result.code, 'APP_PLATFORM_DISABLED', `got ${result.status} ${result.body}`);
    assert.doesNotMatch(result.body, /third-party\.invalid/);
});

// ── SEAM 3: the operator plane ─────────────────────────────────────────────────

const OPERATOR_ROUTES: { method: string; path: string; why: string }[] = [
    { method: 'GET', path: '/v1/operations/marketplace-reviews', why: 'marketplace review queue' },
    { method: 'GET', path: `/v1/operations/marketplace-reviews/${SITE_ID}`, why: 'marketplace review record' },
    { method: 'POST', path: `/v1/operations/marketplace-reviews/${SITE_ID}/decision`, why: 'APPROVE/PUBLISH a third-party app (writes marketplace_apps.status)' },
    { method: 'POST', path: `/v1/operations/marketplace-reviews/${SITE_ID}/claim`, why: 'claim a listing review' },
    { method: 'POST', path: `/v1/operations/marketplace-reviews/${SITE_ID}/run-checks`, why: 'run listing checks' },
    { method: 'GET', path: '/v1/operations/developers/search', why: 'developer back office' },
    { method: 'GET', path: `/v1/operations/developers/${SITE_ID}/overview`, why: 'developer overview' },
    { method: 'POST', path: `/v1/operations/developers/${SITE_ID}/moderation`, why: 'moderate a developer (writes app_developers)' },
    { method: 'POST', path: `/v1/operations/developers/${SITE_ID}/payouts/${APP_ID}/release`, why: 'RELEASE a partner payout (writes partner_payout_ledger_entries)' },
    { method: 'POST', path: `/v1/operations/developers/${SITE_ID}/reconciliation/run`, why: 'run payout reconciliation' },
    { method: 'POST', path: `/v1/operations/developers/${SITE_ID}/disputes`, why: 'open a payout dispute' },
];

for (const shape of FAIL_CLOSED_SHAPES) {
    test(`SEAM 3 — the marketplace/developer OPERATOR plane is 404 APP_PLATFORM_DISABLED — ${shape.name}`, async () => {
        const env = buildEnv(shape.vars);
        const failures: string[] = [];
        for (const route of OPERATOR_ROUTES) {
            const result = await call(env, route.method, route.path);
            if (result.status !== 404 || result.code !== 'APP_PLATFORM_DISABLED') {
                failures.push(`${route.method} ${route.path} (${route.why}) -> ${result.status} ${result.code || '<no code>'}`);
            }
        }
        assert.deepEqual(
            failures,
            [],
            `${failures.length}/${OPERATOR_ROUTES.length} operator-plane app-platform routes were REACHABLE under "${shape.name}"`,
        );
    });
}

// ── Positive controls: the 404s above are the gate, not a broken mount ──────────

test('positive control — an explicit opt-in re-opens all three seams', async () => {
    for (const positive of ['true', '1', 'on', 'enabled', 'yes']) {
        const env = buildEnv({ ...STAGING_VARS, FEATURE_APP_PLATFORM: positive });

        const blocks = await call(env, 'GET', `/v1/storefront/${SITE_ROW.subdomain}`);
        const data = (blocks.json?.data ?? {}) as { app_blocks?: unknown[] };
        assert.ok(
            Array.isArray(data.app_blocks) && data.app_blocks.length > 0,
            `FEATURE_APP_PLATFORM="${positive}" should re-open the storefront app blocks, got ${JSON.stringify(data.app_blocks)} — if this is empty the SEAM 1 assertions above prove nothing`,
        );

        const extensions = await call(env, 'GET', `/v1/storefront/${SITE_ROW.subdomain}/checkout/extensions`);
        assert.notEqual(
            extensions.code,
            'APP_PLATFORM_DISABLED',
            `FEATURE_APP_PLATFORM="${positive}" should re-open checkout/extensions, got ${extensions.status} ${extensions.body}`,
        );

        const operator = await call(env, 'GET', '/v1/operations/marketplace-reviews');
        assert.notEqual(
            operator.code,
            'APP_PLATFORM_DISABLED',
            `FEATURE_APP_PLATFORM="${positive}" should re-open the operator plane, got ${operator.status} ${operator.body}`,
        );
        assert.equal(
            operator.status,
            401,
            `the operator plane must fall through to its own auth once re-opened, got ${operator.status} ${operator.body}`,
        );
    }
});

// ── No collateral damage ───────────────────────────────────────────────────────

test('no collateral damage: neighbouring storefront and operations routes are untouched', async () => {
    const env = buildEnv(PRODUCTION_VARS);

    // The public storefront payload itself must keep working — only app_blocks is emptied.
    const storefront = await call(env, 'GET', `/v1/storefront/${SITE_ROW.subdomain}`);
    assert.equal(storefront.status, 200, `storefront must stay 200, got ${storefront.status} ${storefront.body}`);
    assert.notEqual(storefront.code, 'APP_PLATFORM_DISABLED');
    assert.ok(tablesQueried.includes('sites'), 'the storefront route must still load its site row');

    // Sibling operations routers that are NOT app-platform keep their own behaviour.
    for (const path of [
        '/v1/operations/runtime/overview',
        '/v1/operations/oncall/current',
        '/v1/operations/postmortems',
        '/v1/operations/rbac/roles',
        '/v1/operations/risk/signals',
        '/v1/operations/support/tickets',
        '/v1/operations/trust-safety/cases',
    ]) {
        const result = await call(env, 'GET', path);
        assert.notEqual(
            result.code,
            'APP_PLATFORM_DISABLED',
            `${path} must NOT be caught by the app-platform gate (got ${result.status} ${result.body})`,
        );
    }

    // A non-segment prefix collision must not be gated.
    const collision = await call(env, 'GET', '/v1/operations/developers-not-a-route');
    assert.notEqual(
        collision.code,
        'APP_PLATFORM_DISABLED',
        `a /v1/operations/developers… prefix that is not a path segment must not be gated (got ${collision.status} ${collision.body})`,
    );
});

// ── Structural guards ──────────────────────────────────────────────────────────

test('the seam gates are registered BEFORE their mounts (registration-order regression guard)', () => {
    const indexSource = readFileSync(join(srcRoot, 'index.ts'), 'utf8');
    const lines = indexSource.split('\n');

    const lineOf = (needle: string) => {
        const index = lines.findIndex((line) => !line.trimStart().startsWith('//') && line.includes(needle));
        assert.notEqual(index, -1, `expected to find "${needle}" in services/api-gateway/src/index.ts`);
        return index;
    };

    // SEAM 2: the kill switch must run BEFORE the fail-open FEATURE_EXTENSIONS gate,
    // otherwise FEATURE_EXTENSIONS decides the response code.
    const killSwitchOnCheckout = lineOf("api.use('/storefront/:subdomain/checkout/extensions', appPlatformKillSwitch)");
    const extensionsGateOnCheckout = lineOf("api.use('/storefront/:subdomain/checkout/extensions', extensionsFeatureGate)");
    assert.ok(
        killSwitchOnCheckout < extensionsGateOnCheckout,
        `appPlatformKillSwitch must precede extensionsFeatureGate on the checkout-extensions path (gate at ${killSwitchOnCheckout + 1}, feature gate at ${extensionsGateOnCheckout + 1})`,
    );

    // SEAM 3: both operator prefixes gated before their mounts.
    for (const [gate, mount] of [
        ["api.use('/operations/marketplace-reviews/*', appPlatformKillSwitch)", "api.route('/operations/marketplace-reviews', operationsMarketplaceReviewsRouter)"],
        ["api.use('/operations/developers/*', appPlatformKillSwitch)", "api.route('/operations/developers', operationsDevelopersRouter)"],
    ] as const) {
        assert.ok(lineOf(gate) < lineOf(mount), `"${gate}" must be registered before "${mount}"`);
    }
    for (const exact of [
        "api.use('/operations/marketplace-reviews', appPlatformKillSwitch)",
        "api.use('/operations/developers', appPlatformKillSwitch)",
    ]) {
        lineOf(exact);
    }
});

test('SEAM 1 is gated at the DATA reader, so all of its callers inherit the gate', () => {
    const storefrontSource = readFileSync(join(srcRoot, 'routes/storefront.ts'), 'utf8');
    assert.match(
        storefrontSource,
        /import \{ isAppPlatformEnabled \} from '\.\.\/middleware\/appPlatformKillSwitch'/,
        'routes/storefront.ts must import the kill-switch predicate',
    );
    // The guard must be the first statement of loadPublicStorefrontAppBlocks, before the reads.
    const fnStart = storefrontSource.indexOf('async function loadPublicStorefrontAppBlocks');
    assert.notEqual(fnStart, -1, 'loadPublicStorefrontAppBlocks not found');
    const readStart = storefrontSource.indexOf('loadRegisteredThemeAppBlocks(c, storeId)', fnStart);
    const guard = storefrontSource.indexOf('if (!isAppPlatformEnabled(c.env)) return [];', fnStart);
    assert.notEqual(guard, -1, 'loadPublicStorefrontAppBlocks must fail closed');
    assert.ok(guard < readStart, 'the kill-switch guard must run BEFORE any app-platform table read');

    // All three public callers go through the guarded helper (nobody re-implements the read).
    const publicRoutes = readFileSync(join(srcRoot, 'routes/storefront/public-routes.ts'), 'utf8');
    const callers = publicRoutes.match(/loadPublicStorefrontAppBlocks\(c, store\.id\)/g) ?? [];
    assert.ok(callers.length >= 3, `expected all public app-block callers to use the guarded helper, saw ${callers.length}`);
});

test('app-platform EGRESS from ungated routes is fail-closed too', () => {
    const compliance = readFileSync(join(srcRoot, 'routes/app-store/compliance-routes.ts'), 'utf8');
    assert.match(
        compliance,
        /import \{ isAppPlatformEnabled \} from '\.\.\/\.\.\/middleware\/appPlatformKillSwitch'/,
        'compliance-routes.ts must import the kill-switch predicate',
    );
    const guard = compliance.indexOf('if (!isAppPlatformEnabled(c.env))');
    const dispatch = compliance.indexOf('await dispatchAppLifecycleSubscriptions(');
    assert.notEqual(guard, -1, 'dispatchStoreAppComplianceWebhook must fail closed');
    assert.ok(
        guard < dispatch,
        'the kill switch must short-circuit BEFORE dispatchAppLifecycleSubscriptions — routes/admin.ts and routes/customers.ts call this helper from outside the /v1/app-store perimeter',
    );
});

test('DRIFT GUARD: every app-platform table read outside the gated mounts is accounted for', () => {
    // This is the class of defect that produced the bypass: a prefix perimeter cannot see a
    // read that lives under another prefix. Any NEW file here must either be inside the
    // gated mounts or be added to this list WITH its gate named — a deliberate act.
    const gatedByMountPrefix = /^routes\/(app-store|app-api\.ts)/;
    const known: Record<string, string> = {
        'routes/storefront.ts': 'SEAM 1 — gated in loadPublicStorefrontAppBlocks by isAppPlatformEnabled',
        'routes/storefront/public-routes.ts': 'SEAM 2 — gated by appPlatformKillSwitch on /storefront/:subdomain/checkout/extensions',
        'routes/operations/developers.ts': 'SEAM 3 — gated by appPlatformKillSwitch on /operations/developers*',
        'routes/operations/marketplace-reviews.ts': 'SEAM 3 — gated by appPlatformKillSwitch on /operations/marketplace-reviews*',
        'lib/internal-developer-ops.ts': 'SEAM 3 helper — only called from routes/operations/developers.ts (gated) and the internal perimeter',
        'lib/marketplace-review-records.ts': 'SEAM 3 helper — only called from gated marketplace-review routes',
        'lib/app-spend-controls.ts': 'app-store helper — only called from the gated /v1/app-store mount',
        'middleware/app-auth.ts': 'app-token middleware — only mounted on the gated /v1/app routes',
        'middleware/rbac.ts': 'RBAC lookup — resolves developer identity for the gated operator plane',
        'routes/internal-console.ts': 'RESIDUAL RISK, documented: internal perimeter only (INTERNAL_API_SECRET), not customer-reachable',
        'execution/queue-execution.adapter.ts': 'RESIDUAL RISK, documented: HMAC-signed queue envelope only, not customer-reachable',
    };

    // Live scan of the gateway source — no generated artefact to go stale.
    const readerPattern = new RegExp(`\\.from\\(\\s*['"\`](?:${APP_PLATFORM_TABLES.join('|')})['"\`]`);
    const listing: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
                walk(full);
                continue;
            }
            if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) continue;
            if (readerPattern.test(readFileSync(full, 'utf8'))) {
                listing.push(relative(srcRoot, full));
            }
        }
    };
    walk(srcRoot);

    assert.ok(listing.length >= 15, `expected the scan to find the app-platform readers, saw ${listing.length}`);
    const unaccounted = listing.filter((file) => !gatedByMountPrefix.test(file) && !(file in known));
    assert.deepEqual(
        unaccounted,
        [],
        `NEW app-platform table reader(s) outside the gated mounts: ${unaccounted.join(', ')} — gate them, then document the gate in this test`,
    );
});

test('the whole suite ran with zero network egress', () => {
    assert.deepEqual(egressAttempts, [], `unexpected outbound network attempts: ${egressAttempts.join(', ')}`);
});
