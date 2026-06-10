# GOVERNANCE ENFORCEMENT REPORT
### Wave 6 — Governance Enforcement · 2026-06-09 · IMPLEMENTATION (applied) · architecture FROZEN

## APPLIED this wave
| Artifact | What it does | Evidence | Verified |
|---|---|---|:--:|
| **`scripts/governance/identity-security-gate.mjs`** (new, runnable, zero-dep) | Regression gate: fails CI (exit 1) if any Wave 0 security fix is reverted — asserts the `/switch` guards (rate-limit + `validateSession` + `getAccounts` + `isProvenAccount`), the console secret 3-env prod gate, the KMS production fail-closed, and the `lb_accounts` `isProductionIdentityRuntime` gate; also flags a revert of the console gate to NODE_ENV-only | new file (107 LOC) | **YES — executed here, exit 0, all 4 guards present** |

This is the one governance artifact I could **run and verify in this environment**. It turns each Wave 0 fix into a standing invariant.

## SPEC / to wire (config changes — safe but should land with a human build to confirm CI)
Detailed in `IDENTITY_DESIGN_SYSTEM_ENFORCEMENT.md §4` and `IDENTITY_GOVERNANCE_MODEL.md §4-5`:
- **CI wiring:** add `node scripts/governance/identity-security-gate.mjs` to the CI pipeline next to `node scripts/validate-governance.mjs`. (Pure addition; not wired blindly because I can't run the CI here to confirm placement.)
- **ESLint promotion:** flip `@letbuyy/ui/no-raw-form-controls`, `no-raw-color-functions`, `no-tailwind-default-color` from `warn`→`error` (`apps/identity-platform/eslint.config.mjs:14-22`) — **must follow Wave 2 conversion** (76 `unstyled` + violations would otherwise fail the build; flipping now would break it, violating "leave buildable"). Add a new rule banning `unstyled` on DS components in the identity surface.
- **Stylelint:** ban raw hex/rgb/px in app CSS; add a `globals.css` line-count budget gate (forces monotonic shrink).
- **Secret-literal scan:** extend the gate to forbid *new* `*_SECRET = '<literal>'` defaults (kept conservative now to avoid false positives on the existing intentional dev-only branches).

## Decision & risk
**Decision:** ship the runnable regression gate now (high value, zero risk, verified); stage the lint/stylelint promotions to land *after* the violations they'd flag are cleared (Wave 2), so CI stays green. **Risk:** none for the applied artifact; the deferred promotions are config-only and reversible.

## Remaining debt
ESLint/Stylelint promotions + CI wiring (one PR each, post-Wave-2).

## Human-required blockers
None. (CI wiring is a repo-config change the team applies in their CI system.)
