-- 189 — Theme persistence: idempotency key on theme_releases (Phase P).
--
-- The publish_theme_release RPC inserts a release row unconditionally with no dedup guard.
-- Concurrent network retries or a client double-submit create duplicate "ghost" releases that
-- inflate the release history and can corrupt the is_current pointer race. All other
-- write tables in this system (checkout, orders, payments) carry an idempotency_key column;
-- this migration brings theme_releases in line.
--
-- Design:
--   1. ADD COLUMN IF NOT EXISTS idempotency_key text  — nullable; existing rows and the RPC
--      remain untouched at apply time. The TS gateway layer writes the value post-publish.
--   2. UNIQUE INDEX (store_id, idempotency_key) WHERE NOT NULL AND deleted_at IS NULL —
--      prevents a second key from being written for the same store+key, closing the common
--      sequential-retry case. Cross-tenant collision is structurally impossible because the
--      index is always scoped by store_id first.
--
-- Additive + idempotent:
--   * ADD COLUMN IF NOT EXISTS — safe to re-run on a DB that already has the column.
--   * CREATE UNIQUE INDEX IF NOT EXISTS — safe to re-run; no-op if index exists.
--   * No DROP / RENAME / TRUNCATE — passes migration-safety-validator.
--
-- RLS: no new policy needed.
--   * theme_releases_service_all (ALL for auth.role()='service_role') covers writes to the
--     new column; gateway always uses getSupabaseAdmin (service_role).
--   * theme_releases_owner_read (SELECT via sites JOIN) covers SELECT of the new column.
--   * theme_releases_public_current_read (SELECT WHERE is_current=true AND 'published') is
--     unchanged; no public USING(true) scope exists.
--
-- Tenant registry: no change.
--   * theme_releases is already registered at tenant-tables.registry.ts entry 2819.
--   * No new tenant table is introduced.
--
-- ARB gate: this migration must NOT be applied to production without ARB sign-off.
--   * Known TOCTOU residual: the TS-layer idempotency pre-check + this unique index prevent
--     a duplicate key being persisted, but do NOT prevent the RPC from running twice in the
--     ~1-5ms concurrent window, creating a second keyless release. Full closure requires
--     adding p_idempotency_key to the publish_theme_release SECURITY DEFINER RPC with
--     ON CONFLICT — that change is deferred to the ARB-approved follow-up.

ALTER TABLE public.theme_releases
    ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_releases_idempotency
    ON public.theme_releases (store_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
      AND deleted_at IS NULL;

COMMENT ON COLUMN public.theme_releases.idempotency_key IS
    'Optional caller-supplied dedup key (min 8, max 200 chars). '
    'The unique index on (store_id, idempotency_key) prevents duplicate publish retries '
    'for the same store within a session. Null for releases created without a key.';
