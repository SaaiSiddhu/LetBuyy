# 12 — Regression

**Status: ✅ No regressions across the wave.**

| Gate | Result |
|---|---|
| api-client / api-gateway / merchant-control-plane / tenant-core typecheck | ✅ EXIT 0 |
| Full launch suite | ✅ 200/200 |
| Gateway unit suite | ✅ 348/351 (3 pre-existing, 0 new; +35 evaluator) |
| `canonical-ledger-only-validator` | ✅ PASS (new endpoints are reads + RPC-routed writes; no money-table write in TS) |
| `foundation-antifabrication-gate` | ✅ PASS |
| `production-safety-validator` | ✅ PASS |
| `session-security-validator` | ✅ PASS |
| `validate-design-system` | 🔴 PRE-EXISTING cross-app CSS drift — **identical to the Phase-4 lock**; this wave's new pages added **0** TSX drift (`tsxRawHex` 0; all new pages 0 raw hex/px) |
| `tenant-isolation-validator` | 🔴 PRE-EXISTING (`tenant-tables.registry.ts` drift; not this wave) |

## Scope of change (Phase 5.9)
- Gateway: new `routes/smart-collections.ts` + `lib/smart-collection-eval.ts` + 35 tests + `index.ts` (1 route registration) + `inventory.ts` (3 additive GET handlers).
- api-client: `smartCollections` namespace + `inventory.{reservations,receipts,analytics}`.
- MCP: 4 new pages (smart-collections, reservations, receipts) + KPI banner; 6 proxies; nav (+3).
- **No new migration, no new table/RPC, no money/OAuth/credential code, no frozen path.** All new gateway endpoints are READS or reuse existing RPCs.

**Verdict:** no regressions; the two reds are pre-existing inherited WIP unchanged by this wave; new code added zero governance/design-system drift.
