# 08 — Smart Collections

**Backend status: PARTIAL — table exists, evaluation absent.**

## What already exists
- **Table:** `smart_collections` (`000_baseline.sql` L27022, RLS) — `store_id`, `name`, `slug`, `description`, `conditions` jsonb (NOT NULL), `match_type` (all/any). The storage schema is done.
- `collections.conditions` jsonb column also exists on manual collections (default `[]`).

## The real gap
- **No gateway route** for smart_collections CRUD; **no evaluation RPC/logic** to compute product membership from `conditions`; **no api-client/UI**.

## Implementation spec (mostly verifiable — reuses the existing table)
1. **Rule-evaluation engine (pure TS, unit-testable — the verifiable core):** a function `evaluateSmartCollection(product, { conditions, match_type })` over a fixed condition vocabulary (field ∈ title/type/vendor/tag/price/inventory; op ∈ equals/contains/starts/ends/gt/lt; all/any). No new schema — operates on the existing `conditions` jsonb shape. Unit-test exhaustively (like `evaluateStaffPermission`).
2. **Gateway route:** smart_collections CRUD + a `preview`/`products` endpoint that runs the evaluator over the store's products (read-only; no new table). Materialization can reuse `collection_products` or stay computed.
3. **api-client + proxy + UI:** a rule-builder (conditions + match_type) with a live product-match preview.

**Status this phase:** the evaluator (pure logic + tests) is the recommended first verifiable build; the route + UI follow the standard pattern. Background re-materialization (on product change) would use the existing `outbox_events`/queue infra — no new automation table needed.

**Verdict:** schema exists; the engine = a pure evaluator (verifiable) + a read route + UI. No new table required. The only "absent" piece is logic + exposure, both buildable without a migration.
