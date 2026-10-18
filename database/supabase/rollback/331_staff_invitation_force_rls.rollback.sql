-- Never reopen a table-owner bypass over retained invitation credentials.
BEGIN;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.employee_invites) THEN RAISE EXCEPTION '331 refuses retained staff invitation evidence';END IF;
END $guard$;
ALTER TABLE public.employee_invites NO FORCE ROW LEVEL SECURITY;
COMMIT;
