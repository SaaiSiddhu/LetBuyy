# Phase K Report — Theme Platform Primitives

**Status:** COMPLETE  
**Date:** 2026-07-10  
**Branch:** stepup/main  
**Lane-A:** `packages/theme-engine/src/` — 5 new modules, 90 new tests  
**Lane-B:** `docs/storefront-liquid-discovery/phase-k/` contract doc, `tests/launch/lb-k-theme-platform.test.mjs` — 55 new tests  
**Test gate:** theme-engine 311/311 PASS; storefront-runtime 133/133 PASS; api-gateway typecheck clean; zero TypeScript errors  

---

## 1. Scope and Motivation

Phase K delivers the six library primitives that were identified as gaps in Phase H's Ground document — the pure functions and contract types that a future approved marketplace or publish pipeline would consume. The primitives are strictly additive (no render path, no gateway DB writes, no storefront-runtime changes) and sit exclusively in `packages/theme-engine/src/`.

The six gaps addressed:

| Gap | K primitive | Module |
|-----|------------|--------|
| No semver/epoch comparator for date-string `compatibility_range` fields | `satisfiesSchemaRange`, `isThemeBundleSchemaCompatible` | `theme-version.ts` |
| No function to check a bundle's compat range against the engine's known epochs | `isThemeBundleSchemaCompatible` | `theme-version.ts` |
| No install-validation pipeline (lint + schema gate + compat + checksum + migration readiness) | `validateThemeInstall` | `theme-install.ts` |
| No upgrade planner composing migrations + settings diff + risk classification | `planThemeUpgrade` | `theme-upgrade.ts` |
| No publish manifest builder | `buildThemePublishManifest` | `theme-publish.ts` |
| No analytics event shapes or emission-point annotations | `ThemeAnalyticsEvent`, `describeThemeMetrics` | `theme-analytics.ts` |

---

## 2. Deliverables

### 2.1 Lane-A — Library primitives (K1–K4, K6)

#### K1 — `theme-version.ts` (epoch comparator)

Pure closed function set. No new npm dependency. The compatibility_range field carries ordered date-string epochs (`>=2026-06-liquid-sections`), not SemVer. `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` from `theme-bundle.ts` is the ordered allowlist.

| Export | Signature | Purpose |
|--------|-----------|---------|
| `parseSchemaRange` | `(range: string) → ParsedSchemaRange \| null` | Parse `>=X` or `^X` or bare `X` |
| `schemaVersionIndex` | `(version: string) → number` | Index in allowlist; -1 if unknown |
| `compareSchemaVersions` | `(a, b) → -1\|0\|1\|null` | `null` when either is unknown |
| `versionFamily` | `(version: string) → string` | Year prefix for `^` family constraint |
| `satisfiesSchemaRange` | `(version, range) → boolean` | Fail-closed: false when either is unknown |
| `isThemeBundleSchemaCompatible` | `(bundle) → boolean` | Composes G4 gate + range satisfaction |

Fail-closed design: any unknown version in either position of `satisfiesSchemaRange` returns `false` (conservative rejection, not silent pass).

Test file: `test/theme-version.test.ts` — 31 tests covering parse (valid operators, empty, unparseable), index (known, unknown, out-of-bounds), compare (older/same/newer/unknown/cross-position), family (year prefix extraction), satisfies (valid range, bare version, `^` family, unknown versions, empty range), and `isThemeBundleSchemaCompatible` (compatible bundle, unknown schema_version, nil range).

#### K2 — `theme-upgrade.ts` (upgrade planner)

`planThemeUpgrade({ installed, next }): ThemeUpgradePlan` — pure, no I/O.

Composes:
- `migrateThemeTemplateSchemasWithRegistry` (Phase G) — for `pending_migrations`; `REGISTERED_SECTION_SCHEMA_MIGRATIONS` is empty today (correctly wired; no-op until a real migration is registered)
- `groupSettingsFields` (Phase H) — for `settings_added` / `settings_removed`
- `satisfiesSchemaRange` / `schemaVersionIndex` (this phase) — for risk classification and `schema_version_transition.known`

`risk_level` assignment: `'low'` for additive-only (no settings removed, no unknown target schema); `'medium'` when settings are removed; `'high'` when the target schema_version is unknown. `auto_applicable` is `true` only at `'low'`.

Test file: `test/theme-upgrade.test.ts` — 12 tests covering same-version no-op, section adds/removes as sorted sets, settings adds/removes, downgrade warning (unknown schema_version), empty migration registry, settingsCarryover shape, no-mutation contract (plan object is a new value, not a reference to the input).

#### K3 — `theme-install.ts` (install validator)

`validateThemeInstall({ bundle, targetSlug? }): ThemeInstallValidationResult` — pure, no I/O.

Five-stage pipeline run in sequence, stopping at the first blocking gate:

1. **Schema gate** — `validateTheme(bundle)` (Phase H SDK): Zod parse + G4 schema_version allowlist check.
2. **Lint gate** — `lintThemeBundle(bundle)` (Phase H4): forbidden tags/attrs, missing schema blocks, unknown section types. `error`-level issues block; `warn`-level issues are advisory.
3. **Compat range** — `isThemeBundleSchemaCompatible(bundle)` (this phase, K1).
4. **Checksum verification** — `packageThemeBundle(bundle)` (Phase H5) produces content hash; matched against pre-declared `bundle.package.checksum` if present.
5. **Section migration readiness** — `migrateThemeTemplateSchemasWithRegistry` on every template in the bundle. No-op today; surfaces migration errors when real migrations are registered.

Slug coherence (§4 in `THEME_PLATFORM_CONTRACT.md`): if `targetSlug` is supplied, `resolveCanonicalThemeSlug` is used to resolve both sides before comparison so that `urban-kicks-liquid ↔ letbuyy-core-liquid` alias pairs match correctly.

Result shape:

```ts
interface ThemeInstallValidationResult {
  ok: boolean;
  issues: ThemeInstallIssue[];     // all collected issues
  manifest?: ThemePackageManifest; // non-null only when ok === true
  steps: {
    schema_valid: boolean;
    lint_clean: boolean;
    compat_satisfied: boolean;
    checksum_verified: boolean;
    migrations_ready: boolean;
  };
}
```

Test file: `test/theme-install.test.ts` — 13 tests covering valid bundle passes, schema-invalid failure, compat-range failure on unknown epoch, lint-error failure, slug match/mismatch, canonical alias resolution, error-before-warn ordering in `issues[]`, no-mutation contract.

#### K4 — `theme-publish.ts` (publish manifest builder)

`buildThemePublishManifest(bundle: LiquidThemePackageBundle): ThemePublishManifest` — pure, deterministic.

Wraps `packageThemeBundle` (Phase H5 content-addressed manifest) and adds semantic fields:

```ts
interface ThemePublishManifest {
  slug: string;
  version: string;
  version_number: number;
  schema_version: string;
  compatibility_range: string;
  release_status: 'draft' | 'published' | 'deprecated' | 'revoked';  // set by gateway on upsert
  schema_verified: boolean;
  lint_issue_count: number;
  content_hash: string;       // from ThemePackageManifest.contentHash
  exported_file_count: number;
  section_count: number;
  block_count: number;
}
```

Deterministic: no timestamps, no random values. Same bundle input → bit-identical manifest. `content_hash` is the SHA-256 fingerprint from `packageThemeBundle`. Two bundles with the same `content_hash` have byte-identical rendered output.

Relationship to `ThemePackageManifest` (Phase H5): both coexist without collision. The publish manifest is the higher-level distributable descriptor; the package manifest is the file-level content-addressed artifact.

Test file: `test/theme-publish.test.ts` — 17 tests covering determinism (same bundle → same hash on two calls), identity fields (slug/version/schema_version/compatibility_range), SHA-256 content fingerprint via H5 delegation, provenance fields (schema_version, version_number), summary stats (section_count, block_count, lint_issue_count, schema_verified, exported_file_count), cross-fixture hash uniqueness (urban-kicks fixture ≠ letbuyy-core fixture).

#### K6 — `theme-analytics.ts` (analytics contract)

Defines event shapes and emission-point annotations. **Zero live values fabricated.** Every metric descriptor carries `connected: false` and the exact DB source query or gateway route that would produce the value.

Five event types in the `ThemeAnalyticsEvent` discriminated union:

| Event | `event` field | Emission point |
|-------|--------------|----------------|
| `ThemeInstalledEvent` | `'theme.installed'` | `POST /v1/themes/:slug/install` in gateway |
| `ThemeUpdatedEvent` | `'theme.updated'` | Theme upgrade route (gateway, future) |
| `ThemePublishedEvent` | `'theme.published'` | `publishThemeReviewDecision()` in `marketplace-reviews.ts` |
| `ThemeUninstalledEvent` | `'theme.uninstalled'` | `DELETE /v1/themes/:slug` in gateway |
| `ThemePreviewOpenedEvent` | `'theme.preview_opened'` | Preview-token route in gateway |

`describeThemeMetrics(): ThemeMetricDescriptor` returns structured descriptors for `install_count`, `review_count`, `download_count`, `purchase_count`, each carrying:
- `topic`: the metric name
- `connected: false`: honest NOT-CONNECTED marker
- `source`: the exact DB query (`SELECT COUNT(*) FROM theme_package_versions WHERE ...`) or gateway route that would populate the value

`ThemeInstallMetrics` is a structural type for constructing install-count metrics objects without fabricated values.

Test file: `test/theme-analytics.test.ts` — 17 tests covering `describeThemeMetrics` (topic coverage, `connected: false` honesty, field-presence, NOT-CONNECTED source annotations), `describeThemeEventEmissionPoints` (5-event coverage, `implemented: false` for each), `ThemeInstallMetrics` type constructability.

### 2.2 Lane-B — Contract tests and documentation (K5)

#### K5-a — `THEME_PLATFORM_CONTRACT.md`

12-section contract document in `docs/storefront-liquid-discovery/phase-k/`. Covers:
- Freeze boundaries (§2): `apps/theme-marketplace`, `apps/app-marketplace`, `apps/developer-portal` — all three confirmed `frozen-next-app` with `deploymentAuthority.platform: "frozen-not-deployed"`.
- Route ownership law (§3): the 410 permanent guard on the storefront install route; gateway symbols for all DB writes with exact file:line citations.
- Package format contract (§4): bundle schema fields, content-addressed manifest shape, file artifact export.
- Version and compatibility rules (§5): epoch list design, closed comparator, compatibility checker result shape.
- Install validation contract (§6): five-stage pipeline, result shape, route-ownership reminder.
- Upgrade/update contract (§7): `ThemeUpgradePlan` shape and composition.
- Publish manifest contract (§8): `ThemePublishManifest` vs `ThemePackageManifest` coexistence.
- Analytics contract (§9): honesty marker, event union, emission-point summary.
- Foundation exports tables (§10): H/G exports and new Phase K exports.
- What this contract does NOT cover (§11): render path, live analytics, payment flows, DB schema.
- Regression guard (§12): `lb-k-theme-platform.test.mjs` wired enforcement.

#### K5-b — `tests/launch/lb-k-theme-platform.test.mjs`

55 source-contract tests across 5 groups wired into `apps/storefront-runtime/package.json`:

| Group | Tests | What is asserted |
|-------|-------|-----------------|
| Storefront install route freeze | 2 | `route.ts` permanently returns 410; no bypass path added |
| Frozen-app manifests | 15 | Each of 3 frozen apps: exists, `runtimeCategory: "frozen-next-app"`, `deploymentAuthority.platform: "frozen-not-deployed"`, empty config, no `vercel.json` |
| Production topology | 1 | `production-topology.json` records all three as `status: "frozen"` with empty `deploymentManifests` |
| H/G foundation exports | 24 | Every listed export from §10 of the contract is re-exported from `@letbuyy/theme-engine` index |
| Contract doc coherence | 8 | `THEME_PLATFORM_CONTRACT.md` contains: the 410 entry, all 3 frozen app paths, NOT-CONNECTED marker, `ThemePublishManifest` fields, 5-step pipeline description, 5 event types, gateway ownership symbols |
| No new deploy config | 2 | No `vercel.json` / `.vercel/` in frozen apps |
| Gateway route-ownership | 3 | Gateway file symbols cited in the contract exist at the declared paths |

---

## 3. Freeze and Route-Ownership Compliance

Phase K made zero changes to:
- `apps/theme-marketplace`, `apps/app-marketplace`, `apps/developer-portal` (all frozen)
- `apps/storefront-runtime/src/app/api/themes/install/route.ts` (permanently 410)
- `services/api-gateway/src/execution/schema-registry-execution.adapter.ts` (gateway DB writes)
- `services/api-gateway/src/execution/theme-execution.adapter.ts` (theme_releases writes)
- `services/api-gateway/src/routes/operations/marketplace-reviews.ts` (publish state writes)
- `packages/theme-engine/src/theme-registry.ts` (frozen section registry, ART-17)
- DOMPurify sanitizer config (`LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`)
- `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` (remains `false`)
- Any database migration files

All five new K modules are pure functions in `packages/theme-engine/src/`. They read from Phase G/H primitives via import; they do not call any DB adapter, network API, or side-effectful function. The render path is byte-identical.

---

## 4. Analytics NOT-CONNECTED Honesty

`theme-analytics.ts` explicitly marks every metric `connected: false`. The source field on each `ThemeMetricFieldDescriptor` names the exact DB column or gateway endpoint that would populate the value at runtime. `theme_packages.install_count`, `review_count`, `download_count`, and `purchase_count` are query-time aggregates at the gateway DB layer — they are NOT event-driven counters. No fabricated count or live estimate appears anywhere in Phase K.

The `ThemeEventEmissionPoint` type documents that all five events have `implemented: false` — no existing gateway route currently emits these events. A test in `theme-analytics.test.ts` asserts this `implemented: false` status for all five events.

---

## 5. Test Gate

| Suite | Command | Result | Delta |
|-------|---------|--------|-------|
| theme-engine | `pnpm typecheck test --filter=@letbuyy/theme-engine` | **311/311 PASS** | +90 (K1:31, K2:12, K3:13, K4:17, K6:17) |
| storefront-runtime | `pnpm typecheck test --filter=@letbuyy/storefront-runtime` | **133/133 PASS** | +55 (K5 contract tests) |
| api-gateway typecheck | `pnpm typecheck --filter=@letbuyy/api-gateway` | **32 turbo tasks, exit 0** | 0 |
| governance gate | `node scripts/validate-governance.mjs` | Not re-run (Phase K adds no topology/import/package/env changes) | — |

Baseline carried from Phase I: theme-engine 221, storefront-runtime 78.

---

## 6. Adversarial Review Findings

Three findings were identified during Phase K review. None is blocking.

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| **K-F1** | MEDIUM | `test/theme-version.test.ts` — test named `'^ with different family returns false'` actually exercises same-family (`true`) path, not the cross-family rejection branch. `versionFamily` mismatch path in `satisfiesSchemaRange` is untestable today because `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` contains only one entry. Test name is misleading. | OPEN — when a second epoch is added to `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS`, a cross-family negative test must be added. Test name should be updated to document the architectural constraint. |
| **K-F2** | LOW | `test/theme-install.test.ts` — Stage 3 compat-range rejection path is not independently exercised by `validateThemeInstall` tests. The test `'bundle with unknown schema_version fails compat-range check'` sets an unknown `schema_version`, which causes Stage 1 to fire before Stage 3 can run. A bundle with a KNOWN schema_version but an unresolvable `compatibility_range` is not tested as input to the install pipeline. Stage 3 is tested in isolation in `theme-version.test.ts`. | OPEN — add a test with known `schema_version` + `compatibility_range: '>=future-epoch-not-in-list'` to exercise the independent Stage 3 failure path. |
| **K-F3** | LOW | `apps/app-marketplace/next-env.d.ts` and `apps/developer-portal/next-env.d.ts` — import path changed from `.next/types/routes.d.ts` to `.next/dev/types/routes.d.ts` in the session git-status snapshot. These are auto-generated Next.js files that were dirty before Phase K. Not a Phase K deliverable. | No action needed. Commit or reset independently of Phase K. |

---

## 7. Rollback Plan

Phase K is entirely additive — 5 new modules in `packages/theme-engine/src/`, 5 new test files, 1 contract doc, 1 launch test file, and 1 `package.json` test-script extension. A rollback consists of:

1. Remove `packages/theme-engine/src/theme-version.ts`, `theme-upgrade.ts`, `theme-install.ts`, `theme-publish.ts`, `theme-analytics.ts`.
2. Remove the corresponding `export * from './theme-version'` (and four siblings) lines from `packages/theme-engine/src/index.ts`.
3. Remove the five corresponding test files from `packages/theme-engine/test/`.
4. Remove `docs/storefront-liquid-discovery/phase-k/THEME_PLATFORM_CONTRACT.md`, `PHASE_K_REPORT.md`.
5. Remove `tests/launch/lb-k-theme-platform.test.mjs` and revert the one-line `package.json` test-script addition in `apps/storefront-runtime/package.json`.

**Render path is byte-identical before and after rollback.** No DB migrations, no gateway routes, no storefront-runtime source, no frozen files, no governance constants are affected.

---

## 8. What Phase K Does NOT Cover

- Live marketplace UI — `apps/theme-marketplace` is frozen; no UI.
- Live analytics values — NOT-CONNECTED by design and contract.
- Payment or purchase flows — gateway-owned; out of scope.
- App marketplace installs — `apps/app-marketplace` is frozen; out of scope.
- Developer portal API keys — `apps/developer-portal` is frozen; out of scope.
- DB schema changes — Phase K is a pure library layer; no migrations.
- New gateway routes — the gateway routes that would call `validateThemeInstall` / `buildThemePublishManifest` are a future approved scope item.
- Platform-wide Liquid flip — `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` remains `false`; the ARB decision documented in Phase J is unchanged.

---

*Phase K report — 2026-07-10 | Authored by Phase K documentation engineer | Branch: stepup/main*
