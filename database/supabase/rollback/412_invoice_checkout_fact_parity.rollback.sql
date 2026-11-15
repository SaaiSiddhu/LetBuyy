BEGIN;
-- Refuse ABI drift before any schema mutation; CREATE OR REPLACE must not add an overload.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('issue_gst_invoice', 'public.issue_gst_invoice(uuid,uuid,text)', ARRAY['p_order_id','p_actor_id','p_request_id']::text[], 'jsonb', false),
    ('capture_order_lifecycle_email_v1', 'public.capture_order_lifecycle_email_v1()', ARRAY[]::text[], 'trigger', false)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 412 refuses to run: % signature or overload set changed', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid = pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 412 refuses to run: % input names or result ABI changed', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;
DO $$
DECLARE f regprocedure:='public.create_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,bigint)'::regprocedure; d text;
BEGIN
  IF EXISTS(SELECT 1 FROM gst_invoices WHERE metadata->>'tax_snapshot_version'='1') THEN
    RAISE EXCEPTION 'Used invoice facts must be retained; use application rollback';
  END IF;
  SELECT pg_get_functiondef(f) INTO d;
  d:=replace(d,'    IF v_authoritative_quote->>''collection_status''=''configured'' THEN
       PERFORM public.issue_gst_invoice(v_order_id,p_actor_id,p_request_id);
       SELECT to_jsonb(o) INTO v_order_json FROM public.orders o WHERE o.id=v_order_id AND o.store_id=p_store_id;
     END IF;
     RETURN v_order_json;','    RETURN v_order_json;');
  EXECUTE d;
END; $$;
CREATE OR REPLACE FUNCTION public.issue_gst_invoice(
  p_order_id uuid,
  p_actor_id uuid DEFAULT NULL::uuid,
  p_request_id text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_site RECORD;
  v_invoice_number text;
  v_taxable_amount_minor bigint;
  v_cgst_minor bigint := 0;
  v_sgst_minor bigint := 0;
  v_igst_minor bigint := 0;
  v_tax_minor bigint;
  v_total_minor bigint;
  v_supply_type text;
  v_lines jsonb;
  v_supplier jsonb;
  v_recipient jsonb;
  v_invoice_id uuid;
  v_invoice_date timestamptz := now();
  v_irn text;
  v_qr_payload text;
  v_result jsonb;
BEGIN
  -- Locks the order row; also serialises concurrent issue attempts for the SAME order.
  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  -- Idempotent: return the existing invoice rather than raising, for a retried post-commit call.
  SELECT to_jsonb(gi) INTO v_result FROM gst_invoices gi WHERE gi.order_id = p_order_id AND gi.deleted_at IS NULL;
  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  IF v_order.place_of_supply_state IS NULL OR v_order.tax IS NULL THEN
    RAISE EXCEPTION 'order has no computed GST to invoice';
  END IF;

  -- Locks the site row: serialises concurrent invoice-number allocation for the SAME site.
  SELECT * INTO v_site FROM sites WHERE id = v_order.store_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'site not found';
  END IF;
  IF v_site.gstin IS NULL OR v_site.gst_state_code IS NULL THEN
    RAISE EXCEPTION 'store has no GST registration configured';
  END IF;

  v_invoice_number := COALESCE(v_site.invoice_prefix, 'LBY') || '-' || lpad(v_site.invoice_number_next::text, 6, '0');

  UPDATE sites SET invoice_number_next = invoice_number_next + 1 WHERE id = v_site.id;

  -- Aggregate tax figures come from order_tax_lines (T13's authoritative CGST/SGST/IGST
  -- breakdown) and orders.tax/subtotal/discount -- never recomputed here.
  SELECT
    COALESCE(SUM(CASE WHEN otl.title = 'CGST' THEN round(otl.amount * 100) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN otl.title = 'SGST' THEN round(otl.amount * 100) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN otl.title = 'IGST' THEN round(otl.amount * 100) ELSE 0 END), 0)
    INTO v_cgst_minor, v_sgst_minor, v_igst_minor
    FROM order_tax_lines otl
   WHERE otl.order_id = p_order_id
     AND otl.site_id = v_order.store_id
     AND otl.deleted_at IS NULL;

  v_tax_minor := round(v_order.tax * 100);
  v_taxable_amount_minor := round((COALESCE(v_order.subtotal, 0) - COALESCE(v_order.discount, 0)) * 100);
  v_total_minor := v_taxable_amount_minor + v_tax_minor;
  v_supply_type := CASE WHEN v_cgst_minor > 0 OR v_sgst_minor > 0 THEN 'intra_state' ELSE 'inter_state' END;

  -- Per-item display lines only (product/sku/hsn/qty/price) -- no per-line tax recomputation.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', oi.id,
           'product_id', oi.product_id,
           'variant_id', oi.variant_id,
           'description', COALESCE(oi.title, oi.name, 'Order item'),
           'sku', oi.sku,
           'hsn_code', oi.hsn_code,
           'quantity', oi.quantity,
           'unit_amount_minor', round(COALESCE(oi.unit_price, oi.price, 0) * 100)
         )), '[]'::jsonb)
    INTO v_lines
    FROM order_items oi
   WHERE oi.order_id = p_order_id
     AND oi.site_id = v_order.store_id
     AND oi.deleted_at IS NULL;

  v_supplier := jsonb_build_object(
    'name', COALESCE(v_site.name, v_site.store_name, 'LetBuyy merchant'),
    'gstin', v_site.gstin,
    'state_code', v_site.gst_state_code
  );
  v_recipient := jsonb_build_object(
    'name', COALESCE(v_order.customer_name, v_order.customer_email, 'Customer'),
    'gstin', v_order.customer_gstin,
    'state_code', v_order.place_of_supply_state,
    'address', v_order.shipping_address
  );

  -- Sandbox-only, deterministic, locally-computed placeholder -- never a real IRP submission.
  -- pgcrypto's digest() lives in the `extensions` schema, not `public` -- this function's own
  -- `SET search_path TO 'public'` hides it unless fully qualified. Discovered empirically (the
  -- unqualified call failed live: "function digest(text, unknown) does not exist"). Noted, not
  -- fixed: create_checkout_order's gift-card redemption path (000_baseline.sql) calls
  -- digest(p_gift_card_code, 'sha256') the SAME unqualified way under the SAME search_path --
  -- the identical latent bug, apparently never exercised by any gift-card purchase to date.
  -- Out of scope for this phase (GST invoicing, not gift cards) -- flagged for a future phase.
  v_irn := 'SANDBOX-IRN-' || upper(substr(encode(extensions.digest(v_invoice_number || ':' || p_order_id::text, 'sha256'), 'hex'), 1, 16));
  v_qr_payload := 'letbuyy://gst-invoice/' || v_irn;

  INSERT INTO gst_invoices (
    site_id, order_id, invoice_number, invoice_date, currency,
    supplier, recipient, place_of_supply_state_code, supply_type, lines,
    taxable_amount_minor, cgst_amount_minor, sgst_amount_minor, igst_amount_minor,
    tax_amount_minor, total_amount_minor, marketplace_tcs_bps, tcs_amount_minor,
    irp_mode, irn, qr_payload, provider_ack, status, invoice, metadata, created_by
  ) VALUES (
    v_order.store_id, p_order_id, v_invoice_number, v_invoice_date, COALESCE(v_order.currency, 'INR'),
    v_supplier, v_recipient, v_order.place_of_supply_state, v_supply_type, v_lines,
    v_taxable_amount_minor, v_cgst_minor, v_sgst_minor, v_igst_minor,
    v_tax_minor, v_total_minor, 0, 0,
    'sandbox', v_irn, v_qr_payload, '{}'::jsonb, 'generated',
    jsonb_build_object('invoice_number', v_invoice_number, 'order_id', p_order_id, 'total_amount_minor', v_total_minor),
    jsonb_build_object('source', 'issue_gst_invoice', 'request_id', p_request_id),
    p_actor_id
  )
  RETURNING id INTO v_invoice_id;

  UPDATE orders
     SET gst_invoice_number = v_invoice_number,
         updated_at = now()
   WHERE id = p_order_id;

  SELECT to_jsonb(gi) INTO v_result FROM gst_invoices gi WHERE gi.id = v_invoice_id;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.capture_order_lifecycle_email_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE o public.orders; s public.sites; k text; receipt jsonb; lines jsonb; log_id uuid; intent_key text;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.status,NEW.payment_status,NEW.tracking_number,NEW.fulfillment_status,NEW.refund_status,NEW.return_status) IS NOT DISTINCT FROM
  (OLD.status,OLD.payment_status,OLD.tracking_number,OLD.fulfillment_status,OLD.refund_status,OLD.return_status) THEN RETURN NULL; END IF;
 SELECT * INTO o FROM public.orders WHERE id=NEW.id AND store_id=NEW.store_id AND deleted_at IS NULL;
 IF o.id IS NULL THEN RETURN NULL; END IF;
 IF o.site_id IS NOT NULL AND o.site_id<>o.store_id THEN RAISE EXCEPTION 'Order email site mismatch'; END IF;
 SELECT * INTO s FROM public.sites WHERE id=o.store_id AND deleted_at IS NULL;
 IF s.id IS NULL THEN RETURN NULL; END IF;
 intent_key:='order-email-v1:'||o.store_id::text||':'||o.id::text||':'||txid_current()::text;
 IF EXISTS(SELECT 1 FROM public.outbox_events WHERE idempotency_key=intent_key) THEN RETURN NULL; END IF;
 k:=CASE
  WHEN o.status='cancelled' THEN 'cancelled'
  WHEN TG_OP='INSERT' THEN 'placed'
  WHEN o.status IS DISTINCT FROM OLD.status AND o.status IN('confirmed','processing','shipped','delivered') THEN o.status
  WHEN o.refund_status IS DISTINCT FROM OLD.refund_status THEN 'refund_updated'
  WHEN o.return_status IS DISTINCT FROM OLD.return_status THEN 'return_updated'
  WHEN o.payment_status IS DISTINCT FROM OLD.payment_status AND o.payment_status='paid' THEN 'payment_received'
  WHEN o.payment_status IS DISTINCT FROM OLD.payment_status THEN 'payment_updated'
  WHEN o.tracking_number IS DISTINCT FROM OLD.tracking_number THEN 'tracking_updated'
  WHEN o.fulfillment_status IS DISTINCT FROM OLD.fulfillment_status THEN 'fulfilment_updated'
  ELSE NULL END;
 IF k IS NULL THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('name',coalesce(nullif(i.title,''),i.name),'quantity',i.quantity,'total',i.total)
  ORDER BY i.created_at,i.id),'[]'::jsonb) INTO lines FROM (
   SELECT * FROM public.order_items WHERE order_id=o.id AND store_id=o.store_id AND deleted_at IS NULL ORDER BY created_at,id LIMIT 250
  ) i;
 receipt:=jsonb_build_object('kind',k,'store_name',s.name,'order',jsonb_build_object(
  'id',o.id,'store_id',o.store_id,'order_number',o.order_number,'customer_name',o.customer_name,
  'status',o.status,'payment_status',o.payment_status,'fulfillment_status',o.fulfillment_status,'currency',coalesce(o.currency,'INR'),
  'subtotal',o.subtotal,'discount_amount',coalesce(o.discount,o.coupon_discount,0),
  'shipping_amount',coalesce(o.shipping_cost,0),'tax_amount',coalesce(o.tax,0),'total',o.total,
  'coupon_code',o.coupon_code,'tracking_number',o.tracking_number,'line_items',lines,
  'metadata',jsonb_build_object('refund_status',coalesce(o.refund_status,'none'),'return_status',coalesce(o.return_status,'none'))));
 INSERT INTO public.email_logs(site_id,recipient_email,recipient_hash,email_type,template_key,subject,status,
  idempotency_key,metadata,created_by,updated_by)
 VALUES(o.store_id,o.customer_email,encode(sha256(convert_to('email:'||lower(trim(o.customer_email)),'UTF8')),'hex'),
  'system','order_lifecycle_v1','Order update','pending',intent_key,
  jsonb_build_object('source','order-lifecycle-v1','order_id',o.id,'snapshot',receipt),o.updated_by,o.updated_by)
 RETURNING id INTO log_id;
 INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,actor_id)
 VALUES(o.store_id,o.store_id,'order',o.id::text,'order.lifecycle_email_queued',
  jsonb_build_object('site_id',o.store_id,'order_id',o.id,'email_log_id',log_id),intent_key,o.updated_by);
 RETURN NULL;
END $fn$;

COMMIT;
