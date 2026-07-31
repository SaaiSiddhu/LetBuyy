# 03 — Automation Engine

**Exposure: ~25%.** The automation **rule-evaluation core is built + unit-tested**; the schema/execution/UI is a blueprint reusing the existing event backbone (no duplicate infra).

## Built + verified this wave
- **`services/api-gateway/src/lib/automation-rule-eval.ts`** (pure, no I/O): `evaluateAutomationRule(event, rule)` → `{ matched, actions }` — gates on `is_active` + trigger match + condition pass (all|any); `evaluateCondition` (dot-path into payload, ops equals/not_equals/contains/gt/lt/gte/lte). Triggers: order.placed/paid/fulfilled/cancelled, inventory.low_stock, customer.created. Actions (returned, not executed): send_notification/add_tag/webhook. **36/36 unit tests pass.** The verifiable truth of the rule logic.

## Blueprint (proposed — NOT shipped; requires migration + ARB)
```sql
-- automation_rules: site_id, name, trigger, conditions jsonb, match_type, actions jsonb,
--   is_active; RLS GUC. automation_executions: rule_id, event_id, status, result,
--   idempotency_key; RLS. (automation_logs optional → reuse outbox/queue.)
```
**Reuse, do not duplicate:** execution runs on the EXISTING event backbone (`outbox_events`, `platform_queue_jobs` — 7 queues, `webhook_subscriptions`) + the REAL notification router (`/notifications/send`). No new queue/event infra. See `04-automation-execution.md`.

## Exposure path (after migration)
api-client `automations.{rules, executions}` → proxies → rule-builder UI (`05`). The evaluator core (built) is what the execution consumer + the preview will call.

**Verdict:** automation *logic* (trigger + condition evaluation + action resolution) is real + unit-tested; the rule persistence + the event-consumer wiring need a migration + ARB + live DB — blueprinted on the existing backbone, not faked.
