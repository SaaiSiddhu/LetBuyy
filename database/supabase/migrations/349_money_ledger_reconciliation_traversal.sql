-- N7.6: bounded reconciliation discovery/progress, never a financial writer.
BEGIN;

CREATE TABLE public.money_ledger_reconciliation_traversal (
 id uuid PRIMARY KEY DEFAULT '00000000-0000-4000-8000-000000000349',
 pass_id uuid, pass_started_at timestamptz, pass_completed_at timestamptz,
 watermark_created_at timestamptz, watermark_site_id uuid,
 cursor_created_at timestamptz, cursor_site_id uuid,
 checked integer NOT NULL DEFAULT 0 CHECK(checked>=0),
 verified integer NOT NULL DEFAULT 0 CHECK(verified>=0),
 mismatches integer NOT NULL DEFAULT 0 CHECK(mismatches>=0),
 failed integer NOT NULL DEFAULT 0 CHECK(failed>=0),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz, created_by uuid, updated_by uuid,
 CHECK(id='00000000-0000-4000-8000-000000000349'::uuid),
 CHECK(checked=verified+mismatches+failed),
 CHECK((watermark_created_at IS NULL)=(watermark_site_id IS NULL)),
 CHECK((cursor_created_at IS NULL)=(cursor_site_id IS NULL))
);

CREATE TABLE public.money_ledger_reconciliation_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key text NOT NULL UNIQUE CHECK(length(request_key) BETWEEN 1 AND 200),
 batch_limit integer NOT NULL CHECK(batch_limit BETWEEN 1 AND 500),
 pass_id uuid NOT NULL, result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz, created_by uuid, updated_by uuid
);
CREATE INDEX money_ledger_reconciliation_batches_pass_idx ON public.money_ledger_reconciliation_batches(pass_id,created_at,id);
CREATE INDEX money_ledger_reconciliation_sites_order_idx ON public.sites((coalesce(created_at,'-infinity'::timestamptz)),id) WHERE deleted_at IS NULL;

-- These are global operational progress/receipt records, not tenant authority.
-- No application role can directly change cursor or outcome history.
ALTER TABLE public.money_ledger_reconciliation_traversal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_ledger_reconciliation_traversal FORCE ROW LEVEL SECURITY;
ALTER TABLE public.money_ledger_reconciliation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_ledger_reconciliation_batches FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.money_ledger_reconciliation_traversal,public.money_ledger_reconciliation_batches FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT SELECT ON public.money_ledger_reconciliation_traversal,public.money_ledger_reconciliation_batches TO service_role;
CREATE POLICY money_ledger_reconciliation_traversal_service_read ON public.money_ledger_reconciliation_traversal FOR SELECT TO service_role USING(true);
CREATE POLICY money_ledger_reconciliation_batches_service_read ON public.money_ledger_reconciliation_batches FOR SELECT TO service_role USING(true);
CREATE TRIGGER money_ledger_reconciliation_traversal_updated BEFORE UPDATE ON public.money_ledger_reconciliation_traversal FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER money_ledger_reconciliation_batches_updated BEFORE UPDATE ON public.money_ledger_reconciliation_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE FUNCTION public.run_money_ledger_reconciliation_batch_v1(p_request_key text,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE
 v public.money_ledger_reconciliation_traversal;
 receipt public.money_ledger_reconciliation_batches;
 site record; reconciliation public.money_ledger_site_reconciliations;
 prior_revision bigint; count_checked integer:=0; count_verified integer:=0;
 count_mismatches integer:=0; count_failed integer:=0;
 site_status text; variance bigint; failure_code text; items jsonb:='[]'::jsonb;
 result jsonb; pass_complete boolean; overall_status text; affected integer;
BEGIN
 IF p_request_key IS NULL OR p_request_key<>btrim(p_request_key) OR length(p_request_key) NOT BETWEEN 1 AND 200
  OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN
  RAISE EXCEPTION 'Valid reconciliation request key and bounded limit are required' USING ERRCODE='22023'; END IF;
 IF nullif(current_setting('app.site_id',true),'') IS NOT NULL THEN
  RAISE EXCEPTION 'Global reconciliation traversal refuses tenant-scoped execution' USING ERRCODE='42501'; END IF;

 INSERT INTO public.money_ledger_reconciliation_traversal(id) VALUES('00000000-0000-4000-8000-000000000349') ON CONFLICT(id) DO NOTHING;
 SELECT * INTO STRICT v FROM public.money_ledger_reconciliation_traversal
  WHERE id='00000000-0000-4000-8000-000000000349' FOR UPDATE;
 prior_revision:=v.revision;
 SELECT * INTO receipt FROM public.money_ledger_reconciliation_batches WHERE request_key=p_request_key;
 IF FOUND THEN
  IF receipt.batch_limit<>p_limit THEN RAISE EXCEPTION 'Reconciliation request key is bound to another limit' USING ERRCODE='22023'; END IF;
  RETURN receipt.result||jsonb_build_object('replayed',true);
 END IF;

 IF v.pass_id IS NULL OR v.pass_completed_at IS NOT NULL THEN
  v.pass_id:=gen_random_uuid();v.pass_started_at:=clock_timestamp();v.pass_completed_at:=NULL;
  v.cursor_created_at:=NULL;v.cursor_site_id:=NULL;
  v.checked:=0;v.verified:=0;v.mismatches:=0;v.failed:=0;
  SELECT coalesce(s.created_at,'-infinity'::timestamptz),s.id INTO v.watermark_created_at,v.watermark_site_id
   FROM public.sites s WHERE s.deleted_at IS NULL
   ORDER BY coalesce(s.created_at,'-infinity'::timestamptz) DESC,s.id DESC LIMIT 1;
 END IF;

 -- A failed site is a durable attempted outcome, not a barrier for every later
 -- tenant. A fresh pass retries failures; backdated/new/deleted boundaries do
 -- not move the current pass's fixed watermark or rewind its strict cursor.
 FOR site IN SELECT s.id,s.name,s.store_name,s.subdomain,coalesce(s.created_at,'-infinity'::timestamptz) AS ordered_created_at
  FROM public.sites s WHERE s.deleted_at IS NULL AND v.watermark_site_id IS NOT NULL
   AND (coalesce(s.created_at,'-infinity'::timestamptz),s.id)<=(v.watermark_created_at,v.watermark_site_id)
   AND (v.cursor_site_id IS NULL OR (coalesce(s.created_at,'-infinity'::timestamptz),s.id)>(v.cursor_created_at,v.cursor_site_id))
  ORDER BY coalesce(s.created_at,'-infinity'::timestamptz),s.id LIMIT p_limit
 LOOP
  site_status:=NULL;variance:=NULL;failure_code:=NULL;
  BEGIN
   -- Keep the existing canonical refresh as the only reconciliation authority.
   reconciliation:=public.refresh_money_ledger_site_reconciliation(site.id);
   IF reconciliation.site_id IS DISTINCT FROM site.id OR reconciliation.status IS NULL
    OR reconciliation.status NOT IN('verified','mismatch') OR reconciliation.variance_minor IS NULL
    OR abs(reconciliation.variance_minor::numeric)>9007199254740991
    OR (reconciliation.status='verified') IS DISTINCT FROM (reconciliation.variance_minor=0) THEN
    RAISE EXCEPTION 'Canonical reconciliation reply is invalid or unsafe' USING ERRCODE='22003'; END IF;
   site_status:=reconciliation.status;variance:=reconciliation.variance_minor;
  EXCEPTION WHEN OTHERS THEN
   -- The subtransaction also rolls back an invalid refresh. No fabricated zero
   -- and no raw error/financial source data is copied into operational logs.
   site_status:='failed';variance:=NULL;failure_code:=SQLSTATE;
  END;
  count_checked:=count_checked+1;
  IF site_status='verified' THEN count_verified:=count_verified+1;
  ELSIF site_status='mismatch' THEN count_mismatches:=count_mismatches+1;
  ELSE count_failed:=count_failed+1; END IF;
  items:=items||jsonb_build_array(jsonb_build_object('site_id',site.id,
   'label',coalesce(nullif(site.store_name,''),nullif(site.name,''),nullif(site.subdomain,''),site.id::text),
   'status',site_status,'variance_minor',variance,'failure_code',failure_code,'attempted_at',clock_timestamp()));
  v.cursor_created_at:=site.ordered_created_at;v.cursor_site_id:=site.id;
 END LOOP;
 pass_complete:=NOT EXISTS(SELECT 1 FROM public.sites s WHERE s.deleted_at IS NULL AND v.watermark_site_id IS NOT NULL
  AND (coalesce(s.created_at,'-infinity'::timestamptz),s.id)<=(v.watermark_created_at,v.watermark_site_id)
  AND (v.cursor_site_id IS NULL OR (coalesce(s.created_at,'-infinity'::timestamptz),s.id)>(v.cursor_created_at,v.cursor_site_id)));
 IF pass_complete THEN v.pass_completed_at:=clock_timestamp(); END IF;
 v.checked:=v.checked+count_checked;v.verified:=v.verified+count_verified;
 v.mismatches:=v.mismatches+count_mismatches;v.failed:=v.failed+count_failed;
 v.revision:=prior_revision+1;

 UPDATE public.money_ledger_reconciliation_traversal SET pass_id=v.pass_id,pass_started_at=v.pass_started_at,
  pass_completed_at=v.pass_completed_at,watermark_created_at=v.watermark_created_at,watermark_site_id=v.watermark_site_id,
  cursor_created_at=v.cursor_created_at,cursor_site_id=v.cursor_site_id,checked=v.checked,verified=v.verified,
  mismatches=v.mismatches,failed=v.failed,revision=v.revision
  WHERE id=v.id AND revision=prior_revision;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Reconciliation traversal revision conflict' USING ERRCODE='40001'; END IF;

 overall_status:=CASE WHEN v.failed>0 THEN 'failed' WHEN v.mismatches>0 THEN 'mismatch'
  WHEN pass_complete THEN 'pass_completed' ELSE 'partial' END;
 result:=jsonb_build_object('version',1,'request_id',p_request_key,'pass_id',v.pass_id,'revision',v.revision,
  'pass_started_at',v.pass_started_at,'pass_completed_at',v.pass_completed_at,'pass_completed',pass_complete,
  'status',overall_status,'limit',p_limit,'replayed',false,'checked',count_checked,'verified',count_verified,
  'mismatches',count_mismatches,'failed',count_failed,'results',items,
  'pass_counts',jsonb_build_object('checked',v.checked,'verified',v.verified,'mismatches',v.mismatches,'failed',v.failed),
  'cursor',jsonb_build_object('created_at',v.cursor_created_at,'site_id',v.cursor_site_id),
  'watermark',jsonb_build_object('created_at',v.watermark_created_at,'site_id',v.watermark_site_id));
 INSERT INTO public.money_ledger_reconciliation_batches(request_key,batch_limit,pass_id,result)
  VALUES(p_request_key,p_limit,v.pass_id,result);
 RETURN result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.run_money_ledger_reconciliation_batch_v1(text,integer) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.run_money_ledger_reconciliation_batch_v1(text,integer) TO service_role;
COMMENT ON FUNCTION public.run_money_ledger_reconciliation_batch_v1(text,integer) IS
 'Service-only bounded serialized traversal using canonical refresh; atomic cursor/outcome/request receipt, no financial posting or plug.';
COMMIT;
