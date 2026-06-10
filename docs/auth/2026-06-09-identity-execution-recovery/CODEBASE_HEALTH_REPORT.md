# CODEBASE HEALTH REPORT
### Wave 5 — Codebase Health · 2026-06-09 · STATUS: inventory + safe applied subset · architecture FROZEN

> Goal: remove dead files/routes/components/utilities/CSS/assets; fix import cycles, boundary violations, lint, types. **Removals are build-gated** (deleting a file that's transitively imported breaks the build, unverifiable here), so this wave delivers a verified dead-code *inventory* + the safe applied items; bulk removal is staged for the human build loop.

## APPLIED (safe)
- One duplicate prod-detection fork removed (`cookies.ts` now reuses `isProductionIdentityRuntime`) — see `FOUNDATION_CONSOLIDATION_REPORT`.
- `--purple` orphan-token resolved (`THEME_COMPLIANCE_REPORT`).
- Added regression gate + test (net new, additive).

## Dead/duplicate inventory (verified this pass — candidates for removal under build)
| Item | Evidence | Safe to delete? |
|---|---|---|
| Legacy Supabase auth backend (~160 LOC) | gw `routes/auth.ts:1214-1372` | Wave 7 (zero-traffic gate) — not yet |
| In-memory auth fallback Maps | gw `routes/auth.ts:82-85,925,1058` | needs build (touches live fallback logic) |
| Shadow `.auth-*` stylesheet (~1,700 deletable LOC) | `globals.css` | as pages convert (Wave 2) |
| `login`≈`lookup` clone (282 LOC) | both pages | on merge (Wave 3) |
| Dual CSRF `lb_csrf` read | `csrf.ts:22`, `csrf-client.ts:12` | after gateway coordination (Wave 1 spec) |
| Orphan classes `.auth-label`/`.auth-input` | `onboarding:885,950` | on onboarding conversion |

## Boundary / type / lint
- **Boundary:** the frozen target's Identity↔Commerce rule (no cross-boundary SQL) is documented in `IDENTITY_OWNERSHIP_MATRIX`; current `service_role` BYPASSRLS violation is Wave 8 (SEC-H1). No new boundary code added this wave.
- **Imports/cycles:** the applied edits add only acyclic imports (`cookies.ts`→`dev-auth-bypass.ts`; `switch`→existing libs); no cycle introduced (verified by inspection).
- **Types/lint:** edits written type-correct by inspection; full `tsc`/eslint not runnable here (no app deps).

## Status / debt / human-required
- **Applied delta:** small/safe (consolidation + bug fix + tests/gate). **Bulk dead-code removal: deferred** to the build loop — removing files blind would break the app (violates "leave buildable").
- **Human-required:** developer + `pnpm build`/`test` to execute the removals from the inventory above. `[SKIPPED FOR FUTURE]` in sandbox.
