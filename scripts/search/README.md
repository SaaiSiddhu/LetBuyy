# Search Scripts

Local data backfills for the storefront search index (`search_documents`).

## Overview

`search_documents` is populated by a real, complete outbox → queue → projection pipeline
(`services/api-gateway/src/execution/outbox-execution.adapter.ts`,
`services/api-gateway/src/execution/queue-execution.adapter.ts`,
`services/queue-workers/src/platform-queue-consumer.ts`). Locally, that pipeline never runs
against pre-existing seed data unless it was created through the real product/order mutation
path — see `backfill-search-documents.sql` for the exact mechanism and why the gap is a local
seeding issue, not a missing pipeline.

## Scripts

- `backfill-search-documents.sql` — one-time, idempotent backfill that mirrors the real
  `planProductSearchProjectionDocument`/`planOrderSearchProjectionDocument` builders
  (`packages/event-core/src/queue-projection-plans.ts`) field-for-field. Safe to re-run. Not a
  schema migration — run it directly against the local database, it does not touch DDL.

```sh
docker exec -i supabase_db_supabase psql -U postgres -d postgres -f - < scripts/search/backfill-search-documents.sql
```
