-- Rollback of 257: remove buyer email challenges and the session epoch.
--
-- Destructive only where 257 created the data: buyer_email_challenges is dropped, open codes stop
-- working, and buyer_accounts loses session_epoch. After this, "sign out everywhere" has no effect and
-- a buyer token is again valid until it expires; the gateway must be rolled back with it, or its epoch
-- check will reject every buyer. email_verified values that 257's functions set stay set: they record
-- proofs that happened.

BEGIN;

DROP FUNCTION IF EXISTS public.start_buyer_email_challenge(uuid, text);
DROP FUNCTION IF EXISTS public.consume_buyer_email_challenge(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.revoke_buyer_sessions(uuid);

DROP TABLE IF EXISTS public.buyer_email_challenges;

ALTER TABLE public.buyer_accounts DROP CONSTRAINT IF EXISTS buyer_accounts_session_epoch_check;
ALTER TABLE public.buyer_accounts DROP COLUMN IF EXISTS session_epoch;

COMMIT;
