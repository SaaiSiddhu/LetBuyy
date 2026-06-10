# Task 011 - Email
Status: done
DependsOn: [001,010]
Covers: transactional email
Conforms-to: V1 section 3, Appendix C row 011

## Goal

Implement MJML/Liquid rendering, multi-ESP failover, sender-domain controls, bounce/suppression, and templates.

## Scope

In: notification-core email contracts and mock ESP. Out: live ESP until DNS/credentials.

## Reuse

Existing identity email, `marketing.ts`, `packages/notification-core`, `email_logs`.

## Database

Email logs, suppressions, sender domains with RLS+FORCE+GUC.

## APIs

`POST /email/render`, `POST /email/send`.

## Events

`email.delivered.v1`, `email.bounced.v1`, `email.complained.v1`.

## Acceptance

Templates render from one context object; failover works; suppression honored.

## Tests

Render, failover, suppression, route contracts, real Postgres migration/RLS/rollback proof.

## Rollback

Use existing sender path and rollback additive DB.

## [HUMAN-REQUIRED]

`HR-ESP-LIVE`.
