-- Run only after stopping new mobile requests and draining their 15-minute lifetime.
-- Existing canonical users, sessions, sites and JTI witnesses are preserved.
BEGIN;
-- Forward ACL attestation has no privilege delta. Refuse drift rather than
-- opening existing invoice/gift-card functions during native rollback.
DO $native418_acl_down$
DECLARE
  v_target record;
  v_fn record;
BEGIN
  FOR v_target IN SELECT signature, result_type FROM (VALUES
    ('public.issue_gst_invoice(uuid,uuid,text)', 'jsonb'),
    ('public.issue_gift_card(uuid,text,numeric,text,timestamp with time zone,jsonb,uuid,text,text)', 'jsonb')
  ) AS targets(signature, result_type) LOOP
    SELECT p.* INTO v_fn FROM pg_catalog.pg_proc p
     WHERE p.oid = pg_catalog.to_regprocedure(v_target.signature);
    IF NOT FOUND OR NOT v_fn.prosecdef OR v_fn.prokind <> 'f'
       OR v_fn.proretset
       OR v_fn.prorettype IS DISTINCT FROM pg_catalog.to_regtype(v_target.result_type) THEN
      RAISE EXCEPTION '418 native auth ACL rollback refuses unexpected definer ABI: %', v_target.signature;
    END IF;
    IF pg_catalog.has_function_privilege('anon', v_fn.oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', v_fn.oid, 'EXECUTE')
       OR EXISTS (
         SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(v_fn.proacl, pg_catalog.acldefault('f', v_fn.proowner))) a
          WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
       ) THEN
      RAISE EXCEPTION '418 native auth ACL rollback refuses open Data API definer ACL: %', v_target.signature;
    END IF;
  END LOOP;
END;
$native418_acl_down$;
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
