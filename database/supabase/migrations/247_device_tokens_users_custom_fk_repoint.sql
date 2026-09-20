-- Continues the stale-FK cleanup started in 208/employees and 209/notification_preferences
-- (from the users_custom cutover lineage): device_tokens.user_id still carries its
-- pre-cutover baseline FK -- REFERENCES auth.users(id) -- from when LetBuyy authenticated
-- merchants through Supabase Auth. That migrated away: identity-platform is now the sole
-- token issuer, and services/api-gateway resolves the calling user to
-- public.users_custom.id (services/api-gateway/src/lib/auth-user.ts's resolveCustomUser());
-- every gateway route reads that value off `auth.user.id` (set by the session middleware in
-- services/api-gateway/src/middleware/auth.ts).
--
-- services/api-gateway/src/routes/notifications.ts's POST /notifications/device-tokens
-- handler (mobile push-token registration -- a live, unstubbed route) upserts
-- `user_id: auth.user.id` straight into device_tokens.user_id, which the stale FK rejects:
-- the same defect class closed in 208/209, this time waiting on the first real mobile push
-- registration rather than already reproduced.
--
-- Repoints to public.users_custom(id), matching the FK convention established in 208/209.
-- ON DELETE CASCADE is preserved -- a device-token row belongs to that user's account, so
-- deleting the account should delete the row with it (same reasoning as 208's
-- employees.user_id).
--
-- Verified against the live local database before writing this: device_tokens has zero
-- rows, so there is no orphaned data and no backfill is needed -- a straight DROP + ADD is
-- safe. Zero production merchants overall, per the Constitution.

BEGIN;

ALTER TABLE public.device_tokens
    DROP CONSTRAINT IF EXISTS device_tokens_user_id_fkey;

ALTER TABLE public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;

COMMIT;
