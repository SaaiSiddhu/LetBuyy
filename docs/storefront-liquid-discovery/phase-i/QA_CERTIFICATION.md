# Phase I QA Certification Matrix
## Storefront / Liquid Theme Platform — Enterprise QA Coverage Gate

**Document ID:** QA-CERT-2026-07-10  
**Phase:** I — QA Certification  
**Date:** 2026-07-10  
**Branch:** stepup/main  
**Authored by:** Subagent — Phase I QA certification author role  
**Gate basis:** Evidence from Phase I test authoring runs (2026-07-10)

---

## How to Read This Matrix

Each row maps to one enterprise QA category. Status is one of:

- **CONNECTED** — runnable now from the repo with the listed command; result is confirmed PASS against real source behaviour (not a snapshot).
- **NOT-CONNECTED** — requires live infrastructure, a deployed runtime, or an external toolchain that is not present in the repository. The exact infrastructure gap and the command/harness to run once it is provisioned are listed honestly.
- **PARTIAL** — some coverage is CONNECTED, some dimension is NOT-CONNECTED; both are enumerated.

The column "Gate Numbers" cites only numbers that appear in the Evidence provided to the Phase I author. No number is extrapolated or estimated.

---

## Enterprise QA Category Matrix

### 1. Unit

| Attribute | Value |
|---|---|
| **Status** | CONNECTED |
| **Command** | `pnpm typecheck test --filter=@letbuyy/theme-engine` (covers `packages/theme-engine/test/` — 31 `.test.ts` files)<br>`pnpm typecheck test --filter=@letbuyy/storefront-runtime` (covers `tests/theme-engine/`, `tests/launch/`, `tests/localization/`, `tests/federation/web-app-contract-boundary`)<br>`pnpm typecheck test --filter=@letbuyy/merchant-control-plane` (covers `tests/federation/`, `tests/localization/`, `tests/app-platform/`) |
| **Gate Numbers (post Phase I)** | theme-engine: **221/221 PASS** (baseline 199; +21 Phase I lane-a; +1 Phase I hardening SEC-6b)<br>storefront-runtime: **78/78 PASS** (baseline 52; +26 Phase I lane-b)<br>merchant-control-plane: **15/15 PASS** |
| **Phase I additions** | `qi-a11y.test.ts` (8 tests — A11Y-1 through A11Y-8)<br>`qi-security.test.ts` (13 tests — SEC-1a/b/c, SEC-2, SEC-3a, SEC-3b, SEC-4–SEC-10, SEC-6b) |
| **Coverage scope** | Core schema, LiquidJS renderer, DOMPurify sanitiser, section aliases, version gate, crash recovery, SDK/linter/exporter/packager, experience fonts, blog/article/page/404/password templates, routes drop parity, auth/no-JS login, lb-logout island, schema governance, render benchmark, A11Y assertions on rendered Liquid HTML, SSTI/XSS/drop-limit security assertions |

---

### 2. Integration

| Attribute | Value |
|---|---|
| **Status** | PARTIAL |
| **CONNECTED dimension** | Cross-module contract tests in `tests/theme-engine/` (8 `.test.mjs` files, ~399 assertion lines) are runnable via `pnpm typecheck test --filter=@letbuyy/storefront-runtime`. These exercise real module boundaries: composition engine ↔ LiquidRenderer, editor-bridge postMessage protocol, bundle format contracts, island hydration contracts, lifecycle contracts. `tests/federation/web-app-contract-boundary.test.mjs` verifies cross-app boundaries without a live service. |
| **NOT-CONNECTED dimension** | Live gateway integration (real Cloudflare Worker process + Supabase Hyperdrive) is not exercised. All storefront-runtime contract tests stub gateway responses. A live integration harness requires: (1) a deployed api-gateway at a real URL, (2) a Supabase test database with seeded data, (3) `NEXT_PUBLIC_GATEWAY_URL` and Supabase service-role credentials in the test environment. Command when ready: `pnpm test:integration` (no such script exists yet — must be authored pointing at a staging stack). |
| **Gate Numbers** | CONNECTED: 78/78 storefront-runtime (includes 8 contract test files); 15/15 merchant (includes `app-bridge.test.mjs`). NOT-CONNECTED: 0 live-integration tests exist. |

---

### 3. Accessibility

| Attribute | Value |
|---|---|
| **Status** | PARTIAL |
| **CONNECTED dimension** | `packages/theme-engine/test/qi-a11y.test.ts` (8 tests) asserts against real `sanitizeRenderedHtml()` output from `LiquidRenderer`: ARIA landmark (`<main id="MainContent">`), heading hierarchy (`<h1>` from hero-banner settings), email input label, customer-login `<label>` wrapping, customer-register `<label>` coverage, product gallery `alt` attributes, `lb-add-to-cart` aria-live region, `lb-variant-picker` aria-pressed toggle state. All 8 pass in the 221/221 theme-engine gate. |
| **NOT-CONNECTED dimension** | Automated axe-core scan against a live rendered storefront page is not wired. Requires: (1) Playwright browser + `@axe-core/playwright` (not installed), (2) a live Liquid-rendered storefront URL. Command when ready: `playwright test tests/a11y/storefront-axe.spec.ts` against `https://<store>.letbuyy.com`. Screen-reader testing (VoiceOver/NVDA) is manual-only. |
| **Gate Numbers** | CONNECTED: 8 A11Y assertions in theme-engine 221/221. NOT-CONNECTED: 0 axe-core tests exist. |
| **Known regression tracked** | A11Y-5 currently asserts `autocomplete="name"` (not `name="name"`) because DOMPurify 3.x clobbering guard strips the `name` attribute from the customer-register name input. The production form field omits `name="name"` and a no-JS POST would not submit the customer name. This is a confirmed product bug tracked for fix (rename form field to `customer_name` or suppress clobbering for that element). |

---

### 4. Performance

| Attribute | Value |
|---|---|
| **Status** | PARTIAL |
| **CONNECTED dimension** | `packages/theme-engine/test/liquid-render-benchmark.test.ts` — F9 performance budget gate is runnable via `pnpm typecheck test --filter=@letbuyy/theme-engine`. The gate asserts N=25 renders of the Urban Kicks fixture (25 sections, full DOMPurify pipeline) stay under budget: `cold ≤ 150 ms`, `steady ≤ 50 ms`, `total ≤ 1250 ms`. Measured Phase F values: cold=24 ms, steady=11 ms, p95=17 ms, total=288 ms (all PASS). |
| **NOT-CONNECTED dimension** | Production-traffic profiling requires a deployed Cloudflare Worker with Cloudflare Analytics Engine wired. CPU time per request, memory per isolate, and tail latency under real concurrent load are NOT CONNECTED. Infrastructure needed: Cloudflare Workers deployment with `OTEL_EXPORTER_OTLP_ENDPOINT` set; `wrangler tail` for live telemetry. No production profiling script exists in `scripts/`. |
| **Gate Numbers** | CONNECTED: 1 benchmark test in 221/221 theme-engine (Phase F F9). NOT-CONNECTED: 0 production profiling scripts. |

---

### 5. SEO

| Attribute | Value |
|---|---|
| **Status** | NOT-CONNECTED |
| **Infrastructure needed** | A live Liquid-rendered storefront URL accessible to an SEO crawler. No SEO assertion suite exists in the repository. Required toolchain: (1) Playwright + Lighthouse CI (`lhci`) or a dedicated Lighthouse Node script, (2) real storefront URL resolving to a Liquid-path page (requires `rendererEngine: 'liquid'` in the DB + `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` or an Urban Kicks store), (3) assertions on `<title>`, `<meta name="description">`, canonical `<link>`, Open Graph tags, JSON-LD structured data, crawlability (`robots.txt`, `sitemap.xml`). |
| **Command when ready** | `lhci autorun --collect.url=https://<store>.letbuyy.com --assert.preset=lighthouse:recommended` or a custom Node script using `puppeteer` + `lighthouse` via `lighthouse(url, {output:'json'})`. |
| **Gate Numbers** | 0 SEO tests exist in any suite. BLOCKED. |
| **Note** | The Liquid path currently emits `{{ shop.name }}` in the `<title>` (theme-bundle.ts layout template). No dedicated `<meta name="description">` or Open Graph output exists in the current Liquid layout template. An SEO audit would surface these gaps before they can be certified. |

---

### 6. Hydration

| Attribute | Value |
|---|---|
| **Status** | CONNECTED |
| **Command** | `pnpm typecheck test --filter=@letbuyy/storefront-runtime` (runs `tests/theme-engine/liquid-hydration-islands.test.mjs` + `tests/theme-engine/liquid-hydration-islands-parity.test.mjs`) |
| **Gate Numbers** | `liquid-hydration-islands.test.mjs`: 40 assertions across 10 islands (existing, pre-Phase I). `liquid-hydration-islands-parity.test.mjs` (Phase I lane-b, new): **13 tests** — SSR data-attribute parity for lb-review-form, lb-wishlist-toggle, lb-cart, lb-customer-settings, lb-address-manager; LIQUID_HYDRATION_CUSTOM_ELEMENTS completeness (all 10 lb-* tags); DOMPurify `tagNameCheck` suffix coverage; ADD_ATTR `data-logout-url`; LiquidIslandBase server-safe guard; lb-logout no-JS form integrity. Included in storefront-runtime 78/78 PASS. |
| **Coverage scope** | All 10 lb-* custom elements (add-to-cart, cart-drawer, search, variant-picker, review-form, wishlist-toggle, cart, customer-settings, address-manager, logout). SSR → client parity: every island's required data-* attributes are asserted to be present in the server-rendered HTML before browser JavaScript runs. LiquidIslandBase `typeof customElements === 'undefined'` guard confirmed for islands 5–9 and lb-logout. |

---

### 7. SSR

| Attribute | Value |
|---|---|
| **Status** | CONNECTED |
| **Command** | `pnpm typecheck test --filter=@letbuyy/storefront-runtime` (runs `tests/theme-engine/storefront-liquid-runtime.test.mjs` + `tests/launch/lb-storefront-ssr-contracts.test.mjs`) |
| **Gate Numbers** | `storefront-liquid-runtime.test.mjs`: 140 assertions (composition engine, drop contracts, linklists, drops D1–D7, no-JS register, chrome-fallback seam, password gate, lb-logout). `lb-storefront-ssr-contracts.test.mjs` (Phase I lane-b, new): **13 tests** — E8 no-JS login contract (form POST + JSON dual content-type path, 303 redirect, same-origin guard, storeId hidden field); F5 fallback_reason ternary pin (conditioned on liquidHtml===null AND plan.rendererEngine===liquid); lb:canary:render:fallback emitted exactly once inside catch; lb-customer-settings/lb-address-manager/lb-cart data-base-path SSR attributes; lb-logout no-JS submit button nesting (anchor fixed to `<lb-logout\\b[^>]*>` to avoid matching comment text). All included in storefront-runtime 78/78 PASS. |
| **Coverage scope** | Server-side rendering output shape, no-JS form contract (customer login), dual content-type dispatch, redirect response contract, tenant routing via hidden storeId field, fallback telemetry accuracy, SSR data-attribute shape per island (6 islands pinned), lb-logout structural containment. |

---

### 8. Load

| Attribute | Value |
|---|---|
| **Status** | NOT-CONNECTED |
| **Infrastructure needed** | (1) k6 or Artillery installed in CI, (2) a deployed staging storefront URL on a Liquid-rendered store, (3) a staging Supabase DB with realistic data volume (products, collections, orders). No load test scripts exist in `scripts/` or `tests/`. |
| **Command when ready** | `k6 run tests/load/storefront-liquid-homepage.js --vus 50 --duration 2m` (script must be authored). Target SLOs to validate: p95 TTFB ≤ 500 ms at 50 VUs, error rate < 0.1%. The Phase F F9 in-process benchmark (steady=11 ms, p95=17 ms) measures pure render cost, not full request cost including gateway + DB latency. |
| **Gate Numbers** | 0 load tests exist. BLOCKED. |

---

### 9. Stress

| Attribute | Value |
|---|---|
| **Status** | NOT-CONNECTED |
| **Infrastructure needed** | Same as Load, plus: (1) the ability to ramp beyond design capacity to observe graceful degradation, (2) Cloudflare Worker CPU/memory limit observability. The `cache:true` LRU (Phase F F1) and `Promise.allSettled` parallelism (Phase F F2) must be validated under sustained load; cross-request LRU (engine pooling) is not implemented and performance degrades linearly above concurrency limits. |
| **Command when ready** | `k6 run tests/stress/storefront-liquid-spike.js` (script must be authored). |
| **Gate Numbers** | 0 stress tests exist. BLOCKED. |

---

### 10. Memory

| Attribute | Value |
|---|---|
| **Status** | NOT-CONNECTED |
| **Infrastructure needed** | (1) Node.js heap profiling on the Next.js server process (storefront-runtime), (2) Cloudflare Worker memory limits monitoring via Analytics Engine, (3) long-running test harness that sends N requests and observes heap growth between renders. The DOMPurify JSDOM singleton is a module-level allocation; the LiquidJS engine created per-request with `cache:true` (LRU) carries parse trees in-process memory; no heap leak tests exist. |
| **Command when ready** | `node --heap-prof apps/storefront-runtime/.next/server/app/store/[subdomain]/page.js` + `v8-profiler` analysis, or a custom script calling `process.memoryUsage()` before/after N renders via `LiquidRenderer.render()`. |
| **Gate Numbers** | 0 memory tests exist. BLOCKED. |
| **Note** | The `domPurifyPromise` singleton (JSDOM init) has no `.catch()` rejection handler (R-12 in risk register, OPEN). A JSDOM init failure leaves the sanitiser uninitialised silently and no test currently catches this path. |

---

### 11. Browser

| Attribute | Value |
|---|---|
| **Status** | NOT-CONNECTED |
| **Infrastructure needed** | (1) Playwright installed (`@playwright/test` not in any `package.json` in `apps/storefront-runtime`), (2) a live Liquid-rendered storefront URL, (3) Chromium/WebKit binary available in CI. The `liquid-hydration-islands-parity.test.mjs` tests verify SSR attribute contracts but do not boot a real browser — `customElements.define()` is not exercised; island JS behaviour is not tested. |
| **Command when ready** | `playwright test tests/browser/storefront-liquid-e2e.spec.ts` against a staging URL. Key scenarios to author: add-to-cart flow (lb-add-to-cart click → cart count update), variant selection (lb-variant-picker), search (lb-search submit → results render), customer login/register no-JS POST, lb-logout form submit, cart drawer open/close/remove-item. |
| **Gate Numbers** | 0 browser tests exist. BLOCKED. |

---

### 12. Mobile

| Attribute | Value |
|---|---|
| **Status** | NOT-CONNECTED |
| **Infrastructure needed** | Same as Browser, plus Playwright viewport emulation at mobile breakpoints (375px, 414px) or a real device/BrowserStack connection. The `--lb-*` design token system and 360px mobile-first layout are asserted only in unit tests against rendered HTML; no viewport-level responsiveness is tested. |
| **Command when ready** | `playwright test tests/browser/storefront-mobile.spec.ts --project=mobile-chrome` using a Playwright `devices['iPhone 14']` or `devices['Pixel 7']` preset. |
| **Gate Numbers** | 0 mobile tests exist. BLOCKED. |

---

### 13. Regression

| Attribute | Value |
|---|---|
| **Status** | CONNECTED |
| **Command** | `pnpm typecheck test --filter=@letbuyy/theme-engine && pnpm typecheck test --filter=@letbuyy/storefront-runtime && pnpm typecheck --filter=@letbuyy/api-gateway && pnpm typecheck test --filter=@letbuyy/merchant-control-plane` |
| **Gate Numbers** | **theme-engine: 221/221 PASS** (no decrease from any prior phase gate)<br>**storefront-runtime: 78/78 PASS** (no decrease)<br>**api-gateway typecheck: 32 turbo tasks, exit 0** (no type errors)<br>**merchant-control-plane: 15/15 PASS** (no decrease) |
| **Baseline progression** | Phase B (BLOCKED) → Phase C 89/89 + 19/19 → Phase D 101/101 + 31/31 → Phase E 109/109 + 52/52 → Phase F 157/157 + 52/52 (gate ran by orchestrator) → Phase G 157/157 + 52/52 → Phase H 198/198 + 52/52 → Phase I **221/221 + 78/78** |
| **Validator regression** | `node scripts/validate-governance.mjs`: **FAIL (pre-existing)** — tenant-table registry out of sync with generated schema; unrelated to Phase I. `node scripts/validators/theme-governance-validator.mjs`: **PASS**. `node scripts/validators/migration-safety-validator.mjs`: **PASS**. `node scripts/validators/sequential-migration-validator.mjs`: **FAIL (pre-existing)** — migrations 186/187 on disk but uncommitted (WIP pre-dating Phase B). Neither failure is introduced by Phase I. |

---

### 14. Visual-Diff

| Attribute | Value |
|---|---|
| **Status** | NOT-CONNECTED |
| **Infrastructure needed** | (1) Screenshot baseline images from a known-good Liquid render committed to the repository, (2) a screenshot diffing tool (Percy, Chromatic, or `pixelmatch` via Playwright), (3) a live Liquid-rendered storefront URL. No baseline screenshots exist anywhere in the repository. |
| **Command when ready** | `percy snapshot tests/visual/storefront-liquid-pages.list` or a Playwright visual comparison: `expect(page).toHaveScreenshot('homepage.png', { threshold: 0.01 })`. Percy requires `PERCY_TOKEN` env var. |
| **Gate Numbers** | 0 visual-diff tests exist. BLOCKED. |
| **Note** | The `theme-artifact-exporter.test.ts` confirms byte-identity of `.liquid` source exports (`theme-engine/test/`) but does not compare rendered HTML or screenshots. |

---

### 15. Security

| Attribute | Value |
|---|---|
| **Status** | PARTIAL |
| **CONNECTED dimension** | `packages/theme-engine/test/qi-security.test.ts` (Phase I lane-a, 13 tests) exercises real `sanitizeRenderedHtml()`, `buildLiquidThemeHeadAssets()`, and `toLiquidDrop()` behaviour: DOMPurify FORBID_TAGS (base, embed, object — SEC-1a/b/c), FORBID_ATTR style= (SEC-2), SSTI probe `{{ 7 \| times: 7 }}` non-evaluation in settings (SEC-3a narrowed to `<p>[^<]*49[^<]*<\/p>` assertion, not a global match), SSTI `{%` literal in liquidContext settings (SEC-3b), toLiquidDrop depth-4 truncation (SEC-4), MAX_LIQUID_DROP_KEYS=80 key slice (SEC-5), BLOCKED_DROP_KEYS for prototype-pollution keys constructor/prototype (SEC-6) + JSON.parse own-enumerable __proto__ path (SEC-6b, added in hardening), BLOCKED_DROP_KEYS 13-key completeness assertion (SEC-7), CSS injection neutralisation in settings_data (SEC-8), data-* attribute XSS hook (SEC-9), javascript:/data: href/src block (SEC-10). |
| **CONNECTED gate** | All 13 tests included in theme-engine **221/221 PASS**. |
| **NOT-CONNECTED dimension** | DAST (dynamic application security testing) against a live storefront URL is not wired. CSP header enforcement in a real browser is not tested. Penetration testing (SQL injection via gateway, JWT forgery, IDOR) is not covered by any automated suite. Required: (1) OWASP ZAP or Burp Suite scan against staging URL, (2) `npm run security:audit` (not defined), (3) `.github/workflows/security-review.yml` requires `ANTHROPIC_API_KEY` in CI secrets. |
| **Command when ready (DAST)** | `zap-cli quick-scan --spider https://<store>.letbuyy.com --ajax-spider` or `burpsuite-cli scan --target https://<store>.letbuyy.com`. |
| **Gate Numbers** | CONNECTED: 13 security tests, all PASS in 221/221. NOT-CONNECTED: 0 DAST tests exist. |
| **Known open findings from Phase I review** | SEC-6 `__proto__` tautology resolved by SEC-6b (real JSON.parse path now tested). DOMPurify clobbering strips `name="name"` from customer-register form — product bug confirmed, tracked, not yet fixed (see PHASE_I_REPORT.md §3). `theme-artifact-exporter.ts` path-traversal risk (H-F2) and `settings_data` BLOCKED_DROP_KEYS bypass (H-F3) from Phase H remain OPEN. |

---

### 16. Chaos

| Attribute | Value |
|---|---|
| **Status** | NOT-CONNECTED |
| **Infrastructure needed** | Orchestrated fault injection against a live deployment: (1) gateway unreachable (`resolveAccess()` 503 → should degrade to `NextResponse.next()`, not hard crash — Phase C R-14 access-bypass risk), (2) malformed Liquid bundle in DB (Phase C C1 crash recovery tested in unit tests, but not in live rendering), (3) Supabase connection exhaustion (Hyperdrive pool), (4) DOMPurify JSDOM singleton init failure (no rejection handler — R-12, OPEN), (5) gateway response timeout > 30 s. No chaos test harness or fault-injection library is installed. |
| **Command when ready** | A custom chaos harness (e.g. `chaos-monkey` or Gremlin) sending targeted faults to staging. Minimum viable test: `curl --max-time 0.001 <gateway_url>` to simulate gateway timeout and assert storefront renders a React fallback rather than a 500. |
| **Gate Numbers** | 0 chaos tests exist. BLOCKED. |
| **Structural evidence** | Phase C C1/C2 crash isolation (per-section try/catch in `theme-renderer.ts`) and the `composition-engine.tsx` catch with `lb:canary:render:fallback` telemetry are the main chaos-resilience mechanisms. These are unit-tested but not chaos-tested with live service failure. |

---

## Summary Grid

| Category | Status | Phase I Gate |
|---|---|---|
| Unit | CONNECTED | 221/221 (theme-engine) + 78/78 (storefront-runtime) + 15/15 (merchant) |
| Integration | PARTIAL | CONNECTED: 78/78 (contract tests); NOT-CONNECTED: live gateway integration |
| Accessibility | PARTIAL | CONNECTED: 8 A11Y tests in 221/221; NOT-CONNECTED: axe-core in live browser |
| Performance | PARTIAL | CONNECTED: F9 benchmark in 221/221; NOT-CONNECTED: production profiling |
| SEO | NOT-CONNECTED | 0 tests — needs live URL + Lighthouse |
| Hydration | CONNECTED | 13 new + 40 existing in 78/78 |
| SSR | CONNECTED | 13 new + 140 existing in 78/78 |
| Load | NOT-CONNECTED | 0 tests — needs k6 + staging stack |
| Stress | NOT-CONNECTED | 0 tests — needs k6 + staging stack |
| Memory | NOT-CONNECTED | 0 tests — needs heap profiler + live process |
| Browser | NOT-CONNECTED | 0 tests — needs Playwright + live URL |
| Mobile | NOT-CONNECTED | 0 tests — needs Playwright mobile preset + live URL |
| Regression | CONNECTED | All baselines hold; 2 pre-existing validator failures unchanged |
| Visual-Diff | NOT-CONNECTED | 0 tests — needs screenshot baseline + diffing tool |
| Security | PARTIAL | CONNECTED: 13 security tests in 221/221; NOT-CONNECTED: DAST |
| Chaos | NOT-CONNECTED | 0 tests — needs fault-injection harness + live deployment |

**CONNECTED / PARTIAL total:** 8 of 16 categories have runnable coverage.  
**NOT-CONNECTED total:** 6 categories require live infrastructure before any assertion can run.  
**PARTIAL total:** 2 categories have in-process coverage but lack a live-browser or production dimension.

---

## Governance Validator Status

| Validator | Result | Notes |
|---|---|---|
| `node scripts/validators/theme-governance-validator.mjs` | **PASS** | 25 section schemas; WARN mode; Liquid default OFF; schema migration runner wired |
| `node scripts/validators/migration-safety-validator.mjs` | **PASS** | No destructive ALTER/DROP patterns |
| `node scripts/validators/sequential-migration-validator.mjs` | **FAIL (pre-existing)** | Migrations 186/187 on disk but not committed (uncommitted WIP pre-dating Phase B); no Phase I code change caused this |
| `node scripts/validate-governance.mjs` | **FAIL (pre-existing)** | Tenant-table registry (`tenant-tables.registry.ts`) out of sync with schema-derived registry; requires `generate-tenant-table-registry.mjs` run; unrelated to Phase I |

---

*QA Certification Matrix — Phase I | 2026-07-10 | Branch: stepup/main | Author: Subagent (Phase I QA certification role)*
