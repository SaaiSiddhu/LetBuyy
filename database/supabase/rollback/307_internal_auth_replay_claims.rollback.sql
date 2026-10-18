-- Remove the shared internal-auth replay claim store and function.

BEGIN;

DROP FUNCTION IF EXISTS public.consume_internal_auth_replay_jti(text, text, integer);
DROP TABLE IF EXISTS public.internal_auth_replay_claims;

COMMIT;
