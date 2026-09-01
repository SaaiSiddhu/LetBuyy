# ARB FLIP PACKET (L16)

**Date:** 2026-06-13 · **HEAD:** `cf4f6f6f` · For ARB review. **Human sign-off required — no automation may flip.**

## Decision requested
Move `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status` from `'deferred'` to an approved state (`theme-governance.ts:16-21`). Constitution **ART-17** forbids a platform-wide flip "without the parity/security/perf gate" — this packet is that gate's evidence dossier.

## The exact change (in lockstep, one commit, after sign-off)
1. `packages/theme-engine/src/theme-governance.ts` — set the flip decision to approved (record signer + date).
2. `scripts/validators/theme-governance-validator.mjs` — update the pinned expectation **in the same commit** (it currently `process.exit(1)`s if the flip is not `deferred`/OFF). Do **not** weaken any other check.
3. Per-store canary stays the rollout control; platform default flips only after the canary window is clean.

## Evidence dossier (each item must be GREEN before sign-off)
| Evidence | Status today | Source |
|---|---|---|
| Engine render parity | ✅ green | `PARITY_REPORT.md`, theme-engine 56/56 |
| Cross-engine parity (matrix) | ⏳ pending-staging | `PARITY_EXECUTION_PACKET.md` (`HR-LIQUID-PARITY-STAGING`) |
| Canary metrics + rollback | ⏳ pending-deploy | `CANARY_EXECUTION_PACKET.md` (`HR-LIQUID-CANARY-DEPLOY`) |
| Security (sanitizer un-weakened) | ✅ green | DOMPurify forbid-list + `outputEscape:'escape'` intact; escaping tests across L2/L5–L12 |
| Performance | ⏳ pending-staging | render within `renderLimit 250`/`parseLimit 300000`; verify cached read latency on staging |
| Validators | ✅ green | governance gate 107/107 |
| Tests | ✅ green | theme-engine 56/56, launch suite 111/111 |

## Rollback
Instant: per-store canary flag → false (React). Platform: revert the flip-decision commit. No data migration involved.

**Status: BLOCKED on ARB sign-off + the two pending-staging/deploy evidence rows (`HR-LIQUID-ARB-FLIP`).**
