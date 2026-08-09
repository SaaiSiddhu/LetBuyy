/**
 * ART-22 / ART-16 / NEVER-R3 / AGENT-R13 — fail-closed app-platform kill switch.
 *
 * Proves that the third-party app platform surface (/v1/app-store/**, /v1/app/**:
 * marketplace catalog, App Bridge embed-session + bridge/fetch, app OAuth2, install
 * lifecycle, app billing / revenue share, developer platform) is UNREACHABLE unless
 * FEATURE_APP_PLATFORM is explicitly set to a positive value.
 *
 * STRICTLY OFFLINE. globalThis.fetch is replaced before any application import; the
 * only answered origin is an in-process Supabase stub. Any other egress is recorded
 * and asserted to be zero, so no socket is ever opened. No database is contacted.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const gatewayRoot = join(testDir, '../..');

// ── Offline guard: installed BEFORE any application module is imported ──────────
const egressAttempts: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : ((input as Request)?.url ?? String(input));
    if (url.startsWith('http://supabase.killswitch.test')) {
        return new Response('[]', {
            status: 200,
            headers: { 'content-type': 'application/json', 'content-range': '0-0/0' },
        });
    }
    egressAttempts.push(`${init?.method ?? 'GET'} ${url}`);
    throw new Error(`NETWORK_EGRESS_BLOCKED_BY_TEST: ${url}`);
}) as typeof fetch;
void realFetch;

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

function buildEnv(vars: Record<string, string>): Record<string, unknown> {
    return {
        ...vars,
        SUPABASE_URL: 'http://supabase.killswitch.test',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-not-a-real-secret',
        SUPABASE_ANON_KEY: 'test-anon-key-not-a-real-secret',
        CACHE: makeMemoryKv(),
    };
}

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };

interface RouteEntry {
    method: string;
    path: string;
}

interface GatewayHandler {
    fetch: (request: Request, env: unknown, executionContext: unknown) => Promise<Response>;
}

// Application modules are loaded dynamically (and lazily, once) so the offline guard
// above is already installed when their module-level code runs. The runner transpiles
// this file to CJS, so a top-level await is not available.
let loaded: Promise<{ handler: GatewayHandler; routes: { method: string; path: string; mount: string }[] }> | null =
    null;

function loadGateway() {
    if (!loaded) {
        loaded = (async () => {
            const gatewayModule = await import('../index.ts');
            const appStoreRouter = (await import('../routes/app-store.ts')).default as { routes?: RouteEntry[] };
            const appApiRouter = (await import('../routes/app-api.ts')).default as { routes?: RouteEntry[] };
            return {
                handler: gatewayModule.default as GatewayHandler,
                routes: [...collect(appStoreRouter, '/v1/app-store'), ...collect(appApiRouter, '/v1/app')],
            };
        })();
    }
    return loaded;
}

const UUID = '00000000-0000-4000-8000-000000000001';
const concretize = (path: string) =>
    path
        .replace(/:awardKey/g, 'best-app')
        .replace(/:slug/g, 'killswitch-slug')
        .replace(/:[A-Za-z_]+/g, UUID);

function collect(router: { routes?: RouteEntry[] }, mount: string) {
    const seen = new Set<string>();
    const out: { method: string; path: string; mount: string }[] = [];
    for (const route of router.routes ?? []) {
        if (route.method === 'ALL') continue;
        const key = `${route.method} ${route.path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ method: route.method, path: route.path, mount });
    }
    return out;
}

let requestCounter = 0;

async function callRoute(
    env: Record<string, unknown>,
    method: string,
    url: string,
): Promise<{ status: number; code: string; body: string }> {
    const { handler } = await loadGateway();
    requestCounter += 1;
    const headers: Record<string, string> = {
        // Unique client key per request so a shared rate-limit bucket cannot
        // masquerade as the kill switch.
        'CF-Connecting-IP': `203.0.113.${requestCounter % 250}${requestCounter}`,
        origin: 'https://apps.letbuyy.com',
    };
    const init: RequestInit = { method, headers };
    if (method !== 'GET' && method !== 'HEAD') {
        headers['content-type'] = 'application/json';
        init.body = JSON.stringify({});
    }
    const response = await handler.fetch(new Request(url, init), env, ctx);
    const body = await response.text();
    let code = '';
    try {
        const parsed = JSON.parse(body) as { error?: { code?: string }; code?: string };
        code = parsed?.error?.code ?? parsed?.code ?? '';
    } catch {
        code = '';
    }
    return { status: response.status, code, body: body.slice(0, 200) };
}

test('the app-platform surface is non-empty and enumerated from the live routers (not hard-coded)', async () => {
    const { routes } = await loadGateway();
    assert.ok(
        routes.length >= 60,
        `expected the app-store/app routers to expose the full frozen surface, saw ${routes.length}`,
    );
    // Sanity: the highest-risk families the mandate names are present in the enumeration.
    const paths = routes.map((route) => `${route.mount}${route.path}`);
    for (const marker of [
        '/v1/app-store/categories',
        '/v1/app-store/installations/:id/embed-session',
        '/v1/app-store/bridge/fetch',
        '/v1/app-store/oauth/token',
    ]) {
        assert.ok(paths.includes(marker), `expected the enumeration to include ${marker}`);
    }
});

const FAIL_CLOSED_SHAPES: { name: string; vars: Record<string, string> }[] = [
    { name: 'developer shape (flag absent)', vars: DEVELOPER_VARS },
    { name: 'wrangler [env.staging.vars] verbatim (flag absent)', vars: STAGING_VARS },
    { name: 'wrangler [env.production.vars] verbatim (flag absent)', vars: PRODUCTION_VARS },
    { name: 'staging vars + FEATURE_APP_PLATFORM="false"', vars: { ...STAGING_VARS, FEATURE_APP_PLATFORM: 'false' } },
    { name: 'staging vars + FEATURE_APP_PLATFORM="" (empty)', vars: { ...STAGING_VARS, FEATURE_APP_PLATFORM: '' } },
    { name: 'staging vars + FEATURE_APP_PLATFORM="   " (whitespace)', vars: { ...STAGING_VARS, FEATURE_APP_PLATFORM: '   ' } },
    { name: 'staging vars + FEATURE_APP_PLATFORM="maybe" (malformed)', vars: { ...STAGING_VARS, FEATURE_APP_PLATFORM: 'maybe' } },
    { name: 'staging vars + FEATURE_APP_PLATFORM="0"', vars: { ...STAGING_VARS, FEATURE_APP_PLATFORM: '0' } },
    { name: 'staging vars + FEATURE_APP_PLATFORM="truthy" (prefix-of-true)', vars: { ...STAGING_VARS, FEATURE_APP_PLATFORM: 'truthy' } },
];

for (const shape of FAIL_CLOSED_SHAPES) {
    test(`every app-platform route is unreachable — ${shape.name}`, async () => {
        const { routes } = await loadGateway();
        const env = buildEnv(shape.vars);
        const failures: string[] = [];
        for (const route of routes) {
            const url = `https://gateway.killswitch.test${route.mount}${concretize(route.path)}`;
            const result = await callRoute(env, route.method, url);
            if (result.status !== 404 || result.code !== 'APP_PLATFORM_DISABLED') {
                failures.push(
                    `${route.method} ${route.mount}${route.path} -> ${result.status} ${result.code || '<no code>'} ${result.body}`,
                );
            }
        }
        assert.deepEqual(
            failures,
            [],
            `${failures.length}/${routes.length} app-platform routes were REACHABLE under "${shape.name}"`,
        );
    });
}

test('the App Bridge / marketplace route families are individually gated (named-family assertion)', async () => {
    const env = buildEnv(PRODUCTION_VARS);
    const families: { family: string; method: string; path: string }[] = [
        { family: 'marketplace catalog (unauthenticated)', method: 'GET', path: '/v1/app-store/categories' },
        { family: 'marketplace catalog (unauthenticated)', method: 'GET', path: '/v1/app-store/apps' },
        { family: 'marketplace catalog (unauthenticated)', method: 'GET', path: '/v1/app-store/featured' },
        { family: 'unauthenticated write path', method: 'POST', path: '/v1/app-store/discovery/events' },
        { family: 'unauthenticated write path', method: 'POST', path: '/v1/app-store/growth/requests' },
        { family: 'unauthenticated write path', method: 'POST', path: '/v1/app-store/telemetry/events' },
        { family: 'app OAuth2', method: 'POST', path: '/v1/app-store/oauth/token' },
        { family: 'app OAuth2', method: 'POST', path: '/v1/app-store/oauth/token-exchange' },
        { family: 'app OAuth2', method: 'POST', path: `/v1/app-store/apps/${UUID}/oauth/authorize` },
        { family: 'App Bridge embed-session', method: 'POST', path: `/v1/app-store/installations/${UUID}/embed-session` },
        { family: 'App Bridge bridge/fetch', method: 'POST', path: '/v1/app-store/bridge/fetch' },
        { family: 'install lifecycle', method: 'POST', path: `/v1/app-store/apps/${UUID}/install` },
        { family: 'install lifecycle', method: 'DELETE', path: `/v1/app-store/apps/${UUID}/install` },
        { family: 'app billing / revenue share', method: 'POST', path: `/v1/app-store/installations/${UUID}/charges` },
        { family: 'app billing / revenue share', method: 'POST', path: `/v1/app-store/charges/${UUID}/approve` },
        { family: 'developer platform', method: 'POST', path: '/v1/app-store/developers/register' },
        { family: 'developer platform', method: 'POST', path: '/v1/app-store/developers/apps' },
        { family: 'extensions registry', method: 'GET', path: `/v1/app-store/installations/${UUID}/extensions` },
        { family: 'third-party app data API', method: 'GET', path: '/v1/app/products' },
        { family: 'third-party app data API', method: 'GET', path: '/v1/app/orders' },
        { family: 'third-party app data API', method: 'POST', path: '/v1/app/usage-events' },
        { family: 'third-party app data API', method: 'PATCH', path: '/v1/app/installation/metadata' },
    ];

    for (const entry of families) {
        const result = await callRoute(env, entry.method, `https://gateway.killswitch.test${entry.path}`);
        assert.equal(
            result.status,
            404,
            `[${entry.family}] ${entry.method} ${entry.path} expected 404, got ${result.status} ${result.body}`,
        );
        assert.equal(
            result.code,
            'APP_PLATFORM_DISABLED',
            `[${entry.family}] ${entry.method} ${entry.path} expected APP_PLATFORM_DISABLED, got "${result.code}" ${result.body}`,
        );
    }
});

test('positive control: an explicit opt-in re-opens the surface (so the 404s above are the gate, not a broken mount)', async () => {
    for (const positive of ['true', 'TRUE', ' 1 ', 'on', 'enabled', 'yes']) {
        const env = buildEnv({ ...STAGING_VARS, FEATURE_APP_PLATFORM: positive });
        const result = await callRoute(env, 'GET', 'https://gateway.killswitch.test/v1/app-store/categories');
        assert.notEqual(
            result.code,
            'APP_PLATFORM_DISABLED',
            `FEATURE_APP_PLATFORM="${positive}" should be a positive opt-in, but the gate still denied (${result.status} ${result.body})`,
        );
    }
});

test('no collateral damage: non-app-platform routes are untouched in the production shape', async () => {
    const env = buildEnv(PRODUCTION_VARS);

    const health = await callRoute(env, 'GET', 'https://gateway.killswitch.test/v1/health');
    assert.equal(health.status, 200, `/v1/health should stay 200, got ${health.status} ${health.body}`);

    // Proves '/app/*' is segment-matched and does not over-match other prefixes.
    const products = await callRoute(env, 'GET', 'https://gateway.killswitch.test/v1/products');
    assert.notEqual(
        products.code,
        'APP_PLATFORM_DISABLED',
        `/v1/products must not be caught by the app-platform gate (got ${products.status} ${products.body})`,
    );
    assert.equal(
        products.status,
        401,
        `/v1/products should keep its pre-existing 401, got ${products.status} ${products.body}`,
    );

    const appearance = await callRoute(env, 'GET', 'https://gateway.killswitch.test/v1/appearance-not-a-route');
    assert.notEqual(
        appearance.code,
        'APP_PLATFORM_DISABLED',
        `a /v1/app… prefix that is not a path segment must not be gated (got ${appearance.status} ${appearance.body})`,
    );
});

test('the gate is registered BEFORE the app-store / app mounts (registration-order regression guard)', () => {
    const indexSource = readFileSync(join(srcRoot, 'index.ts'), 'utf8');
    const lines = indexSource.split('\n');

    const lineOf = (needle: string) => {
        // Commented-out registrations must not satisfy the guard.
        const index = lines.findIndex((line) => !line.trimStart().startsWith('//') && line.includes(needle));
        assert.notEqual(index, -1, `expected to find "${needle}" in services/api-gateway/src/index.ts`);
        return index;
    };

    const gateLines = [
        lineOf("api.use('/app-store', appPlatformKillSwitch)"),
        lineOf("api.use('/app-store/*', appPlatformKillSwitch)"),
        lineOf("api.use('/app', appPlatformKillSwitch)"),
        lineOf("api.use('/app/*', appPlatformKillSwitch)"),
    ];
    const lastGateLine = Math.max(...gateLines);
    const appStoreMount = lineOf("api.route('/app-store', appStoreRouter)");
    const appApiMount = lineOf("api.route('/app', appApiRouter)");

    assert.ok(
        lastGateLine < appStoreMount,
        `appPlatformKillSwitch must be registered before api.route('/app-store', …) — gate at line ${lastGateLine + 1}, mount at ${appStoreMount + 1}`,
    );
    assert.ok(
        lastGateLine < appApiMount,
        `appPlatformKillSwitch must be registered before api.route('/app', …) — gate at line ${lastGateLine + 1}, mount at ${appApiMount + 1}`,
    );
    assert.match(indexSource, /import \{ appPlatformKillSwitch \} from '\.\/middleware\/appPlatformKillSwitch'/);
    assert.match(indexSource, /FEATURE_APP_PLATFORM\?: string;/);
});

test('the kill switch does not reuse the fail-open feature-flag helper', () => {
    const gateSource = readFileSync(join(srcRoot, 'middleware/appPlatformKillSwitch.ts'), 'utf8');
    // Strip comments: the doc block deliberately *names* the fail-open helper it refuses
    // to reuse, so only executable code may be asserted against.
    const code = gateSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /isGatewayFeatureEnabled|featureGate|isProductionRuntime/);
    assert.doesNotMatch(code, /featureFlags/);
    assert.doesNotMatch(code, /ENVIRONMENT|APP_ENV|NODE_ENV/);
    assert.match(code, /APP_PLATFORM_DISABLED/);
});

test('FEATURE_APP_PLATFORM is absent from wrangler.toml in every environment block', () => {
    const wrangler = readFileSync(join(gatewayRoot, 'wrangler.toml'), 'utf8');
    assert.equal(
        wrangler.includes('FEATURE_APP_PLATFORM'),
        false,
        'FEATURE_APP_PLATFORM must NOT be declared in services/api-gateway/wrangler.toml — its absence is the fail-closed guarantee',
    );
});

test('the whole suite ran with zero network egress', () => {
    assert.deepEqual(egressAttempts, [], `unexpected outbound network attempts: ${egressAttempts.join(', ')}`);
});
