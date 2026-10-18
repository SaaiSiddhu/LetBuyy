-- Fail closed on rollback: dropping the function disables the paid marketplace strip.
-- Restoring 232's prior implementation would re-expose unapproved marketplace products.
BEGIN;
DROP FUNCTION IF EXISTS public.marketplace_sponsored_products(integer);
COMMIT;
