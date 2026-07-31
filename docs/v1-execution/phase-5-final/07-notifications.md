# 07 — Notification Operations

**Exposure: ~85% — shipped in Phase 5.75, carried + stable.**

## Shipped (verified, Phase 5.75)
- api-client `notifications.preferences.{list,update}` + `notifications.deliveryLogs`.
- Proxies (ownership-checked): `notifications/preferences` (GET+PUT), `notifications/delivery-logs` (GET).
- UI `[store]/settings/notifications/page.tsx` — preferences matrix (channel×category toggles, optimistic PUT) + delivery-log table (filters + pagination). Reachable via the settings index.
- Backend reused: `notification_preferences`, `notification_logs`/`email_logs`, the `/notifications/send` router (multi-channel + suppression + logging). No new schema.

## Remaining (small follow-up)
- **Operational/commerce/inventory alerts** = `send` calls on the EXISTING router, wired as side-effects from commerce flows (low-stock, PO received, transfer received) — no new infra; a thin wiring task (best done alongside the automation engine, which is the broader event-driven-alerts piece, blueprinted in Phase 5's `09-automation-engine.md`).
- `settings:write` RBAC on the preferences PUT (see `09-rbac.md`).

**Verdict:** notification preferences + delivery logs are real merchant UI over the existing router. Event-driven operational alerts are a thin wiring follow-up on the same router — no new schema.
