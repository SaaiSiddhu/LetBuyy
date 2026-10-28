-- A pending hosted checkout keeps its original immutable credential version.
-- This is scope/history enforcement only: no financial posting or provider call.
ALTER TABLE public.payment_credentials ADD CONSTRAINT payment_credentials_site_reference_unique UNIQUE(id,site_id);
ALTER TABLE public.checkout_sessions ADD COLUMN payment_credential_id uuid,
 ADD CONSTRAINT checkout_payment_credential_scope_fk FOREIGN KEY(payment_credential_id,site_id)
  REFERENCES public.payment_credentials(id,site_id) ON DELETE RESTRICT,
 ADD CONSTRAINT checkout_payment_credential_scope_present CHECK(payment_credential_id IS NULL OR (site_id IS NOT NULL AND cart_id IS NOT NULL));
CREATE INDEX checkout_payment_credential_drain_idx ON public.checkout_sessions(site_id,payment_credential_id,checkout_state)
 WHERE payment_credential_id IS NOT NULL AND deleted_at IS NULL;

CREATE FUNCTION public.guard_checkout_payment_credential_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE c public.payment_credentials; s public.sites; v_id uuid; field text;
BEGIN
 IF TG_OP='UPDATE' AND OLD.payment_credential_id IS NOT NULL THEN
  IF (NEW.site_id,NEW.cart_id,NEW.payment_credential_id) IS DISTINCT FROM (OLD.site_id,OLD.cart_id,OLD.payment_credential_id) THEN
   RAISE EXCEPTION 'Checkout payment scope is immutable' USING ERRCODE='22023'; END IF;
  FOREACH field IN ARRAY ARRAY['credential_id','key_id','provider','mode','payment_intent_id','order_id','provider_order_id','amount_minor','currency','receipt'] LOOP
   IF OLD.payment_intent ? field AND OLD.payment_intent->field<>'null'::jsonb
    AND NEW.payment_intent->field IS DISTINCT FROM OLD.payment_intent->field THEN
    RAISE EXCEPTION 'Checkout payment binding is immutable' USING ERRCODE='22023';
   END IF;
  END LOOP;
 END IF;
 IF NEW.payment_intent->>'credential_id' IS NULL THEN
  IF NEW.payment_credential_id IS NOT NULL THEN RAISE EXCEPTION 'Checkout credential snapshot is required' USING ERRCODE='22023'; END IF;
  RETURN NEW; -- Explicit legacy read bridge, not an invented history backfill.
 END IF;
 v_id:=(NEW.payment_intent->>'credential_id')::uuid;
 IF NEW.payment_credential_id IS NOT NULL AND NEW.payment_credential_id<>v_id THEN
  RAISE EXCEPTION 'Checkout credential snapshot mismatch' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.payment_credentials WHERE id=v_id AND site_id=NEW.site_id
  AND provider='razorpay' AND mode='sandbox' AND deleted_at IS NULL FOR KEY SHARE;
 IF c.id IS NULL OR NEW.payment_intent->>'key_id' IS DISTINCT FROM c.provider_key_id
  OR NEW.payment_intent->>'provider' IS DISTINCT FROM 'razorpay' OR NEW.payment_intent->>'mode' IS DISTINCT FROM 'sandbox' THEN
  RAISE EXCEPTION 'Checkout credential scope mismatch' USING ERRCODE='22023'; END IF;
 IF TG_OP='INSERT' OR OLD.payment_credential_id IS NULL THEN
  -- Serialize this admission with a settings switch. Whichever commits first
  -- determines whether this is a new admitted attempt or a refused stale save.
  SELECT * INTO s FROM public.sites WHERE id=NEW.site_id AND deleted_at IS NULL FOR SHARE;
  SELECT * INTO c FROM public.payment_credentials WHERE id=v_id AND site_id=NEW.site_id
   AND provider='razorpay' AND mode='sandbox' AND deleted_at IS NULL FOR SHARE;
  IF s.id IS NULL OR s.online_payment_enabled IS DISTINCT FROM true OR c.status<>'active'
   OR NOT c.selected_for_checkout OR c.last_verified_at IS NULL
   OR s.payment_settings->'razorpay'->>'credential_id' IS DISTINCT FROM c.id::text THEN
   RAISE EXCEPTION 'Checkout connection is not selected' USING ERRCODE='22023'; END IF;
 END IF;
 NEW.payment_credential_id:=v_id;
 RETURN NEW;
END $fn$;
CREATE TRIGGER checkout_payment_credential_v1 BEFORE INSERT OR UPDATE ON public.checkout_sessions
 FOR EACH ROW EXECUTE FUNCTION public.guard_checkout_payment_credential_v1();
REVOKE ALL ON FUNCTION public.guard_checkout_payment_credential_v1() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.guard_checkout_payment_credential_v1() TO service_role;
NOTIFY pgrst,'reload schema';
