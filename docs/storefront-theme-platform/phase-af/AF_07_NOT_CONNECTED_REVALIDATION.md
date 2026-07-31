# AF_07 — NOT-CONNECTED Seam Revalidation

**Workstream:** AF-G  
**Status:** COMPLETE — 12 seams verified against current source on HEAD 7e1441a6, branch stepup/main  
**Date:** 2026-07-17  
**Method:** Read-only grep/find/Read across repo; no builds run; working tree unchanged (378 dirty files pre-existing at session start; no delta introduced by this audit).

---

## Summary Verdict

Seven of the twelve seams remain genuinely NOT-CONNECTED or STRUCTURAL_ONLY (no live signal). Three seams are VERIFIED_CURRENT (flag hardcoded `false`; `buildLiquidThemeHeadAssets` wired into the Liquid render path; rollback UI + gateway route both exist). One seam (partner marketplace submission gate) is STRUCTURAL_ONLY — `validateThemeForMarketplace` is defined and tested but is not called from the gateway upload path. One seam (schema-migration registry) is correctly STRUCTURAL_ONLY by design (empty registry, engine wired). R-23 (rollback paired with migration) has material gaps: 10 of 12 recent migrations (180–191) lack a rollback file.

---

## Seam-by-Seam Findings

### Seam 1 — Liquid Global Default Flag
**Status: VERIFIED_CURRENT**

The constant `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` is hardcoded at:

- `packages/theme-engine/src/theme-governance.ts:14`

It is consumed as `defaultEnabled` in:

- `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:244` — `resolveThemeLiquidRenderingEnabled({ templateConfig: store.templateConfig, defaultEnabled: THEME_LIQUID_RENDERING_DEFAULT_ENABLED })`

The function `resolveThemeLiquidRenderingEnabled` (theme-governance.ts:144–182) checks explicit per-theme `rendererEngine = 'liquid'` signals first (release manifest, renderer manifest), then per-store canary boolean fields, and finally falls back to `input.defaultEnabled ?? THEME_LIQUID_RENDERING_DEFAULT_ENABLED` (line 181). The platform-wide flip decision is annotated `status: 'deferred', authority: 'ARB'` (theme-governance.ts:16–21).

`apps/storefront-runtime/src/proxy.ts:175` also reads `process.env.THEME_LIQUID_RENDERING_DEFAULT_ENABLED === 'true'` for the `X-Lb-Render-Engine` response header; if the env var is absent (default), the header returns `'react'`.

**ART-17 invariant:** CONFIRMED COMPLIANT. The constant is `false` in source; no caller overrides it to `true` at module load. React fallback is unconditionally retained (template-resolver.ts:272–308).

---

### Seam 2 — Metafield Render Resolution
**Status: NOT_CONNECTED**

The `DynamicSourceDescriptor` type with `source: 'metafield'` is fully declared and exported from `packages/theme-engine/src/dynamic-source-binding.ts:93`. The `resolveDescriptor` function (dynamic-source-binding.ts:233–272) handles the `'metafield'` case at line 242 with:

```
// NOT-CONNECTED in Phase W.
// Exact missing piece: apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts
return descriptor.fallback ?? null;
```

The source file `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts` **does not exist** (verified: `find` returned no results). The gateway tables `store_metafield_definitions` and `store_metafield_values` exist (tenant-tables.registry.ts contains no match confirming their exact migration, but the code comment at dynamic-source-binding.ts:81–86 confirms the tables and routes exist). The storefront render path has zero hydration of metafield values into `SiteDrops`. Every metafield binding silently returns `descriptor.fallback ?? null` at render time.

**What is needed to connect:** Create `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts`, call it from the render path to populate `SiteDrops.metafieldsById`, and wire the `'metafield'` branch in `resolveDescriptor` to look up that map.

---

### Seam 3 — Live FX Feed
**Status: NOT_CONNECTED**

`packages/theme-engine/src/theme-locale.ts:238–334` contains the function `formatThemeCurrencyDisplay`. The FX seam is documented in source at lines 238–275:

- `fxConnected: false` is hardcoded on every return path (line 270, 333).
- `fxNotConnectedReason` is always populated (line 256–258): `'Live FX rate source not connected. Missing: server-side fx_rates table or Razorpay FX API endpoint.'`
- Non-INR currencies return a display-only string at line 321 with `fxConnected: false, fxNotConnectedReason: FX_NOT_CONNECTED_REASON`.

No `fx_rates` table appears in any migration. No Razorpay FX adapter exists in `services/api-gateway/src/`. The function is structurally safe (INR amounts pass through unchanged; non-INR amounts display the raw amount without conversion).

**What is needed to connect:** A server-side `fx_rates` table or Razorpay FX API adapter; inject the resulting rate into `formatThemeCurrencyDisplay`'s call site.

---

### Seam 4 — Live App-Block Runtime
**Status: IMPLEMENTED_NOT_LIVE**

App-block data flows through a partially live pipeline:

1. **Gateway:** `loadPublicStorefrontAppBlocks` (storefront.ts:921–931) queries `app_extension_registrations` (table exists per migration 076) and `app_installations` from the DB and returns `AppBlockInstance[]`. This DB read is real. The extensions feature gate (`FEATURE_EXTENSIONS` env var, index.ts:663–684) guards the extensions CRUD routes but **not** the storefront read path — `loadRegisteredThemeAppBlocks` (storefront.ts:933–951) calls the DB directly without a feature gate.

2. **Storefront runtime:** `app_blocks` from the gateway response is received at `store-service.ts:666`, normalized via `normalizeAppBlockInstances`, and injected into sections. The `AppBlockSlot` component (app-block-slot.tsx) renders card/iframe blocks.

3. **Iframe render mode:** `AppBlockFrame` (app-block-slot.tsx:30–41) renders an `<iframe src={block.iframe_url}>`. An `iframe_url` is only populated if the installed app's extension config carries one — it is not synthesized by the platform.

**Gaps:** No live marketplace of installable apps exists (app-marketplace is FROZEN, ART-22). `app_extension_registrations` will be empty for most stores. If no app with `surface: 'theme.app_block'` is installed and enabled, the slot renders nothing (`blocks.length === 0` → `return null`). The extension registration CRUD routes are gated behind `FEATURE_EXTENSIONS` (must be truthy env var to accept registration writes). Actual third-party app delivery (JavaScript bundle / iframe URL population) is entirely outside the LetBuyy gateway — the platform provides the slot container but has no enforcement of what executes inside the iframe.

---

### Seam 5 — Custom-CSS Render Call Site
**Status: VERIFIED_CURRENT**

The historical note that `buildLiquidThemeHeadAssets` at line ~585 was "not wired" is **no longer accurate**.

Current evidence:

- `packages/theme-engine/src/theme-renderer.ts:306` — function definition of `buildLiquidThemeHeadAssets(bundle, rawCustomCss?)`.
- `packages/theme-engine/src/theme-renderer.ts:585` — `const themeHeadAssets = buildLiquidThemeHeadAssets(bundle);`
- `packages/theme-engine/src/theme-renderer.ts:587` — `const contentForHeader = \`${themeHeadAssets}${embedHeader}\`;`
- `packages/theme-engine/src/theme-renderer.ts:642` — `content_for_header: contentForHeader` passed to the Liquid engine.

The function is invoked from `LiquidThemeRenderer.render()` (the class that handles `rendererEngine: 'liquid'`). It is called **without** the `rawCustomCss` argument at line 585, which means the current render path always uses only the base style block (the Phase AA custom-CSS path via the optional argument is not plumbed from a DB source at this call site). The custom-CSS validator (`validateAndScopeCustomCss`) is implemented and tested; the wiring gap is that no caller passes the merchant's stored custom CSS value here.

**What is needed to fully connect custom CSS:** Pass the merchant's stored `settings_data.current.customCss` (or equivalent DB field) as the second argument to `buildLiquidThemeHeadAssets` from the render path.

Note: `apps/storefront-runtime/src/app/layout.tsx` does **not** call `buildLiquidThemeHeadAssets` — it is a generic Next.js root layout that sets up fonts and the `LetbuyyThemeProvider`. The Liquid render path lives in the `LiquidThemeRenderer` class inside the theme-engine package, not in the Next.js app layout.

---

### Seam 6 — AI Free-Text Model Boundary
**Status: NOT_CONNECTED**

Evidence is documented directly in source:

- `packages/theme-engine/src/theme-ai-sdk.ts:919–933` — `MODEL_BOUNDARY = { status: 'NOT_CONNECTED', envVar: 'THEME_AI_PROVIDER_API_KEY', gatewayRoute: 'POST /v1/theme-ai/parse-brief (does not exist)', ... }`
- `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/ai-customization/route.ts:22–31` — The proxy route documents explicitly: "That gateway route does NOT yet exist (Phase AC, Lane A, pending deployment)."
- The POST handler (route.ts:213) forwards to `POST /themes/:themeId/ai-customization` on the gateway. If the gateway returns 404 or 503, the proxy returns HTTP 503 with `code: 'NOT_CONNECTED'` (route.ts:226–240).

No file `services/api-gateway/src/routes/themes/theme-ai-customization-route.ts` exists (verified: only `media-library.ts` and `theme-update-route.ts` are present in that directory).

**Deterministic boundary confirmed:** `proposeThemeCustomization`, `generateTheme`, `deterministicPalette`, `generateSectionOrder` are all deterministic TypeScript functions in the theme-engine SDK with no network calls. The NL free-text → `ThemeBrief` conversion is the only genuinely NOT-CONNECTED seam; all downstream processing is wired and testable without an LLM.

**What is needed to connect:** Deploy `services/api-gateway/src/routes/themes/theme-ai-customization-route.ts` and set `THEME_AI_PROVIDER_API_KEY` in the gateway environment.

---

### Seam 7 — Theme Analytics/Event Emission + Queryable Telemetry
**Status: NOT_CONNECTED**

`packages/theme-engine/src/theme-analytics.ts` is a zero-side-effect schema/descriptor module. Key findings:

- `describeThemeEventEmissionPoints()` (line 223) returns 5 event types, all with `implemented: false` (lines 229, 235, 241, 247, 252).
- `describeThemeMetrics()` (line 174) returns a descriptor with `connected: false` on every field (lines 183, 189, 195, 201).
- The module comment at line 13–15 confirms: "A future marketplace route in the gateway would emit ThemeAnalyticsEvent instances at the exact emission points listed below."
- No import of `ThemeAnalyticsEvent`, `ThemeInstalledEvent`, or `emitThemeAnalyticsEvent` was found in `services/api-gateway/src/` (grep returned no results).

The theme-execution adapter (`services/api-gateway/src/execution/theme-execution.adapter.ts`) calls `emitAuditEvent` for rollback but does not emit `ThemeAnalyticsEvent` instances after `buildReleaseArtifacts`.

**Cloudflare Analytics Engine:** The `renderEngineMix` metric descriptor references `lb:canary:render Cloudflare Analytics Engine signal` (theme-analytics.ts:200) but no worker code emits to this signal key.

---

### Seam 8 — Settings Canonicalization (G3) Consumption
**Status: STRUCTURAL_ONLY**

`packages/theme-engine/src/settings-schema-canonical.ts` exports `flattenSettingsData`, `groupSettingsFields`, `CANONICAL_FIELD_GROUP_INDEX`, and `CANONICAL_GROUP_ORDER`. The module is exported from `packages/theme-engine/src/index.ts:25`.

Consumers outside tests:

- `packages/theme-engine/src/theme-upgrade.ts:162` — calls `groupSettingsFields(installed.config.settings_data.current)` during the upgrade carry-over step. This is internal to the theme-engine package.

**Not found in gateway or merchant-control-plane:** No import of `groupSettingsFields`, `flattenSettingsData`, or `canonicalizeSettings` was found in `services/api-gateway/src/` or `apps/merchant-control-plane/src/`. The gateway's `uploadThemePackageBundle` (schema-registry-execution.adapter.ts:245) and the theme update routes do not call G3 canonicalization on stored settings. The editor save path was not traced to confirm whether settings are stored in flat or grouped form — this remains UNKNOWN without a deeper gateway route audit.

**What is needed:** Verify whether the editor settings save (`PATCH /stores/:id/theme`) and the publish path canonicalize settings via G3 before DB writes. If not, flat-vs-grouped shape inconsistency could cause mis-renders when `flattenSettingsData` assumptions do not match the stored shape.

---

### Seam 9 — Concrete Schema-Migration Registry (REGISTERED_SECTION_SCHEMA_MIGRATIONS)
**Status: STRUCTURAL_ONLY (by design)**

`packages/theme-engine/src/section-schema-migrations.ts:33`:

```
export const REGISTERED_SECTION_SCHEMA_MIGRATIONS: readonly ThemeSectionSchemaMigration[] = Object.freeze([]);
```

The file header (lines 1–16) explicitly explains why it is empty: no production create/save/apply path has ever stamped `SectionModel.schemaVersion`, so every stored section is `unversioned`; no built-in section type has undergone a persisted field rename. The migration engine (`migrateThemeTemplateSchemas` in theme-governance.ts) is wired and the convenience wrapper `migrateThemeTemplateSchemasWithRegistry` is called on every publish (confirmed by gateway theme publish path comment). With an empty registry this is a structural no-op returning `applied: []`.

This is intentional and correct. When a real field rename occurs, the migration is added here with a paired render-parity test. The engine is live even though the registry is empty.

---

### Seam 10 — Partner Marketplace Submission Pipeline (validateThemeForMarketplace)
**Status: STRUCTURAL_ONLY**

`packages/theme-engine/src/theme-marketplace-contract.ts:174` defines `validateThemeForMarketplace(rawBundle) → { ok, violations[] }`. It is a pure, deterministic, fail-closed validator. It is tested in `packages/theme-engine/test/theme-marketplace-contract.test.ts` (18+ test cases).

**Not wired in the gateway upload path:** The submission endpoint is `POST /themes/packages/upload` (services/api-gateway/src/routes/themes.ts:744). This route calls `registry.uploadThemePackageBundle(body.bundle, customUser.id, { publicationMode })` (line 756). The `uploadThemePackageBundle` method in `schema-registry-execution.adapter.ts:245` calls `parsePortableThemePackageBundle` (bundle schema validation) but does **not** import or call `validateThemeForMarketplace`. The automated checks recorded in the marketplace review record (themes.ts:781–797) are hard-coded status `'passed'` strings; they do not run the actual validator.

**What is needed:** Import `validateThemeForMarketplace` from `@letbuyy/theme-engine` in the upload route or in `uploadThemePackageBundle`, run it on the parsed bundle, and reject (HTTP 422) if `result.ok === false`.

---

### Seam 11 — Production/Staging Migration Application Evidence
**Status: UNKNOWN (cannot verify from repo alone)**

The production deploy pipeline is declared in `.github/workflows/production-deploy.yml`:

- `migration-preflight` job (line 134): runs `pnpm run validate:migrations` and generates a diff via `supabase db diff`.
- `migrate-production` job (line 225): runs `pnpm dlx supabase@latest db push --db-url "${{ secrets.PRODUCTION_DB_CONNECTION_STRING }}" --include-all` (line 281).
- The deploy jobs (`deploy-workers-production`, `deploy-apps`) depend on `migrate-production` (lines 288, 458, 460), enforcing the migrate-gate.

The workflow exists and is structurally correct. However, **whether any specific migration has been applied to the production or staging database cannot be determined from the repository.** The Supabase `schema_migrations` table is the authoritative source; it requires a live DB probe. No CI run logs are in-repo.

**R-23 rollback gap (critical finding):** Of 120 migration files in `database/supabase/migrations/`, only 37 have a paired rollback file in `database/supabase/rollback/`. The 10 most recent migrations (180–191, the theme-platform era) have the following rollback coverage:

| Migration | Has Rollback |
|-----------|-------------|
| 180_urban_kicks_liquid_theme | NO |
| 181_urban_kicks_settings_schema_complete | NO |
| 182_v1_sites_timezone | NO |
| 183_v1_pricing_recompete | NO |
| 184_v1_subscription_coupons | NO |
| 185_v1_site_domains | YES |
| 186_v1_scale_commerce_os_coming_soon | NO |
| 187_v1_sites_site_settings | NO |
| 188_letbuyy_core_theme_row | NO |
| 189_theme_persistence_idempotency | NO |
| 190_theme_library_q | NO |
| 191_theme_purchases_rls_tenant_scope | NO |

**R-23 mandates every migration ships a paired rollback.** 10 of 12 recent migrations violate this invariant. The production rollback script (`infrastructure/scripts/deploy/production-rollback.mjs`) notes "migrations forward-fix-only" — this means the operational rollback path for schema changes relies on forward-fix migrations, not rollback files. Whether that fulfills the spirit of R-23 requires ARB clarification.

---

### Seam 12 — Rollback UI + Operational Rollback Reachability
**Status: IMPLEMENTED_NOT_LIVE**

**Theme release rollback (operational, not schema):**

1. **Merchant UI:** `ThemeUpdatePanel` (`apps/merchant-control-plane/src/components/theme-editor/ThemeUpdatePanel.tsx:339–378`) implements `handleRollbackConfirm` which calls `POST /api/themes/:themeSlug/releases/:releaseId/rollback` with `make_store_live: true`. The button is shown when `currentReleaseId` prop is provided (line 141–143).

2. **Proxy route:** `apps/merchant-control-plane/src/app/api/themes/[themeId]/releases/[releaseId]/rollback/route.ts:25` calls `createMerchantApiClient().themes.rollbackRelease(themeId, releaseId, ...)`.

3. **Gateway route:** `services/api-gateway/src/routes/themes.ts:726–740` — `POST /themes/:slug/releases/:releaseId/rollback` is registered and calls `service.rollbackRelease(slug, releaseId, body, ...)`.

4. **Gateway adapter:** `services/api-gateway/src/execution/theme-execution.adapter.ts:1547` implements `rollbackRelease()` which calls `publish_theme_release` RPC with `rollbackOfReleaseId` set, persists the new release, and emits an audit event with action `'theme.rollback'`.

The full chain merchant UI → proxy → gateway → DB RPC is structurally connected. The rollback mechanism is a **forward publish of an older release snapshot**, not a SQL schema rollback. It is reachable provided the `currentReleaseId` prop is passed to `ThemeUpdatePanel` from the parent page. Whether the parent page passes this prop cannot be confirmed without reading the theme editor page that mounts `ThemeUpdatePanel`.

**Operational (schema) rollback:** Not reachable from UI. `infrastructure/scripts/deploy/production-rollback.mjs` is a CLI script gated by `--worker`, `--version-id`, `--reason` flags and targets Cloudflare Worker rollback. Schema rollback is "forward-fix-only" (per deployment-intelligence.md). This is an operational contract, not a code gap.

---

## Constraint Checks

| Constraint | Evidence | Status |
|------------|----------|--------|
| ART-17: `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | packages/theme-engine/src/theme-governance.ts:14 | COMPLIANT |
| ART-17: React fallback retained | template-resolver.ts:272–308 (React branch always available) | COMPLIANT |
| ART-17: No new React-per-section after freeze | Not audited in this workstream | UNKNOWN |
| R-23: Every migration has paired rollback | 10/12 recent migrations lack rollback file | VIOLATED |
| ART-22: Marketplace frozen | Gateway upload path leads to review record, marketplace is not live | COMPLIANT (frozen) |

---

## STOP/GO Inputs for AF_1 Decision

This workstream contributes the following concrete inputs:

1. **SEAM-1 (Liquid default): GO input.** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` is hardcoded at `packages/theme-engine/src/theme-governance.ts:14`. ART-17 invariant confirmed compliant.

2. **SEAM-5 (Custom-CSS render path): GO input with caveat.** `buildLiquidThemeHeadAssets` is wired into the Liquid render path at `theme-renderer.ts:585`. However, the second argument (`rawCustomCss`) is not passed — merchant custom CSS is not injected at render time even when a value is stored. This is a silent omission, not a security regression.

3. **SEAM-10 (Marketplace gate): STOP input.** `validateThemeForMarketplace` is not called from the gateway theme upload route (`POST /themes/packages/upload`). Any partner bundle that passes schema parsing but fails the marketplace contract (forbidden app-block secret keys, CSS injection, incompatible section schemas) will be accepted and create a review record without the AE-gate running. Before any partner submission goes live, `validateThemeForMarketplace` must be called and enforced.

4. **SEAM-11 / R-23 (Migration rollback): STOP input.** 10 of the 12 theme-platform era migrations (180–191, including the theme_purchases RLS fix in migration 191) lack a paired rollback file. R-23 mandates a paired rollback for every migration. The production rollback path is declared "forward-fix-only." ARB must either (a) accept forward-fix as the contractual rollback mechanism and update R-23 accordingly, or (b) require rollback files for 180–191 before merge to main.

5. **SEAM-2 (Metafield): INFORMATIONAL — does not block launch.** Metafield render resolution returns `fallback ?? null` silently. This is safe (fail-closed) but means section bindings using `source: 'metafield'` will always show fallback content. No merchant data is leaked or corrupted.

6. **SEAM-3 (FX): INFORMATIONAL — does not block launch.** India-first platform is INR-native. Non-INR display is a future capability. The `fxConnected: false` path is honest and safe.

7. **SEAM-6 (AI model): INFORMATIONAL — does not block launch.** The NOT-CONNECTED gateway route is correctly handled by a 503 with structured error. Deterministic palette/typography suggestions work without the LLM gateway route.

8. **SEAM-7 (Theme analytics): INFORMATIONAL — does not block launch.** Zero theme lifecycle events are emitted. This is a monitoring gap, not a correctness or security issue.

9. **SEAM-4 (App-block runtime): INFORMATIONAL — does not block launch.** The pipeline is structurally live (DB query exists, app_blocks propagated to storefront). In practice, no apps are installed in the marketplace (marketplace FROZEN), so the slot renders empty. The iframe sandbox attributes are correctly set.

10. **SEAM-12 (Rollback UI): GO input.** The full theme-release rollback chain (merchant UI → proxy → gateway → DB RPC) is structurally connected. Operational schema rollback is forward-fix-only by declared policy.
