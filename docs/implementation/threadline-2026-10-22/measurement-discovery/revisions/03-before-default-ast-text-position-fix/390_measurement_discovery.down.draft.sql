-- DRAFT390 DOWN: DOCUMENTATION ONLY; not applied or promoted.
-- Extends the existing browse RPC result; no table/helper/RLS/ACL mutations.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('migration390:measurement-discovery',0));
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
DO $profile$ DECLARE expected jsonb;p pg_catalog.pg_proc%ROWTYPE;BEGIN
 FOR expected IN SELECT value FROM jsonb_array_elements('[{"name":"storefront_discovery_trim_v1","signature":"public.storefront_discovery_trim_v1(text)","argumentNames":["value"],"defaults":0,"defaultExpressions":"","returnType":"text","language":"sql","strict":true,"volatility":"i","md5":"48a069331a31d8a6f163601027de08a2"},{"name":"storefront_discovery_utf16_length_v1","signature":"public.storefront_discovery_utf16_length_v1(text)","argumentNames":["value"],"defaults":0,"defaultExpressions":"","returnType":"integer","language":"sql","strict":true,"volatility":"i","md5":"209c88d57b612a21b6b08fb9975794b6"},{"name":"storefront_discovery_label_v1","signature":"public.storefront_discovery_label_v1(text)","argumentNames":["value"],"defaults":0,"defaultExpressions":"","returnType":"boolean","language":"sql","strict":true,"volatility":"i","md5":"59fbcd6822c8852a5c57c22a94eddca3"},{"name":"storefront_discovery_shape_v1","signature":"public.storefront_discovery_shape_v1(jsonb,text,boolean)","argumentNames":["value","namespace","variant"],"defaults":1,"defaultExpressions":"false","returnType":"boolean","language":"plpgsql","strict":false,"volatility":"i","md5":"1492db48a329e9a8ef8556cce86c97ad"},{"name":"storefront_discovery_date_v1","signature":"public.storefront_discovery_date_v1(text)","argumentNames":["value"],"defaults":0,"defaultExpressions":"","returnType":"boolean","language":"plpgsql","strict":true,"volatility":"i","md5":"e758a7db081ab6fdb9666fcb2365fa20"},{"name":"storefront_discovery_isbn_v1","signature":"public.storefront_discovery_isbn_v1(text)","argumentNames":["value"],"defaults":0,"defaultExpressions":"","returnType":"boolean","language":"plpgsql","strict":true,"volatility":"i","md5":"312e6b981773b9ba03f1e66a6fd1d138"},{"name":"storefront_discovery_json_units_v1","signature":"public.storefront_discovery_json_units_v1(jsonb,integer)","argumentNames":["value","depth"],"defaults":1,"defaultExpressions":"0","returnType":"integer","language":"plpgsql","strict":true,"volatility":"i","md5":"7c03c549afdfa956e8761ab32c7c19a3"},{"name":"storefront_discovery_facts_valid_v1","signature":"public.storefront_discovery_facts_valid_v1(jsonb,text,boolean)","argumentNames":["value","namespace","variant"],"defaults":1,"defaultExpressions":"false","returnType":"boolean","language":"plpgsql","strict":false,"volatility":"i","md5":"71fa6039bc517e11f77b9fbb3625fae7"},{"name":"storefront_discovery_mm_v1","signature":"public.storefront_discovery_mm_v1(jsonb)","argumentNames":["value"],"defaults":0,"defaultExpressions":"","returnType":"numeric","language":"sql","strict":false,"volatility":"i","md5":"20d0701ff4bcd8f0f486645aba9d00cd"},{"name":"storefront_discovery_flat_v1","signature":"public.storefront_discovery_flat_v1(jsonb,jsonb,boolean,jsonb,jsonb)","argumentNames":["metadata","variant_metadata","has_variant","options","images"],"defaults":0,"defaultExpressions":"","returnType":"jsonb","language":"plpgsql","strict":false,"volatility":"i","md5":"cc1467bb5480104c947421eea4c93686"},{"name":"storefront_discovery_match_v1","signature":"public.storefront_discovery_match_v1(jsonb,jsonb,numeric)","argumentNames":["query","facts","price"],"defaults":0,"defaultExpressions":"","returnType":"boolean","language":"plpgsql","strict":false,"volatility":"i","md5":"24f0aa6fc84e6e69aa6d5ab73db151a1"},{"name":"browse_storefront_products_v1","signature":"public.browse_storefront_products_v1(uuid,jsonb,uuid[])","argumentNames":["p_store_id","p_query","p_product_ids"],"defaults":2,"defaultExpressions":"''{}''::jsonb, NULL::uuid[]","returnType":"jsonb","language":"plpgsql","strict":false,"volatility":"s","md5":"95cda4d15f36172c5457ad5045600cde"},{"name":"browse_storefront_apparel_v1","signature":"public.browse_storefront_apparel_v1(uuid,integer,integer,text,text,numeric,numeric,text,text,text,uuid,boolean,text)","argumentNames":["p_store_id","p_page","p_limit","p_size","p_color","p_min_price","p_max_price","p_sort","p_search","p_category","p_collection_id","p_relational","p_country_of_origin"],"defaults":12,"defaultExpressions":"1, 20, NULL::text, NULL::text, NULL::numeric, NULL::numeric, ''display_order''::text, NULL::text, NULL::text, NULL::uuid, true, NULL::text","returnType":"jsonb","language":"plpgsql","strict":false,"volatility":"s","md5":"6ae8c3a7044165e7f998663155645e8e"}]'::jsonb) LOOP
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
   OR pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticator',p.oid,'EXECUTE')
   OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE a.grantor<>p.proowner OR a.grantee NOT IN(p.proowner,'service_role'::regrole) OR a.grantee<>p.proowner AND a.is_grantable)
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname AND q.oid<>p.oid)
  THEN RAISE EXCEPTION 'Migration386 discovery function profile changed: %',expected->>'name';END IF;
 END LOOP;END $profile$;
DO $mutation$
DECLARE before_row pg_catalog.pg_proc%ROWTYPE; after_row pg_catalog.pg_proc%ROWTYPE;
 before_comment text; before_dependencies jsonb; before_shared_dependencies jsonb;
BEGIN
 SELECT * INTO STRICT before_row FROM pg_catalog.pg_proc
  WHERE oid=pg_catalog.to_regprocedure('public.browse_storefront_products_v1(uuid,jsonb,uuid[])');
 SELECT pg_catalog.obj_description(before_row.oid,'pg_proc') INTO before_comment;
 SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]'::jsonb) INTO before_dependencies
  FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=before_row.oid;
 SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]'::jsonb) INTO before_shared_dependencies
  FROM pg_catalog.pg_shdepend d WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=before_row.oid
   AND d.dbid=(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database());
 EXECUTE $replacement$
CREATE OR REPLACE FUNCTION public.browse_storefront_products_v1(p_store_id uuid, p_query jsonb DEFAULT '{}', p_product_ids uuid[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE query jsonb:='{"page":1,"limit":20,"sort":"display_order"}'::jsonb||coalesce(p_query,'{}'); result jsonb; require_available boolean; page_size integer; page_number integer;
BEGIN
 IF p_store_id IS NULL OR NOT public.storefront_discovery_shape_v1(query,'$query',false) THEN
  RAISE EXCEPTION 'Invalid storefront discovery query' USING ERRCODE='22023';END IF;
 IF query?'min_price' AND query?'max_price' AND (query->>'min_price')::numeric>(query->>'max_price')::numeric
  OR (query?'length_value') IS DISTINCT FROM (query?'length_unit')
  OR query?'pack_size' AND split_part(query->>'pack_size',':',2)::numeric>1000000000
  OR (SELECT count(*)<>count(DISTINCT v) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(query->'connector')='array' THEN query->'connector' ELSE '[]' END) entries(v))
  OR coalesce(array_length(p_product_ids,1),0)>100 OR array_position(p_product_ids,NULL) IS NOT NULL THEN
   RAISE EXCEPTION 'Invalid storefront discovery query' USING ERRCODE='22023';
 END IF;
 page_size:=(query->>'limit')::integer;page_number:=(query->>'page')::integer;
 -- Basic browsing keeps existing sold-out visibility. Actual option/fact/price selections need
 -- one available canonical candidate, including every combined condition below.
 require_available:=(query-ARRAY['page','limit','sort','search','category','country_of_origin','collection_id'])<>'{}'::jsonb;
 WITH base AS MATERIALIZED (
  SELECT p.id,p.store_id,p.name,p.slug,p.description,p.price,p.compare_price,p.category,p.product_type,p.tags,p.images,p.stock,p.track_inventory,p.is_active,p.is_featured,p.country_of_origin,p.importer_details,p.seo_title,p.seo_description,p.created_at,p.updated_at,p.variants,p.metadata,p.display_order
  FROM public.products p WHERE p.store_id=p_store_id AND p.is_active=true AND p.deleted_at IS NULL
   AND(p_product_ids IS NULL OR p.id=ANY(p_product_ids))
   AND(NOT query?'category' OR public.storefront_discovery_trim_v1(p.category)=query->>'category')
   AND(NOT query?'country_of_origin' OR lower(public.storefront_discovery_trim_v1(p.country_of_origin))=lower(query->>'country_of_origin'))
   AND(NOT query?'collection_id' OR EXISTS(SELECT 1 FROM public.collection_products cp JOIN public.collections c ON c.id=cp.collection_id WHERE cp.product_id=p.id AND c.id=(query->>'collection_id')::uuid AND c.store_id=p_store_id AND c.is_active=true AND c.deleted_at IS NULL))
 ), candidates AS MATERIALIZED (
  SELECT p.id,p.name,p.description,p.tags,p.category,p.country_of_origin,p.created_at,p.display_order,to_jsonb(p)-'display_order' AS product,
   v.variant_id,v.quantity,coalesce(v.price,p.price) AS candidate_price,
   public.storefront_discovery_flat_v1(p.metadata,v.metadata,v.variant_id IS NOT NULL,v.options,to_jsonb(p.images)) AS facts
  FROM base p CROSS JOIN LATERAL(
   SELECT v.id AS variant_id,v.inventory_qty AS quantity,v.price,v.metadata,
    coalesce((SELECT jsonb_object_agg(o.name,to_jsonb(CASE o.position WHEN 0 THEN v.option1 WHEN 1 THEN v.option2 WHEN 2 THEN v.option3 END)) FROM public.product_options o WHERE o.product_id=p.id AND o.position BETWEEN 0 AND 2),'{}') AS options
   FROM public.product_variants v WHERE v.product_id=p.id
   UNION ALL SELECT NULL::uuid,p.stock,p.price,'{}'::jsonb,'{}'::jsonb WHERE NOT EXISTS(SELECT 1 FROM public.product_variants v WHERE v.product_id=p.id)
  ) v
 ), matched_candidates AS MATERIALIZED (
  SELECT * FROM candidates c WHERE(c.quantity>0 OR NOT require_available)
   AND(NOT query?'search' OR position(lower(query->>'search') IN lower(concat_ws(' ',c.name,c.description,c.tags::text,c.facts->'books_author'::text)))>0)
   AND public.storefront_discovery_match_v1(query,c.facts,c.candidate_price)
 ), matched AS MATERIALIZED (
  SELECT id,min(name) AS name,min(created_at) AS created_at,min(display_order) AS display_order,
   coalesce(min(candidate_price) FILTER(WHERE quantity>0),min(candidate_price)) AS matching_price,
   coalesce(jsonb_agg(variant_id ORDER BY variant_id) FILTER(WHERE variant_id IS NOT NULL AND quantity>0),'[]') AS variant_ids,
   (array_agg(product))[1] AS product
  FROM matched_candidates GROUP BY id
 ), ordered AS MATERIALIZED (
  SELECT *,row_number() OVER(ORDER BY
   CASE WHEN query->>'sort'='price-asc' THEN matching_price END ASC,
   CASE WHEN query->>'sort'='price-desc' THEN matching_price END DESC,
   CASE WHEN query->>'sort'='newest' THEN created_at END DESC,
   CASE WHEN query->>'sort'='name' THEN name END ASC,
   CASE WHEN query->>'sort'='display_order' THEN display_order END ASC NULLS LAST,id ASC) AS ordinal
  FROM matched
 ), page AS MATERIALIZED (SELECT * FROM ordered WHERE ordinal>(page_number-1)*page_size AND ordinal<=page_number*page_size),
 facet_values AS (
  SELECT DISTINCT c.id,pair.key,CASE WHEN pair.key IN('power_input_w','power_output_w','power_capacity_w','pass_through_output_w','data_rate_mbps','length_mm') THEN trim_scale(value::numeric)::text WHEN pair.key='category' THEN public.storefront_discovery_trim_v1(value) ELSE lower(public.storefront_discovery_trim_v1(value)) END AS value,
   public.storefront_discovery_trim_v1(value) AS label FROM matched_candidates c
   CROSS JOIN LATERAL jsonb_each(c.facts||jsonb_build_object('category',jsonb_build_array(c.category),'country_of_origin',jsonb_build_array(c.country_of_origin))) pair(key,items)
   CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(pair.items)='array' THEN pair.items ELSE '[]' END) entries(value)
  WHERE c.quantity>0 AND pair.key NOT LIKE '\_%' ESCAPE '\' AND pair.key<>'books_author' AND nullif(public.storefront_discovery_trim_v1(value),'') IS NOT NULL
 ), facet_counts AS(SELECT key,value,min(label) AS label,count(DISTINCT id) AS count,row_number() OVER(PARTITION BY key ORDER BY count(DISTINCT id) DESC,value ASC) AS rank FROM facet_values GROUP BY key,value)
 SELECT jsonb_build_object(
  'data',coalesce((SELECT jsonb_agg(product ORDER BY ordinal) FROM page),'[]'),
  'count',(SELECT count(*) FROM matched),
  'matches',coalesce((SELECT jsonb_agg(jsonb_build_object('product_id',id,'price',matching_price,'variant_ids',variant_ids) ORDER BY ordinal) FROM page),'[]'),
  'facets',coalesce((SELECT jsonb_agg(jsonb_build_object('key',key,'value',value,'label',CASE WHEN key='pack_size' THEN split_part(value,':',2)||' '||split_part(value,':',1) ELSE label END,'count',count) ORDER BY key,value) FROM facet_counts WHERE rank<=40),'[]')
 ) INTO result;
 RETURN result;
END $fn$;
$replacement$;
 SELECT * INTO STRICT after_row FROM pg_catalog.pg_proc WHERE oid=before_row.oid;
 -- Includes OID, owner, raw ACL/grantor/order, arguments/default AST, cost/rows,
 -- volatility, language, strictness, definer flag, support and search_path.
 IF (to_jsonb(before_row)-'prosrc') IS DISTINCT FROM (to_jsonb(after_row)-'prosrc')
  OR before_comment IS DISTINCT FROM pg_catalog.obj_description(after_row.oid,'pg_proc')
  OR before_dependencies IS DISTINCT FROM (
   SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]'::jsonb)
   FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=after_row.oid)
  OR before_shared_dependencies IS DISTINCT FROM (
   SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]'::jsonb)
   FROM pg_catalog.pg_shdepend d WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=after_row.oid
    AND d.dbid=(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database()))
 THEN RAISE EXCEPTION 'DRAFT390 refuses non-body function/ACL/dependency/profile drift';END IF;
END $mutation$;

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
   OR pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticator',p.oid,'EXECUTE')
   OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE a.grantor<>p.proowner OR a.grantee NOT IN(p.proowner,'service_role'::regrole) OR a.grantee<>p.proowner AND a.is_grantable)
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname AND q.oid<>p.oid)
  THEN RAISE EXCEPTION 'Migration386 discovery function profile changed: %',expected->>'name';END IF;
 END LOOP;END $profile$;
NOTIFY pgrst,'reload schema';
COMMIT;
