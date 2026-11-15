-- Removing the matching shadow column breaks every mirrored outbox insert.
-- Keep the additive column and roll application code back compatibly, or forward-fix.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$ BEGIN
  RAISE EXCEPTION 'rollback 179 refuses: preserve outbox source/shadow compatibility; forward-fix required'
    USING ERRCODE = '55000';
END $guard$;
ROLLBACK;
