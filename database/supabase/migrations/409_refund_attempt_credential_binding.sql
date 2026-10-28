-- Extend the existing refund reservation owner in place. Its insert and this
-- trigger are one transaction. Never invent the connection of an old payment.
CREATE FUNCTION public.bind_refund_attempt_credential_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE pay public.payments;
BEGIN
 IF NEW.attempt_type<>'refund' OR NEW.payment_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO pay FROM public.payments WHERE id=NEW.payment_id AND site_id=NEW.site_id AND deleted_at IS NULL FOR KEY SHARE;
 IF pay.id IS NULL OR pay.provider<>NEW.provider OR pay.order_id<>NEW.order_id
  OR (NEW.credential_id IS NOT NULL AND NEW.credential_id IS DISTINCT FROM pay.credential_id)
  OR (NEW.credential_mode IS NOT NULL AND NEW.credential_mode IS DISTINCT FROM pay.mode) THEN
  RAISE EXCEPTION 'Refund payment credential scope mismatch' USING ERRCODE='22023'; END IF;
 NEW.credential_id:=pay.credential_id;
 NEW.credential_mode:=CASE WHEN pay.credential_id IS NULL THEN NULL ELSE pay.mode END;
 RETURN NEW;
END $fn$;
CREATE TRIGGER refund_attempt_credential_v1 BEFORE INSERT ON public.payment_attempts
 FOR EACH ROW EXECUTE FUNCTION public.bind_refund_attempt_credential_v1();
REVOKE ALL ON FUNCTION public.bind_refund_attempt_credential_v1() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.bind_refund_attempt_credential_v1() TO service_role;
NOTIFY pgrst,'reload schema';
