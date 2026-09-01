# PHASE L17 — REACT DECOMMISSION

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · plan-only. **Constitutionally gated — no deletion before the hardening-wave data decision (ART-17).**

1. **Purpose.** Remove the React storefront render layer so Liquid is the one canonical renderer (R-15), per the full `REACT_DELETION_EXECUTION_PLAN.md`.
2. **Repository Reality.** ART-17 (`:256`) forbids "deleting React before the data decision at the hardening wave." A validator lock-web protects React: `no-new-react-sections-validator.mjs:9-30` (frozen Set of 20), `theme-governance-validator.mjs:69-72,98-101` (parity==20 + count==20), `typescript-dead-source-validator.mjs:141-144` (hard `exists()` on `product-details-client.tsx`), `domain-boundary-validator.mjs:209` (route count==127). Governed deletion = archive to `docs/archive/dead-code/` + de-reference + lockstep validator edit (same commit).
3. **Current State.** React present, frozen, serving as rollback; Liquid is default (L16).
4. **Target State.** React storefront render layer archived/removed; `runtime-composition` package unwired then deleted (ART-18:260); checkout React origin retained.
5. **Files To Modify.** The lock-web validators (each, in lockstep as artifacts go); `layout.tsx:210-214,224` (remove React chrome + providers); `composition-engine.tsx` (strip the React branch).
6. **Files To Create.** Archive copies under `docs/archive/dead-code/`.
7. **Files To Delete.** 20 `components/sections/*.tsx`; `renderer-registry.tsx`; `editor-preview-section-frame.tsx`; bespoke pages `cart/`, `account/*`, `orders/*`, `product-details-client.tsx`, policy pages; `cart-context`/`customer-auth-context`/`wishlist-context`; `runtime-composition` package. **NOT** checkout (`checkout-client.tsx` — constitutional hosted origin).
8. **Dependencies.** **Every** route Liquid (L4-L13) + L14 parity green + L16 production soak + **the hardening-wave data decision**.
9. **Validator Impact.** Each deletion edits its lock in the same commit: section Set, parity/count asserts, the product-details `exists()` lock, the 127 route count. Money/identity/tenancy validators are untouched (and must stay green).
10. **Migration Impact.** None (render-layer code only).
11. **Testing Requirements.** Full gate green at the new counts after each batch; full storefront E2E on Liquid after each deletion; no money/identity/tenancy validator regression.
12. **Performance Requirements.** Smaller bundle/build after deletion; verify no latency regression; React removal must not change ISR/cache behavior of Liquid.
13. **Security Requirements.** No security surface change (deletions only); confirm no dangling imports re-expose removed paths.
14. **Tenancy Requirements.** Unchanged — deletions are render-layer; RLS untouched.
15. **Identity Requirements.** Unchanged — issuer model untouched; deleting `customer-auth-context` only after Liquid auth (L9/L10) is the sole consumer.
16. **Money Requirements.** **Checkout React origin is KEPT** (constitutional); no money-path file is deleted; ledger untouched.
17. **Rollback Plan.** Restore from `docs/archive/dead-code/` + revert the lockstep validator edits; canary-off remains available until the very last batch. Staged so any batch reverts independently.
18. **Success Criteria.** One canonical renderer (Liquid); React storefront render layer gone; gate green at new counts; buyer journey fully Liquid; checkout origin intact.
19. **Exit Criteria.** All deletion batches merged; `runtime-composition` unwired+deleted; R-15 (one renderer) satisfied.
20. **Evidence Requirements.** Per-batch: the parity proof for the surface, the production soak evidence, the recorded hardening-wave data decision, and the green gate at the new validator counts (the 5 proofs from `REACT_DELETION_EXECUTION_PLAN.md`).
