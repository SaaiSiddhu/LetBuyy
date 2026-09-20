-- Continues the stale-FK cleanup started in 208/employees and 209(prior branch)/
-- notification_preferences, on the SECURITY-SENSITIVE super_admin_allowlist table --
-- individually scrutinised rather than folded into the batch of dormant columns (see 211),
-- per the different trust boundary this table sits behind.
--
-- super_admin_allowlist.created_by and .user_id still carry their pre-cutover baseline FK
-- -- REFERENCES auth.users(id) -- from when LetBuyy authenticated merchants through
-- Supabase Auth. That migrated away: identity-platform is now the sole token issuer, and
-- every gateway read of a caller's identity resolves to public.users_custom.id.
--
-- This table has NO application write path anywhere in the repo (grepped services/*/src and
-- apps/*/src): 000_baseline.sql's RLS locks it to `REVOKE ALL ... FROM PUBLIC, anon,
-- authenticated` / `GRANT ALL ... TO service_role`, with `authenticated` writes additionally
-- gated by `is_super_admin()`. Entries are added out-of-band by an operator with
-- service_role access, not by any API route -- that write-path restriction is the actual
-- trust boundary here, and this migration does not change it (no policy, grant, or
-- application code is touched).
--
-- What this migration confirms is the ID SPACE the column is compared against at read time,
-- which is a separate question from who may write it: services/api-gateway/src/middleware/
-- rbac.ts's loadEffectivePermissionScopes(db, auth.user.id, ...) is the sole caller of
-- hasOpsAllowlistEntry(), which queries `.eq('user_id', userId)` -- and auth.user.id is
-- public.users_custom.id everywhere in this gateway (services/api-gateway/src/lib/
-- auth-user.ts's resolveCustomUser(), services/api-gateway/src/middleware/auth.ts). Nothing
-- in this codebase ever populates auth.users (identity-platform never calls Supabase Auth's
-- admin/signup APIs; auth.users has zero rows live). So the stale FK does not protect a
-- genuinely separate identity space -- it is the same defect class as 208/209/210/211,
-- just behind a narrower write boundary: today an operator seeding
-- `user_id = '<a users_custom.id>'` (to promote an existing merchant/staff account to super
-- admin) would be rejected by this constraint, since that id was never in auth.users.
--
-- Repoints both columns to public.users_custom(id). ON DELETE CASCADE is preserved for
-- user_id (deleting the underlying account should revoke the super-admin grant with it --
-- the correct security default, unchanged from baseline). created_by moves from the
-- baseline's implicit NO ACTION to SET NULL, matching the attribution convention 208
-- established (deleting the operator who added an allowlist entry must not be blocked by
-- the entries they created).
--
-- Verified against the live local database before writing this: super_admin_allowlist has
-- zero rows, so there is no orphaned data and no backfill is needed -- a straight DROP + ADD
-- is safe. Zero production merchants overall, per the Constitution. No RLS policy, GRANT, or
-- REVOKE statement is touched by this migration -- the write-access trust boundary is
-- unchanged.

BEGIN;

ALTER TABLE public.super_admin_allowlist
    DROP CONSTRAINT IF EXISTS super_admins_created_by_fkey,
    DROP CONSTRAINT IF EXISTS super_admins_user_id_fkey;

ALTER TABLE public.super_admin_allowlist
    ADD CONSTRAINT super_admins_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    ADD CONSTRAINT super_admins_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;

COMMIT;
