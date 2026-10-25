--386 DOWN: exact migration383 reader/profile restored; no product/fact/table mutation.
BEGIN;
DO $managed_catalog_fence$
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
 ELSE
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE p.oid=pg_catalog.to_regprocedure('letbuyy_maintenance.lock_catalogs_v1()')
 AND n.nspname='letbuyy_maintenance' AND n.nspowner='supabase_admin'::regrole
 AND p.proowner='supabase_admin'::regrole AND p.prosecdef AND p.prokind='f' AND NOT p.proretset
 AND p.prorettype='pg_catalog.void'::regtype AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
 AND p.pronargs=0 AND p.pronargdefaults=0 AND p.proargnames IS NULL AND p.proargmodes IS NULL AND p.proallargtypes IS NULL
 AND NOT p.proisstrict AND NOT p.proleakproof AND p.prosupport=0 AND p.provolatile='v' AND p.proparallel='u'
 AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]
 AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')='4772eebc5017ef1e188b188f87f1cca8fb8f2b9cfd1e928798ef5cd5dfebfabc'
 AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.oid=p.proowner AND r.rolsuper)
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))a
  WHERE a.grantor<>p.proowner OR a.grantee NOT IN(p.proowner,'postgres'::regrole) OR (a.grantee<>p.proowner AND a.is_grantable))
 AND pg_catalog.has_function_privilege('postgres',p.oid,'EXECUTE')
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner)))a
  WHERE a.grantor<>n.nspowner OR a.grantee NOT IN(n.nspowner,'postgres'::regrole)
   OR(a.grantee<>n.nspowner AND (a.is_grantable OR a.privilege_type<>'USAGE')))
 AND pg_catalog.has_schema_privilege('postgres',n.oid,'USAGE')
 AND (SELECT count(*) FROM pg_catalog.pg_proc x WHERE x.pronamespace=n.oid AND x.proname=p.proname)=1) THEN
   RAISE EXCEPTION 'LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED' USING ERRCODE='42501';END IF;
  PERFORM letbuyy_maintenance.lock_catalogs_v1();
  -- Prove actual backend-held relation locks, including cluster-shared catalogs.
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['pg_catalog.pg_proc'::pg_catalog.regclass]::oid[]) catalog_oid
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
     AND l.locktype='relation' AND l.relation=catalog_oid AND l.granted
     AND l.mode IN('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
     AND l.database IN(0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())))) THEN
   RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED';END IF;
 END IF;
END $managed_catalog_fence$;
DO $rollback_typed_family$
DECLARE expected record; live pg_catalog.pg_proc%ROWTYPE;
BEGIN
 FOR expected IN SELECT * FROM (VALUES
 ('public.browse_storefront_apparel_v1(uuid,integer,integer,text,text,numeric,numeric,text,text,text,uuid,boolean,text)',ARRAY['p_store_id','p_page','p_limit','p_size','p_color','p_min_price','p_max_price','p_sort','p_search','p_category','p_collection_id','p_relational','p_country_of_origin']::text[],'jsonb',false)
 ) AS bounded(signature,input_names,result_type,definer) LOOP
  SELECT * INTO live FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(expected.signature);
  IF live.oid IS NULL OR live.prokind<>'f' OR live.prosecdef IS DISTINCT FROM expected.definer OR live.proretset
   OR live.prorettype IS DISTINCT FROM expected.result_type::regtype OR live.provariadic<>0
   OR live.proargnames[1:live.pronargs] IS DISTINCT FROM expected.input_names
   OR live.proargmodes IS NOT NULL OR live.proallargtypes IS NOT NULL
   OR (SELECT count(*) FROM pg_catalog.pg_proc other WHERE other.pronamespace=live.pronamespace AND other.proname=live.proname)<>1
   OR (expected.definer AND (pg_catalog.has_function_privilege('anon',live.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',live.oid,'EXECUTE'))) THEN
   RAISE EXCEPTION 'Rollback refuses changed typed function family';
  END IF;
 END LOOP;
END $rollback_typed_family$;

DO $later$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.carts'::regclass AND attname='fact_acceptance_version' AND NOT attisdropped)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE pronamespace='public'::regnamespace AND proname='apply_product_edit_v1' AND prosrc LIKE '%storefront_discovery_facts_valid_v1%')
 THEN RAISE EXCEPTION 'Migration386 rollback refuses active migration388 dependencies; roll back388 first';END IF;
END $later$;
DO $profile$ DECLARE expected jsonb;p pg_catalog.pg_proc%ROWTYPE;BEGIN
 FOR expected IN SELECT value FROM jsonb_array_elements('[{"name":"storefront_discovery_trim_v1","signature":"public.storefront_discovery_trim_v1(text)","argumentNames":["value"],"defaults":0,"defaultExpressions":"","returnType":"text","language":"sql","strict":true,"volatility":"i","md5":"48a069331a31d8a6f163601027de08a2"},{"name":"storefront_discovery_utf16_length_v1","signature":"public.storefront_discovery_utf16_length_v1(text)","argumentNames":["value"],"defaults":0,"defaultExpressions":"","returnType":"integer","language":"sql","strict":true,"volatility":"i","md5":"209c88d57b612a21b6b08fb9975794b6"},{"name":"storefront_discovery_label_v1","signature":"public.storefront_discovery_label_v1(text)","argumentNames":["value"],"defaults":0,"defaultExpressions":"","returnType":"boolean","language":"sql","strict":true,"volatility":"i","md5":"59fbcd6822c8852a5c57c22a94eddca3"},{"name":"storefront_discovery_shape_v1","signature":"public.storefront_discovery_shape_v1(jsonb,text,boolean)","argumentNames":["value","namespace","variant"],"defaults":1,"defaultExpressions":"false","returnType":"boolean","language":"plpgsql","strict":false,"volatility":"i","md5":"1492db48a329e9a8ef8556cce86c97ad"},{"name":"storefront_discovery_date_v1","signature":"public.storefront_discovery_date_v1(text)","argumentNames":["value"],"defaults":0,"defaultExpressions":"","returnType":"boolean","language":"plpgsql","strict":true,"volatility":"i","md5":"e758a7db081ab6fdb9666fcb2365fa20"},{"name":"storefront_discovery_isbn_v1","signature":"public.storefront_discovery_isbn_v1(text)","argumentNames":["value"],"defaults":0,"defaultExpressions":"","returnType":"boolean","language":"plpgsql","strict":true,"volatility":"i","md5":"312e6b981773b9ba03f1e66a6fd1d138"},{"name":"storefront_discovery_json_units_v1","signature":"public.storefront_discovery_json_units_v1(jsonb,integer)","argumentNames":["value","depth"],"defaults":1,"defaultExpressions":"0","returnType":"integer","language":"plpgsql","strict":true,"volatility":"i","md5":"7c03c549afdfa956e8761ab32c7c19a3"},{"name":"storefront_discovery_facts_valid_v1","signature":"public.storefront_discovery_facts_valid_v1(jsonb,text,boolean)","argumentNames":["value","namespace","variant"],"defaults":1,"defaultExpressions":"false","returnType":"boolean","language":"plpgsql","strict":false,"volatility":"i","md5":"71fa6039bc517e11f77b9fbb3625fae7"},{"name":"storefront_discovery_mm_v1","signature":"public.storefront_discovery_mm_v1(jsonb)","argumentNames":["value"],"defaults":0,"defaultExpressions":"","returnType":"numeric","language":"sql","strict":false,"volatility":"i","md5":"20d0701ff4bcd8f0f486645aba9d00cd"},{"name":"storefront_discovery_flat_v1","signature":"public.storefront_discovery_flat_v1(jsonb,jsonb,boolean,jsonb,jsonb)","argumentNames":["metadata","variant_metadata","has_variant","options","images"],"defaults":0,"defaultExpressions":"","returnType":"jsonb","language":"plpgsql","strict":false,"volatility":"i","md5":"cc1467bb5480104c947421eea4c93686"},{"name":"storefront_discovery_match_v1","signature":"public.storefront_discovery_match_v1(jsonb,jsonb,numeric)","argumentNames":["query","facts","price"],"defaults":0,"defaultExpressions":"","returnType":"boolean","language":"plpgsql","strict":false,"volatility":"i","md5":"24f0aa6fc84e6e69aa6d5ab73db151a1"},{"name":"browse_storefront_products_v1","signature":"public.browse_storefront_products_v1(uuid,jsonb,uuid[])","argumentNames":["p_store_id","p_query","p_product_ids"],"defaults":2,"defaultExpressions":"''{}''::jsonb, NULL::uuid[]","returnType":"jsonb","language":"plpgsql","strict":false,"volatility":"s","md5":"9af9d5e2e51052a874ffad94fc8088d6"},{"name":"browse_storefront_apparel_v1","signature":"public.browse_storefront_apparel_v1(uuid,integer,integer,text,text,numeric,numeric,text,text,text,uuid,boolean,text)","argumentNames":["p_store_id","p_page","p_limit","p_size","p_color","p_min_price","p_max_price","p_sort","p_search","p_category","p_collection_id","p_relational","p_country_of_origin"],"defaults":12,"defaultExpressions":"1, 20, NULL::text, NULL::text, NULL::numeric, NULL::numeric, ''display_order''::text, NULL::text, NULL::text, NULL::uuid, true, NULL::text","returnType":"jsonb","language":"plpgsql","strict":false,"volatility":"s","md5":"6ae8c3a7044165e7f998663155645e8e"}]'::jsonb) LOOP
  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(expected->>'signature');
  IF p.oid IS NULL OR pg_catalog.md5(p.prosrc)<>expected->>'md5' OR p.prosecdef OR p.proretset OR p.prokind<>'f'
   OR p.provolatile<>expected->>'volatility' OR p.proisstrict<>(expected->>'strict')::boolean OR p.proparallel<>'u'
   OR p.pronargdefaults<>(expected->>'defaults')::integer OR coalesce(pg_catalog.pg_get_expr(p.proargdefaults,0),'') IS DISTINCT FROM expected->>'defaultExpressions' OR p.provariadic<>0 OR p.prosupport<>0 OR p.proleakproof
   OR p.proallargtypes IS NOT NULL OR p.proargmodes IS NOT NULL OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL
   OR p.procost<>100 OR p.prorows<>0
   OR p.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.products'::regclass)
   OR p.prorettype<>pg_catalog.to_regtype(expected->>'returnType') OR p.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname=expected->>'language')
   OR p.proargnames IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(expected->'argumentNames'))
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
   OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
   OR pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
   OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE a.grantee NOT IN(p.proowner,'service_role'::regrole) OR a.grantee<>p.proowner AND a.is_grantable)
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname AND q.oid<>p.oid)
  THEN RAISE EXCEPTION 'Migration386 discovery function profile changed: %',expected->>'name';END IF;
 END LOOP;END $profile$;
-- Bounded apparel filters on the canonical product/variant/collection owners.
-- Invoker rights only: no new RLS bypass or anonymous SQL access.
CREATE OR REPLACE FUNCTION public.browse_storefront_apparel_v1(
  p_store_id uuid, p_page integer DEFAULT 1, p_limit integer DEFAULT 20,
  p_size text DEFAULT NULL, p_color text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL, p_max_price numeric DEFAULT NULL,
  p_sort text DEFAULT 'display_order', p_search text DEFAULT NULL,
  p_category text DEFAULT NULL, p_collection_id uuid DEFAULT NULL,
  p_relational boolean DEFAULT true, p_country_of_origin text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE result jsonb;
BEGIN
  IF p_page < 1 OR p_page > 10000 OR p_limit < 1 OR p_limit > 100
    OR length(p_country_of_origin)>100 OR length(p_size)>100 OR length(p_color)>100 OR length(p_search)>200 OR length(p_category)>100
    OR p_min_price<0 OR p_max_price<0 OR p_min_price>p_max_price
    OR p_sort NOT IN ('display_order','price-asc','price-desc','newest','name') THEN
    RAISE EXCEPTION 'Invalid apparel discovery query' USING ERRCODE='22023';
  END IF;
  WITH matched AS MATERIALIZED (
    SELECT p.id,p.store_id,p.name,p.slug,p.description,p.price,p.compare_price,p.category,p.product_type,p.tags,p.images,p.stock,p.track_inventory,p.is_active,p.is_featured,p.country_of_origin,p.importer_details,p.seo_title,p.seo_description,p.created_at,p.updated_at,p.variants,p.metadata,p.display_order
    FROM public.products p
    WHERE p.store_id=p_store_id AND p.is_active=true AND p.deleted_at IS NULL
      AND (p_min_price IS NULL OR p.price>=p_min_price) AND (p_max_price IS NULL OR p.price<=p_max_price)
      AND (p_search IS NULL OR p.name ILIKE '%'||p_search||'%')
      AND (p_category IS NULL OR p.category=p_category)
      AND (p_country_of_origin IS NULL OR lower(btrim(p.country_of_origin))=lower(btrim(p_country_of_origin)))
      AND (p_collection_id IS NULL OR EXISTS (
        SELECT 1 FROM public.collection_products cp JOIN public.collections c ON c.id=cp.collection_id
        WHERE cp.product_id=p.id AND c.id=p_collection_id AND c.store_id=p_store_id AND c.is_active=true AND c.deleted_at IS NULL))
      AND ((p_size IS NULL AND p_color IS NULL) OR
        (p_relational AND EXISTS (
          SELECT 1 FROM public.product_variants v
          LEFT JOIN public.product_options so ON so.product_id=p.id AND lower(so.name)='size'
          LEFT JOIN public.product_options co ON co.product_id=p.id AND lower(co.name) IN ('color','colour')
          WHERE v.product_id=p.id AND v.inventory_qty>0
            AND (p_size IS NULL OR lower(CASE so.position WHEN 0 THEN v.option1 WHEN 1 THEN v.option2 WHEN 2 THEN v.option3 END)=lower(p_size))
            AND (p_color IS NULL OR lower(CASE co.position WHEN 0 THEN v.option1 WHEN 1 THEN v.option2 WHEN 2 THEN v.option3 END)=lower(p_color))
        )) OR (NOT p_relational AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.variants)='array' THEN p.variants ELSE '[]'::jsonb END) v
          WHERE CASE WHEN coalesce(v->>'stock',v->>'inventory_qty',v->>'stock_quantity','') ~ '^[0-9]+$' THEN coalesce(v->>'stock',v->>'inventory_qty',v->>'stock_quantity')::numeric ELSE 0 END > 0
            AND (p_size IS NULL OR EXISTS(SELECT 1 FROM jsonb_each_text(CASE WHEN jsonb_typeof(v->'options')='object' THEN v->'options' ELSE '{}'::jsonb END) o WHERE lower(o.key)='size' AND lower(o.value)=lower(p_size)))
            AND (p_color IS NULL OR EXISTS(SELECT 1 FROM jsonb_each_text(CASE WHEN jsonb_typeof(v->'options')='object' THEN v->'options' ELSE '{}'::jsonb END) o WHERE lower(o.key) IN ('color','colour') AND lower(o.value)=lower(p_color)))
        )))
  ), page_rows AS (
    SELECT * FROM matched ORDER BY
      CASE WHEN p_sort='price-asc' THEN price END ASC,
      CASE WHEN p_sort='price-desc' THEN price END DESC,
      CASE WHEN p_sort='newest' THEN created_at END DESC,
      CASE WHEN p_sort='name' THEN name END ASC,
      CASE WHEN p_sort='display_order' THEN display_order END ASC,
      id ASC LIMIT p_limit OFFSET (p_page-1)*p_limit
  ) SELECT jsonb_build_object('data',coalesce((SELECT jsonb_agg(to_jsonb(r)-'display_order') FROM page_rows r),'[]'::jsonb),'count',(SELECT count(*) FROM matched)) INTO result;
  RETURN result;
END;
$function$;
REVOKE ALL ON FUNCTION public.browse_storefront_apparel_v1(uuid,integer,integer,text,text,numeric,numeric,text,text,text,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.browse_storefront_apparel_v1(uuid,integer,integer,text,text,numeric,numeric,text,text,text,uuid,boolean,text) TO service_role;
COMMENT ON FUNCTION public.browse_storefront_apparel_v1(uuid,integer,integer,text,text,numeric,numeric,text,text,text,uuid,boolean,text) IS 'Internal transport only. Caller resolves a published site or validated site-bound preview before invocation; invoker RLS remains unchanged. Project public fields before serialization.';

DROP FUNCTION public.browse_storefront_products_v1(uuid,jsonb,uuid[]);
DROP FUNCTION public.storefront_discovery_match_v1(jsonb,jsonb,numeric);
DROP FUNCTION public.storefront_discovery_flat_v1(jsonb,jsonb,boolean,jsonb,jsonb);
DROP FUNCTION public.storefront_discovery_mm_v1(jsonb);
DROP FUNCTION public.storefront_discovery_facts_valid_v1(jsonb,text,boolean);
DROP FUNCTION public.storefront_discovery_json_units_v1(jsonb,integer);
DROP FUNCTION public.storefront_discovery_isbn_v1(text);
DROP FUNCTION public.storefront_discovery_date_v1(text);
DROP FUNCTION public.storefront_discovery_shape_v1(jsonb,text,boolean);
DROP FUNCTION public.storefront_discovery_label_v1(text);
DROP FUNCTION public.storefront_discovery_utf16_length_v1(text);
DROP FUNCTION public.storefront_discovery_trim_v1(text);
NOTIFY pgrst,'reload schema';
COMMIT;
