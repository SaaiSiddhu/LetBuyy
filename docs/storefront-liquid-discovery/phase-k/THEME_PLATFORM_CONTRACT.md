# Theme Platform Contract — Phase K

**Status:** PUBLISHED — read-only contract document  
**Authors:** Phase K Lane-B  
**Date:** 2026-07-10  
**Governance:** This document is supreme for the theme platform surface. Changing any
named export, type, or event shape below requires an ARB-approved schema migration and
a corresponding bump to `THEME_LIQUID_BUNDLE_SCHEMA_VERSION`.

---

## 1. Purpose

This document defines the complete interface contract a future (human-approved) theme
marketplace or publishing platform would consume from the Phase K/H library primitives.
It is a **library contract only** — no marketplace deploy target exists today, and none
may be created without explicit ARB approval.

Reading this document gives a future integrator everything they need to:

- Validate a theme bundle before submitting it for publish
- Verify version and schema compatibility
- Plan and execute a safe upgrade from one theme version to another
- Build a publish manifest for the gateway to upsert into `theme_package_versions`
- Define and emit analytics events for marketplace telemetry

---

## 2. Freeze Boundaries (Hard Law)

The following apps are **FROZEN** per `CLAUDE.md` and the LetBuyy Constitution. They are
not deploy targets. No source files, routes, or deployment config may be added to them
without an ARB-approved reopen trigger that modifies their `runtime.manifest.json`
`deploymentAuthority.platform` field away from `"frozen-not-deployed"`.

| App | Path | Reason |
|-----|------|--------|
| Theme Marketplace | `apps/frozen/theme-store` (formerly `apps/theme-marketplace`) | Pending consolidation, not production |
| App Marketplace | `apps/frozen/app-store` (formerly `apps/app-marketplace`) | Pending consolidation, not production |
| Developer Portal | `apps/frozen/developer-portal` (formerly `apps/developer-portal`) | Pending consolidation, not production |

**Canonical evidence:** each frozen app carries `"runtimeCategory": "frozen-next-app"` and
`"deploymentAuthority": { "platform": "frozen-not-deployed", "config": [] }` in its
`runtime.manifest.json`. The production topology at
`config/runtime/production-topology.json` records each as
`"status": "frozen", "deploymentKind": "not-deployed", "deploymentManifests": []`.

---

## 3. Route Ownership (Hard Law)

### 3.1 Storefront install route — permanently 410

`apps/storefront-runtime/src/app/api/themes/install/route.ts` returns **HTTP 410 Gone**
for every POST. This is a deliberate hard guard, not an error. Theme installation is a
merchant mutation and must flow through the authenticated admin API gateway.

```
POST /api/themes/install → 410 Gone
{
  "success": false,
  "error": "Theme installation must be performed from the authenticated admin API."
}
```

Phase K does **not** un-freeze this route. A future marketplace consumer must call the
gateway's theme install endpoint (gateway-owned route, not declared here).

### 3.2 Gateway owns all DB writes for themes

The gateway adapters listed below own writes to the theme persistence tables. Phase K
library functions are **pure** — they produce typed values that a caller (gateway or
CLI) may pass to these routes; they never write to the DB themselves.

| Gateway symbol | Table written |
|----------------|--------------|
| `services/api-gateway/src/execution/schema-registry-execution.adapter.ts` — lines 323, 354, 499, 526 | `theme_packages`, `theme_package_versions` |
| `services/api-gateway/src/execution/theme-execution.adapter.ts` — `buildReleaseArtifacts()` | `theme_releases` |
| `services/api-gateway/src/routes/operations/marketplace-reviews.ts` — `publishThemeReviewDecision()` | `theme_packages`, `theme_package_versions` (publish state) |

---

## 4. Package Format Contract

A publishable theme bundle is an instance of `LiquidThemePackageBundle` (from
`@letbuyy/theme-engine`) validated through the full K install-validation pipeline
(§7). The gateway ultimately stores it as a `theme_package_versions` row with:

- `release_manifest` — a serialized `ThemePublishManifest` (§8)
- `content_hash` — the SHA-256 content hash from `ThemePackageManifest` (§4.2)
- `schema_version` — the string `THEME_LIQUID_BUNDLE_SCHEMA_VERSION`
- `compatibility_range` — the string from `bundle.package.compatibility_range`

### 4.1 Bundle schema fields (version-stamped)

| Constant | Value | Source |
|----------|-------|--------|
| `THEME_LIQUID_BUNDLE_SCHEMA_VERSION` | `'2026-06-liquid-sections'` | `theme-bundle.ts:5` |
| `THEME_LIQUID_RENDERER_VERSION` | `'0.1.0'` | `theme-bundle.ts:6` |
| `THEME_BUNDLE_SCHEMA_VERSION` (JSON-contract bundles) | `'2026-05-json-contract'` | `theme-bundle.ts:3` |
| `THEME_BUNDLE_RENDERER_VERSION` (JSON-contract bundles) | `'1.0.0'` | `theme-bundle.ts:4` |
| `CURRENT_SECTION_SCHEMA_VERSION` | `'2026-07-sections-v1'` | `section-schema-migrations.ts:28` |

`LiquidThemePackageBundleSchema.package.compatibility_range` defaults to
`` `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}` `` = `'>=2026-06-liquid-sections'`,
meaning the bundle declares it requires at least the current engine epoch to render
correctly.

### 4.2 Content-addressed manifest (Phase H5)

`packageThemeBundle(bundle: LiquidThemePackageBundle): ThemePackageManifest`

| Field | Description |
|-------|-------------|
| `slug` | Canonical theme slug from `bundle.package.slug` |
| `schema_version` | `bundle.schema_version` |
| `files[]` | `{ path, checksum (SHA-256), sizeBytes }` — sorted by path for deterministic order |
| `checksums` | `Record<path, SHA-256>` — the per-file digest map |
| `contentHash` | SHA-256 of the sorted checksum values — the stable bundle fingerprint |

The `contentHash` field is the canonical identity of a theme version artifact. Two
bundles with the same `contentHash` have byte-identical rendered output.

### 4.3 File artifact export (Phase H2)

`exportThemeBundleToFiles(bundle: LiquidThemePackageBundle): ThemeArtifactFile[]`

Produces the flat `{ path, contents }` list that mirrors the Liquid theme directory
layout. Output is sorted by path, deterministic, and path-traversal-safe (any `..` or
absolute path throws `UnsafeThemeArtifactPathError`). The `LetbuyyThemeManifest`
sidecar (`letbuyy-theme.json`) carries `schema_version`, `package.{slug,name,version,
author_name,description}`, and `renderer.{engine,renderer_version,liquid_ready}`.

---

## 5. Version and Compatibility Rules

### 5.1 Schema version epoch list

```ts
// From packages/theme-engine/src/theme-bundle.ts:14
KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS: readonly string[] = ['2026-06-liquid-sections']
```

This is a **closed allowlist** of Liquid bundle schema versions the current renderer
understands. New versions are appended here in lockstep with a migration/compat
document. A bundle carrying an unknown `schema_version` is rejected loudly via
`UnsupportedLiquidBundleSchemaVersionError` (fail-closed).

### 5.2 Version comparator (new in Phase K)

The `compatibility_range` field carries **date-string epochs**, not semver. There is
intentionally no `node-semver` dependency in the workspace. The ordered epoch list is
the source of truth.

A Phase K comparator satisfies a range `>=<epoch>` when:
1. The target version (`schema_version`) appears in `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS`
2. Its index in the list is >= the index of the pinned minimum in the range

Pure function, no external dependency, closed over the known-versions allowlist.

```ts
// Guard (already exported from theme-engine):
isKnownLiquidBundleSchemaVersion(version: string): boolean
```

### 5.3 Compatibility checker (new in Phase K)

Takes a `LiquidThemePackageBundle` and checks its `schema_version` and
`package.compatibility_range` (e.g. `'>=2026-06-liquid-sections'`) against the engine's
`KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS`.

```ts
// Returns true only when schema_version is in the known-versions list AND
// satisfies the compatibility_range constraint. Fail-closed: false on any unknown.
isThemeBundleSchemaCompatible(bundle: LiquidThemePackageBundle): boolean
```

The checker composes `isKnownLiquidBundleSchemaVersion` (G4 gate) + `satisfiesSchemaRange`.
Fail-closed: returns `false` whenever either the schema_version or the minVersion from the
range is unknown (not in `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS`). This is always called as
Stage 3 of `validateThemeInstall` (§6), which returns a structured `ThemeInstallValidationResult`
with the failure reason for callers that need more than a boolean.

> **Note:** An anticipated `ThemeCompatibilityCheckResult` structured type was not implemented.
> The compat check is a boolean gate; callers requiring audit detail should use
> `validateThemeInstall` (§6) which surfaces all stage results in `ThemeInstallValidationResult`.

---

## 6. Install Validation Contract

### 6.1 Purpose

`validateThemeInstall(bundle: unknown): ThemeInstallValidationResult` is a **pure
library function** a gateway route or CLI tool calls before persisting a bundle into
`theme_packages` / `theme_package_versions`. It runs in sequence:

1. **Schema gate** — `validateTheme(bundle)` (Phase H SDK): Zod parse + G4
   `schema_version` allowlist check. Stops pipeline on failure.
2. **Lint gate** — `lintThemeBundle(bundle)` (Phase H4): forbidden tags/attrs,
   unknown section types, missing schema blocks. Stops pipeline on `error`-level issues.
3. **Compat range check** — the Phase K compatibility checker (§5.3). Stops if
   `compatible === false`.
4. **Checksum verification** — `packageThemeBundle(bundle)` produces the manifest;
   if a pre-declared `bundle.package.checksum` field is present it must match the
   manifest's `contentHash`. Stops on mismatch.
5. **Section migration readiness** — `migrateThemeTemplateSchemasWithRegistry` on
   every template config in the bundle. With an empty registry this is a structural
   no-op; it will surface any migration errors when real migrations are registered.

All five steps run and collect results; the pipeline stops at the first blocking gate.

### 6.2 Result shape

```ts
interface ThemeInstallValidationResult {
  ok: boolean;
  /** All collected issues across the pipeline steps */
  issues: ThemeInstallValidationIssue[];
  /** Non-null only when ok === true */
  manifest?: ThemePackageManifest;
  /** Summary of which steps passed */
  steps: {
    schema_valid: boolean;
    lint_clean: boolean;      // true when no 'error'-level lint issues
    compat_satisfied: boolean;
    checksum_verified: boolean;
    migrations_ready: boolean;
  };
}

interface ThemeInstallValidationIssue {
  step: 'schema' | 'lint' | 'compat' | 'checksum' | 'migration';
  level: 'error' | 'warn';
  message: string;
}
```

### 6.3 Route-ownership reminder

`validateThemeInstall` is a pure library function. The **caller** (a gateway route)
decides whether to persist the bundle. The storefront install route at
`apps/storefront-runtime/src/app/api/themes/install/route.ts` is permanently 410.

---

## 7. Upgrade / Update Contract

### 7.1 Purpose

`planThemeUpgrade(current, available): ThemeUpgradePlan` compares two
`LiquidThemePackageBundle` instances (the currently-installed version and the available
newer version) and produces a plan describing what changes and what the risk is.

### 7.2 Plan shape

```ts
interface ThemeUpgradePlan {
  /** Whether the upgrade can be applied automatically without manual merchant review */
  auto_applicable: boolean;
  /** Risk assessment: additive-only = low; settings removed = medium; schema changed = high */
  risk_level: 'low' | 'medium' | 'high';
  /** Section schema migrations that would run on apply */
  pending_migrations: readonly ThemeSectionSchemaMigration[];
  /** Net-new settings fields in the available bundle not in current */
  settings_added: string[];
  /** Settings fields present in current but absent in available (merchant data at risk) */
  settings_removed: string[];
  /** Schema version transition */
  schema_version_transition: {
    from: string;
    to: string;
    known: boolean; // isKnownLiquidBundleSchemaVersion(to)
  };
  /** Version string change */
  version_transition: {
    from: string; // current.package.version
    to: string;   // available.package.version
  };
}
```

### 7.3 Composition

The upgrade planner composes:
- `REGISTERED_SECTION_SCHEMA_MIGRATIONS` — for `pending_migrations` (currently empty; no-op)
- `groupSettingsFields(current.config.settings_schema)` vs same on `available` — for
  `settings_added` / `settings_removed`
- The Phase K epoch comparator — for `schema_version_transition.known`

`auto_applicable` is `true` only when `risk_level === 'low'` (no settings removed, no
schema-version jump to an unknown epoch, and `pending_migrations.length === 0` or all
pending migrations are idempotent and have an accompanying render-parity test).

---

## 8. Publish Manifest Contract

### 8.1 Purpose

`buildThemePublishManifest(bundle, validationResult): ThemePublishManifest` assembles
the self-contained record a future gateway publish route would upsert into
`theme_package_versions.release_manifest`. It does not write to the DB; it produces a
value.

### 8.2 Shape

```ts
interface ThemePublishManifest {
  /** Canonical slug from bundle.package.slug */
  slug: string;
  /** Human version string from bundle.package.version */
  version: string;
  /** Numeric version from bundle.package.version_number */
  version_number: number;
  /** From bundle.schema_version — the epoch string */
  schema_version: string;
  /** From bundle.package.compatibility_range */
  compatibility_range: string;
  /** Draft | published | deprecated | revoked — caller sets on upsert */
  release_status: 'draft' | 'published' | 'deprecated' | 'revoked';
  /** Whether the install-validation pipeline passed (ok === true) */
  schema_verified: boolean;
  /** Number of error-level lint issues found (0 = clean) */
  lint_issue_count: number;
  /** contentHash from ThemePackageManifest — the artifact fingerprint */
  content_hash: string;
  /** Total files in the exported artifact */
  exported_file_count: number;
  /** Section count from bundle.sections */
  section_count: number;
  /** Block count from bundle.blocks */
  block_count: number;
}
```

### 8.3 Relationship to ThemePackageManifest

`ThemePackageManifest` (Phase H5 — `packageThemeBundle`) is the **content-addressed
artifact hash record**: per-file checksums + the stable `contentHash` fingerprint.

`ThemePublishManifest` is a **higher-level semantic record** that the gateway stores as
the `release_manifest` column in `theme_package_versions`. Both coexist without
collision:
- `ThemePackageManifest.contentHash` → `ThemePublishManifest.content_hash`
- `ThemePackageManifest.files.length` → `ThemePublishManifest.exported_file_count`

---

## 9. Analytics Contract

### 9.1 Honesty marker

**LIVE VALUES ARE NOT CONNECTED.** `Theme.install_count`, `review_count`,
`download_count`, and `purchase_count` in `index.ts:1098–1100` are **query-time
aggregates** read from the `themes` table at request time. They are not real-time event
counters. Event-driven counters do not exist today.

The analytics contract below defines the **event shapes** and **emission-point
annotations** a future telemetry pipeline would consume. No fabricated counts, no mock
data.

### 9.2 Event union

```ts
// All events carry a site_id (tenant) and a theme slug for multi-tenant attribution.

interface ThemeEventBase {
  event: string;
  site_id: string;
  theme_slug: string;
  schema_version: string;
  occurred_at: string; // ISO-8601
}

interface ThemeInstalledEvent extends ThemeEventBase {
  event: 'theme.installed';
  version: string;
  version_number: number;
  install_source: 'gateway' | 'cli' | 'migration';
  /** Emission point: services/api-gateway — the theme install route (POST /v1/themes/:slug/install)
   *  after a successful upsert into theme_package_versions with release_status='published'. */
}

interface ThemeUpdatedEvent extends ThemeEventBase {
  event: 'theme.updated';
  from_version: string;
  to_version: string;
  auto_applied: boolean;
  migrations_applied: number;
  /** Emission point: services/api-gateway — the theme upgrade route after the merchant
   *  confirms the upgrade plan and the gateway persists the new version. */
}

interface ThemePublishedEvent extends ThemeEventBase {
  event: 'theme.published';
  version: string;
  version_number: number;
  lint_issue_count: number;
  /** Emission point: services/api-gateway — marketplace-reviews.ts publishThemeReviewDecision()
   *  after writing release_status='published' to theme_package_versions. */
}

interface ThemeUninstalledEvent extends ThemeEventBase {
  event: 'theme.uninstalled';
  version: string;
  reason?: string;
  /** Emission point: services/api-gateway — the theme uninstall route after removing the
   *  active association from the sites table. */
}

interface ThemePreviewOpenedEvent extends ThemeEventBase {
  event: 'theme.preview_opened';
  version: string;
  preview_token_issued: boolean;
  /** Emission point: services/api-gateway — the theme preview-token route after issuing
   *  a short-lived preview JWT. */
}

// Actual export name is ThemeAnalyticsEvent (not ThemePlatformEvent — see §10 note)
export type ThemeAnalyticsEvent =
  | ThemeInstalledEvent
  | ThemeUpdatedEvent
  | ThemePublishedEvent
  | ThemeUninstalledEvent
  | ThemePreviewOpenedEvent;
```

### 9.3 Emission-point summary

| Event | Gateway route / symbol |
|-------|----------------------|
| `theme.installed` | `POST /v1/themes/:slug/install` (gateway-owned) |
| `theme.updated` | `POST /v1/themes/:slug/upgrade` (gateway-owned, future) |
| `theme.published` | `publishThemeReviewDecision()` in `marketplace-reviews.ts` |
| `theme.uninstalled` | `DELETE /v1/themes/:slug` (gateway-owned) |
| `theme.preview_opened` | `POST /v1/themes/:slug/preview-token` (gateway-owned) |

**NOT CONNECTED** — no event pipeline currently emits these events. When a future
analytics adapter is wired, it must consume `ThemeAnalyticsEvent` (exported as that name
from `theme-analytics.ts`) as defined here and
write to the LetBuyy Analytics Engine (Cloudflare) under the `theme_events` dataset.

---

## 10. Foundation Exports (H/G Phase Primitives)

Phase K builds on the following exports from `@letbuyy/theme-engine`. A future
marketplace consumer must import exclusively from this package — never from internal
sub-paths.

| Export | Source module | Purpose |
|--------|--------------|---------|
| `packageThemeBundle` | `theme-packager.ts` | Content-addressed manifest |
| `exportThemeBundleToFiles` | `theme-artifact-exporter.ts` | Flat file artifact |
| `validateTheme` | `theme-sdk.ts` | Schema + G4 version gate |
| `lintThemeBundle` | `theme-linter.ts` | Security + quality lint |
| `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` | `theme-bundle.ts` | Epoch allowlist |
| `isKnownLiquidBundleSchemaVersion` | `theme-bundle.ts` | Epoch membership test |
| `UnsupportedLiquidBundleSchemaVersionError` | `theme-bundle.ts` | Typed rejection |
| `THEME_LIQUID_BUNDLE_SCHEMA_VERSION` | `theme-bundle.ts` | Current epoch string |
| `THEME_LIQUID_RENDERER_VERSION` | `theme-bundle.ts` | Current renderer version |
| `CURRENT_SECTION_SCHEMA_VERSION` | `section-schema-migrations.ts` | Section stamp version |
| `REGISTERED_SECTION_SCHEMA_MIGRATIONS` | `section-schema-migrations.ts` | Migration registry |
| `migrateThemeTemplateSchemasWithRegistry` | `section-schema-migrations.ts` | Migration runner |
| `flattenSettingsData` | `settings-schema-canonical.ts` | Settings canonicalization |
| `groupSettingsFields` | `settings-schema-canonical.ts` | Settings grouping |
| `resolveCanonicalThemeSlug` | `theme-bundle-core.ts` | Slug alias resolution |
| `LETBUYY_CORE_THEME_SLUG` | `theme-bundle-core.ts` | Canonical first-party slug |
| `compileTheme` | `theme-sdk.ts` | Portable → Liquid compilation |
| `listSectionTypes` | `theme-sdk.ts` | Known section type enumeration |
| `getSectionSchema` | `theme-sdk.ts` | Per-type schema lookup |

All of the above are currently re-exported from `packages/theme-engine/src/index.ts`.

### New Phase K exports

The following are **net-new** exports added by Phase K Lane-A. They are re-exported from
`packages/theme-engine/src/index.ts` via `export * from './theme-version'` (and four siblings):

| Export | Actual module | Purpose |
|--------|--------------|---------|
| `satisfiesSchemaRange` | `theme-version.ts` | Epoch-string range satisfaction check |
| `isThemeBundleSchemaCompatible` | `theme-version.ts` | Bundle compat gate composing G4 + range (§5.3) |
| `parseSchemaRange` | `theme-version.ts` | Parse `>=X` / `^X` / bare `X` into operator + minVersion |
| `schemaVersionIndex` | `theme-version.ts` | Index of a version in `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` |
| `compareSchemaVersions` | `theme-version.ts` | `-1/0/1/null` comparator for known epoch strings |
| `versionFamily` | `theme-version.ts` | Year-prefix extractor for `^` family constraint |
| `validateThemeInstall` | `theme-install.ts` | Full pre-install pipeline (§6) |
| `planThemeUpgrade` | `theme-upgrade.ts` | Upgrade plan (§7) |
| `buildThemePublishManifest` | `theme-publish.ts` | Publish record builder (§8) |
| `ThemeAnalyticsEvent` (type union) | `theme-analytics.ts` | Analytics event discriminated union (§9) |
| `describeThemeMetrics` | `theme-analytics.ts` | Metric descriptors with `connected:false` + exact source |
| `describeThemeEventEmissionPoints` | `theme-analytics.ts` | Emission-point annotations with `implemented:false` |
| `ThemeInstallValidationResult` (type) | `theme-install.ts` | Install result shape |
| `ThemeInstallIssue` (type) | `theme-install.ts` | Per-step issue record |
| `ThemeUpgradePlan` (type) | `theme-upgrade.ts` | Upgrade plan shape |
| `ThemePublishManifest` (type) | `theme-publish.ts` | Publish record shape |
| `ParsedSchemaRange` (type) | `theme-version.ts` | Parsed operator + minVersion pair |
| `ThemeInstallMetrics` (type) | `theme-analytics.ts` | Install-count metrics shape |
| `ThemeMetricDescriptor` (type) | `theme-analytics.ts` | Per-metric descriptor with source annotation |

> **Note on naming:** The Lane-B contract document anticipated different module names (`theme-version-checker.ts`, `theme-install-validator.ts`, etc.) and a structured `ThemeCompatibilityCheckResult` type. Lane-A's actual implementation simplified the compat checker to a `boolean` return (`isThemeBundleSchemaCompatible`) and used shorter module names (`theme-version.ts`, `theme-install.ts`, etc.). The §5–§9 interface definitions in this document describe the correct shapes; this export table is the authoritative correction for §10 module names.

---

## 11. What This Contract Does NOT Cover

- **Live marketplace UI** — `apps/frozen/theme-store` is frozen. No UI contract.
- **Live analytics values** — NOT CONNECTED. This contract defines shapes only.
- **Payment / purchase flows** — owned by the Razorpay/payment domain. Out of scope.
- **App marketplace installs** — `apps/frozen/app-store` is frozen. Out of scope.
- **Developer portal API keys** — `apps/frozen/developer-portal` is frozen. Out of scope.
- **Theme rendering** — the render path is byte-identical. Phase K adds zero render code.
- **DB schema changes** — Phase K is a pure library layer. No migrations.

---

## 12. Regression Guard

The `tests/launch/lb-k-theme-platform.test.mjs` contract test suite enforces:

1. The storefront install route permanently returns 410 (freeze intact).
2. All three frozen apps declare `runtimeCategory: "frozen-next-app"` and
   `deploymentAuthority.platform: "frozen-not-deployed"` in their manifests.
3. The production topology records all three as `status: "frozen"` with empty
   `deploymentManifests`.
4. Every H/G foundation export listed in §10 is re-exported from the
   `@letbuyy/theme-engine` index.

This test is wired into `apps/storefront-runtime/package.json` so it runs with every
storefront-runtime gate invocation.
