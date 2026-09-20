-- Rollback for 210_storefront_policies_users_custom_fk_repoint.sql. Restores the
-- baseline's auth.users(id) references and ON DELETE behaviour exactly. Only use this if
-- the users_custom repoint is found to be wrong -- it reopens the exact defect this
-- migration closed: every POST/PATCH/DELETE on storefront_policies fails again with
-- storefront_policies_created_by_fkey / storefront_policies_updated_by_fkey, since
-- resolveCustomUser() never returns an auth.users.id.

BEGIN;

ALTER TABLE public.storefront_policies
    DROP CONSTRAINT IF EXISTS storefront_policies_created_by_fkey,
    DROP CONSTRAINT IF EXISTS storefront_policies_updated_by_fkey;

ALTER TABLE public.storefront_policies
    ADD CONSTRAINT storefront_policies_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD CONSTRAINT storefront_policies_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;
