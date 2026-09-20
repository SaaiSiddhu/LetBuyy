-- Continues the stale-FK cleanup started in 208/employees and 209(prior branch)/
-- notification_preferences: storefront_pages.created_by and .updated_by still carry
-- their pre-cutover baseline FK -- REFERENCES auth.users(id) -- from when LetBuyy
-- authenticated merchants through Supabase Auth. That migrated away: identity-platform
-- is now the sole token issuer, and services/api-gateway resolves the calling merchant to
-- public.users_custom.id via resolveCustomUser() (services/api-gateway/src/lib/auth-user.ts).
--
-- services/api-gateway/src/routes/pages.ts's POST / (create page, line ~347), PATCH /:id
-- (update, line ~660) and DELETE /:id (archive, line ~758) handlers all write
-- `created_by`/`updated_by`: customUser.id straight into storefront_pages, which the
-- stale FK rejects on every single call: "insert or update on table storefront_pages
-- violates foreign key constraint storefront_pages_created_by_fkey" -- the same defect
-- class closed for employees (208) and notification_preferences (209), this time on the
-- merchant page editor (create/edit/delete a storefront page).
--
-- Repoints both to public.users_custom(id), matching the FK convention established in
-- 208/209. ON DELETE SET NULL is preserved for both columns (attribution, not ownership --
-- deleting the editor's account must not be blocked by every page they ever touched).
--
-- Verified against the live local database before writing this: storefront_pages has zero
-- rows, so there is no orphaned data and no backfill is needed -- a straight DROP + ADD is
-- safe. Zero production merchants overall, per the Constitution.

BEGIN;

ALTER TABLE public.storefront_pages
    DROP CONSTRAINT IF EXISTS storefront_pages_created_by_fkey,
    DROP CONSTRAINT IF EXISTS storefront_pages_updated_by_fkey;

ALTER TABLE public.storefront_pages
    ADD CONSTRAINT storefront_pages_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    ADD CONSTRAINT storefront_pages_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

COMMIT;
