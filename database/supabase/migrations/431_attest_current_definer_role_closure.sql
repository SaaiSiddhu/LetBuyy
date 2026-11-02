-- 427 — Attest exact current SECURITY DEFINER role closure after the Wave 6
-- invoice, gift-card, and KYC function replacements. Refuse an unexpected
-- open ACL instead of silently changing live provider or policy authority.
-- This migration changes no ACL in an admitted database; the named REVOKEs
-- make the source closure contract explicit and idempotent.
BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $acl_427$
DECLARE
  v_target record;
  v_fn record;
BEGIN
  FOR v_target IN SELECT signature, result_type FROM (VALUES
    ('public.issue_gst_invoice(uuid,uuid,text)', 'jsonb'),
    ('public.issue_gift_card(uuid,text,numeric,text,timestamp with time zone,jsonb,uuid,text,text)', 'jsonb'),
    ('public.revoke_kyc_on_profile_change_v1()', 'trigger'),
    ('public.queue_replaced_kyc_private_object_v1()', 'trigger')
  ) AS targets(signature, result_type) LOOP
    SELECT p.* INTO v_fn FROM pg_catalog.pg_proc p
     WHERE p.oid = pg_catalog.to_regprocedure(v_target.signature);
    IF NOT FOUND OR NOT v_fn.prosecdef OR v_fn.prokind <> 'f'
       OR v_fn.proretset
       OR v_fn.prorettype IS DISTINCT FROM pg_catalog.to_regtype(v_target.result_type) THEN
      RAISE EXCEPTION '427 refuses unexpected definer function ABI: %', v_target.signature;
    END IF;
    IF pg_catalog.has_function_privilege('anon', v_fn.oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', v_fn.oid, 'EXECUTE')
       OR EXISTS (
         SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(v_fn.proacl, pg_catalog.acldefault('f', v_fn.proowner))) a
          WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
       ) THEN
      RAISE EXCEPTION '427 refuses open Data API definer ACL: %', v_target.signature;
    END IF;
  END LOOP;
END;
$acl_427$;

REVOKE ALL ON FUNCTION public.issue_gst_invoice(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_gift_card(uuid,text,numeric,text,timestamp with time zone,jsonb,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_kyc_on_profile_change_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_replaced_kyc_private_object_v1() FROM PUBLIC, anon, authenticated;
COMMIT;
