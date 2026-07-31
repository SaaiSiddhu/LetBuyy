# LETBUYY_FULL_LIQUID_V1_MASTER_PROGRAM.md

**The supreme execution roadmap for Full Liquid V1.** Date: 2026-06-13 · HEAD `0b8a56e7` · code-grounded, plan-only. Target: **every customer-facing storefront route renders through Liquid; React removed after validation** (Constitution ART-17/18, R-15). Checkout remains the engine-agnostic hosted React origin (Constitution §234) — that is constitutional, not hybrid.

## 0. Invariants every phase preserves (Constitution)

- **Foundation freeze** — no new services/apps; `runtime-composition` unwired-then-deleted only (ART-18).
- **Money** — canonical double-entry ledger untouched; checkout/payments path unchanged.
- **Identity** — `identity-platform` sole asymmetric issuer; customer sessions stay HS256; no issuer added.
- **Tenancy** — RLS+GUC untouched.
- **Governance** — the Liquid default-flip only through the parity/security/perf gate; React deleted only at the hardening-wave data decision. Validator edits are lockstep + ARB-authorized for the flip.
- **Commit seam (C0)** — sandbox can't commit; a human commits each phase. Gate's untracked-migration guard applies to L1/L15 migrations.

## 1. Phases L0–L17

Per phase: **Obj · Deliverables · Deps · Files · Validators · Tests · Rollback · Success · Effort · Risk.**

### L0 — Repository Truth Lock · 2–3d · Risk: L
Obj: ratify Full-Liquid scope + ARB pre-read of the parity/flip gate. Deliv: signed scope + ART-17 gate criteria. Deps: none. Files: docs. Validators: none (flag stays false). Tests: n/a. Rollback: n/a. Success: ARB exit criteria written.

### L1 — Bundle Persistence · 3–5d · Risk: M
Obj: urban-kicks ships a real Liquid bundle. Deliv: `LiquidThemePackageBundle` (built from `createLiquidParitySectionFiles` `theme-bundle.ts:769`) seeded into `themes.default_template`+`config`; install auto-propagates to `sites.template_config` (`theme-execution.adapter.ts:601-607`). Deps: L0. Files: `database/supabase/seeds/urban-kicks-theme.sql`; migration `171_*` (backfill); build script. Validators: `sequential-migration`, `migration-safety`, `LiquidThemePackageBundleSchema`. Tests: seed parses as liquid bundle; install-carries-bundle. Rollback: revert seed → React fallback. Success: test store has schema-valid `liquidBundle`; canary off.

### L2 — CSS Pipeline · 1wk · Risk: M
Obj: Liquid pages are styled. Deliv: `:root` token block in `layout/theme.liquid` (port `layout.tsx:126-160`); extract `lb-*` CSS from `globals.css:554-710` to a served asset (+~10% new for `lb-spotlight`/`lb-badge`); `/assets/*` route + `<link>` injection from `renderer.assets`. Deps: L1. Files: `theme-bundle.ts`, `theme-renderer.ts`, new `/assets/[file]/route.ts` or R2 binding, extracted CSS. Validators: `theme-governance-validator:88-97` (sanitizer), `cloudflare-binding` if R2. Tests: layout emits `:root`+stylesheet surviving DOMPurify. Rollback: revert → unstyled. Success: styled Liquid home on canary store.

### L3 — Theme Authoring Completion · 2–3wk · Risk: H
Obj: deepen Liquid sections to React parity + build the portable→Liquid compiler. Deliv: `compilePortableToLiquidBundle()` (`packages/theme-engine/src/portable-to-liquid.ts`); section depth/responsive; bundle satisfies strict schema. Deps: L1. Files: theme-engine. Validators: `LiquidThemePackageBundleSchema`, `theme-governance-validator`. Tests: compiler round-trip; section render parity. Rollback: keep imported-bundle-only authoring. Success: a portable template compiles to a rendering Liquid bundle. *(Longest single build; on critical path only if merchant Liquid editing ships at Open Beta.)*

### L4 — Liquid Chrome (Header/Footer/Nav) · 1wk · Risk: M
Obj: kill CAP-C08; nav menus in Liquid. Deliv: switch `layout.tsx:214,224` from React `StorefrontSectionGroupRenderer` to Liquid header/footer; bind `navigation_menus` (`000_baseline.sql:9855`) into the Liquid header section. Deps: L2. Files: `layout.tsx`, `theme-bundle.ts` header/footer sections. Validators: `storefront-seo-access-validator:12`. Tests: Liquid chrome + nav render; SEO asserts hold. Rollback: revert to React chrome. Success: a Liquid page is fully Liquid-chromed.

### L5 — Product Templates · 3–5d · Risk: M
Obj: `/product/:id` renders a Liquid `product` template. Deliv: `product` template + section (orphaned `product-detail.liquid` `theme-bundle.ts:1029` adopted); variant→price recompute (`liquid-hydration-islands.tsx`); real product drop. Deps: L1,L2,L4. Files: `theme-bundle.ts`, islands, `composition-engine.tsx`. Validators: schema. Tests: `{{ product.title }}`/images/price bind from real `ProductModel`; variant repricing. Rollback: route→index fallback. Success: product page Liquid w/ working add-to-cart.

### L6 — Collection Templates · 3–5d · Risk: M
Obj: `/collections/:slug` Liquid. Deliv: `collection` template; fill `collection` drop (title/desc, `composition-engine.tsx:301-308`); `{% for item in collection.products %}`. Deps: L5. Files: `theme-bundle.ts`, `composition-engine.tsx`. Tests: collection title + product loop bind. Rollback: index fallback. Success: collection page Liquid.

### L7 — Search Templates · 3–5d · Risk: M
Obj: Liquid search. Deliv: `search` template + results binding; **decide search backend** — keep client-side filter (port to Liquid) or add a real `/storefront/:sub/search` product endpoint (none exists today). Deps: L6. Files: `theme-bundle.ts`; optional gateway search route. Validators: `domain-boundary` if a route added. Tests: search renders results. Rollback: client-filter only. Success: `?search=` returns a Liquid results page. *(Smallest backend gap in the program.)*

### L8 — Cart Migration · 3–5d · Risk: M
Obj: full-page Liquid cart. Deliv: `cart` template; optional server cart-drop injection (token cookie→GET `/cart/:token` `cart-routes.ts:460`). Backend complete. Deps: L5. Files: `theme-bundle.ts`, optional `composition-engine.tsx`. Tests: Liquid cart shares `lb_cart` state; add→cart→checkout-link. Rollback: React cart page. Success: `/cart` Liquid.

### L9 — Customer Registration · 3–5d · Risk: M-H
Obj: Liquid login+register. Deliv: `customers/login`+`customers/register` templates over `/api/customer/*`; **depends on LB-12** (register endpoint + the broken `set_password` fix). Deps: L4; LB-12. Files: `theme-bundle.ts`. Validators: customer-engagement contract tests. Tests: register/login render + mint customer session (HS256, no issuer added). Rollback: React account sheet. Success: register→logged-in on Liquid. *(Auth surface — preserve issuer model.)*

### L10 — Customer Accounts · 1wk · Risk: M
Obj: account pages Liquid. Deliv: `customers/account|addresses|settings|wishlist` templates over existing `/api/customer/*`; `customer` drop fill (`:323`) or client-hydrate; **build a wishlist island**. Deps: L9. Files: `theme-bundle.ts`, islands. Tests: account CRUD render; auth-gated. Rollback: React account. Success: account pages Liquid.

### L11 — Orders · 3–5d · Risk: M
Obj: order history + detail Liquid. Deliv: order-history + `customers/order` templates over `/api/customer/orders` + `/api/orders/{check,login,set-password}`. Deps: L10. Files: `theme-bundle.ts`. Tests: order data binds. Rollback: React orders. Success: orders Liquid.

### L12 — Order Tracking · 3–5d · Risk: M
Obj: order-status timeline Liquid. Deliv: order-status template (4-step timeline + tracking number). Deps: L11. Files: `theme-bundle.ts`. Tests: status/tracking render. Rollback: React tracking. Success: tracking Liquid.

### L13 — Theme Customization · 1wk · Risk: M-H
Obj: merchant edits a Liquid theme via the editor. Deliv: wire L3 compiler into the editor (`buildDraftConfig`/`handlePublish` emit `liquidBundle`+`liquidRenderingCanary`; routes already accept them `editor/route.ts:29-40`); editor preview renders Liquid; engine-desync guardrail. Deps: L3. Files: `apps/merchant-control-plane/.../editor/page.tsx`, editor routes. Tests: edit→publish Liquid bundle→renders. Rollback: portable-JSON authoring (imported Liquid still renders). Success: merchant edit publishes a Liquid bundle. *(Deferrable if Open Beta ships one fixed Liquid theme.)*

### L14 — Parity Validation · 1–2wk · Risk: M
Obj: green the 200-cell matrix. Deliv: executed `scripts/liquid-parity/run-parity-matrix.mjs` on staging; real render/island tests replacing grep; `THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT=20` satisfied; security (DOMPurify) + perf harness. Deps: L4-L12. Files: `PARITY_MATRIX.md` (cells→PASS), new tests. Validators: `theme-governance-validator:69-72,108-109`. Tests: the harness itself + per-section render parity vs React. Rollback: flag off. Success: no red cell (the ART-17 flip gate).

### L15 — Canary Rollout · 3–5d + soak · Risk: M
Obj: per-store canary writer + cohort flip. Deliv: write `liquidRenderingCanary` (template_config or a `sites.liquid_rendering_canary` column) + operator endpoint; flip 1→N. Deps: L14 green. Files: `theme-execution.adapter.ts`, optional migration, `store-service.ts:655`, operator route. Validators: `sequential-migration` if column. Tests: canary flips one store Liquid; others React. Rollback: canary off → instant React revert. Success: pilot store full Liquid in prod, default off.

### L16 — Production Rollout · human + ~1wk soak · Risk: M-H
Obj: Liquid default for the cohort/platform. Deliv: ARB moves `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` off `deferred` (`theme-governance.ts:16-21`) + lockstep edit `theme-governance-validator:57-67`; cohort expansion; monitoring via `X-Lb-Render-Engine` (`proxy.ts:171`). Deps: L15 soak clean. Validators: governed flip (ARB-authorized). Tests: cohort smoke + rollback drill. Rollback: default/canary off. Success: cohort on Liquid in prod; money/identity/tenancy unaffected.

### L17 — React Decommission · 1–2wk · Risk: M
Obj: remove the React storefront render layer (R-15 one-renderer end-state). Deliv: staged archival per `REACT_DELETION_EXECUTION_PLAN.md` (chrome→sections→registry/branch→bespoke pages→contexts→`runtime-composition`), each with lockstep validator edit. Deps: **every route Liquid + parity green + production soak + the hardening-wave data decision (ART-17)**. Files: per deletion plan; archive to `docs/archive/dead-code/`. Validators: edit `no-new-react-sections`, `theme-governance-validator` (count==20→0), `typescript-dead-source-validator:141` (product-details lock), `domain-boundary:209` (route count) as each goes. Tests: full gate + E2E after each batch; money/identity/tenancy validators stay green (untouched). Rollback: restore archive + revert validator edits (React was frozen-present until now). Success: one canonical renderer (Liquid); React storefront render layer gone; checkout React origin retained.

## 2. Dependency graph

```
L0
└─ L1 ──┬─ L2 ──┬─ L4(chrome/nav) ─┬─ L5(product) ─┬─ L8(cart)
        │       │                  ├─ L6(collection)│
        │       │                  └─ L7(search)    └─ L9(register←LB-12) ─ L10(account) ─ L11(orders) ─ L12(tracking)
        └─ L3(compiler) ───────────────────────────── L13(theme customization)
                                                       
   [L5..L13 templates] ─ L14(parity) ─ L15(canary) ─ L16(ARB flip) ─ L17(React delete ← hardening-wave data decision)
```

## 3. Critical path

`L0 → L1 → L2 → L4 → L5 → L6 → L8 → L14 → L15 → L16 → L17`. L3/L13 (compiler + merchant customization) is a **parallel branch** that only joins the critical path if merchant Liquid editing must ship by Open Beta; otherwise it floats. L9-L12 (register/account/orders/tracking) parallelize against L5-L8 once L4 lands, because they're independent templates over existing backends — they gate Closed Beta, not Internal.

## 4. Parallelization

- **After L4**, split template authoring across engineers: Eng A = product/collection/search (L5-L7); Eng B = cart/account/orders/tracking (L8-L12); Eng C = compiler+customization (L3/L13). All consume the same EA backends and the same bundle, so they don't collide except in `theme-bundle.ts` (coordinate section-fixture additions).
- **L14 parity** is partly parallelizable per section once each template lands (don't wait for all).
- **L1+L2** are the serial unlock — nothing parallelizes before them.

## 5. Multi-agent execution strategy (for the build, when authorized)

One **orchestrator** + per-phase **executor** agents that each: read the phase contract here → implement in a worktree → run the phase's tests + gate → produce evidence → human commits (C0). A standing **parity agent** runs `run-parity-matrix.mjs` per merged template and updates `PARITY_MATRIX.md`. A **governance agent** verifies each commit keeps money/identity/tenancy validators green and applies the lockstep validator edits for L17. No agent flips the ARB gate (human) or deletes React before the data decision.

## 6. Milestone map

| Milestone | Phases | ~Week | Readiness |
|---|---|---|---|
| M1 Styled Liquid browse on canary | L0-L2,L4-L6 | 3-4 | Internal |
| M2 Full buyer journey Liquid | L7-L12 | 7-8 | Closed Beta |
| M3 Parity green + customization | L3,L13,L14 | 9-10 | Open Beta |
| M4 Liquid default in prod | L15,L16 | 10-12 | Production |
| M5 React removed | L17 | 12-14 | End-state (R-15) |

## 7. Risk matrix

| Phase | Risk | Driver | Mitigation |
|---|---|---|---|
| L3 compiler | **H** | net-new portable→Liquid; longest pole | defer if one fixed Liquid theme at Open Beta |
| L9 register | **M-H** | auth surface + depends on LB-12 | reuse customer-session; land LB-12 first |
| L16 ARB flip | **M-H** | human governance gate, not schedulable | pre-align in L0; parity evidence ready |
| L14 parity | M | 0/200 today, must execute harness | parallelize per section; real tests not grep |
| L2 CSS | M | asset serving + sanitizer interaction | CSS already exists (extract); verify `<style>`/`<link>` survive DOMPurify |
| L1 seed | M | untracked-migration guard (C0) | human commit; build from `createLiquidParitySectionFiles` |
| L17 delete | M | validator lock-web | lockstep edits; React frozen-present until proof |
| Money/identity/tenancy | **L** | untouched by render layer | no phase edits `api-gateway` money/auth/tenancy |

## 8. Timeline

~**10–12 weeks to Production Full Liquid**, ~**12–14 weeks to React fully deleted** (2–3 engineers + 1 founder/ARB), gated by parity proof and the constitutional ARB/hardening-wave acts. No backend rebuild.

---

## FINAL ANSWER — shortest safe path to Full Liquid V1 with React removable after validation

**Seed → style → chrome → templates → parity → flip → delete**, on the existing engine-agnostic backends:

1. **L0–L2 (wk 1–2, serial unlock):** ratify scope + ARB criteria; seed urban-kicks with a real Liquid bundle (the lever: `themes.default_template` carrying a bundle auto-propagates to live stores); ship the CSS pipeline (the `lb-*` styles already exist in `globals.css:554-710` — extract + serve). Nothing renders styled Liquid before these.
2. **L4–L12 (wk 3–8, parallel templates over existing APIs):** Liquid chrome+nav (kill CAP-C08), then product/collection/search and cart/register/account/orders/tracking — all authored over the **already-built, engine-agnostic** cart/account/order backends. Checkout stays the constitutional hosted React origin. (L3/L13 merchant-authoring compiler runs as a parallel branch; defer if one fixed Liquid theme suffices for Open Beta.)
3. **L14 (wk 9–10):** execute the parity/security/perf harness to green — this is the ART-17 gate and the proof that authorizes the flip and (later) deletion.
4. **L15–L16 (wk 10–12):** per-store canary → clean soak → **ARB platform-flip** (human, the constitutional gate). Liquid is now the default; React is present-but-frozen as the instant rollback (canary off = revert, no redeploy).
5. **L17 (wk 12–14):** after the **hardening-wave data decision** (ART-17) and the five deletion proofs, stage-delete the React storefront render layer behind lockstep validator edits, leaving **one canonical renderer (Liquid)** per R-15 — checkout's React hosted origin retained.

**This preserves every guarantee by construction:** the migration touches only `apps/storefront-runtime` render + `packages/theme-engine` + theme seeds; money (canonical ledger), identity (sole issuer), tenancy (RLS+GUC), and the hardened checkout path are never edited. React is the rollback throughout and is deleted **only after** Full Liquid is parity-proven and the constitutional data decision is recorded — which is exactly the Constitution's own sequence (ART-17: "deleted-or-frozen by data at the hardening wave").

*Two standing caveats (repository truth): the sandbox commit seam (C0) means a human commits each phase, and the ARB flip (L16) + hardening-wave decision (L17) are human governance acts — neither is schedulable by engineering. Parity is 0/200 today, so L14 is unavoidable and gates everything downstream.*
