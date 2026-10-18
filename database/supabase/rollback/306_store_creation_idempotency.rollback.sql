-- Preserve stores themselves; this rollback removes only the replay metadata.
BEGIN;

DROP INDEX IF EXISTS public.sites_custom_user_store_creation_idempotency_key_idx;
ALTER TABLE public.sites
  DROP CONSTRAINT IF EXISTS sites_store_creation_idempotency_pair_check,
  DROP COLUMN IF EXISTS store_creation_idempotency_key,
  DROP COLUMN IF EXISTS store_creation_request_hash;

COMMIT;
