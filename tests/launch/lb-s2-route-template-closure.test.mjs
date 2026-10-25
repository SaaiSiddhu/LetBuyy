// S2 — Route/Template Closure. Structural guard tests, following the established convention for
// this exact module (see tests/theme-engine/storefront-liquid-runtime.test.mjs and
// tests/launch/lb-e9-template-resolution.test.mjs — every existing test against
// template-resolver.ts / composition-engine.tsx asserts on source text, not runtime execution,
// because these files depend on Next.js server-component/App-Router machinery that does not run
// standalone under plain Node or tsx outside the Next build pipeline).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const exists = (p) => existsSync(resolve(ROOT, p));

const RESOLVER = 'apps/commerce/web/src/lib/theme-engine/template-resolver.ts';
const COMPOSITION = 'apps/commerce/web/src/lib/theme-engine/composition-engine.tsx';
const TYPES = 'apps/commerce/web/src/lib/theme-engine/types.ts';
const PROXY = 'apps/commerce/web/src/proxy.ts';
const STORE_ROOT = 'apps/commerce/web/src/app/store/[subdomain]';

// ─── W1: the resolver no longer fabricates a wrong page on a template miss ───────────────────

test('W1: resolveLiquidTemplateKey no longer falls back to the index template on a miss', () => {
  const src = read(RESOLVER);
  assert.doesNotMatch(
    src,
    /if \(bundle\.templates\.index\) return 'index'/,
    'the silent index fallback (D3a) must be removed from resolveLiquidTemplateKey',
  );
  assert.doesNotMatch(
    src,
    /Object\.keys\(bundle\.templates\)\[0\]/,
    'the arbitrary-first-template fallback (D3a) must be removed from resolveLiquidTemplateKey',
  );
});

test('W1: resolveLiquidTemplateKey returns a typed miss (string | null), not a guessed key', () => {
  const src = read(RESOLVER);
  assert.match(
    src,
    /function resolveLiquidTemplateKey\([\s\S]{0,200}?\): string \| null \{/,
    'resolveLiquidTemplateKey must be typed to return string | null',
  );
  assert.match(
    src,
    /return bundle\.templates\[routeTemplateKey\] \? routeTemplateKey : null;/,
    'resolveLiquidTemplateKey must return exactly the matched key or null — no substitution',
  );
});

test('W1: resolveStorefrontTemplate never calls coerceLiquidTemplate with a null/guessed key', () => {
  const src = read(RESOLVER);
  assert.match(
    src,
    /const liquidTemplateKey = resolveLiquidTemplateKey\(liquidBundle, route, route\.type\);/,
  );
  assert.match(
    src,
    /const liquidTemplate = liquidTemplateKey \? coerceLiquidTemplate\(liquidBundle, liquidTemplateKey, route\.type\) : null;/,
    'coerceLiquidTemplate must only be called when resolveLiquidTemplateKey found a real match',
  );
});

test('W1: a genuine miss with no fallback content is surfaced as liquidTemplateMiss, not silently absorbed', () => {
  const src = read(RESOLVER);
  assert.match(
    src,
    /liquidTemplateMiss = !route\.fallbackSections\?\.length;/,
    'a Liquid store with no matching template and no fallback content must set liquidTemplateMiss',
  );
  assert.match(src, /liquidTemplateMiss: false,/, 'a successful Liquid match must explicitly clear the miss flag');
  assert.match(
    src,
    /return \{\s*route,\s*layoutKey: template\.layoutKey,\s*liquidTemplateMiss,/,
    'the plain/legacy-chain plan must also carry the liquidTemplateMiss verdict computed above it',
  );
});

test('W1: the StorefrontRenderPlan type carries liquidTemplateMiss so callers can act on it', () => {
  const src = read(TYPES);
  assert.match(src, /liquidTemplateMiss: boolean;/);
});

test('W1: header/footer section-group resolution (a different, correct fallback) is untouched', () => {
  const src = read(RESOLVER);
  assert.match(src, /function resolveLiquidSectionGroups/);
  assert.match(
    src,
    /if \(groups\.header\.length === 0\) \{\s*groups\.header = fallbackGroups\.header/,
    'section-group (header/footer) fallback must remain — it is not the D3a defect',
  );
});

test('W1: the Liquid render-FAILURE -> React fallback safety net is untouched (not the same seam as D3a)', () => {
  const src = read(COMPOSITION);
  assert.match(
    src,
    /if \(result\.status !== 'rendered' \|\| !result\.liquid\) return null;/,
    'a Liquid render failure must still fall back to React by returning null from renderLiquidPlan',
  );
  assert.match(
    src,
    /catch \(err: unknown\) \{[\s\S]{0,800}?return null;/,
    'an unexpected renderer throw must still fall back to React',
  );
  assert.match(
    src,
    /const isLiquidFallback = plan\.rendererEngine === 'liquid';/,
    'the F5 chrome-fallback seam (header/footer around the React fallback body) must remain',
  );
});

test('W1: authenticated editor context selects its validated route; ordinary previews default to index', () => {
  const preview = read('apps/commerce/web/src/app/preview/preview-content.tsx');
  const layout = read(`${STORE_ROOT}/layout.tsx`);
  const accountLayout = read(`${STORE_ROOT}/account/layout.tsx`);
  // S6/W2 — preview/page.tsx now resolves a `routeContext` variable (demo-only, `route_type`-gated
  // product/collection override; see resolveDemoRouteType) instead of an inline `{ type: 'index', ... }`
  // literal, so this assertion checks the variable's declared DEFAULT branch is still 'index' — a real
  // merchant preview (isDemoPreview === false) always falls through to it, exactly as before.
  assert.match(preview, /resolveStorefrontTemplate\(previewStore, routeContext\)/);
  assert.match(preview, /:\s*\{\s*\n\s*type: 'index',\s*\n\s*path: '\/preview',/);
  assert.match(
    preview,
    /const routeType = editorPreview\?\.route\.type \|\| \(isDemoPreview \? resolveDemoRouteType\(singleParam\(query\?\.route_type\)\) : 'index'\);/,
    'only validated editor context or an explicit demo may override the index default',
  );
  assert.match(layout, /resolveStorefrontTemplate\(store, \{\s*type: 'index',/);
  assert.match(accountLayout, /templateKey: 'customers\/account',/);
});

// ─── W2: the six new routes exist, resolve the right template, and fail closed on a miss ─────

const NEW_ROUTES = [
  { file: `${STORE_ROOT}/search/page.tsx`, templateKey: /'search'/ },
  { file: `${STORE_ROOT}/collections/page.tsx`, templateKey: /'list-collections'/ },
  { file: `${STORE_ROOT}/contact/page.tsx`, templateKey: /'contact'/ },
  { file: `${STORE_ROOT}/password/page.tsx`, templateKey: /type: 'password'/ },
  { file: `${STORE_ROOT}/customers/register/page.tsx`, templateKey: /'customers\/register'/ },
];

for (const { file, templateKey } of NEW_ROUTES) {
  test(`W2: ${file} exists, is a server component, resolves its template, and 404s on a genuine miss`, () => {
    assert.ok(exists(file), `${file} must exist`);
    const src = read(file);
    assert.doesNotMatch(src, /['"]use client['"]/, `${file} must be a server component`);
    assert.match(src, /export default async function/, `${file} must export a default async page function`);
    assert.match(src, templateKey, `${file} must request the correct Liquid template key`);
    assert.match(
      src,
      /if \(plan\.liquidTemplateMiss\) return notFound\(\);/,
      `${file} must 404 instead of silently rendering a wrong page on a genuine template miss`,
    );
    assert.match(src, /StorefrontCompositionEngine/, `${file} must render through the shared composition engine (no second pattern)`);
  });
}

test('W2: collections/page.tsx (the list index) is distinct from collections/[slug]/page.tsx (a single collection)', () => {
  assert.ok(exists(`${STORE_ROOT}/collections/[slug]/page.tsx`), 'the existing single-collection route must be untouched');
});

test('W2: customers/register/page.tsx never mints a session or touches the customer session secret — it only renders the form', () => {
  const src = read(`${STORE_ROOT}/customers/register/page.tsx`);
  assert.doesNotMatch(src, /CUSTOMER_SESSION_SECRET/);
  assert.doesNotMatch(src, /createSession/);
});

test('W2: the register template directs new accounts to canonical Identity; stale forms retain the compatibility bridge', () => {
  assert.ok(
    exists('apps/commerce/web/src/app/api/customer/register/route.ts'),
    'the register API route must already exist — this phase does not add a new auth path',
  );
  const registerSection = read('packages/theme-engine/examples/letbuyy-core-liquid/files/sections/customer-register.liquid');
  assert.match(registerSection,/href="\/api\/buyer-auth\/start\?return_to=\{\{ routes\.account_url \}\}"/);
  assert.doesNotMatch(registerSection,/action="\/api\/customer\/register"|name="password"/);
  const bridge=read('apps/commerce/web/src/app/api/customer/register/route.ts');
  assert.match(bridge,/NextResponse\.redirect\(redirectTo, 303\)/);
  assert.match(bridge,/status: 410/);
});

test('W2: the search route matches the exact path + query param the lb-search island already submits to', () => {
  const island = read('apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx');
  // The island navigates to the URL its section gives it in data-search-url, the query in ?search=.
  assert.match(island, /const searchUrl = this\.dataset\.searchUrl \|\| /);
  assert.match(island, /const destination = new URL\(searchUrl, window\.location\.origin\);/);
  assert.match(island, /destination\.searchParams\.set\('search', query\)/);
  // The section gives it the routes drop's search URL. 9c02d2ac (2026-08-25) replaced the literal
  // "/search" this test used to pin: a bare /search reaches the store's search page only on the
  // store's own host, where rewriteToStore prefixes it; the platform root host, where local
  // development and theme-editor previews run, has no /search page.
  const searchSection = read('packages/theme-engine/examples/letbuyy-core-liquid/files/sections/search-box.liquid');
  assert.match(searchSection, /<lb-search\b[^>]*\bdata-search-url="\{\{ routes\.search_url \}\}"/);
  // routes.search_url is the store's own tree plus /search: the path of the page below on every host
  // (rewriteToStore leaves a path already inside the store's tree unprefixed, and the platform root
  // gates it against the store it names).
  const renderer = read('packages/theme-engine/src/theme-renderer.ts');
  const routesStart = renderer.indexOf('routes: (() => {');
  assert.ok(routesStart > -1, 'theme-renderer.ts must build the routes drop');
  const routesDrop = renderer.slice(routesStart, renderer.indexOf('})()', routesStart));
  assert.match(routesDrop, /^routes: \(\(\) => \{\s*const basePath = `\/store\/\$\{input\.context\.subdomain\}`;/);
  assert.match(routesDrop, /\bsearch_url: `\$\{basePath\}\/search`,/);
  const searchPage = read(`${STORE_ROOT}/search/page.tsx`);
  assert.match(searchPage, /searchParams\?: Promise<Record<string, string \| string\[\] \| undefined>>/);
  assert.match(searchPage, /const term = discoveryQuery\.search \|\| '';/);
});

test('W2: the password route documents that the live gate is enforced by proxy.ts, not by this page', () => {
  const src = read(`${STORE_ROOT}/password/page.tsx`);
  assert.match(src, /proxy\.ts intercepts every request/);
});

test('W2: contact form POST is proxied to the gateway from proxy.ts (no local DB write in the app)', () => {
  const src = read(PROXY);
  assert.match(src, /async function handleContactSubmit/);
  assert.match(src, /fetch\(`\$\{base\}\/v1\/contacts`/, 'must call the existing public gateway contact endpoint');
  assert.doesNotMatch(src, /getSupabaseAdmin|\.from\('contact_submissions'\)/, 'proxy.ts must never write to the database directly');
  assert.match(
    src,
    /if \(req\.nextUrl\.pathname === '\/contact' && req\.method === 'POST'\) \{\s*return handleContactSubmit/,
  );
});

test('W2: the contact POST handler is wired AFTER the password/offline/preview access gates (never bypasses them)', () => {
  const src = read(PROXY);
  const gateIndex = src.indexOf("site.access_mode === 'password' && !preview.valid");
  const contactIndex = src.indexOf("req.nextUrl.pathname === '/contact' && req.method === 'POST'", gateIndex);
  assert.ok(gateIndex > -1 && contactIndex > gateIndex, 'the contact POST route must be reachable only after the storefront access gates run');
});

// ─── W3: the catch-all + policy pages already consult the Liquid bundle (D3c pre-existing) ───

test('W3: the CMS catch-all already renders through resolveStorefrontTemplate (Liquid `page` template is reachable)', () => {
  const src = read(`${STORE_ROOT}/[...path]/page.tsx`);
  assert.match(src, /ContentResourceRenderer/);
  const renderer = read('apps/commerce/web/src/components/content/content-resource-renderer.tsx');
  assert.match(renderer, /resolveStorefrontTemplate\(store, \{/);
  assert.match(renderer, /templateKey: resource\.assignedTemplateKey \|\| undefined,/);
});

test('W3: preview-token support and metadata generation on the catch-all are untouched', () => {
  const src = read(`${STORE_ROOT}/[...path]/page.tsx`);
  assert.match(src, /resolveThemePreviewToken/);
  assert.match(src, /export async function generateMetadata/);
  assert.match(src, /if \(!path \|\| path\.length !== 1\) return notFound\(\);/);
});

for (const policyRoute of ['privacy', 'returns', 'shipping', 'terms']) {
  test(`W3: /${policyRoute} already passes routeType="policy" through ContentResourceRenderer (the policy template is already reachable)`, () => {
    const src = read(`${STORE_ROOT}/${policyRoute}/page.tsx`);
    assert.match(src, /routeType="policy"/);
  });
}

// ─── W4: every shipped template has a route, or a recorded reason it needs none ───────────────

const TEMPLATES_DIR = resolve(ROOT, 'packages/theme-engine/examples/letbuyy-core-liquid/files/templates');

function listShippedTemplateKeys(dir, prefix = '') {
  const keys = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      keys.push(...listShippedTemplateKeys(join(dir, entry.name), `${prefix}${entry.name}/`));
    } else if (entry.name.endsWith('.json')) {
      keys.push(`${prefix}${entry.name.replace(/\.json$/, '')}`);
    }
  }
  return keys;
}

// Template key -> a route file that resolves it (checked to exist), OR (for the three keys with
// no route by design) a short recorded reason. This is the regression guard: a new shipped
// template with neither entry fails the test below, instead of silently shipping unreachable.
const TEMPLATE_ROUTES = {
  index: `${STORE_ROOT}/page.tsx`,
  product: `${STORE_ROOT}/product/[productId]/page.tsx`,
  collection: `${STORE_ROOT}/collections/[slug]/page.tsx`,
  page: `${STORE_ROOT}/[...path]/page.tsx`,
  policy: `${STORE_ROOT}/privacy/page.tsx`,
  // T3-fix W2: blog + account routes moved into (list)/(hub) route groups (no URL change) so
  // their dynamic siblings stop inheriting a loading.tsx-driven Suspense boundary they never
  // opted into — see CAPABILITY_BACKLOG.md CAP-C22.
  blog: `${STORE_ROOT}/blog/(list)/page.tsx`,
  article: `${STORE_ROOT}/blog/[slug]/page.tsx`,
  cart: `${STORE_ROOT}/cart/page.tsx`,
  search: `${STORE_ROOT}/search/page.tsx`,
  'list-collections': `${STORE_ROOT}/collections/page.tsx`,
  contact: `${STORE_ROOT}/contact/page.tsx`,
  password: `${STORE_ROOT}/password/page.tsx`,
  'customers/login': `${STORE_ROOT}/customers/login/page.tsx`,
  'customers/register': `${STORE_ROOT}/customers/register/page.tsx`,
  'customers/account': `${STORE_ROOT}/account/(hub)/page.tsx`,
  'customers/orders': `${STORE_ROOT}/account/orders/(list)/page.tsx`,
  'customers/order': `${STORE_ROOT}/account/orders/[id]/page.tsx`,
  'customers/wishlist': `${STORE_ROOT}/account/wishlist/page.tsx`,
  'customers/settings': `${STORE_ROOT}/account/settings/page.tsx`,
  'customers/addresses': `${STORE_ROOT}/account/addresses/page.tsx`,
};

const NO_ROUTE_NEEDED = new Set([
  'header', // a section GROUP resolved per-page via resolveLiquidSectionGroups, not a page template
  'footer', // same as header
  'not_found', // documented Phase E decision in not-found.tsx: delegates to the root React 404;
  // Next's not-found.tsx boundary receives no route params, so it cannot know which store's
  // Liquid bundle to load. Phase F scope (proxy-level routing or a render context) is out of
  // scope for S2.
]);

test('W4: every shipped Liquid template resolves through a route, or is a recorded no-route-needed key', () => {
  const shipped = listShippedTemplateKeys(TEMPLATES_DIR);
  assert.ok(shipped.length > 15, 'sanity: the fixture bundle should ship a substantial template set');

  const unaccounted = shipped.filter((key) => !NO_ROUTE_NEEDED.has(key) && !(key in TEMPLATE_ROUTES));
  assert.deepEqual(
    unaccounted,
    [],
    `every shipped template needs a route entry in TEMPLATE_ROUTES or a reason in NO_ROUTE_NEEDED: ${unaccounted.join(', ')}`,
  );

  for (const [key, routeFile] of Object.entries(TEMPLATE_ROUTES)) {
    if (!shipped.includes(key)) continue; // TEMPLATE_ROUTES may list a key not currently shipped; that's fine
    assert.ok(exists(routeFile), `template "${key}" claims route ${routeFile}, but that file does not exist`);
  }
});

test('W4: React section registry stays frozen — no page.tsx in this phase adds a components/sections file', () => {
  const sectionsDir = resolve(ROOT, 'apps/commerce/web/src/components/sections');
  if (!existsSync(sectionsDir)) return; // registry may live elsewhere; the count validator is authoritative
  const count = readdirSync(sectionsDir).filter((f) => f.endsWith('.tsx')).length;
  assert.equal(count, 20, 'the frozen React section count must stay at 20 — this phase adds pages, not sections');
});
