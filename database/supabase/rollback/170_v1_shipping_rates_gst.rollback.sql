-- Recovery boundary, deliberately fail-closed: restoring the older checkout body can
-- remove shipping/GST authority and cannot undo orders already placed. Use a reviewed
-- forward fix, or restore the complete pre-migration backup into an isolated database
-- and qualify it before an explicitly approved cutover. Never replay 073 over current SQL.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$ BEGIN
  RAISE EXCEPTION 'rollback 170 refuses: checkout recovery requires an approved forward fix or verified pre-migration restore'
    USING ERRCODE = '55000';
END $guard$;
ROLLBACK;
