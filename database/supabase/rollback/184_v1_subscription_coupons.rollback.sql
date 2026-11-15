-- Retain coupon definitions and the redemption ledger, including seeded catalog
-- rows. Recover application compatibility additively; never erase usage history.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$ BEGIN
  RAISE EXCEPTION 'rollback 184 refuses: preserve coupon catalog and money history; forward-fix required'
    USING ERRCODE = '55000';
END $guard$;
ROLLBACK;
