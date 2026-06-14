# LCIS — Autonomous Discovery Report (Phase 12)

Repository-wide scan for gaps. **Every item is a candidate** — the 107 deterministic governance validators are authoritative; this report surfaces what to verify, never auto-asserts a violation.

## Unused / internal RPCs
- **156 functions, 53 invoked via gateway `db.rpc` → ~103 not reached through the gateway.**
- Most are **trigger functions or internal helpers** (called by triggers or other functions, not `db.rpc`) — *not* dead code. To confirm a function is truly unused, check: is it referenced by a `CREATE TRIGGER`? called inside another function body? exposed to PostgREST?
- Action: run `pnpm graph:db` and review `functions[].callers === []` together with the trigger list before deleting anything.

## Tenant tables without a detected RLS enable
- **20 candidates** (e.g. `ledger_accounts`, `ledger_transactions`, `ledger_entries`, `settlements`, `reserves`, `payouts`, `compensation_actions`, `outbox_consumptions`).
- ⚠️ **`rls-force-coverage-validator` PASSES** — these are therefore either (a) service-role-only ledger/internal tables that legitimately don't need per-tenant RLS, or (b) tables whose RLS is declared with a syntax this regex parser doesn't detect. **Do not "fix" without confirming** against the validator's allow-list.

## Public-policy candidates
- **34 policies matched `USING (true)`** (excluding obvious `service_role`).
- ⚠️ **`no-public-using-true-validator` PASSES** — so these are service-role-scoped (the heuristic over-counts `USING(true)` that is gated by a `TO service_role` clause). Authoritative: the validator.

## Code-graph dead areas
- Isolated single-degree nodes exist (predominantly Markdown doc headings and a few orphaned exports). Not material; no high-degree symbol is orphaned.
- No unused **app API route file** detected outside the 129-route governed inventory (`domain-boundary-validator`).

## Documentation gaps
- Reserved services (`checkout-runtime`, `search-service`, …) are manifest-only by design — documented as such, not gaps.

## Net
No confirmed dead code, unused route, or RLS hole was proven by this pass — the deterministic gate already covers those. The value here is the **candidate lists + the exact verification step** for each, so a human review is fast and safe.
