# 07 — Smart Collections

**Exposure: ~20% — schema exists, evaluation + UI not built (honest).** Per the mission's Agent-07 directive: **schema EXISTS → do not create new schema; build evaluator + UI (specced here, evaluator is the verifiable next step).**

## Schema reality (confirmed — `01-commerce-truth-map.md`)
`smart_collections` table EXISTS: `store_id`, `name`, `slug`, `description`, `conditions` jsonb (NOT NULL), `match_type` (all/any). `collections.conditions` jsonb also exists. **No new schema is needed or permitted.**

## Absent
No gateway route for smart_collections, no evaluation logic, no api-client/UI.

## Implementation spec (mostly verifiable, NO new schema)
1. **Pure evaluator (the verifiable core, unit-testable like `evaluateStaffPermission`):** `evaluateSmartCollection(product, { conditions, match_type })` over a fixed vocabulary (field ∈ title/type/vendor/tag/price/inventory; op ∈ equals/contains/starts/ends/gt/lt). Operates on the existing `conditions` jsonb shape — no migration.
2. **Gateway route:** smart_collections CRUD + a `preview`/`products` read endpoint running the evaluator over the store's products (read-only; membership can reuse `collection_products` or stay computed).
3. **api-client + proxy + UI:** rule-builder (conditions + match_type) with a live product-match preview.

## Why not shipped this phase
The evaluator + gateway route is gateway-side work (new route + the evaluator); the UI then follows. It was staged behind the inventory-ops verticals. Background re-materialization on product change would reuse the existing `outbox_events`/queue infra — no new automation table.

**Verdict:** schema confirmed present; the engine is a pure evaluator (verifiable) + a read route + UI. No new table. Specced; the evaluator is the recommended first verifiable build.
