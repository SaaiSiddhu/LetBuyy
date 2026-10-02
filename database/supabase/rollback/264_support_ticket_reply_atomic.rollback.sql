-- Rollback of 264: remove the atomic support-ticket reply function.
--
-- Drops reply_to_support_ticket and nothing else: no table, row, index or policy was created by 264, and the privacy index
-- it relies on (migration 262) is untouched. The gateway's operator reply route (services/api-gateway/src/routes/operations/
-- support.ts) calls this function, so this rollback must ship with that route's rollback, or every operator reply fails.

BEGIN;

DROP FUNCTION IF EXISTS public.reply_to_support_ticket(uuid, uuid, text, text, text, text, uuid, jsonb, jsonb, text);

COMMIT;
