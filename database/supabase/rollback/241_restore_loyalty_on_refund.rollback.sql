-- Rollback of 241: drop the loyalty refund restore.
--
-- Not destructive to data: refund credits already written stay, and the balance projection continues
-- to count them. It DOES restore the defect — a buyer refunded after paying with points would again
-- lose those points, while gift cards continue to be restored correctly, so the two stored-value
-- instruments would diverge again.

BEGIN;

DROP FUNCTION IF EXISTS public.restore_loyalty_on_refund(uuid, uuid, uuid, text);

COMMIT;
