import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const THEME_BUNDLE = 'packages/theme-engine/src/theme-bundle.ts';
const SCHEMA_REGISTRY = 'services/api-gateway/src/execution/schema-registry-execution.adapter.ts';
const THEMES_ROUTE = 'services/api-gateway/src/routes/themes.ts';
const THEME_AUXILIARY_ROUTES = 'services/api-gateway/src/lib/theme-marketplace-auxiliary-routes.ts';
const MARKETPLACE_REVIEW_ROUTE = 'services/api-gateway/src/routes/operations/marketplace-reviews.ts';
const MERCHANT_INSTALL_ROUTE = 'apps/merchant-control-plane/src/app/api/themes/install/route.ts';
const THEME_SERVICE = 'apps/theme-marketplace/src/lib/theme-service.ts';
const THEME_DETAIL_PAGE = 'apps/theme-marketplace/src/app/themes/[slug]/page.tsx';
const THEME_INSTALL_PAGE = 'apps/theme-marketplace/src/app/install/page.tsx';
const THEME_CHECKOUT_SUCCESS = 'apps/theme-marketplace/src/app/checkout/success/page.tsx';
const THEME_PROXY = 'apps/theme-marketplace/src/proxy.ts';
const API_CLIENT = 'packages/typescript/api-client/src/index.ts';
const STOREFRONT_STORE_SERVICE = 'apps/storefront-runtime/src/lib/store-service.ts';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('theme package uploads default to review-gated marketplace submissions', () => {
  const bundle = read(THEME_BUNDLE);
  const registry = read(SCHEMA_REGISTRY);
  const route = read(THEMES_ROUTE);

  assert.match(bundle, /submission_mode: z\.enum\(\['marketplace', 'private_install'\]\)\.default\('marketplace'\)/);
  assert.match(registry, /publicationMode\?: 'marketplace' \| 'private_install'/);
  assert.match(registry, /const reviewRequired = options\.publicationMode !== 'private_install'/);
  assert.match(registry, /const packageStatus = reviewRequired \? 'draft' : payload\.themePackage\.status/);
  assert.match(registry, /const versionStatus = reviewRequired \? 'draft' : payload\.themePackageVersion\.release_status/);
  assert.match(registry, /is_active: installable/);
  assert.match(registry, /review_required: reviewRequired/);

  assert.match(route, /const submissionMode = body\.submission_mode \|\| 'marketplace'/);
  assert.match(route, /publicationMode: submissionMode/);
  assert.match(route, /if \(submissionMode === 'private_install'\)/);
  assert.match(route, /review_record: null/);
  assert.match(route, /createMarketplaceReviewRecord\(db/);
  assert.match(route, /emitThemeSubmittedEvent\(db/);
});

test('ops approval publishes theme packages into the public marketplace catalog', () => {
  const route = read(MARKETPLACE_REVIEW_ROUTE);

  assert.match(route, /function themePackageStatusForDecision/);
  assert.match(route, /if \(decision === 'approved'\) return 'active'/);
  assert.match(route, /function themeVersionStatusForDecision/);
  assert.match(route, /if \(decision === 'approved'\) return 'published'/);
  assert.match(route, /from\('theme_packages'\)/);
  assert.match(route, /status: themePackageStatusForDecision\(decision\)/);
  assert.match(route, /from\('theme_package_versions'\)/);
  assert.match(route, /release_status: themeVersionStatusForDecision\(decision\)/);
  assert.match(route, /from\('themes'\)/);
  assert.match(route, /is_active: decision === 'approved'/);
  assert.match(route, /return 'theme\.approved'/);
});

test('theme marketplace install surface calls the gateway through the typed client', () => {
  const service = read(THEME_SERVICE);
  const installPage = read(THEME_INSTALL_PAGE);
  const detailPage = read(THEME_DETAIL_PAGE);
  const checkoutSuccess = read(THEME_CHECKOUT_SUCCESS);
  const proxy = read(THEME_PROXY);
  const apiClient = read(API_CLIENT);

  assert.match(apiClient, /submission_mode\?: 'marketplace' \| 'private_install'/);
  assert.match(apiClient, /install: \(slug: string, input: ThemeInstallInput/);
  assert.match(apiClient, /`\/themes\/\$\{encodePathSegment\(slug\)\}\/install`/);

  assert.match(service, /api\.stores\.list\(\{ limit: 50 \}\)/);
  assert.match(service, /api\.themes\.install\(slug/);
  assert.doesNotMatch(service, /config_overrides: \{\}/);
  assert.doesNotMatch(service, /@supabase\//);

  assert.match(installPage, /async function installThemeAction\(formData: FormData\)/);
  assert.match(installPage, /ThemeService\.getUserStores\(\)/);
  assert.match(installPage, /ThemeService\.installTheme\(slug, storeId, \{/);
  assert.match(installPage, /name="preset"/);
  assert.match(installPage, /name="store_id"/);
  assert.match(installPage, /\/dashboard\/installations\?installed=/);
  assert.doesNotMatch(installPage, /@supabase\//);

  assert.match(detailPage, /const addHref = isFree \? `\/install\?theme=\$\{encodeURIComponent\(theme\.slug\)\}` : `\/checkout\?theme=\$\{encodeURIComponent\(theme\.slug\)\}`/);
  assert.match(detailPage, /href: addHref/);
  assert.match(detailPage, /href=\{addHref\}/);
  assert.match(checkoutSuccess, /`\/install\?theme=\$\{themeSlug\}`/);
  assert.match(proxy, /const PROTECTED_ROUTES = \['\/checkout', '\/dashboard', '\/install'\]/);
  assert.match(proxy, /'\/install\/:path\*'/);
});

test('theme marketplace step-up routes expose reviews receipts downloads settings and developer listings', () => {
  const route = read(THEMES_ROUTE);
  const auxiliaryRoutes = read(THEME_AUXILIARY_ROUTES);
  const apiClient = read(API_CLIENT);
  const service = read(THEME_SERVICE);
  const migration = read('database/supabase/migrations/091_theme_marketplace_stepup.sql');
  const verification = read('database/supabase/verification/091_theme_marketplace_stepup_catalog_integrity.sql');

  assert.match(route, /mountThemeMarketplaceAuxiliaryRoutes\(router\)/);

  for (const pattern of [
    /router\.get\('\/suggest'/,
    /router\.get\('\/collections'/,
    /router\.get\('\/authors\/:handle'/,
    /router\.get\('\/purchases\/:purchaseId\/receipt'/,
    /router\.get\('\/downloads\/list'/,
    /router\.put\('\/settings'/,
    /router\.post\('\/developer\/listings'/,
    /router\.get\('\/:slug\/reviews'/,
    /router\.post\('\/:slug\/reviews'/,
    /router\.get\('\/:slug\/downloads\/:platform'/,
    /router\.post\('\/:slug\/refunds'/,
  ]) {
    assert.match(`${route}\n${auxiliaryRoutes}`, pattern);
  }

  for (const method of [
    /suggestions: \(query: string/,
    /collections: \(options/,
    /author: \(handle: string/,
    /downloads: \(options/,
    /receipt: \(purchaseId: string/,
    /updateSettings: \(input:/,
    /createReview: \(slug: string/,
    /createDeveloperListing: \(input:/,
  ]) {
    assert.match(apiClient, method);
  }

  assert.match(service, /getThemeReviews/);
  assert.match(service, /getThemeDownloads/);
  assert.match(service, /getThemeReceipt/);
  assert.match(service, /updateMarketplaceSettings/);
  assert.match(service, /createDeveloperListing/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.theme_purchase_receipts/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.theme_download_artifacts/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.theme_developer_listings/);
  assert.match(verification, /Theme marketplace step-up tables missing/);
});

test('private admin uploads remain installable without marketplace review', () => {
  const route = read(MERCHANT_INSTALL_ROUTE);

  assert.match(route, /client\.themes\.uploadPackage/);
  assert.match(route, /submission_mode: 'private_install'/);
  assert.match(route, /client\.themes\.install\(installSlug/);
});

test('installed themes render from the storefront release snapshot without storefront code changes', () => {
  const themeExecution = read('services/api-gateway/src/execution/theme-execution.adapter.ts');
  const storefrontStoreService = read(STOREFRONT_STORE_SERVICE);

  assert.match(themeExecution, /publishReleaseSnapshot/);
  assert.match(themeExecution, /eventType: 'theme\.installed'/);
  assert.match(themeExecution, /theme_package_id: runtime\.themePackageId/);
  assert.match(themeExecution, /theme_version_id: runtime\.themePackageVersionId/);
  assert.match(storefrontStoreService, /current_theme_release/);
  assert.match(storefrontStoreService, /release\?\.template_snapshot \|\| release\?\.release_config/);
  assert.match(storefrontStoreService, /normalizeTemplates\(templateConfig\.templates/);
  assert.match(storefrontStoreService, /injectAppBlocksIntoTemplates\(templates, appBlocks\)/);
});
