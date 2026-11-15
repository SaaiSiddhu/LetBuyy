-- The UP overwrote mutable plan and entitlement rows without preserving preimages,
-- and appended pricing history. Inventing old prices or deleting history is unsafe.
-- Use an approved forward catalog correction; historical rollback requires the
-- actual pre-migration backup and a retained-data restore rehearsal.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$ BEGIN
  RAISE EXCEPTION 'rollback 183 refuses: pricing preimages are unavailable; approved forward fix or verified pre-migration restore required'
    USING ERRCODE = '55000';
END $guard$;
ROLLBACK;
