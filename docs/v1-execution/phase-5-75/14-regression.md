# 14 — Regression

**Status: ✅ No regressions. The cross-package payment change was the highest-risk edit and is verified clean.**

| Gate | Result |
|---|---|
| tenant-core / api-client / api-gateway / merchant-control-plane typecheck | ✅ all EXIT 0 |
| Full launch suite | ✅ 196/196 |
| `canonical-ledger-only-validator` | ✅ PASS (payment change is an allow-list + schema field; no money-table write in TS) |
| `production-safety-validator` | ✅ PASS |
| `frozen-path-override-gate` | ✅ PASS (tenant-core `UpdateStoreSchema` + stores.ts are not frozen paths) |
| `foundation-antifabrication-gate` | ✅ PASS |
| `session-security-validator` | ✅ PASS |
| `validate-design-system` | 🔴 PRE-EXISTING cross-app CSS drift — **identical numbers to the Phase-4 lock**; this wave's TSX added **0** new drift (`tsxRawHex` 0, `tsxArbitraryRadius` improved 327→319) |
| `tenant-isolation-validator` | 🔴 PRE-EXISTING (`tenant-tables.registry.ts` drift; not this wave) |

## Scope of change (Phase 5.75)
- Gateway: `inventory.ts` (+12 RBAC guards, dry-run), `stores.ts` (+2 allow-list fields). `tenant-core`: `UpdateStoreSchema` (+2 optional booleans). api-client: notifications methods. MCP: notifications page + 2 proxies, payments page + payment-config PATCH proxy. Tests: +3.
- **No money/OAuth/RLS/credential code, no frozen path, no new migration, no new table/RPC.** The payment change reuses existing `sites` columns via the existing PATCH route.

**Verdict:** no regressions; the two reds are pre-existing inherited WIP unchanged by this wave. The cross-package payment edit is additive + governance-clean.
