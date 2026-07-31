# 12 — Regression (Stream L)

**Status:** ✅ No regressions from this wave's hardening edits.

## Pass/fail matrix
| Suite / check | Result |
|---|---|
| Launch suite (`tests/launch/*.test.mjs`) | ✅ **167 / 167** (incl. new `lb-checkout-hardening` = 4, `lb-experience-flow` = 7) |
| theme-engine package (`tsx --test test/*.test.ts`) | ✅ **82 / 82** |
| theme-engine source (`tests/theme-engine/*.test.mjs`) | 🟡 31 / 32 (1 **pre-existing** — composition-engine `layoutHtml`, fails at HEAD) |
| TypeScript: api-gateway | ✅ clean |
| TypeScript: api-client | ✅ clean |
| TypeScript: storefront-runtime | ✅ clean |
| TypeScript: merchant-control-plane / identity-platform | ✅ clean (Phase 2.5; unchanged) |
| `canonical-ledger-only-validator` | ✅ PASS (money-path edits use `db.rpc`, no money-table writes) |
| `foundation-antifabrication-gate` | ✅ PASS |
| `theme-governance` / `no-new-react-sections` / `frozen-path-override-gate` | ✅ PASS |
| `undeclared-import` / `dependency-manifest` / `production-safety` | ✅ PASS |
| `tenant-isolation-validator` | 🔴 PRE-EXISTING WIP (registry drift — actual RLS passes red-team) |
| `validate-design-system` | 🔴 PRE-EXISTING WIP (CSS drift in unrelated apps; this wave added 0) |

## Known pre-existing (NOT this wave)
- api-gateway unit suite has 3 pre-existing failures (stale Stripe assertion I-3, an AI-route expectation, a missing-migration-129 expectation) — documented, predate this wave.
- tenant-isolation + design-system + sequential-migration reds are inherited WIP (Phase 1 onward).

## Coverage
Launch · theme · checkout · payment · COD · refund · storefront · auth · order · customer · domain — all green except the documented pre-existing items. New hardening (COD inventory/GC, refund GC, shipping) is contract-covered.
