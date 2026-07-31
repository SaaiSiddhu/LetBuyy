# 09 — Automation Engine

**Backend status: PARTIAL — event backbone REAL, merchant rule engine ABSENT.** This is the **one genuinely net-new-schema engine** in Phase 5 → BLUEPRINT, not built (needs migration + ARB + live DB).

## What already exists (reuse)
- **Event backbone (REAL):** `outbox_events` (partitioned), `platform_queue_jobs` (7 named queues incl. inventory-jobs, fulfillment-jobs, bulk-admin-jobs), `webhook_subscriptions` + `webhook_deliveries`, `workflow_lifecycle`/`workflow_heartbeats` (internal execution primitives). `emitOrderEvent`/`emitProductEvent`/`emitInventoryEvent` already publish domain events with validated contracts.

## What is absent
- No merchant-configurable `automation_rules` / triggers / conditions / actions. `workflow_lifecycle` is internal, not merchant-facing.

## Blueprint (requires migration + ARB + live verification — NOT shipped)
1. **Schema (new migration):** `automation_rules` (site_id, name, trigger_event, conditions jsonb, actions jsonb, is_active, RLS GUC) + `automation_runs` (rule_id, event_id, status, result, idempotency_key, RLS) for an audit/execution log. Mirror the existing tenant-table RLS + idempotency patterns.
2. **Engine (reuse, don't duplicate):** a consumer on the EXISTING event backbone — on each `outbox_events`/queue domain event, load matching active rules, evaluate `conditions` (reuse the smart-collection-style pure evaluator), enqueue `actions` (send notification via the REAL notification router, adjust tag, etc.) idempotently via `platform_queue_jobs`. **No new queue infra** — reuse the 7 existing queues.
3. **Trigger vocabulary (V1):** order.placed/paid/fulfilled/cancelled, inventory.low_stock, customer.created. **Action vocabulary (V1):** send notification (existing router), add tag, webhook (existing subscriptions).
4. **api-client + proxy + UI:** rule CRUD + a run log.

## Verifiable-now slice
The **pure condition/action evaluator** (no schema) can be authored + unit-tested now (like `evaluateStaffPermission`). The persistence + the event-consumer wiring need the migration + a live DB to verify — so the engine is **NOT shipped this phase**; shipping an untested automation-execution migration would be fabrication.

**Verdict:** automation is the sole net-new-schema engine. Blueprint is ready + reuses the real event/notification/queue backbone (zero duplicate infra). Implementation is gated on a migration + ARB + live DB.
