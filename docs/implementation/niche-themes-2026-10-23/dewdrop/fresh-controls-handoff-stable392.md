# Fresh Dewdrop finite control handoff — stable392

**PROPOSAL / NOT EXECUTED.** Root accepted S02 in principle and requested this one handoff. No actual new IDs are supplied. Only Root/Editor may bind and execute it after a separate finite owned-data grant at the H02 boundary. This file does not grant execution, create a harness, or establish a successful checkout.

Source inspected: `/private/tmp/theme-editor-stable392-20261024-02`, copy-only admission `docs/implementation/niche-theme-programme/editor-stable392-02-copy-admission.json`, migration ceiling392. Main updater WIP and393 are excluded.

## Order and preconditions

1. Complete the normal BuyerA H01 primary purchase and actual H02 retry checks; retain their request/status/one-effect receipts.
2. Accept a separate one-Pink v1 stale cart, before O03. Pause all other writers.
3. Root independently verifies the new owned runner/database/source/lease guard and binds only actual new IDs below. Capture active Tint v1 PDP as the current-facts positive.
4. Run this single, same-connection transaction once. It inserts a labelled historical-read fixture, never a cart, checkout session, payment, reservation or primary purchase.
5. BuyerA's real BFF/Liquid/merchant reads must positively show the legacy ID/name/quantity1 and missing-details guidance. After O03, repeat while Tint is still active/v2; then O04 archive. Keep primary and synthetic order counts separate.

Required psql variables, all supplied by Root after actual receipts: `site_id`, `owner_id`, `buyer_a_id`, `buyer_a_epoch`, `tint_product_id`, `pink_variant_id`, `expected_tint_version` (actual opaque token), `primary_order_id`, `stale_cart_id`, `legacy_order_id`, `legacy_item_id`. The last two are newly allocated UUIDs, not reused IDs. Root's runner/source/ownership guard is mandatory outside SQL; a site UUID alone is not authorization.

## Exact INSERT / SELECT recipe

No connection command or credentials are included. The caller uses its existing owned psql transport. Transaction-local QA settings hold comparison data inside PostgreSQL and return only booleans; no function/table/constraint/permission is created or disabled. Do not expose those private settings or full table rows. No UPDATE, DELETE, provider call, inventory RPC, checkout RPC, sequence reset, or automatic retry is part of the recipe.

```sql
\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT set_config('app.site_id', :'site_id', true) IS NOT NULL AS site_context_set;

SELECT (
  EXISTS (SELECT 1 FROM public.sites s WHERE s.id=:'site_id'::uuid
    AND s.deleted_at IS NULL
    AND (s.user_id::text=:'owner_id' OR s.custom_user_id::text=:'owner_id'))
  AND EXISTS (SELECT 1 FROM public.buyer_accounts b WHERE b.id=:'buyer_a_id'::uuid
    AND b.status='active' AND b.session_epoch=:'buyer_a_epoch'::bigint
    AND b.email LIKE '%@example.invalid')
  AND EXISTS (SELECT 1 FROM public.products p JOIN public.product_variants v ON v.product_id=p.id
    WHERE p.id=:'tint_product_id'::uuid AND p.store_id=:'site_id'::uuid
      AND p.is_active=true AND p.deleted_at IS NULL
      AND p.version=:'expected_tint_version'::bigint
      AND v.id=:'pink_variant_id'::uuid AND v.price=560)
  AND EXISTS (SELECT 1 FROM public.orders o JOIN public.buyer_order_links l ON l.order_id=o.id
    WHERE o.id=:'primary_order_id'::uuid AND o.store_id=:'site_id'::uuid
      AND o.site_id=:'site_id'::uuid AND l.site_id=:'site_id'::uuid
      AND l.buyer_account_id=:'buyer_a_id'::uuid AND o.total=1140
      AND o.payment_method='cod' AND o.payment_status='pending')
  AND EXISTS (SELECT 1 FROM public.carts c WHERE c.id=:'stale_cart_id'::uuid
    AND c.store_id=:'site_id'::uuid AND c.status='active'
    AND c.fact_acceptance_version=1 AND jsonb_array_length(c.items)=1
    AND c.items->0->>'product_id'=:'tint_product_id'
    AND c.items->0->>'variant_id'=:'pink_variant_id'
    AND c.items->0->>'quantity'='1')
  AND NOT EXISTS (SELECT 1 FROM public.orders WHERE id=:'legacy_order_id'::uuid)
  AND NOT EXISTS (SELECT 1 FROM public.order_items WHERE id=:'legacy_item_id'::uuid)
  AND (SELECT is_called FROM public.order_reference_number_v1)
) AS ok
\gset s02_
\if :s02_ok
\else
ROLLBACK;
\quit 3
\endif

SELECT set_config('letbuyy_qa.s02_before', (jsonb_build_object(
  'ad_credit_ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.ad_credit_ledger_entries t), '[]'::jsonb),
  'carts', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.carts t), '[]'::jsonb),
  'checkout_sessions', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.checkout_sessions t), '[]'::jsonb),
  'gift_card_ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.gift_card_ledger_entries t), '[]'::jsonb),
  'inventory_adjustments', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.inventory_adjustments t), '[]'::jsonb),
  'inventory_events', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.inventory_events t), '[]'::jsonb),
  'inventory_levels', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.inventory_levels t), '[]'::jsonb),
  'inventory_reservations', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.inventory_reservations t), '[]'::jsonb),
  'ledger_accounts', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.ledger_accounts t), '[]'::jsonb),
  'ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.ledger_entries t), '[]'::jsonb),
  'ledger_transactions', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.ledger_transactions t), '[]'::jsonb),
  'loyalty_ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.loyalty_ledger_entries t), '[]'::jsonb),
  'money_ledger_reconciliation_batches', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.money_ledger_reconciliation_batches t), '[]'::jsonb),
  'money_ledger_reconciliation_traversal', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.money_ledger_reconciliation_traversal t), '[]'::jsonb),
  'money_ledger_site_reconciliations', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.money_ledger_site_reconciliations t), '[]'::jsonb),
  'order_items', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.order_items t), '[]'::jsonb),
  'orders', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.orders t), '[]'::jsonb),
  'outbox_events', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.outbox_events t), '[]'::jsonb),
  'partner_payout_ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.partner_payout_ledger_entries t), '[]'::jsonb),
  'payout_statement_source_ledger_transactions', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.payout_statement_source_ledger_transactions t), '[]'::jsonb),
  'store_credit_ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.store_credit_ledger_entries t), '[]'::jsonb),
  'wallet_ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.wallet_ledger_entries t), '[]'::jsonb),
  'buyer_order_links', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.buyer_order_links t), '[]'::jsonb),
  'products', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.products t), '[]'::jsonb),
  'product_variants', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.product_variants t), '[]'::jsonb),
  'product_options', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.product_options t), '[]'::jsonb),
  'buyer_accounts', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.buyer_accounts t), '[]'::jsonb),
  'sites', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.sites t), '[]'::jsonb)
))::text, true)
  IS NOT NULL AS private_conservation_snapshot_saved;
SELECT set_config('letbuyy_qa.s02_sequence_before',
  (SELECT jsonb_build_object('last',last_value,'called',is_called)::text
     FROM public.order_reference_number_v1), true)
  IS NOT NULL AS sequence_snapshot_saved;

WITH line AS (
 SELECT jsonb_build_object(
   'id',:'legacy_item_id', 'product_id',:'tint_product_id',
   'variant_id',:'pink_variant_id', 'name','Synthetic legacy beauty control',
   'title','Synthetic legacy beauty control', 'quantity',1,
   'price',560,'unit_price',560,'total',560) AS value
)
INSERT INTO public.orders
 (id,store_id,site_id,customer_name,customer_email,shipping_address,items,
  subtotal,shipping_cost,tax,discount,total,currency,status,payment_status,
  payment_method,notes)
SELECT :'legacy_order_id'::uuid,:'site_id'::uuid,:'site_id'::uuid,
 'Synthetic legacy read control',b.email,'{}'::jsonb,jsonb_build_array(line.value),
 560,0,0,0,560,'INR','pending','pending','cod',
 'SYNTHETIC_LEGACY_READ_CONTROL; setup_only; no_checkout_or_payment'
FROM line CROSS JOIN public.buyer_accounts b WHERE b.id=:'buyer_a_id'::uuid;

INSERT INTO public.order_items
 (id,order_id,store_id,site_id,product_id,variant_id,name,title,quantity,
  price,unit_price,total,product_snapshot)
VALUES
 (:'legacy_item_id'::uuid,:'legacy_order_id'::uuid,:'site_id'::uuid,
  :'site_id'::uuid,:'tint_product_id'::uuid,:'pink_variant_id',
  'Synthetic legacy beauty control','Synthetic legacy beauty control',
  1,560,560,560,'{}'::jsonb);

INSERT INTO public.buyer_order_links
 (order_id,buyer_account_id,site_id,link_basis)
VALUES
 (:'legacy_order_id'::uuid,:'buyer_a_id'::uuid,:'site_id'::uuid,'operator_resolution');

SELECT (
 (jsonb_build_object(
  'ad_credit_ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.ad_credit_ledger_entries t), '[]'::jsonb),
  'carts', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.carts t), '[]'::jsonb),
  'checkout_sessions', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.checkout_sessions t), '[]'::jsonb),
  'gift_card_ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.gift_card_ledger_entries t), '[]'::jsonb),
  'inventory_adjustments', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.inventory_adjustments t), '[]'::jsonb),
  'inventory_events', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.inventory_events t), '[]'::jsonb),
  'inventory_levels', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.inventory_levels t), '[]'::jsonb),
  'inventory_reservations', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.inventory_reservations t), '[]'::jsonb),
  'ledger_accounts', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.ledger_accounts t), '[]'::jsonb),
  'ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.ledger_entries t), '[]'::jsonb),
  'ledger_transactions', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.ledger_transactions t), '[]'::jsonb),
  'loyalty_ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.loyalty_ledger_entries t), '[]'::jsonb),
  'money_ledger_reconciliation_batches', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.money_ledger_reconciliation_batches t), '[]'::jsonb),
  'money_ledger_reconciliation_traversal', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.money_ledger_reconciliation_traversal t), '[]'::jsonb),
  'money_ledger_site_reconciliations', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.money_ledger_site_reconciliations t), '[]'::jsonb),
  'order_items', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.order_items t WHERE t.id <> :'legacy_item_id'::uuid), '[]'::jsonb),
  'orders', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.orders t WHERE t.id <> :'legacy_order_id'::uuid), '[]'::jsonb),
  'outbox_events', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.outbox_events t), '[]'::jsonb),
  'partner_payout_ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.partner_payout_ledger_entries t), '[]'::jsonb),
  'payout_statement_source_ledger_transactions', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.payout_statement_source_ledger_transactions t), '[]'::jsonb),
  'store_credit_ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.store_credit_ledger_entries t), '[]'::jsonb),
  'wallet_ledger_entries', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.wallet_ledger_entries t), '[]'::jsonb),
  'buyer_order_links', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.buyer_order_links t WHERE t.order_id <> :'legacy_order_id'::uuid), '[]'::jsonb),
  'products', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.products t), '[]'::jsonb),
  'product_variants', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.product_variants t), '[]'::jsonb),
  'product_options', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.product_options t), '[]'::jsonb),
  'buyer_accounts', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.buyer_accounts t), '[]'::jsonb),
  'sites', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.sites t), '[]'::jsonb)
)) = current_setting('letbuyy_qa.s02_before')::jsonb
 AND (SELECT count(*) FROM public.orders)
   = jsonb_array_length(current_setting('letbuyy_qa.s02_before')::jsonb->'orders')+1
 AND (SELECT count(*) FROM public.order_items)
   = jsonb_array_length(current_setting('letbuyy_qa.s02_before')::jsonb->'order_items')+1
 AND (SELECT count(*) FROM public.buyer_order_links)
   = jsonb_array_length(current_setting('letbuyy_qa.s02_before')::jsonb->'buyer_order_links')+1
 AND EXISTS (SELECT 1 FROM public.orders o JOIN public.order_items i ON i.order_id=o.id
   JOIN public.buyer_order_links l ON l.order_id=o.id
   WHERE o.id=:'legacy_order_id'::uuid AND i.id=:'legacy_item_id'::uuid
     AND o.store_id=:'site_id'::uuid AND o.site_id=:'site_id'::uuid
     AND i.store_id=:'site_id'::uuid AND i.site_id=:'site_id'::uuid
     AND i.product_id=:'tint_product_id'::uuid AND i.variant_id=:'pink_variant_id'
     AND i.quantity=1 AND i.price=560 AND i.unit_price=560 AND i.total=560
     AND i.product_snapshot='{}'::jsonb AND jsonb_array_length(o.items)=1
     AND o.items->0->>'id'=:'legacy_item_id'
     AND o.items->0->>'quantity'='1'
     AND NOT ((o.items->0) ? 'niche') AND NOT ((o.items->0) ? 'niche_snapshot')
     AND o.subtotal=560 AND o.shipping_cost=0 AND o.tax=0 AND o.discount=0
     AND o.total=560 AND o.currency='INR' AND o.payment_status='pending'
     AND o.payment_method='cod' AND o.status='pending_cod'
     AND o.payment_id IS NULL AND o.inventory_reserved_at IS NULL
     AND l.buyer_account_id=:'buyer_a_id'::uuid AND l.site_id=:'site_id'::uuid
     AND l.link_basis='operator_resolution')
 AND (SELECT is_called AND last_value=
   (current_setting('letbuyy_qa.s02_sequence_before')::jsonb->>'last')::bigint+1
   FROM public.order_reference_number_v1)
) AS ok
\gset s02_
\if :s02_ok
SELECT jsonb_build_object('classification','SYNTHETIC_LEGACY_READ_SETUP',
 'id',id,'orderNumber',order_number,'status',status,'paymentStatus',payment_status,
 'total',total,'currency',currency) AS safe_setup_readback
 FROM public.orders WHERE id=:'legacy_order_id'::uuid;
COMMIT;
\else
ROLLBACK;
\quit 4
\endif
```

The public evidence records the guard result, exact actual IDs/counts, fresh before/after SHA256 receipts from the **existing** owner collector and actual browser/API readbacks. It must not contain raw protected rows, passwords, cookies or cart capabilities. No success is inferred from this unexecuted recipe.

## 22-scope conservation and expected delta

The exact table-name manifest comes from the historical collector receipt `theme-editor-2026-10-23/evidence/corrected-habitat-COD-conflict-before.json` **for names only**; none of its old data/hashes/IDs is reused. All state is recollected in the fresh owned database.

- `orders`: exactly +1 declared synthetic row; every prior row exact.
- `order_items`: exactly +1 declared synthetic row; every prior row exact, including the primary approved snapshot.
- The other20 protected tables are exact, count and full-row state: `ad_credit_ledger_entries`, `carts`, `checkout_sessions`, `gift_card_ledger_entries`, `inventory_adjustments`, `inventory_events`, `inventory_levels`, `inventory_reservations`, `ledger_accounts`, `ledger_entries`, `ledger_transactions`, `loyalty_ledger_entries`, `money_ledger_reconciliation_batches`, `money_ledger_reconciliation_traversal`, `money_ledger_site_reconciliations`, `outbox_events`, `partner_payout_ledger_entries`, `payout_statement_source_ledger_transactions`, `store_credit_ledger_entries`, `wallet_ledger_entries`.
- Additional conservation: `buyer_order_links` exactly +1 declared A/site/operator-resolution link, all old links exact; `products`, `product_variants`, `product_options`, `buyer_accounts`, `sites` exact.
- Migration337's `order_reference_number_v1` sequence consumes exactly one nextval in this serialized attempt. It is nontransactional: an abort may leave a sequence gap. Record it; never reset/reseed or retry automatically. This is a sequence contract, not a product-version +1 assertion.
- No checkout session, accepted cart, reservation, inventory adjustment/event/level, outbox event or money ledger changes are allowed. Capture provider/payment/settlement counters through the existing owner observer too; none is a permitted new effect.

## Actual reads to allocate after setup

A private BFF `GET /api/buyer/orders?order_id=<actual legacy ID>`, the installed Liquid detail and normal merchant detail must show the exact legacy ID/name, quantity1, line/order560 INR and **Product details were not recorded with this order**. Assert absence of current v1/v2 beauty fields and raw/private snapshots. A legitimate current Tint PDP positive before and after v2 distinguishes this from a missing-product fallback. Keep A/primary history positives and snapshot digest unchanged.

O05 isolates one variable: A/home positive → SAME A/foreign signed-site positive → own primary order denied there → A/home positive restored → actual B/home positive → A-order denial → normal sign-out/missing-session denial. A separately granted disposable-B disabled control follows its positive; disabled403 is not a backend503 claim. Authentication uses normal UI/consent, never cookie injection.

D02 normal valid-no-beauty-choices uses real unknown-only Palm search or an explicitly empty owned collection, with same-response facets/query/matches and visible recovery. Missing/malformed transport and legacy-unsupported live branches remain explicitly unexecuted on this canonical stack; existing focused component evidence stays separately labelled. Whole D02 is not PASS from source/component evidence alone.

## Existing source constraints

`000_baseline.sql:10014–10045,10121–10172` (line/order fields); `073_order_item_required_field_compatibility.sql:12–42` (required fields); `074_cod_pending_status.sql:30–46` (pending COD); `108/130` (site keys); `110/158` (item tenant scope); `255_buyer_verified_ownership_links.sql:116–145` (explicit link, operator_resolution valid); `278/296` (null marketplace guards); `337_unique_order_references.sql:15–21` (always-generated sequence reference); `388_cart_order_fact_snapshots.sql:281–300` (the existing checkout seeder would reserve inventory, so is not used).

`packages/checkout-core/src/index.ts:1713–1738` reads only `product_snapshot.niche`; `services/api-gateway/src/lib/buyer-order-item-view.ts:4–13` emits only its approved projection; `apps/commerce/web/src/components/storefront/niche-order-facts.tsx:16` supplies missing-details guidance. Existing direct native fixture precedent: `merchant-tenant-predicate.test.ts:166–187`. This test fixture setup does not assert a canonical checkout journey.

