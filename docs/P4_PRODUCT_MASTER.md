# P4_PRODUCT_MASTER — Product Completeness, API Ownership, and Shopify-Depth Roadmap

Parent: `LETBUYY_MASTER_EXECUTION_PLAN.md`
Scope: product-facing gaps that are not launch security/cost blockers but determine merchant satisfaction and the path to Shopify parity. Documentation only.
Correction carried from the master plan: the "Liquid renderer is missing" finding is a **FALSE POSITIVE** — it is implemented (WS11, `theme-renderer.ts:104-211`, liquidjs, 20/20 tests). Do not scope work to build it; scope work to **prove and surface** it.

---

## P4-1 — Multi-Template Theme Editing (PROD-3)

### Problem
The editor page selector is a hardcoded, non-interactive "Home page" pill (`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx:1131-1132`) — no state, no options, decorative chevron. Merchants can only edit the home template.

### Implementation tasks
1. Replace the static pill with a template selector bound to the theme bundle's `templates` (the bundle contract already supports multiple templates: `packages/theme-engine/src/theme-bundle.ts`).
2. Load/save draft per template; the publish flow already supports release snapshots — extend draft state to be template-scoped.
3. Add product/collection/page/cart/blog template editing, not just `index`.

### File-by-file
| File | Change |
|---|---|
| `…/editor/page.tsx` | template selector + per-template draft state |
| `services/api-gateway/src/routes/themes.ts` | draft/publish accept a `template` key |
| `services/api-gateway/src/execution/theme-execution.adapter.ts` | per-template draft persistence |

### Migration / Rollback / Testing / Acceptance
- Draft storage may need a `template` column on `theme_editor_drafts` (`087_theme_template_drafts.sql`, additive).
- Rollback: default to `index` template (current behavior).
- Test: edit + publish a product template; verify storefront renders the published product template via the Liquid/JSON renderer.
- Acceptance: merchants can edit and publish multiple templates; preview matches the storefront renderer.

**Complexity:** L. **Risk:** Med.

---

## P4-2 — Resolve Storefront GraphQL `cart` Stub (MISSED-14)

### Problem
`graphql/storefront.ts:524` unconditionally returns `data.cart = null`; documented as skipped in `CODEX_WS12_STATUS.md`. Cart-dependent GraphQL clients silently get null.

### Tasks
Implement the `cart` resolver against the existing cart storage, or — until then — return an explicit `CART_NOT_SUPPORTED` error rather than `null`, so clients fail loudly. Gate storefront GraphQL `cart` behind the WS12 feature flag (P3-7) until implemented.

### Acceptance
`cart` either returns real data or a clear unsupported error; no silent null. Enabled only when backed.

**Complexity:** M. **Risk:** Low.

---

## P4-3 — Surface Liquid + Checkout-Function Capabilities Honestly (PROD-2 correction)

### Context
Liquid rendering and a sandboxed WASM checkout-function runtime are real and solid. The product gap is **packaging and messaging**, not implementation.

### Tasks
1. Update merchant/developer docs and the developer-portal to describe the actual theme capabilities (Liquid + JSON-contract) and the checkout-extension model (advisory functions: coupon/method/validation, not arbitrary totals — `packages/app-engine/src/index.ts:377+`).
2. Remove stale "Liquid unsupported" language from internal docs and any UI copy.
3. Add theme-developer tooling docs (bundle contract, app blocks).

### Acceptance
Public/merchant messaging matches shipped capability; no "coming soon" on features that exist, no overstatement of extensibility that doesn't.

**Complexity:** S. **Risk:** Low.

---

## P4-4 — API Ownership Consolidation (PROD-5)

### Problem
115 app-local `route.ts` handlers (`apps/*/src/app/api`: merchant 62, storefront 21, identity 18, app-mkt 8, console 4, theme-mkt 2) coexist with the gateway, splitting business logic between edge Workers and Next BFFs and risking auth/validation drift from the "gateway is the sole commerce backend" rule.

### Tasks (incremental, not a big-bang)
1. Classify each app-local route: (a) thin proxy to `/v1` (keep, but ensure it adds no business logic), (b) duplicate business logic (migrate into the gateway), (c) genuinely app-local UI concern (keep).
2. Add a governance validator that flags app-local routes performing direct DB access or commerce logic.
3. Migrate the highest-risk duplicates first (payments, customer, orders).

### Acceptance
No app-local route performs commerce business logic or direct DB writes; a validator enforces it.

**Complexity:** L. **Risk:** Med.

---

## P4-5 — Developer Portal Deployment Decision (INFRA-3)

### Problem
`apps/developer-portal` is declared in production topology (`config/runtime/production-topology.json:441`) but absent from the deploy matrix (`production-deploy.yml:184-200`).

### Tasks
Decide and make consistent: either add `developer-portal` to the deploy matrix, or mark it non-production in topology and CODEX status docs. If it documents the new GraphQL/extension APIs (it does), it should ship alongside their enablement (P3-7).

### Acceptance
Topology and pipeline agree on developer-portal's production status.

**Complexity:** S. **Risk:** Low.

---

## P4-6 — Shopify-Depth Roadmap (PROD-6) — explicitly NOT launch blockers

Sequenced by merchant value for an India-first MVP. None gate the 100-merchant beta.

| Tier | Capability | Notes |
|---|---|---|
| Should-have before 1,000 | Custom-domain automation + takeover prevention | DNS split (Vercel wildcard + CF Worker API) needs verification workflow |
| Should-have before 1,000 | Refund/return workflows | core routes exist; deepen |
| Should-have before 1,000 | Abandoned-cart capture/recovery | `carts` has recovery flags; build the workflow |
| Should-have before 1,000 | GST/tax reports | India GST invoice exists; add reporting |
| Should-have before 1,000 | Media optimization + direct-to-R2 upload | ties to P2-6 |
| Can wait | Metafields/metaobjects (custom data) | major Shopify primitive; absent |
| Can wait | Markets / multi-currency / duties | absent |
| Can wait | Full international tax engine | beyond India GST |
| Can wait | Subscriptions (recurring consumer) | tables exist; not productized |
| Can wait | Gift cards as a marketed feature | checkout SQL supports; needs UI + fraud |
| Can wait | Merchant automation (Flow equivalent) | orchestration foundations exist |
| Can wait | POS / omnichannel | no runtime |
| Can wait | Public app marketplace at scale | OAuth/bridge hardened; needs review/compliance pipeline |

### Acceptance
The roadmap is sequenced and communicated; the 100-merchant beta markets a narrow, reliable India-first MVP (store, themes, products, checkout, payments, orders, policies, basic analytics) — not Shopify parity.

---

## P4 Product Quality Gates (pre-beta)
- Merchant dashboard empty/error/loading/disabled/focus states QA across core screens.
- Theme publish/rollback visual regression.
- Accessibility pass on identity, checkout, merchant forms, theme editor.
- Mobile Dart models reconciled with shared TS contracts before any mobile launch.
