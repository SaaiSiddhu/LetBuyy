# 05 — Notification Operations

**Exposure: ~70% → ~85% — SHIPPED this wave.** The notification ops UI now exists over the real backend.

## Shipped this wave (verified)
- **api-client:** `notifications.preferences.{list,update}` + `notifications.deliveryLogs` + types (`NotificationPreference`, `NotificationDeliveryLog`, queries extending `QueryParams`). api-client `tsc` EXIT 0.
- **Proxies** (ownership-checked): `notifications/preferences` (GET+PUT), `notifications/delivery-logs` (GET).
- **UI:** `[store]/settings/notifications/page.tsx` (replaced the site_settings stub) — a **preferences matrix** (7 channel×category toggles, each a `Switch` firing PUT optimistically with revert-on-failure) + a **delivery-log table** (channel/status filters, status badges, en-IN timestamps, pagination). `@letbuyy/ui` + `--lb-*` tokens, loading/empty/error.
- **Reachable** via the settings index (`itemHrefs` includes `notifications`) — no dead nav.

## Backend (reused, real)
`notification_preferences`, `notification_logs`/`email_logs`, the `/notifications/send` router. No new schema.

## Remaining
Operational alerts (inventory/PO/transfer → `send`) wired as actions from those flows; a richer alert center. RBAC (`settings:write`) on the preferences PUT — follow-up.

## Verification
api-client + MCP `tsc` EXIT 0 · contract test (api-client methods + ownership-checked proxies + real page) PASS · launch 196/196.

**Verdict:** notification preferences + delivery logs are now real merchant UI over the existing router. No new schema.
