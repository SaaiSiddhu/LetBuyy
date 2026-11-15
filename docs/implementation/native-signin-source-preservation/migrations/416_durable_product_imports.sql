-- One durable import owner. The canonical product planner/edit writer is reused.
-- No object-storage lock, new runtime or generic background SQL capability.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:416:product-imports',0));
DO $preflight416$ BEGIN
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='416') THEN
  RAISE EXCEPTION 'migration416 provenance already exists'; END IF;
END $preflight416$;

CREATE TABLE public.product_import_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL,
 authority_guard regprocedure NOT NULL DEFAULT 'public.assert_product_edit_actor_v1(uuid,uuid,text)'::regprocedure,
 idempotency_key uuid NOT NULL,
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
 plans_sha256 text NOT NULL CHECK(plans_sha256 ~ '^[0-9a-f]{64}$'),
 schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
 total_rows integer NOT NULL CHECK(total_rows BETWEEN 0 AND 500),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','completed','failed','stopped','blocked')),
 error_code text,
 lease_token uuid, lease_expires_at timestamptz,
 started_at timestamptz, completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz, created_by uuid NOT NULL, updated_by uuid NOT NULL,
 UNIQUE(site_id,actor_id,idempotency_key), UNIQUE(site_id,id),
 CHECK((lease_token IS NULL)=(lease_expires_at IS NULL)),
 CHECK((status='running')=(lease_token IS NOT NULL)),
 CHECK(total_rows>0 OR(status='stopped' AND error_code='PRODUCT_IMPORT_STOPPED' AND completed_at IS NOT NULL))
);
CREATE INDEX product_import_jobs_due_idx ON public.product_import_jobs(status,lease_expires_at,created_at);
CREATE INDEX product_import_jobs_owner_idx ON public.product_import_jobs(site_id,actor_id,created_at DESC,id);

CREATE TABLE public.product_import_rows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
 job_id uuid NOT NULL,
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 500),
 plan jsonb NOT NULL CHECK(jsonb_typeof(plan)='object'),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','completed','failed','stopped')),
 product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
 response jsonb, error_code text, attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz, created_by uuid NOT NULL, updated_by uuid NOT NULL,
 FOREIGN KEY(site_id,job_id) REFERENCES public.product_import_jobs(site_id,id) ON DELETE RESTRICT,
 UNIQUE(job_id,ordinal),
 CHECK((status='completed' AND product_id IS NOT NULL AND response IS NOT NULL)
  OR(status<>'completed' AND product_id IS NULL AND response IS NULL)),
 CHECK(response IS NULL OR jsonb_typeof(response)='object')
);
CREATE INDEX product_import_rows_work_idx ON public.product_import_rows(site_id,job_id,status,ordinal);
ALTER TABLE public.product_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_import_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_import_rows FORCE ROW LEVEL SECURITY;
-- Private work/receipts: no raw API-role reads/writes, including service_role.
REVOKE ALL ON public.product_import_jobs,public.product_import_rows FROM PUBLIC,anon,authenticated,app_tenant,service_role;

CREATE FUNCTION public.guard_product_import_record_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'product import records are retained' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='product_import_rows' THEN
  IF OLD.status='completed' OR NEW.id IS DISTINCT FROM OLD.id OR NEW.site_id IS DISTINCT FROM OLD.site_id
   OR NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.ordinal IS DISTINCT FROM OLD.ordinal
   OR NEW.plan IS DISTINCT FROM OLD.plan OR NEW.created_at IS DISTINCT FROM OLD.created_at
   OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
   RAISE EXCEPTION 'product import row intent/receipt is immutable' USING ERRCODE='42501';
  END IF;
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.site_id IS DISTINCT FROM OLD.site_id
   OR NEW.actor_id IS DISTINCT FROM OLD.actor_id OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
   OR NEW.authority_guard IS DISTINCT FROM OLD.authority_guard
   OR NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256 OR NEW.plans_sha256 IS DISTINCT FROM OLD.plans_sha256
   OR NEW.schema_version IS DISTINCT FROM OLD.schema_version OR NEW.total_rows IS DISTINCT FROM OLD.total_rows
   OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.created_by IS DISTINCT FROM OLD.created_by
   OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
   RAISE EXCEPTION 'product import intent is immutable' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER product_import_jobs_guard BEFORE UPDATE OR DELETE ON public.product_import_jobs
 FOR EACH ROW EXECUTE FUNCTION public.guard_product_import_record_v1();
CREATE TRIGGER product_import_rows_guard BEFORE UPDATE OR DELETE ON public.product_import_rows
 FOR EACH ROW EXECUTE FUNCTION public.guard_product_import_record_v1();

CREATE FUNCTION public.assert_product_import_actor_v1(p_site uuid,p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
 PERFORM public.assert_product_edit_actor_v1(p_site,p_actor,'products:write');
 IF NOT EXISTS(SELECT 1 FROM public.sites WHERE id=p_site AND deleted_at IS NULL
    AND(custom_user_id=p_actor OR user_id=p_actor)) THEN
  RAISE EXCEPTION 'PRODUCT_IMPORT_FORBIDDEN' USING ERRCODE='42501';
 END IF;
END $fn$;

-- Shared by the normal creator and import rows, before their parent INSERT.
CREATE FUNCTION public.assert_product_creation_limit_v1(p_site uuid,p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE entitlements jsonb; limit_value numeric; present_count bigint;
BEGIN
 PERFORM public.assert_product_edit_actor_v1(p_site,p_actor,'products:write');
 PERFORM pg_advisory_xact_lock(hashtextextended('product.create.v1:'||p_site::text,0));
 entitlements:=public.resolve_site_entitlements(p_site);
 IF entitlements->>'site_id' IS DISTINCT FROM p_site::text
  OR jsonb_typeof(entitlements->'limits') IS DISTINCT FROM 'object'
  OR NOT(entitlements->'limits'?'products') THEN RAISE EXCEPTION 'ENTITLEMENT_AUTHORITY_UNAVAILABLE'; END IF;
 IF entitlements->'limits'->'products'='null'::jsonb THEN RETURN; END IF;
 IF jsonb_typeof(entitlements->'limits'->'products') IS DISTINCT FROM 'number' THEN
  RAISE EXCEPTION 'ENTITLEMENT_AUTHORITY_UNAVAILABLE'; END IF;
 limit_value:=public.get_usage_limit_from_entitlements(entitlements,'products');
 IF limit_value IS NULL OR limit_value<0 OR trunc(limit_value)<>limit_value THEN
  RAISE EXCEPTION 'ENTITLEMENT_AUTHORITY_UNAVAILABLE'; END IF;
 SELECT count(*) INTO present_count FROM public.products WHERE store_id=p_site AND deleted_at IS NULL;
 IF present_count>=limit_value THEN RAISE EXCEPTION 'PRODUCT_LIMIT_REACHED'; END IF;
END $fn$;

-- The existing usage ledger, in the same transaction as creation and its receipt.
CREATE FUNCTION public.record_product_creation_usage_v1(p_site uuid,p_actor uuid,p_product uuid,p_create_key uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
 PERFORM public.assert_product_edit_actor_v1(p_site,p_actor,'products:write');
 IF NOT EXISTS(SELECT 1 FROM public.product_edit_receipts WHERE idempotency_key=p_create_key
   AND store_id=p_site AND actor_id=p_actor AND product_id=p_product AND operation='product.update.v1') THEN
  RAISE EXCEPTION 'PRODUCT_IMPORT_RECEIPT_UNVERIFIED'; END IF;
 PERFORM public.record_site_usage(p_site,'products',1,'product.create:'||p_product::text,'product-service',
  'product',p_product::text,nullif(current_setting('app.request_id',true),''),NULL,jsonb_build_object('actor_id',p_actor));
END $fn$;

CREATE FUNCTION public.product_import_snapshot_v1(p_job uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
 SELECT jsonb_build_object('id',j.id,'type','product_import','contract_version',2,'store_id',j.site_id,
  'actor_id',j.actor_id,'idempotency_key',j.idempotency_key,'source_sha256',j.source_sha256,
  'status',j.status,'total_rows',j.total_rows,'row_count',r.completed,'failed_rows',r.failed,
  'pending_rows',r.queued,'stopped_rows',r.stopped,'resumable',j.status IN('queued','failed'),
  'error_code',j.error_code,'created_at',j.created_at,'updated_at',j.updated_at,
  'started_at',j.started_at,'completed_at',j.completed_at,'download_url',NULL)
 FROM public.product_import_jobs j CROSS JOIN LATERAL(
  SELECT count(*) FILTER(WHERE status='completed') completed,count(*) FILTER(WHERE status='failed') failed,
   count(*) FILTER(WHERE status='queued') queued,count(*) FILTER(WHERE status='stopped') stopped
  FROM public.product_import_rows WHERE site_id=j.site_id AND job_id=j.id
 )r WHERE j.id=p_job AND j.deleted_at IS NULL;
$fn$;

CREATE FUNCTION public.register_product_import_v1(p_site uuid,p_actor uuid,p_key uuid,p_source_hash text,p_plans jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE j public.product_import_jobs; plan_hash text; item jsonb; position integer:=0;
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 IF p_key IS NULL OR p_source_hash IS NULL OR p_source_hash !~ '^[0-9a-f]{64}$'
  OR jsonb_typeof(p_plans) IS DISTINCT FROM 'array' OR jsonb_array_length(p_plans) NOT BETWEEN 1 AND 500
  OR octet_length(p_plans::text)>4194304 THEN RAISE EXCEPTION 'PRODUCT_IMPORT_INVALID'; END IF;
 plan_hash:=encode(extensions.digest(p_plans::text,'sha256'),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended('product.import.v1:'||p_site::text||':'||p_actor::text||':'||p_key::text,0));
 SELECT * INTO j FROM public.product_import_jobs WHERE site_id=p_site AND actor_id=p_actor AND idempotency_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF j.source_sha256<>p_source_hash THEN RAISE EXCEPTION 'PRODUCT_IMPORT_KEY_CONFLICT'; END IF;
  IF j.total_rows=0 AND j.status='stopped' THEN RETURN public.product_import_snapshot_v1(j.id); END IF;
  IF j.plans_sha256<>plan_hash THEN RAISE EXCEPTION 'PRODUCT_IMPORT_KEY_CONFLICT'; END IF;
  RETURN public.product_import_snapshot_v1(j.id);
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_plans) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'productInsert') IS DISTINCT FROM 'object'
   OR item->'productInsert'->>'store_id' IS DISTINCT FROM p_site::text
   OR jsonb_typeof(item->'productOptions') IS DISTINCT FROM 'array'
   OR jsonb_typeof(item->'productVariants') IS DISTINCT FROM 'array'
   OR jsonb_typeof(item->'initialStock') IS DISTINCT FROM 'number'
   OR (item->>'initialStock')::numeric<0 OR trunc((item->>'initialStock')::numeric)<>(item->>'initialStock')::numeric
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(item)k WHERE k NOT IN('slug','productInsert','productOptions','productVariants','initialStock')) THEN
   RAISE EXCEPTION 'PRODUCT_IMPORT_INVALID'; END IF;
 END LOOP;
 INSERT INTO public.product_import_jobs(site_id,actor_id,idempotency_key,source_sha256,plans_sha256,total_rows,created_by,updated_by)
 VALUES(p_site,p_actor,p_key,p_source_hash,plan_hash,jsonb_array_length(p_plans),p_actor,p_actor) RETURNING * INTO j;
 FOR item IN SELECT value FROM jsonb_array_elements(p_plans) LOOP
  position:=position+1;
  INSERT INTO public.product_import_rows(site_id,job_id,ordinal,plan,created_by,updated_by)
  VALUES(p_site,j.id,position,item,p_actor,p_actor);
 END LOOP;
 RETURN public.product_import_snapshot_v1(j.id);
END $fn$;

CREATE FUNCTION public.read_product_import_v1(p_site uuid,p_actor uuid,p_job uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 IF NOT EXISTS(SELECT 1 FROM public.product_import_jobs WHERE id=p_job AND site_id=p_site AND actor_id=p_actor AND deleted_at IS NULL) THEN RETURN NULL; END IF;
 RETURN public.product_import_snapshot_v1(p_job);
END $fn$;

CREATE FUNCTION public.claim_product_import_v1(p_site uuid,p_actor uuid,p_job uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE j public.product_import_jobs; lease uuid;
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 SELECT * INTO j FROM public.product_import_jobs WHERE id=p_job AND site_id=p_site AND actor_id=p_actor AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_IMPORT_NOT_FOUND'; END IF;
 IF j.status NOT IN('queued','running') OR j.lease_expires_at>clock_timestamp() THEN RETURN NULL; END IF;
 lease:=gen_random_uuid();
 UPDATE public.product_import_jobs SET status='running',error_code=NULL,lease_token=lease,
  lease_expires_at=clock_timestamp()+interval '120 seconds',started_at=coalesce(started_at,clock_timestamp()),
  updated_at=clock_timestamp(),updated_by=p_actor WHERE id=p_job;
 RETURN lease;
END $fn$;

CREATE FUNCTION public.begin_product_import_row_v1(p_site uuid,p_actor uuid,p_job uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE j public.product_import_jobs; r public.product_import_rows;
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 SELECT * INTO j FROM public.product_import_jobs WHERE id=p_job AND site_id=p_site AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_IMPORT_NOT_FOUND'; END IF;
 IF p_lease IS NULL OR j.status<>'running' OR j.lease_token IS DISTINCT FROM p_lease
  OR NOT(j.lease_expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'PRODUCT_IMPORT_LEASE_EXPIRED'; END IF;
 SELECT * INTO r FROM public.product_import_rows WHERE site_id=p_site AND job_id=p_job AND status='queued' ORDER BY ordinal LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',r.id,'ordinal',r.ordinal,'plan',r.plan);
END $fn$;

CREATE FUNCTION public.complete_product_import_row_v1(p_site uuid,p_actor uuid,p_job uuid,p_lease uuid,p_row uuid,p_product jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE j public.product_import_jobs; r public.product_import_rows; receipt public.product_edit_receipts; v_mutation jsonb;
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 SELECT * INTO j FROM public.product_import_jobs WHERE id=p_job AND site_id=p_site AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_IMPORT_NOT_FOUND'; END IF;
 IF p_lease IS NULL OR j.status<>'running' OR j.lease_token IS DISTINCT FROM p_lease
  OR NOT(j.lease_expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'PRODUCT_IMPORT_LEASE_EXPIRED'; END IF;
 SELECT * INTO r FROM public.product_import_rows WHERE id=p_row AND job_id=p_job AND site_id=p_site FOR UPDATE;
 IF NOT FOUND OR r.status<>'queued' THEN RAISE EXCEPTION 'PRODUCT_IMPORT_ROW_INVALID'; END IF;
 v_mutation:=jsonb_build_object('fields','{}'::jsonb,'product_options',r.plan->'productOptions',
  'variants',r.plan->'productVariants','stock',r.plan->'initialStock');
 SELECT * INTO receipt FROM public.product_edit_receipts WHERE idempotency_key=r.id AND store_id=p_site AND actor_id=p_actor
  AND operation='product.update.v1' AND product_edit_receipts.mutation=v_mutation AND response=p_product;
 IF NOT FOUND OR receipt.response->>'id' IS DISTINCT FROM receipt.product_id::text
  OR EXISTS(SELECT 1 FROM jsonb_each(r.plan->'productInsert')f WHERE p_product->f.key IS DISTINCT FROM f.value) THEN
  RAISE EXCEPTION 'PRODUCT_IMPORT_RECEIPT_UNVERIFIED'; END IF;
 UPDATE public.product_import_rows SET status='completed',product_id=receipt.product_id,response=p_product,
  error_code=NULL,attempt_count=attempt_count+1,updated_at=clock_timestamp(),updated_by=p_actor WHERE id=p_row;
 IF NOT EXISTS(SELECT 1 FROM public.product_import_rows WHERE job_id=p_job AND site_id=p_site AND status<>'completed') THEN
  UPDATE public.product_import_jobs SET status='completed',completed_at=clock_timestamp(),lease_token=NULL,lease_expires_at=NULL,
   error_code=NULL,updated_at=clock_timestamp(),updated_by=p_actor WHERE id=p_job;
 ELSE UPDATE public.product_import_jobs SET updated_at=clock_timestamp(),updated_by=p_actor WHERE id=p_job; END IF;
END $fn$;

CREATE FUNCTION public.fail_product_import_row_v1(p_site uuid,p_actor uuid,p_job uuid,p_lease uuid,p_row uuid,p_error text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE j public.product_import_jobs;
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 IF p_error IS NULL OR p_error NOT IN('PRODUCT_IMPORT_ROW_FAILED','PRODUCT_LIMIT_REACHED','ENTITLEMENT_AUTHORITY_UNAVAILABLE') THEN
  RAISE EXCEPTION 'PRODUCT_IMPORT_INVALID'; END IF;
 SELECT * INTO j FROM public.product_import_jobs WHERE id=p_job AND site_id=p_site AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_IMPORT_NOT_FOUND'; END IF;
 -- A lost COMMIT acknowledgement may arrive after the whole row succeeded.
 -- Reading that immutable result grants no right to advance an expired lease.
 IF EXISTS(SELECT 1 FROM public.product_import_rows WHERE id=p_row AND site_id=p_site AND job_id=p_job AND status='completed') THEN RETURN false; END IF;
 IF p_lease IS NULL OR j.status<>'running' OR j.lease_token IS DISTINCT FROM p_lease
  OR NOT(j.lease_expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'PRODUCT_IMPORT_LEASE_EXPIRED'; END IF;
 UPDATE public.product_import_rows SET status='failed',error_code=p_error,attempt_count=attempt_count+1,
  updated_at=clock_timestamp(),updated_by=p_actor WHERE id=p_row AND site_id=p_site AND job_id=p_job AND status='queued';
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_IMPORT_ROW_INVALID'; END IF;
 UPDATE public.product_import_jobs SET status='failed',error_code=p_error,lease_token=NULL,lease_expires_at=NULL,
  updated_at=clock_timestamp(),updated_by=p_actor WHERE id=p_job;
 RETURN true;
END $fn$;

CREATE FUNCTION public.release_product_import_v1(p_site uuid,p_actor uuid,p_job uuid,p_lease uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 UPDATE public.product_import_jobs SET status='queued',lease_token=NULL,lease_expires_at=NULL,
  updated_at=clock_timestamp(),updated_by=p_actor WHERE id=p_job AND site_id=p_site AND actor_id=p_actor
  AND status='running' AND lease_token=p_lease AND lease_expires_at>clock_timestamp();
END $fn$;

CREATE FUNCTION public.command_product_import_v1(p_site uuid,p_actor uuid,p_job uuid,p_key uuid,p_stop boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE j public.product_import_jobs;
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 IF p_stop IS NULL THEN RAISE EXCEPTION 'PRODUCT_IMPORT_INVALID'; END IF;
 SELECT * INTO j FROM public.product_import_jobs WHERE id=p_job AND site_id=p_site AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_IMPORT_NOT_FOUND'; END IF;
 IF p_key IS DISTINCT FROM j.idempotency_key THEN RAISE EXCEPTION 'PRODUCT_IMPORT_KEY_CONFLICT'; END IF;
 IF j.status IN('completed','stopped','blocked') THEN RETURN public.product_import_snapshot_v1(p_job); END IF;
 IF p_stop THEN
  UPDATE public.product_import_rows SET status='stopped',error_code='PRODUCT_IMPORT_STOPPED',updated_at=clock_timestamp(),updated_by=p_actor
   WHERE site_id=p_site AND job_id=p_job AND status IN('queued','failed');
  UPDATE public.product_import_jobs SET status='stopped',error_code='PRODUCT_IMPORT_STOPPED',lease_token=NULL,
   lease_expires_at=NULL,completed_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor WHERE id=p_job;
 ELSIF j.status<>'running' OR NOT(j.lease_expires_at>clock_timestamp()) THEN
  UPDATE public.product_import_rows SET status='queued',error_code=NULL,updated_at=clock_timestamp(),updated_by=p_actor
   WHERE site_id=p_site AND job_id=p_job AND status='failed';
  UPDATE public.product_import_jobs SET status='queued',error_code=NULL,lease_token=NULL,lease_expires_at=NULL,
   updated_at=clock_timestamp(),updated_by=p_actor WHERE id=p_job;
 END IF;
 RETURN public.product_import_snapshot_v1(p_job);
END $fn$;

-- A durable stop-before-registration shares the original advisory/key boundary.
-- It records zero accepted rows; it never guesses how many rows the source had.
CREATE FUNCTION public.stop_product_import_registration_v1(p_site uuid,p_actor uuid,p_key uuid,p_source_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE j public.product_import_jobs;
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 IF p_key IS NULL OR p_source_hash IS NULL OR p_source_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'PRODUCT_IMPORT_INVALID'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('product.import.v1:'||p_site::text||':'||p_actor::text||':'||p_key::text,0));
 SELECT * INTO j FROM public.product_import_jobs WHERE site_id=p_site AND actor_id=p_actor AND idempotency_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF j.source_sha256<>p_source_hash THEN RAISE EXCEPTION 'PRODUCT_IMPORT_KEY_CONFLICT'; END IF;
  RETURN public.command_product_import_v1(p_site,p_actor,j.id,p_key,true);
 END IF;
 INSERT INTO public.product_import_jobs(site_id,actor_id,idempotency_key,source_sha256,plans_sha256,total_rows,
  status,error_code,completed_at,created_by,updated_by)
 VALUES(p_site,p_actor,p_key,p_source_hash,encode(extensions.digest('[]','sha256'),'hex'),0,
  'stopped','PRODUCT_IMPORT_STOPPED',clock_timestamp(),p_actor,p_actor) RETURNING * INTO j;
 RETURN public.product_import_snapshot_v1(j.id);
END $fn$;
REVOKE ALL ON FUNCTION public.stop_product_import_registration_v1(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.stop_product_import_registration_v1(uuid,uuid,uuid,text) TO app_tenant;

-- Bounded, current-owner private reads. Neither plans nor CSV source leave SQL.
CREATE FUNCTION public.read_product_import_key_v1(p_site uuid,p_actor uuid,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE job uuid;
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 SELECT id INTO job FROM public.product_import_jobs WHERE site_id=p_site AND actor_id=p_actor AND idempotency_key=p_key;
 RETURN public.product_import_snapshot_v1(job);
END $fn$;

CREATE FUNCTION public.product_import_capabilities_v1(p_site uuid,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 RETURN jsonb_build_object('store_id',p_site,'actor_id',p_actor,'contract_version',2,'max_rows',500,'max_bytes',1048576,
  'durable_registration',true,'durable_rows',true,'async_recovery',true);
END $fn$;

CREATE FUNCTION public.read_product_import_rows_v1(p_site uuid,p_actor uuid,p_job uuid,p_page integer,p_limit integer,p_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE population bigint; rows jsonb;
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 1000000 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
  OR p_status IS NULL OR p_status NOT IN('all','queued','completed','failed','stopped') THEN RAISE EXCEPTION 'PRODUCT_IMPORT_INVALID'; END IF;
 PERFORM id FROM public.product_import_jobs WHERE id=p_job AND site_id=p_site AND actor_id=p_actor FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'PRODUCT_IMPORT_NOT_FOUND'; END IF;
 SELECT count(*) INTO population FROM public.product_import_rows WHERE site_id=p_site AND job_id=p_job AND(p_status='all' OR status=p_status);
 SELECT coalesce(jsonb_agg(item ORDER BY ordinal),'[]'::jsonb) INTO rows FROM(
  SELECT ordinal,jsonb_build_object('id',id,'job_id',job_id,'store_id',site_id,'ordinal',ordinal,'status',status,
   'product_id',product_id,'error_code',error_code,'attempt_count',attempt_count) item
  FROM public.product_import_rows WHERE site_id=p_site AND job_id=p_job AND(p_status='all' OR status=p_status)
  ORDER BY ordinal LIMIT p_limit OFFSET (p_page-1)*p_limit) paged;
 RETURN jsonb_build_object('data',rows,'meta',jsonb_build_object('store_id',p_site,'actor_id',p_actor,'job_id',p_job,
  'page',p_page,'per_page',p_limit,'total',population,'total_is_exact',true,'has_next',p_page::bigint*p_limit<population));
END $fn$;

CREATE FUNCTION public.read_product_import_history_v1(p_site uuid,p_actor uuid,p_page integer,p_limit integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE population bigint; jobs jsonb;
BEGIN
 PERFORM public.assert_product_import_actor_v1(p_site,p_actor);
 IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 1000000 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'PRODUCT_IMPORT_INVALID'; END IF;
 SELECT count(*) INTO population FROM public.product_import_jobs WHERE site_id=p_site AND actor_id=p_actor;
 SELECT coalesce(jsonb_agg(item ORDER BY created_at DESC,id),'[]'::jsonb) INTO jobs FROM(
  SELECT id,created_at,public.product_import_snapshot_v1(id) item FROM public.product_import_jobs
  WHERE site_id=p_site AND actor_id=p_actor ORDER BY created_at DESC,id LIMIT p_limit OFFSET (p_page-1)*p_limit) paged;
 RETURN jsonb_build_object('data',jobs,'meta',jsonb_build_object('store_id',p_site,'actor_id',p_actor,'page',p_page,
  'per_page',p_limit,'total',population,'total_is_exact',true,'has_next',p_page::bigint*p_limit<population));
END $fn$;

-- The queue receives only due identities. It cannot submit a plan, site, actor or
-- arbitrary SQL. Every effect still enters the owner-checked tenant transaction.
CREATE FUNCTION public.due_product_imports_v1() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE j public.product_import_jobs; due jsonb:='[]'::jsonb;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'PRODUCT_IMPORT_FORBIDDEN' USING ERRCODE='42501'; END IF;
 FOR j IN SELECT * FROM public.product_import_jobs WHERE status='queued' OR(status='running' AND lease_expires_at<=clock_timestamp())
  ORDER BY updated_at,id LIMIT 2 FOR UPDATE SKIP LOCKED LOOP
  IF NOT EXISTS(SELECT 1 FROM public.users_custom WHERE id=j.actor_id)
   OR NOT EXISTS(SELECT 1 FROM public.sites WHERE id=j.site_id AND deleted_at IS NULL AND(custom_user_id=j.actor_id OR user_id=j.actor_id)) THEN
   UPDATE public.product_import_jobs SET status='blocked',error_code='PRODUCT_IMPORT_ACCESS_CHANGED',lease_token=NULL,
    lease_expires_at=NULL,updated_at=clock_timestamp() WHERE id=j.id;
  ELSE due:=due||jsonb_build_array(jsonb_build_object('job_id',j.id,'store_id',j.site_id,'actor_id',j.actor_id)); END IF;
 END LOOP;
 RETURN due;
END $fn$;

REVOKE ALL ON FUNCTION public.read_product_import_key_v1(uuid,uuid,uuid),public.product_import_capabilities_v1(uuid,uuid),
 public.read_product_import_rows_v1(uuid,uuid,uuid,integer,integer,text),public.read_product_import_history_v1(uuid,uuid,integer,integer),
 public.due_product_imports_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.read_product_import_key_v1(uuid,uuid,uuid),public.product_import_capabilities_v1(uuid,uuid),
 public.read_product_import_rows_v1(uuid,uuid,uuid,integer,integer,text),public.read_product_import_history_v1(uuid,uuid,integer,integer) TO app_tenant;
GRANT EXECUTE ON FUNCTION public.due_product_imports_v1() TO service_role;

REVOKE ALL ON FUNCTION public.guard_product_import_record_v1(),public.assert_product_import_actor_v1(uuid,uuid),
 public.assert_product_creation_limit_v1(uuid,uuid),public.record_product_creation_usage_v1(uuid,uuid,uuid,uuid),
 public.product_import_snapshot_v1(uuid),public.register_product_import_v1(uuid,uuid,uuid,text,jsonb),
 public.read_product_import_v1(uuid,uuid,uuid),public.claim_product_import_v1(uuid,uuid,uuid),
 public.begin_product_import_row_v1(uuid,uuid,uuid,uuid),public.complete_product_import_row_v1(uuid,uuid,uuid,uuid,uuid,jsonb),
 public.fail_product_import_row_v1(uuid,uuid,uuid,uuid,uuid,text),public.release_product_import_v1(uuid,uuid,uuid,uuid),
 public.command_product_import_v1(uuid,uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.assert_product_creation_limit_v1(uuid,uuid),public.record_product_creation_usage_v1(uuid,uuid,uuid,uuid),
 public.register_product_import_v1(uuid,uuid,uuid,text,jsonb),public.read_product_import_v1(uuid,uuid,uuid),
 public.claim_product_import_v1(uuid,uuid,uuid),public.begin_product_import_row_v1(uuid,uuid,uuid,uuid),
 public.complete_product_import_row_v1(uuid,uuid,uuid,uuid,uuid,jsonb),public.fail_product_import_row_v1(uuid,uuid,uuid,uuid,uuid,text),
 public.release_product_import_v1(uuid,uuid,uuid,uuid),public.command_product_import_v1(uuid,uuid,uuid,uuid,boolean) TO app_tenant;

DO $provenance416$
DECLARE signature text; f record; shape text; relation_row record;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.guard_product_import_record_v1()','public.assert_product_import_actor_v1(uuid,uuid)','public.assert_product_creation_limit_v1(uuid,uuid)','public.record_product_creation_usage_v1(uuid,uuid,uuid,uuid)','public.product_import_snapshot_v1(uuid)','public.register_product_import_v1(uuid,uuid,uuid,text,jsonb)','public.read_product_import_v1(uuid,uuid,uuid)','public.claim_product_import_v1(uuid,uuid,uuid)','public.begin_product_import_row_v1(uuid,uuid,uuid,uuid)','public.complete_product_import_row_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.fail_product_import_row_v1(uuid,uuid,uuid,uuid,uuid,text)','public.release_product_import_v1(uuid,uuid,uuid,uuid)','public.command_product_import_v1(uuid,uuid,uuid,uuid,boolean)','public.read_product_import_key_v1(uuid,uuid,uuid)','public.product_import_capabilities_v1(uuid,uuid)','public.read_product_import_rows_v1(uuid,uuid,uuid,integer,integer,text)','public.read_product_import_history_v1(uuid,uuid,integer,integer)','public.due_product_imports_v1()','public.stop_product_import_registration_v1(uuid,uuid,uuid,text)'] LOOP
  SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure(signature);
  IF NOT FOUND OR f.proowner<>current_user::regrole::oid THEN RAISE EXCEPTION 'migration416 refuses unknown function owner'; END IF;
  shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'acl',
  (SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
   FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a),
  'owner',f.proowner,'language',f.prolang,'kind',f.prokind,'config',f.proconfig,'strict',f.proisstrict,
  'leakproof',f.proleakproof,'parallel',f.proparallel,'volatility',f.provolatile,'security',f.prosecdef,
  'support',f.prosupport,'cost',f.procost,'rows',f.prorows)::text;
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
   VALUES('416',signature,current_user,'IMPORT FUNCTION PROFILE','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
 END LOOP;
 FOREACH signature IN ARRAY ARRAY['public.product_import_jobs','public.product_import_rows'] LOOP
  SELECT jsonb_build_object(
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text) FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled) ORDER BY x.tgname) FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid)) ORDER BY x.polname) FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid) ORDER BY x.rulename) FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text INTO shape FROM pg_class t WHERE t.oid=to_regclass(signature);

  SELECT * INTO relation_row FROM pg_class WHERE oid=to_regclass(signature);
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
   VALUES('416',signature,current_user,'IMPORT TABLE PROFILE','granted',relation_row.oid,relation_row.relowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
 END LOOP;
END $provenance416$;
NOTIFY pgrst,'reload schema';

COMMIT;
