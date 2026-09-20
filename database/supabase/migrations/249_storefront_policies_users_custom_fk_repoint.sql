-- Continues the stale-FK cleanup started in 208/employees and 209(prior branch)/
-- notification_preferences: storefront_policies.created_by and .updated_by still carry
-- their pre-cutover baseline FK -- REFERENCES auth.users(id) -- from when LetBuyy
-- authenticated merchants through Supabase Auth. That migrated away: identity-platform
-- is now the sole token issuer, and services/api-gateway resolves the calling merchant to
-- public.users_custom.id via resolveCustomUser() (services/api-gateway/src/lib/auth-user.ts).
--
-- services/api-gateway/src/routes/pages.ts's POST /policies (upsert, line ~439), PATCH
-- /policies/:id (update, line ~503) and DELETE /policies/:id (archive, line ~538) handlers
-- all write `created_by`/`updated_by`: customUser.id straight into storefront_policies,
-- which the stale FK rejects on every single call -- an upsert onConflict
-- 'store_id,policy_type' that fails on the FK exactly the way notification_preferences'
-- onConflict upsert failed before 209. Same defect class, this time on the merchant policy
-- editor (shipping/refund/privacy/terms pages).
--
-- Repoints both to public.users_custom(id), matching the FK convention established in
-- 208/209. ON DELETE SET NULL is preserved for both columns (attribution, not ownership --
-- deleting the editor's account must not be blocked by every policy they ever touched).
--
-- Verified against the live local database before writing this: storefront_policies has
-- zero rows, so there is no orphaned data and no backfill is needed -- a straight DROP +
-- ADD is safe. Zero production merchants overall, per the Constitution.

BEGIN;

ALTER TABLE public.storefront_policies
    DROP CONSTRAINT IF EXISTS storefront_policies_created_by_fkey,
    DROP CONSTRAINT IF EXISTS storefront_policies_updated_by_fkey;

ALTER TABLE public.storefront_policies
    ADD CONSTRAINT storefront_policies_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    ADD CONSTRAINT storefront_policies_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

COMMIT;
