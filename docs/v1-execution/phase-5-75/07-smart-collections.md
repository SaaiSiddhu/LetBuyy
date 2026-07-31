# 07 — Smart Collections

**Schema exists; evaluator + route + UI specced (not built this wave). Per Agent-07: schema EXISTS → no new schema; build evaluator + UI.**

## Confirmed (truth map)
`smart_collections` table EXISTS (`store_id`, `name`, `slug`, `description`, `conditions` jsonb, `match_type` all/any). `collections.conditions` jsonb also exists. No gateway route, no evaluator, no api-client/UI.

## Implementation spec (NO new schema)
1. **Pure evaluator (verifiable core, unit-testable):** `evaluateSmartCollection(product, { conditions, match_type })` — vocabulary: field ∈ title/type/vendor/tag/price/inventory; op ∈ equals/contains/starts_with/ends_with/gt/lt; combine via all/any. Operates on the existing `conditions` jsonb. Author as `services/api-gateway/src/lib/smart-collection-eval.ts` + exhaustive unit tests (like `evaluateStaffPermission`).
2. **Gateway route:** smart_collections CRUD + `GET /smart-collections/:id/preview` running the evaluator over the store's products (read-only).
3. **api-client + proxy + UI:** rule builder (condition rows + match_type) with live product-match preview.

## Why not built this wave
The evaluator + gateway route is gateway-side work; the UI follows. It was staged behind the RBAC/notifications/payment work this wave to keep the integration verifiable. Background re-materialization on product change reuses the existing `outbox_events`/queue infra — no new automation table.

**Verdict:** the verifiable next step is the pure evaluator + a read route (no new schema); the UI is the standard pattern after. Specced.
