-- Rollback for 209_notification_preferences_users_custom_fk_repoint.sql.
-- Restores the baseline's auth.users(id) reference exactly. Only use this
-- if the users_custom repoint is found to be wrong -- it reopens the exact
-- defect this migration closed: every PUT /preferences call fails again
-- with notification_preferences_user_id_fkey, since the identity-platform
-- session subject written by notifications.ts is not an auth.users.id.

BEGIN;

ALTER TABLE public.notification_preferences
    DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;

ALTER TABLE public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;
