# LCIS v2 — Gap Analysis (Phase 0)

What LCIS v1 had, what was missing, and what v2 adds.

## v1 had
Code graph (52k nodes) · DB intelligence (414 tables, 156 RPCs, 651 policies) · engine (deps/consumers/blast/critical/payment/tenant/flow) · 12 agents · Data Layer UI · reports.

## v1 gaps → v2 fills
| Gap | v2 capability | Command |
|-----|---------------|---------|
| No table-level lineage | `traceTable` — table → policies/triggers/indexes/RLS + RPCs that touch it + routes that reach it | `graph:intel table T` / `/api/table` |
| No RPC-level lineage | `traceRPC` — RPC → tables/SD/idempotency/lock/callers | `graph:intel rpc R` / `/api/rpc` |
| No policy lineage | `tracePolicy` — policies on a table | `graph:intel policy T` / `/api/policy` |
| No ownership | `findOwnership` — CODEOWNERS path → owners | `graph:intel owner X` / `/api/owner` |
| No infrastructure model | `infra-intel.mjs` — workers, queues, KV/R2/D1/Hyperdrive, crons, Vercel targets, secrets, providers | `graph:intel infra` / `/api/infra` |
| No refund/payout flow | `traceRefund` / `tracePayout` | `graph:intel refund\|payout` |
| No "query before scan" doctrine | CLAUDE.md **LCIS query strategy** decision table | — |
| No Infrastructure UI | `◇ Infrastructure` tab | UI |

## Still out of scope (honest)
- SQL symbols are not code-graph nodes (blast radius is code-only; the DB layer is the SQL source of truth).
- **Cost/scale projections** (100/1000 merchant, 100k-user $ figures) require load + pricing assumptions — these are **frameworks, not repository truth**; INFRASTRUCTURE_INTELLIGENCE gives the levers + free-tier limits, not invented dollar numbers.
- Ownership is a single owner (`@saai-sidd`) per CODEOWNERS — domain ownership is derived from the workspace/runtime map.
- Operations/incident graphs are documented from the workflows + runbooks present; there is no live incident feed in-repo.
