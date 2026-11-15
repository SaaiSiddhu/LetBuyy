-- Complete the existing product-category metadata owner over product.category.
-- One site lock orders category edits with canonical product writers.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:433:product-categories',0));
DO $preflight433$ BEGIN
 IF to_regclass('public.product_categories') IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='433') THEN
  RAISE EXCEPTION 'migration433 refuses existing category state'; END IF;
 IF EXISTS(SELECT 1 FROM public.products p WHERE p.deleted_at IS NULL AND nullif(btrim(p.category),'') IS NOT NULL
  AND(length(p.category)>100 OR p.store_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.sites s WHERE s.id=p.store_id))) THEN
  RAISE EXCEPTION 'migration433 refuses ambiguous retained category labels; reconcile without loss first'; END IF;
END $preflight433$;

CREATE TABLE public.product_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100 AND length(btrim(name))>0),
 slug text NOT NULL CHECK(length(slug) BETWEEN 1 AND 100 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 description text CHECK(description IS NULL OR length(description)<=500),
 image_url text CHECK(image_url IS NULL OR(length(image_url)<=2048 AND image_url ~ '^https?://[^[:space:]]+$')),
 parent_id uuid,display_order integer NOT NULL DEFAULT 0 CHECK(display_order>=0),
 is_visible boolean NOT NULL DEFAULT true,
 level integer NOT NULL DEFAULT 0 CHECK(level>=0),
 path text NOT NULL CHECK(length(path) BETWEEN 1 AND 500),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,created_by uuid,updated_by uuid,deleted_by uuid,
 UNIQUE(store_id,id),
 FOREIGN KEY(store_id,parent_id) REFERENCES public.product_categories(store_id,id) ON DELETE RESTRICT,
 CHECK(parent_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX product_categories_live_name ON public.product_categories(store_id,name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX product_categories_live_slug ON public.product_categories(store_id,slug) WHERE deleted_at IS NULL;
CREATE INDEX product_categories_page ON public.product_categories(store_id,display_order,name,id) WHERE deleted_at IS NULL;
CREATE INDEX product_categories_parent ON public.product_categories(store_id,parent_id) WHERE deleted_at IS NULL;

CREATE TABLE public.product_category_command_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL,category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE RESTRICT,
 authority_guard regprocedure NOT NULL DEFAULT 'public.assert_product_edit_actor_v1(uuid,uuid,text)'::regprocedure,
 idempotency_key uuid NOT NULL,operation text NOT NULL CHECK(operation IN('create','update','delete')),
 expected_version integer CHECK(expected_version IS NULL OR expected_version>0),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 before_state jsonb CHECK(before_state IS NULL OR jsonb_typeof(before_state)='object'),
 response jsonb NOT NULL CHECK(jsonb_typeof(response)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,created_by uuid NOT NULL,updated_by uuid NOT NULL,
 UNIQUE(store_id,actor_id,idempotency_key),
 CHECK((operation='create')=(expected_version IS NULL))
);
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_category_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_category_command_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_categories,public.product_category_command_receipts FROM PUBLIC,anon,authenticated,app_tenant,service_role;

CREATE FUNCTION public.guard_product_category_receipt_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN RAISE EXCEPTION 'product category command receipts are immutable' USING ERRCODE='42501'; END $fn$;
CREATE TRIGGER product_category_receipts_immutable BEFORE UPDATE OR DELETE ON public.product_category_command_receipts
 FOR EACH ROW EXECUTE FUNCTION public.guard_product_category_receipt_v1();
CREATE TRIGGER product_category_receipts_no_truncate BEFORE TRUNCATE ON public.product_category_command_receipts
 FOR EACH STATEMENT EXECUTE FUNCTION public.guard_product_category_receipt_v1();
CREATE TRIGGER product_categories_updated_at BEFORE UPDATE ON public.product_categories
 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER product_categories_version BEFORE UPDATE ON public.product_categories
 FOR EACH ROW EXECUTE FUNCTION public.increment_version();

CREATE FUNCTION public.protect_product_category_audit_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='TRUNCATE' THEN
  IF current_user::regrole::oid IS DISTINCT FROM(SELECT relowner FROM pg_class WHERE oid='public.audit_activity_events'::regclass)
   OR EXISTS(SELECT 1 FROM public.audit_activity_events WHERE resource_type='product_category') THEN
   RAISE EXCEPTION 'PRODUCT_CATEGORY_AUDIT_RETAINED' USING ERRCODE='42501'; END IF;
  RETURN NULL;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.resource_type='product_category' AND current_user::regrole::oid IS DISTINCT FROM(SELECT relowner FROM pg_class WHERE oid='public.audit_activity_events'::regclass) THEN
   RAISE EXCEPTION 'PRODUCT_CATEGORY_AUDIT_FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.resource_type='product_category' OR(TG_OP='UPDATE' AND NEW.resource_type='product_category') THEN
  RAISE EXCEPTION 'PRODUCT_CATEGORY_AUDIT_RETAINED' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $fn$;
CREATE TRIGGER audit_product_category_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.audit_activity_events
 FOR EACH ROW EXECUTE FUNCTION public.protect_product_category_audit_v1();
CREATE TRIGGER audit_product_category_no_truncate BEFORE TRUNCATE ON public.audit_activity_events
 FOR EACH STATEMENT EXECUTE FUNCTION public.protect_product_category_audit_v1();

CREATE FUNCTION public.product_category_slug_v1(p_site uuid,p_name text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE candidate text; suffix text;
BEGIN
 suffix:=substr(encode(sha256(convert_to(p_name,'UTF8')),'hex'),1,12);
 candidate:=btrim(regexp_replace(lower(btrim(p_name)),'[^a-z0-9]+','-','g'),'-');
 IF candidate='' THEN candidate:='category-'||suffix; END IF;
 candidate:=btrim(left(candidate,100),'-');
 IF EXISTS(SELECT 1 FROM public.product_categories WHERE store_id=p_site AND slug=candidate AND name<>p_name AND deleted_at IS NULL) THEN
  candidate:=btrim(left(candidate,87),'-')||'-'||suffix; END IF;
 RETURN candidate;
END $fn$;

CREATE FUNCTION public.assert_product_category_actor_v1(p_site uuid,p_actor uuid,p_write boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'app_tenant' OR p_site IS NULL OR p_actor IS NULL OR p_write IS NULL
  OR nullif(current_setting('app.site_id',true),'') IS DISTINCT FROM p_site::text
  OR nullif(current_setting('app.actor_id',true),'') IS DISTINCT FROM p_actor::text
  OR nullif(current_setting('request.jwt.claim.sub',true),'') IS DISTINCT FROM p_actor::text THEN
  RAISE EXCEPTION 'PRODUCT_CATEGORY_FORBIDDEN' USING ERRCODE='42501'; END IF;
 -- Keep the canonical user -> site lock order. Metadata writes serialize with
 -- product writers holding a site SHARE lock, including durable CSV rows.
 PERFORM id FROM public.users_custom WHERE id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_write THEN
  PERFORM id FROM public.sites WHERE id=p_site AND deleted_at IS NULL AND(custom_user_id=p_actor OR user_id=p_actor) FOR UPDATE;
 ELSE
  PERFORM id FROM public.sites WHERE id=p_site AND deleted_at IS NULL AND(custom_user_id=p_actor OR user_id=p_actor) FOR SHARE;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_FORBIDDEN' USING ERRCODE='42501'; END IF;
 PERFORM public.assert_product_edit_actor_v1(p_site,p_actor,CASE WHEN p_write THEN 'products:write' ELSE 'products:read' END);
END $fn$;

CREATE FUNCTION public.product_category_snapshot_v1(p_category uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
 SELECT to_jsonb(c)||jsonb_build_object(
  'products_count',(SELECT count(*)FROM public.products p WHERE p.store_id=c.store_id AND p.category=c.name AND p.deleted_at IS NULL),
  'children_count',(SELECT count(*)FROM public.product_categories child WHERE child.store_id=c.store_id AND child.parent_id=c.id AND child.deleted_at IS NULL))
 FROM public.product_categories c WHERE c.id=p_category;
$fn$;

CREATE FUNCTION public.observe_product_category_label_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE actor uuid; category uuid;
BEGIN
 IF NEW.deleted_at IS NOT NULL OR nullif(btrim(NEW.category),'') IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.category IS NOT DISTINCT FROM OLD.category AND NEW.store_id IS NOT DISTINCT FROM OLD.store_id
  AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN RETURN NEW; END IF;
 IF NEW.store_id IS NULL OR length(NEW.category)>100 THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_INVALID'; END IF;
 IF current_setting('role',true)='app_tenant' THEN
  actor:=nullif(current_setting('app.actor_id',true),'')::uuid;
  PERFORM public.assert_product_edit_actor_v1(NEW.store_id,actor,'products:write');
 ELSIF current_setting('role',true) IS DISTINCT FROM 'none'
  OR session_user::regrole::oid IS DISTINCT FROM(SELECT relowner FROM pg_class WHERE oid='public.products'::regclass) THEN
  RAISE EXCEPTION 'PRODUCT_CATEGORY_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('product.category.labels.v1:'||NEW.store_id::text,0));
 INSERT INTO public.product_categories(store_id,name,slug,path,created_by,updated_by)
 VALUES(NEW.store_id,NEW.category,public.product_category_slug_v1(NEW.store_id,NEW.category),
  public.product_category_slug_v1(NEW.store_id,NEW.category),actor,actor)
 ON CONFLICT(store_id,name)WHERE deleted_at IS NULL DO NOTHING RETURNING id INTO category;
 IF category IS NOT NULL THEN
  INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,request_id,after_state)
   VALUES(NEW.store_id,actor,CASE WHEN actor IS NULL THEN 'system' ELSE 'user' END,'category.label.observed','product_category',category::text,
    nullif(current_setting('app.request_id',true),''),public.product_category_snapshot_v1(category));
 END IF;
 RETURN NEW;
END $fn$;

-- Preserve exact existing label strings; category metadata does not rewrite
 -- retained products or invent an assignment identifier.
DO $backfill433$
DECLARE label record; slug text;
BEGIN
 FOR label IN SELECT DISTINCT store_id,category FROM public.products WHERE deleted_at IS NULL AND nullif(btrim(category),'') IS NOT NULL ORDER BY store_id,category LOOP
  slug:=public.product_category_slug_v1(label.store_id,label.category);
  INSERT INTO public.product_categories(store_id,name,slug,path)VALUES(label.store_id,label.category,slug,slug);
 END LOOP;
 IF EXISTS((SELECT store_id,category FROM public.products WHERE deleted_at IS NULL AND nullif(btrim(category),'') IS NOT NULL)
  EXCEPT(SELECT store_id,name FROM public.product_categories WHERE deleted_at IS NULL)) THEN
  RAISE EXCEPTION 'migration433 category backfill did not preserve every retained label'; END IF;
END $backfill433$;
CREATE TRIGGER products_category_label AFTER INSERT OR UPDATE OF category,store_id,deleted_at ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.observe_product_category_label_v1();

CREATE FUNCTION public.read_product_category_v1(p_site uuid,p_actor uuid,p_category uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
 PERFORM public.assert_product_category_actor_v1(p_site,p_actor,false);
 IF NOT EXISTS(SELECT 1 FROM public.product_categories WHERE id=p_category AND store_id=p_site AND deleted_at IS NULL) THEN
  RAISE EXCEPTION 'PRODUCT_CATEGORY_NOT_FOUND'; END IF;
 RETURN public.product_category_snapshot_v1(p_category);
END $fn$;

CREATE FUNCTION public.read_product_category_page_v1(p_site uuid,p_actor uuid,p_page integer,p_limit integer,p_search text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE total bigint; rows jsonb;
BEGIN
 PERFORM public.assert_product_category_actor_v1(p_site,p_actor,false);
 IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 10000 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
  OR p_search IS NULL OR length(p_search)>200 THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_INVALID'; END IF;
 WITH matching AS MATERIALIZED(SELECT id,display_order,name FROM public.product_categories WHERE store_id=p_site AND deleted_at IS NULL
  AND(p_search='' OR strpos(lower(name),lower(p_search))>0 OR strpos(lower(path),lower(p_search))>0)),
 page AS MATERIALIZED(SELECT * FROM matching ORDER BY display_order,name,id LIMIT p_limit OFFSET(p_page-1)*p_limit)
 SELECT(SELECT count(*)FROM matching),
  coalesce((SELECT jsonb_agg(public.product_category_snapshot_v1(page.id)ORDER BY page.display_order,page.name,page.id)FROM page),'[]')
 INTO total,rows;
 RETURN jsonb_build_object('success',true,'data',rows,'meta',jsonb_build_object(
  'page',p_page,'per_page',p_limit,'total',total,'total_pages',ceil(total::numeric/p_limit),
  'has_prev',p_page>1,'has_next',p_page<ceil(total::numeric/p_limit)));
END $fn$;

CREATE FUNCTION public.apply_product_category_command_v1(p_site uuid,p_actor uuid,p_operation text,
 p_category uuid,p_version integer,p_key uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE prior public.product_categories; parent public.product_categories; saved public.product_categories;
 receipt public.product_category_command_receipts; previous jsonb; response jsonb;
 next_name text; next_slug text; next_path text; next_level integer; next_parent uuid;
 changed_products integer:=0; product record; branch uuid[]; request_id text;
BEGIN
 PERFORM public.assert_product_category_actor_v1(p_site,p_actor,true);
 IF p_key IS NULL OR p_operation IS NULL OR p_operation NOT IN('create','update','delete')
  OR(p_operation='create' AND(p_category IS NOT NULL OR p_version IS NOT NULL))
  OR(p_operation<>'create' AND(p_category IS NULL OR p_version IS NULL OR p_version<=0))
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN('name','slug','description','image_url','parent_id','display_order','is_visible'))
  OR(p_operation='delete' AND p_payload<>'{}'::jsonb)
  OR(p_operation='update' AND p_payload='{}'::jsonb) THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_INVALID'; END IF;
 IF p_operation='create' AND NOT(p_payload?'name') THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_INVALID'; END IF;
 IF p_payload?'name' AND(jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string'
  OR length(btrim(p_payload->>'name')) NOT BETWEEN 1 AND 100 OR p_payload->>'name'<>btrim(p_payload->>'name')) THEN
  RAISE EXCEPTION 'PRODUCT_CATEGORY_INVALID'; END IF;
 IF p_payload?'slug' AND(jsonb_typeof(p_payload->'slug') IS DISTINCT FROM 'string'
  OR length(p_payload->>'slug') NOT BETWEEN 1 AND 100 OR p_payload->>'slug'!~'^[a-z0-9]+(-[a-z0-9]+)*$') THEN
  RAISE EXCEPTION 'PRODUCT_CATEGORY_INVALID'; END IF;
 IF p_payload?'description' AND p_payload->'description'<>'null'::jsonb
  AND(jsonb_typeof(p_payload->'description') IS DISTINCT FROM 'string' OR length(p_payload->>'description')>500) THEN
  RAISE EXCEPTION 'PRODUCT_CATEGORY_INVALID'; END IF;
 IF p_payload?'image_url' AND p_payload->'image_url'<>'null'::jsonb
  AND(jsonb_typeof(p_payload->'image_url') IS DISTINCT FROM 'string' OR length(p_payload->>'image_url')>2048
   OR p_payload->>'image_url'!~'^https?://[^[:space:]]+$') THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_INVALID'; END IF;
 IF p_payload?'parent_id' AND p_payload->'parent_id'<>'null'::jsonb
  AND(jsonb_typeof(p_payload->'parent_id') IS DISTINCT FROM 'string'
   OR p_payload->>'parent_id'!~*'^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$') THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_INVALID'; END IF;
 IF p_payload?'display_order' AND(jsonb_typeof(p_payload->'display_order') IS DISTINCT FROM 'number'
  OR(p_payload->>'display_order')::numeric NOT BETWEEN 0 AND 2147483647
  OR(p_payload->>'display_order')::numeric<>trunc((p_payload->>'display_order')::numeric)) THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_INVALID'; END IF;
 IF p_payload?'is_visible' AND jsonb_typeof(p_payload->'is_visible') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_INVALID'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('product.category.labels.v1:'||p_site::text,0));
 SELECT * INTO receipt FROM public.product_category_command_receipts WHERE store_id=p_site AND actor_id=p_actor AND idempotency_key=p_key;
 IF FOUND THEN
  IF receipt.operation IS DISTINCT FROM p_operation OR receipt.expected_version IS DISTINCT FROM p_version
   OR(p_operation<>'create' AND receipt.category_id IS DISTINCT FROM p_category) OR receipt.payload IS DISTINCT FROM p_payload THEN
   RAISE EXCEPTION 'PRODUCT_CATEGORY_KEY_CONFLICT'; END IF;
  RETURN receipt.response;
 END IF;
 request_id:=nullif(current_setting('app.request_id',true),'');
 IF p_operation<>'create' THEN
  SELECT * INTO prior FROM public.product_categories WHERE id=p_category AND store_id=p_site AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_NOT_FOUND'; END IF;
  IF prior.version<>p_version THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_VERSION_CONFLICT'; END IF;
  previous:=public.product_category_snapshot_v1(prior.id);
 END IF;
 IF p_operation='delete' THEN
  IF EXISTS(SELECT 1 FROM public.products WHERE store_id=p_site AND category=prior.name AND deleted_at IS NULL)
   OR EXISTS(SELECT 1 FROM public.product_categories WHERE store_id=p_site AND parent_id=prior.id AND deleted_at IS NULL) THEN
   RAISE EXCEPTION 'PRODUCT_CATEGORY_IN_USE'; END IF;
  UPDATE public.product_categories SET deleted_at=clock_timestamp(),deleted_by=p_actor,updated_by=p_actor WHERE id=prior.id RETURNING * INTO saved;
 ELSE
  next_name:=CASE WHEN p_payload?'name' THEN p_payload->>'name' ELSE prior.name END;
  next_slug:=CASE WHEN p_payload?'slug' THEN p_payload->>'slug' WHEN p_operation='create' THEN public.product_category_slug_v1(p_site,next_name) ELSE prior.slug END;
  next_parent:=CASE WHEN p_payload?'parent_id' THEN(p_payload->>'parent_id')::uuid ELSE prior.parent_id END;
  IF EXISTS(SELECT 1 FROM public.product_categories WHERE store_id=p_site AND deleted_at IS NULL
   AND(id IS DISTINCT FROM p_category)AND(name=next_name OR slug=next_slug)) THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_CONFLICT'; END IF;
  IF p_operation='update' THEN
   WITH RECURSIVE tree(id)AS(SELECT prior.id UNION SELECT c.id FROM public.product_categories c JOIN tree t ON c.parent_id=t.id WHERE c.store_id=p_site AND c.deleted_at IS NULL)
   SELECT array_agg(id)INTO branch FROM tree;
   IF next_parent=ANY(branch) THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_CYCLE'; END IF;
  END IF;
  IF next_parent IS NOT NULL THEN
   SELECT * INTO parent FROM public.product_categories WHERE id=next_parent AND store_id=p_site AND deleted_at IS NULL FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_PARENT_INVALID'; END IF;
   next_path:=parent.path||'/'||next_slug;next_level:=parent.level+1;
  ELSE next_path:=next_slug;next_level:=0; END IF;
  IF length(next_path)>500 THEN RAISE EXCEPTION 'PRODUCT_CATEGORY_PATH_TOO_LONG'; END IF;
  IF p_operation='create' THEN
   INSERT INTO public.product_categories(store_id,name,slug,description,image_url,parent_id,display_order,is_visible,level,path,created_by,updated_by)
   VALUES(p_site,next_name,next_slug,p_payload->>'description',p_payload->>'image_url',next_parent,
    coalesce((p_payload->>'display_order')::integer,0),coalesce((p_payload->>'is_visible')::boolean,true),next_level,next_path,p_actor,p_actor)RETURNING * INTO saved;
  ELSE
   IF EXISTS(SELECT 1 FROM public.product_categories WHERE id=ANY(branch)AND id<>prior.id
    AND(strpos(path,prior.path||'/')<>1 OR length(next_path||substr(path,length(prior.path)+1))>500)) THEN
    RAISE EXCEPTION 'PRODUCT_CATEGORY_PATH_TOO_LONG'; END IF;
   UPDATE public.product_categories SET name=next_name,slug=next_slug,
    description=CASE WHEN p_payload?'description' THEN p_payload->>'description' ELSE prior.description END,
    image_url=CASE WHEN p_payload?'image_url' THEN p_payload->>'image_url' ELSE prior.image_url END,
    parent_id=next_parent,display_order=coalesce((p_payload->>'display_order')::integer,prior.display_order),
    is_visible=coalesce((p_payload->>'is_visible')::boolean,prior.is_visible),level=next_level,path=next_path,updated_by=p_actor
    WHERE id=prior.id RETURNING * INTO saved;
   IF next_path IS DISTINCT FROM prior.path OR next_level IS DISTINCT FROM prior.level THEN
    UPDATE public.product_categories SET path=next_path||substr(path,length(prior.path)+1),
     level=level+next_level-prior.level,updated_by=p_actor WHERE id=ANY(branch)AND id<>prior.id;
   END IF;
   IF next_name IS DISTINCT FROM prior.name THEN
    -- Reuse the sole product edit writer, including its immutable receipts,
    -- version checks, audit/outbox and any product-specific invariants.
    FOR product IN SELECT id,version FROM public.products WHERE store_id=p_site AND category=prior.name AND deleted_at IS NULL ORDER BY id LOOP
     -- The canonical writer owns level -> variant -> product row locking.
     PERFORM public.apply_product_edit_v1(p_site,product.id,p_actor,product.version,gen_random_uuid(),jsonb_build_object('fields',jsonb_build_object('category',next_name)));
     changed_products:=changed_products+1;
    END LOOP;
   END IF;
  END IF;
 END IF;
 response:=public.product_category_snapshot_v1(saved.id)||jsonb_build_object('operation',p_operation,'idempotency_key',p_key,'affected_products',changed_products);
 INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,request_id,before_state,after_state,metadata)
 VALUES(p_site,p_actor,'user','category.'||p_operation,'product_category',saved.id::text,request_id,previous,response,jsonb_build_object('idempotency_key',p_key,'affected_products',changed_products));
 INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
 VALUES(p_site,p_site,'product_category',saved.id::text,'category.metadata.updated',
  jsonb_build_object('site_id',p_site,'category_id',saved.id,'version',saved.version,'operation',p_operation),
  'category.metadata.updated:'||p_key::text,request_id,p_actor,1);
 -- This private immutable receipt retains the authoritative command preimage
 -- and result; the platform activity timeline is written in the same commit.
 INSERT INTO public.product_category_command_receipts(store_id,actor_id,category_id,idempotency_key,operation,expected_version,payload,before_state,response,created_by,updated_by)
 VALUES(p_site,p_actor,saved.id,p_key,p_operation,p_version,p_payload,previous,response,p_actor,p_actor);
 RETURN response;
END $fn$;

REVOKE ALL ON FUNCTION public.guard_product_category_receipt_v1(),public.protect_product_category_audit_v1(),public.product_category_slug_v1(uuid,text),
 public.assert_product_category_actor_v1(uuid,uuid,boolean),public.product_category_snapshot_v1(uuid),
 public.observe_product_category_label_v1(),public.read_product_category_v1(uuid,uuid,uuid),
 public.read_product_category_page_v1(uuid,uuid,integer,integer,text),
 public.apply_product_category_command_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.read_product_category_v1(uuid,uuid,uuid),
 public.read_product_category_page_v1(uuid,uuid,integer,integer,text),
 public.apply_product_category_command_v1(uuid,uuid,text,uuid,integer,uuid,jsonb) TO app_tenant;

DO $provenance433$
DECLARE signature text; f record; shape text; relation_row record; item record; trigger_row record;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.guard_product_category_receipt_v1()','public.protect_product_category_audit_v1()','public.product_category_slug_v1(uuid,text)','public.assert_product_category_actor_v1(uuid,uuid,boolean)','public.product_category_snapshot_v1(uuid)','public.observe_product_category_label_v1()','public.read_product_category_v1(uuid,uuid,uuid)','public.read_product_category_page_v1(uuid,uuid,integer,integer,text)','public.apply_product_category_command_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)'] LOOP
  SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure(signature);
  IF NOT FOUND OR f.proowner<>current_user::regrole::oid THEN RAISE EXCEPTION 'migration433 refuses unknown function owner';END IF;
  shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'acl',
 (SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a),
 'owner',f.proowner,'language',f.prolang,'kind',f.prokind,'config',f.proconfig,'strict',f.proisstrict,
 'leakproof',f.proleakproof,'parallel',f.proparallel,'volatility',f.provolatile,'security',f.prosecdef,
 'support',f.prosupport,'cost',f.procost,'rows',f.prorows)::text;
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
  VALUES('433',signature,current_user,'CATEGORY FUNCTION PROFILE','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
 END LOOP;
 FOREACH signature IN ARRAY ARRAY['public.product_categories','public.product_category_command_receipts'] LOOP
  SELECT jsonb_build_object(
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'acl',(SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner)))a),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred)ORDER BY c.conname)FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid)ORDER BY i.indexrelid::regclass::text)FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled)ORDER BY x.tgname)FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid))ORDER BY x.polname)FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid)ORDER BY x.rulename)FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text INTO shape FROM pg_class t WHERE t.oid=to_regclass(signature);
  SELECT * INTO relation_row FROM pg_class WHERE oid=to_regclass(signature);
  IF relation_row.relowner<>current_user::regrole::oid THEN RAISE EXCEPTION 'migration433 refuses unknown table owner';END IF;
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
  VALUES('433',signature,current_user,'CATEGORY TABLE PROFILE','granted',relation_row.oid,relation_row.relowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
 END LOOP;
 FOR item IN SELECT * FROM(VALUES('public.products','products_category_label'),('public.audit_activity_events','audit_product_category_immutable'),('public.audit_activity_events','audit_product_category_no_truncate'))v(relation_name,trigger_name) LOOP
  SELECT * INTO relation_row FROM pg_class WHERE oid=to_regclass(item.relation_name);
  SELECT * INTO trigger_row FROM pg_trigger WHERE tgrelid=relation_row.oid AND tgname=item.trigger_name AND NOT tgisinternal;
  IF NOT FOUND OR relation_row.relowner<>current_user::regrole::oid THEN RAISE EXCEPTION 'migration433 refuses unknown trigger owner';END IF;
  shape:=jsonb_build_object('row',to_jsonb(trigger_row),'definition',pg_get_triggerdef(trigger_row.oid),'owner',relation_row.relowner)::text;
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
  VALUES('433',item.relation_name||':'||item.trigger_name,current_user,'CATEGORY TRIGGER PROFILE','granted',trigger_row.oid,relation_row.relowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
 END LOOP;
END $provenance433$;
NOTIFY pgrst,'reload schema';
COMMIT;
