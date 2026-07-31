# Phase 9 — Database Intelligence

**⚠️ The graph does not cover the database. Only 2 nodes exist under `database/` for 103 migrations. This phase is therefore grounded in the migrations directly (authoritative), with the graph gap documented as the top remediation.**

## The gap (graph-measured)
- `database/` nodes in `graph.json`: **2** (both under `database/supabase`).
- Migrations on disk: **103** (`database/supabase/migrations/*.sql`).
- Tables / views / RPCs / triggers / policies / indexes as graph nodes: **0 distinct**.
- Root cause: Graphify's tree-sitter run here is code-symbol oriented and did not parse SQL bodies (independently recorded `docs/ai-infrastructure/graphify-report.md:44`). The tool *supports* schema indexing in principle; it was not active for `.sql` in this build.

## The database, from the migrations (authoritative)
| Element | Authority |
|---|---|
| Canonical ledger | `ledger_entries`/`ledger_transactions`, append-only (`reject_ledger_mutation`) + double-entry trigger `enforce_ledger_transaction_balance` (mig 139) |
| Money RPCs | `create_checkout_order` (170), `confirm_order_payment_with_ledger`, `complete_order_refund`, `post_ledger_transaction` (139), `claim_payout_statement_release` (160) |
| Gift cards | `issue_gift_card` + redemption (mig 170/173), `gift_card_accounts`/`_ledger_entries`/`_redemptions`, SHA-256 `code_hash` |
| GST | `gst_invoices` immutable table + reject-mutation trigger (mig 144) |
| Tenancy | forced RLS in 18 migrations; `app_tenant` NOLOGIN NOBYPASSRLS role + RT-1..9 red-team test (mig 164); GUC binding |
| Shipping | `shipping_rates`/`shipping_zones`, resolved in `create_checkout_order` (mig 170) |
| Commission | 0% defaults (mig 162), `commission-bps-zero` validator |

## Why this matters for "architecture intelligence"
Graphify's flagship capability — *"trace a path from a database table through an API handler to a frontend component"* — **cannot run on LetBuyy today** because the database end of that path has no nodes. The richest money/tenancy truth in the repo is exactly the part the graph can't see. Every money/gift-card/ledger flow in Phases 4 and 7 goes dark at the SQL boundary.

## Remediation (highest-value graph action)
1. Re-run extraction with SQL grammar / explicit `database/**/*.sql` inclusion so tables, RPCs, triggers, and policies become nodes with `defines`/`references` edges to their TS callers (`db.rpc('create_checkout_order')` → the RPC node).
2. Then the end-to-end money path (`checkout-client → /api/orders → create_checkout_order → ledger_entries`) becomes a single `graphify path` query, and tenancy can be verified as `<table> → FORCE RLS` from the graph.
3. Until then: **migrations + the canonical-ledger/RLS validators are the database authority — not Graphify.** Do not infer DB completeness from the graph.
