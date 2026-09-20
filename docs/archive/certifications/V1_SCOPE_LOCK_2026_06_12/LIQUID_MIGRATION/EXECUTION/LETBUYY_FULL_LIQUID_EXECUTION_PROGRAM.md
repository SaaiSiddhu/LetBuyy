# LETBUYY_FULL_LIQUID_EXECUTION_PROGRAM.md

**The execution program — Full Liquid V1 (L0→L18).** HEAD `140a73db` · plan-only. Per-phase 20-section contracts live in `../PHASES/PHASE_L*.md`; this is the execution layer adding Human/ARB gates, effort, and the run protocol. Reads: Constitution, AGENTS, CLAUDE, the 8 `LIQUID_COMPLETION_*` docs, `CHECKOUT_BOUNDARY_DECISION.md`, `THEME_COMPILER_CONTRACT.md`.

## Run protocol (every phase, no exception)

`read PHASE_L<n>.md → implement in worktree → run governance gate (node scripts/validate-governance.mjs --lane=gate) + phase tests + typecheck → MUTATION-test the phase's critical validator (inject a violation, assert it fails; restore, assert it passes; record the probe transcript) → collect evidence → append EXECUTION_LEDGER row → human commit (C0) → proceed`. **No phase advances on red.** Critical validators per phase are mutation-tested (the repo's existing pattern: see `FOUNDATION_CLOSURE_2026_06_12/evidence/*/probe-transcript.txt`).

## Phase blocks

Each: Purpose · Current · Target · Deps · Files · Validators · Tests · Evidence · Rollback · Exit · Success · Human Gates · ARB Gates · Risk · Effort.

### L0 Foundation Freeze
Purpose: ratify scope+gates. Current: implicit in Constitution. Target: signed scope + L14/L16/L17 criteria. Deps: —. Files: docs. Validators: theme-governance (stays green). Tests: n/a. Evidence: signed scope. Rollback: n/a. Exit/Success: ARB acknowledges gates. Human: scope sign-off. ARB: gate criteria. Risk: L. Effort: 2-3d.

### L1 Bundle Persistence
Purpose: seed urban-kicks Liquid bundle. Current: no store carries a bundle. Target: `themes.default_template` carries a schema-valid bundle; install propagates. Deps: L0. Files: `seeds/urban-kicks-theme.sql`, mig `171_*`, build script. Validators: sequential-migration, migration-safety, LiquidThemePackageBundleSchema. Tests: seed parses; install-carries-bundle. Evidence: bundle JSON + passing tests. Rollback: revert seed → React. Exit: install-carries test green + gate green. Success: canary store has valid bundle. Human: commit (C0). ARB: —. Risk: M. Effort: 3-5d.

### L2 Asset Pipeline
Purpose: styled Liquid. Current: no CSS. Target: `:root` + `lb-*` stylesheet served. Deps: L1. Files: `theme-bundle.ts`, `theme-renderer.ts`, `/assets/[file]/route.ts`, extracted CSS. Validators: theme-governance:88-97 (sanitizer). Tests: styled-render survives DOMPurify. Evidence: styled render + asset headers. Rollback: revert → unstyled. Exit/Success: styled canary home. Human: commit. ARB: —. Risk: M. Effort: 1wk.

### L3 Theme Compiler
Purpose: portable→Liquid (per `THEME_COMPILER_CONTRACT.md`). Current: none exists. Target: `compilePortableToLiquidBundle`. Deps: L1. Files: `portable-to-liquid.ts`, `theme-bundle.ts`. Validators: schema + forbidden-fragment guard. Tests: round-trip + golden + fuzz-reject. Evidence: compiler + tests. Rollback: import-only authoring. Exit/Success: portable compiles to rendering bundle. Human: commit. ARB: only if scope-creep toward runtime (STOP). Risk: H. Effort: 2-3wk. *(Branch; deferrable.)*

### L4 Liquid Chrome
Purpose: Liquid header/footer/nav; kill CAP-C08. Current: React chrome over Liquid. Target: Liquid chrome + nav bind. Deps: L2. Files: `layout.tsx:214,224`, `theme-bundle.ts`, `store-service.ts`. Validators: storefront-seo-access:12; theme-governance:114. Tests: chrome render + SEO. Evidence: Liquid chrome with nav. Rollback: revert to React chrome. Exit/Success: CAP-C08 satisfied. Human: commit. ARB: —. Risk: M. Effort: 1wk.

### L5 Product / L6 Collection / L7 Search
Purpose: product/collection/search Liquid templates over existing data. Current: no templates (index fallback); search client-only. Target: real templates+drops; variant→price. Deps: L4 (L6←L5, L7←L6). Files: `theme-bundle.ts`, `composition-engine.tsx`, islands; (L7 optional gateway search route). Validators: schema; (L7) domain-boundary if route added. Tests: data-binding renders (replace grep); variant repricing; search results. Evidence: rendered pages + tests. Rollback: remove template key → index/React. Exit/Success: pages render Liquid w/ live data. Human: commit. ARB: —. Risk: M. Effort: 3-5d each.

### L8 Cart
Purpose: Liquid cart page (backend exists). Current: drawer only. Target: `cart` template + signed handoff. Deps: L5. Files: `theme-bundle.ts`, optional `composition-engine.tsx`. Validators: schema; checkout-handoff contract. Tests: shared-state E2E; signed handoff. Evidence: cart render + handoff trace. Rollback: React cart page. Exit/Success: Liquid cart hands off via signed URL. Human: commit. ARB: —. Risk: M. Effort: 3-5d. **Boundary:** uses `/cart/:token/checkout-url` only (per `CHECKOUT_BOUNDARY_DECISION.md`); never rewrites checkout.

### L9 Registration
Purpose: Liquid login/register. Current: dead-end + broken set_password (LB-12). Target: register endpoint + Liquid auth templates. Deps: L4 + **LB-12**. Files: `theme-bundle.ts`; (LB-12) `customer-engagement-routes.ts`, proxy, api-client, context. Validators: domain-boundary 127→128 (lockstep); identity-sole-issuer; customer-engagement contract. Tests: register security (not-exists precond, Turnstile, rate-limit); session mint. Evidence: register→logged-in + security tests. Rollback: React sheet; revert route count. Exit/Success: shopper registers on Liquid; issuer unchanged. Human: commit; LB-12 land. ARB: —. Risk: M-H. Effort: 3-5d.

### L10 Accounts / L11 Orders / L12 Tracking
Purpose: account/order/tracking Liquid over existing `/api/customer/*` + `/api/orders/*`. Current: React; `customer:null` drop. Target: `customers/*` + order templates. Deps: L9→L10→L11→L12. Files: `theme-bundle.ts`, islands (wishlist), `composition-engine.tsx`. Validators: schema; order-service allow-list (reuse). Tests: auth-gated render; CRUD; order/tracking binds. Evidence: rendered pages + auth proof. Rollback: React pages. Exit/Success: tail renders Liquid; **every customer route Liquid-templated** (end of L12). Human: commit. ARB: —. Risk: M. Effort: 1wk/3-5d/3-5d.

### L13 Theme Authoring
Purpose: editor emits Liquid (uses L3). Current: portable-only. Target: editor emits bundle + preview Liquid. Deps: L3, L1-L12. Files: editor `page.tsx`+routes, preview. Validators: schema; existing theme-execution tests. Tests: edit→publish Liquid; desync guard. Evidence: edit→render trace. Rollback: portable authoring. Exit/Success: merchant edits Liquid. Human: commit. ARB: —. Risk: M-H. Effort: 1wk. *(Deferrable w/ one fixed theme.)*

### L14 Parity Program — **GATE**
Purpose: 200-cell parity green (ART-17). Current: 0/200. Target: all green incl. perf+security. Deps: L4-L13. Files: `PARITY_MATRIX.md`, new render/island/E2E tests. Validators: theme-governance:69-72,108-109. Tests: per section×10 dims + buyer-journey E2E + perf + security. Evidence: executed matrix + reports. Rollback: flag off (gate, not rollback). Exit: signed parity evidence. Success: no red cell. Human: —. **ARB: accepts parity as the flip precondition.** Risk: M. Effort: 1-2wk.

### L15 Canary
Purpose: per-store flip + soak. Current: flag unsettable. Target: canary writer + cohort. Deps: L14 green. Files: `theme-execution.adapter.ts`, `store-service.ts`, optional column mig, operator route. Validators: sequential-migration (if column); theme-governance (default stays false). Tests: flip one store; instant revert. Evidence: soak report (metrics) + rollback drill. Rollback: canary off (instant). Exit/Success: pilot store Liquid in prod, clean soak. Human: operator action; commit. ARB: —. Risk: M. Effort: 3-5d+soak.

### L16 Production Rollout — **ARB GATE**
Purpose: Liquid default for cohort/platform. Current: default off, ARB-deferred. Target: flip off `deferred`. Deps: L15 soak + L14 evidence. Files: `theme-governance.ts:14-21` + `theme-governance-validator.mjs:57-67` (lockstep, ARB-authorized). Validators: the governed flip. Tests: cohort smoke + rollback drill. Evidence: ARB decision record + dashboards. Rollback: default/canary off. Exit/Success: cohort Liquid by default; guarantees intact. **Human: ARB flip (the constitutional act).** ARB: yes. Risk: M-H. Effort: 1wk soak.

### L17 React Decommission — **HARDENING-WAVE GATE**
Purpose: delete React render layer (R-15) per `REACT_DELETION_EXECUTION_PLAN.md`. Current: React frozen-present. Target: render layer archived; checkout origin KEPT. Deps: L14+L15+L16 + **hardening-wave data decision**. Files: lock-web validators (lockstep), `layout.tsx`, `composition-engine.tsx`, archived sources, runtime-composition. Validators: no-new-react-sections, theme-governance count, typescript-dead-source:141, domain-boundary:209 — each edited in the deleting commit. Tests: full gate + E2E per batch; money/identity/tenancy stay green. Evidence: the 5 deletion proofs per surface. Rollback: archive-restore + revert validator edits; canary-off until last batch. Exit/Success: one renderer; checkout intact. **Human: hardening-wave data decision.** ARB: yes. Risk: M. Effort: 1-2wk.

### L18 Completion Certification
Purpose: certify Full Liquid. Current: (entry) Liquid default, React removed. Target: signed certification. Deps: L0-L17. Files: cert doc + evidence index. Validators: final full gate green. Tests: final E2E + money/identity/tenancy suites. Evidence: consolidated pack. Rollback: n/a. Exit/Success: certified; program closes. Human: sign-off. ARB: final accept. Risk: L. Effort: 2-3d.

## Effort rollup

Critical path ~10-12 wk to Production (L16), ~12-14 wk to React-removed (L17) + cert (L18). L3/L13 (~2-4 wk) is a parallel branch, deferrable. 2-3 engineers + founder/ARB.

## Invariants (every phase, non-negotiable)

No phase edits the canonical ledger, the sole-issuer identity model, RLS/tenancy, or the hosted checkout origin. The checkout React origin is KEEP-PERMANENT. React is deleted only after L14+L15+L16 + the hardening-wave decision + the 5 proofs + validated rollback.
