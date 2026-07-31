# 13 — Governance

**Status:** ✅ All applicable governance validators PASS after this phase's G7 fix. No frozen-file violation, no fabrication, money paths canonical-ledger compliant.

| Validator | Result |
|---|---|
| `canonical-ledger-only-validator` | ✅ PASS (G7 + all prior money edits use `db.rpc`, no money-table writes) |
| `foundation-antifabrication-gate` | ✅ PASS |
| `theme-governance-validator` | ✅ PASS |
| `no-new-react-sections-validator` | ✅ PASS |
| `frozen-path-override-gate` | ✅ PASS |
| `migration-safety-validator` | ✅ PASS |
| `production-safety-validator` | ✅ PASS |
| `package-export-validator` | ✅ PASS |
| `undeclared-import-validator` | ✅ PASS |
| `dependency-graph-validator` + `circular-import-validator` | ✅ PASS |
| `session-security-validator` | ✅ PASS |
| `tenant-isolation-validator` | 🔴 PRE-EXISTING WIP (registry drift from WIP migrations; actual RLS passes red-team) |
| `validate-design-system` | 🔴 PRE-EXISTING WIP (CSS drift in unrelated apps; this phase's delta = 0, `tsxRawHex` 0) |

**This phase's change** (webhook-service `markOrderRefunded` guard) is governance-clean: not a money-table write, not a frozen path, no new React section, no fabrication. The two red validators are inherited WIP documented since Phase 1 — Phase 3 added nothing to them. Fixes: run `generate-tenant-table-registry.mjs`; resolve/baseline the unrelated CSS drift; commit untracked migrations 186/187.
