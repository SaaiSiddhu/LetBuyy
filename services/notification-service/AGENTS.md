# Notification Service Reserved Root

Runtime boundary: `services/notification-service`.

Status: reserved-not-implemented, manifest-only.

The active notification owner is `services/api-gateway`, `services/queue-workers`, and shared notification packages. This directory is a reserved seam only.

Rules:

- MUST remain manifest-only.
- MUST NOT add source, tests, package.json, wrangler.toml, or deployment config.
- MUST NOT extract email, WhatsApp, SMS, push, templates, or delivery state into this root.
- Any change from reserved status requires a human ARB amendment and the canonical topology update before source exists.
