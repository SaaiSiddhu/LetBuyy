-- Remove only this RPC. Retain consumed counters, lockout state, sessions and audits.
-- Reapplication must not forget an accepted OTP or a current attempt lockout.
BEGIN;
DO $later$ BEGIN IF to_regprocedure('public.complete_console_mfa_v1(uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text,bigint,text)') IS NOT NULL THEN RAISE EXCEPTION '326 requires rolling back configured-factor migration329 first';END IF;END $later$;
DROP FUNCTION IF EXISTS public.complete_console_mfa_v1(uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text,bigint);
NOTIFY pgrst,'reload schema';
COMMIT;
