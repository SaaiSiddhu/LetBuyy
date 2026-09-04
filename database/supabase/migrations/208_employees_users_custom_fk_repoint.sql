-- Fixes a live 500 on POST /employees (merchant "Add staff"):
-- employees.created_by and employees.user_id still carry their pre-cutover
-- baseline FK -- REFERENCES auth.users(id) (000_baseline.sql:21217-21245) --
-- from when LetBuyy authenticated merchants through Supabase Auth. That
-- migrated away: identity-platform is now the sole token issuer, and the
-- api-gateway resolves the calling merchant through
-- services/api-gateway/src/lib/auth-user.ts's resolveCustomUser(), which
-- reads public.users_custom and returns a users_custom.id -- never an
-- auth.users.id. services/api-gateway/src/routes/employee.ts's POST /
-- handler (via @letbuyy/auth-core's planEmployeeStaffCreate) inserts that
-- users_custom.id straight into employees.created_by, which the stale FK
-- then rejects on every single staff-invite attempt: "insert or update on
-- table employees violates foreign key constraint
-- employees_created_by_fkey" -- reproduced end to end from the
-- merchant-control-plane "Add staff" form.
--
-- employees.user_id carries the identical stale reference. No live write
-- path sets it today (POST / never populates it -- it is only meant to be
-- filled once staff-account activation exists), but it is the same defect
-- and would fail the same way the moment that path ships. Fixed here too
-- rather than left for a second incident.
--
-- Repoints both to public.users_custom(id), matching the FK convention
-- already established for every created_by/user_id column added since the
-- users_custom cutover (see e.g. 091_theme_marketplace_stepup.sql:
-- `created_by uuid REFERENCES public.users_custom(id) ON DELETE SET
-- NULL`). ON DELETE behaviour is preserved per column's own semantics:
-- user_id keeps CASCADE (an employee row IS that user's staff account --
-- deleting the account should delete the record with it); created_by moves
-- from the baseline's implicit NO ACTION to SET NULL, matching the sibling
-- convention (attribution, not ownership -- deleting the creator's account
-- must not be blocked by every record they ever created).
--
-- Verified against the live local database before writing this: `employees`
-- has zero rows (every attempt has been failing on this exact constraint),
-- so there is no orphaned data and no backfill is needed -- a straight
-- DROP + ADD is safe. Zero production merchants overall, per the
-- Constitution.

BEGIN;

ALTER TABLE public.employees
    DROP CONSTRAINT IF EXISTS employees_created_by_fkey,
    DROP CONSTRAINT IF EXISTS employees_user_id_fkey;

ALTER TABLE public.employees
    ADD CONSTRAINT employees_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    ADD CONSTRAINT employees_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;

COMMIT;
