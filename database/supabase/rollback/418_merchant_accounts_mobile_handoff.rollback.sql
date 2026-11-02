-- Run only after stopping new mobile requests and draining their 15-minute lifetime.
-- Existing canonical users, sessions, sites and JTI witnesses are preserved.
BEGIN;
DROP FUNCTION IF EXISTS public.consume_merchant_login_factor(uuid,uuid,text,bigint,text);
ALTER TABLE public.merchant_2fa_factors DROP COLUMN IF EXISTS login_last_counter;
DROP FUNCTION IF EXISTS public.exchange_merchant_mobile_request(jsonb,uuid,text,text,timestamptz);
DROP FUNCTION IF EXISTS public.register_identity_merchant_session_v1(uuid,uuid,text,text,timestamptz);
DROP FUNCTION IF EXISTS public.inspect_merchant_mobile_exchange(jsonb);
DROP FUNCTION IF EXISTS public.complete_merchant_mobile_request(uuid,text,text,text,uuid);
DROP FUNCTION IF EXISTS public.approve_merchant_mobile_request(uuid,text,text);
DROP FUNCTION IF EXISTS public.bind_merchant_mobile_request(uuid,text,text);
DROP FUNCTION IF EXISTS public.cancel_merchant_mobile_request(uuid,text);
DROP FUNCTION IF EXISTS public.create_merchant_mobile_request(jsonb);
DROP TABLE IF EXISTS public.merchant_mobile_requests;
NOTIFY pgrst,'reload schema';
COMMIT;
