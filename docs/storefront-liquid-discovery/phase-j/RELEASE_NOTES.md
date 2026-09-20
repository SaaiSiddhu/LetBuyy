# Storefront Liquid Platform — Release Notes
## Phases B through I (Enterprise Transformation Program)

**Document ID:** LIQUID-RELEASE-NOTES-2026-07-10
**Date:** 2026-07-10
**Branch:** stepup/main
**Audiences:** Merchant, Developer, Operator

---

### Authority Statement

**The platform-wide Liquid flip has NOT occurred.** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` at `packages/theme-engine/src/theme-governance.ts:14` and has not been changed. `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'` at the same file, lines 16–21. Every storefront continues to render React by default.

This document describes what was built during Phases B–I on `stepup/main`. None of the work in these phases activates Liquid for any merchant without an explicit per-store engine signal in their `theme_releases.release_manifest`. The ARB holds the only authority to issue the platform-wide activation.

---

## Phase Summary

| Phase | Commit | What It Delivered |
|-------|--------|-------------------|
| B | `93419c58` | Architecture certification — 56-item risk register, 7 ARB-gate blockers identified |
| C | `be56a6fd` | Critical platform fixes — crash recovery, React fallback, branding leak removed, newsletter alias, postMessage bridge |
| D | `4546f27b` | Data completeness — linklists/navigation, settings parity, fonts wired, search drop, hero-banner fields, registration no-JS |
| E | `7b111a94` | Template coverage — blog, article, CMS page, 404, password, routes drop, customer login no-JS |
| F | `51d9dd74` | Performance and security hardening — parse cache, parallel section rendering, logout CSRF fix, chrome fallback seam |
| G | `7cdd42a1` | Schema governance — version gate, migration engine, settings canonicalization, letbuyy-core DB row, experience validation |
| H | `06d3cc85` | Developer platform — Theme SDK, linter, packager, exporter, CLI, .liquid example artifacts, docs |
| I | `dbcf173a` | QA certification — 48 new tests (A11Y, security, SSR contracts, hydration parity), adversarial hardening, confirmed product bug |

---

## Phase B — Architecture Certification

**What this phase was.** Phase B was a static read-only audit of the storefront/Liquid discovery corpus (docs 01–12). No code was written. The output was a risk register and a definitive list of ARB-gate blockers.

**Key findings that drove Phases C–I:**

| Blocker ID | Finding |
|---|---|
| B-1 | `CenterPanel` sends `LETBUYY_THEME_EDITOR_SELECTION`; editor iframe listens for `letbuyy:theme-editor:section-selected` — key mismatch, section highlighting broken |
| B-2 | React schema type `newsletter`; Liquid bundle type `newsletter-signup` — render-time lookup miss |
| B-3 | `buildGoogleFontsHref()` dead code; four font families missing; `--font-playfair` pointed at wrong typeface |
| B-4 | `StoreModel.navigation` never forwarded to Liquid scope; `{{ linklists.main_menu }}` always nil |
| B-5 | Section-schema migration interface built; zero migrations registered; no forward-migration path |
| B-6 | `letbuyy-core` theme slug defined in code; no corresponding row in `themes` table |
| B-7 | DB stores flat `appearance` settings group; TypeScript schema defines 5 groups — dual shapes incompatible |

All seven blockers are reconciled against committed source below (see Section: ARB-Gate Blocker Reconciliation).

---

## Phase C — Critical Platform Fixes

**Commit:** `be56a6fd`

### For Merchants

If a Liquid section throws an error at render time, the rest of the page now renders normally. Previously, any unhandled Liquid error produced a hard 500 error for every visitor. The page now degrades gracefully: the failing section is replaced with an HTML comment placeholder and the rest of the page is served. If all sections fail, the platform transparently serves the React version of the page with no visible disruption.

### For Developers

**C1 — Per-section crash recovery** (`packages/theme-engine/src/theme-renderer.ts`): Block-level, section-level, region-level, and layout-level try/catch added. A new `ThemeRendererStatus` value `'error'` distinguishes "all sections failed" from "no Liquid bundle." Section errors produce `<!-- lb:section-error sectionId="..." type="..." -->` HTML comments in the rendered output. `lb:liquid:block-error` is emitted via `console.warn` for block-level failures. **Status: CONNECTED** — emission point at `theme-renderer.ts` Phase C block-level catch.

**C2 — Composition-engine outer catch** (`apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:623–635`): Any unexpected throw from `renderLiquidPlan` is caught, emits `lb:canary:render:fallback` (console.warn), and returns `null` — causing `StorefrontCompositionEngine` to render React. The `fallback_reason` field is set to `'renderer_returned_null'` in the `lb:canary:render` signal when the Liquid path returned null. **Status: CONNECTED** — emission point at `composition-engine.tsx:629–633` and `675`.

**C3 — Urban Kicks branding leak removed** (`apps/storefront-runtime/src/lib/store-service.ts`): Stores whose Liquid bundle fails schema validation previously inherited the Urban Kicks demo theme branding. That fallback has been removed. Stores with absent or invalid Liquid bundles now transparently fall back to React — no branding artifact.

**C4 — Newsletter section alias** (`packages/theme-engine/src/theme-renderer.ts:280–284`): `LIQUID_SECTION_TYPE_ALIASES` resolves `newsletter` to `newsletter-signup` at render time, closing the silent lookup miss for bundles that use the React section type name.

**C5 — postMessage protocol centralized** (`packages/theme-engine/src/editor-bridge-protocol.ts`): `EDITOR_LEGACY_SELECTION_MESSAGE = 'LETBUYY_THEME_EDITOR_SELECTION'` extracted to a single constant. `StorefrontPreviewBridge` (`apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx`) listens for the legacy message type and re-posts as the namespaced `letbuyy:theme-editor:section-selected`. The editor section-selection highlight works for Liquid preview.

**Test gate after Phase C:** 89/89 theme-engine tests pass; 19/19 storefront-runtime tests pass.

---

## Phase D — Data Completeness

**Commit:** `4546f27b`

### For Merchants

Navigation menus now resolve correctly in Liquid templates. Themes using `{{ linklists.main_menu }}`, `{{ linklists.footer_menu }}`, or `{{ linklists.policy_menu }}` receive live data from the store's navigation settings. Font families load from Google Fonts for all ten preset experiences (Aura, Craft, Dawn, and Sense no longer render with system-font fallback). The customer registration page no longer loses the no-JS POST path.

### For Developers

**D1 — Linklists / navigation** (`apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:335–355`): `navToLinklists()` converts `StoreModel.navigation` to Shopify-convention linklists with underscore-keyed handles (`main_menu`, `footer_menu`, `policy_menu`). Keys use underscore form specifically because `toLiquidDrop` sanitizer rejects hyphen-containing keys. `active` is computed from SSR route path — never fabricated. Linklists enter `buildLiquidScope()` (defined at `packages/theme-engine/src/theme-renderer.ts:792`, called for the main layout render at line 568) via `input.liquidContext.linklists`.

**D2 — Settings parity** (`packages/theme-engine/src/theme-renderer.ts:690–709`): Both flat (`{{ settings.primaryColor }}`) and grouped (`{{ settings.colors.primaryColor }}`) key paths now resolve. Grouped keys are built from `settings_schema.settings` group definitions; flat keys are spread on top. Both DB-stored shapes (flat `appearance` group from migrations 180–181 and the 5-group TypeScript schema) are tolerated without error.

**D5 — Search drop** (`packages/theme-engine/src/theme-renderer.ts`): `{{ search.results }}` is now populated in the Liquid scope from `plan.searchResults` when present.

**D6 — Hero-banner field parity** (`packages/theme-engine/src/theme-bundle.ts:1009–1035`): `image` (image_picker), `overlay` (range 0–1), `height` (select: full/large/medium/small), and `textAlign` (select: left/center/right) added to the hero-banner section schema to match the React `heroBanner` schema.

**D7 — Font wiring and CSP** (`apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:138` and `next-security-headers.ts:66–67`): `buildGoogleFontsHref()` is now called in the store layout. FONT_MAP extended with Cormorant Garamond, Libre Baskerville, Source Sans Pro, and Lato. `--font-playfair` corrected to `"Playfair Display", Georgia, "Times New Roman", serif`. CSP updated for `fonts.googleapis.com` and `fonts.gstatic.com`.

**D8 — BLOCKED_DROP_KEYS** (`packages/theme-engine/src/theme-renderer.ts`): Expanded to 13 credential-adjacent keys that must never appear in the Liquid drop (keys like `access_token`, `password_hash`, service-role indicators). Pinned by SEC-7 test.

**D10 — Registration no-JS route contract** (`apps/storefront-runtime`): `POST /api/customer/register` contract verified. The Liquid registration template emits a plain HTML form pointing at this route.

**Test gate after Phase D:** 101/101 theme-engine tests pass; 31/31 storefront-runtime tests pass.

---

## Phase E — Template Route Coverage

**Commit:** `7b111a94`

### For Merchants

Template route coverage for Liquid-enabled stores moves from 67% (10 of 15 route types) to 100% (15 of 15 route types). Blog listing, individual article, CMS/content pages, 404 pages, and password-protected stores are all now served by the Liquid render path when a store uses Liquid. The customer login page works without JavaScript (a plain HTML form POST is supported server-side).

### For Developers

**E1 — Blog listing template** (`packages/theme-engine/src/theme-bundle.ts:2259–2267`): Template key `blog` added. `blog-listing` section iterates `{{ blog.articles }}` with title, excerpt, date, featured image, and pagination controls. Data sourced from real `blog_posts` table via `GET /:subdomain/blog` (`public-routes.ts:1226`).

**E2 — Article template**: Template key `article` added. Individual blog post rendering with `{{ article.title }}`, `{{ article.body_html }}`, and related article links.

**E3 — CMS page / content page template**: Template key `page` added. `contentPage` section alias resolves the one-line gap between the React type name and the Liquid bundle type.

**E4 — 404 template**: Template key `404` added; `not-found.tsx` wired to the Liquid render path.

**E5 — Password template**: Template key `password` added for stores in access-controlled mode. Note: the password template activates only when a store's `access_mode` requires a gate. It is not in the production rendering path for open stores.

**E6 — Routes drop parity** (`packages/theme-engine/src/theme-renderer.ts`): `{{ routes.account_url }}`, `{{ routes.cart_url }}`, `{{ routes.collections_url }}`, and related route variables are now populated in the Liquid scope.

**E8/E9 — Customer login no-JS** (`apps/storefront-runtime/src/app/store/[subdomain]/customers/login/page.tsx` + `api/customer/login/route.ts`): The Liquid login template emits a plain HTML form. The login API route accepts both `application/x-www-form-urlencoded` (no-JS form POST path) and `application/json`. Form errors return a 303 redirect (not raw JSON). The hidden `storeId` field in the form body enables multi-tenant routing without JavaScript. Same-origin guard on redirect target prevents open-redirect abuse.

**Test gate after Phase E:** 109/109 theme-engine tests pass; 52/52 storefront-runtime tests pass.

---

## Phase F — Performance and Security Hardening

**Commit:** `51d9dd74`

### For Merchants

Page render time for Liquid-enabled stores is improved. The server renders all page sections in parallel instead of sequentially. Customer logout now uses a secure POST form rather than a GET link — this closes a CSRF vulnerability where a third party could log a customer out via a crafted link.

### For Developers and Operators

**F1 — Template parse cache** (`packages/theme-engine/src/theme-renderer.ts`): LiquidJS `cache: true` enabled. The built-in LRU caches compiled template parse trees within the engine instance lifetime. String defensive copies are made at engine construction to guard against source mutation corrupting the LRU.

> Measurement note (CONNECTED for structural numbers, NOT-CONNECTED for production fleet): The Phase F benchmark (`packages/theme-engine/test/liquid-render-benchmark.test.ts`) measures N=25 Urban Kicks renders in a single Node.js process. Measured: cold=24 ms, steady=11 ms, p95=17 ms, total=288 ms (budget: 30,000 ms). These are local numbers. Production CPU time per request (Cloudflare Workers) is NOT-CONNECTED — requires `OTEL_EXPORTER_OTLP_ENDPOINT` or Cloudflare Analytics Engine. Cross-request LRU benefit (engine pooling) is not implemented; LRU benefit is intra-request only.

**F2 — Parallel section rendering** (`packages/theme-engine/src/theme-renderer.ts`): `renderLiquidTemplateSections` changed from sequential `await` to `Promise.allSettled`. Section render errors are isolated per-section; a slow or failing section does not delay others.

**F3 — Bundle parse cache (WeakMap)** — Deliberately skipped. ISR/serverless deserialization produces fresh bundle objects per request, making WeakMap keying impossible. Zod parse time is negligible relative to template render cost. Confirmed non-issue.

**F4 — lb-logout Web Component with no-JS fallback** (`packages/theme-engine/src/theme-bundle.ts`): The `lb-logout` custom element wraps a `<form method="post" action="/api/customer/logout">` for no-JS environments. The API route validates `Origin` header server-side as a CSRF guard. The GET anchor pattern is removed. Drift-detection test pins the form nesting in `theme-bundle.ts`.

**F5 — Chrome-fallback seam** (`apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:706–735`): When a Liquid render returns `null` (crash-recovery or version-gate rejection), the composition engine renders React body sections wrapped with React header/footer from `plan.sectionGroups`. This prevents a header-less or footer-less page on Liquid failure.

**H3 — validGateCookie staleness fix** (`apps/storefront-runtime/src/proxy.ts`): `validGateCookie()` re-validates against the live `site.access_mode` value fetched from the DB, closing the window where a cached gate cookie would not reflect a merchant's `access_mode` change.

**HTML comment injection defense** (`packages/theme-engine/src/theme-renderer.ts`): `escapeHtmlCommentValue()` strips `--` sequences from error placeholder comments (`<!-- lb:section-error ... -->`), preventing injection of `-->` sequences that could break comment boundaries.

**`fallback_reason` telemetry accuracy fix** (`apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx`): `fallback_reason: 'renderer_returned_null'` is set only when `plan.rendererEngine === 'liquid'` AND `liquidHtml === null`. React-path renders no longer incorrectly set this field. Pinned by `lb-storefront-ssr-contracts.test.mjs` F5 tests.

**Test gate after Phase F:** 157/157 theme-engine tests pass; 52/52 storefront-runtime tests pass. Phase F F9 benchmark: PASS (288 ms total, within 30,000 ms budget).

---

## Phase G — Schema Governance

**Commit:** `7cdd42a1`

### For Merchants

Theme publishing is now more resilient. A theme bundle with an unknown or future schema version is rejected cleanly at the renderer level and the store transparently serves the React version of the page. No merchant data or stored configuration is modified. Migration 188 adds the `letbuyy-core` theme row to the database (idempotent; takes effect when applied via the deploy pipeline).

### For Developers and Operators

**G1 — Section-schema migration engine** (`packages/theme-engine/src/section-schema-migrations.ts`): `migrateThemeTemplateSchemas()` wrapper and `REGISTERED_SECTION_SCHEMA_MIGRATIONS` registry implemented. The registry is currently empty — no breaking section schema change has shipped. When a future breaking change is needed, registering a `ThemeSectionSchemaMigration` object causes stored `template_snapshot` data to migrate forward automatically at the next theme publish. The infrastructure is proven by test. The empty-registry fast-path is a confirmed no-op that does not affect render output.

**G1 wire** (`services/api-gateway/src/execution/theme-execution.adapter.ts`): Migration engine wired into the gateway theme-publish path, before snapshot write. Empty registry means this is a zero-cost no-op today.

**G3 — Settings-schema canonicalization** (`packages/theme-engine/src/settings-schema-canonical.ts`): Lossless round-trip functions `group(flat)` and `flatten(5-group)` implemented and exported. The render path tolerates both the DB-stored flat shape and the TypeScript 5-group shape (Phase D D2). G3-consume (wiring canonicalization at gateway publish time) is explicitly deferred — it would rewrite stored `settings_schema` entries and break editor settings-form rendering without a coordinated editor-side migration. Deferred pending an editor-side companion PR.

**G4 — Bundle schema version gate** (`packages/theme-engine/src/theme-bundle.ts:1361` and `theme-renderer.ts:491`): `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS = ['2026-06-liquid-sections']` defines the allowlist. A bundle with a missing `schema_version` is stamped to the current version at parse time. A bundle with an explicit unrecognized `schema_version` throws `UnsupportedLiquidBundleSchemaVersionError`, caught at the renderer and returned as `status: 'unsupported'` — the composition engine falls back to React. No crash; no hard 500.

**G5 — `letbuyy-core` DB row** (`database/supabase/migrations/188_letbuyy_core_theme_row.sql`): Idempotent `INSERT ... ON CONFLICT (slug) DO NOTHING`. Clones the `urban-kicks` row with `slug = 'letbuyy-core'`. Prerequisite for the `letbuyy-core` code alias to resolve at runtime. Takes effect when the migration is applied via the Supabase deploy pipeline — not yet applied to any environment by this commit.

**G6 — Experience applied-output validation** (`packages/theme-engine/src/theme-presets.ts`): After an experience preset is applied, the resulting config overlay is validated against canonical field types. A malformed overlay triggers a fail-safe fallback to the pre-apply config. No valid experience preset is affected.

**Test gate after Phase G:** 157/157 theme-engine tests pass; 52/52 storefront-runtime tests pass. `theme-governance-validator.mjs`: PASS. `migration-safety-validator.mjs`: PASS. `validate-governance.mjs`: pre-existing FAIL on tenant-table registry (unrelated to Phase G; human-owned).

---

## Phase H — Developer Platform

**Commit:** `06d3cc85`

This phase ships the developer-facing surface: a public TypeScript SDK, a CLI, a theme linter, a SHA-256 packager, a deterministic artifact exporter, committed `.liquid` file examples, and developer documentation. These tools are for developers building or validating Liquid themes — they have no effect on merchant storefronts.

### Theme SDK (`packages/theme-engine/src/theme-sdk.ts`)

Six documented public functions, all delegating to real internal implementations. No stubs.

| Function | What It Does |
|---|---|
| `validateTheme(input)` | Runs Zod validation + G4 schema version gate. Returns `{ok, issues, bundle?}`. |
| `compileTheme(config, opts?)` | Compiles a portable JSON template config to a `LiquidThemePackageBundle`. Returns `{bundle, warnings}`. |
| `lintTheme(bundle)` | Re-exports `lintThemeBundle`. Returns `ThemeLintIssue[]`. |
| `renderPreview(bundle, opts?)` | Renders a preview using a minimal `StoreTemplateConfig`. Requires JSDOM environment. Returns `Promise<ThemeRendererResult>`. |
| `listSectionTypes()` | Returns a deduplicated, sorted `readonly string[]` of all known section type names (≥ 20 entries). |
| `getSectionSchema(type)` | Looks up the `SectionSchema` for a camelCase built-in type. Returns `null` for unknown types. |

### Theme Linter (`packages/theme-engine/src/theme-linter.ts`)

Five rules. Security rules import their deny-lists from `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` so the linter policy tracks the renderer's sanitizer configuration automatically.

| Rule | Level | What It Checks |
|---|---|---|
| `unknown-section-type` | warn | Section key not in the known built-in registry |
| `forbidden-tag` | error | Source contains `<base>`, `<embed>`, `<object>`, `<script>` |
| `forbidden-attr` | error | Source contains a forbidden attribute (dynamically derived from `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG.FORBID_ATTR` — e.g. `style=`). Single source of truth shared with the renderer sanitizer. |
| `missing-schema-block` | error | Source is missing `{% schema %}` / `{% endschema %}` |
| `setting-referenced-not-in-schema` | warn | `{{ section.settings.<key> }}` references a key absent from the schema (heuristic; false positives possible on dynamic keys) |

### Artifact Exporter (`packages/theme-engine/src/theme-artifact-exporter.ts`)

`exportThemeBundleToFiles(bundle)` converts an in-memory `LiquidThemePackageBundle` to a sorted, deterministic list of `{path, contents}` pairs matching a real Liquid theme directory layout (`layout/`, `sections/`, `blocks/`, `config/`, `templates/`, `locales/`, `letbuyy-theme.json`). Output is byte-identical to the `bundle.sections[key].source` strings — no escaping or re-encoding of Liquid template content.

### Theme Packager (`packages/theme-engine/src/theme-packager.ts`)

`packageThemeBundle(bundle)` produces a `ThemePackageManifest` with SHA-256 checksums for each exported file, using `node:crypto`. Deterministic across runs on the same bundle.

### Theme CLI (`packages/theme-engine/src/theme-cli.ts`)

```bash
# Validate a bundle against the schema version gate
npx tsx packages/theme-engine/src/theme-cli.ts validate <bundle.json>

# Lint a bundle for forbidden tags, missing schema blocks, unknown section types
npx tsx packages/theme-engine/src/theme-cli.ts lint <bundle.json>

# Compile a portable config to a LiquidThemePackageBundle
npx tsx packages/theme-engine/src/theme-cli.ts compile <config.json>

# Export a bundle to on-disk .liquid files
npx tsx packages/theme-engine/src/theme-cli.ts export <bundle.json>
```

### Example Artifacts (`packages/theme-engine/examples/`)

Committed canonical output of `exportThemeBundleToFiles` and `packageThemeBundle` for both first-party bundles: `urban-kicks-liquid/` and `letbuyy-core-liquid/`. Each directory contains `bundle.json`, `manifest.json`, and a `files/` tree (layout, 42+ `.liquid` section files, blocks, config, templates, locales, `letbuyy-theme.json`). Drift-detection tests (`test/theme-examples.test.ts`, 7 tests) fail CI immediately if `theme-bundle.ts` changes without regenerating these artifacts.

> Important: The `.liquid` files in `examples/` are read-only views. The TypeScript string literals in `theme-bundle.ts` are the authoritative source of truth. To regenerate: `node packages/theme-engine/examples/generate-examples.mjs`.

### Developer Documentation

`docs/storefront-liquid-discovery/developer/` (5 files): Theme SDK API reference, CLI command reference, Liquid section authoring guide, example artifacts guide, and a README with quick-start commands.

**Test gate after Phase H:** 198/198 theme-engine tests pass; 52/52 storefront-runtime tests pass. Byte-identity law proven for Urban Kicks and letbuyy-core (all 23+ section types character-for-character identical through the export pipeline).

---

## Phase I — QA Certification

**Commit:** `dbcf173a`

Phase I authors 48 new tests, performs adversarial review of all Phase I assertions, applies three hardening corrections, and honestly catalogs which QA categories are CONNECTED from the repository and which require live infrastructure.

### New Tests Added

| File | Count | Category |
|---|---|---|
| `packages/theme-engine/test/qi-a11y.test.ts` | 8 | Accessibility (A11Y-1 through A11Y-8) |
| `packages/theme-engine/test/qi-security.test.ts` | 13 (incl. 1 hardening) | Security (SEC-1a/b/c, SEC-2, SEC-3a/b, SEC-4–SEC-10, SEC-6b) |
| `tests/theme-engine/liquid-hydration-islands-parity.test.mjs` | 13 | SSR-to-client hydration parity |
| `tests/launch/lb-storefront-ssr-contracts.test.mjs` | 13 | SSR contracts (E8 login, F5 fallback telemetry) |
| **Total** | **47 + 1 hardening = 48** | |

**Test gate after Phase I:** theme-engine **221/221 PASS**; storefront-runtime **78/78 PASS**; api-gateway typecheck 32 tasks exit 0; merchant-control-plane **15/15 PASS**.

### Test Progression (all phases)

| Phase | theme-engine | storefront-runtime |
|---|---|---|
| B | BLOCKED (infrastructure) | BLOCKED |
| C | 89/89 | 19/19 |
| D | 101/101 | 31/31 |
| E | 109/109 | 52/52 |
| F | 157/157 | 52/52 |
| G | 157/157 | 52/52 |
| H | 198/198 | 52/52 |
| I | **221/221** | **78/78** |

### Real Product Bug Found and Fixed — I-F1 (CLOSED in commit dbcf173a)

**Finding:** DOMPurify 3.x DOM-clobbering protection strips `name="name"` from `<input type="text" name="name">` in the customer-register Liquid section. `ADD_ATTR: ['name']` does not override the clobbering guard, which runs first.

**Impact (before fix):** When a customer submits the registration form without JavaScript (no-JS POST path), the `name` field was absent from the POST body. The gateway received no customer name and the account was created with a null/empty name field.

**Fix (commit dbcf173a):** The template form field was renamed from `name="name"` to `name="fullName"` in `packages/theme-engine/src/theme-bundle.ts:2433`. The field name `fullName` is not a property of `HTMLInputElement`, so DOMPurify's clobbering guard does not strip it. The register route (`apps/storefront-runtime/src/app/api/customer/register/route.ts:45`) reads `form.get('fullName') ?? form.get('name')`, accepting both the new field name and any legacy submissions.

**Test evidence:** A11Y-5 (`packages/theme-engine/test/qi-a11y.test.ts:170–171`) now asserts `name="fullName"` is present after DOMPurify and `name="name"` is absent. 221/221 PASS.

**Status: CLOSED. This is not a GO gate for any stage of the canary rollout.**

---

## ARB-Gate Blocker Reconciliation

Seven blockers were identified at Phase B. Current state against committed source:

| ID | Blocker | State | Evidence |
|---|---|---|---|
| B-1 | postMessage key mismatch — editor section highlight broken | **CLOSED** | `StorefrontPreviewBridge` (`apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx`) listens for `EDITOR_LEGACY_SELECTION_MESSAGE` (Phase C C-04). Protocol centralized in `packages/theme-engine/src/editor-bridge-protocol.ts:6`. |
| B-2 | `newsletter` / `newsletter-signup` type split — silent section miss | **CLOSED** | Compile-time: `PORTABLE_TO_LIQUID_TYPE_OVERRIDES` (`packages/theme-engine/src/portable-to-liquid.ts:50`). Render-time: `LIQUID_SECTION_TYPE_ALIASES` (`theme-renderer.ts:280–284`). Residual LOW: bundles written directly to DB bypassing compiler are covered by render-time alias but not by Zod parse-time check. |
| B-3 | Fonts not wired | **CLOSED** | Phase D D7. `buildGoogleFontsHref()` called at `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:138`. FONT_MAP extended. `--font-playfair` corrected. CSP updated at `next-security-headers.ts:66–67`. |
| B-4 | `linklists` absent from Liquid scope | **CLOSED** | Phase D D1. `navToLinklists()` at `composition-engine.tsx:335–355`. Linklists enter `buildLiquidScope()` (defined `theme-renderer.ts:792`, called for the layout render at `theme-renderer.ts:568`) via `input.liquidContext.linklists`. Residual LOW: `linklist` singular alias not registered; Shopify canonical is the plural form. |
| B-5 | Schema migration engine — zero concrete migrations | **MITIGATED** | Phase G G1. Infrastructure at `packages/theme-engine/src/section-schema-migrations.ts`. Registry currently empty (correct — no breaking schema change has shipped). G3-consume deferred. Settings-schema dual-shape tolerated by render path; canonicalization utility built but not yet wired at publish time (deferred to avoid breaking editor settings forms). |
| B-6 | `letbuyy-core` DB row missing | **CLOSED** | Phase G G5. Migration `database/supabase/migrations/188_letbuyy_core_theme_row.sql` committed. Idempotent. Takes effect when applied via deploy pipeline. |
| B-7 | Settings dual-shape (DB flat vs TS 5-group) | **MITIGATED** | Phase G G3. Lossless canonicalization utility at `packages/theme-engine/src/settings-schema-canonical.ts`. Render path tolerates both shapes. G3-consume deferred (would break editor settings-form rendering without coordinated editor-side migration). Editor and Liquid render may show different settings organization until G3-consume lands. |

---

## What Is Behind the ARB Flag

The following capabilities are built and tested but are NOT active for any merchant storefront by default. They require ARB authority to activate at platform scale.

### Platform-Wide Liquid Activation

- **Default:** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (`packages/theme-engine/src/theme-governance.ts:14`). This is a compile-time constant, not a runtime env var. Changing it requires a Next.js redeploy of storefront-runtime.
- **The decision object** `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` at `theme-governance.ts:16–21` has `status: 'deferred'`. It is documentation-only and is NOT read by `resolveThemeLiquidRenderingEnabled()`.
- **Per-store activation (available today, no ARB required for individual stores):** Setting `renderer_engine: 'liquid'` in a store's `theme_releases.release_manifest` (via the gateway's `buildReleaseArtifacts()` path when a `liquidBundle` is present) activates Liquid for that store only.
- **Eleven canary aliases:** `resolveThemeLiquidRenderingEnabled()` at `theme-governance.ts:162–179` accepts truthy values in eleven named paths across `templateConfig`, `themeSettings`, `releaseManifest`, and `rendererManifest`. Truthy values: `1`, `'true'`, `'enabled'`, `'on'`, `'canary'`. Falsy rollback values: `'0'`, `'false'`, `'disabled'`, `'off'`.
- **No gradual rollout (percentage-of-stores) mechanism exists.** Per-store activation is the only available staged path. An ARB-approved percentage rollout mechanism would require net-new infrastructure.

### Gateway `FEATURE_LIQUID` Flag — DORMANT

`FEATURE_LIQUID = 'false'` in production wrangler (`services/api-gateway/wrangler.toml:248`). Declared in `featureFlags.ts:4` and `index.ts:227`. However, `featureGate('FEATURE_LIQUID', ...)` is never called in any gateway route. This flag has zero runtime effect. The ARB may wish to wire this as a kill switch for theme-publish routes before platform flip; doing so requires a gateway code change and deploy.

### Settings-Schema Canonicalization (G3-consume) — DEFERRED

`packages/theme-engine/src/settings-schema-canonical.ts` is built and tested. Wiring it at theme-publish time (G3-consume) would rewrite stored `settings_schema` entries into the 5-group canonical form, changing what the editor reads for settings forms. This requires a coordinated editor-side migration and is explicitly deferred.

---

## Activation and Rollback Reference for Operators

### How Liquid Activates Per Store

1. Merchant publishes a theme release with a `liquidBundle` present.
2. Gateway's `buildReleaseArtifacts()` (`services/api-gateway/src/execution/theme-execution.adapter.ts:620–643`) sets `renderer_engine: 'liquid'` in `theme_releases.release_manifest`.
3. `storefront-runtime` reads this via `mapSupabaseToStore()` → `resolveThemeLiquidRenderingEnabled()`.
4. Per-request: `composition-engine.tsx` routes to `renderLiquidPlan`.
5. On success: Liquid HTML is served. On any failure: React fallback is served transparently.

Migration 180 sets `themes.default_template.rendererEngine = 'liquid'` for the `urban-kicks` theme row. The gateway `STOREFRONT_SITE_SELECT` does NOT join the `themes` table, so this value does not directly activate Liquid for stores. Activation flows only through published `theme_releases.release_manifest.renderer_engine`. Stores on `urban-kicks` with no published release continue to render React.

### Fastest Per-Store Rollback (no code deploy required)

1. **DB update:** Set `theme_releases.release_manifest -> renderer_engine` to any non-`'liquid'` value (e.g., `'json-contract'`) for the store's `current_theme_release_id`. Takes effect after ISR revalidation (60 seconds per `export const revalidate = 60` in `app/store/[subdomain]/page.tsx`).

2. **Canary alias falsy:** Set any of the eleven canary aliases to `false`, `'false'`, `'0'`, `'disabled'`, or `'off'` in the store's `sites.template_config` or `theme_releases.release_manifest`. Verified via `readBooleanDecision()` at `theme-governance.ts:130`.

3. **Publish without liquidBundle:** Gateway sets `renderer_engine: 'json-contract'` when no liquidBundle is detected. This is the standard merchant path.

### Platform-Level Emergency Rollback (requires gateway deploy)

Wire `FEATURE_LIQUID` to `featureGate()` in the gateway (`services/api-gateway/src/routes/` — currently no call site). Set `FEATURE_LIQUID = 'false'` in production `wrangler.toml`. This blocks all Liquid theme-publish routes. Existing published releases are unaffected (they are already in `theme_releases`); the next publish for each store would not include a `liquidBundle`.

---

## Telemetry Reference for Operators

All signals emitted by committed source on `stepup/main`. Live ingestion requires Cloudflare infrastructure (NOT-CONNECTED in this repository).

### CONNECTED — Emission points verified in source

| Signal | Emission point | Fields |
|---|---|---|
| `lb:canary:render` (structured log, console.log) | `composition-engine.tsx:663–677` | `event`, `engine` ('liquid'/'react'), `subdomain`, `template`, `route_type`, `latency_ms`, `editor_mode`, `fallback_reason` (null or 'renderer_returned_null'), `cache_hit` (always null — see note) |
| `lb:canary:render:fallback` (structured warn, console.warn) | `composition-engine.tsx:629–633` | `event`, `reason` (error message, max 200 chars), `subdomain`, `template` |
| `lb:liquid:block-error` (structured warn, console.warn) | `theme-renderer.ts:777` (Phase C block-level catch) | `event`, `blockId`, `blockType`, `error` (truncated to 200 chars). No `sectionId` field; correlation to a specific store requires joining on timestamp with surrounding `lb:canary:render` events. |
| `renderer_engine` field in `theme_releases.release_manifest` | `theme-execution.adapter.ts:643` | `'liquid'` when `liquidBundle` present; `'json-contract'` otherwise. Query: `SELECT release_manifest->>'renderer_engine' FROM theme_releases WHERE id = current_theme_release_id` |
| `liquid_ready` field in `theme_releases.release_manifest` | `theme-execution.adapter.ts:644` | Boolean; written at publish time |
| `X-Lb-Render-Engine` response header | `proxy.ts:175–176` (rewriteToStore) | `'liquid'` or `'react'` based on global env var `THEME_LIQUID_RENDERING_DEFAULT_ENABLED`. **WARNING:** reflects the global constant, NOT per-store resolution. With global default OFF and per-store Liquid ON, this header reads `'react'` even for a Liquid-rendered page. Usable only to confirm global flip state. |
| `<!-- lb:section-error sectionId="..." type="..." -->` in HTML | `theme-renderer.ts` (Phase C C1 per-section catch) | Marks a skipped section in the rendered HTML output |

> **`cache_hit` note:** The `cache_hit` field in `lb:canary:render` is always `null`. A per-request render cache beyond the LiquidJS engine-instance LRU is not implemented. The field is present in the log structure for future use.

> **G4 version-gate indicator note:** There is no dedicated signal for G4 rejections. `UnsupportedLiquidBundleSchemaVersionError` causes `status: 'unsupported'` in the renderer (no throw). The composition engine emits `fallback_reason: 'renderer_returned_null'` in `lb:canary:render` for any Liquid plan where `liquidHtml === null`, which includes G4 rejections — but also other renderer-returned-null causes. G4 rejections cannot currently be distinguished from other fallback causes without a dedicated field.

### NOT-CONNECTED — Requires live infrastructure

| What | Infrastructure needed | Env var / source |
|---|---|---|
| Live `lb:canary:render` ingestion and dashboards | Cloudflare Analytics Engine or Cloudflare Logpush | `OTEL_EXPORTER_OTLP_ENDPOINT` or `wrangler tail --format=json` |
| Fallback rate (% of Liquid plans that fell back to React) | Log aggregation on `lb:canary:render` where `fallback_reason != null` | Same as above |
| Render latency by engine (`latency_ms` aggregation) | Same | Same |
| Live count of stores with `renderer_engine = 'liquid'` | Production Supabase service-role credentials | `SELECT COUNT(*) FROM theme_releases tr JOIN sites s ON s.current_theme_release_id = tr.id WHERE tr.release_manifest->>'renderer_engine' = 'liquid'` |
| Production CPU time / memory per Liquid render | Cloudflare Workers Analytics Engine | Cloudflare Workers deployment with Analytics Engine wired |
| DOMPurify JSDOM heap growth under sustained load | Long-running load test + heap snapshot | `node --heap-prof` on storefront-runtime or `process.memoryUsage()` in test harness |

---

## QA Coverage Posture

The following table is drawn from `docs/storefront-liquid-discovery/phase-i/QA_CERTIFICATION.md` (2026-07-10).

| Category | Status | Command / Notes |
|---|---|---|
| Unit | **CONNECTED** | `pnpm typecheck test --filter=@letbuyy/theme-engine` (221/221) + `--filter=@letbuyy/storefront-runtime` (78/78) + `--filter=@letbuyy/merchant-control-plane` (15/15) |
| Integration — in-repo contracts | **CONNECTED (partial)** | 8 contract test files in `tests/theme-engine/` (storefront-runtime 78/78). Stubs gateway responses; no live service required. |
| Integration — live gateway | **NOT-CONNECTED** | Requires deployed api-gateway + seeded Supabase test DB + `NEXT_PUBLIC_GATEWAY_URL`. No `pnpm test:integration` script exists. |
| Accessibility — HTML assertions | **CONNECTED** | `qi-a11y.test.ts` 8 tests in 221/221 (real `LiquidRenderer` + `sanitizeRenderedHtml()` output, no snapshots) |
| Accessibility — axe-core live scan | **NOT-CONNECTED** | Requires Playwright + `@axe-core/playwright` + live Liquid-rendered URL. |
| Performance — render budget | **CONNECTED (local only)** | `liquid-render-benchmark.test.ts` (N=25, budget 30 s, measured 288 ms). Production fleet numbers NOT-CONNECTED. |
| Performance — production fleet | **NOT-CONNECTED** | Cloudflare Analytics Engine required. |
| Security | **CONNECTED** | `qi-security.test.ts` 13 tests (SSTI, XSS, prototype-pollution, FORBID_TAGS/ATTR, drop depth/key limits) in 221/221. |
| Hydration | **CONNECTED** | `liquid-hydration-islands-parity.test.mjs` 13 tests (78/78). All 10 lb-* custom elements, SSR attribute contracts, DOMPurify tag/attr allowlist completeness. |
| SSR | **CONNECTED** | `storefront-liquid-runtime.test.mjs` 140 assertions + `lb-storefront-ssr-contracts.test.mjs` 13 tests (78/78). |
| Regression | **CONNECTED** | Full gate: all four pnpm test commands. Progression documented above. |
| SEO | **NOT-CONNECTED** | No Lighthouse/axe-core scripts exist. Current Liquid layout emits `{{ shop.name }}` in `<title>` with no `<meta name="description">` or Open Graph tags. |
| Load | **NOT-CONNECTED** | No k6/Artillery scripts exist. Phase F benchmark is local only. PROPOSED p95 TTFB target: ≤ 500 ms at 50 VUs (must be validated against staging before ARB). |
| Stress | **NOT-CONNECTED** | No scripts exist. Cross-request LRU (engine pooling) not implemented; Liquid render cost scales linearly above concurrency limits. |
| Memory | **NOT-CONNECTED** | `domPurifyPromise` singleton has no `.catch()` rejection handler (risk open: silent uninitialised sanitizer on JSDOM init failure). No heap profiling scripts. |
| Browser (E2E) | **NOT-CONNECTED** | Playwright not installed in storefront-runtime. No `playwright test` suite exists. |
| Mobile | **NOT-CONNECTED** | Same as Browser; no mobile viewport tests exist. |
| Visual diff | **NOT-CONNECTED** | No Storybook, Percy, or Chromatic wiring exists. |

---

## Known Limitations and Open Items

The following items carry into Phase J and the ARB decision package. They are not regressions from Phase I.

### I-F1 — DOMPurify Clobbering on Customer Register Form (CLOSED — commit dbcf173a)

**Where:** `packages/theme-engine/src/theme-bundle.ts:2433` (customer-register Liquid section).

**Observable (historical):** No-JS customer registration submitted without a name field because DOMPurify's clobbering guard stripped `name="name"` from the input. Account was created with a null/empty name. JavaScript-enabled registration was unaffected.

**Resolution:** Field renamed from `name="name"` to `name="fullName"` in `theme-bundle.ts:2433` (commit dbcf173a). Register route reads `form.get('fullName') ?? form.get('name')`. A11Y-5 asserts `name="fullName"` survives DOMPurify and `name="name"` is absent (221/221 PASS). **This is not a GO gate.** No further action required.

### H-F2 — Path Traversal Risk in Theme Artifact Exporter (CLOSED)

**Where:** `packages/theme-engine/src/theme-artifact-exporter.ts`.

**Resolution:** `assertSafeArtifactPath()` (lines 58–68) is called at all path composition points: `bundle.layout.theme.path` (line 75), section paths (line 82), block paths (line 90), template keys (line 116), locale keys (line 124). It throws `UnsafeThemeArtifactPathError` on absolute paths or paths containing a `..` segment. Previously listed as OPEN MEDIUM in Phase H/I; code on `stepup/main` confirms the fix is present.

### H-F3 — Settings Data Exported Without BLOCKED_DROP_KEYS Filter (LOW, OPEN)

**Where:** `packages/theme-engine/src/theme-artifact-exporter.ts`.

**Finding:** `config/settings_data.json` is exported verbatim from `bundle.config.settings_data`. If `settings_data` contains any key-value pairs that would normally be filtered by `BLOCKED_DROP_KEYS` (credential-adjacent fields), those values appear in the exported file.

**Required fix:** Apply the `BLOCKED_DROP_KEYS` filter to `settings_data` before serialization in the exporter.

### FEATURE_LIQUID Gateway Flag — Wiring Decision Required (Operator, OPEN)

**Where:** `services/api-gateway/src/middleware/featureFlags.ts:4`, `src/index.ts:227`.

**Finding:** The `FEATURE_LIQUID` flag is declared and set in `wrangler.toml` but `featureGate('FEATURE_LIQUID', ...)` is never called. It has zero runtime effect. The ARB should decide whether to wire this as a kill switch for Liquid theme-publish routes before the platform flip, as it would provide a gateway-level emergency brake for new Liquid bundle publication without affecting already-published releases.

### Pre-Existing Governance Validator Fail (Non-Blocker, Human-Owned)

`node scripts/validate-governance.mjs` fails on the tenant-table registry check. This failure pre-dates Phase B, is unrelated to the Liquid program, and is owned by a human outside this scope. `theme-governance-validator.mjs` and `migration-safety-validator.mjs` both PASS. The sequential-migration validator fails on migrations 186/187 (WIP pre-dating Phase B, not committed). Neither failure is introduced by Phases B–I.

### No Gradual Rollout (Percentage-of-Stores) Mechanism

The current architecture provides two states: per-store Liquid ON (via `release_manifest.renderer_engine`) or platform-wide OFF (global constant). There is no mechanism to activate Liquid for `N%` of stores automatically. All staged rollout must be done by selectively publishing Liquid-engine releases to individual stores through the normal merchant theme-publish flow.

### ISR Revalidation Window

Rollback changes (removing `renderer_engine: 'liquid'` from `theme_releases.release_manifest`) take effect within 60 seconds, bounded by `export const revalidate = 60` at `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx`. There is no mechanism to force immediate cache invalidation without a deploy.

---

## Governance Validators — Final Status

| Validator | Command | Result |
|---|---|---|
| Theme governance | `node scripts/validators/theme-governance-validator.mjs` | **PASS** |
| Migration safety | `node scripts/validators/migration-safety-validator.mjs` | **PASS** |
| Full governance | `node scripts/validate-governance.mjs` | **FAIL (pre-existing)** — tenant-table registry; unrelated to this program; human-owned |
| Sequential migrations | `node scripts/validators/sequential-migration-validator.mjs` | **FAIL (pre-existing)** — migrations 186/187 WIP pre-dating Phase B |
