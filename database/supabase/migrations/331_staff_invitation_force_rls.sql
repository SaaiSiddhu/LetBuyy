-- Final registry regeneration exposed a canonical invitation table missing FORCE.
-- Retain all existing policies, grants, token guards and rows.
BEGIN;
DO $guard$ BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.employee_invites'::regclass) THEN
  RAISE EXCEPTION '331 requires the existing invitation RLS policy boundary';END IF;
END $guard$;
ALTER TABLE public.employee_invites FORCE ROW LEVEL SECURITY;
COMMIT;
