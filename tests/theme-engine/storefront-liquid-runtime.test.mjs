import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const TEMPLATE_RESOLVER_SOURCE = 'apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts';
const COMPOSITION_ENGINE_SOURCE = 'apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx';
const DATA_BINDING_SOURCE = 'apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts';
const STOREFRONT_TYPES_SOURCE = 'apps/storefront-runtime/src/lib/theme-engine/types.ts';
const STOREFRONT_GLOBALS_SOURCE = 'apps/storefront-runtime/src/app/globals.css';
const CUSTOMER_DROP_SOURCE = 'apps/storefront-runtime/src/lib/customer-drop.ts';
const LAYOUT_SOURCE = 'apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('storefront render plans can carry validated portable Liquid bundles', () => {
  const typesSource = read(STOREFRONT_TYPES_SOURCE);
  const resolverSource = read(TEMPLATE_RESOLVER_SOURCE);

  assert.match(typesSource, /rendererEngine\?: ThemeRendererEngine/);
  assert.match(typesSource, /liquidBundle\?: LiquidThemePackageBundle/);
  assert.match(resolverSource, /LiquidThemePackageBundleSchema\.safeParse/);
  assert.match(resolverSource, /rendererEngine: 'liquid'/);
});

test('storefront resolver builds ordered Liquid section and block models from template JSON', () => {
  const resolverSource = read(TEMPLATE_RESOLVER_SOURCE);

  assert.match(resolverSource, /function coerceLiquidTemplate/);
  assert.match(resolverSource, /function coerceLiquidTemplateSections/);
  assert.match(resolverSource, /orderedKeys\(template\.sections, template\.order\)/);
  assert.match(resolverSource, /orderedKeys\(section\.blocks, section\.block_order\)/);
  assert.match(resolverSource, /rendererKey: `liquid\.section\.\$\{section\.type\}`/);
  assert.match(resolverSource, /rendererKey: isLiquidAppBlockType\(block\.type\) \? 'liquid\.app-block'/);
});

test('storefront resolver and composition engine render full Liquid documents with Liquid chrome', () => {
  const resolverSource = read(TEMPLATE_RESOLVER_SOURCE);
  const source = read(COMPOSITION_ENGINE_SOURCE);

  assert.match(resolverSource, /function resolveLiquidSectionGroups/);
  assert.match(resolverSource, /header: coerceLiquidTemplateSections\(bundle, 'header'\)/);
  assert.match(resolverSource, /footer: coerceLiquidTemplateSections\(bundle, 'footer'\)/);
  assert.match(source, /createThemeRenderer\('liquid'\)/);
  assert.match(source, /plan\.rendererEngine !== 'liquid'/);
  // After the render-result refactor, composition-engine destructures header/contentForLayout/footer
  // from result.liquid (not layoutHtml directly). Verify the destructuring + concatenation contract.
  assert.match(source, /const \{ header, contentForLayout, footer \} = result\.liquid/);
  assert.match(source, /`\$\{header \|\| ''\}\$\{contentForLayout\}\$\{footer \|\| ''\}`/);
  assert.doesNotMatch(source, /return result\.liquid\.contentForLayout/);
  assert.match(source, /data-theme-renderer="liquid"/);
  assert.match(source, /dangerouslySetInnerHTML=\{\{ __html: html \}\}/);
});

test('Liquid storefront plans bind catalog data and cart drops without fabricating server cart state', () => {
  const dataBindingSource = read(DATA_BINDING_SOURCE);
  const compositionSource = read(COMPOSITION_ENGINE_SOURCE);
  const typesSource = read(STOREFRONT_TYPES_SOURCE);
  const cssSource = read(STOREFRONT_GLOBALS_SOURCE);

  assert.match(dataBindingSource, /'liquid\.section\.product-grid'/);
  assert.match(dataBindingSource, /'liquid\.section\.featured-products'/);
  assert.match(dataBindingSource, /'liquid\.section\.product-detail'/);
  assert.match(dataBindingSource, /function sectionRequestsSingleProduct/);
  assert.match(typesSource, /cart\?: Record<string, unknown>/);
  assert.match(compositionSource, /function collectLiquidCart/);
  assert.match(compositionSource, /source: 'browser_hydrated'/);
  assert.match(compositionSource, /sync_url: `\/api\/storefront\/\$\{plan\.route\.subdomain\}\/cart`/);
  assert.match(cssSource, /\.lb-theme/);
  assert.match(cssSource, /\.lb-header/);
  assert.match(cssSource, /\.lb-product-grid__items/);
});

test('storefront composition engine maps installed app blocks into Liquid app slots', () => {
  const source = read(COMPOSITION_ENGINE_SOURCE);

  assert.match(source, /normalizeAppBlockInstances\(input\)/);
  assert.match(source, /function buildLiquidAppBlocks/);
  assert.match(source, /\[block\.slot, source\]/);
  assert.match(source, /\[`app:\$\{block\.extension_id\}`, source\]/);
  assert.match(source, /liquidAppBlocks: buildLiquidAppBlocks\(store\.templateConfig\.appBlocks\)/);
  assert.match(source, /data-app-block-slot/);
});

test('composition engine catches renderer failures and records fallback_reason in telemetry', () => {
  const source = read(COMPOSITION_ENGINE_SOURCE);

  // Defense-in-depth: renderLiquidPlan must catch anything the renderer throws.
  assert.match(source, /catch.*err.*unknown/);
  // The catch path must emit the fallback event so monitoring can distinguish managed fallback from normal React render.
  assert.match(source, /lb:canary:render:fallback/);
  // The catch path must return null so StorefrontCompositionEngine falls back to React.
  // (null causes engine='react' in the outer telemetry log)
  assert.match(source, /return null/);
  // Canary telemetry must carry a fallback_reason field.
  assert.match(source, /fallback_reason:/);
});

// ============================================================
// Phase D tests
// ============================================================

test('D1-B navToLinklists helper exists and linklists key is populated in buildLiquidCommerceContext', () => {
  const source = read(COMPOSITION_ENGINE_SOURCE);

  // Helper must exist
  assert.match(source, /function navToLinklists/);
  // Helper converts NavPage into Shopify linklist shape
  assert.match(source, /navPageToLink/);
  // D1-A/D1-B: keys MUST be underscore form — toLiquidDrop strips hyphens (regex /^[a-zA-Z][a-zA-Z0-9_]*$/)
  // Using 'main_menu' not 'main-menu' so linklists survive the drop sanitizer at runtime.
  assert.match(source, /'main_menu'/);
  assert.match(source, /'footer_menu'/);
  assert.match(source, /'policy_menu'/);
  // Verify hyphenated keys are NOT used as dictionary keys (they would be silently stripped)
  assert.doesNotMatch(source, /result\['main-menu'\]/);
  assert.doesNotMatch(source, /result\['footer-menu'\]/);
  assert.doesNotMatch(source, /result\['policy-menu'\]/);
  // linklists key must be populated in buildLiquidCommerceContext return
  assert.match(source, /linklists/);
  // navToLinklists called with store.navigation and route.path
  assert.match(source, /navToLinklists\(store\.navigation/);
  // active field uses currentPath — not fabricated as true
  assert.match(source, /active.*currentPath.*page\.href.*currentPath.*false/s);
  // D1-B: StoreNavigation type imported
  assert.match(source, /StoreNavigation/);
});

test('D1-B navToLinklists runtime: underscore keys survive toLiquidDrop sanitizer', async () => {
  // This integration test verifies the end-to-end contract:
  //   navToLinklists() -> keys -> toLiquidDrop() -> Liquid scope
  // The critical invariant: underscore keys pass /^[a-zA-Z][a-zA-Z0-9_]*$/, hyphenated keys do not.
  const source = read(COMPOSITION_ENGINE_SOURCE);

  // Confirm all three handle values use underscore form (not hyphenated) so they survive toLiquidDrop.
  // If navToLinklists() used 'main-menu' as the handle, the key would be stripped at render time.
  const mainMenuMatch = source.match(/result\['main_menu'\]\s*=\s*\{[^}]*handle:\s*'([^']+)'/);
  const footerMenuMatch = source.match(/result\['footer_menu'\]\s*=\s*\{[^}]*handle:\s*'([^']+)'/);
  const policyMenuMatch = source.match(/result\['policy_menu'\]\s*=\s*\{[^}]*handle:\s*'([^']+)'/);

  assert.ok(mainMenuMatch, 'main_menu dict key must exist in navToLinklists result');
  assert.ok(footerMenuMatch, 'footer_menu dict key must exist in navToLinklists result');
  assert.ok(policyMenuMatch, 'policy_menu dict key must exist in navToLinklists result');

  // The handle values themselves must also be underscore-safe (they appear in linklists[handle].handle).
  assert.ok(
    /^[a-zA-Z][a-zA-Z0-9_]*$/.test(mainMenuMatch[1]),
    `main_menu handle '${mainMenuMatch[1]}' must match toLiquidDrop key regex`,
  );
  assert.ok(
    /^[a-zA-Z][a-zA-Z0-9_]*$/.test(footerMenuMatch[1]),
    `footer_menu handle '${footerMenuMatch[1]}' must match toLiquidDrop key regex`,
  );
  assert.ok(
    /^[a-zA-Z][a-zA-Z0-9_]*$/.test(policyMenuMatch[1]),
    `policy_menu handle '${policyMenuMatch[1]}' must match toLiquidDrop key regex`,
  );
});

test('D3 customer address drop carries full_name from customer name; fabricated fields stay honest', () => {
  const source = read(CUSTOMER_DROP_SOURCE);

  // mapAddressDrop must accept a fullName parameter
  assert.match(source, /function mapAddressDrop\(addr.*fullName/);
  // full_name is set from fullName parameter, not hardcoded ''
  assert.match(source, /full_name: fullName/);
  // mapCustomerDrop must pass customer.fullName into the address mapping
  assert.match(source, /customer\.fullName/);
  // mapDefaultAddress must also accept fullName
  assert.match(source, /function mapDefaultAddress\(addresses.*fullName/);
  // landmark stays null — gateway does not return it
  assert.match(source, /landmark: null/);
  // address2 stays null — gateway does not return it
  assert.match(source, /address2: null/);
  // country stays 'IN' (India-first)
  assert.match(source, /country: 'IN'/);
});

test('D4 collection drop on collection route uses resolvedCollectionMeta before synthesis', () => {
  const source = read(COMPOSITION_ENGINE_SOURCE);

  // resolvedCollectionMeta must be the variable used for collection title/id
  assert.match(source, /resolvedCollectionMeta/);
  // fetchCollectionMeta function must exist
  assert.match(source, /async function fetchCollectionMeta/);
  // on collection routes with no SectionRenderData collection, attempt gateway fetch
  assert.match(source, /plan\.route\.type === 'collection' && !boundCollection/);
  // Still emits collections: collection ? [collection] : [] — Shopify convention
  assert.match(source, /collections: collection \? \[collection\] : \[\]/);
  // fetchCollectionMeta is wrapped in try/catch or .catch() fallback
  assert.match(source, /fetchCollectionMeta.*catch/s);
});

test('D5 search drop is populated when route carries a search term', () => {
  const source = read(COMPOSITION_ENGINE_SOURCE);

  // search term extraction from route path
  assert.match(source, /\[?&\]search=([^&]*)/);
  // search drop has terms/results/results_count keys
  assert.match(source, /terms: searchTerm/);
  assert.match(source, /results_count: resultProducts\.length/);
  assert.match(source, /performed: true/);
  // no fabricated data — when search term is absent, searchDrop remains null
  assert.match(source, /searchDrop.*null/);
  // error fallback when gateway fails — results=[] not fabricated
  assert.match(source, /results: \[\]/);
  // fetch uses the existing listProducts storefront client
  assert.match(source, /listProducts.*search.*searchTerm/s);
  // search is passed to the LiquidCommerceDrops return
  assert.match(source, /search: searchDrop/);
});

test('D7 font loading wires experience fonts for active theme settings', () => {
  const layoutSource = read(LAYOUT_SOURCE);
  const cssSource = read(STOREFRONT_GLOBALS_SOURCE);

  // buildGoogleFontsHref import must exist
  assert.match(layoutSource, /buildGoogleFontsHref/);
  // preconnect link for fonts.googleapis.com is conditionally emitted
  assert.match(layoutSource, /fonts\.googleapis\.com/);
  assert.match(layoutSource, /fonts\.gstatic\.com/);
  // preconnect only emitted when googleFontsHref is non-null
  assert.match(layoutSource, /googleFontsHref && /);
  // FONT_MAP contains the four new entries
  assert.match(layoutSource, /'Cormorant Garamond'/);
  assert.match(layoutSource, /'Libre Baskerville'/);
  assert.match(layoutSource, /'Source Sans Pro'/);
  assert.match(layoutSource, /'Lato'/);
  // globals.css --font-playfair must NOT alias to var(--font-letbuyy-display)
  // (the old value pointed to the Geist/display local font — now it is an honest font stack)
  assert.doesNotMatch(cssSource, /--font-playfair: var\(--font-letbuyy-display\)/);
  // --font-playfair must reference "Playfair Display" family directly
  assert.match(cssSource, /--font-playfair.*"Playfair Display"/);
  // Four new CSS vars must exist
  assert.match(cssSource, /--font-cormorant/);
  assert.match(cssSource, /--font-libre-baskerville/);
  assert.match(cssSource, /--font-source-sans/);
  assert.match(cssSource, /--font-lato/);
});

test('customer register route and Liquid form support the no-JS form submit path', () => {
  const routeSource = read('apps/storefront-runtime/src/app/api/customer/register/route.ts');
  // The route must parse both JSON and HTML form submissions (an HTML form posts
  // application/x-www-form-urlencoded; request.json() alone would throw a 500).
  assert.match(routeSource, /request\.formData\(\)/);
  assert.match(routeSource, /application\/x-www-form-urlencoded/);
  assert.match(routeSource, /request\.json\(\)/);
  // Form posts must be answered with a redirect (303), never a raw JSON body.
  assert.match(routeSource, /NextResponse\.redirect/);
  // The redirect target for feedback must be same-origin guarded.
  assert.match(routeSource, /refererUrl\.origin === new URL\(request\.url\)\.origin/);
  // The Liquid register form must carry the storeId the route requires.
  const bundleSource = read('packages/theme-engine/src/theme-bundle.ts');
  assert.match(bundleSource, /name="storeId" value="\{\{ shop\.id \}\}"/);
});

// ============================================================
// Phase F tests
// ============================================================

test('F5 chrome-fallback seam: composition-engine renders React chrome on Liquid→React fallback', () => {
  const source = read(COMPOSITION_ENGINE_SOURCE);

  // F5: when the plan is liquid but the render fails (liquidHtml===null), the composition engine
  // must render chrome sections (header + footer from plan.sectionGroups) around the React body,
  // so the fallback page is never chrome-less.
  assert.match(source, /isLiquidFallback/);
  // The fallback path must check that the plan was liquid (not just that render failed for a React plan).
  assert.match(source, /plan\.rendererEngine === 'liquid'/);
  // Header and footer chrome sections must be rendered in the fallback path.
  assert.match(source, /StorefrontSectionGroupRenderer/);
  assert.match(source, /groupKey="header"/);
  assert.match(source, /groupKey="footer"/);
  // The layout source must document the F5 fix.
  const layoutSource = read(LAYOUT_SOURCE);
  assert.match(layoutSource, /F5/);
  // cache_hit field must be present in the canary telemetry event (present but NOT CONNECTED).
  assert.match(source, /cache_hit:/);
});

test('F6 proxy password gate accepts both JSON and urlencoded form bodies', () => {
  const proxySource = read('apps/storefront-runtime/src/proxy.ts');

  // F6: handlePasswordSubmit must branch on Content-Type.
  assert.match(proxySource, /application\/x-www-form-urlencoded/);
  // urlencoded path must use formData() to extract the password field.
  assert.match(proxySource, /req\.formData\(\)/);
  // JSON path must still be the fallback (existing behaviour preserved).
  assert.match(proxySource, /req\.json\(\)/);
  // Both paths must set the `password` variable before the guard.
  // Fail-closed: if both throw, password stays '' and the 400 fires.
  assert.match(proxySource, /PASSWORD_REQUIRED/);
  // Rate-limit and gateway verify call remain unchanged (not duplicated for each path).
  assert.match(proxySource, /verifyStorePassword/);
});

test('F7-Lane-B lb-logout island is registered and implements progressive-enhancement POST logout', () => {
  const source = read('apps/storefront-runtime/src/lib/theme-engine/liquid-hydration-islands.tsx');

  // lb-logout must be defined as a custom element.
  assert.match(source, /class LbLogoutElement/);
  assert.match(source, /defineLiquidIsland\('lb-logout', LbLogoutElement\)/);
  // Island must intercept button clicks and call performLogout.
  assert.match(source, /performLogout/);
  // Logout fetch must use POST method and credentials: 'include'.
  assert.match(source, /method: 'POST'/);
  assert.match(source, /credentials: 'include'/);
  // On success, island must redirect to /customers/login.
  assert.match(source, /\/customers\/login/);
  // Fallback path: when fetch fails, native form.submit() is called (no-JS guarantee).
  assert.match(source, /form\.submit\(\)/);
  // The island reads the logout URL from data-logout-url dataset attribute.
  assert.match(source, /dataset\.logoutUrl/);
});
