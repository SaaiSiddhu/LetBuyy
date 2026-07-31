# 04 — Automation Execution

**Status: blueprint (the evaluator core is built; the execution wiring needs the `automation_rules` migration + a live worker).**

## Built (the decision core)
`evaluateAutomationRule(event, rule)` (`03`, 36/36 tests) already decides — given an event + a rule — whether it matches and which actions to resolve. This is the heart of execution and it is real + tested.

## Blueprint — reuse the EXISTING event backbone (no duplicate infra)
1. **Trigger ingestion:** the gateway already emits domain events to `outbox_events` (`emitOrderEvent`/`emitProductEvent`/`emitInventoryEvent`). A consumer (a `platform_queue_jobs` worker on the existing queues) reads each event.
2. **Rule evaluation:** for the event, load active `automation_rules` for the site, run `evaluateAutomationRule` (the built core) on each.
3. **Action dispatch (idempotent):** for matched rules, enqueue actions on the EXISTING queue + execute via the REAL surfaces — `send_notification` → `/notifications/send` router; `add_tag` → the products/customers tag path; `webhook` → existing `webhook_subscriptions`/`webhook_deliveries`. Record in `automation_executions` with an idempotency key.
4. **Failure/retry:** reuse the existing queue retry + DLQ semantics (`webhook_deliveries.dlq_reason` pattern) — no new retry system.

## Why not built
Requires the `automation_rules`/`automation_executions` migration (ARB) + a deployed queue consumer (live worker) to verify end-to-end. Shipping an untested event-consumer + rule-execution path as "done" would be fabrication.

**Verdict:** execution is fully designed on the existing event/queue/notification backbone (zero duplicate infra), with the decision core already built + tested; wiring it is post-migration + live-worker work.
