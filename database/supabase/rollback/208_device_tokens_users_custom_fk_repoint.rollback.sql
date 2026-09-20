-- Rollback for 208_device_tokens_users_custom_fk_repoint.sql. Restores the baseline's
-- auth.users(id) reference and ON DELETE behaviour exactly. Only use this if the
-- users_custom repoint is found to be wrong -- it reopens the exact defect this migration
-- closed: every POST /notifications/device-tokens call fails again with
-- device_tokens_user_id_fkey, since resolveCustomUser() never returns an auth.users.id.

BEGIN;

ALTER TABLE public.device_tokens
    DROP CONSTRAINT IF EXISTS device_tokens_user_id_fkey;

ALTER TABLE public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;
