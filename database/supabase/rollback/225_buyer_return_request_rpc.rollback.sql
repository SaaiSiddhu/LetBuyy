-- Rollback of 225: drop the buyer return-request RPC.
--
-- Non-destructive: no data is removed. Any return_requests rows it created remain, and the merchant
-- routes in services/api-gateway/src/routes/returns.ts continue to manage them.

BEGIN;

DROP FUNCTION IF EXISTS public.request_order_return(uuid, uuid, text, text);

COMMIT;
