# Apps Marketplace Trust and Security

This document records built marketplace trust controls and remaining approval gates.

## Built Controls

- OAuth install with PKCE S256 and hashed token persistence.
- Granted-scope review and per-scope revocation from My Apps.
- Tenant-aware app installation, review, saved-app, request, quota, and webhook ownership checks.
- Review verification through active installation proof rows.
- Basic review fraud scoring and report-driven moderation.
- Data-handling disclosure, support SLA, app health/status URL fields, and compatibility metadata.
- Durable webhook delivery rows with retry/dead-letter paths when subscriptions are persisted.

## Remaining Approval Gates

- Paid third-party security scan vendor and credentials.
- Final KYC policy and evidence requirements.
- Production media bucket/CDN configuration.
- Production migration apply and cloud queue/media provisioning.

## Operating Standard

Trust badges, verification labels, and editorial rails must be backed by stored data. Hide a feature or show a generic empty/error state when the backing data or approved policy is unavailable.
