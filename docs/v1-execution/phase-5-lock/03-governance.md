# 03 — Governance (lock baseline)

| Validator | Result |
|---|---|
| `canonical-ledger-only-validator` | ✅ PASS — all money/inventory mutations go through existing `SECURITY DEFINER` RPCs; no `.from(money_table).insert/update` in TS across the Phase-5 work |
| `foundation-antifabrication-gate` | ✅ PASS |
| `production-safety-validator` | ✅ PASS |
| `session-security-validator` | ✅ PASS |
| `validate-design-system` | 🔴 PRE-EXISTING cross-app CSS drift — **identical to the Phase-4 lock**; Phase 5 added **0** new TSX drift (`tsxRawHex` 0 across all new pages) |
| `tenant-isolation-validator` | 🔴 PRE-EXISTING — `tenant-tables.registry.ts` drift (run `scripts/generators/generate-tenant-table-registry.mjs`); driven by parallel-workstream schema, NOT Phase-5 code |

## Key governance facts
- **No new migrations** were shipped in Phase 5 — every table/RPC used already existed. The audit + automation schema is deliberately NOT shipped (ARB-gated blueprint) — which is *why* migration-safety/canonical-ledger stay clean.
- **No payment/OAuth/credential code** was modified. The payment toggles only flip the existing `sites.cod_enabled`/`online_payment_enabled` booleans via the existing `PATCH /stores/:id` route (additive allow-list + schema field in tenant-core — re-verified canonical-ledger/frozen-path PASS).
- **No frozen path** was touched.
- The two red validators are **inherited, out-of-scope WIP** (cross-app CSS + a registry generator), unchanged by Phase 5 — same as the Phase-4 lock.

**Verdict:** Phase 5 is governance-clean — canonical-ledger-compliant by construction (RPC-only), migration-free, zero new drift. The two reds are pre-existing inherited WIP, not Phase-5 regressions.
