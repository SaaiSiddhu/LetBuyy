# Phase 16 — Autonomous Audit System

**Recurring, graph-backed audit prompts. Each pairs a `graphify` query (find candidates) with the code/migration authority (confirm). Designed to run on a schedule (the graph re-indexes in ~10s+; not per-turn).**

## Operating model
1. CI job: `graphify update .` → fresh `graph.json` at HEAD (closes the staleness gap).
2. For each domain below, run the query, diff against the last run, and only escalate *new* candidates to a human/agent for code-level confirmation.
3. Authority for a finding is always the code/migration, not the graph (graph finds candidates).

## Security (weekly)
- `path "<each mutating route>" "verifySiteOwnership"` → any route with no path = ownership-gap candidate.
- `explain "step-up"` neighbors → confirm refund/payout routes still reach it.
- New nodes under `routes/` since last run with no auth/tenant edge → flag.

## Payments (weekly)
- `get_pr_impact` on `payments.ts`/`payouts.ts`/`checkout-core` → any new caller outside api-gateway = leak of money logic into an app (should be zero).
- ⚠️ (needs SQL) `path "<money route>" "post_ledger_transaction"` → confirm every money mutation reaches the canonical ledger.

## Checkout (on change)
- `path "checkout-client" "shipping_rates"` → confirm `shippingRateId` reaches the gateway (regression guard for the cert defect).
- New checkout nodes not reaching `create_checkout_order` → flag.

## Orders (weekly)
- `get_neighbors "orders.ts"` → confirm status-transition + email-enqueue edges present (COD/cancelled/refunded).

## Gift Cards (on change) ⚠️ SQL
- `path "issue_gift_card" "gift_card_accounts"` and `path "create_checkout_order" "gift_card_accounts"` → confirm issue and redeem hit the same table (split-brain regression guard).

## Marketplace / Developer Platform (monthly)
- Confirm app-marketplace/developer-portal communities have **no new edges into live runtimes** (frozen invariant). Any new `app-marketplace → api-gateway` runtime edge = freeze violation.

## Themes (on change)
- `path "<each section type>" "renderer-registry"` → any section with no renderer = broken-fallback candidate (LB-8 class).

## Tenancy (weekly) ⚠️ SQL
- Once SQL indexed: `path "<each tenant table>" "FORCE ROW LEVEL SECURITY"` → any table without forced RLS = isolation gap.

## Graph health (each run)
- Orphan count (was 127) — rising = dead code accumulating.
- `docs/archive/**` node count — should trend to 0 after exclusion.
- `built_at_commit` vs HEAD — must be 0 in CI (else the audit ran on a stale graph).

## Escalation contract
A finding is **actionable only after** an agent confirms it against the file:line/migration. The graph reduces the search space from 28k code nodes to a handful of candidates; it never auto-fails a build alone (the governance gate does that). This keeps the autonomous system high-signal and prevents graph staleness/SQL-blindness from producing false verdicts.
