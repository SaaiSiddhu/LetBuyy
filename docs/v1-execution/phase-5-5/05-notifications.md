# 05 — Notification Center

**Exposure: ~70% — NOT advanced this phase (honest).** Backend is fully REAL; the merchant ops UI is the remaining exposure.

## Already real (reused)
- Tables: `notifications/_preferences/_logs/_suppressions`, `email_logs`. RPC `create_notification`. Router `POST /notifications/send` (channel select + suppression + preference + logging); `/email/*`. api-client inbox: `notifications.{list,unreadCount,markRead,markAllRead,remove,registerDeviceToken,...}`.

## Not built this phase (and why)
The merchant **notification preferences** UI (per-channel/category toggles over `notification_preferences`) and the **delivery-log** view (over `notification_logs`/`email_logs`) need **api-client methods that don't exist yet** (`notifications.preferences.{get,update}`, `notifications.deliveryLogs`). Adding those is an api-client edit; to avoid colliding with the inventory api-client work this phase (single shared file), it was staged rather than rushed. The gateway routes exist (`/notifications/preferences`, `/notifications/delivery-logs`).

## Implementation spec (verifiable, no new schema)
Add `notifications.{preferences.get/update, deliveryLogs}` to the api-client → proxies → a Notifications settings page (preferences) + a delivery-log view. Operational alerts (inventory/PO/transfer) are just `send` calls on the existing router — no new infra.

**Verdict:** notification engine is real; the merchant preferences + delivery-log UI is the next exposure vertical (api-client + proxy + UI), specced and unblocked.
