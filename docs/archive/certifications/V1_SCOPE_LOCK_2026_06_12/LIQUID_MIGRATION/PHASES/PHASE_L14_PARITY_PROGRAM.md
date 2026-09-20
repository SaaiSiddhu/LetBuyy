# PHASE L14 — PARITY VALIDATION PROGRAM

**Program:** Full Liquid V1 · **HEAD:** `140a73db` · plan-only. **The constitutional flip/deletion gate (ART-17).**

1. **Purpose.** Prove Liquid matches React across all surfaces — the parity/security/perf harness ART-17 requires before any default-flip (L16) or React deletion (L17).
2. **Repository Reality.** `LAUNCH_READINESS_2026_06_12/evidence/e-liquid-parity/PARITY_MATRIX.md` = **200 cells PENDING** (20 sections × 10 dimensions); harness `scripts/liquid-parity/run-parity-matrix.mjs` exists but never executed; the only real render test asserts XSS escaping (no data-binding proof); islands have zero behavioral coverage. `THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT=20` (`theme-governance.ts:15`).
3. **Current State.** 0/200 executed; tests grep-only.
4. **Target State.** All cells green (or explicitly accepted) on staging; real render + island + data-binding tests; security (DOMPurify/escaping) + perf harness pass.
5. **Files To Modify.** `PARITY_MATRIX.md` (cells → PASS); `theme-governance-validator.mjs` expectations if the harness gates the gate.
6. **Files To Create.** Real tests under `tests/theme-engine/` + `tests/contracts/` (render parity per section, island behavior, data binding) replacing grep-only.
7. **Files To Delete.** None.
8. **Dependencies.** L4–L13 (every template + the compiler).
9. **Validator Impact.** `theme-governance-validator.mjs:69-72,108-109` (parity count + test presence); the harness becomes the evidence for the L16 flip.
10. **Migration Impact.** None (staging runs).
11. **Testing Requirements.** Per section × 10 dimensions: rendering, data bindings, editor round-trip, preview, checkout handoff, SEO/meta, performance, accessibility, empty/error states, mobile editor. Plus island behavior (add-to-cart→server, variant→price, drawer) and full buyer-journey E2E on Liquid.
12. **Performance Requirements.** A perf dimension is mandatory — render latency, payload size, and ISR behavior must meet/beat the React baseline; any regression is a red cell.
13. **Security Requirements.** A security dimension is mandatory — DOMPurify escaping, no inline-style/script leakage, `content_for_header` safety; any failure is a red cell (blocks the flip).
14. **Tenancy Requirements.** Parity runs against tenant-scoped fixtures; verify no cross-store data bleed in rendered output.
15. **Identity Requirements.** Auth-gated pages (account/orders) validated under a real customer session in parity.
16. **Money Requirements.** Checkout-handoff dimension validated — the Liquid cart hands off via the signed URL identically to React; no money behavior change.
17. **Rollback Plan.** N/A (validation only); keep the flag off until green. A red cell blocks progression — it does not roll back, it gates.
18. **Success Criteria.** **No red cell** across the required surface; real tests (not grep) green; perf + security dimensions pass.
19. **Exit Criteria.** The executed parity report is the signed ART-17 evidence authorizing L16; ARB accepts it.
20. **Evidence Requirements.** The executed `PARITY_MATRIX.md` (all PASS); the new render/island/E2E test results; the perf + security harness reports.
