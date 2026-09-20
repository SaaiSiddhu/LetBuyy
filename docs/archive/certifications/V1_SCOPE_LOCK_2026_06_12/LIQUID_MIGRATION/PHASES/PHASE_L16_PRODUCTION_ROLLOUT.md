# PHASE L16 — PRODUCTION ROLLOUT

**Program:** Full Liquid V1 · **HEAD:** `140a73db` · plan-only. **Contains the human ARB governance act.**

1. **Purpose.** Make Liquid the default renderer for the cohort/platform — the constitutional platform-wide flip.
2. **Repository Reality.** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` (`theme-governance.ts:14`); platform flip is `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` `status:'deferred', authority:'ARB'` (`:16-21`); `theme-governance-validator.mjs:57-67` fails the gate unless these stay as-is. `proxy.ts:171` emits `X-Lb-Render-Engine` for monitoring.
3. **Current State.** Default off; flip ARB-deferred; only canary stores Liquid.
4. **Target State.** ARB moves the flip off `deferred`; Liquid is default for the target cohort/platform; React remains present (frozen) as rollback.
5. **Files To Modify.** `packages/theme-engine/src/theme-governance.ts:14-21` (flag/decision) **and** `scripts/validators/theme-governance-validator.mjs:57-67` (lockstep, ARB-authorized).
6. **Files To Create.** None.
7. **Files To Delete.** None (React stays — deletion is L17).
8. **Dependencies.** L15 soak clean; **L14 parity evidence** (the ART-17 gate).
9. **Validator Impact.** This is the one governed validator edit the program authorizes — the flip's asserts change **only** with ARB sign-off + the parity evidence; it is not an engineering-only change.
10. **Migration Impact.** None.
11. **Testing Requirements.** Cohort smoke (all routes Liquid); a rehearsed rollback drill (flip back) before broad expansion.
12. **Performance Requirements.** Platform-level dashboards: render latency p50/p95, error rate, ISR hit, Core Web Vitals ≥ React baseline; auto-alert thresholds.
13. **Security Requirements.** Post-flip security monitoring (no new XSS/CSP violations); the sanitizer/escaping invariants from L0 still asserted.
14. **Tenancy Requirements.** Flip respects per-store opt-out (canary off remains an override); no cross-tenant leakage at scale.
15. **Identity Requirements.** No issuer change; customer/merchant sessions unaffected by the render default.
16. **Money Requirements.** Order success rate and checkout-handoff integrity monitored as the primary money-safety signal during expansion; ledger untouched.
17. **Rollback Plan.** Re-set the default to `false` and/or canary-off per store — instant render-time revert; revert the validator/flag edit if needed.
18. **Success Criteria.** Target cohort on Liquid by default in production; money/identity/tenancy unaffected; metrics ≥ baseline over the soak.
19. **Exit Criteria.** Platform soak clean; ARB confirms the flip; the deletion gate (L17) prerequisites (parity + production proof) recorded.
20. **Evidence Requirements.** The ARB decision record (flip off `deferred`); the platform soak dashboards; the rollback-drill evidence.
