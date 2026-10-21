import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const THEME_BUNDLE = 'packages/theme-engine/src/theme-bundle.ts';
const SCHEMA_REGISTRY = 'services/api-gateway/src/execution/schema-registry-execution.adapter.ts';
const THEMES_ROUTE = 'services/api-gateway/src/routes/themes.ts';
const THEME_AUXILIARY_ROUTES = 'services/api-gateway/src/lib/theme-marketplace-auxiliary-routes.ts';
const MARKETPLACE_REVIEW_ROUTE = 'services/api-gateway/src/routes/operations/marketplace-reviews.ts';
const MERCHANT_INSTALL_ROUTE = 'apps/merchant/web/src/app/api/themes/install/route.ts';
const THEME_SERVICE = 'apps/frozen/theme-store/src/lib/theme-service.ts';
const THEME_DETAIL_PAGE = 'apps/frozen/theme-store/src/app/themes/[slug]/page.tsx';
const THEME_INSTALL_PAGE = 'apps/frozen/theme-store/src/app/install/page.tsx';
const THEME_CHECKOUT_SUCCESS = 'apps/frozen/theme-store/src/app/checkout/success/page.tsx';
const THEME_PROXY = 'apps/frozen/theme-store/src/proxy.ts';
const API_CLIENT = 'packages/typescript/api-client/src/index.ts';
const STOREFRONT_STORE_SERVICE = 'apps/commerce/web/src/lib/store-service.ts';

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
  assert.match(registry, /const packageStatus = 'draft'/);
  assert.match(registry, /const versionStatus = reviewRequired \? 'draft' : payload\.themePackageVersion\.release_status/);
  assert.match(registry, /is_active: installable/);
  assert.match(registry, /rpc\('upload_owned_theme_package_v1'/);
  assert.match(registry, /p_mode: options\.publicationMode \|\| 'marketplace'/);

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
  assert.match(themeExecution, /rpc\('install_owned_theme_v1'/);
  const installer = read('database/supabase/migrations/377_theme_install_event_contract.sql');
  for (const field of ['site_id','theme_package_id','theme_version_id','installation_id']) assert.ok(installer.includes("'"+field+"'"),field);
  assert.match(storefrontStoreService, /current_theme_release/);
  assert.match(storefrontStoreService, /release\?\.template_snapshot \|\| release\?\.release_config/);
  assert.match(storefrontStoreService, /normalizeTemplates\(templateConfig\.templates/);
  assert.match(storefrontStoreService, /injectAppBlocksIntoTemplates\(templates, appBlocks\)/);
});

test('marketplace rollback preserves the reviewed current-release precondition across retries', async () => {
  const [{ default: ts }, { runInNewContext }] = await Promise.all([import('typescript'), import('node:vm')]);
  const calls=[];
  const module={exports:{}};
  const compiled=ts.transpileModule(read(THEME_SERVICE),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(compiled,{module,exports:module.exports,require:name=>{
    if(name==='server-only')return {};
    if(name==='@/lib/api/client')return {createThemeMarketplaceApiClient:async()=>({themes:{rollbackRelease:async(...args)=>{calls.push(args);return {accepted:true};}}})};
    throw Error(`Unexpected rollback dependency: ${name}`);
  }});
  const service=module.exports.ThemeService;
  await service.rollbackThemeRelease('fixture-theme','fixture-store','reviewed-target','reviewed-current');
  await service.rollbackThemeRelease('fixture-theme','fixture-store','reviewed-target','reviewed-current');
  await service.rollbackThemeRelease('fixture-theme','fixture-store','reviewed-target','new-reviewed-current');
  assert.equal(calls.length,3);
  assert.equal(calls[0][2].store_id,'fixture-store');
  assert.equal(calls[0][2].expected_current_release_id,'reviewed-current');
  assert.equal(calls[1][2].idempotency_key,calls[0][2].idempotency_key);
  assert.notEqual(calls[2][2].idempotency_key,calls[0][2].idempotency_key);
  const page=read('apps/frozen/theme-store/src/app/dashboard/installations/page.tsx');
  assert.match(page,/name="expected_current_release_id" value=\{String\(currentRelease.id\)\}/);
  assert.match(page,/!expectedCurrentReleaseId/);
});
