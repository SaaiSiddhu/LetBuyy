# PHASE L18 — LIQUID COMPLETION CERTIFICATION

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · plan-only. The terminal sign-off.

1. **Purpose.** Certify that LetBuyy V1 is Full Liquid: every customer-facing route renders Liquid, React render layer removed, all guarantees preserved — and record the evidence.
2. **Repository Reality.** Certification is documentary; it asserts the cumulative evidence of L0-L17 against the Constitution (ART-17/18, R-15) and the foundation invariants.
3. **Current State.** (At entry) Liquid default in production; React render layer decommissioned (L17); checkout React origin retained.
4. **Target State.** A signed `LETBUYY_LIQUID_V1_CERTIFICATION` asserting Full-Liquid completion + the preserved invariants.
5. **Files To Modify.** None.
6. **Files To Create.** The certification doc + the consolidated evidence index.
7. **Files To Delete.** None.
8. **Dependencies.** L0-L17 complete.
9. **Validator Impact.** Final full-gate run green at the post-deletion counts; one canonical renderer (R-15) asserted.
10. **Migration Impact.** None.
11. **Testing Requirements.** Final full storefront E2E on Liquid (browse→cart→register→checkout→account→orders→tracking); full gate; full money/identity/tenancy suites green.
12. **Performance Requirements.** Final perf report ≥ React baseline across Core Web Vitals + render latency.
13. **Security Requirements.** Final security attestation: sanitizer/escaping/limits intact; no XSS/CSP regressions over the soak.
14. **Tenancy Requirements.** Attest RLS intact on all render-read tables; no cross-tenant bleed observed.
15. **Identity Requirements.** Attest the sole-issuer model intact (merchant ES256/identity-platform; customer HS256); no new issuer.
16. **Money Requirements.** Attest the canonical ledger, refund/payout, COD, and the hosted checkout handoff are byte-unchanged by the migration; order success rate ≥ baseline.
17. **Rollback Plan.** N/A (certification). The canary/default flags remain as operational levers post-cert.
18. **Success Criteria.** All L0-L17 exit criteria met; the certification signed.
19. **Exit Criteria.** **Full Liquid V1 certified.** Program closes.
20. **Evidence Requirements.** The consolidated evidence pack: parity report (L14), production soak (L15/L16), deletion proofs (L17), final gate/E2E/perf/security/money/identity/tenancy attestations, and the ARB flip + hardening-wave decision records.
