-- T6/W4 — Local backfill: populate search_documents for products/orders that already exist in
-- the database but were never routed through the real outbox pipeline.
--
-- Diagnosis (see the T6 Final Worker Report, section Y, for the full trace): search_documents is
-- populated by a real, fully-implemented three-stage pipeline —
--   1. A product/order mutation writes an outbox_events row in the same DB transaction
--      (services/api-gateway create/update RPC paths).
--   2. OutboxExecutionAdapter.dispatchBatch (services/api-gateway/src/execution/
--      outbox-execution.adapter.ts) fans outbox_events into platform_queue_jobs, one row per
--      applicable queue (product.*/order.* events route to 'search-indexing' —
--      packages/event-core/src/index.ts queueNamesForEvent).
--   3. QueueExecutionAdapter.consumeQueue / services/queue-workers' PlatformQueueConsumer
--      (services/api-gateway/src/execution/queue-execution.adapter.ts,
--      services/queue-workers/src/platform-queue-consumer.ts) claims platform_queue_jobs rows and
--      upserts search_documents via planProductSearchProjectionDocument /
--      planOrderSearchProjectionDocument (packages/event-core/src/queue-projection-plans.ts).
--
-- All three stages are real code — nothing here is a stub, and nothing needs a migration, a new
-- worker, or a schema change. The table is empty locally because:
--   - Stage 1 never ran for the existing seed data: `select count(*) from outbox_events` is 0 for
--     every site checked, meaning today's products/orders were inserted directly (seed SQL /
--     migrations), not through the create/update RPC that would have written an outbox row.
--   - Even if stage 1 had run, stages 2-3 are cron/queue-driven
--     (services/api-gateway/wrangler.toml `[triggers] crons = []` locally; the production cron is
--     `*/15 * * * *`) and are never invoked automatically in local dev. Manual equivalents exist
--     (POST /operations/outbox/dispatch, POST /operations/jobs/consume, both super-admin-gated) but
--     stage 1 having zero rows makes them no-ops here regardless.
--
-- This is a genuine local seeding/backfill gap (T6/W4 explicitly scopes this IN): the mechanism is
-- complete, only today's local rows never flowed through it. This script is NOT a schema migration
-- — it is a one-time, idempotent data backfill for existing rows, safe to re-run, and it produces
-- exactly the same row shape the real pipeline would (mirrors planProductSearchProjectionDocument /
-- planOrderSearchProjectionDocument field-for-field, including the same active/hidden/deleted status
-- derivation). Going forward, any NEW product/order mutation still needs the real pipeline (or this
-- script re-run) to stay indexed — this backfill does not change that.
--
-- Run: docker exec -i supabase_db_supabase psql -U postgres -d postgres -f - < scripts/search/backfill-search-documents.sql

BEGIN;

INSERT INTO public.search_documents (
    site_id, object_type, object_id, title, subtitle, searchable_text, attributes,
    source_event_id, status, indexed_at, deleted_at
)
SELECT
    p.store_id,
    'product',
    p.id::text,
    COALESCE(p.name, ''),
    NULLIF(COALESCE(p.sku, p.category), ''),
    trim(concat_ws(
        ' ',
        p.name,
        p.description,
        p.sku,
        p.category,
        p.product_type,
        p.vendor,
        array_to_string(COALESCE(p.tags, ARRAY[]::text[]), ' ')
    )),
    jsonb_build_object(
        'price', p.price,
        'category', p.category,
        'product_type', p.product_type,
        'vendor', p.vendor,
        'tags', to_jsonb(COALESCE(p.tags, ARRAY[]::text[]))
    ),
    gen_random_uuid(),
    CASE
        WHEN p.deleted_at IS NOT NULL OR p.is_active = false OR p.status = 'draft' THEN 'hidden'
        ELSE 'active'
    END,
    now(),
    NULL
FROM public.products p
ON CONFLICT (site_id, object_type, object_id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    searchable_text = EXCLUDED.searchable_text,
    attributes = EXCLUDED.attributes,
    source_event_id = EXCLUDED.source_event_id,
    status = EXCLUDED.status,
    indexed_at = EXCLUDED.indexed_at,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = now();

INSERT INTO public.search_documents (
    site_id, object_type, object_id, title, subtitle, searchable_text, attributes,
    source_event_id, status, indexed_at, deleted_at
)
SELECT
    o.store_id,
    'order',
    o.id::text,
    COALESCE(o.order_number, o.id::text),
    o.customer_email,
    trim(concat_ws(
        ' ',
        o.order_number,
        o.customer_name,
        o.customer_email,
        o.status,
        o.total::text
    )),
    jsonb_build_object(
        'status', o.status,
        'total', o.total,
        'customer_email', o.customer_email
    ),
    gen_random_uuid(),
    CASE WHEN o.deleted_at IS NOT NULL THEN 'deleted' ELSE 'active' END,
    now(),
    o.deleted_at
FROM public.orders o
ON CONFLICT (site_id, object_type, object_id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    searchable_text = EXCLUDED.searchable_text,
    attributes = EXCLUDED.attributes,
    source_event_id = EXCLUDED.source_event_id,
    status = EXCLUDED.status,
    indexed_at = EXCLUDED.indexed_at,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = now();

COMMIT;
