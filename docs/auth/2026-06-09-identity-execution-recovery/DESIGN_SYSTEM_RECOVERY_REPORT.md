# DESIGN SYSTEM RECOVERY REPORT
### Wave 2 — Design System Recovery · 2026-06-09 · STATUS: specified, not applied (build-gated) · architecture FROZEN

> **Honest status.** This wave = delete the 1,986-LOC shadow `globals.css`, convert 5 shadow pages (`login`, `lookup`, `signup`, `onboarding`, `select`) to `@letbuyy/ui`, remove 76 `unstyled` usages + 42 inline styles, and build the missing DS-native surfaces. **None of this was applied**, deliberately: it cannot be compile/visual-verified in this sandbox (`pnpm`/app deps absent), and a blind partial conversion would leave the app **non-building** — violating the binding "leave the repository buildable" constraint. Applying it requires the iterative human build/visual-diff loop. The complete, file-referenced conversion spec already exists and is the source of truth: `IDENTITY_RECOVERY_ENHANCEMENT/IDENTITY_UI_ARCHITECTURE.md` + `docs/auth/2026-06-09-identity-execution-recovery/IDENTITY_UI_RECOVERY_PLAN.md` + `IDENTITY_DESIGN_SYSTEM_ENFORCEMENT.md`.

## Applied adjacent to this wave
- `--purple` token bug fixed (see `THEME_COMPLIANCE_REPORT`) — the only DS/theme change safely applicable in isolation.
- The DS-enforcement CI gates are staged in `GOVERNANCE_ENFORCEMENT_REPORT` (flip to `error` *after* conversion).

## Conversion plan (binding sequence — apply under human build)
1. Extract `AuthShell` (top bar + i18n) — removes 8× duplication (CD-S1-1). 2. Convert `login` (+merge `lookup`) → DS; delete the matching `.auth-*` classes. 3. `signup` → DS (fix OTP a11y, dead links). 4. `onboarding` steps 4-6 → DS (remove 33 inline styles, orphan `.auth-label`/`.auth-input`). 5. `select` → DS. 6. Build missing surfaces DS-native (MFA, passkey, consent, session/device/org/team mgmt, security dashboard). 7. Delete shadow `globals.css` (1,986 → ~300). 8. Flip lint to `error` + add `unstyled` ban + stylelint + line-count budget.

## Metrics
- Current DS compliance: **~45%** (measured: 76 `unstyled`, 42 inline, 426 px, 60 rgb, 0 hex in TSX). Target **≥95%**.
- **Delta this wave: +0%** (no conversion applied) — except 1 broken theme token fixed.
- LOC impact when executed: ≈ −1,700 (shadow CSS) / +structured DS usage; ~640 page-dup LOC removed.

## Risk / decision / remaining debt
**Decision:** do not apply blind; this is the canonical example of work that must be build-verified iteratively. **Risk of the deferral:** none to current state (the bug fix is a net improvement); the shadow system persists until the human conversion. **Remaining debt:** the entire conversion (CD-S0-1, UI-1, DS-1/2). **Human-required:** a developer with the workspace toolchain to run the convert→`pnpm build`→visual-diff loop per page. `[SKIPPED FOR FUTURE]` in sandbox (no build).
