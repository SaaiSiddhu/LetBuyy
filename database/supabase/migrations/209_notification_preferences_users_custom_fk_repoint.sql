-- Fixes the same defect class closed in 208 for `employees`, this time on
-- notification_preferences: notification_preferences.user_id still carries
-- its pre-cutover baseline FK -- REFERENCES auth.users(id) -- from when
-- LetBuyy authenticated merchants through Supabase Auth. That migrated
-- away: identity-platform is now the sole token issuer, and
-- services/api-gateway/src/routes/notifications.ts's GET/PUT /preferences
-- handlers write auth.user.id (the identity-platform session subject,
-- which lives in users_custom.id-space, not auth.users.id-space) straight
-- into notification_preferences.user_id. Every PUT upsert
-- (`onConflict: 'user_id,store_id,channel,category'`) would fail the same
-- way POST /employees did before 208: an FK violation on every save,
-- reproduced while investigating the merchant Notifications settings page.
--
-- Repoints user_id to public.users_custom(id), matching the FK convention
-- established for every user-attribution column added since the
-- users_custom cutover (see 208 and e.g. 091_theme_marketplace_stepup.sql).
-- ON DELETE CASCADE is preserved -- a preference row belongs to that user's
-- account, so deleting the account should delete the row with it.
--
-- Verified against the live local database before writing this:
-- notification_preferences has zero rows and zero orphans against
-- users_custom, so a straight DROP + ADD is safe. Zero production
-- merchants overall, per the Constitution.

BEGIN;

ALTER TABLE public.notification_preferences
    DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;

ALTER TABLE public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;

COMMIT;
