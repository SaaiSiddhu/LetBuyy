-- Rollback for 248_storefront_pages_users_custom_fk_repoint.sql. Restores the baseline's
-- auth.users(id) references and ON DELETE behaviour exactly. Only use this if the
-- users_custom repoint is found to be wrong -- it reopens the exact defect this migration
-- closed: every POST/PATCH/DELETE on storefront_pages fails again with
-- storefront_pages_created_by_fkey / storefront_pages_updated_by_fkey, since
-- resolveCustomUser() never returns an auth.users.id.

BEGIN;

ALTER TABLE public.storefront_pages
    DROP CONSTRAINT IF EXISTS storefront_pages_created_by_fkey,
    DROP CONSTRAINT IF EXISTS storefront_pages_updated_by_fkey;

ALTER TABLE public.storefront_pages
    ADD CONSTRAINT storefront_pages_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD CONSTRAINT storefront_pages_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;
