-- Complete the existing buyer discovery read using the canonical quantity projection. SOURCE/LOCAL ONLY.
BEGIN;
SET LOCAL search_path=pg_catalog,public,pg_temp;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='300s';
DO $prepared440$BEGIN IF EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts)THEN
 RAISE EXCEPTION 'migration440 refuses concurrent/prepared writes or non-read-committed state';END IF;END $prepared440$;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:440:buyer-inventory',0));
DO $managed_catalog_fence$
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_attribute,
 pg_catalog.pg_attrdef,pg_catalog.pg_constraint,pg_catalog.pg_trigger,
 pg_catalog.pg_policy,pg_catalog.pg_index,pg_catalog.pg_namespace,
 pg_catalog.pg_type,pg_catalog.pg_depend,pg_catalog.pg_rewrite,
 pg_catalog.pg_authid,pg_catalog.pg_auth_members,pg_catalog.pg_database,
 pg_catalog.pg_inherits,pg_catalog.pg_description,pg_catalog.pg_seclabel,
 pg_catalog.pg_extension,pg_catalog.pg_default_acl,pg_catalog.pg_init_privs,
 pg_catalog.pg_statistic_ext,pg_catalog.pg_shdepend
 IN SHARE ROW EXCLUSIVE MODE NOWAIT;
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
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['pg_catalog.pg_proc'::pg_catalog.regclass,'pg_catalog.pg_class'::pg_catalog.regclass,'pg_catalog.pg_attribute'::pg_catalog.regclass,'pg_catalog.pg_attrdef'::pg_catalog.regclass,'pg_catalog.pg_constraint'::pg_catalog.regclass,'pg_catalog.pg_trigger'::pg_catalog.regclass,'pg_catalog.pg_policy'::pg_catalog.regclass,'pg_catalog.pg_index'::pg_catalog.regclass,'pg_catalog.pg_namespace'::pg_catalog.regclass,'pg_catalog.pg_type'::pg_catalog.regclass,'pg_catalog.pg_depend'::pg_catalog.regclass,'pg_catalog.pg_rewrite'::pg_catalog.regclass,'pg_catalog.pg_authid'::pg_catalog.regclass,'pg_catalog.pg_auth_members'::pg_catalog.regclass,'pg_catalog.pg_database'::pg_catalog.regclass,'pg_catalog.pg_inherits'::pg_catalog.regclass,'pg_catalog.pg_description'::pg_catalog.regclass,'pg_catalog.pg_seclabel'::pg_catalog.regclass,'pg_catalog.pg_extension'::pg_catalog.regclass,'pg_catalog.pg_default_acl'::pg_catalog.regclass,'pg_catalog.pg_init_privs'::pg_catalog.regclass,'pg_catalog.pg_statistic_ext'::pg_catalog.regclass,'pg_catalog.pg_shdepend'::pg_catalog.regclass]::oid[]) catalog_oid
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
     AND l.locktype='relation' AND l.relation=catalog_oid AND l.granted
     AND l.mode IN('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
     AND l.database IN(0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())))) THEN
   RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED';END IF;
 END IF;
END $managed_catalog_fence$;
DO $quiescent440$BEGIN IF current_setting('transaction_isolation')<>'read committed'
 OR EXISTS(SELECT 1 FROM pg_locks l WHERE l.locktype='transactionid'AND l.mode='ExclusiveLock'AND l.granted
 AND(l.pid IS NULL OR l.pid<>pg_backend_pid()))OR EXISTS(SELECT 1 FROM pg_prepared_xacts)THEN
 RAISE EXCEPTION 'migration440 refuses concurrent/prepared writes or non-read-committed state';END IF;END $quiescent440$;
LOCK TABLE public.products,public.product_variants,public.inventory_levels,public.inventory_locations IN SHARE MODE NOWAIT;
DO $admit440$BEGIN IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='440')OR(SELECT count(*)FROM public.migration_privilege_journal WHERE migration='439')<>1 THEN RAISE EXCEPTION 'migration440 refuses unreviewed migration state';END IF;END $admit440$;
DO $quantity_dependency440$DECLARE f record;BEGIN
 SELECT *INTO STRICT f FROM pg_proc WHERE oid=to_regprocedure('public.catalog_available_quantity(public.products)');
 IF f.proowner<>current_user::regrole::oid OR f.prosecdef
 OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'bb02ce1837b15a4a8faf6bc6d2a37970eab7a0f3b7dabe17fc065c6de9922110'
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a WHERE a.grantor<>f.proowner OR a.grantee NOT IN(f.proowner,'service_role'::regrole,'app_tenant'::regrole)OR(a.grantee<>f.proowner AND a.is_grantable))THEN
 RAISE EXCEPTION 'migration440 refuses changed canonical quantity dependency';END IF;
END $quantity_dependency440$;
DO $before440$DECLARE f record;shape text;BEGIN
 SELECT *INTO STRICT f FROM pg_proc WHERE oid=to_regprocedure('public.browse_storefront_products_v1(uuid,jsonb,uuid[])');
 IF f.proowner<>current_user::regrole::oid OR f.prosecdef
 OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'4316c23eb2f4b7966c7249c8ffdf4563de955b46a0b9b00a423d0e0440a2bdce'
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a WHERE a.grantor<>f.proowner OR a.grantee NOT IN(f.proowner,'service_role'::regrole)OR(a.grantee<>f.proowner AND a.is_grantable))THEN RAISE EXCEPTION 'migration440 refuses changed canonical browse reader';END IF;
 shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',f.proacl,'language',f.prolang,'kind',f.prokind,'strict',f.proisstrict,'leakproof',f.proleakproof,'parallel',f.proparallel,'volatile',f.provolatile,'cost',f.procost,'rows',f.prorows,'support',f.prosupport,'config',f.proconfig,'comment',obj_description(f.oid,'pg_proc'))::text;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('440','public.browse_storefront_products_v1(uuid,jsonb,uuid[])',current_user,'CATALOG440 ORIGINAL FUNCTION','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
END $before440$;
CREATE OR REPLACE FUNCTION public.browse_storefront_products_v1(p_store_id uuid, p_query jsonb DEFAULT '{}', p_product_ids uuid[] DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
   AND(NOT query?'collection_id' OR public.collection_contains_product_v1(p_store_id,(query->>'collection_id')::uuid,jsonb_build_object('id',p.id,'store_id',p.store_id,'name',p.name,'product_type',p.product_type,'vendor',p.vendor,'tags',p.tags,'price',p.price,'stock',p.stock)))
 ), candidates AS MATERIALIZED (
  SELECT p.id,p.name,p.description,p.tags,p.category,p.country_of_origin,p.created_at,p.display_order,to_jsonb(p)-'display_order' AS product,
   v.variant_id,v.quantity,coalesce(v.price,p.price) AS candidate_price,
   public.storefront_discovery_flat_v1(p.metadata,v.metadata,v.variant_id IS NOT NULL,v.options,to_jsonb(p.images)) AS facts
  FROM base p CROSS JOIN LATERAL(
   SELECT v.id AS variant_id,v.inventory_qty AS quantity,v.price,v.metadata,
    coalesce((SELECT jsonb_object_agg(o.name,to_jsonb(CASE o.position WHEN 0 THEN v.option1 WHEN 1 THEN v.option2 WHEN 2 THEN v.option3 END)) FROM public.product_options o WHERE o.product_id=p.id AND o.position BETWEEN 0 AND 2),'{}') AS options
   FROM public.product_variants v WHERE v.product_id=p.id AND v.deleted_at IS NULL
   UNION ALL SELECT NULL::uuid,p.stock,p.price,'{}'::jsonb,'{}'::jsonb WHERE NOT EXISTS(SELECT 1 FROM public.product_variants v WHERE v.product_id=p.id AND v.deleted_at IS NULL)
  ) v
 ), matched_candidates AS MATERIALIZED (
  SELECT * FROM candidates c WHERE(c.quantity>0 OR NOT require_available)
   AND(NOT query?'search' OR position(lower(query->>'search') IN lower(concat_ws(' ',c.name,c.description,c.tags::text,c.facts->'books_author'::text,
    -- Only the canonical validated common electronics namespace contributes.
    -- Electronics variant overrides are unsupported. Never search raw JSON or
    -- invent an available variant witness for a supplied model/connector term.
    CASE WHEN public.storefront_discovery_facts_valid_v1(c.product#>'{metadata,electronics}','electronics',false)
     THEN concat_ws(' ',c.product#>>'{metadata,electronics,model}',
      (SELECT string_agg(connector->>'kind',' ' ORDER BY ordinal)
       FROM jsonb_array_elements(coalesce(c.product#>'{metadata,electronics,connectors}','[]'::jsonb))
        WITH ORDINALITY AS supplied(connector,ordinal)))
     ELSE NULL END)))>0)
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
 ), facet_counts AS(SELECT key,value,min(label) AS label,count(DISTINCT id) AS count,row_number() OVER(PARTITION BY key ORDER BY count(DISTINCT id) DESC,value ASC) AS rank FROM facet_values GROUP BY key,value),
 -- Capability only: input units convertible from actual available witnesses.
 -- The candidate already satisfied EVERY current predicate on the SAME variant.
 -- No unit facet/product count and no relaxed-query or separate catalog scan.
 measurement_units AS (
  SELECT u.unit,u.ordinal FROM (VALUES
   ('mm'::text,1::numeric,1),('cm'::text,10::numeric,2),
   ('m'::text,1000::numeric,3),('in'::text,25.4::numeric,4)
  ) AS u(unit,mm_per_unit,ordinal)
  WHERE EXISTS(SELECT 1 FROM matched_candidates c WHERE c.quantity>0
   AND CASE WHEN jsonb_typeof(c.facts->'_equipment_length_mm')='number'
    THEN (c.facts->>'_equipment_length_mm')::numeric>0
     AND (c.facts->>'_equipment_length_mm')::numeric/u.mm_per_unit<=100000
    ELSE false END)
 ),
 -- Independent supported thresholds; never a combined-fit claim. Reuse only
 -- resolved assembled-axis witnesses from the SAME fully matched candidates.
 measurement_axes AS (
  SELECT
   coalesce(bool_or(CASE WHEN jsonb_typeof(c.facts->'_width_mm')='number'
    THEN (c.facts->>'_width_mm')::numeric>0
     AND (c.facts->>'_width_mm')::numeric/10<=1000000
    ELSE false END),false) AS width_available,
   coalesce(bool_or(CASE WHEN jsonb_typeof(c.facts->'_depth_mm')='number'
    THEN (c.facts->>'_depth_mm')::numeric>0
     AND (c.facts->>'_depth_mm')::numeric/10<=1000000
    ELSE false END),false) AS depth_available
  FROM matched_candidates c WHERE c.quantity>0
 )
 SELECT jsonb_build_object(
  'data',coalesce((SELECT jsonb_agg(paged.product||jsonb_build_object('catalog_available_quantity',public.catalog_available_quantity(p)) ORDER BY paged.ordinal) FROM page paged JOIN public.products p ON p.id=paged.id AND p.store_id=p_store_id AND p.deleted_at IS NULL),'[]'),
  'count',(SELECT count(*) FROM matched),
  'matches',coalesce((SELECT jsonb_agg(jsonb_build_object('product_id',id,'price',matching_price,'variant_ids',variant_ids) ORDER BY ordinal) FROM page),'[]'),
  'facets',coalesce((SELECT jsonb_agg(jsonb_build_object('key',key,'value',value,'label',CASE WHEN key='pack_size' THEN split_part(value,':',2)||' '||split_part(value,':',1) ELSE label END,'count',count) ORDER BY key,value) FROM facet_counts WHERE rank<=40),'[]'),
  'measurement_capabilities',jsonb_build_object('equipment_length',jsonb_build_object(
   'available',EXISTS(SELECT 1 FROM measurement_units),
   'allowed_units',coalesce((SELECT jsonb_agg(unit ORDER BY ordinal) FROM measurement_units),'[]'::jsonb)
  ),
   'max_width_cm',jsonb_build_object('available',(SELECT width_available FROM measurement_axes)),
   'max_depth_cm',jsonb_build_object('available',(SELECT depth_available FROM measurement_axes))
  )
 ) INTO result;
 RETURN result;
END $function$;
DO $after440$DECLARE f record;shape text;BEGIN SELECT *INTO STRICT f FROM pg_proc WHERE oid=to_regprocedure('public.browse_storefront_products_v1(uuid,jsonb,uuid[])');shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',f.proacl,'language',f.prolang,'kind',f.prokind,'strict',f.proisstrict,'leakproof',f.proleakproof,'parallel',f.proparallel,'volatile',f.provolatile,'cost',f.procost,'rows',f.prorows,'support',f.prosupport,'config',f.proconfig,'comment',obj_description(f.oid,'pg_proc'))::text;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('440','public.browse_storefront_products_v1(uuid,jsonb,uuid[])',current_user,'CATALOG440 CURRENT FUNCTION','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex')),
 --439's paired DOWN already refuses extra journal rows: remove440 before439.
 ('439','public.browse_storefront_products_v1(uuid,jsonb,uuid[])',current_user,'CATALOG439 DEPENDENT440','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
END $after440$;
NOTIFY pgrst,'reload schema';
COMMIT;
