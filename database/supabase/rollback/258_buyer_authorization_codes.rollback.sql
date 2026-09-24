-- Rollback of 258: remove first-party buyer authorization codes.
--
-- Destructive only where 258 created the data: any code not yet redeemed stops working, which a
-- storefront sees as a failed sign-in that the buyer can retry. Sessions already minted from redeemed
-- codes are tokens, not rows, and keep working until they expire. identity-platform's authorize and
-- token routes must be rolled back with this, or every storefront sign-in fails at issue.

BEGIN;

DROP FUNCTION IF EXISTS public.issue_buyer_authorization_code(uuid, text, text, uuid, text);
DROP FUNCTION IF EXISTS public.redeem_buyer_authorization_code(text, text, text, text);

DROP TABLE IF EXISTS public.buyer_authorization_codes;

COMMIT;
