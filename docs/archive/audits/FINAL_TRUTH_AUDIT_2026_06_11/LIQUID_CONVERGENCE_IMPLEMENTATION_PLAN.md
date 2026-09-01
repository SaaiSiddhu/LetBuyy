# LIQUID CONVERGENCE IMPLEMENTATION PLAN

**Program:** LetBuyy Final Convergence · **Document 3 of 5** · **Status:** PLAN ONLY — no code changes authorized by this document
**Goal:** Liquid becomes the actual runtime winner; React is removed **only after** 100% capability + rendering + snapshot + editor parity is proven.
**Authority:** Strategic winner = **Liquid themes, React renderer frozen** (ratified). React freeze is enforced by `no-new-react-sections-validator`. This plan does not un-freeze React or add sections; it builds Liquid up to parity and then decommissions React under proof.
**Evidence base:** FINAL_TRUTH_AUDIT_2026_06_11 Theme audit (Convergence 3/10; React renders 100% today) + CAP-C08, CAP-C12.

---

## 0. WHY THIS IS PRIORITY 3 (and why it is the slowest)

The audit proved the strategic winner renders **0% of production traffic** and is **structurally unreachable**: default OFF (`theme-governance.ts:14`), the per-store canary key has **no write path anywhere in the codebase**, no store carries a Liquid bundle (bundles exist only as test fixtures), `lb-*` classes have **no CSS**, the rendered `layoutHtml` is **discarded** at the call site (`composition-engine.tsx:352`), section groups are hard-coded empty for Liquid plans, both theme editors preview React, and `theme-governance-validator.mjs:60-64` **fails the build if Liquid is flipped ON**. A canaried store today would render naked, chrome-less, unstyled HTML.

So this is not a flip — it is a **build**. The strategic decision is sound and must be respected; the work is real engineering, sequenced behind Reality Promotion and Money Unification because it touches no S0 and no money. It is the largest of the four plans by effort.

**Non-negotiable rule (from the prompt and the constitution):** React may be removed only after 100% parity across capability, rendering, snapshot, and editor — each *proven*, not asserted.

---

## PHASE 0 — CAPABILITY INVENTORY

**Goal:** the exhaustive React-vs-Liquid capability matrix with an exact parity percentage. Read-only.

### 0.1 The two runtimes (verified)

- **React (runtime winner, frozen):** `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` — 20 renderer definitions, 20 section components in `src/components/sections/`, `DynamicHeader`/`DynamicFooter` chrome on **every** store route via `store/[subdomain]/layout.tsx:214-253`, plus ~15 hardcoded React pages (cart, checkout, orders, account, policies) outside the section system.
- **Liquid (strategic winner, dormant):** `packages/theme-engine/src/theme-renderer.ts` — real LiquidJS: sections, blocks, `@app` blocks, layout, `{% schema %}`/`settings_data` stripping, sandbox (`ownPropertyOnly`, `outputEscape:'escape'`, `strictFilters`, parse/render/memory limits), 5 custom filters, DOMPurify sanitization (fragment/head/document modes — verified in render path).

### 0.2 Capability matrix (the document Phase 0 produces in full; summary here)

| Capability | React | Liquid | Parity | Source |
|---|---|---|---|---|
| Section render | Implemented (20) | Partial (15 real + 5 fixture-only) | ~60% | `theme-bundle.ts:769-1003` vs registry |
| Section settings honored | Implemented | **Partial — stubs ignore own settings** (`product-detail showGallery` renders no image; `banner-carousel autoplay`/`image` unused; `skills level` ignored) | Low | spot-reads |
| Block render | Implemented | Implemented | High | `theme-renderer.ts:366-425` |
| Snippets (`{% render %}`/`include`) | N/A | **Forbidden** (`theme-bundle.ts:101-109` bans them + `<script>`) | 0% — blocks real Shopify-theme portability | bundle guard |
| Translation (`t` filter) | Implemented | **Missing** | 0% | renderer |
| Chrome (header/footer) | Implemented (always React) | **Missing** (Liquid plans hard-code empty section groups; `layoutHtml` discarded) | 0% | `composition-engine.tsx:352`, `template-resolver.ts:213-216` |
| CSS / styling | Implemented | **Missing — no stylesheet for `lb-*`; DOMPurify strips `style`** | 0% | grep: no CSS; `theme-renderer.ts:157` |
| Cart drop / data binding | Implemented | **Hard-coded empty cart drop** | Low | `composition-engine.tsx:301-306` |
| Interactivity (add-to-cart, drawer, variant, search) | Implemented (React) | Provided by **React hydration islands** even over Liquid HTML | shared, not Liquid-native | `liquid-hydration-islands.tsx` |
| Preview parity | Implemented | previews React today | 0% | both editors → `/preview` → React |
| Editor authoring | JSON section model (React) | **cannot author/see Liquid bundles** (CAP-C08/C12) | 0% | editor surface |
| Canary write path | N/A | **None exists** | 0% | grep across repo |
| Non-section routes (cart/checkout/account) | Implemented (React pages) | not modeled | 0% | route tree |

**Honest parity estimate: ~15–20%.** Render *plumbing* exists and is well-hardened; *capability* (settings fidelity, chrome, CSS, data binding, editor, canary, snippets, i18n) is mostly absent. The D7 "parity mappings" are a 20-row table, not 20 working sections.

**Exit gate LG0:** the full matrix is ratified; the parity % is the program's baseline; every "Missing/Partial" cell becomes a tracked work item with an owning phase.

---

## PHASE 1 — RENDERING PARITY

**Goal:** a Liquid store renders a complete, styled, chrome-bearing page identical (snapshot-equal) to its React equivalent.

Steps (no React un-freeze; build Liquid up):
1. **Stop discarding `layoutHtml`.** `composition-engine.tsx:352` returns only `contentForLayout`; the computed+sanitized `layoutHtml` (theme `<html>/<head>`, CSS hooks, `content_for_header/footer`) is thrown away. Consume it. (CAP-C08 "Liquid chrome".)
2. **Build Liquid chrome.** Replace the hard-coded empty `sectionGroups:{header:[],footer:[]}` (`template-resolver.ts:213-216`) with real Liquid header/footer section groups.
3. **Ship CSS.** Author the stylesheet/asset pipeline for `lb-*` classes (or adopt a theme asset model); reconcile with DOMPurify stripping `style` attrs (use classes + linked CSS, not inline style).
4. **Complete the 5 fixture-only sections** as real first-party section files (currently only in `createUrbanKicksLiquidThemeBundleFixture`), and **make the 15 existing stubs honor their own settings** (gallery images, carousel autoplay/images, skills level, etc.).
5. **Real data binding** — replace the empty cart drop and wire product/collection/cart drops to live data.
6. Decide on **snippets + `t` filter**: either implement a sandboxed `{% render %}` + translation (required for real third-party Shopify-theme portability) or formally scope LetBuyy Liquid as first-party-only (ARB decision — affects the "Shopify-compatible" claim).

**Snapshot parity test:** for a representative theme, render every section + full page via React and via Liquid; assert DOM/visual snapshot equality. This is the gate for "rendering parity," not a code read.

**Rollback:** all additive behind the still-OFF default; React remains the live path until proven. No production exposure in this phase.

---

## PHASE 2 — EDITOR PARITY (CAP-C12)

**Goal:** the web + mobile theme editors can author and see Liquid, not just the React JSON section model.

Steps:
1. Extend the editor data model so it reads/writes Liquid bundles (`theme-bundle.ts`) alongside or instead of the JSON section contract.
2. Web editor (`merchant-control-plane/.../theme-editor/CenterPanel.tsx`) and mobile (`merchant-app/.../theme_service.dart`) both drive `/preview` — that preview must render Liquid (Phase 3) so the editor reflects production reality.
3. Build the **canary write path** (the missing piece): a merchant/API action that sets `templateConfig.liquidRenderingCanary` + attaches a `liquidBundle`. Today no writer exists anywhere — this is the gate that makes Liquid *reachable*.

**Validation:** an editor change to a Liquid theme persists a real bundle + canary flag and is visible on the storefront preview.

**Rollback:** editor changes are additive; canary remains opt-in and OFF by default.

---

## PHASE 3 — PREVIEW PARITY

**Goal:** `/preview` renders Liquid for canaried stores, so editor == preview == storefront.

Steps:
1. `/preview/page.tsx` uses the same `resolveStorefrontTemplate`/`StorefrontCompositionEngine` gate — once Phase 1 makes Liquid render fully and Phase 2 writes the canary, preview follows automatically.
2. Add preview-token-scoped Liquid rendering so merchants preview their Liquid theme before flipping the canary live.

**Validation:** snapshot equality between `/preview` (editor) and the live storefront route for the same canaried store.

---

## PHASE 4 — STOREFRONT PARITY

**Goal:** real merchant stores render Liquid in production via per-theme canary, with React as fallback only.

Steps:
1. Enable per-theme canary for pilot stores (the canary mechanism `resolveThemeLiquidRenderingEnabled` reads 11 keys — now with a writer from Phase 2).
2. The existing double-fallback to React (`composition-engine.tsx:366-376`) stays as a safety net during canary.
3. Roll the canary cohort: 1 store → N stores → opt-in GA, each step snapshot- and error-budget-gated.
4. **The platform-wide flip remains ARB-gated** (`THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` is `deferred`; `theme-governance-validator.mjs:60-64` enforces default OFF). The validator must be **amended by ARB** to permit the flip — this is the governance act that legitimizes Liquid as default, and it cannot be bypassed (correctly).

**Validation:** canary cohort renders Liquid with zero snapshot regressions and within error budget; default-OFF validator amended only with ARB sign-off + parity evidence attached.

**Rollback:** per-store canary flag off → instant React fallback; no schema risk.

---

## PHASE 5 — CHECKOUT COMPATIBILITY

**Goal:** Liquid storefront hands off to checkout without depending on React-only surfaces, and the frozen checkout-Wasm/app-functions path (CAP-C13) is resolved.

Steps:
1. Verify the Liquid storefront → hosted checkout handoff (signed cart digest, D6) works identically from a Liquid-rendered page.
2. Resolve CAP-C13: the checkout payment route still evaluates Wasm app functions (`checkout-payment-routes.ts:19`, `app-functions-runtime.ts:261`, `CheckoutExtensionHost.tsx:55`) — broader than the constitutional frozen-seam target. Either retire the live Wasm path or get an explicit ARB re-scope. **Do not expand it** (extension runtimes are a rejected architecture).
3. The ~15 non-section React pages (cart, account, policies) need a Liquid story or an explicit decision to keep them as first-party React app-shell (not theme-rendered) — clarify the boundary between "theme-rendered storefront" and "first-party app pages."

**Validation:** a Liquid store completes checkout end-to-end; checkout extensibility is no broader than the ratified frozen seam.

---

## PHASE 6 — RUNTIME VALIDATION

**Goal:** prove, under production-shaped load, that Liquid is the runtime winner with no React dependency for canaried stores.

Steps:
1. 100% snapshot parity across all section types + full pages + all canaried themes.
2. Performance parity (render latency, memory within the LiquidJS sandbox limits).
3. Error-budget clean over a sustained canary window.
4. Confirm React is reached **only** as the explicit fallback, nowhere else, for canaried stores.

**Validation matrix:** parity %, snapshot pass rate, p95 render latency, error rate, React-fallback invocation count (target: 0 for healthy canaried stores).

---

## PHASE 7 — REACT DECOMMISSION PLAN

**React may only be removed after ALL four are proven at 100%: capability parity, rendering parity, snapshot parity, editor parity.** Until then this phase is a *plan*, not an action.

### React deletion checklist (each item gated by proof)

| # | Action | Proof required |
|---|---|---|
| 1 | Confirm parity gates | 100% capability matrix green + 100% snapshot pass across all themes/sections/pages + editor authors Liquid + canary at GA |
| 2 | Migrate non-section pages | cart/checkout/orders/account/policies have a ratified Liquid or first-party-app disposition (Phase 5) |
| 3 | Flip platform-wide default | ARB amends `theme-governance-validator.mjs:60` to allow `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true`; flip decision recorded |
| 4 | Quarantine React renderer | move `renderer-registry.tsx` + 20 section components behind a removal flag; run a full canary with React physically unreachable |
| 5 | Remove `no-new-react-sections-validator` freeze | replaced by a `no-react-renderer` validator asserting absence (winner inversion, like the AGENTS.md GATE-1 inversion pattern) |
| 6 | Delete React section system | only after step 4 proves zero stores render React; paired with archive of the section components to `docs/archive/` |
| 7 | Remove React hydration islands or re-home | confirm interactivity is Liquid-native or an accepted first-party island layer |
| 8 | Retire `FEATURE_LIQUID` dead flag + canary scaffolding | once Liquid is default, the kill-switch and canary keys are simplified |

**Snapshot parity is the hard gate for steps 4–6:** a stored corpus of React-rendered page snapshots must equal Liquid-rendered snapshots for every theme before any React file is deleted. No deletion on assertion.

**Rollback for decommission:** until step 6, React is recoverable by flag. After step 6, recovery is via the archive — so step 6 is the point of no easy return and requires the strongest evidence + ARB sign-off.

---

## SAFETY RULES (Liquid-specific)

- Never un-freeze React to "reach parity faster" — parity is built in Liquid, React stays frozen until decommission.
- Never flip the platform-wide default without the ARB validator amendment — the gate enforcing OFF is correct until parity is proven.
- Never expand checkout Wasm/app-functions (rejected architecture) — Phase 5 retires or re-scopes, never grows it.
- Every canary step is snapshot- and error-budget-gated; no cohort expansion on a regression.

## DEPENDENCIES

- **In:** Reality Promotion G4 (Liquid work ships to a real production where canary matters). Independent of Money (no overlap), so can run in parallel with Money Phases 1–5 after promotion.
- **Out:** Phase 7 React deletion feeds Duplicate Elimination's runtime-convergence (one renderer). The ARB validator amendment (Phase 4) is a governance act coordinated with Duplicate Elimination's validator phase.

## TARGET

Theme Convergence **3/10 → 10/10**, but only at Phase 7 completion with full proof. Realistically the longest pole: rendering+editor+snapshot parity is substantial net-new engineering. Sequence it last among A–D and expect it to extend into the capability-build phase.
