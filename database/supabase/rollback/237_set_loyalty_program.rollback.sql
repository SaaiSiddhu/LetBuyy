-- Rollback of 237: drop the loyalty programme writer and the site-wide projection.
--
-- Not destructive to data: no table, column or row is touched, and audit_logs rows already written
-- stay. It DOES restore the state 237 exists to end -- loyalty_programs would once again have no
-- writer, so loyalty could only be enabled by hand-written SQL and the earn sweeper would again find
-- no active programme at any store.

BEGIN;

DROP FUNCTION IF EXISTS public.set_loyalty_program(uuid, boolean, integer, integer, bigint, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.loyalty_outstanding_points(uuid);

COMMIT;
