-- READ-ONLY REVIEW ARTIFACT. NOT EXECUTED.
-- Recipes for the positively owned disposable PG suite only; never a restored/hosted DB.
-- Use real synthetic tenant/product/cart fixtures and the current complete migration chain.

-- F1: BEFORE388, administrator creates an unexpected legacy grantee.
CREATE ROLE snapshot_review_legacy NOLOGIN INHERIT NOBYPASSRLS;
GRANT app_tenant TO snapshot_review_legacy;
GRANT USAGE ON SCHEMA public TO snapshot_review_legacy;
GRANT SELECT, UPDATE ON TABLE public.carts TO snapshot_review_legacy;
GRANT EXECUTE ON FUNCTION public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text)
  TO snapshot_review_legacy;
-- Run388 UP with its required administrator/fence. Expected correction: refuse atomically.
-- Inspected current closure does not name snapshot_review_legacy.
SELECT has_table_privilege('snapshot_review_legacy','public.carts','UPDATE'),
  has_function_privilege('snapshot_review_legacy',
    'public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text)','EXECUTE');
SELECT parent.rolname AS inherited_role,member.rolname AS member,m.admin_option
FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
WHERE member.rolname='snapshot_review_legacy';
SELECT grantor::regrole,grantee::regrole,privilege_type,is_grantable
FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
WHERE c.oid='public.carts'::regclass;
-- AFTER legitimate gateway acceptance, set psql variables site_uuid / accepted_cart_uuid.
-- Verify first that one valid reviewed line exists and normal order creation works in a separate control.
BEGIN;
SET LOCAL ROLE snapshot_review_legacy;
SELECT set_config('app.site_id', :'site_uuid', true);
UPDATE public.carts SET fact_acceptance_version=1,
  items=jsonb_set(items,'{0,niche_snapshot,personalization,text}','"Mallory"'::jsonb)
WHERE id=:'accepted_cart_uuid'::uuid;
SELECT public.create_order_with_inventory_reservations(
 p_store_id=>store_id,p_customer_name=>'Synthetic review buyer',p_customer_email=>'review@example.invalid',
 p_items=>jsonb_build_array(jsonb_build_object(
  'product_id',items->0->'product_id','variant_id',items->0->'variant_id','quantity',items->0->'quantity',
  'cart_fact_ref',jsonb_build_object('cart_id',id,'cart_token',session_id,'line_id',items->0->'id',
    'product_version',items->0->'product_version','configuration_fingerprint',items->0->'configuration_fingerprint',
    'snapshot_fingerprint',items->0->'snapshot_fingerprint'))),
 p_request_id=>'synthetic-review-unrecognized-role')
FROM public.carts WHERE id=:'accepted_cart_uuid'::uuid;
-- Inspect order_items.product_snapshot.niche.personalization.text, then discard this transaction/fixture.
ROLLBACK;

-- F3: separate fixture with no active accepted carts or other active parent facts.
-- Seed an active parent metadata={}, variant metadata={food:{netQuantity:{value:250,unit:'g'}}}.
-- Its canonical prepareProductFactSnapshot succeeds (saved pure witness).
-- Run388 DOWN: expected correction refuses while this variant capability is active.

-- F4: two independently owned SQL sessions, same approved product, distinct accepted carts/keys.
-- In BOTH sessions establish the existing278 outer lock before calling the real RPC:
BEGIN;
SELECT p.id FROM public.products p JOIN public.sites s ON s.id=p.site_id
 WHERE p.id=:'shared_product_uuid'::uuid FOR SHARE OF p,s;
-- Barrier: prove BOTH sessions hold SHARE, then concurrently call the real
-- create_marketplace_checkout_order with their own cart refs/listing and idempotency keys.
-- Current inner388: A holds inventory, waits for B product SHARE; B waits for A inventory.
-- Record pg_locks / pg_stat_activity and SQLSTATE; rollback/discard both fixtures after proof.
ROLLBACK;
