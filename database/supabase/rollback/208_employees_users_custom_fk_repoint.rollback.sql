-- Rollback for 208_employees_users_custom_fk_repoint.sql. Restores the
-- baseline's auth.users(id) references and ON DELETE behaviour exactly.
-- Only use this if the users_custom repoint is found to be wrong -- it
-- reopens the exact defect this migration closed: every POST /employees
-- call fails again with employees_created_by_fkey, since
-- resolveCustomUser() never returns an auth.users.id.

BEGIN;

ALTER TABLE public.employees
    DROP CONSTRAINT IF EXISTS employees_created_by_fkey,
    DROP CONSTRAINT IF EXISTS employees_user_id_fkey;

ALTER TABLE public.employees
    ADD CONSTRAINT employees_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id),
    ADD CONSTRAINT employees_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;
