-- Roll the application back first. Retires only these read RPCs, never data.
BEGIN;
LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
DO $guard$
DECLARE target record;p pg_catalog.pg_proc%ROWTYPE;
BEGIN
 FOR target IN SELECT * FROM(VALUES
('public.read_merchant_supplier_metrics(uuid,integer,integer)','read_merchant_supplier_metrics','263bda31d516e63ae8f227482187843f',ARRAY['p_site_id','p_page','p_limit']::text[],'1, 50'),
('public.read_merchant_warehouse_metrics(uuid,integer,integer)','read_merchant_warehouse_metrics','d15ef6ed15ae3f662ff62d0376a45701',ARRAY['p_site_id','p_page','p_limit']::text[],'1, 50'),
('public.read_merchant_inventory_receipts(uuid[],integer,integer,uuid,uuid)','read_merchant_inventory_receipts','3fffdf5d0769ddf708c4ddcf04ccd4f5',ARRAY['p_site_ids','p_page','p_limit','p_po_id','p_transfer_id']::text[],'1, 20, NULL::uuid, NULL::uuid')
 )v(signature,name,body_hash,argument_names,defaults) LOOP
  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(target.signature);
  IF p.oid IS NULL OR p.prokind<>'f' OR p.prosecdef OR p.proretset OR p.prorettype<>'jsonb'::regtype
   OR p.provolatile<>'s' OR p.proisstrict OR p.proleakproof OR p.proparallel<>'u' OR p.provariadic<>0
   OR p.proargnames IS DISTINCT FROM target.argument_names
   OR pg_catalog.pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM target.defaults
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
   OR p.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.sites'::regclass)
   OR p.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
   OR pg_catalog.md5(p.prosrc)<>target.body_hash
   OR(SELECT count(*) FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname)<>1
   OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
   OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))a
    WHERE a.grantee NOT IN(p.proowner,'service_role'::regrole::oid) OR(a.grantee<>p.proowner AND a.is_grantable)) THEN
   RAISE EXCEPTION 'Migration381 rollback refuses changed reader %',target.name;
  END IF;
 END LOOP;
END $guard$;
DROP FUNCTION public.read_merchant_inventory_receipts(uuid[],integer,integer,uuid,uuid) RESTRICT;
DROP FUNCTION public.read_merchant_warehouse_metrics(uuid,integer,integer) RESTRICT;
DROP FUNCTION public.read_merchant_supplier_metrics(uuid,integer,integer) RESTRICT;
NOTIFY pgrst,'reload schema';
COMMIT;
