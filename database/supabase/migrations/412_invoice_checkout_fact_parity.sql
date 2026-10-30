-- Immutable order/line GST facts drive invoice totals; delivery and inclusive tax are preserved.
BEGIN;
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
  -- Follow checkout's site -> order lock order, including direct invoice retries.
  SELECT s.* INTO v_site FROM public.sites s
    JOIN public.orders o ON o.store_id=s.id
   WHERE o.id=p_order_id AND o.deleted_at IS NULL
   FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  SELECT * INTO v_order FROM orders
    WHERE id = p_order_id AND store_id=v_site.id AND deleted_at IS NULL FOR UPDATE;
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

  -- The site lock also serialises invoice-number allocation for this merchant.
  IF v_site.gstin IS NULL OR v_site.gst_state_code IS NULL THEN
    RAISE EXCEPTION 'store has no GST registration configured';
  END IF;

  v_invoice_number := COALESCE(v_site.invoice_prefix, 'LBY') || '-' || lpad(v_site.invoice_number_next::text, 6, '0');

  UPDATE sites SET invoice_number_next = invoice_number_next + 1 WHERE id = v_site.id;

  -- Aggregate tax figures come from order_tax_lines (T13's authoritative CGST/SGST/IGST
  -- breakdown) and orders.tax/subtotal/discount -- never recomputed here.
  SELECT
    COALESCE(SUM(CASE WHEN otl.title = 'CGST' THEN round(otl.amount * 100) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN otl.title IN ('SGST','UTGST') THEN round(otl.amount * 100) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN otl.title = 'IGST' THEN round(otl.amount * 100) ELSE 0 END), 0)
    INTO v_cgst_minor, v_sgst_minor, v_igst_minor
    FROM order_tax_lines otl
   WHERE otl.order_id = p_order_id
     AND otl.site_id = v_order.store_id
     AND otl.deleted_at IS NULL;

  v_tax_minor := round(v_order.tax * 100);
  IF v_order.tax_snapshot->>'version'='1' THEN
    v_total_minor := (v_order.tax_snapshot->>'total_minor')::bigint;
    v_taxable_amount_minor := v_total_minor-v_tax_minor;
    IF v_tax_minor<>(v_order.tax_snapshot->>'tax_minor')::bigint
       OR v_tax_minor<>v_cgst_minor+v_sgst_minor+v_igst_minor THEN
      RAISE EXCEPTION 'INVOICE_ORDER_FACTS_MISMATCH';
    END IF;
  ELSE
    -- Historical amounts remain as recorded. Include delivery in the documented total;
    -- never infer a missing past rate or rewrite a historical financial record.
    v_taxable_amount_minor := round((coalesce(v_order.subtotal,0)-coalesce(v_order.discount,0)+coalesce(v_order.shipping_cost,0))*100);
    v_total_minor := v_taxable_amount_minor+v_tax_minor;
  END IF;
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
           'unit_amount_minor', round(COALESCE(oi.unit_price, oi.price, 0) * 100),
           'discount_amount_minor', (oi.tax_snapshot->>'discount_minor')::bigint,
           'taxable_amount_minor', (oi.tax_snapshot->>'taxable_minor')::bigint,
           'gst_rate_bps', (oi.tax_snapshot->>'gst_rate_bps')::integer,
           'cgst_amount_minor', (oi.tax_snapshot->>'cgst_minor')::bigint,
           'sgst_amount_minor', (oi.tax_snapshot->>'sgst_minor')::bigint,
           'igst_amount_minor', (oi.tax_snapshot->>'igst_minor')::bigint,
           'tax_amount_minor', (oi.tax_snapshot->>'tax_minor')::bigint,
           'total_amount_minor', (oi.tax_snapshot->>'taxable_minor')::bigint+(oi.tax_snapshot->>'tax_minor')::bigint
         )), '[]'::jsonb)
    INTO v_lines
    FROM order_items oi
   WHERE oi.order_id = p_order_id
     AND oi.site_id = v_order.store_id
     AND oi.deleted_at IS NULL;

  v_supplier := CASE WHEN v_order.tax_snapshot->>'version'='1' THEN v_order.tax_snapshot->'supplier' ELSE jsonb_build_object(
    'name', COALESCE(v_site.name, v_site.store_name, 'LetBuyy merchant'),
    'gstin', v_site.gstin,
    'state_code', v_site.gst_state_code, 'address', v_site.invoice_address
  ) END;
  IF v_order.tax_snapshot->>'version'='1' AND (v_order.tax_snapshot->>'shipping_minor')::bigint>0 THEN
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object('description','Delivery', 'quantity',1,
      'unit_amount_minor',(v_order.tax_snapshot->>'shipping_minor')::bigint,
      'discount_amount_minor',(v_order.tax_snapshot->>'shipping_discount_minor')::bigint,
      'taxable_amount_minor',(v_order.tax_snapshot->>'shipping_taxable_minor')::bigint,
      'tax_amount_minor',(v_order.tax_snapshot->>'shipping_tax_minor')::bigint,
      'total_amount_minor',(v_order.tax_snapshot->>'shipping_taxable_minor')::bigint+(v_order.tax_snapshot->>'shipping_tax_minor')::bigint));
  END IF;
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
    jsonb_build_object('source', 'issue_gst_invoice', 'request_id', p_request_id, 'tax_snapshot_version',v_order.tax_snapshot->>'version', 'quote_fingerprint',v_order.tax_snapshot->>'fingerprint', 'irp_submitted',false),
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


DO $$
DECLARE f regprocedure:='public.create_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,bigint)'::regprocedure; d text;
BEGIN
  SELECT pg_get_functiondef(f) INTO d;
  IF position('v_authoritative_quote' IN d)=0 THEN RAISE EXCEPTION 'Invoice requires authoritative GST'; END IF;
  d:=replace(d,'    RETURN v_order_json;',
    '    IF v_authoritative_quote->>''collection_status''=''configured'' THEN
       PERFORM public.issue_gst_invoice(v_order_id,p_actor_id,p_request_id);
       SELECT to_jsonb(o) INTO v_order_json FROM public.orders o WHERE o.id=v_order_id AND o.store_id=p_store_id;
     END IF;
     RETURN v_order_json;');
  EXECUTE d;
END; $$;

DO $$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.capture_order_lifecycle_email_v1()'::regprocedure) INTO d;
 d:=replace(d,'''tax_amount'',coalesce(o.tax,0)', '''tax_amount'',coalesce(o.tax,0),''tax_included_amount'',coalesce((o.tax_snapshot->>''included_tax_minor'')::numeric/100,0)');
 EXECUTE d;
END; $$;
COMMIT;
