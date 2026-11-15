-- Do not turn unavailable plans back on during incident recovery. The overwritten
-- prior state and subsequent provider admission decisions cannot be inferred here.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$ BEGIN
  RAISE EXCEPTION 'rollback 186 refuses: plan availability needs an approved forward correction'
    USING ERRCODE = '55000';
END $guard$;
ROLLBACK;
