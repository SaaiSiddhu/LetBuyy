# PHASE L0 — FOUNDATION FREEZE RATIFICATION

**Program:** Full Liquid V1 → executed as **Hybrid Phase-1 (L0→L5)** for V1 · **HEAD:** `0b8a56e7` · **Date:** 2026-06-13
**Status:** L0 ratified (documentary — `PHASE_L0` §5 "Files To Modify: None"). No source changed.
**Authority:** `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (ART-17/18, R-15) is supreme; repository truth overrides documentation.

---

## 1. Ratified scope (what V1 actually ships, per the repo's own code-verified verdicts)

The literal program target ("everything Liquid; React storefront removed") is **NOT a V1 deliverable** —
disproven at this HEAD by two independent code audits:
[`LIQUID_V1_FEASIBILITY_REPORT.md`](../../LIQUID_V1_FEASIBILITY_REPORT.md) and
[`LIQUID_V1_FINAL_VERDICT.md`](../LIQUID_V1_FINAL_VERDICT.md). V1 ships the **Hybrid**:

| Surface | V1 engine | Phase |
|---|---|---|
| Home / product / collection / shop / CMS | **Liquid** | L1–L5 (this program) |
| Cart page / checkout / account / orders | **React** (engine-agnostic, foundation-frozen) | stays React in V1 |
| Tail → Liquid templates (cart/account/orders) | post-V1 | L6–L8 (Phase 2) |
| Platform-wide Liquid flip / React decommission | **ARB-gated, post-V1** | L14/L16/L17 |

This is Shopify's own shape (themeable Liquid storefront + a separate hardened checkout) and is the
**fastest *safe* path** that ends with React deletable, without routing the money path through an
unvalidated render skin.

## 2. Constitutional gates locked (ART-17, `LETBUYY_CONSTITUTION.md:253-256`)

ART-17 crowns Liquid as the canonical renderer and **forbids**: (a) flipping the Liquid default
platform-wide **without the parity/security/perf gate**; (b) **deleting React before the data decision
at the hardening wave**. Therefore:

- **L0–L5 (this program)** touch only the render-read layer + theme seed — **no flag flip, no React deletion** → fully within ART-17.
- **L14 (parity 200-cell), L16 (platform flip), L17 (React decommission)** require the parity/security/perf harness **green** + a **human ARB signature** (the flip is `status:'deferred'`, `theme-governance.ts:16-17`; `theme-governance-validator.mjs` fails the gate if flipped). These are **recorded as an open human seam**, not executed by this program.

## 3. Immutable invariant baseline (recorded; no later phase may weaken)

Verified at HEAD `0b8a56e7`:

1. **Render-path security** — DOMPurify `FORBID_ATTR:['style']` (`theme-renderer.ts:157`), `FORBID_TAGS:['base','embed','object','script']` (`:158`), `WHOLE_DOCUMENT:true` (`:163`); LiquidJS `strictFilters:true` (`:330`), `outputEscape:'escape'` (`:333`), `parseLimit 300_000` (`:335`), `renderLimit 250` (`:316/336`), `memoryLimit 2_000_000` (`:317/337`). ✅ verified.
2. **Freeze** — `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (`theme-governance.ts:14`); platform flip `status:'deferred'` (`:16`). ✅ verified. Stays asserted; `theme-governance-validator` stays green.
3. **Tenancy** — RLS ENABLE on all render-read tables (`sites`, `themes`, `theme_releases`, `store_themes`, `carts`, `store_customers`, `navigation_menus`) per `PHASE_L0` §14; enforced by the existing (passing) tenancy validators. No phase weakens RLS.
4. **Identity** — merchant ES256 via `identity-platform` (sole issuer); customer HS256 via `CUSTOMER_SESSION_SECRET`. No phase adds an issuer (`PHASE_L0` §15).
5. **Money** — the render migration never touches the canonical ledger or the hosted checkout origin; checkout stays React under any renderer (`PHASE_L0` §16).

## 4. Exit criteria

- [x] Scope ratified = Hybrid Phase-1 (L0→L5); tail + flip + deletion deferred post-V1/ARB.
- [x] Constitutional gates (ART-17) recorded; L0–L5 proven flip-free and deletion-free.
- [x] 5-invariant baseline recorded (security/freeze verified at HEAD; tenancy/identity/money asserted + validator-enforced).
- [x] Commit capability re-probed → **RESTORED** in this checkout (`evidence/L0/commit-capability-restored.txt`).
- [ ] **Open human seam (not blocking L1–L5 authoring):** ARB acknowledges L14/L16/L17 gate criteria.
- [ ] **Open commit-gate blocker:** governance gate is RED on untracked LB-7 migration `170_v1_shipping_rates_gst.sql` → no L-phase commit lands until LB-7 is committed/stashed by its owner.

## 5. Downstream readiness (L1→L5 entry plan, file-targeted at HEAD)

| Phase | Goal | Primary targets (verified) |
|---|---|---|
| **L1** Bundle persistence | Seed a real `liquidBundle` for urban-kicks so a store renders Liquid | `database/supabase/seeds/urban-kicks-theme.sql` (today seeds React); bundle read path `theme-renderer.ts:193,203`; builder `theme-bundle.ts:1459` |
| **L2** Asset/CSS pipeline | Layout emits `:root` tokens + a shipped `lb-*` stylesheet (today none) | layout `theme-bundle.ts:1816-1818`/`content_for_layout` `:1622-1634`; parity source = React `globals.css` |
| **L3/L4** Compiler + templates | Author `product` + `collection` page templates (today only `index/header/footer`) | `LIQUID_THEME_BUNDLE_PATHS.templates='templates/*.json'`; `createLiquidParitySectionFiles()` `theme-bundle.ts:769`; header `:965`, footer `:947` |
| **L5** Product/collection drops | Bind real `collection.title/description`, `collection.products`; deepen sections | `composition-engine.tsx` collection drop (~`:301-308`); commerce drops `theme-renderer.ts:443-516` |

Each lands as a per-phase commit with a green gate + evidence under `evidence/LX/`, **stopping cleanly before L16/L17**.

---

*L0 is documentary. The only repository mutation this run made was clearing a stale `.git/index.lock`. No source, no LB-7 file, and no governance flag was touched.*
