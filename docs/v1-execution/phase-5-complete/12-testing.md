# 12 — Testing

**Status: ✅ green — the strongest test posture of the V1 arc. No fake tests.**

| Check | Result |
|---|---|
| api-client / api-gateway / merchant-control-plane typecheck | ✅ all EXIT 0 |
| **Evaluator/core unit tests** | ✅ **97/97** — smart-collection 35 + automation-rule 36 + audit-variance 26 |
| `tests/launch/lb-phase5-commerce.test.mjs` | ✅ **20/20** (PO 4 + 5.5 ×5 + 5.75 ×3 + 5.9 ×4 + 5C ×4) |
| Full launch suite | ✅ **204/204** |
| Gateway unit suite | ✅ **410/413** — the +62 evaluator tests pass; the 3 fails are PRE-EXISTING + unrelated (AI route, analytics migration, storefront payment route); **0 new** |
| canonical-ledger / anti-fabrication / production-safety / session-security | ✅ PASS |

## What is unit-proven (not just compile-checked)
The three commerce decision engines are **pure functions with exhaustive unit tests**: smart-collection matching, automation rule evaluation, and inventory audit variance/reconciliation. Their logic is verified truth — independent of any database.

## Contract tests added this wave
commerce-analytics endpoints (real-aggregation + missing-table fallback asserted), automation-rule-eval core (purity asserted — no DB/fetch), audit-variance core (purity asserted), operations-dashboard nav link.

## Honest boundary
Engine **logic** is unit-proven; everything else is compile + contract verified. Runtime (analytics returning real numbers, the reconcile/automation RPCs once built, the 30 RBAC guards in `enforce`) needs a live stack — `11-live-stack-prep.md` defines exactly how to verify it.

**Verdict:** 97 unit tests on the decision cores + 20 commerce contract tests + 204/204 launch + 4 clean typechecks — the verification ceiling for an environment with no database.
