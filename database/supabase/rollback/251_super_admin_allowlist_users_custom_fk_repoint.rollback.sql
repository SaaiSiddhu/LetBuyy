-- Rollback for 251_super_admin_allowlist_users_custom_fk_repoint.sql. Restores the
-- baseline's auth.users(id) references and ON DELETE behaviour exactly, including
-- created_by's original implicit NO ACTION delete behaviour. Only use this if the
-- users_custom repoint is found to be wrong -- it reopens the exact defect this migration
-- closed: seeding super_admin_allowlist.user_id with a users_custom.id fails again with
-- super_admins_user_id_fkey.

BEGIN;

ALTER TABLE public.super_admin_allowlist
    DROP CONSTRAINT IF EXISTS super_admins_created_by_fkey,
    DROP CONSTRAINT IF EXISTS super_admins_user_id_fkey;

ALTER TABLE public.super_admin_allowlist
    ADD CONSTRAINT super_admins_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id),
    ADD CONSTRAINT super_admins_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;
