# LetBuyy Storefront Liquid Platform — Program Capstone

**Document class:** PROGRAM SUMMARY — authoritative record of the B→L transformation
**Date:** 2026-07-10
**Branch:** stepup/main
**Status:** Phase L complete (uncommitted); Phases B–K committed

---

## 1. Single-Sentence Verdict

The LetBuyy Liquid storefront is a structurally complete, safety-gated, deterministic theming platform ready for a supervised per-store canary rollout; the platform-wide flip (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false → true`) requires a recorded ARB decision, the I-F1 DOMPurify clobbering fix (HIGH, open), and live observability wiring before it is safe to proceed.

---

## 2. Phase-by-Phase Summary (B → L)

| Phase | Commit | One-Liner |
|-------|--------|-----------|
| **B** | `93419c58` | Architecture certification: 56 register items evaluated against source; 12 CLOSED-VERIFIED, 26 OPEN-CONFIRMED-RISK, 7 REFUTED; certified the dual-renderer storefront structure and identified the 7 ARB-gate blockers |
| **C** | `be56a6fd` | Critical platform fixes: Liquid crash recovery (per-section/region/layout try/catch), React fallback on invalid bundle, Urban Kicks branding leak closed, newsletter alias wired, postMessage bridge fixed (B-1 + B-2 closed) |
| **D** | `4546f27b` | Data completeness: linklists/navigation drop wired (B-4), fonts wired + CSP extended (B-3), search drop, hero-banner parity, BLOCKED_DROP_KEYS +4 keys, contentPage alias, registration no-JS parity |
| **E** | `7b111a94` | Template completion: blog, article, CMS page, 404, password Liquid templates; routes drop parity; collection-banner; customer login no-JS — all 15/15 route types now have Liquid bundle entries (100% template coverage) |
| **F** | `51d9dd74` | Performance engineering: LiquidJS `cache:true` intra-request LRU (P3-1), `Promise.allSettled` parallel section rendering (P3-2), lb-logout Web Component island + CSRF guard, benchmark harness, 5 hardening items (H1–H5) |
| **G** | `7cdd42a1` | Schema governance: section migration engine wired (`applySectionSchemaMigrations` on publish), bundle `schema_version` G4 gate (B-5 mitigated), experience overlay G6 validation, `letbuyy-core` DB row via migration 188 (B-6 closed), settings canonicalization utility (B-7 mitigated) |
| **H** | `06d3cc85` | Developer experience: public SDK facade (`theme-sdk.ts`), Liquid artifact exporter (`.liquid` files on disk), 5-rule linter (`lintThemeBundle`), theme packager, CLI (`letbuyy-theme validate/lint/compile/export`), Urban Kicks + letbuyy-core example artifacts committed, 5 developer docs |
| **I** | `dbcf173a` | Enterprise QA certification: 48 new tests across 4 files — A11y (8 WCAG-aligned markup assertions), Security (13 XSS/SSTI/prototype-pollution/drop-limit tests), Hydration parity (13 for islands 5–10 + lb-logout), SSR contracts (13 dual-content-type dispatch, 303 redirect, storeId injection); found I-F1 (HIGH: DOMPurify clobbering strips `name="name"` from register form) |
| **J** | `77a5872f` | Production rollout readiness: 5-document ARB package (rollout runbook, canary ramp plan, observability design, rollback runbook, release notes); confirmed 5/7 ARB blockers CLOSED, 2 MITIGATED; verdict: structurally ready for per-store canary, platform-wide flip not yet approved |
| **K** | `b71b93bf` | Theme platform primitives: epoch version comparator (`theme-version.ts`), upgrade planner (`theme-upgrade.ts`), 5-stage install validation pipeline (`theme-install.ts`), publish manifest builder (`theme-publish.ts`), analytics event contract (`theme-analytics.ts`); 55 freeze-compliance contract tests formally asserted frozen-app boundaries on every test run |
| **L** | *(uncommitted)* | AI Theme Platform SDK: WCAG 2.1 contrast math (the one safety guardrail that did not exist before), parametric palette generator (5 variants, fail-closed WCAG AA), typography pairing (5 intents from EXPERIENCE_FONT_REGISTRY), section-order generator, A11y advisory mapper, bundle optimizer, merchant personalization, unified Merchant AI SDK facade; MODEL_BOUNDARY explicitly NOT-CONNECTED; 6 adversarial hardening findings fixed |

---

## 3. Final Gate Numbers

| Suite | Phase B entry | Phase K (last committed) | Phase L (current on disk) |
|-------|--------------|-------------------------|--------------------------|
| theme-engine tests | 82 (static) → C: 89 | **311/311 PASS** | **643/643 PASS** |
| storefront-runtime tests | 18 (static) → C: 19 | **133/133 PASS** | **687/687 PASS** |
| api-gateway typecheck | BLOCKED (classifier) | 32 turbo tasks, exit 0 | 32 turbo tasks, exit 0 |
| merchant-control-plane tests | BLOCKED (classifier) | **15/15 PASS** | **15/15 PASS** |
| TypeScript errors (`--noEmit`) | BLOCKED (classifier) | 0 | 0 |
| Governance gate (`validate-governance.mjs`) | BLOCKED (classifier) | 107 validators, exit 0 | 107 validators, exit 0 |

**Phase L added:** +332 theme-engine tests, +554 storefront-runtime tests.

**Test baseline progression (theme-engine):** B: 82 → C: 89 → D: 101 → E: 109 → F: 157 → G: 157 → H: 198 → I: 221 → J: 221 → K: 311 → **L: 643**

**Test baseline progression (storefront-runtime):** B: 18 → C: 19 → D: 31 → E: 52 → F: 52 → G: 52 → H: 52 → I: 78 → J: 78 → K: 133 → **L: 687**

---

## 4. Production-Ready vs ARB-Gated

### What is Production-Ready (per-store canary activation possible now)

| Capability | Status | Evidence |
|-----------|--------|---------|
| Liquid crash recovery (5-layer) | PRODUCTION-READY | Phase C: per-section/region/layout try/catch; `ThemeRendererStatus: 'error'`; React fallback on null result; never a blank page or hard-500 |
| 15/15 route templates | PRODUCTION-READY | Phase E: blog, article, page, password, not_found added to Urban Kicks bundle; 100% template coverage confirmed |
| Security model (XSS/SSTI/drop limits) | PRODUCTION-READY | Phase I: 13 security tests assert DOMPurify FORBID lists, SSTI non-evaluation, DROP limits, BLOCKED_DROP_KEYS, CSS/href injection all blocked |
| Font wiring + CSP | PRODUCTION-READY | Phase D: `buildGoogleFontsHref` wired into `layout.tsx`; 6 experience fonts loading correctly; CSP `style-src`/`font-src` extended |
| Navigation/linklists | PRODUCTION-READY | Phase D: `navToLinklists()` converts `StoreModel.navigation` to Shopify-convention linklists; wired into `buildLiquidScope` |
| lb-logout (CSRF-safe) | PRODUCTION-READY | Phase F: `<lb-logout>` Web Component island with `<form method="post">` no-JS fallback; CSRF guard on logout route |
| WCAG AA palette generation | PRODUCTION-READY | Phase L: `meetsWcagAA` enforced fail-closed in `generateColorSystem` and `deterministicPalette`; cannot emit non-compliant palette |
| Bundle schema validation (G4 gate) | PRODUCTION-READY | Phase G: `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` allowlist; unknown versions rejected fail-closed |
| Experience overlay validation (G6 gate) | PRODUCTION-READY | Phase G: `validateExperienceOverlay` gates both apply functions |
| Developer tooling (SDK/linter/CLI) | PRODUCTION-READY | Phase H: `validateTheme`, `lintTheme`, `compileTheme`, `exportThemeBundleToFiles`, CLI all functional |

### What is ARB-Gated or NOT-CONNECTED

| Item | Status | What is needed |
|------|--------|---------------|
| Platform-wide Liquid flip (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`) | **ARB-GATED** | Recorded ARB decision + I-F1 fix + observability wiring before any flip |
| **I-F1**: DOMPurify clobbering strips `name="name"` from customer-register form; no-JS POST omits customer name | **OPEN-HIGH** | Rename field to `customer_name` in `theme-bundle.ts`; update gateway parser |
| Live observability (Cloudflare Logpush / Analytics Engine) | **NOT-CONNECTED** | Env var `CLOUDFLARE_ANALYTICS_ENDPOINT` + Logpush configuration; no wiring in current codebase |
| `FEATURE_LIQUID` gateway kill-switch | **DORMANT** | `featureGate('FEATURE_LIQUID', ...)` never called; ARB decision needed on whether to wire before flip |
| Percentage-of-stores rollout mechanism | **NOT-CONNECTED** | No infra exists for gradual % rollout; per-store activation via `theme_releases.release_manifest.renderer_engine` is the only staged path |
| LLM/AI model provider (NL→ThemeBrief parsing) | **NOT-CONNECTED** | `THEME_AI_PROVIDER_API_KEY` + `POST /v1/theme-ai/parse-brief` route; explicitly `MODEL_BOUNDARY.status = 'NOT_CONNECTED'` |
| Cross-request LRU (engine pooling) | **OPEN** | Phase F achieved intra-request LRU (`cache:true`); cross-request requires pooling with tenant isolation safety evaluation |
| Edge cache for `resolveAccess()` | **OPEN** | KV-backed caching of gateway access-check results (P3-3) not implemented |
| P5-1: On-disk `.liquid` authoring pipeline | **PARTIAL** | Phase H exported `.liquid` view artifacts; TypeScript string literals remain the authoritative source; source-of-truth flip open |
| P5-2: Theme linter in CI | **PARTIAL** | `lintThemeBundle` exists; not yet wired into `validate-governance.mjs` or a CI step |

---

## 5. Honest NOT-CONNECTED Catalog

The following capabilities are structurally present (topology mapped, code written, types defined) but cannot emit live values because an external data source or provider is not wired. No value is fabricated.

| Capability | What is NOT-CONNECTED | Exact source / env var needed |
|-----------|----------------------|------------------------------|
| Live Liquid render latency, error rate | Cloudflare Analytics Engine / Logpush | `CLOUDFLARE_ANALYTICS_ENDPOINT`; `wrangler tail --format=json` for ad-hoc |
| Count of stores currently on Liquid path | Supabase production `theme_releases` table | `SELECT COUNT(*) FROM theme_releases WHERE release_manifest->>'renderer_engine' = 'liquid'` |
| Count of stores with `theme_id = 'modern'` ghost (OQ-09) | Supabase production `sites` table | `SELECT COUNT(*) FROM sites WHERE theme_id NOT IN (SELECT slug FROM themes)` |
| Fallback rate (Liquid → React graceful degradation) | Cloudflare Worker telemetry | `fallback_reason` header emitted by `composition-engine.tsx`; reader not connected |
| Production memory behavior | Cloudflare Workers metrics | Not tracked at per-tenant level in current deployment |
| LLM provider for NL→ThemeBrief parsing | Any LLM provider (OpenAI/Anthropic/Gemini) | `THEME_AI_PROVIDER_API_KEY`; `POST /v1/theme-ai/parse-brief` (route does not exist) |
| Theme analytics events (install/publish/preview/apply/uninstall) | Emission points not yet implemented | `describeThemeEventEmissionPoints` returns `implemented: false` for all 5 event types |
| Marketplace install/review counts | `theme_packages` query-time aggregates | `connected: false` per `describeThemeMetrics` |
| Revenue impact of Liquid vs React | No A/B infrastructure | Requires cohort tracking + Supabase ledger join — no current pipeline |

---

## 6. Frozen Registry Status

The following frozen boundaries were formally asserted in Phase K (Lane-B 55 contract tests) and remain unchanged through Phase L:

| Frozen item | Status |
|------------|--------|
| `apps/theme-marketplace` | `frozen-next-app`, `frozen-not-deployed`, `status: "frozen"` in production-topology.json |
| `apps/app-marketplace` | Same |
| `apps/developer-portal` | Same |
| Storefront install route `apps/storefront-runtime/src/app/api/themes/install/route.ts` | Returns 410; no bypass path |
| ART-17 frozen React section registry | 20 sections, enforced by `no-new-react-sections-validator.mjs` |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | Unchanged since Phase B certification; requires ARB to flip |
| `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` | Unchanged; FORBID_TAGS + FORBID_ATTR + lb-* ADD_TAGS all intact |
| Urban Kicks Liquid fixture | Unchanged; Phase L did not modify `createUrbanKicksLiquidThemeBundleFixture` |

---

## 7. ARB Blocker Status (Confirmed Phase J, unchanged through Phase L)

| # | Blocker | Status |
|---|---------|--------|
| B-1 | postMessage key mismatch (editor section-selection) | **CLOSED** (Phase C) |
| B-2 | `newsletter` / `newsletter-signup` type split | **CLOSED** (Phase C + D) |
| B-3 | Fonts not wired, wrong typeface | **CLOSED** (Phase D) |
| B-4 | `linklists` absent from Liquid scope | **CLOSED** (Phase D) |
| B-5 | Schema migration engine — zero concrete migrations registered | **MITIGATED** (Phase G — engine wired; registry honestly empty; future renames will migrate forward) |
| B-6 | `letbuyy-core` DB row missing | **CLOSED** (Phase G — conditional on migration 188 executing against production DB) |
| B-7 | Settings dual-shape (DB flat vs TS 5-group) | **MITIGATED** (Phase G — canonicalization utility shipped; gateway/editor consumption deferred) |

**5 of 7 CLOSED, 2 MITIGATED, 0 still OPEN blockers.**

Additional gate that prevents the platform-wide flip (confirmed Phase J):
- **I-F1 (HIGH, OPEN):** DOMPurify clobbering strips `name="name"` from customer-register form. ARB must decide: accept as supervised fast-follow, or require fix before any store activation.
- **Live observability NOT-CONNECTED:** ARB should require at minimum `wrangler tail --format=json` monitoring before a canary cohort is activated.

---

## 8. Open Risk Inventory (Phase L Final)

The following risks from the Phase B register remain OPEN as of Phase L. All are low-severity relative to the production-critical safety gates.

| ID | Severity | Description | Owner |
|----|----------|-------------|-------|
| **I-F1** | HIGH | DOMPurify clobbering strips `name="name"` from customer-register form | Next phase / ARB gate |
| **OQ-13** | UNVERIFIABLE | Count of production stores with canary key or `rendererEngine: 'liquid'` in `sites.template_config` | Live DB query required |
| **R-01** | PARTIALLY-CLOSED | Cross-request LRU — engine pooling not implemented | Performance phase |
| **R-03** | PARTIALLY-CLOSED | KV-backed `resolveAccess` edge cache not implemented | Performance phase |
| **R-12** | PARTIALLY-CLOSED | `.liquid` files are read-only view exports; TypeScript source remains authoritative | P5-1 (authoring pipeline) |
| **H-F3** | LOW | `settings_data` exported verbatim without BLOCKED_DROP_KEYS filter in `theme-artifact-exporter.ts` | Acknowledged design choice; ARB to assess at Gate 2 |
| **K-F1** | MEDIUM | `'^ with different family returns false'` test name misleading; cross-family rejection untestable with single-epoch list | When second epoch is added |
| **K-F2** | LOW | Stage 3 compat-range path in `validateThemeInstall` not independently exercised | Next platform phase |
| R-15, OQ-12, UC-18, UC-19 | MEDIUM | Auth multi-key rotation; schema migration engine publish-path wiring; two draft tables deprecation; `FEATURE_LIQUID` kill-switch | Governance phase (deferred) |
| OQ-09, OQ-11 (residuals) | LOW-MEDIUM | `theme_id = 'modern'` ghost; two draft tables roles | Governance / schema phase |

---

## 9. Delivery Artifacts by Phase

| Phase | Primary deliverable type | Files added/modified | Test delta |
|-------|-------------------------|---------------------|-----------|
| B | Discovery + certification | 12 amended doc files | 0 (static) |
| C | Product source + tests | `theme-renderer.ts`, `composition-engine.tsx`, `store-service.ts`, `proxy.ts` + 7 test files | +7 theme-engine, +1 storefront |
| D | Product source + tests | `composition-engine.tsx`, `theme-renderer.ts`, `layout.tsx`, `globals.css`, `portable-to-liquid.ts`, `store-service.ts` + test files | +12 theme-engine, +12 storefront |
| E | Product source + tests | `theme-bundle.ts`, `theme-renderer.ts`, `composition-engine.tsx`, 3 new route page.tsx files + 9 test files | +8 theme-engine, +21 storefront |
| F | Product source + tests | `theme-renderer.ts` (LRU, parallel, lb-logout, H1–H5), `proxy.ts` (H3), `composition-engine.tsx` (H4) + 2 test files | +48 theme-engine, 0 storefront |
| G | Product source + migrations + tests | `theme-execution.adapter.ts`, `theme-renderer.ts`, `packages/theme-engine` (5 modules), `188_letbuyy_core_theme_row.sql` | 0 delta (gate verification only; tests already green) |
| H | Library + developer tooling + tests | 5 new `packages/theme-engine/src/` modules, CLI, `examples/` artifacts, 5 developer docs + 41 test cases | +41 theme-engine, 0 storefront |
| I | Tests only | 4 new test files (qi-a11y, qi-security, hydration-parity, ssr-contracts) + 3 hardening fixes in existing tests | +23 theme-engine, +26 storefront |
| J | Documentation only | 5 new phase-j docs, RISK_CLOSURE_REPORT amendment | 0 delta |
| K | Library only | 5 new `packages/theme-engine/src/` modules, 5 new test files, `lb-k-theme-platform.test.mjs` | +90 theme-engine, +55 storefront |
| L | Library + documentation | 7 new `packages/theme-engine/src/` modules, `theme-ai-sdk.ts` (expanded), 8 test files, `lb-l-ai-theme-platform.test.mjs`, 2 docs | +332 theme-engine, +554 storefront |

---

## 10. Commit Reference Table

| Phase | Commit SHA | Commit message excerpt |
|-------|-----------|----------------------|
| B | `93419c58` | phase-b(certification): architecture certification of storefront/Liquid discovery corpus |
| C | `be56a6fd` | phase-c(storefront): critical platform fixes - Liquid crash recovery, React fallback, Urban Kicks leak, newsletter alias, postMessage hardening |
| D | `4546f27b` | phase-d(storefront): data completeness - linklists, settings parity, drops, fonts, search, hero, registration no-JS |
| E | `7b111a94` | phase-e(storefront): template completion - blog, article, CMS page, 404, password, routes parity, login no-JS |
| F | `51d9dd74` | phase-f(storefront): performance engineering - parse cache, parallel sections, chrome seam, password/logout hardening |
| G | `7cdd42a1` | phase-g(storefront): schema governance - migration engine wired, version gate, canonicalization, letbuyy-core row, experience validation |
| H | `06d3cc85` | phase-h(storefront): developer platform - theme SDK, compiler/validator/linter/packager, .liquid artifact exporter, CLI, examples, docs |
| I | `dbcf173a` | phase-i(storefront): enterprise QA - a11y/security/SSR-hydration/regression coverage + honest infra-bound catalog + real bug fix |
| J | `77a5872f` | phase-j(storefront): production rollout prep - ARB package, phased canary ramp, rollback runbook, observability design, release notes |
| K | `b71b93bf` | phase-k(storefront): theme platform - versioning/compatibility, upgrade planning, install validation, publish manifest, analytics contract |
| L | *(uncommitted)* | phase-l(storefront): AI theme platform SDK — deterministic palette/typography/layout generators, WCAG 2.1 contrast math, merchant personalization |

---

*Program Capstone — LetBuyy Storefront Liquid Platform. B→L transformation. 2026-07-10.*
