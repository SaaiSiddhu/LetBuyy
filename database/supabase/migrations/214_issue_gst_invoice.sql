-- T14/W0-W2: no invoice existed on any of 36 orders. W0 traced the chain live (placed a real
-- order, read the gateway's own log) and found `completeOrderPostCommitWork` -> `waitUntil` ->
-- `generateAndPersistGstInvoice` genuinely dispatches and genuinely executes -- this is NOT a
-- `wrangler dev` artifact, `waitUntil` semantics were never the problem. The function's own
-- `order_items` query (both the SELECT and a later UPDATE) carried no tenant predicate at all;
-- the app-layer tenant guard correctly rejected it every single time
-- ("Tenant table order_items requires a tenant/owner predicate before execution"), logged via
-- `event: storefront.checkout.post_commit_failed` on every order since this code shipped. A real
-- product defect, fixed directly in order-execution.adapter.ts (added `.eq('site_id', siteId)`
-- to both queries).
--
-- But fixing the tenant predicate alone would only unblock a computation that still disagrees
-- with T13's authoritative orders.tax/order_tax_lines (CAP-C48: no discount apportionment, no
-- HSN precedence, no charge_tax handling -- the pre-T13 logic). An invoice that disagrees with
-- the order it documents is worse than no invoice. This RPC replaces that TS-side recomputation
-- entirely: it reads T13's already-computed, already-correct figures directly
-- (orders.tax/subtotal/discount/place_of_supply_state, order_tax_lines' CGST/SGST/IGST
-- breakdown) and NEVER recomputes GST a second way -- the exact "two parallel implementations,
-- one wrong" pattern this whole programme keeps finding and closing.
--
-- Numbering: sites.invoice_number_next (000_baseline.sql, integer DEFAULT 1) is the schema's own
-- existing per-site counter -- used here, not reinvented. Allocated by locking the sites row
-- FOR UPDATE and incrementing in the SAME transaction as the gst_invoices INSERT, so two
-- concurrent orders for the same site cannot receive the same number (the second transaction
-- blocks on the row lock until the first commits, then sees the already-incremented value).
-- Format: "{invoice_prefix}-{next:06d}" (e.g. "LBY-000001"). NOT reset per financial year --
-- the schema provides one lifetime counter, not an FY-scoped one; implementing true per-FY-reset
-- numbering would need a schema change (e.g. a site_invoice_counters(site_id, financial_year)
-- table), a real design decision left to a future phase rather than invented here. What IS
-- guaranteed: uniqueness and gaplessness within this one continuous series, safe under real
-- concurrency (proven live, not with a sequential test).
--
-- IRN/QR: sandbox-only, deterministic, locally computed (no network call, no real IRP
-- submission) -- mirrors the existing buildSandboxIrpAcknowledgement pattern in
-- packages/checkout-core. Real e-invoicing submission stays behind the HUMAN-REQUIRED seam
-- HR-GST-IRP-LIVE (services/api-gateway/src/routes/tax.ts) -- untouched, out of envelope.
--
-- Canonical representation decision (W3): gst_invoices is canonical. orders.gst_invoice_number
-- is a thin, denormalized reference for cheap display (no join needed to show the number on an
-- order); orders.gst_invoice (the full JSONB blob) is intentionally NOT populated by this RPC --
-- a full duplicate of gst_invoices' content would be exactly the third "two implementations, one
-- unwired" shape this phase was told to avoid.
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
