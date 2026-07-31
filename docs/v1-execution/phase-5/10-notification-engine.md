# 10 — Notification Engine

**Backend status: REAL (reuse, do not rebuild).**

## What already exists
- **Tables (RLS):** `notifications`, `notification_preferences`, `notification_logs`, `notification_suppressions`, `email_logs`, `email_suppressions`, `device_tokens`.
- **RPC:** `create_notification` (SD). **Router:** `POST /notifications/send` does channel selection (`planNotificationRoute`), suppression + preference checks, logs to `notification_logs`. Email: `/email/render` + `/email/send` (Resend, failover, `email_logs`, delivery events → outbox).
- **api-client:** `notifications.{list,unreadCount,markRead,markAllRead,remove,registerDeviceToken,unregisterDeviceToken}`.

## The real gap (exposure — verifiable)
- **Merchant ops notification UI:** surface `notification_preferences` (per-channel/category toggles) and `notification_logs` / `email_logs` (delivery status) in the merchant app. The inbox client methods exist; preferences + delivery-log views are the gap.
- Inventory/PO/transfer/automation notifications are just **`send` calls** on the existing router (no new infra) — wired as actions from those flows (and from the automation engine once built).

## Implementation spec
Proxies over `/notifications/preferences` + `/notifications/delivery-logs` → a Notifications settings/preferences UI + a delivery-log view. Compile + contract verifiable. **No new schema.**

**Verdict:** the notification engine (multi-channel router + logs + suppressions + preferences) is fully real; Phase-5 delivers the merchant preferences + delivery-log UI and wires operational `send` calls. No new schema.
