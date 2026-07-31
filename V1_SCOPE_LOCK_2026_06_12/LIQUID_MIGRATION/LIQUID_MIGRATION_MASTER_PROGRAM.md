# LIQUID_MIGRATION_MASTER_PROGRAM.md

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · code-grounded. Phases L0–L12. **Plan only — no code, no commits.**

**Legend:** [HYBRID] = required for the Option-A V1 launch · [FULL] = additional for full-Liquid / React deletion · effort is verifier-sized, not inflated. All phases inherit the **commit seam (C0)** (sandbox `.git/index.lock` blocks commits — a human commits each phase) and the gate's untracked-migration guard.

---

## L0 — Truth Lock [HYBRID] · ~2–3 days
- **Objectives:** freeze the scope (Option A), pre-align ARB on the eventual flip, lock the canary cohort plan.
- **Deliverables:** sign-off that browse=Liquid / checkout+account+orders=React for V1; ARB pre-read referencing parity exit criteria; this program ratified.
- **Files:** docs only (this dir). No source.
- **Validators:** none new. `theme-governance-validator` stays green (flag stays false).
- **Tests:** n/a.
- **Dependencies:** none.
- **Rollback:** n/a (decision doc).
- **Success:** Option A ratified; ARB exit criteria written (parity-green + perf + security).

## L1 — Bundle Persistence [HYBRID] · ~3–5 days
- **Objectives:** make urban-kicks ship a real Liquid bundle so install/publish carries it to `sites.template_config`.
- **Deliverables:** a `LiquidThemePackageBundle` for urban-kicks (layout + 20 sections + `index/product/collection` templates), built from `createLiquidParitySectionFiles` (`theme-bundle.ts:769-1156`); a seed/migration writing it into `themes.default_template` + `themes.config`.
- **Files:** `database/supabase/seeds/urban-kicks-theme.sql` (add `liquidBundle` to `default_template`/`config`); new migration `database/supabase/migrations/171_*` if a re-seed/backfill of existing stores is needed; possibly a build script under `scripts/liquid-parity/` to emit the bundle JSON.
- **Validators:** `sequential-migration-validator` (new migration must be tracked); `migration-safety-validator`; bundle must pass `LiquidThemePackageBundleSchema` (`theme-bundle.ts:429-502`, strict: section-key==file-type, `{% schema %}` required, no `<script>`/`{% render %}`/`{% include %}`/`{% layout %}`).
- **Tests:** a test asserting the seeded `default_template` parses as a valid liquid bundle and `rendererEngine==='liquid'`; install-carries-bundle test (`buildReleaseArtifacts` re-detects it → `sites.template_config.liquidBundle`).
- **Dependencies:** L0.
- **Rollback:** revert the seed/migration; stores fall back to React (`resolveLiquidBundle` → undefined). No data loss (bundle is additive JSON).
- **Success:** a test store, after install, has `sites.template_config.liquidBundle` present and schema-valid; canary still off so production unaffected.

## L2 — CSS Pipeline [HYBRID] · ~1 week
- **Objectives:** make Liquid pages styled.
- **Deliverables:** (a) `:root` token block injected into `layout/theme.liquid` from `config.settings_data.current` (port `layout.tsx:126-160`); (b) the `lb-*` stylesheet extracted from `globals.css:554-710` into a served asset (+ ~10% new rules for `lb-spotlight`/`lb-badge`); (c) an `/assets/*` serving route (R2/static) + a resolver that injects `<link rel="stylesheet">` from `renderer.assets`.
- **Files:** `packages/theme-engine/src/theme-bundle.ts` (layout source + `renderer.assets` populated); `packages/theme-engine/src/theme-renderer.ts` (inject `:root` + `<link>`; verify DOMPurify `WHOLE_DOCUMENT` keeps `<style>`/`<link>` in head — `:287`); a new storefront `/assets/[file]/route.ts` or R2 binding; extracted CSS file (e.g. `packages/theme-engine/assets/urban-kicks.css`).
- **Validators:** `theme-governance-validator` (sanitizer asserts `:88-97` — keep DOMPurify + `outputEscape:'escape'`); `cloudflare-binding-validator` if R2 binding added.
- **Tests:** render test asserting the layout emits `:root` vars + a stylesheet `<link>` that survives sanitization; a visual/structural snapshot of a styled section.
- **Dependencies:** L1.
- **Rollback:** revert the layout/asset changes; pages render unstyled (current state). No data.
- **Success:** a seeded+canary test store renders a **styled** home page (tokens applied, `lb-*` classes resolved).

## L3 — Theme Authoring (portable→Liquid compiler) [FULL, deferrable] · ~2–3 weeks
- **Objectives:** let the merchant editor author/emit a Liquid bundle (so merchant theme edits persist as Liquid, not portable JSON that strips the bundle).
- **Deliverables:** a `compilePortableToLiquidBundle(templateConfig) → LiquidThemePackageBundle` (sections record + per-section `.liquid` with `{% schema %}` + layout + `templates` map); editor wired to call it on publish/draft and include `liquidBundle`(+`liquidRenderingCanary`) in the PUT/POST body (the routes already accept them — `editor/route.ts:29-40`, `editor/draft/route.ts:27-34`); an engine indicator/guardrail so editing a Liquid store doesn't desync.
- **Files:** new `packages/theme-engine/src/portable-to-liquid.ts`; `apps/merchant-control-plane/.../editor/page.tsx` (`buildDraftConfig:581-618`, `handlePublish:1048-1052`); editor routes.
- **Validators:** output must pass `LiquidThemePackageBundleSchema`; `theme-governance-validator` parity.
- **Tests:** compiler round-trip (portable → liquid → renders same sections); editor-emits-bundle contract test.
- **Dependencies:** L1, L4 (template shapes).
- **Rollback:** stop emitting `liquidBundle` from the editor (revert to portable JSON). Imported Liquid themes still render; only authoring reverts.
- **Success:** a merchant edit in the visual editor publishes a valid Liquid bundle that renders the edited sections.
- **DEFER for Option A** if V1 ships one fixed default Liquid theme with no merchant Liquid editing.

## L4 — Template System [HYBRID for index/product/collection; FULL for the rest] · ~1.5–2 weeks
- **Objectives:** author the page templates the resolver needs (so routes stop falling back to `index`).
- **Deliverables:** Liquid `templates` + sections for `product`, `collection` (HYBRID); `cart`, `customers/account`, `customers/login`, `customers/register`, `customers/order`, `page`, `search`, `404` (FULL). cart/customers/order are net-new section authoring.
- **Files:** `packages/theme-engine/src/theme-bundle.ts` (new section fixtures + `templates` map); the seed (L1) carries them.
- **Validators:** `LiquidThemePackageBundleSchema` cross-checks (template→section→block references `:474-501`).
- **Tests:** per template, a render test binding real data (`{{ product.title }}`, `{% for item in collection.products %}`) — replacing the grep-only coverage.
- **Dependencies:** L1, L2.
- **Rollback:** remove the template keys; routes fall back to `index`. No data.
- **Success:** `/product/:id` and `/collections/:slug` render their own Liquid template with real data on a canary store.

## L5 — Commerce Integration [HYBRID] · ~3–5 days
- **Objectives:** fix the drops so browse pages bind real catalog (not demo blocks).
- **Deliverables:** populate `collection` drop with real title/desc (`composition-engine.tsx:301-308`); point home `product-grid`/`featured-products` at `collection.products`; add variant→price recompute to `lb-variant-picker` (`liquid-hydration-islands.tsx`).
- **Files:** `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx`; `liquid-hydration-islands.tsx`; section fixtures in `theme-bundle.ts`.
- **Validators:** none new.
- **Tests:** render test asserting collection title + product loop bind; island test for variant repricing.
- **Dependencies:** L4.
- **Rollback:** revert drop changes; demo blocks return.
- **Success:** browse pages show live catalog + working variant selection.

## L6 — Cart Integration [FULL] · ~3–5 days
- **Objectives:** full-page Liquid cart.
- **Deliverables:** Liquid `cart` template; optional server cart-drop injection (read `lb_cart_token` cookie → GET `/cart/:token` `cart-routes.ts:460`). Backend already complete.
- **Files:** `theme-bundle.ts` (cart section/template); optional `composition-engine.tsx` cart-drop fill.
- **Validators:** none new.
- **Tests:** Liquid cart renders shared `lb_cart` state; add→cart-page→checkout-link works.
- **Dependencies:** L4, L5.
- **Rollback:** route `/cart` stays React page.
- **Success:** `/cart` renders Liquid with the same cart state as the drawer.

## L7 — Account Integration [FULL] · ~1 week
- **Objectives:** Liquid account pages over existing `/api/customer/*`.
- **Deliverables:** `customers/account|login|register|addresses|settings|wishlist` Liquid templates; `customer` drop populated from session (or client-hydrate via `/api/customer/session`).
- **Files:** `theme-bundle.ts`; optional `composition-engine.tsx` customer-drop fill (`:323`).
- **Validators:** none new (reuses BFF routes).
- **Tests:** account templates call the same endpoints; auth-gated render.
- **Dependencies:** L4. Preserves the issuer model (customer HS256, no identity-platform touch — see LB-12 strategy).
- **Rollback:** account stays React.
- **Success:** logged-in account pages render Liquid.

## L8 — Order Integration [FULL] · ~3–5 days
- **Objectives:** Liquid order history + status.
- **Deliverables:** `customers/order` + order-history/guest-lookup Liquid templates over `/api/customer/orders` + `/api/orders/{check,login,set-password}`.
- **Files:** `theme-bundle.ts`.
- **Validators:** none new.
- **Tests:** order templates bind real order data.
- **Dependencies:** L4, L7.
- **Rollback:** orders stay React.
- **Success:** order history + tracking render Liquid.

## L9 — Parity Validation [HYBRID for browse; FULL for tail] · ~1–2 weeks
- **Objectives:** turn the 200-cell parity matrix green (browse subset for Option A).
- **Deliverables:** executed `scripts/liquid-parity/run-parity-matrix.mjs` on staging; real render + island behavioral tests replacing grep-only; `THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT=20` satisfied.
- **Files:** `LAUNCH_READINESS_2026_06_12/evidence/e-liquid-parity/PARITY_MATRIX.md` (cells → PASS); new tests under `tests/theme-engine/` + `tests/contracts/`.
- **Validators:** `theme-governance-validator:69-72,108-109` (parity + test presence).
- **Tests:** the parity harness itself; per-section render parity vs React snapshot.
- **Dependencies:** L1–L5 (+L6–L8 for full).
- **Rollback:** keep flag off; no production effect.
- **Success:** all browse cells (Option A) or all 200 (full) green; no red blocks canary.

## L10 — Canary Rollout [HYBRID] · ~3–5 days + soak
- **Objectives:** a per-store canary writer + cohort flip.
- **Deliverables:** a canary control — write `liquidRenderingCanary:true` into `sites.template_config` (or add a `sites.liquid_rendering_canary` column + teach `store-service.ts`/`resolveThemeLiquidRenderingEnabled`), plus an operator endpoint; flip 1 → N stores.
- **Files:** `theme-execution.adapter.ts` (persist canary through `buildReleaseArtifacts`); optional migration for the column; `store-service.ts:655-657`; an operator route.
- **Validators:** `sequential-migration` (if column added); `theme-governance-validator` (default stays false).
- **Tests:** canary write flips a store to Liquid; non-canary stores stay React.
- **Dependencies:** L9 green.
- **Rollback:** set canary false → store reverts to React instantly (render-time gate).
- **Success:** a real pilot store renders Liquid end-to-end (browse) in production with the default still off elsewhere.

## L11 — Production Rollout [HYBRID] · human + ~1 week soak
- **Objectives:** broaden Liquid; (optionally) flip the platform default.
- **Deliverables:** cohort expansion; ARB decision to move `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` off `deferred` (`theme-governance.ts:16-21`) + edit `theme-governance-validator:57-67` asserts in lockstep; monitoring (`X-Lb-Render-Engine` header `proxy.ts:171`).
- **Files:** `theme-governance.ts`, `theme-governance-validator.mjs` (only at the ARB flip).
- **Validators:** the flip requires the validator asserts to be updated together (governed change, ARB-authorized).
- **Tests:** smoke on flipped cohort; rollback drill.
- **Dependencies:** L10 soak clean.
- **Rollback:** re-set default false / canary false per store.
- **Success:** target cohort on Liquid in production, money/identity/tenancy unaffected.

## L12 — React Decommission [FULL, post-stability] · ~1–2 weeks
- **Objectives:** delete React storefront code that Liquid now replaces.
- **Deliverables:** staged archival per `REACT_DELETION_PLAN.md` (chrome → 20 sections → registry/React branch → bespoke tail pages → contexts), each with its lockstep validator edit.
- **Files:** per the deletion plan; archive to `docs/archive/dead-code/`.
- **Validators:** edit (same commit) `no-new-react-sections-validator`, `theme-governance-validator` (count==20), `typescript-dead-source-validator:141` (product-details lock), `domain-boundary-validator:209` (route count) as each artifact goes.
- **Tests:** full gate + storefront E2E after each batch; no regression in money/identity/tenancy validators (they're untouched).
- **Dependencies:** **every route renders Liquid + parity stable in production** (i.e., L6–L8 done, not just hybrid). Cannot start until the tail is Liquid.
- **Rollback:** restore from archive (de-referenced, re-homed) + revert the validator edits.
- **Success:** React section layer + bespoke tail pages removed; gate green at the new counts; only the engine-agnostic backbone remains.

---

## Timeline rollup

- **Option A (Hybrid V1 launch):** L0,L1,L2,L4(index/product/collection),L5,L-chrome,L9(browse),L10,L11 ≈ **4–6 weeks** + ARB.
- **Full Liquid:** + L3,L4(rest),L6,L7,L8,L9(full) ≈ **+5–8 weeks** (10–14 total).
- **React fully deleted:** + L12 ≈ **+1–2 weeks** after full-Liquid is stable in production.

## Foundation-preservation invariants (every phase)

No phase touches `services/api-gateway` money/identity/tenancy logic, the canonical ledger, RLS, or the issuer model. Checkout/payments stay the engine-agnostic React+gateway path. The only governance edits are theme/section/route-count validators, made in lockstep and (for the ARB flip) human-authorized. The 123-validator gate's money/identity/tenancy validators remain green throughout.
