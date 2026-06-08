# Task 016 - Observability
Status: done
DependsOn: [001,005]
Covers: observability, analytics rollups, media module, AI seam
Conforms-to: V1 sections 3, 5, Appendix C row 016

## Goal

Finalize structured logs/metrics/basic tracing, in-DB analytics rollups/materialized views, signed R2 media module, and AI seam only.

## Scope

In: right-sized observability, analytics read module, media signed uploads, AI interfaces. Out: analytics-pipeline service, media service, full SLO/load/chaos, AI model wiring, reseller analytics.

## Reuse

`media.ts`, `analytics.ts`, queue worker rollups, `packages/infrastructure`, audit logs.

## Database

Forward: `154_executable_analytics_media_ai_seam.sql` extends `media_assets`, enables tenant-GUC RLS/FORCE on media/analytics rollups, creates `commerce_analytics_daily_mv`, and creates `ai_capability_seams`.

Rollback: `154_executable_analytics_media_ai_seam.rollback.sql`.

## APIs

`GET /analytics/:site/summary`, `POST /media`, `POST /media/signed-upload`, `GET /media`, `GET /ai/seam`.

## Events

Subscribes to analytics-relevant events through in-DB rollups; publishes `media.processed.v1`.

## Acceptance

Dashboards read from materialized views; media signed upload works; AI seam has no model call; no analytics-pipeline service, media service, or AI model wiring was added.

## Tests

Static API/module tests and real local Postgres proof:

- `cd services/api-gateway && npx tsx --test src/__tests__/observability-analytics-media.test.ts` PASS 3/3.
- `node --test tests/executable/observability-analytics-media-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `pnpm run test:unit:gateway` PASS 210/210.
- `pnpm run test:behavioral` PASS 505 tests, 490 pass, 15 `[HUMAN-REQUIRED]` skips.
- `pnpm run test:contracts` PASS 197/197.
- `pnpm turbo test` PASS 67/67 tasks.

## Rollback

Disable media signed-upload and AI seam routes, run `154_executable_analytics_media_ai_seam.rollback.sql`, and keep provider modes mock.

## [HUMAN-REQUIRED]

`HR-WAREHOUSE-LIVE`, `HR-AI-MODEL-LIVE`.
