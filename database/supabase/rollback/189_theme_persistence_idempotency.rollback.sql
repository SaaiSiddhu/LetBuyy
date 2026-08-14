-- Rollback for 189_theme_persistence_idempotency.sql
-- Drops the publish dedup index and the nullable idempotency_key column 189 added to theme_releases.
--
-- Note: reverting removes the only DB-level guard against duplicate "ghost" releases from a client
-- double-submit or a network retry — the TS pre-check in the gateway becomes the sole defence.
-- Every theme_releases row and the whole release history survive; only the recorded dedup keys are
-- lost, and a retry that reused one is no longer recognised as a duplicate.
--
-- Non-destructive to release history: no table or row is dropped. Re-runnable (IF EXISTS on both).

DROP INDEX IF EXISTS public.idx_theme_releases_idempotency;

ALTER TABLE public.theme_releases
    DROP COLUMN IF EXISTS idempotency_key;
