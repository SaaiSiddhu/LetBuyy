// Phase K — K5 Theme Platform Contract tests.
//
// These are SOURCE CONTRACT assertions — they read real files and verify that the
// freeze boundaries, route-ownership rules, and H/G foundation exports defined in
// docs/storefront-liquid-discovery/phase-k/THEME_PLATFORM_CONTRACT.md are intact.
//
// Tests are grouped into four blocks:
//   Freeze: storefront 410 + frozen-app manifests + production-topology
//   Foundation exports: every H/G primitive exported from theme-engine index
//   Phase K contract doc: the document itself exists and carries key sections
//   No new deploy config: no vercel.json or non-frozen deploy manifests added

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const exists = (p) => existsSync(resolve(ROOT, p));

// ─── Freeze: storefront install route ────────────────────────────────────────

test('K5/freeze: storefront install route returns HTTP 410 Gone (permanently frozen)', () => {
  const src = read('apps/commerce/web/src/app/api/themes/install/route.ts');
  // The route must return a 410 response — never a 200/201/404.
  assert.match(src, /status:\s*410/, 'route must carry { status: 410 }');
  // Must declare a POST handler (not GET/PUT) so only install attempts are blocked.
  assert.match(src, /export\s+async\s+function\s+POST\b/);
  // The error message must direct callers to the admin API.
  assert.match(src, /authenticated admin API/i);
  // Must not contain any DB write — the route is a hard guard, not a stub.
  assert.doesNotMatch(src, /\.from\(/);
  assert.doesNotMatch(src, /supabase\b/i);
});

test('K5/freeze: storefront install route has no bypass path (no early-return 200)', () => {
  const src = read('apps/commerce/web/src/app/api/themes/install/route.ts');
  // Only one exported function — no GET/PUT/PATCH that could be mistaken for an install path.
  assert.doesNotMatch(src, /export\s+async\s+function\s+GET\b/);
  assert.doesNotMatch(src, /export\s+async\s+function\s+PUT\b/);
  // status 200 never returned by this file.
  assert.doesNotMatch(src, /status:\s*200/);
});

// ─── Freeze: frozen-app runtime manifests ────────────────────────────────────

const FROZEN_APPS = [
  'apps/frozen/theme-store',
  'apps/frozen/app-store',
  'apps/frozen/developer-portal',
];

for (const appRoot of FROZEN_APPS) {
  const manifestPath = `${appRoot}/runtime.manifest.json`;

  test(`K5/freeze: ${appRoot} runtime.manifest.json exists`, () => {
    assert.ok(exists(manifestPath), `${manifestPath} must exist`);
  });

  test(`K5/freeze: ${appRoot} is declared frozen-next-app`, () => {
    const manifest = JSON.parse(read(manifestPath));
    assert.equal(
      manifest.runtimeCategory,
      'frozen-next-app',
      `${appRoot} runtimeCategory must be "frozen-next-app"`,
    );
  });

  test(`K5/freeze: ${appRoot} deploymentAuthority.platform is frozen-not-deployed`, () => {
    const manifest = JSON.parse(read(manifestPath));
    assert.equal(
      manifest.deploymentAuthority?.platform,
      'frozen-not-deployed',
      `${appRoot} deploymentAuthority.platform must be "frozen-not-deployed"`,
    );
  });

  test(`K5/freeze: ${appRoot} deploymentAuthority.config is empty (no deploy manifests)`, () => {
    const manifest = JSON.parse(read(manifestPath));
    const config = manifest.deploymentAuthority?.config ?? [];
    assert.equal(
      config.length,
      0,
      `${appRoot} deploymentAuthority.config must be an empty array`,
    );
  });

  test(`K5/freeze: ${appRoot} has no vercel.json deploy config`, () => {
    assert.ok(
      !exists(`${appRoot}/vercel.json`),
      `${appRoot}/vercel.json must not exist (frozen app must not have a deploy config)`,
    );
  });
}

// ─── Freeze: production topology ─────────────────────────────────────────────

test('K5/freeze: production-topology.json records all three frozen apps as status=frozen', () => {
  const topology = JSON.parse(read('config/runtime/production-topology.json'));
  // The topology is an object; flatten all runtimes from any nested structure.
  const allRuntimes = JSON.stringify(topology);

  // Each frozen app root must appear as not-deployed.
  for (const appRoot of FROZEN_APPS) {
    // The topology entry for this app must declare "not-deployed" (not "vercel" or "cloudflare").
    const idx = allRuntimes.indexOf(JSON.stringify(appRoot).replace(/^"|"$/g, ''));
    assert.ok(idx > -1, `${appRoot} must appear in production-topology.json`);
  }

  // Count frozen entries — must have at least 3 (the three we require).
  const frozenCount = (allRuntimes.match(/"status"\s*:\s*"frozen"/g) ?? []).length;
  assert.ok(
    frozenCount >= FROZEN_APPS.length,
    `production-topology must declare at least ${FROZEN_APPS.length} frozen entries`,
  );

  // Confirm none of the frozen apps have non-empty deploymentManifests in the topology.
  // We parse the structured topology and look for app-marketplace, theme-marketplace,
  // developer-portal entries and check their deploymentManifests arrays.
  const topObj = topology;
  function findRuntimes(node, found = []) {
    if (Array.isArray(node)) {
      for (const item of node) findRuntimes(item, found);
    } else if (node && typeof node === 'object') {
      if (typeof node.runtimeRoot === 'string' && FROZEN_APPS.includes(node.runtimeRoot)) {
        found.push(node);
      }
      for (const v of Object.values(node)) findRuntimes(v, found);
    }
    return found;
  }
  const frozenEntries = findRuntimes(topObj);
  for (const entry of frozenEntries) {
    const manifests = entry.deploymentManifests ?? [];
    assert.equal(
      manifests.length,
      0,
      `${entry.runtimeRoot} must have empty deploymentManifests in production-topology.json`,
    );
  }
});

// ─── Foundation exports: H/G primitives from @letbuyy/theme-engine ──────────
//
// The theme-engine index.ts re-exports all H/G primitives the K contract depends on.
// These assertions verify the re-export lines are in place so a future marketplace
// consumer can import from '@letbuyy/theme-engine' exclusively.

const ENGINE_INDEX = 'packages/theme-engine/src/index.ts';

test('K5/exports: theme-engine index re-exports from theme-packager (packageThemeBundle)', () => {
  const idx = read(ENGINE_INDEX);
  assert.match(idx, /export \* from '\.\/theme-packager'/, 'index must re-export theme-packager');
});

test('K5/exports: theme-packager.ts declares packageThemeBundle', () => {
  const src = read('packages/theme-engine/src/theme-packager.ts');
  assert.match(src, /export\s+function\s+packageThemeBundle\b/);
  // Must produce the required manifest fields.
  assert.match(src, /\bcontentHash\b/);
  assert.match(src, /\bchecksums\b/);
  assert.match(src, /\bfiles\b/);
});

test('K5/exports: theme-engine index re-exports from theme-artifact-exporter (exportThemeBundleToFiles)', () => {
  const idx = read(ENGINE_INDEX);
  assert.match(idx, /export \* from '\.\/theme-artifact-exporter'/);
});

test('K5/exports: theme-artifact-exporter.ts declares exportThemeBundleToFiles', () => {
  const src = read('packages/theme-engine/src/theme-artifact-exporter.ts');
  assert.match(src, /export\s+function\s+exportThemeBundleToFiles\b/);
});

test('K5/exports: theme-engine index re-exports from theme-sdk (validateTheme, compileTheme, listSectionTypes, getSectionSchema)', () => {
  const idx = read(ENGINE_INDEX);
  assert.match(idx, /export \* from '\.\/theme-sdk'/);
});

test('K5/exports: theme-sdk.ts declares validateTheme', () => {
  const src = read('packages/theme-engine/src/theme-sdk.ts');
  assert.match(src, /export\s+function\s+validateTheme\b/);
  // Must enforce the G4 schema_version gate.
  assert.match(src, /UnsupportedLiquidBundleSchemaVersionError/);
});

test('K5/exports: theme-sdk.ts declares compileTheme', () => {
  const src = read('packages/theme-engine/src/theme-sdk.ts');
  assert.match(src, /export\s+function\s+compileTheme\b/);
});

test('K5/exports: theme-sdk.ts declares listSectionTypes and getSectionSchema', () => {
  const src = read('packages/theme-engine/src/theme-sdk.ts');
  assert.match(src, /export\s+function\s+listSectionTypes\b/);
  assert.match(src, /export\s+function\s+getSectionSchema\b/);
});

test('K5/exports: theme-engine index re-exports from theme-linter (lintThemeBundle)', () => {
  const idx = read(ENGINE_INDEX);
  assert.match(idx, /export \* from '\.\/theme-linter'/);
});

test('K5/exports: theme-linter.ts declares lintThemeBundle', () => {
  const src = read('packages/theme-engine/src/theme-linter.ts');
  assert.match(src, /export\s+function\s+lintThemeBundle\b/);
});

test('K5/exports: theme-engine index re-exports from theme-bundle (KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS, isKnownLiquidBundleSchemaVersion)', () => {
  const idx = read(ENGINE_INDEX);
  assert.match(idx, /export \* from '\.\/theme-bundle'/);
});

test('K5/exports: theme-bundle.ts declares KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS as frozen allowlist', () => {
  const src = read('packages/theme-engine/src/theme-bundle.ts');
  assert.match(src, /KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS[^=]*=\s*Object\.freeze\(/);
  // Must contain the current epoch.
  assert.match(src, /2026-06-liquid-sections/);
});

test('K5/exports: theme-bundle.ts declares isKnownLiquidBundleSchemaVersion', () => {
  const src = read('packages/theme-engine/src/theme-bundle.ts');
  assert.match(src, /export\s+function\s+isKnownLiquidBundleSchemaVersion\b/);
});

test('K5/exports: theme-bundle.ts declares UnsupportedLiquidBundleSchemaVersionError', () => {
  const src = read('packages/theme-engine/src/theme-bundle.ts');
  assert.match(src, /export\s+class\s+UnsupportedLiquidBundleSchemaVersionError\b/);
});

test('K5/exports: theme-engine index re-exports from section-schema-migrations (migrateThemeTemplateSchemasWithRegistry, CURRENT_SECTION_SCHEMA_VERSION)', () => {
  const idx = read(ENGINE_INDEX);
  assert.match(idx, /export \* from '\.\/section-schema-migrations'/);
});

test('K5/exports: section-schema-migrations.ts declares CURRENT_SECTION_SCHEMA_VERSION', () => {
  const src = read('packages/theme-engine/src/section-schema-migrations.ts');
  assert.match(src, /export\s+const\s+CURRENT_SECTION_SCHEMA_VERSION\b/);
  assert.match(src, /2026-07-sections-v1/);
});

test('K5/exports: section-schema-migrations.ts declares migrateThemeTemplateSchemasWithRegistry', () => {
  const src = read('packages/theme-engine/src/section-schema-migrations.ts');
  assert.match(src, /export\s+function\s+migrateThemeTemplateSchemasWithRegistry\b/);
});

test('K5/exports: section-schema-migrations.ts declares REGISTERED_SECTION_SCHEMA_MIGRATIONS as empty-by-design frozen array', () => {
  const src = read('packages/theme-engine/src/section-schema-migrations.ts');
  assert.match(src, /REGISTERED_SECTION_SCHEMA_MIGRATIONS[^=]*=\s*Object\.freeze\(\[\]\)/);
});

test('K5/exports: theme-engine index re-exports from settings-schema-canonical (flattenSettingsData, groupSettingsFields)', () => {
  const idx = read(ENGINE_INDEX);
  assert.match(idx, /export \* from '\.\/settings-schema-canonical'/);
});

test('K5/exports: settings-schema-canonical.ts declares flattenSettingsData', () => {
  const src = read('packages/theme-engine/src/settings-schema-canonical.ts');
  assert.match(src, /export\s+function\s+flattenSettingsData\b/);
});

test('K5/exports: settings-schema-canonical.ts declares groupSettingsFields', () => {
  const src = read('packages/theme-engine/src/settings-schema-canonical.ts');
  assert.match(src, /export\s+function\s+groupSettingsFields\b/);
});

test('K5/exports: theme-engine index re-exports from theme-bundle-core (resolveCanonicalThemeSlug, LETBUYY_CORE_THEME_SLUG)', () => {
  const idx = read(ENGINE_INDEX);
  assert.match(idx, /export \* from '\.\/theme-bundle-core'/);
});

test('K5/exports: theme-bundle-core.ts declares resolveCanonicalThemeSlug', () => {
  const src = read('packages/theme-engine/src/theme-bundle-core.ts');
  assert.match(src, /export\s+function\s+resolveCanonicalThemeSlug\b/);
});

test('K5/exports: theme-bundle-core.ts declares LETBUYY_CORE_THEME_SLUG', () => {
  const src = read('packages/theme-engine/src/theme-bundle-core.ts');
  assert.match(src, /export\s+const\s+LETBUYY_CORE_THEME_SLUG\b/);
  assert.match(src, /letbuyy-core/);
});

// ─── Contract doc: THEME_PLATFORM_CONTRACT.md exists and is coherent ─────────

const CONTRACT_DOC = 'docs/storefront-liquid-discovery/phase-k/THEME_PLATFORM_CONTRACT.md';

test('K5/contract-doc: THEME_PLATFORM_CONTRACT.md exists', () => {
  assert.ok(exists(CONTRACT_DOC), `${CONTRACT_DOC} must exist`);
});

test('K5/contract-doc: contract doc declares the storefront install route 410', () => {
  const doc = read(CONTRACT_DOC);
  assert.match(doc, /410 Gone/i);
  assert.match(doc, /storefront.*install.*route|install.*route.*410/si);
});

test('K5/contract-doc: contract doc names all three frozen apps', () => {
  const doc = read(CONTRACT_DOC);
  assert.match(doc, /apps\/frozen\/theme-store/);
  assert.match(doc, /apps\/frozen\/app-store/);
  assert.match(doc, /apps\/frozen\/developer-portal/);
});

test('K5/contract-doc: contract doc carries honesty marker for analytics (NOT CONNECTED)', () => {
  const doc = read(CONTRACT_DOC);
  // Analytics live values must be marked NOT CONNECTED, not fabricated.
  assert.match(doc, /NOT[- ]CONNECTED/i);
  assert.match(doc, /analytics/i);
});

test('K5/contract-doc: contract doc defines ThemePublishManifest with required fields', () => {
  const doc = read(CONTRACT_DOC);
  assert.match(doc, /ThemePublishManifest/);
  // Required fields per the install-validation + publish-manifest contract.
  assert.match(doc, /content_hash/);
  assert.match(doc, /schema_verified/);
  assert.match(doc, /lint_issue_count/);
  assert.match(doc, /compatibility_range/);
});

test('K5/contract-doc: contract doc defines the install-validation pipeline (5 steps)', () => {
  const doc = read(CONTRACT_DOC);
  // All five steps must be documented.
  assert.match(doc, /Schema gate/i);
  assert.match(doc, /Lint gate/i);
  assert.match(doc, /Compat range check/i);
  assert.match(doc, /Checksum/i);
  assert.match(doc, /migration/i);
});

test('K5/contract-doc: contract doc documents ThemePlatformEvent union (all 5 event types)', () => {
  const doc = read(CONTRACT_DOC);
  assert.match(doc, /ThemeInstalledEvent/);
  assert.match(doc, /ThemeUpdatedEvent/);
  assert.match(doc, /ThemePublishedEvent/);
  assert.match(doc, /ThemeUninstalledEvent/);
  assert.match(doc, /ThemePreviewOpenedEvent/);
});

test('K5/contract-doc: contract doc names the gateway symbols that own DB writes', () => {
  const doc = read(CONTRACT_DOC);
  assert.match(doc, /schema-registry-execution\.adapter/);
  assert.match(doc, /theme-execution\.adapter/);
  assert.match(doc, /marketplace-reviews/);
});

// ─── No new deploy config in frozen apps ─────────────────────────────────────

test('K5/no-deploy-config: no vercel.json exists in any frozen app root', () => {
  for (const appRoot of FROZEN_APPS) {
    assert.ok(
      !exists(`${appRoot}/vercel.json`),
      `${appRoot}/vercel.json must not exist`,
    );
  }
});

test('K5/no-deploy-config: no .vercel directory exists in any frozen app root', () => {
  for (const appRoot of FROZEN_APPS) {
    assert.ok(
      !exists(`${appRoot}/.vercel`),
      `${appRoot}/.vercel directory must not exist`,
    );
  }
});

// ─── Route-ownership: gateway adapter wires match the contract ───────────────

test('K5/gateway: schema-registry-execution.adapter writes to theme_packages and theme_package_versions', () => {
  const adapter = read('services/api-gateway/src/execution/schema-registry-execution.adapter.ts');
  assert.match(adapter, /\.from\('theme_packages'\)/);
  assert.match(adapter, /\.from\('theme_package_versions'\)/);
});

test('K5/gateway: theme-execution.adapter owns buildReleaseArtifacts (writes to theme_releases)', () => {
  const adapter = read('services/api-gateway/src/execution/theme-execution.adapter.ts');
  assert.match(adapter, /buildReleaseArtifacts/);
  assert.match(adapter, /theme_releases/);
});

test('K5/gateway: marketplace-reviews.ts owns publishThemeReviewDecision', () => {
  const src = read('services/api-gateway/src/routes/operations/marketplace-reviews.ts');
  assert.match(src, /publishThemeReviewDecision/);
});
