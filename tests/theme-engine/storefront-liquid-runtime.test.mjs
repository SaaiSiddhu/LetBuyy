import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const TEMPLATE_RESOLVER_SOURCE = 'apps/commerce/web/src/lib/theme-engine/template-resolver.ts';
const COMPOSITION_ENGINE_SOURCE = 'apps/commerce/web/src/lib/theme-engine/composition-engine.tsx';
const DATA_BINDING_SOURCE = 'apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts';
const STOREFRONT_TYPES_SOURCE = 'apps/commerce/web/src/lib/theme-engine/types.ts';
const STOREFRONT_GLOBALS_SOURCE = 'apps/commerce/web/src/app/globals.css';
const CUSTOMER_DROP_SOURCE = 'apps/commerce/web/src/lib/customer-drop.ts';
const LAYOUT_SOURCE = 'apps/commerce/web/src/app/store/[subdomain]/layout.tsx';
const LIQUID_PAGE_ASSEMBLY_SOURCE = 'apps/commerce/web/src/lib/theme-engine/liquid-page-assembly.ts';
const STOREFRONT_LIQUID_THEME_CSS_SOURCE = 'apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css';
const THEME_RENDERER_SOURCE = 'packages/theme-engine/src/theme-renderer.ts';

function read(path) {
  return readFileSync(path, 'utf8');
}

// The selectors of every style rule in a stylesheet, with comments removed and at-rule preludes
// (@media, @layer, ...) skipped, so a comment that mentions a class is not a rule for it.
function cssRuleSelectors(css) {
  const selectors = [];
  for (const [, prelude] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{};]+)\{/g)) {
    const trimmed = prelude.trim();
    if (!trimmed || trimmed.startsWith('@')) continue;
    selectors.push(...trimmed.split(',').map((selector) => selector.trim()));
  }
  return selectors;
}

// True when some rule names the class as a whole token: `.lb-header` is not satisfied by
// `.lb-header__brand`, nor `.lb-theme` by `.lb-theme--urban-kicks`.
function hasRuleForClass(selectors, className) {
  const pattern = new RegExp(`\\.${className.replace(/^\./, '')}(?![\\w-])`);
  return selectors.some((selector) => pattern.test(selector));
}

// LIQUID_THEME_BASE_CSS, the portable stylesheet theme-renderer.ts ships with every Liquid theme
// (buildLiquidThemeHeadAssets → headStyleText), is an array of single-quoted CSS strings joined with ''.
function liquidThemeBaseCss() {
  const source = read(THEME_RENDERER_SOURCE);
  const start = source.indexOf('export const LIQUID_THEME_BASE_CSS = [');
  const end = source.indexOf("].join('');", start);
  assert.ok(start > -1 && end > start, 'theme-renderer.ts must export LIQUID_THEME_BASE_CSS as a joined array of strings');
  const body = source.slice(start, end).replace(/^\s*\/\/.*$/gm, '');
  return [...body.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'/g)].map(([, text]) => text).join('');
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
  // After the render-result refactor, the page is header + contentForLayout + footer from result.liquid
  // (not layoutHtml directly). c5a9fe98 (2026-08-25) moved that destructuring + concatenation out of
  // composition-engine.tsx into liquid-page-assembly.ts, a module free of 'server-only' imports so it
  // can be unit-tested, and made it carry the theme's headStyleText too. composition-engine hands every
  // rendered result to it; verify the delegation and the destructuring + concatenation contract there.
  const assemblySource = read(LIQUID_PAGE_ASSEMBLY_SOURCE);
  assert.match(source, /import \{[^}]*assembleLiquidPageFromRenderResult[^}]*\} from '\.\/liquid-page-assembly';/);
  assert.match(
    source,
    /if \(result\.status !== 'rendered' \|\| !result\.liquid\) return null;\s*return assembleLiquidPageFromRenderResult\(result\.liquid, \{ beforeContentHtml: productOriginFilterMarkup\(plan\.route, editorMode\), afterContentHtml \}\);/,
  );
  assert.match(assemblySource, /export function assembleLiquidPageFromRenderResult\(\s*liquid: LiquidRenderedTheme,\s*controls: LiquidPlatformControls = \{\},?\s*\)/);
  assert.match(assemblySource, /const \{ header, contentForLayout, footer(?:, \w+)* \} = liquid;/);
  assert.ok(assemblySource.includes("html: `${header || ''}${controls.beforeContentHtml || ''}${contentForLayout}${controls.afterContentHtml || ''}${footer || ''}`"));
  assert.doesNotMatch(source, /return result\.liquid\.contentForLayout/);
  assert.doesNotMatch(assemblySource, /html: (?:liquid\.)?contentForLayout\b/);
  assert.match(source, /data-theme-renderer="liquid"/);
  assert.ok(source.includes('dangerouslySetInnerHTML={{ __html: html }}'));
  assert.doesNotMatch(source, /data-lb-liquid-region/);
});

test('Liquid storefront plans bind catalog data and cart drops without fabricating server cart state', () => {
  const dataBindingSource = read(DATA_BINDING_SOURCE);
  const compositionSource = read(COMPOSITION_ENGINE_SOURCE);
  const typesSource = read(STOREFRONT_TYPES_SOURCE);

  assert.match(dataBindingSource, /'liquid\.section\.product-grid'/);
  assert.match(dataBindingSource, /'liquid\.section\.featured-products'/);
  assert.match(dataBindingSource, /'liquid\.section\.product-detail'/);
  assert.match(dataBindingSource, /function sectionRequestsSingleProduct/);
  assert.match(typesSource, /cart\?: Record<string, unknown>/);
  assert.match(compositionSource, /function collectLiquidCart/);
  assert.match(compositionSource, /source: 'browser_hydrated'/);
  assert.match(compositionSource, /sync_url: `\/api\/storefront\/\$\{plan\.route\.subdomain\}\/cart`/);

  // The storefront styles what it renders. These assertions used to read globals.css, whose
  // `@layer components { .lb-theme, .lb-header, ... }` block 89b62ea2 (2026-08-25) deleted as a stale
  // duplicate that overrode the real layout ("liquid-theme.css is the sole owner of Liquid layout").
  // They now read the owner, which the store layout imports, and count only real rules.
  assert.match(read(LAYOUT_SOURCE), /^import '\.\/liquid-theme\.css';$/m);
  const storefrontSelectors = cssRuleSelectors(read(STOREFRONT_LIQUID_THEME_CSS_SOURCE));
  // The theme root. composition-engine renders the Liquid page into an element carrying
  // data-theme-renderer="liquid", and liquid-theme.css styles that element itself.
  assert.match(compositionSource, /<div\s+data-theme-renderer="liquid"/);
  assert.match(compositionSource, /dangerouslySetInnerHTML=\{\{ __html: html \}\}/);
  assert.ok(
    storefrontSelectors.includes('[data-theme-renderer="liquid"]'),
    'liquid-theme.css must style the Liquid render root itself',
  );
  assert.ok(hasRuleForClass(storefrontSelectors, 'lb-header'), 'liquid-theme.css must style .lb-header');
  assert.ok(hasRuleForClass(storefrontSelectors, 'lb-product-grid__items'), 'liquid-theme.css must style .lb-product-grid__items');
  // The portable stylesheet every Liquid theme carries still styles .lb-theme, the class the theme
  // layouts put on <body>. On this runtime that rule matches nothing: composition-engine renders the
  // header, template and footer sections, never the layout's <body>, which is why the root rule
  // above exists (evidence: docs/evidence/liquid-contracts/F_LIQCONTRACT_1.md, finding 1).
  assert.ok(hasRuleForClass(cssRuleSelectors(liquidThemeBaseCss()), 'lb-theme'), 'LIQUID_THEME_BASE_CSS must style .lb-theme');
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
  // Discovery is independent of the current collection/product slice.
  assert.match(source, /collections: discoveredCollections\.map/);
  assert.match(source, /handle: item\.id/);
  assert.doesNotMatch(source, /collections: collection \? \[collection\] : \[\]/);
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

test('legacy customer register entry routes to canonical buyer sign-in', () => {
  const routeSource = read('apps/commerce/web/src/app/api/customer/register/route.ts');
  // Stale Liquid form posts must enter the canonical buyer PKCE flow without
  // reviving store-local account creation.
  assert.match(routeSource, /application\/x-www-form-urlencoded/);
  assert.match(routeSource, /buyer-auth\/start/);
  assert.match(routeSource, /return_to/);
  assert.match(routeSource, /NextResponse\.redirect/);
  assert.match(routeSource, /refererUrl\.origin === new URL\(request\.url\)\.origin/);
  assert.match(routeSource, /CANONICAL_BUYER_ACCOUNT_REQUIRED/);
  assert.match(routeSource, /status: 410/);

  const bundleSource = read('packages/theme-engine/src/theme-bundle.ts');
  const sectionStart = bundleSource.indexOf("'customer-register': createLiquidSectionFile");
  assert.notEqual(sectionStart, -1);
  const sectionEnd = bundleSource.indexOf("'customer-settings': createLiquidSectionFile", sectionStart);
  const registerSection = bundleSource.slice(sectionStart, sectionEnd);
  assert.match(registerSection, /href="\/api\/buyer-auth\/start\?return_to=\{\{ routes\.account_url \}\}"/);
  assert.match(registerSection, /Create or sign in with LetBuyy/);
  assert.doesNotMatch(registerSection, /method="post"|name="storeId"/);
});

test('storefront account entry avoids public store-customer account enumeration', () => {
  const accountSheet = read('apps/commerce/web/src/components/account/account-bottom-sheet.tsx');
  const lookupRoute = read('apps/commerce/web/src/app/api/customer/check/route.ts');

  assert.doesNotMatch(accountSheet, /checkEmail|\/api\/customer\/check/);
  assert.match(accountSheet, /Continue with LetBuyy/);
  assert.match(accountSheet, /Continue to older store-only sign-in/);
  assert.match(lookupRoute, /status:\s*410/);
  assert.doesNotMatch(lookupRoute, /customerStatus|createStorefrontApiClient/);
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
  const proxySource = read('apps/commerce/web/src/proxy.ts');

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
  const source = read('apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx');

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
