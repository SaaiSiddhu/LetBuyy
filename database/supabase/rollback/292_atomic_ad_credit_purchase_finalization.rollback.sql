-- Rollback of 292: remove the atomic finalizer. The additive provider-payment reference column and
-- its uniqueness index are retained so a rollback does not destroy payment audit evidence.

BEGIN;

DROP FUNCTION IF EXISTS public.finalize_ad_credit_purchase(uuid, uuid, text, text, text, uuid);

COMMIT;
