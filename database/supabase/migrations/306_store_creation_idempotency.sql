-- Bind bootstrap store creation retries to the authenticated owner and payload.
-- A new store has no site_id, so the normal site-scoped idempotency table cannot
-- claim POST /stores before the row exists. These nullable fields keep legacy
-- rows unchanged while making keyed creates uniquely replayable.
-- Rollback: database/supabase/rollback/306_store_creation_idempotency.rollback.sql

BEGIN;

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS store_creation_idempotency_key text,
  ADD COLUMN IF NOT EXISTS store_creation_request_hash text;

ALTER TABLE public.sites
  ADD CONSTRAINT sites_store_creation_idempotency_pair_check
  CHECK (
    (store_creation_idempotency_key IS NULL AND store_creation_request_hash IS NULL)
    OR (
      custom_user_id IS NOT NULL
      AND store_creation_idempotency_key IS NOT NULL
      AND store_creation_request_hash IS NOT NULL
      AND length(store_creation_idempotency_key) BETWEEN 8 AND 200
      AND store_creation_request_hash ~ '^[0-9a-f]{64}$'
    )
  );

CREATE UNIQUE INDEX sites_custom_user_store_creation_idempotency_key_idx
  ON public.sites (custom_user_id, store_creation_idempotency_key)
  WHERE store_creation_idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.sites.store_creation_idempotency_key IS
  'Optional owner-scoped replay key for POST /stores when the bootstrap response is lost.';
COMMENT ON COLUMN public.sites.store_creation_request_hash IS
  'SHA-256 of the canonical create-store request bound to store_creation_idempotency_key.';

COMMIT;
