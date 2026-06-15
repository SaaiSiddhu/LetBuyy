# Theme Engine Certification — Phase 10 (Final)

> Mission final deliverable. Synthesizes Phases 1–8. **Evidence-only — certified claims cite the phase docs; unmeasured items are labelled, not invented.**

## Verdict: 🔴 NOT READY

Strong, well-tested capability sitting behind an **incomplete integration** and **unrun verification**. Not yet CANARY READY: the chrome composition defect would break a canary store's render, and core commerce interactions (variant switching, grid add-to-cart) are unwired. A clear, bounded path to CANARY READY exists (below).

> **Update 2026-06-15 — remediation applied.** The three code-level blockers (chrome composition, variant/grid hydration, collection metadata) have been **fixed and verified** (56/56 theme-engine tests + both typechecks green; bundle regenerated schema-valid). The remaining gate to CANARY READY is now a **green Phase 6 parity run on staging** (env-bound, not run here) plus perf/security sign-off. See *Remediation applied* at the end.

## Architecture summary

- **Engine** — `packages/theme-engine`: `LiquidRenderer` (`theme-renderer.ts:321`), `composeStorefrontTheme`/`hydrateAndComposeStorefrontTheme` (`execution-runtime.ts`), `compilePortableToLiquidBundle` (translator, re-validates — `portable-to-liquid.ts`), governance gate (`theme-governance.ts`). Sanitizer locked (DOMPurify, `outputEscape:'escape'`).
- **Storefront integration** — `apps/storefront-runtime/src/lib/theme-engine`: `resolveStorefrontTemplate` → `buildSectionDataPlan` → `StorefrontCompositionEngine` (`renderLiquidPlan` vs React registry) → `liquid-hydration-islands` (Web Components).
- **Selection** — per-theme `liquidRenderingCanary` resolved from the release manifest; default `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`; platform-wide flip **deferred to ARB**.
- **Bundle** — Urban Kicks: `renderer.engine: 'liquid'`, 12 templates, 33 sections, schema-valid; persisted additively to `themes.default_template.liquidBundle` (migration 172) with in-code fixture fallback.

## Runtime path

`Request → StoreService (release_manifest→templateConfig) → resolveStorefrontTemplate (canary + bundle parse → rendererEngine) → buildSectionDataPlan → StorefrontCompositionEngine → renderLiquidPlan → LiquidRenderer | React registry → lb:canary:render telemetry`. Full detail: [theme-liquid-runtime-selection.md](theme-liquid-runtime-selection.md).

## Status by area

| Area | Status | Evidence |
|------|:------:|----------|
| Engine / compiler / sanitizer (unit) | ✅ | 56/56 tests; [compiler validation](theme-liquid-compiler-validation.md) |
| Urban Kicks bundle | ✅ valid / broad | [verification](theme-urban-kicks-verification.md) |
| **Runtime render integration** | 🔴 **defective** | chrome double-render — verification §3.1 |
| Data binding | 🟡 | products ✅, collection-meta 🔴, cart/customer client-only — [report](theme-data-binding-report.md) |
| Hydration | 🟡 | mechanism sound; coverage partial — [validation](theme-liquid-hydration-validation.md) |
| Manifest / rollout | 🟡 | table disconnected from runtime — [audit](theme-renderer-manifest-audit.md) |
| Parity | ⛔ NOT RUN | env-bound — [parity report](LIQUID_PARITY_REPORT.md) |
| Performance | ⛔ NOT MEASURED | no perf run |
| Security (SSTI/XSS) | 🟡 unit-green | DOMPurify + auto-escape pass; ARB audit pending |
| Rollback | ✅ | config-flip + auto-fallback (`composition-engine.tsx:366`) |
| Governance default | ✅ safe | flip reverted to per-theme (`store-service.ts:676`) |

## Parity & hydration results

- **Parity:** NOT RUN (live-HTTP harness; needs staging + a React store + a Liquid canary store). Statically **predicted FAIL** on all routes pending the §3.1 fix. No numbers fabricated.
- **Hydration:** mechanism sound (no React-mismatch class by design); `search` + PDP `add-to-cart` wired; `variant-picker`, grid add-to-cart, wishlist, filters **not** wired. Runtime browser check NOT RUN.
- **Performance:** NOT MEASURED.

## Remaining gaps (ordered)

1. 🔴 Chrome composition / full-doc injection (verification §3.1) — blocks correct render.
2. 🔴 Hydration coverage: variant picker + grid add-to-cart not emitted.
3. 🟡 Collection metadata binding degraded in Liquid.
4. 🟡 9/12 bundle templates unreachable (no themed route).
5. 🟡 Parity not run; perf not measured; monitoring ingestion unverified.
6. 🟡 `theme_renderer_manifests` vs `release_manifest` source-of-truth duplication.

## Launch recommendation

**Do not render Liquid for any store yet.** Path to **CANARY READY** (bounded, reuses existing architecture — no new engine):
1. Fix §3.1 (branch `layout.tsx` on `rendererEngine`, or emit body-only when embedded).
2. Emit `lb-variant-picker` + grid `lb-add-to-cart`; wire the header cart toggle.
3. Fix collection metadata binding (`buildLiquidCommerceContext` reads `SectionRenderData.collection`).
4. Run Phase 6 parity **green** for index/product/collection on staging.
5. Then **Phase 9**: formalize `renderer.engine: REACT|LIQUID` as a typed alias over `liquidRenderingCanary` (rollback = one config flip).

**PRODUCTION READY** additionally requires: perf-budget evidence, ARB SSTI/XSS sign-off, `lb:canary:render` ingestion confirmed, route-coverage (cart/search/customers) or explicit scope, and the manifest source-of-truth resolved.

## Evidence index
[Runtime selection](theme-liquid-runtime-selection.md) · [Urban Kicks verification](theme-urban-kicks-verification.md) · [Compiler](theme-liquid-compiler-validation.md) · [Data binding](theme-data-binding-report.md) · [Hydration](theme-liquid-hydration-validation.md) · [Manifest audit](theme-renderer-manifest-audit.md) · [Parity](LIQUID_PARITY_REPORT.md) · [Readiness](LIQUID_PRODUCTION_READINESS.md)

## Remediation applied — 2026-06-15 (post-certification)

Three code-level blockers from this certification were fixed and verified. Live render + parity remain env-bound (Phase 6).

1. **Chrome composition (gap #1)** — `composition-engine.tsx` `renderLiquidPlan` now returns the sanitized **body** (`result.liquid.contentForLayout`) instead of the full `layoutHtml` document. The React shell (`layout.tsx`) owns `<html>`/`<head>` + header/footer; no more full-document-in-a-`<div>` (discarded head) or duplicate chrome. React chrome + Liquid body; the cart is unified because `cart-context.tsx` and the Liquid island share the `lb_cart` localStorage key.
2. **Hydration coverage (gap #2)** — `theme-bundle.ts`: `product-detail` now emits `<lb-variant-picker>` over `product.options`; `product-grid` + `collection-product-list` cards now emit `<lb-add-to-cart>`. Bundle regenerated (`migration 172` + seed JSON), schema-valid. *(Wishlist, filters, and in-cart quantity editing remain out of scope — React-only or follow-up.)*
3. **Collection metadata (gap #3)** — `buildLiquidCommerceContext` now reads the real `SectionRenderData.collection` (title/description) the route resolved, falling back to the route-derived synthesis.

**Verification:** `pnpm --filter @letbuyy/theme-engine test` → 56/56; theme-engine typecheck → 0 errors; storefront-runtime typecheck → EXIT 0, 0 errors; bundle regenerated schema-valid. **No parity numbers fabricated** — live browser render + Phase 6 parity are env-bound and not run here.

**Updated verdict:** the three integration defects are **remediated**; the remaining gate to **CANARY READY** is a **green Phase 6 parity run on staging** + perf-budget evidence + ARB SSTI/XSS sign-off.

---
**Certified:** NOT READY (code blockers remediated 2026-06-15; awaiting staging parity) · **Basis:** code + DB + unit tests + bundle inspection (LCIS-located, code-confirmed). Parity, performance, and live hydration are explicitly unrun, not assumed.
