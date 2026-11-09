-- Removing this fix restores a broken authentication function. Preserve session
-- replay/rotation protections and recover with a reviewed forward correction.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$ BEGIN
  RAISE EXCEPTION 'rollback 175 refuses: preserve authentication search-path correctness; forward-fix required'
    USING ERRCODE = '55000';
END $guard$;
ROLLBACK;
