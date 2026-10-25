-- Named canonical refinements, source normalization, and the single browse algorithm.

CREATE OR REPLACE FUNCTION public.storefront_discovery_date_v1(value text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE y integer; m integer; d integer; days integer;
BEGIN
 IF value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN false; END IF;
 y:=substring(value,1,4)::integer; m:=substring(value,6,2)::integer; d:=substring(value,9,2)::integer;
 IF m<1 OR m>12 OR d<1 THEN RETURN false; END IF;
 days:=(ARRAY[31,CASE WHEN y%4=0 AND(y%100<>0 OR y%400=0) THEN 29 ELSE 28 END,31,30,31,30,31,31,30,31,30,31])[m];
 RETURN d<=days;
END $fn$;

CREATE OR REPLACE FUNCTION public.storefront_discovery_isbn_v1(value text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE normalized text:=upper(replace(replace(public.storefront_discovery_trim_v1(value),' ',''),'-','')); total integer:=0; i integer;
BEGIN
 IF normalized ~ '^97[89][0-9]{10}$' THEN
  FOR i IN 1..13 LOOP total:=total+substring(normalized,i,1)::integer*CASE WHEN i%2=0 THEN 3 ELSE 1 END; END LOOP;RETURN total%10=0;
 ELSIF normalized ~ '^[0-9]{9}[0-9X]$' THEN
  FOR i IN 1..10 LOOP total:=total+(CASE WHEN substring(normalized,i,1)='X' THEN 10 ELSE substring(normalized,i,1)::integer END)*(11-i);END LOOP;RETURN total%11=0;
 END IF;RETURN false;
END $fn$;

CREATE OR REPLACE FUNCTION public.storefront_discovery_json_units_v1(value jsonb, depth integer DEFAULT 0)
RETURNS integer LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE result integer; row record; n integer;
BEGIN
 IF depth>12 OR octet_length(value::text)>65536 THEN RETURN 2147483647;END IF;
 IF jsonb_typeof(value)='object' THEN
  result:=2;n:=0;FOR row IN SELECT key,entry FROM jsonb_each(value) AS entries(key,entry) LOOP
   result:=result+public.storefront_discovery_utf16_length_v1(to_jsonb(row.key)::text)+1+public.storefront_discovery_json_units_v1(row.entry,depth+1);n:=n+1;
  END LOOP;RETURN result+greatest(n-1,0);
 ELSIF jsonb_typeof(value)='array' THEN
  SELECT 2+greatest(jsonb_array_length(value)-1,0)+coalesce(sum(public.storefront_discovery_json_units_v1(v,depth+1)),0) INTO result FROM jsonb_array_elements(value) AS entries(v);RETURN result;
 ELSIF jsonb_typeof(value)='number' THEN RETURN length(trim_scale((value#>>'{}')::numeric)::text);
 END IF;RETURN public.storefront_discovery_utf16_length_v1(value::text);
END $fn$;

CREATE OR REPLACE FUNCTION public.storefront_discovery_facts_valid_v1(value jsonb, namespace text, variant boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE row jsonb; child jsonb; name text; group_value jsonb;
BEGIN
 IF NOT public.storefront_discovery_shape_v1(value,namespace,variant) THEN RETURN false; END IF;
 CASE namespace
 WHEN 'toys' THEN
  FOREACH name IN ARRAY ARRAY['ageBands','interests'] LOOP
   IF (SELECT count(*)<>count(DISTINCT v) FROM jsonb_array_elements(coalesce(value->name,'[]')) entries(v)) THEN RETURN false;END IF;
  END LOOP;
  IF value->>'contentsComplete'='true' AND jsonb_array_length(coalesce(value->'contents','[]'))=0 THEN RETURN false;END IF;
  IF value?'dimensions' AND value->'dimensions'<>'null'::jsonb AND NOT(value->'dimensions'?|ARRAY['length','width','height']) THEN RETURN false;END IF;
  FOR row IN SELECT v FROM jsonb_array_elements(coalesce(value->'additionalDimensions','[]')) entries(v) LOOP
   IF NOT(row?|ARRAY['length','width','height']) OR nullif(public.storefront_discovery_trim_v1(row->>'label'),'') IS NULL THEN RETURN false;END IF;
  END LOOP;
 WHEN 'electronics' THEN
  IF (SELECT count(*)<>count(DISTINCT (v->>'kind')||':'||(v->>'role')) FROM jsonb_array_elements(coalesce(value->'connectors','[]')) entries(v)) THEN RETURN false;END IF;
  IF (SELECT count(*)<>count(DISTINCT lower(public.storefront_discovery_trim_v1(v->>'manufacturer')||':'||public.storefront_discovery_trim_v1(v->>'model'))) FROM jsonb_array_elements(coalesce(value->'compatible_devices','[]')) entries(v)) THEN RETURN false;END IF;
  IF value?'power_input_w' AND value?'pass_through_output_w' AND (value->>'pass_through_output_w')::numeric>(value->>'power_input_w')::numeric THEN RETURN false;END IF;
  IF value?'fact_sheet' AND NOT public.storefront_discovery_date_v1(value->'fact_sheet'->>'source_date') THEN RETURN false;END IF;
  FOR row IN SELECT v FROM jsonb_array_elements(coalesce(value->'compatible_devices','[]')) entries(v) LOOP
   IF NOT public.storefront_discovery_date_v1(row->>'source_date') OR public.storefront_discovery_trim_v1(row->>'model')~*'^(\*|all( devices| models)?|any( device| model)?|universal)$' THEN RETURN false;END IF;
  END LOOP;
 WHEN 'furniture' THEN
  FOREACH name IN ARRAY ARRAY['assembled','package'] LOOP
   IF value?name AND NOT(value->name?|ARRAY['width','depth','height','diameter']) THEN RETURN false;END IF;
  END LOOP;
 WHEN 'gifts' THEN
  FOREACH name IN ARRAY ARRAY['occasions','recipients'] LOOP
   IF (SELECT count(*)<>count(DISTINCT v) FROM jsonb_array_elements(coalesce(value->name,'[]')) entries(v)) THEN RETURN false;END IF;
  END LOOP;
  IF (SELECT count(*)<>count(DISTINCT lower(normalize(public.storefront_discovery_trim_v1(v->>'label'),NFKC))) FROM jsonb_array_elements(coalesce(value->'contents','[]')) entries(v)) THEN RETURN false;END IF;
  IF value?'mediaRoles' AND (value->'mediaRoles'='{}'::jsonb OR value->'mediaRoles'->'openBox'=value->'mediaRoles'->'closedBox') THEN RETURN false;END IF;
  IF jsonb_array_length(coalesce(value->'occasions','[]'))=0 AND jsonb_array_length(coalesce(value->'recipients','[]'))=0 AND nullif(public.storefront_discovery_trim_v1(value->>'suitabilityNote'),'') IS NULL AND jsonb_array_length(coalesce(value->'contents','[]'))=0 AND NOT value?'mediaRoles' THEN RETURN false;END IF;
  IF public.storefront_discovery_json_units_v1(value)>16000 THEN RETURN false;END IF;
 WHEN 'personalization' THEN
  IF value?'production_note' AND public.storefront_discovery_utf16_length_v1(value->>'production_note')>1000 THEN RETURN false;END IF;
  IF (SELECT count(*)<>count(DISTINCT v->>'id') FROM jsonb_array_elements(value->'methods') entries(v)) THEN RETURN false;END IF;
  FOR row IN SELECT v FROM jsonb_array_elements(value->'methods') entries(v) LOOP
   IF NOT public.storefront_discovery_label_v1(row->>'label') OR (row->>'min_graphemes')::numeric>(row->>'max_graphemes')::numeric THEN RETURN false;END IF;
   FOREACH name IN ARRAY ARRAY['styles','placements'] LOOP
    IF (SELECT count(*)<>count(DISTINCT v->>'id') FROM jsonb_array_elements(row->name) entries(v)) THEN RETURN false;END IF;
    FOR child IN SELECT v FROM jsonb_array_elements(row->name) entries(v) LOOP
     IF NOT public.storefront_discovery_label_v1(child->>'label') THEN RETURN false;END IF;
    END LOOP;
   END LOOP;
  END LOOP;
 WHEN 'beauty' THEN
  IF (SELECT count(*)<>count(DISTINCT public.storefront_discovery_trim_v1(v->>'value')) FROM jsonb_array_elements(coalesce(value->'shades','[]')) entries(v)) THEN RETURN false;END IF;
 WHEN 'sports' THEN
  IF variant AND NOT(value?|ARRAY['length','weight','gripCircumference','dimensions']) THEN RETURN false;END IF;
 WHEN 'books' THEN
  IF value->>'kind'='stationery' AND value?'page_count' AND value?'sheet_count' AND (value->>'page_count')::numeric<>2*(value->>'sheet_count')::numeric THEN RETURN false;END IF;
  IF value?'isbn' AND NOT public.storefront_discovery_isbn_v1(value->>'isbn') THEN RETURN false;END IF;
 ELSE NULL;
 END CASE;RETURN true;
END $fn$;

CREATE OR REPLACE FUNCTION public.storefront_discovery_mm_v1(value jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 SELECT CASE WHEN jsonb_typeof(value->'value')='number' AND value->>'unit' IN('mm','cm','m','in') THEN round((value->>'value')::numeric*CASE value->>'unit' WHEN 'mm' THEN 1 WHEN 'cm' THEN 10 WHEN 'm' THEN 1000 WHEN 'in' THEN 25.4 END,3) ELSE NULL END;
$fn$;

CREATE OR REPLACE FUNCTION public.storefront_discovery_flat_v1(metadata jsonb, variant_metadata jsonb, has_variant boolean, options jsonb, images jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE facts jsonb:='{}'; result jsonb:='{}'; name text; common jsonb; selected jsonb; resolved jsonb; row jsonb; value jsonb; ns text; number_key text; dim jsonb;
BEGIN
 FOREACH name IN ARRAY ARRAY['toys','electronics','food','furniture','gifts','personalization','beauty','sports','books'] LOOP
  common:=metadata->name;selected:=variant_metadata->name;resolved:=NULL;
  IF public.storefront_discovery_facts_valid_v1(common,name,false) THEN resolved:=common;END IF;
  IF has_variant AND name IN('toys','furniture','sports','books') AND selected IS NOT NULL AND selected<>'null'::jsonb THEN
   IF public.storefront_discovery_facts_valid_v1(selected,name,true) THEN
    IF name='books' AND resolved IS NOT NULL AND resolved->>'kind'<>selected->>'kind' THEN resolved:=NULL;
    ELSE
     resolved:=coalesce(resolved,'{}')||selected;
     IF name='toys' AND selected?'contents' AND NOT selected?'contentsComplete' THEN resolved:=resolved||'{"contentsComplete":false}';END IF;
     IF NOT public.storefront_discovery_facts_valid_v1(resolved,name,false) THEN resolved:=NULL;END IF;
    END IF;
   ELSE resolved:=NULL;END IF;
  END IF;
  IF has_variant AND name='food' THEN
   -- A variant's net quantity never inherits a common product pack quantity.
   IF public.storefront_discovery_facts_valid_v1(selected,name,true) THEN resolved:=jsonb_build_object('netQuantity',selected->'netQuantity');ELSE resolved:=NULL;END IF;
  END IF;
  IF name='gifts' AND resolved?'mediaRoles' THEN
   IF jsonb_typeof(images) IS DISTINCT FROM 'array' THEN resolved:=NULL;
   ELSIF EXISTS(SELECT 1 FROM jsonb_each(resolved->'mediaRoles') roles(k,v) WHERE (v#>>'{}')::integer>=jsonb_array_length(images) OR nullif(btrim(images->>((v#>>'{}')::integer)),'') IS NULL) THEN resolved:=NULL;END IF;
  END IF;
  IF resolved IS NOT NULL THEN facts:=facts||jsonb_build_object(name,resolved);END IF;
 END LOOP;
 -- Flat lists survive the renderer's existing cap and use only validated source facts.
 result:=result||jsonb_build_object('age_band',coalesce(facts->'toys'->'ageBands','[]'),'interest',coalesce(facts->'toys'->'interests','[]'));
 IF facts->'electronics'?'kind' THEN result:=result||jsonb_build_object('electronics_kind',jsonb_build_array(facts->'electronics'->'kind'));END IF;
 SELECT coalesce(jsonb_agg(DISTINCT v->'kind'),'[]') INTO value FROM jsonb_array_elements(coalesce(facts->'electronics'->'connectors','[]')) entries(v);result:=result||jsonb_build_object('connector',value);
 FOREACH number_key IN ARRAY ARRAY['power_input_w','power_output_w','power_capacity_w','pass_through_output_w','data_rate_mbps','length_mm'] LOOP
  IF facts->'electronics'?number_key THEN result:=result||jsonb_build_object(number_key,jsonb_build_array(facts->'electronics'->number_key));END IF;
 END LOOP;
 value:=facts->'food'->'netQuantity';
 IF jsonb_typeof(value)='object' THEN result:=result||jsonb_build_object('pack_size',jsonb_build_array((value->>'unit')||':'||trim_scale((value->>'value')::numeric)::text));END IF;
 IF facts?'furniture' THEN
  value:=facts->'furniture';result:=result||jsonb_build_object('material',coalesce(value->'materials','[]'));
  IF value?'finish' THEN result:=result||jsonb_build_object('finish',jsonb_build_array(value->'finish'));END IF;
  dim:=value->'assembled';
  IF dim?'width' THEN result:=result||jsonb_build_object('_width_mm',public.storefront_discovery_mm_v1(jsonb_build_object('value',dim->'width','unit',dim->'unit')));END IF;
  IF dim?'depth' THEN result:=result||jsonb_build_object('_depth_mm',public.storefront_discovery_mm_v1(jsonb_build_object('value',dim->'depth','unit',dim->'unit')));END IF;
 END IF;
 result:=result||jsonb_build_object('occasion',coalesce(facts->'gifts'->'occasions','[]'),'recipient',coalesce(facts->'gifts'->'recipients','[]'));
 SELECT coalesce(jsonb_agg(v->'id'),'[]') INTO value FROM jsonb_array_elements(coalesce(facts->'personalization'->'methods','[]')) entries(v);result:=result||jsonb_build_object('personalization_method',value);
 IF facts?'beauty' THEN
  value:=facts->'beauty';
  IF value?'routineStage' THEN result:=result||jsonb_build_object('routine_stage',jsonb_build_array(value->'routineStage'));END IF;
  IF value?'format' THEN result:=result||jsonb_build_object('format',jsonb_build_array(value->'format'));END IF;
  SELECT coalesce(jsonb_agg(v->'value'),'[]') INTO value FROM jsonb_array_elements(coalesce(value->'shades','[]')) entries(v)
   WHERE v->>'value'=options->>coalesce(facts->'beauty'->>'shadeOptionName','Shade');
  result:=result||jsonb_build_object('shade',value);
 END IF;
 IF facts?'sports' THEN
  value:=facts->'sports';result:=result||jsonb_build_object('activity',jsonb_build_array(value->'activity'),'equipment_type',jsonb_build_array(value->'equipmentType'));
  IF value?'length' THEN result:=result||jsonb_build_object('_equipment_length_mm',public.storefront_discovery_mm_v1(value->'length'));END IF;
 END IF;
 IF facts?'books' THEN
  value:=facts->'books';result:=result||jsonb_build_object('books_kind',jsonb_build_array(value->'kind'));
  FOREACH name IN ARRAY ARRAY['language','format','ruling'] LOOP IF value?name THEN result:=result||jsonb_build_object('books_'||name,jsonb_build_array(value->name));END IF;END LOOP;
  result:=result||jsonb_build_object('books_author',coalesce(value->'authors','[]'),'books_subject',coalesce(value->'subjects','[]'));
 END IF;
 FOR name,value IN SELECT key,v FROM jsonb_each(options) entries(key,v) LOOP
  IF lower(name)='size' THEN result:=result||jsonb_build_object('size',jsonb_build_array(value));
  ELSIF lower(name) IN('color','colour') THEN result:=result||jsonb_build_object('color',jsonb_build_array(value));END IF;
 END LOOP;
 RETURN result;
END $fn$;

CREATE OR REPLACE FUNCTION public.storefront_discovery_match_v1(query jsonb, facts jsonb, price numeric)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE name text; value jsonb; requested jsonb; item text; present boolean; comparison numeric;
BEGIN
 IF price IS NULL OR price<0 THEN RETURN false;END IF;
 FOR name,value IN SELECT key,v FROM jsonb_each(query) entries(key,v) LOOP
  IF name IN('page','limit','sort','search','category','country_of_origin','collection_id','length_unit') THEN CONTINUE;
  ELSIF name='min_price' THEN IF price<(value#>>'{}')::numeric THEN RETURN false;END IF;
  ELSIF name='max_price' THEN IF price>(value#>>'{}')::numeric THEN RETURN false;END IF;
  ELSIF name IN('max_width_cm','max_depth_cm') THEN
   comparison:=(facts->>CASE name WHEN 'max_width_cm' THEN '_width_mm' ELSE '_depth_mm' END)::numeric;
   IF comparison IS NULL OR comparison>(value#>>'{}')::numeric*10 THEN RETURN false;END IF;
  ELSIF name='length_value' THEN
   comparison:=public.storefront_discovery_mm_v1(jsonb_build_object('value',value,'unit',query->'length_unit'));
   IF comparison IS NULL OR facts->>'_equipment_length_mm' IS NULL OR comparison<>(facts->>'_equipment_length_mm')::numeric THEN RETURN false;END IF;
  ELSIF name IN('power_input_w','power_output_w','power_capacity_w','pass_through_output_w','data_rate_mbps','length_mm') THEN
   IF facts->name->>0 IS NULL OR (facts->name->>0)::numeric<>(value#>>'{}')::numeric THEN RETURN false;END IF;
  ELSE
   requested:=CASE WHEN jsonb_typeof(value)='array' THEN value ELSE jsonb_build_array(value) END;
   SELECT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(facts->name,'[]')) source(v)
    CROSS JOIN jsonb_array_elements_text(requested) wanted(v)
    WHERE CASE WHEN name='books_author' THEN position(lower(public.storefront_discovery_trim_v1(wanted.v)) IN lower(public.storefront_discovery_trim_v1(source.v)))>0
     ELSE lower(public.storefront_discovery_trim_v1(source.v))=lower(public.storefront_discovery_trim_v1(wanted.v)) END) INTO present;
   IF NOT present THEN RETURN false;END IF;
  END IF;
 END LOOP;RETURN true;
END $fn$;

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

CREATE OR REPLACE FUNCTION public.browse_storefront_apparel_v1(
 p_store_id uuid,p_page integer DEFAULT 1,p_limit integer DEFAULT 20,p_size text DEFAULT NULL,p_color text DEFAULT NULL,
 p_min_price numeric DEFAULT NULL,p_max_price numeric DEFAULT NULL,p_sort text DEFAULT 'display_order',p_search text DEFAULT NULL,
 p_category text DEFAULT NULL,p_collection_id uuid DEFAULT NULL,p_relational boolean DEFAULT true,p_country_of_origin text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE result jsonb;
BEGIN
 result:=public.browse_storefront_products_v1(p_store_id,jsonb_strip_nulls(jsonb_build_object('page',p_page,'limit',p_limit,'size',p_size,'color',p_color,
  'min_price',p_min_price,'max_price',p_max_price,'sort',p_sort,'search',p_search,'category',p_category,'collection_id',p_collection_id,'country_of_origin',p_country_of_origin)),NULL);
 RETURN jsonb_build_object('data',result->'data','count',result->'count');
END $fn$;
