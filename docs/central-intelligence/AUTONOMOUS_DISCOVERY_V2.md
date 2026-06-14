# LCIS v2 — Autonomous Discovery (Phase 10)

Refreshed with table/RPC lineage. **All items are candidates — the 107 deterministic validators (all green) are authoritative.** Each has its verification step.

## Dead-code candidates
| Candidate | Count | Verify |
|-----------|------:|--------|
| RPCs not invoked via gateway `db.rpc` | ~103 | `graph:intel rpc <name>` → check `callers`; cross-ref `CREATE TRIGGER` (most are trigger/internal functions, **not** dead) |
| Tables not reached by any route | (run) | `graph:intel table <name>` → `reachedByRoutes` empty + not in a trigger/view ⇒ candidate; many are internal ledger/outbox tables |
| Code orphans (degree-1) | minor | mostly doc headings; no high-degree symbol is orphaned |
| App API routes outside the 129 governed set | 0 | `domain-boundary-validator` |

## Ownership gaps
- CODEOWNERS covers `*` + 26 paths → **no file is unowned**. Gap is *granularity* (single owner), not coverage.

## Tenant gaps
- 20 tenant tables without a regex-detected RLS enable → **verify against `rls-force-coverage-validator` (passes)**; likely service-role/ledger tables.

## Security gaps
- 34 `USING(true)` policy matches → service-role-scoped (`no-public-using-true-validator` passes).
- No plaintext secret in repo; 19 required secrets are deploy-time.

## Documentation gaps
- Reserved services are manifest-only by design (documented).
- Cost/capacity numbers are intentionally a framework (load-test required) — see INFRASTRUCTURE_INTELLIGENCE.

## Net
No **confirmed** dead code / unused table / RLS hole — the gate already covers those. v2's contribution is **table/RPC-level candidate lists with the exact `graph:intel` verification command**, so a human review is one query away.
