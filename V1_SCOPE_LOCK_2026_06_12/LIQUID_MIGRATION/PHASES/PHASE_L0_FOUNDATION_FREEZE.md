# PHASE L0 — FOUNDATION FREEZE LOCK

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · plan-only, no code. Shared conventions: "C0" = sandbox commit seam (human commits each phase); citations are file:line at HEAD; ART/R refer to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`.

1. **Purpose.** Ratify Full-Liquid scope and lock the constitutional gates before any render-layer change, so every later phase has an authoritative, code-true baseline and an agreed flip/deletion gate.
2. **Repository Reality.** ART-17 (`:253-256`) already crowns Liquid as canonical renderer and freezes React "at parity"; the Liquid default-flip is gated on a "parity/security/perf harness"; React deletion is forbidden "before the data decision at the hardening wave." `theme-governance-validator.mjs:57-67` pins `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` (`theme-governance.ts:14`) and the platform flip as `deferred`.
3. **Current State.** Decision implicit in the Constitution but not operationalized into a program; parity 0/200; no seeded Liquid bundle.
4. **Target State.** A ratified scope doc + ARB-agreed exit criteria for L14 (parity), L16 (flip), L17 (deletion). No source change.
5. **Files To Modify.** None.
6. **Files To Create.** Program docs only (this set). No repo source.
7. **Files To Delete.** None.
8. **Dependencies.** None (entry phase).
9. **Validator Impact.** None — the freeze stays asserted; `theme-governance-validator` must remain green (flag false).
10. **Migration Impact.** None (no DB).
11. **Testing Requirements.** None executable; deliverable is documentary sign-off.
12. **Performance Requirements.** N/A.
13. **Security Requirements.** Record the render-path security baseline to be preserved: DOMPurify `FORBID_TAGS:['base','embed','object','script']`+`FORBID_ATTR:['style']`+`WHOLE_DOCUMENT` (`theme-renderer.ts:108-163`), LiquidJS `outputEscape:'escape'`, `parseLimit 300000`/`renderLimit 250`/`memoryLimit 2_000_000` (`:316-336`).
14. **Tenancy Requirements.** Record that all render-read tables have RLS ENABLE (`sites`, `themes`, `theme_releases`, `store_themes`, `carts`, `store_customers`, `navigation_menus`); no phase may weaken this.
15. **Identity Requirements.** Record the issuer invariant: merchant ES256 via `identity-platform` (sole issuer); customer HS256 via `CUSTOMER_SESSION_SECRET`. No phase adds an issuer.
16. **Money Requirements.** Record that the render migration never touches the canonical ledger or the hosted checkout origin (§234); checkout stays React under any renderer.
17. **Rollback Plan.** N/A (no change).
18. **Success Criteria.** Scope + gates signed; the 5 invariants (§13-16 + freeze) documented as the immutable baseline.
19. **Exit Criteria.** ARB acknowledges the L14/L16/L17 gate criteria; program proceeds to L1.
20. **Evidence Requirements.** Signed scope doc; ARB pre-read referencing ART-17/18, R-15; the recorded invariant baseline.
