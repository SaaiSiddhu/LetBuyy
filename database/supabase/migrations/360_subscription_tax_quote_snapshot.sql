-- 360: canonical subscription gross-inclusive source. No historical rewrite or ledger owner.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL search_path=pg_catalog,public;
DO $maintenance$
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' OR pg_current_xact_id_if_assigned() IS NOT NULL THEN
  RAISE EXCEPTION '360 requires a fresh read-committed maintenance transaction';END IF;
 IF EXISTS(SELECT 1 FROM pg_prepared_xacts WHERE database=current_database()) OR EXISTS(SELECT 1 FROM pg_stat_activity
  WHERE datid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND pid<>pg_backend_pid() AND backend_xid IS NOT NULL) THEN
  RAISE EXCEPTION '360 refuses foreign assigned or prepared transactions';END IF;
END $maintenance$;
LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_attribute,pg_catalog.pg_attrdef,pg_catalog.pg_constraint,
 pg_catalog.pg_index,pg_catalog.pg_trigger,pg_catalog.pg_event_trigger,pg_catalog.pg_policy,pg_catalog.pg_depend,pg_catalog.pg_shdepend,
 pg_catalog.pg_namespace,pg_catalog.pg_type,pg_catalog.pg_description,pg_catalog.pg_seclabel,pg_catalog.pg_authid,pg_catalog.pg_auth_members,
 pg_catalog.pg_inherits,pg_catalog.pg_rewrite,pg_catalog.pg_language,pg_catalog.pg_opclass,pg_catalog.pg_opfamily,pg_catalog.pg_operator,
 pg_catalog.pg_am,pg_catalog.pg_collation,pg_catalog.pg_tablespace,pg_catalog.pg_default_acl IN SHARE ROW EXCLUSIVE MODE NOWAIT;
LOCK TABLE public.sites IN EXCLUSIVE MODE NOWAIT;
LOCK TABLE public.billing_history,public.subscriptions,public.merchant_billing_invoices,public.audit_logs,public.migration_privilege_journal IN SHARE ROW EXCLUSIVE MODE NOWAIT;
DO $journal_before$
DECLARE v_priv text;v_privs text[];
BEGIN
 IF EXISTS(SELECT 1 FROM pg_prepared_xacts WHERE database=current_database()) OR EXISTS(SELECT 1 FROM pg_stat_activity
  WHERE datid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND pid<>pg_backend_pid() AND backend_xid IS NOT NULL) THEN RAISE EXCEPTION '360 refuses foreign assigned or prepared transactions after locks';END IF;
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='360') OR to_regprocedure('public.guard_subscription_tax_ddl_360()') IS NOT NULL THEN
  RAISE EXCEPTION '360 refuses existing custody allocation';END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('anon','authenticated','app_tenant') AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolcanlogin OR NOT rolinherit))
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND rolbypassrls AND NOT rolcanlogin AND rolinherit)
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres' AND rolsuper)
  OR EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.roleid IN('service_role'::regrole,'anon'::regrole,'authenticated'::regrole,'app_tenant'::regrole)
   AND NOT((m.roleid='app_tenant'::regrole AND m.member IN('postgres'::regrole,'service_role'::regrole) AND NOT m.admin_option AND m.inherit_option AND m.set_option)
    OR(m.member=to_regrole('authenticator') AND m.roleid IN('anon'::regrole,'authenticated'::regrole,'service_role'::regrole) AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option)))
  OR EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member IN('anon'::regrole,'authenticated'::regrole,'app_tenant'::regrole,'service_role'::regrole)
   AND NOT(m.member='service_role'::regrole AND m.roleid='app_tenant'::regrole AND NOT m.admin_option AND m.inherit_option AND m.set_option)) THEN
  RAISE EXCEPTION '360 refuses unknown critical role or membership profile';END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator' AND (NOT rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION '360 refuses changed authenticator profile';END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant','service_role'])role WHERE has_schema_privilege(role,'public','CREATE')) THEN RAISE EXCEPTION '360 refuses untrusted public CREATE';END IF;

 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.migration_privilege_journal'::regclass AND relkind='r' AND relpersistence='p'
  AND relowner='postgres'::regrole AND relrowsecurity AND relforcerowsecurity AND NOT relispartition AND relreplident='d' AND reloptions IS NULL AND reltablespace=0)
  OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid='public.migration_privilege_journal'::regclass OR inhparent='public.migration_privilege_journal'::regclass)
  OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class='public.migration_privilege_journal'::regclass)
  OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.migration_privilege_journal'::regclass)
  OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.migration_privilege_journal'::regclass) THEN RAISE EXCEPTION '360 refuses unknown private journal relation profile';END IF;
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.migration_privilege_journal'::regclass AND attnum>0)<>9 OR EXISTS(
  SELECT 1 FROM(VALUES (1,'migration','text',true,NULL),
 (2,'object_signature','text',true,NULL),
 (3,'grantee','text',true,NULL),
 (4,'privilege','text',true,NULL),
 (5,'action','text',true,NULL),
 (6,'recorded_at','timestamptz',true,'now()'),
 (7,'object_oid','oid',false,NULL),
 (8,'object_owner','oid',false,NULL),
 (9,'object_definition_hash','text',false,NULL))e(num,name,typ,required,def)
  LEFT JOIN pg_attribute ca ON ca.attrelid='public.migration_privilege_journal'::regclass AND ca.attnum=e.num
  LEFT JOIN pg_attrdef df ON df.adrelid=ca.attrelid AND df.adnum=ca.attnum
  WHERE ca.attname IS DISTINCT FROM e.name OR ca.atttypid IS DISTINCT FROM e.typ::regtype OR ca.attnotnull IS DISTINCT FROM e.required
   OR ca.atttypmod<>-1 OR ca.attisdropped OR ca.attidentity<>'' OR ca.attgenerated<>'' OR ca.atthasmissing OR ca.attmissingval IS NOT NULL
   OR ca.attndims<>0 OR NOT ca.attislocal OR ca.attinhcount<>0 OR ca.attacl IS NOT NULL OR ca.attoptions IS NOT NULL OR ca.attfdwoptions IS NOT NULL
   OR ca.attstorage IS DISTINCT FROM(SELECT typstorage FROM pg_type WHERE oid=e.typ::regtype)
   OR ca.attcollation IS DISTINCT FROM CASE WHEN e.typ='text' THEN 'pg_catalog.default'::regcollation::oid ELSE 0::oid END
   OR pg_get_expr(df.adbin,df.adrelid,false) IS DISTINCT FROM e.def) THEN RAISE EXCEPTION '360 refuses changed private journal columns/defaults/grants';END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.migration_privilege_journal'::regclass)<>2
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.migration_privilege_journal'::regclass AND conname='migration_privilege_journal_pkey'
   AND contype='p' AND conkey=ARRAY[1,2,3,4,5]::smallint[] AND NOT condeferrable AND NOT condeferred AND convalidated AND conislocal AND coninhcount=0 AND conparentid=0)
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.migration_privilege_journal'::regclass AND conname='migration_privilege_journal_action_check'
   AND contype='c' AND convalidated AND NOT condeferrable AND NOT condeferred
   AND pg_get_constraintdef(oid,false)='CHECK ((action = ANY (ARRAY[''revoked''::text, ''granted''::text])))') THEN RAISE EXCEPTION '360 refuses changed private journal constraints';END IF;
 IF (SELECT count(*) FROM pg_index WHERE indrelid='public.migration_privilege_journal'::regclass)<>1 OR NOT EXISTS(
  SELECT 1 FROM pg_index ix JOIN pg_class ci ON ci.oid=ix.indexrelid JOIN pg_constraint co ON co.conindid=ix.indexrelid AND co.conrelid=ix.indrelid AND co.contype='p'
  WHERE ix.indrelid='public.migration_privilege_journal'::regclass AND ci.relnamespace='public'::regnamespace AND ci.relname='migration_privilege_journal_pkey'
   AND ci.relkind='i' AND ci.relpersistence='p' AND ci.relowner='postgres'::regrole AND ci.relacl IS NULL AND ci.reloptions IS NULL AND ci.reltablespace=0 AND NOT ci.relispartition
   AND ci.relam=(SELECT oid FROM pg_am WHERE amname='btree') AND ix.indnatts=5 AND ix.indnkeyatts=5 AND ix.indkey::text='1 2 3 4 5'
   AND ix.indisunique AND ix.indisprimary AND ix.indisvalid AND ix.indisready AND ix.indislive AND ix.indimmediate AND NOT ix.indnullsnotdistinct
   AND NOT ix.indisexclusion AND NOT ix.indisclustered AND NOT ix.indisreplident AND NOT ix.indcheckxmin AND ix.indexprs IS NULL AND ix.indpred IS NULL
   AND ix.indoption::text='0 0 0 0 0'
   AND ARRAY(SELECT x FROM unnest(ix.indclass::oid[])x)=array_fill((SELECT oid FROM pg_opclass WHERE opcnamespace='pg_catalog'::regnamespace AND opcname='text_ops' AND opcmethod=ci.relam AND opcdefault),ARRAY[5])
   AND ARRAY(SELECT x FROM unnest(ix.indcollation::oid[])x)=array_fill('pg_catalog.default'::regcollation::oid,ARRAY[5])) THEN
  RAISE EXCEPTION '360 refuses changed private journal PK index profile';END IF;
 IF NOT has_table_privilege('service_role','public.migration_privilege_journal','SELECT')
  OR has_table_privilege('service_role','public.migration_privilege_journal','SELECT WITH GRANT OPTION')
  OR EXISTS(SELECT 1 FROM aclexplode(coalesce((SELECT relacl FROM pg_class WHERE oid='public.migration_privilege_journal'::regclass),acldefault('r','postgres'::regrole)))acl
   WHERE acl.grantee NOT IN('postgres'::regrole,'service_role'::regrole) OR acl.grantor<>'postgres'::regrole OR (acl.grantee='service_role'::regrole AND acl.is_grantable)) THEN
  RAISE EXCEPTION '360 refuses unknown private journal ACL/grant options';END IF;

 SELECT array_agg(privilege_type ORDER BY privilege_type) INTO v_privs FROM aclexplode((SELECT relacl FROM pg_class WHERE oid='public.migration_privilege_journal'::regclass))acl WHERE acl.grantee='service_role'::regrole;
 IF v_privs IS DISTINCT FROM ARRAY['SELECT']::text[] AND v_privs IS DISTINCT FROM ARRAY['DELETE','INSERT','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']::text[] THEN
  RAISE EXCEPTION '360 refuses unknown service journal baseline; expected canonical SELECT-only or faithful default ALL7';END IF;
 FOREACH v_priv IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
  IF v_priv=ANY(v_privs) THEN
   INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner)
    VALUES('360','TABLE public.migration_privilege_journal','service_role',v_priv,'revoked','public.migration_privilege_journal'::regclass,'postgres'::regrole);
   EXECUTE format('REVOKE %s ON TABLE public.migration_privilege_journal FROM service_role',v_priv);
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])priv WHERE has_table_privilege('service_role','public.migration_privilege_journal',priv))
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant'])role WHERE has_table_privilege(role,'public.migration_privilege_journal','SELECT')) THEN
  RAISE EXCEPTION '360 refuses writable or untrusted custody receipts';END IF;

END $journal_before$;
DO $predecessor$
DECLARE e record;p pg_proc%ROWTYPE;
BEGIN
 FOR e IN SELECT * FROM (VALUES ('claim_merchant_subscription_checkout_v1','639f3f04444737d1547f03704129108f1179c2de5918ec52369f00308d341842'),('bind_merchant_subscription_checkout_v1','6265e6e694d75928f35c49546819beb6646543a54fb0de34858a2d0412f32858'),('read_merchant_subscription_checkout_v1','3cfff24a05ed6590348740e5641ab8f50e4e326f8da99d5b0b34aa9550732008'),('activate_merchant_subscription_v1','737bc152700b195ee4d30cda6b960279e189d97214e9178d6d59193f83aecb01')) AS expected(name,body_hash) LOOP
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=e.name)<>1 THEN RAISE EXCEPTION '360 refuses predecessor overload or missing ABI';END IF;
  SELECT * INTO p FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=e.name;
  IF p.proowner IS DISTINCT FROM (SELECT relowner FROM pg_class WHERE oid='public.billing_history'::regclass)
   OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('app_tenant',p.oid,'EXECUTE')
   OR NOT has_function_privilege('service_role',p.oid,'EXECUTE') OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.privilege_type='EXECUTE' AND a.grantee NOT IN(p.proowner,'service_role'::regrole)) THEN
   RAISE EXCEPTION '360 refuses changed predecessor owner or effective grants';END IF;
  IF p.proargmodes IS NOT NULL OR p.proallargtypes IS NOT NULL OR p.proisstrict OR p.provolatile<>'v' OR p.proparallel<>'u' THEN RAISE EXCEPTION '360 refuses changed predecessor execution ABI';END IF;
  IF e.name='claim_merchant_subscription_checkout_v1' AND (p.oid IS DISTINCT FROM to_regprocedure('public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb)') OR p.proargnames IS DISTINCT FROM ARRAY['p_actor','p_site','p_key','p_request','p_quote']::text[] OR p.pronargdefaults<>1 OR pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM 'NULL::jsonb' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public','letbuyy.subscription_checkout_version=347']::text[]) THEN RAISE EXCEPTION '360 refuses changed predecessor signature/config';END IF;
  IF e.name='bind_merchant_subscription_checkout_v1' AND (p.oid IS DISTINCT FROM to_regprocedure('public.bind_merchant_subscription_checkout_v1(uuid,uuid,uuid,text,text)') OR p.proargnames IS DISTINCT FROM ARRAY['p_actor','p_site','p_charge','p_reference','p_short_url']::text[] OR p.pronargdefaults<>1 OR pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM 'NULL::text' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]) THEN RAISE EXCEPTION '360 refuses changed predecessor signature/config';END IF;
  IF e.name='read_merchant_subscription_checkout_v1' AND (p.oid IS DISTINCT FROM to_regprocedure('public.read_merchant_subscription_checkout_v1(uuid,uuid,text,text,text,text)') OR p.proargnames IS DISTINCT FROM ARRAY['p_actor','p_site','p_reference','p_payment','p_plan_slug','p_period']::text[] OR p.pronargdefaults<>0 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]) THEN RAISE EXCEPTION '360 refuses changed predecessor signature/config';END IF;
  IF e.name='activate_merchant_subscription_v1' AND (p.oid IS DISTINCT FROM to_regprocedure('public.activate_merchant_subscription_v1(jsonb)') OR p.proargnames IS DISTINCT FROM ARRAY['p_input']::text[] OR p.pronargdefaults<>0 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public','letbuyy.subscription_checkout_version=347']::text[]) THEN RAISE EXCEPTION '360 refuses changed predecessor signature/config';END IF;
  IF p.prosecdef OR p.proretset OR p.prorettype<>'jsonb'::regtype OR p.prokind<>'f'
   OR encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>e.body_hash THEN RAISE EXCEPTION '360 refuses unknown predecessor body or privileges';END IF;
 END LOOP;
END $predecessor$;
ALTER TABLE public.billing_history ADD COLUMN subscription_tax_snapshot jsonb,
 ADD COLUMN subscription_tax_source_id uuid REFERENCES public.billing_history(id);
ALTER TABLE public.subscriptions ADD COLUMN subscription_tax_snapshot jsonb,
 ADD COLUMN subscription_tax_source_id uuid REFERENCES public.billing_history(id);
-- Raw party/profile/source JSON is backend-only. Maintained owner APIs return
-- public conserved summaries; old rows without a snapshot retain prior visibility.
CREATE POLICY subscription_tax_history_backend_read_360 ON public.billing_history AS RESTRICTIVE FOR SELECT
 TO anon,authenticated,app_tenant USING(subscription_tax_snapshot IS NULL);
CREATE POLICY subscription_tax_current_backend_read_360 ON public.subscriptions AS RESTRICTIVE FOR SELECT
 TO anon,authenticated,app_tenant USING(subscription_tax_snapshot IS NULL);
CREATE FUNCTION public.valid_subscription_tax_snapshot_360(s jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $v$
DECLARE g bigint;n bigint;t bigint;c bigint;sg bigint;i bigint;v text;
BEGIN
 IF jsonb_typeof(s) IS DISTINCT FROM 'object' THEN RETURN false;END IF;
 FOREACH v IN ARRAY ARRAY['gross_minor','taxable_minor','tax_minor','cgst_minor','sgst_minor','igst_minor'] LOOP
  IF jsonb_typeof(s->v) IS DISTINCT FROM 'number' OR (s->>v)!~'^[0-9]+$' OR (s->>v)::numeric>2147483647 THEN RETURN false;END IF;
 END LOOP;
 g:=(s->>'gross_minor')::bigint;n:=(s->>'taxable_minor')::bigint;t:=(s->>'tax_minor')::bigint;
 c:=(s->>'cgst_minor')::bigint;sg:=(s->>'sgst_minor')::bigint;i:=(s->>'igst_minor')::bigint;
 -- Structural checks defend persisted/source callers without duplicating the
 -- canonical checkout-core rate calculation performed by Billing before claim.
 IF s->>'schema_version' IS DISTINCT FROM '1' OR s->'profile'->>'schema_version' IS DISTINCT FROM '1'
  OR jsonb_typeof(s->'profile') IS DISTINCT FROM 'object' OR jsonb_typeof(s->'recipient') IS DISTINCT FROM 'object'
  OR jsonb_typeof(s->'source') IS DISTINCT FROM 'object'
  OR NOT coalesce((s->'source'->>'gross_before_discount_minor')~'^[0-9]+$',false)
  OR NOT coalesce((s->'source'->>'discount_minor')~'^[0-9]+$',false)
  OR nullif(btrim(s->'source'->>'price_version'),'') IS NULL
  OR s->'source'->>'billing_period' IS NULL OR s->'source'->>'billing_period' NOT IN('monthly','yearly')
  OR nullif(btrim(s->'source'->>'request_key'),'') IS NULL OR length(s->'source'->>'request_key')>200 THEN RETURN false;END IF;
 IF jsonb_typeof(s->'source') IS DISTINCT FROM 'object'
  OR (s->'source'->>'gross_before_discount_minor')!~'^[0-9]+$' OR (s->'source'->>'discount_minor')!~'^[0-9]+$'
  OR (s->'source'->>'gross_before_discount_minor')::numeric>2147483647 OR (s->'source'->>'discount_minor')::numeric>2147483647
  OR (s->'source'->>'gross_before_discount_minor')::bigint-(s->'source'->>'discount_minor')::bigint IS DISTINCT FROM g THEN RETURN false;END IF;
 FOREACH v IN ARRAY ARRAY['supplier','recipient'] LOOP
  IF v='supplier' THEN
   IF NOT coalesce(length(s->'profile'->v->>'name') BETWEEN 1 AND 200,false) OR jsonb_typeof(s->'profile'->v->'address') IS DISTINCT FROM 'object'
    OR nullif(btrim(s->'profile'->v->'address'->>'line1'),'') IS NULL OR nullif(btrim(s->'profile'->v->'address'->>'city'),'') IS NULL
    OR nullif(btrim(s->'profile'->v->'address'->>'state'),'') IS NULL OR NOT coalesce(length(s->'profile'->v->'address'->>'zip') BETWEEN 3 AND 20,false)
    OR s->'profile'->v->'address'->>'country' IS DISTINCT FROM 'IN' THEN RETURN false;END IF;
  ELSE
   IF NOT coalesce(length(s->v->>'name') BETWEEN 1 AND 200,false) OR jsonb_typeof(s->v->'address') IS DISTINCT FROM 'object'
    OR nullif(btrim(s->v->'address'->>'line1'),'') IS NULL OR nullif(btrim(s->v->'address'->>'city'),'') IS NULL
    OR nullif(btrim(s->v->'address'->>'state'),'') IS NULL OR NOT coalesce(length(s->v->'address'->>'zip') BETWEEN 3 AND 20,false)
    OR s->v->'address'->>'country' IS DISTINCT FROM 'IN' THEN RETURN false;END IF;
  END IF;
 END LOOP;
 RETURN coalesce(g>0 AND n+t=g AND c+sg+i=t AND s->>'schema_version'='1' AND s->>'basis'='inclusive' AND s->>'currency'='INR'
  AND s->>'policy_version'='D-SUB-TAX-INCLUSIVE-V1' AND s->'profile'->>'policy_version'='D-SUB-TAX-INCLUSIVE-V1'
  AND s->'profile'->>'approval_status'='approved' AND length(s->'profile'->>'approval_reference') BETWEEN 1 AND 200
  AND length(s->'profile'->>'profile_id') BETWEEN 1 AND 120 AND (s->'profile'->>'profile_version')~'^[1-9][0-9]*$'
  AND s->'profile'->>'registration_status'='registered' AND s->'profile'->>'supply_category'='domestic_taxable_saas'
  AND s->'profile'->>'rate_bps'='1800' AND s->'profile'->'supplier'->>'country'='IN' AND s->'recipient'->>'country'='IN'
  AND s->'profile'->'supplier'->>'gstin'~'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  AND left(s->'profile'->'supplier'->>'gstin',2)=s->'profile'->'supplier'->>'state_code'
  AND s->'profile'->'supplier'->>'state_code'~'^(0[1-9]|[12][0-9]|3[0-8]|97)$'
  AND s->'recipient'->>'state_code'~'^(0[1-9]|[12][0-9]|3[0-8]|97)$'
  AND ((s->'recipient'->'gstin')='null'::jsonb OR
   ((s->'recipient'->>'gstin')~'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
    AND left(s->'recipient'->>'gstin',2)=s->'recipient'->>'state_code'))
  AND ((s->>'supply_type'='intra_state' AND s->'profile'->'supplier'->>'state_code'=s->'recipient'->>'state_code' AND i=0 AND c=t/2 AND sg=t-c)
   OR (s->>'supply_type'='inter_state' AND s->'profile'->'supplier'->>'state_code'<>s->'recipient'->>'state_code' AND c=0 AND sg=0 AND i=t)),false);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $v$;
CREATE FUNCTION public.issue_subscription_tax_invoice_360(p_history uuid,p_evidence jsonb DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $i$
DECLARE b public.billing_history%ROWTYPE;s jsonb;
BEGIN
 SELECT * INTO b FROM public.billing_history WHERE id=p_history FOR UPDATE;s:=b.subscription_tax_snapshot;
 IF NOT FOUND OR b.deleted_at IS NOT NULL OR b.subscription_id IS NULL OR b.payment_status NOT IN('paid','failed')
  OR NOT public.valid_subscription_tax_snapshot_360(s) OR b.amount IS DISTINCT FROM (s->>'gross_minor')::bigint
  OR b.total_amount IS DISTINCT FROM b.amount OR b.tax_amount IS DISTINCT FROM (s->>'tax_minor')::bigint THEN
  RAISE EXCEPTION 'subscription invoice source unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.merchant_billing_invoices WHERE billing_history_id=b.id) THEN
  IF (SELECT count(*) FROM public.merchant_billing_invoices WHERE billing_history_id=b.id)<>1
   OR NOT EXISTS(SELECT 1 FROM public.merchant_billing_invoices i WHERE i.billing_history_id=b.id
    AND i.site_id=b.site_id AND i.subscription_id=b.subscription_id AND i.invoice_number=b.invoice_number
    AND i.status=CASE WHEN b.payment_status='paid' THEN 'issued' ELSE 'payment_failed' END AND i.currency='INR'
    AND i.subtotal_minor=(s->>'taxable_minor')::bigint AND i.cgst_minor=(s->>'cgst_minor')::bigint
    AND i.sgst_minor=(s->>'sgst_minor')::bigint AND i.igst_minor=(s->>'igst_minor')::bigint AND i.total_minor=b.amount
    AND i.period_start IS NOT DISTINCT FROM b.period_start AND i.period_end IS NOT DISTINCT FROM b.period_end
    AND i.metadata->>'policy_version'='D-SUB-TAX-INCLUSIVE-V1' AND i.metadata->>'basis'='inclusive'
    AND i.metadata->>'source_id'=b.id::text AND (p_evidence IS NULL OR i.metadata->'provider_invoice'=p_evidence)) THEN
   RAISE EXCEPTION 'existing subscription invoice differs from its canonical source';END IF;
  RETURN;END IF;
 INSERT INTO public.merchant_billing_invoices(site_id,subscription_id,billing_history_id,invoice_number,status,currency,
  subtotal_minor,cgst_minor,sgst_minor,igst_minor,total_minor,period_start,period_end,metadata,created_by,updated_by)
 VALUES(b.site_id,b.subscription_id,b.id,b.invoice_number,CASE WHEN b.payment_status='paid' THEN 'issued' ELSE 'payment_failed' END,'INR',
  (s->>'taxable_minor')::bigint,(s->>'cgst_minor')::bigint,(s->>'sgst_minor')::bigint,(s->>'igst_minor')::bigint,b.amount,b.period_start,b.period_end,
  jsonb_build_object('policy_version',s->>'policy_version','basis','inclusive','source_id',b.id)
   ||CASE WHEN p_evidence IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('provider_invoice',p_evidence) END,b.user_id,b.user_id);
END $i$;
CREATE FUNCTION public.read_merchant_subscription_checkout_key_v1(p_actor uuid,p_site uuid,p_key text,p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $r$
DECLARE s public.sites%ROWTYPE;b public.billing_history%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND OR NOT coalesce(p_actor=s.custom_user_id OR p_actor=s.user_id,false) THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED');END IF;
 SELECT * INTO b FROM public.billing_history WHERE site_id=p_site AND user_id=p_actor AND subscription_checkout_key=p_key;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',true,'missing',true);END IF;
 IF b.deleted_at IS NOT NULL OR b.subscription_checkout_request IS DISTINCT FROM p_request THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
 IF b.amount>0 AND NOT public.valid_subscription_tax_snapshot_360(b.subscription_tax_snapshot) THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_TAX_REVIEW_REQUIRED');END IF;
 RETURN jsonb_build_object('accepted',true,'claimed',false,'charge',to_jsonb(b));
END $r$;
CREATE OR REPLACE FUNCTION public.claim_merchant_subscription_checkout_v1(
 p_actor uuid,p_site uuid,p_key text,p_request jsonb,p_quote jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public SET letbuyy.subscription_checkout_version='347' SET letbuyy.subscription_tax_version='360' SET letbuyy.subscription_tax_writer='claim_merchant_subscription_checkout_v1:360' AS $f$
DECLARE s public.sites%ROWTYPE;c public.billing_history%ROWTYPE;receipt uuid:=gen_random_uuid();amount bigint;scope text;free_quote boolean;
BEGIN
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND OR NOT coalesce(p_actor=s.custom_user_id OR p_actor=s.user_id,false) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED'); END IF;
 -- The table admission lock is already held by the store SELECT above. A
 -- call compiled before rollback may have waited on that lock; verify the
 -- currently bound function's own SET attribute, not the caller/session GUC.
 -- pg_get_functiondef reads the live catalog binding even for a cached frame.
 IF p_quote->>'mode'='free_activation' AND pg_catalog.strpos(
  pg_catalog.split_part(pg_catalog.pg_get_functiondef('public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb)'::pg_catalog.regprocedure),E'\nAS ',1),
  E'\n SET "letbuyy.subscription_checkout_version" TO ''347''')=0 THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID'); END IF;
 IF nullif(btrim(p_key),'') IS NULL OR length(p_key)>200 OR jsonb_typeof(p_request) IS DISTINCT FROM 'object' THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID'); END IF;
 scope:='subscription.checkout:'||p_actor;
 PERFORM pg_advisory_xact_lock(hashtextextended(scope||':'||p_site||':'||p_key,0));
 SELECT * INTO c FROM public.billing_history WHERE site_id=p_site AND user_id=p_actor AND subscription_checkout_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF c.deleted_at IS NOT NULL OR c.subscription_checkout_request IS DISTINCT FROM p_request THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
  IF c.amount>0 AND c.subscription_tax_snapshot IS NULL THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_TAX_REVIEW_REQUIRED');END IF;
  RETURN jsonb_build_object('accepted',true,'claimed',false,'charge',to_jsonb(c));
 END IF;
 IF p_quote IS NULL THEN RETURN jsonb_build_object('accepted',true,'missing',true); END IF;
 -- 347: one discriminated internal free quote alongside unchanged paid modes.
 amount:=(p_quote->>'amount_minor')::bigint;
 free_quote:=p_quote->>'mode'='free_activation';
 IF amount IS NULL OR amount<0 OR amount>2147483647 OR (NOT free_quote AND amount=0) OR p_quote->>'currency' IS DISTINCT FROM 'INR'
  OR p_quote->>'mode' IS NULL OR p_quote->>'mode' NOT IN('razorpay_order','razorpay_subscription','sandbox_activation','free_activation') OR p_quote->'plan'->>'slug' IS DISTINCT FROM p_request->>'plan_slug'
  OR p_request->>'billing_period' IS NULL OR p_request->>'billing_period' NOT IN('monthly','yearly')
  OR NOT EXISTS(SELECT 1 FROM public.plans WHERE id=(p_quote->'plan'->>'id')::uuid AND slug=p_request->>'plan_slug' AND site_type=s.site_type AND is_active=true) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID'); END IF;
 IF free_quote AND (amount<>0 OR p_request->>'site_type' IS DISTINCT FROM s.site_type
  OR p_quote?'provider_input' OR p_quote->'response'->>'checkout_mode' IS DISTINCT FROM 'free_activation'
  OR p_quote->'response'->>'amount' IS DISTINCT FROM '0' OR p_quote->'response'->>'currency' IS DISTINCT FROM 'INR'
  OR p_quote->'response'->>'billing_period' IS DISTINCT FROM p_request->>'billing_period'
  OR p_quote->'response'->>'recurring' IS DISTINCT FROM 'false'
  OR p_quote->'response'->>'is_promo' IS DISTINCT FROM 'false'
  OR NOT EXISTS(SELECT 1 FROM public.plans p WHERE p.id=(p_quote->'plan'->>'id')::uuid
   AND CASE WHEN p_request->>'billing_period'='yearly' THEN coalesce(p.price_yearly_inr,p.price_monthly_inr*12) ELSE p.price_monthly_inr END=0)) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID'); END IF;
 -- The native quote freezes separate initial/base components and the exact
 -- provider-plan read admitted by the backend before claim. No scheduled-start
 -- or additional provider-tax semantics are inferred at the SQL boundary.
 IF p_quote->>'mode'='razorpay_subscription' AND (
  p_quote->'charge_schedule'->>'schema_version' IS DISTINCT FROM '1'
  OR p_quote->'charge_schedule'->>'start_mode' IS DISTINCT FROM 'immediate'
  OR NOT coalesce((p_quote->'charge_schedule'->>'base_gross_minor')~'^[1-9][0-9]*$',false)
  OR NOT coalesce((p_quote->'charge_schedule'->>'upfront_gross_minor')~'^[0-9]+$',false)
  OR p_quote->'charge_schedule'->>'initial_gross_minor' IS DISTINCT FROM amount::text
  OR (p_quote->'charge_schedule'->>'base_gross_minor')::numeric+(p_quote->'charge_schedule'->>'upfront_gross_minor')::numeric IS DISTINCT FROM amount::numeric
  OR p_quote->'provider_input'?'start_at'
  OR p_quote->'provider_input'->>'quantity' IS DISTINCT FROM '1'
  OR p_quote->'provider_plan_binding'->>'schema_version' IS DISTINCT FROM '1'
  OR NOT coalesce((p_quote->'provider_plan_binding'->>'provider_plan_id')~'^plan_[A-Za-z0-9]+$',false)
  OR p_quote->'provider_plan_binding'->>'provider_plan_id' IS DISTINCT FROM p_quote->'provider_input'->>'plan_id'
  OR p_quote->'provider_plan_binding'->>'base_gross_minor' IS DISTINCT FROM p_quote->'charge_schedule'->>'base_gross_minor'
  OR p_quote->'provider_plan_binding'->>'currency' IS DISTINCT FROM 'INR'
  OR p_quote->'provider_plan_binding'->>'billing_period' IS DISTINCT FROM p_request->>'billing_period'
  OR p_quote->'provider_plan_binding'->>'interval' IS DISTINCT FROM '1'
  OR p_quote->'provider_plan_binding'->>'tax_configuration' IS DISTINCT FROM 'no_additional_tax'
  OR NOT public.valid_subscription_tax_snapshot_360(p_quote->'recurring_tax_snapshot')
  OR p_quote->'recurring_tax_snapshot'->>'gross_minor' IS DISTINCT FROM p_quote->'charge_schedule'->>'base_gross_minor'
  OR p_quote->'recurring_tax_snapshot'->'profile' IS DISTINCT FROM p_quote->'subscription_tax_snapshot'->'profile'
  OR p_quote->'recurring_tax_snapshot'->'recipient' IS DISTINCT FROM p_quote->'subscription_tax_snapshot'->'recipient'
  OR (p_quote->'recurring_tax_snapshot'->'source'-'gross_before_discount_minor') IS DISTINCT FROM (p_quote->'subscription_tax_snapshot'->'source'-'gross_before_discount_minor')) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_TAX_SETUP_REQUIRED');END IF;
 IF NOT free_quote AND (NOT public.valid_subscription_tax_snapshot_360(p_quote->'subscription_tax_snapshot')
  OR p_quote->'subscription_tax_snapshot'->'source'->>'actor_id' IS DISTINCT FROM p_actor::text
  OR p_quote->'subscription_tax_snapshot'->'source'->>'site_id' IS DISTINCT FROM p_site::text
  OR p_quote->'subscription_tax_snapshot'->'source'->>'request_key' IS DISTINCT FROM p_key
  OR p_quote->'subscription_tax_snapshot'->'source'->>'plan_id' IS DISTINCT FROM p_quote->'plan'->>'id'
  OR p_quote->'subscription_tax_snapshot'->'source'->>'plan_slug' IS DISTINCT FROM p_request->>'plan_slug'
  OR p_quote->'subscription_tax_snapshot'->'source'->>'billing_period' IS DISTINCT FROM p_request->>'billing_period'
  OR (p_quote->'subscription_tax_snapshot'->>'gross_minor')::bigint IS DISTINCT FROM amount
  OR (p_quote->'response'->>'amount')::bigint IS DISTINCT FROM amount
  OR p_quote->'response'->>'currency' IS DISTINCT FROM 'INR'
  OR (p_quote->>'mode'='razorpay_order' AND (p_quote->'provider_input'->>'amount')::bigint IS DISTINCT FROM amount)) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_TAX_SETUP_REQUIRED'); END IF;
 -- A pre-347 HTTP receipt can outlive the old unbound free activation. It
 -- cannot be guessed from the latest subscription or its creation time. After
 -- canonical route ownership is installed, refuse this ambiguous legacy key
 -- rather than creating a second outcome. Existing canonical quotes replay above.
 IF free_quote AND EXISTS(SELECT 1 FROM public.idempotency_keys old_http
  WHERE old_http.site_id=p_site AND old_http.key=btrim(p_key) AND old_http.deleted_at IS NULL
   AND old_http.scope IN('http:POST:/payments/subscription/order','http:POST:/payments/subscription/recover')) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_LEGACY_CHECKOUT_PENDING'); END IF;
 INSERT INTO public.billing_history(id,user_id,store_id,site_id,invoice_number,description,amount,total_amount,currency,payment_gateway,
  payment_status,billing_period,subscription_checkout,subscription_checkout_key,subscription_checkout_request,subscription_checkout_reference,subscription_tax_snapshot,subscription_tax_source_id)
 VALUES(receipt,p_actor,p_site,p_site,'QUOTE-'||receipt,'Pending subscription checkout',amount,amount,'INR',CASE WHEN free_quote THEN NULL ELSE 'razorpay' END,'pending',
  p_request->>'billing_period',p_quote,p_key,p_request,CASE WHEN free_quote THEN 'free_checkout:'||receipt ELSE NULL END,CASE WHEN free_quote THEN NULL ELSE p_quote->'subscription_tax_snapshot' END,CASE WHEN free_quote THEN NULL ELSE receipt END) RETURNING * INTO c;
 INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,resource_type,resource_id,expires_at)
 VALUES(p_site,p_key,scope,encode(sha256(convert_to(p_request::text,'UTF8')),'hex'),'billing_history',receipt,'infinity');
 RETURN jsonb_build_object('accepted',true,'claimed',true,'charge',to_jsonb(c));
END $f$;
CREATE OR REPLACE FUNCTION public.bind_merchant_subscription_checkout_v1(p_actor uuid,p_site uuid,p_charge uuid,p_reference text,p_short_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public SET letbuyy.subscription_tax_writer='bind_merchant_subscription_checkout_v1:360' AS $f$
DECLARE s public.sites%ROWTYPE;c public.billing_history%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND OR NOT coalesce(p_actor=s.custom_user_id OR p_actor=s.user_id,false) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED'); END IF;
 SELECT * INTO c FROM public.billing_history WHERE id=p_charge AND site_id=p_site AND user_id=p_actor AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR c.subscription_checkout IS NULL OR c.subscription_checkout->>'mode'='free_activation' OR nullif(btrim(p_reference),'') IS NULL OR length(p_reference)>200
  OR (c.subscription_checkout_reference IS NOT NULL AND c.subscription_checkout_reference<>p_reference) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
 UPDATE public.billing_history SET subscription_checkout_reference=p_reference,
  subscription_checkout=subscription_checkout||jsonb_build_object('short_url',p_short_url),updated_at=now() WHERE id=c.id RETURNING * INTO c;
 UPDATE public.idempotency_keys SET status='completed',locked_until=NULL,status_code=200,response_body=jsonb_build_object('billing_history_id',c.id)
  WHERE site_id=p_site AND scope='subscription.checkout:'||p_actor AND key=c.subscription_checkout_key AND resource_id=c.id;
 RETURN jsonb_build_object('accepted',true,'charge',to_jsonb(c));
END $f$;
CREATE OR REPLACE FUNCTION public.read_merchant_subscription_checkout_v1(p_actor uuid,p_site uuid,p_reference text,p_payment text,p_plan_slug text,p_period text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $f$
DECLARE s public.sites%ROWTYPE;c public.billing_history%ROWTYPE;retained public.subscriptions%ROWTYPE;plan public.plans%ROWTYPE;paid public.billing_history%ROWTYPE;retained_evidence jsonb;
BEGIN
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL;
 IF NOT FOUND OR NOT coalesce(p_actor=s.custom_user_id OR p_actor=s.user_id,false) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED'); END IF;
 SELECT * INTO c FROM public.billing_history WHERE subscription_checkout_reference=p_reference;
 IF FOUND THEN
  IF c.subscription_checkout->>'mode'='free_activation' OR c.deleted_at IS NOT NULL OR c.site_id IS DISTINCT FROM p_site OR c.user_id IS DISTINCT FROM p_actor
   OR c.subscription_checkout->'plan'->>'slug' IS DISTINCT FROM p_plan_slug OR c.billing_period IS DISTINCT FROM p_period THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
  IF c.subscription_tax_snapshot IS NULL AND c.payment_status='paid' AND c.payment_id=p_payment
   AND EXISTS(SELECT 1 FROM public.subscriptions legacy WHERE legacy.id=c.subscription_id AND legacy.razorpay_payment_id=p_payment AND legacy.user_id=p_actor AND legacy.store_id=p_site AND legacy.deleted_at IS NULL) THEN
   RETURN jsonb_build_object('accepted',true,'charge',to_jsonb(c)||jsonb_build_object('legacy_completed',true));END IF;
  IF c.subscription_checkout->>'mode'='razorpay_subscription' AND c.subscription_tax_snapshot IS NOT NULL THEN
   SELECT * INTO paid FROM public.billing_history WHERE provider_payment_reference=p_payment AND payment_status='paid' AND deleted_at IS NULL
    AND subscription_tax_source_id=c.id AND site_id=p_site AND user_id=p_actor;
   IF FOUND THEN
    SELECT i.metadata->'provider_invoice' INTO retained_evidence FROM public.merchant_billing_invoices i
     WHERE i.billing_history_id=paid.id AND i.site_id=p_site AND i.subscription_id=paid.subscription_id
      AND i.metadata->>'policy_version'='D-SUB-TAX-INCLUSIVE-V1';
    IF retained_evidence IS NOT NULL THEN
     IF retained_evidence->>'payment_id' IS DISTINCT FROM p_payment OR retained_evidence->>'subscription_reference' IS DISTINCT FROM p_reference
      OR retained_evidence->>'gross_minor' IS DISTINCT FROM paid.amount::text
      OR (retained_evidence->>'period_start')::timestamptz IS DISTINCT FROM paid.period_start
      OR (retained_evidence->>'period_end')::timestamptz IS DISTINCT FROM paid.period_end THEN
      RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_TAX_REVIEW_REQUIRED');END IF;
     RETURN jsonb_build_object('accepted',true,'charge',to_jsonb(c)||jsonb_build_object('retained_invoice_evidence',retained_evidence));
    END IF;
   END IF;
  END IF;
  RETURN jsonb_build_object('accepted',true,'charge',to_jsonb(c));
 END IF;
 -- A retained paid receipt can be read back; it cannot authorize a new purchase.
 SELECT * INTO retained FROM public.subscriptions WHERE razorpay_payment_id=p_payment AND deleted_at IS NULL;
 IF FOUND AND retained.user_id=p_actor AND retained.store_id=p_site AND retained.plan=p_plan_slug AND retained.billing_period=p_period THEN
  SELECT * INTO plan FROM public.plans WHERE slug=retained.plan AND site_type=s.site_type;
  RETURN jsonb_build_object('accepted',true,'charge',jsonb_build_object('amount',retained.amount_paid,'currency','INR','legacy_completed',true,'payment_status','paid','subscription_id',retained.id,
   'subscription_checkout_reference',p_reference,'subscription_checkout',jsonb_build_object('plan',to_jsonb(plan),'mode',
    CASE WHEN p_reference LIKE 'sub_%' THEN 'razorpay_subscription' ELSE 'razorpay_order' END)));
 END IF;
 RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');
END $f$;
CREATE OR REPLACE FUNCTION public.activate_merchant_subscription_v1(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public SET letbuyy.subscription_checkout_version='347' SET letbuyy.subscription_tax_version='360' SET letbuyy.subscription_tax_writer='activate_merchant_subscription_v1:360' AS $function$
DECLARE s public.sites%ROWTYPE;plan public.plans%ROWTYPE;existing public.subscriptions%ROWTYPE;created public.subscriptions%ROWTYPE;
 actor uuid;site uuid;plan_id uuid;gateway text;payment text;period text;amount bigint;tax bigint;total bigint;
 charge public.billing_history%ROWTYPE;source_ref text;free_id uuid;is_free boolean;tax_source uuid;invoice_id uuid;
 started timestamptz;finished timestamptz;promo timestamptz;constraint_name text;evidence jsonb;selected_tax jsonb;historical_cycle boolean:=false;consume_quote boolean:=true;
BEGIN
 IF p_input IS NULL OR jsonb_typeof(p_input)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k
  WHERE k NOT IN('user_id','store_id','plan_id','plan_slug','plan_name','billing_period','amount_paid','payment_gateway',
   'external_subscription_id','razorpay_order_id','razorpay_payment_id','period_start','period_end','promo_ends_at',
   'products_limit','invoice_number','invoice_description','tax_amount','total_amount',
   'subscription_checkout_id','subscription_checkout_key','subscription_checkout_request','subscription_tax_source_id','provider_invoice_evidence')) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');
 END IF;
 actor:=(p_input->>'user_id')::uuid;site:=(p_input->>'store_id')::uuid;plan_id:=(p_input->>'plan_id')::uuid;
 gateway:=p_input->>'payment_gateway';payment:=nullif(btrim(p_input->>'razorpay_payment_id'),'');period:=p_input->>'billing_period';
 amount:=(p_input->>'amount_paid')::bigint;tax:=(p_input->>'tax_amount')::bigint;total:=(p_input->>'total_amount')::bigint;
 -- 347: explicit retained free checkout context; the existing paid ABI remains intact.
 free_id:=nullif(p_input->>'subscription_checkout_id','')::uuid;is_free:=free_id IS NOT NULL;
 IF amount=0 AND NOT is_free THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');END IF;
 started:=(p_input->>'period_start')::timestamptz;finished:=(p_input->>'period_end')::timestamptz;promo:=(p_input->>'promo_ends_at')::timestamptz;
 evidence:=p_input->'provider_invoice_evidence';
 IF actor IS NULL OR site IS NULL OR plan_id IS NULL OR period IS NULL OR period NOT IN('monthly','yearly')
  OR amount IS NULL OR amount<0 OR amount>2147483647 OR tax IS NULL OR tax<0 OR total IS NULL OR total<>amount OR tax>amount OR total>2147483647
  OR started IS NULL OR finished IS NULL OR finished<=started
  OR (gateway IS NOT NULL AND gateway NOT IN('razorpay','stripe')) OR (amount>0 AND gateway IS NULL)
  OR (gateway='razorpay' AND amount>0 AND payment IS NULL) OR (payment IS NOT NULL AND gateway IS DISTINCT FROM 'razorpay')
  OR coalesce(length(payment),0)>200 OR nullif(btrim(p_input->>'invoice_number'),'') IS NULL
  OR nullif(btrim(p_input->>'invoice_description'),'') IS NULL OR NOT(p_input?'products_limit') THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');
 END IF;
 IF (p_input ?| ARRAY['subscription_checkout_id','subscription_checkout_key','subscription_checkout_request']) AND NOT is_free
  OR (is_free AND (amount<>0 OR tax<>0 OR total<>0 OR gateway IS NOT NULL OR payment IS NOT NULL
   OR p_input->>'razorpay_order_id' IS NOT NULL OR promo IS NOT NULL)) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID'); END IF;
 IF evidence IS NOT NULL AND (
  jsonb_typeof(evidence) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(evidence) k WHERE k NOT IN('phase','invoice_id','payment_id','order_id','subscription_reference','period_start','period_end','gross_minor'))
  OR evidence->>'phase' IS NULL OR evidence->>'phase' NOT IN('initial_with_upfront','base_cycle')
  OR NOT coalesce((evidence->>'invoice_id')~'^inv_[A-Za-z0-9]{1,116}$',false)
  OR NOT coalesce((evidence->>'payment_id')~'^pay_[A-Za-z0-9]{1,116}$',false)
  OR NOT coalesce((evidence->>'order_id')~'^order_[A-Za-z0-9]{1,114}$',false)
  OR NOT coalesce((evidence->>'subscription_reference')~'^sub_[A-Za-z0-9]{1,116}$',false)
  OR gateway IS DISTINCT FROM 'razorpay' OR evidence->>'payment_id' IS DISTINCT FROM payment
  OR evidence->>'subscription_reference' IS DISTINCT FROM p_input->>'external_subscription_id'
  OR jsonb_typeof(evidence->'gross_minor') IS DISTINCT FROM 'number' OR evidence->>'gross_minor' IS DISTINCT FROM amount::text
  OR (evidence->>'period_start')::timestamptz IS DISTINCT FROM started OR (evidence->>'period_end')::timestamptz IS DISTINCT FROM finished
  OR (p_input->>'razorpay_order_id' IS NOT NULL AND evidence->>'order_id' IS DISTINCT FROM p_input->>'razorpay_order_id')) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
 -- Global payment lock first, then the exact store. Different payments at the
 -- same store also serialize old-entitlement retirement with the new receipt.
 IF payment IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:subscription:razorpay:'||payment,0));END IF;
 IF evidence IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:subscription:invoice:'||(evidence->>'invoice_id'),0));END IF;
 SELECT * INTO s FROM public.sites WHERE id=site AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(actor=s.custom_user_id OR actor=s.user_id,false) OR NOT EXISTS(SELECT 1 FROM public.users_custom WHERE id=actor) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED');
 END IF;
 -- The table admission lock is already held by the store SELECT above. A
 -- call compiled before rollback may have waited on that lock; verify the
 -- currently bound function's own SET attribute, not the caller/session GUC.
 -- pg_get_functiondef reads the live catalog binding even for a cached frame.
 IF is_free AND pg_catalog.strpos(
  pg_catalog.split_part(pg_catalog.pg_get_functiondef('public.activate_merchant_subscription_v1(jsonb)'::pg_catalog.regprocedure),E'\nAS ',1),
  E'\n SET "letbuyy.subscription_checkout_version" TO ''347''')=0 THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID'); END IF;
 IF is_free THEN
  SELECT * INTO charge FROM public.billing_history WHERE id=free_id FOR UPDATE;
  IF NOT FOUND OR charge.deleted_at IS NOT NULL OR charge.site_id IS DISTINCT FROM site OR charge.store_id IS DISTINCT FROM site
   OR charge.user_id IS DISTINCT FROM actor OR charge.amount IS DISTINCT FROM 0 OR charge.currency IS DISTINCT FROM 'INR'
   OR charge.payment_gateway IS NOT NULL OR charge.provider_payment_reference IS NOT NULL
   OR charge.subscription_checkout->>'mode' IS DISTINCT FROM 'free_activation'
   OR charge.subscription_checkout->>'amount_minor' IS DISTINCT FROM '0'
   OR charge.subscription_checkout_reference IS DISTINCT FROM 'free_checkout:'||charge.id
   OR charge.subscription_checkout_reference IS DISTINCT FROM p_input->>'external_subscription_id'
   OR charge.subscription_checkout_key IS DISTINCT FROM p_input->>'subscription_checkout_key'
   OR charge.subscription_checkout_request IS DISTINCT FROM p_input->'subscription_checkout_request'
   OR charge.subscription_checkout_request->>'plan_slug' IS DISTINCT FROM p_input->>'plan_slug'
   OR charge.subscription_checkout_request->>'site_type' IS DISTINCT FROM s.site_type
   OR charge.subscription_checkout_request->>'billing_period' IS DISTINCT FROM period
   OR charge.subscription_checkout->'plan'->>'id' IS DISTINCT FROM plan_id::text
   OR charge.subscription_checkout->'plan'->>'slug' IS DISTINCT FROM p_input->>'plan_slug'
   OR charge.subscription_checkout->'plan'->>'name' IS DISTINCT FROM p_input->>'plan_name'
   OR charge.subscription_checkout->'plan'->'products_limit' IS DISTINCT FROM p_input->'products_limit'
   OR charge.billing_period IS DISTINCT FROM period THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
  IF charge.subscription_id IS NOT NULL THEN
   SELECT * INTO existing FROM public.subscriptions WHERE id=charge.subscription_id;
   IF NOT FOUND OR existing.deleted_at IS NOT NULL OR charge.payment_status IS DISTINCT FROM 'paid'
    OR existing.user_id IS DISTINCT FROM actor OR existing.store_id IS DISTINCT FROM site OR existing.site_id IS DISTINCT FROM site
    OR existing.plan_id IS DISTINCT FROM plan_id OR existing.plan IS DISTINCT FROM p_input->>'plan_slug'
    OR existing.billing_period IS DISTINCT FROM period OR existing.amount_paid IS DISTINCT FROM 0 OR existing.currency IS DISTINCT FROM 'INR'
    OR existing.payment_gateway IS NOT NULL OR existing.razorpay_payment_id IS NOT NULL OR existing.razorpay_order_id IS NOT NULL
    OR existing.external_subscription_id IS DISTINCT FROM charge.subscription_checkout_reference
    OR existing.current_period_start IS DISTINCT FROM charge.period_start OR existing.current_period_end IS DISTINCT FROM charge.period_end THEN
    RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
   -- A completed intent may have been superseded. Read it; never reactivate it.
   RETURN jsonb_build_object('accepted',true,'subscription',to_jsonb(existing),'replayed',true);
  END IF;
  IF charge.payment_status IS DISTINCT FROM 'pending' THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
 END IF;
 IF payment IS NOT NULL THEN
  SELECT * INTO existing FROM public.subscriptions WHERE razorpay_payment_id=payment;
  IF FOUND THEN
   IF existing.deleted_at IS NOT NULL OR existing.store_id IS DISTINCT FROM site OR existing.site_id IS DISTINCT FROM site OR existing.user_id IS DISTINCT FROM actor
    OR (existing.plan_id IS NOT NULL AND existing.plan_id IS DISTINCT FROM plan_id) OR existing.plan IS DISTINCT FROM p_input->>'plan_slug'
    OR existing.billing_period IS DISTINCT FROM period OR existing.amount_paid IS DISTINCT FROM amount
    OR existing.currency IS DISTINCT FROM 'INR'
    OR (existing.subscription_tax_snapshot IS NOT NULL AND (
      existing.razorpay_order_id IS DISTINCT FROM nullif(p_input->>'razorpay_order_id','')
      OR existing.external_subscription_id IS DISTINCT FROM nullif(p_input->>'external_subscription_id','')
      OR (existing.subscription_tax_snapshot->>'tax_minor')::bigint IS DISTINCT FROM tax
      OR nullif(p_input->>'subscription_tax_source_id','')::uuid IS DISTINCT FROM
        (SELECT b.subscription_tax_source_id FROM public.billing_history b WHERE b.id=existing.subscription_tax_source_id)))
    OR (existing.razorpay_order_id IS NOT NULL AND existing.razorpay_order_id IS DISTINCT FROM p_input->>'razorpay_order_id')
    OR (existing.external_subscription_id IS NOT NULL AND existing.external_subscription_id IS DISTINCT FROM p_input->>'external_subscription_id') THEN
    RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');
   END IF;
   IF existing.subscription_tax_snapshot IS NOT NULL AND left(existing.external_subscription_id,4)='sub_' AND evidence IS NULL THEN
    RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_TAX_REVIEW_REQUIRED');END IF;
   IF evidence IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.billing_history b JOIN public.merchant_billing_invoices i ON i.billing_history_id=b.id
    WHERE b.id=existing.subscription_tax_source_id AND b.subscription_id=existing.id AND b.provider_payment_reference=payment
     AND i.metadata->'provider_invoice'=evidence AND b.period_start=started AND b.period_end=finished) THEN
    RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');END IF;
   RETURN jsonb_build_object('accepted',true,'subscription',to_jsonb(existing),'replayed',true);
  END IF;
  IF EXISTS(SELECT 1 FROM public.billing_history WHERE provider_payment_reference=payment)
   OR EXISTS(SELECT 1 FROM public.payment_transactions t WHERE t.gateway='razorpay' AND t.provider_payment_id=payment) THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');
  END IF;
 END IF;
 IF amount>0 THEN
  tax_source:=nullif(p_input->>'subscription_tax_source_id','')::uuid;
  IF tax_source IS NULL THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_TAX_REVIEW_REQUIRED');END IF;
  SELECT * INTO charge FROM public.billing_history WHERE id=tax_source FOR UPDATE;
  IF NOT FOUND OR charge.deleted_at IS NOT NULL OR charge.site_id IS DISTINCT FROM site OR charge.store_id IS DISTINCT FROM site OR charge.user_id IS DISTINCT FROM actor
   OR charge.currency IS DISTINCT FROM 'INR' OR charge.payment_gateway IS DISTINCT FROM gateway
   OR charge.subscription_checkout->'plan'->>'id' IS DISTINCT FROM plan_id::text
   OR charge.subscription_checkout->'plan'->>'slug' IS DISTINCT FROM p_input->>'plan_slug' OR charge.billing_period IS DISTINCT FROM period
   OR charge.subscription_checkout->'plan'->'products_limit' IS DISTINCT FROM p_input->'products_limit'
   OR charge.subscription_checkout_reference IS DISTINCT FROM coalesce(nullif(p_input->>'external_subscription_id',''),nullif(p_input->>'razorpay_order_id',''))
   OR charge.payment_status NOT IN('pending','paid') OR (charge.payment_status='paid' AND charge.subscription_checkout->>'mode'<>'razorpay_subscription') THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
  IF charge.subscription_checkout->>'mode'='razorpay_subscription' AND evidence IS NULL THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_TAX_REVIEW_REQUIRED');END IF;
  selected_tax:=charge.subscription_tax_snapshot;
  IF evidence IS NOT NULL THEN
   IF charge.subscription_checkout->>'mode' IS DISTINCT FROM 'razorpay_subscription' THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
   IF evidence->>'phase'='base_cycle' THEN
    selected_tax:=charge.subscription_checkout->'recurring_tax_snapshot';
    consume_quote:=charge.amount=amount;
   ELSIF coalesce((charge.subscription_checkout->'charge_schedule'->>'upfront_gross_minor')::bigint,0)<=0 THEN
    RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
   IF EXISTS(SELECT 1 FROM public.merchant_billing_invoices i WHERE i.metadata->'provider_invoice'->>'invoice_id'=evidence->>'invoice_id')
    OR EXISTS(SELECT 1 FROM public.merchant_billing_invoices i WHERE i.metadata->'provider_invoice'->>'subscription_reference'=evidence->>'subscription_reference'
      AND (i.metadata->'provider_invoice'->>'period_start')::timestamptz=started AND (i.metadata->'provider_invoice'->>'period_end')::timestamptz=finished) THEN
    RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');END IF;
   IF evidence->>'phase'='initial_with_upfront' AND charge.payment_status<>'pending' THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');END IF;
   historical_cycle:=EXISTS(SELECT 1 FROM public.subscriptions x WHERE x.store_id=site AND x.deleted_at IS NULL
     AND x.subscription_tax_snapshot IS NOT NULL AND x.current_period_start>started);
  END IF;
  IF NOT public.valid_subscription_tax_snapshot_360(selected_tax) OR (selected_tax->>'gross_minor')::bigint IS DISTINCT FROM amount
   OR (selected_tax->>'tax_minor')::bigint IS DISTINCT FROM tax OR amount IS DISTINCT FROM total
   OR selected_tax->'source'->>'actor_id' IS DISTINCT FROM actor::text OR selected_tax->'source'->>'site_id' IS DISTINCT FROM site::text THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
 END IF;
 IF evidence IS NOT NULL THEN
  -- The quote was admitted against the active catalog before provider create.
  -- A later rename/inactivation cannot reinterpret an already consented cycle.
  plan:=jsonb_populate_record(NULL::public.plans,charge.subscription_checkout->'plan');
 ELSE
  SELECT * INTO plan FROM public.plans WHERE id=plan_id AND site_type=s.site_type AND slug=p_input->>'plan_slug' AND is_active=true FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PLAN_CHANGED');END IF;
 END IF;
 INSERT INTO public.subscriptions(user_id,store_id,site_id,plan,plan_id,status,billing_period,current_period_start,current_period_end,promo_ends_at,
  payment_gateway,external_subscription_id,razorpay_order_id,razorpay_payment_id,amount_paid,currency,products_limit,stores_limit,idempotency_key,subscription_tax_snapshot,subscription_tax_source_id)
 VALUES(actor,site,site,plan.slug,plan.id,CASE WHEN historical_cycle THEN 'cancelled' ELSE 'active' END,period,started,finished,promo,gateway,p_input->>'external_subscription_id',
  p_input->>'razorpay_order_id',payment,amount,'INR',(p_input->>'products_limit')::integer,1,
  CASE WHEN is_free THEN 'free_checkout:'||free_id WHEN payment IS NOT NULL THEN 'razorpay_payment:'||payment ELSE NULL END,CASE WHEN amount>0 THEN selected_tax ELSE NULL END,CASE WHEN amount>0 THEN charge.id ELSE NULL END) RETURNING * INTO created;
 IF NOT historical_cycle THEN
  UPDATE public.subscriptions SET status='cancelled',cancelled_at=started WHERE store_id=site AND status='active' AND id<>created.id;
  UPDATE public.sites SET trial_status=CASE WHEN amount>0 THEN 'paid' ELSE 'active' END,updated_at=started WHERE id=site;
 END IF;
 IF charge.id IS NOT NULL AND charge.payment_status='pending' AND consume_quote THEN
  UPDATE public.billing_history SET subscription_id=created.id,invoice_number=p_input->>'invoice_number',
   description=p_input->>'invoice_description',tax_amount=tax,total_amount=total,payment_id=CASE WHEN is_free THEN charge.subscription_checkout_reference ELSE payment END,
   provider_payment_reference=payment,payment_status='paid',period_start=started,period_end=finished,updated_at=now()
   WHERE id=charge.id;
  invoice_id:=charge.id;
 ELSE
 INSERT INTO public.billing_history(user_id,store_id,site_id,subscription_id,invoice_number,description,amount,currency,tax_amount,total_amount,
  payment_gateway,payment_id,provider_payment_reference,payment_status,billing_period,period_start,period_end,subscription_tax_snapshot,subscription_tax_source_id)
 VALUES(actor,site,site,created.id,p_input->>'invoice_number',p_input->>'invoice_description',amount,'INR',tax,total,gateway,
  coalesce(payment,p_input->>'external_subscription_id',p_input->>'razorpay_order_id'),payment,'paid',period,started,finished,CASE WHEN amount>0 THEN selected_tax ELSE NULL END,CASE WHEN amount>0 THEN charge.id ELSE NULL END) RETURNING id INTO invoice_id;
 END IF;
 IF amount>0 THEN
  UPDATE public.subscriptions SET subscription_tax_source_id=invoice_id WHERE id=created.id;
  PERFORM public.issue_subscription_tax_invoice_360(invoice_id,evidence);
 END IF;
 INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
 VALUES(actor,'user','merchant_subscription.activated','subscription',created.id,jsonb_build_object('site_id',site,'provider',gateway,'payment_reference',payment)
  ||CASE WHEN amount>0 THEN jsonb_build_object('subscription_tax_source_id',invoice_id,'subscription_tax_policy','D-SUB-TAX-INCLUSIVE-V1') ELSE '{}'::jsonb END
  ||CASE WHEN is_free THEN jsonb_build_object('checkout_receipt_id',charge.id,'request_hash',encode(sha256(convert_to(charge.subscription_checkout_request::text,'UTF8')),'hex')) ELSE '{}'::jsonb END);
 IF is_free THEN
  UPDATE public.idempotency_keys SET status='completed',locked_until=NULL,status_code=201,
   response_body=jsonb_build_object('billing_history_id',charge.id,'subscription_id',created.id)
   WHERE site_id=site AND scope='subscription.checkout:'||actor AND key=charge.subscription_checkout_key
    AND resource_id=charge.id AND request_hash=encode(sha256(convert_to(charge.subscription_checkout_request::text,'UTF8')),'hex');
  IF NOT FOUND THEN RAISE EXCEPTION 'free subscription checkout completion source unavailable'; END IF;
 END IF;
 RETURN jsonb_build_object('accepted',true,'subscription',to_jsonb(created),'replayed',false);
EXCEPTION WHEN unique_violation THEN
 GET STACKED DIAGNOSTICS constraint_name=CONSTRAINT_NAME;
 IF constraint_name IN('subscriptions_razorpay_payment_global_uidx','billing_history_provider_payment_reference_uidx','merchant_billing_provider_invoice_360_uidx') THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');
 END IF;
 RAISE;
END $function$;
REVOKE ALL ON FUNCTION public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.bind_merchant_subscription_checkout_v1(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.bind_merchant_subscription_checkout_v1(uuid,uuid,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.read_merchant_subscription_checkout_v1(uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.read_merchant_subscription_checkout_v1(uuid,uuid,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.activate_merchant_subscription_v1(jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.activate_merchant_subscription_v1(jsonb) TO service_role;

CREATE FUNCTION public.record_merchant_subscription_invoice_v1(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public SET letbuyy.subscription_tax_writer='record_merchant_subscription_invoice_v1:360' AS $r$
DECLARE s public.subscriptions%ROWTYPE;o public.sites%ROWTYPE;b public.billing_history%ROWTYPE;prior public.billing_history%ROWTYPE;source public.billing_history%ROWTYPE;
 actor uuid;site uuid;sub uuid;pay text;status text;started timestamptz;finished timestamptz;
BEGIN
 actor:=(p_input->>'user_id')::uuid;site:=(p_input->>'store_id')::uuid;sub:=(p_input->>'subscription_id')::uuid;
 pay:=nullif(btrim(p_input->>'payment_id'),'');status:=p_input->>'payment_status';started:=(p_input->>'period_start')::timestamptz;finished:=(p_input->>'period_end')::timestamptz;
 IF pay IS NULL OR length(pay)>200 OR status NOT IN('paid','failed') OR started IS NULL OR finished IS NULL OR finished<=started
  OR nullif(btrim(p_input->>'invoice_number'),'') IS NULL OR length(p_input->>'invoice_number')>80
  OR p_input->>'currency' IS DISTINCT FROM 'INR' THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:subscription:invoice:'||pay,0));
 SELECT * INTO o FROM public.sites WHERE id=site AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(actor=o.custom_user_id OR actor=o.user_id,false) THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED');END IF;
 SELECT * INTO s FROM public.subscriptions WHERE id=sub AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR s.user_id IS DISTINCT FROM actor OR s.store_id IS DISTINCT FROM site THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
 SELECT * INTO prior FROM public.billing_history WHERE provider_payment_reference=pay OR (payment_gateway=p_input->>'payment_gateway' AND payment_id=pay);
 IF FOUND THEN
  IF prior.deleted_at IS NOT NULL OR prior.subscription_id IS DISTINCT FROM sub OR prior.site_id IS DISTINCT FROM site OR prior.user_id IS DISTINCT FROM actor
   OR prior.payment_gateway IS DISTINCT FROM p_input->>'payment_gateway' OR prior.currency IS DISTINCT FROM p_input->>'currency'
   OR prior.amount IS DISTINCT FROM (p_input->>'amount')::bigint OR prior.tax_amount IS DISTINCT FROM (p_input->>'tax_amount')::bigint
   OR prior.total_amount IS DISTINCT FROM (p_input->>'total_amount')::bigint OR prior.payment_status IS DISTINCT FROM status
   OR prior.invoice_number IS DISTINCT FROM p_input->>'invoice_number' OR prior.description IS DISTINCT FROM p_input->>'description'
   OR prior.period_start IS DISTINCT FROM started OR prior.period_end IS DISTINCT FROM finished
   OR (p_input->>'billing_period' IS NOT NULL AND prior.billing_period IS DISTINCT FROM p_input->>'billing_period') THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');END IF;
  RETURN jsonb_build_object('accepted',true,'invoice',to_jsonb(prior),'replayed',true);
 END IF;
 SELECT * INTO source FROM public.billing_history WHERE id=s.subscription_tax_source_id FOR UPDATE;
 IF NOT FOUND OR NOT public.valid_subscription_tax_snapshot_360(source.subscription_tax_snapshot) THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_TAX_REVIEW_REQUIRED');END IF;
 IF source.site_id IS DISTINCT FROM site OR source.user_id IS DISTINCT FROM actor OR source.subscription_tax_snapshot IS DISTINCT FROM s.subscription_tax_snapshot
  OR (p_input->>'amount')::bigint IS DISTINCT FROM source.amount OR (p_input->>'total_amount')::bigint IS DISTINCT FROM source.amount
  OR (p_input->>'tax_amount')::bigint IS DISTINCT FROM (source.subscription_tax_snapshot->>'tax_minor')::bigint
  OR p_input->>'payment_gateway' IS DISTINCT FROM source.payment_gateway
  OR (p_input->>'billing_period' IS NOT NULL AND p_input->>'billing_period' IS DISTINCT FROM source.billing_period) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
 -- A verified activation already owns each paid invoice. This ingress may read
 -- it but cannot invent another payment or renewal from arbitrary notification data.
 IF status='paid' THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
 IF source.subscription_checkout->>'mode' IS DISTINCT FROM 'sandbox_activation' OR source.payment_status IS DISTINCT FROM 'pending'
  OR pay NOT LIKE 'sandbox_failed:%' OR source.subscription_checkout_request->>'sandbox_payment_status' IS DISTINCT FROM 'failed' THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
 UPDATE public.billing_history SET subscription_id=sub,invoice_number=p_input->>'invoice_number',description=p_input->>'description',
  tax_amount=(subscription_tax_snapshot->>'tax_minor')::bigint,total_amount=amount,payment_id=pay,payment_status='failed',period_start=started,period_end=finished,updated_at=now()
 WHERE id=source.id RETURNING * INTO b;
 PERFORM public.issue_subscription_tax_invoice_360(b.id);
 RETURN jsonb_build_object('accepted',true,'invoice',to_jsonb(b),'replayed',false);
END $r$;
-- This marker rejects stale cached function frames and accidental direct
-- service writes. It is not a substitute for role/source/payment authorization;
-- the backend SQL role remains trusted, as it is for verified activation itself.
CREATE FUNCTION public.guard_subscription_tax_new_writer_360() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $admission$
DECLARE writer text:=current_setting('letbuyy.subscription_tax_writer',true);b public.billing_history%ROWTYPE;t jsonb;
BEGIN
 IF TG_TABLE_NAME='billing_history' THEN
  IF NEW.amount<=0 OR (NEW.subscription_checkout IS NULL AND NEW.subscription_id IS NULL AND NEW.subscription_tax_snapshot IS NULL) THEN RETURN NEW;END IF;
  IF writer IS NULL OR writer NOT IN('claim_merchant_subscription_checkout_v1:360','activate_merchant_subscription_v1:360','record_merchant_subscription_invoice_v1:360') THEN
   RAISE EXCEPTION 'positive subscription history requires the current canonical writer';END IF;
  t:=NEW.subscription_tax_snapshot;
  IF NOT public.valid_subscription_tax_snapshot_360(t) OR NEW.amount IS DISTINCT FROM (t->>'gross_minor')::bigint
   OR NEW.total_amount IS DISTINCT FROM NEW.amount OR NEW.currency IS DISTINCT FROM 'INR'
   OR t->'source'->>'actor_id' IS DISTINCT FROM NEW.user_id::text OR t->'source'->>'site_id' IS DISTINCT FROM NEW.site_id::text
   OR t->'source'->>'billing_period' IS DISTINCT FROM NEW.billing_period THEN RAISE EXCEPTION 'positive subscription history lacks its exact tax source';END IF;
  IF writer='claim_merchant_subscription_checkout_v1:360' THEN
   IF NEW.subscription_tax_source_id IS DISTINCT FROM NEW.id OR NEW.subscription_id IS NOT NULL OR NEW.payment_status IS DISTINCT FROM 'pending'
    OR t->'source'->>'request_key' IS DISTINCT FROM NEW.subscription_checkout_key
    OR NEW.subscription_checkout->'subscription_tax_snapshot' IS DISTINCT FROM t THEN RAISE EXCEPTION 'subscription quote source identity is invalid';END IF;
  ELSE
   SELECT * INTO b FROM public.billing_history WHERE id=NEW.subscription_tax_source_id;
   IF NOT FOUND OR (b.subscription_tax_snapshot IS DISTINCT FROM t AND (b.subscription_checkout->>'mode' IS DISTINCT FROM 'razorpay_subscription' OR b.subscription_checkout->'recurring_tax_snapshot' IS DISTINCT FROM t)) OR b.site_id IS DISTINCT FROM NEW.site_id OR b.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'subscription cycle requires its retained quote source';END IF;
  END IF;
 ELSE
  IF coalesce(NEW.amount_paid,0)<=0 THEN RETURN NEW;END IF;
  IF writer IS NULL OR writer NOT IN('activate_merchant_subscription_v1:360','record_merchant_subscription_failure_v1:360') THEN
   RAISE EXCEPTION 'positive subscription requires the current canonical activation writer';END IF;
  SELECT * INTO b FROM public.billing_history WHERE id=NEW.subscription_tax_source_id;
  IF NOT FOUND OR b.deleted_at IS NOT NULL OR NOT public.valid_subscription_tax_snapshot_360(b.subscription_tax_snapshot)
   OR (NEW.subscription_tax_snapshot IS DISTINCT FROM b.subscription_tax_snapshot AND (b.subscription_checkout->>'mode' IS DISTINCT FROM 'razorpay_subscription' OR b.subscription_checkout->'recurring_tax_snapshot' IS DISTINCT FROM NEW.subscription_tax_snapshot)) OR NEW.amount_paid IS DISTINCT FROM (NEW.subscription_tax_snapshot->>'gross_minor')::bigint
   OR NEW.currency IS DISTINCT FROM 'INR' OR NEW.user_id IS DISTINCT FROM b.user_id OR NEW.site_id IS DISTINCT FROM b.site_id
   OR NEW.store_id IS DISTINCT FROM b.store_id OR NEW.plan_id::text IS DISTINCT FROM b.subscription_tax_snapshot->'source'->>'plan_id'
   OR NEW.plan IS DISTINCT FROM b.subscription_tax_snapshot->'source'->>'plan_slug' OR NEW.billing_period IS DISTINCT FROM b.billing_period THEN
   RAISE EXCEPTION 'positive subscription lacks its exact retained tax source';END IF;
 END IF;
 RETURN NEW;
END $admission$;
CREATE TRIGGER billing_history_tax_writer_360 BEFORE INSERT ON public.billing_history FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_tax_new_writer_360();
CREATE TRIGGER subscriptions_tax_writer_360 BEFORE INSERT ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_tax_new_writer_360();
REVOKE ALL ON FUNCTION public.guard_subscription_tax_new_writer_360() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.guard_subscription_tax_new_writer_360() TO service_role;
CREATE FUNCTION public.guard_subscription_tax_rows_360() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $g$
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN('billing_history','subscriptions','audit_logs') THEN
  RAISE EXCEPTION 'unexpected subscription tax retention relation';END IF;
 -- Row triggers do not cover TRUNCATE. Retained source and audit evidence must
 -- also survive statement-level maintenance, including CASCADE.
 IF TG_TABLE_NAME='audit_logs' THEN
  IF TG_OP='TRUNCATE' THEN
   IF EXISTS(SELECT 1 FROM public.audit_logs WHERE metadata?'subscription_tax_source_id' OR metadata->>'subscription_tax_policy'='D-SUB-TAX-INCLUSIVE-V1') THEN
    RAISE EXCEPTION 'retained subscription tax audits cannot be truncated';END IF;
   RETURN NULL;
  END IF;
  IF OLD.metadata?'subscription_tax_source_id' OR OLD.metadata->>'subscription_tax_policy'='D-SUB-TAX-INCLUSIVE-V1' THEN
   RAISE EXCEPTION 'retained subscription tax audits are immutable';END IF;
  IF TG_OP='DELETE' THEN RETURN OLD;END IF;
  IF NEW.metadata?'subscription_tax_source_id' OR NEW.metadata->>'subscription_tax_policy'='D-SUB-TAX-INCLUSIVE-V1' THEN
   RAISE EXCEPTION 'ordinary audits cannot be reclassified as subscription tax evidence';END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='TRUNCATE' THEN
  IF (TG_TABLE_NAME='billing_history' AND EXISTS(SELECT 1 FROM public.billing_history WHERE subscription_tax_snapshot IS NOT NULL
    OR subscription_tax_source_id IS NOT NULL OR (amount>0 AND subscription_id IS NOT NULL)))
   OR (TG_TABLE_NAME='subscriptions' AND EXISTS(SELECT 1 FROM public.subscriptions WHERE subscription_tax_snapshot IS NOT NULL
    OR subscription_tax_source_id IS NOT NULL OR amount_paid>0)) THEN
   RAISE EXCEPTION 'retained subscription financial sources cannot be truncated';END IF;
  RETURN NULL;
 END IF;
 IF TG_OP='DELETE' AND (OLD.subscription_tax_snapshot IS NOT NULL OR OLD.subscription_tax_source_id IS NOT NULL
  OR (TG_TABLE_NAME='billing_history' AND coalesce((to_jsonb(OLD)->>'amount')::bigint,0)>0 AND to_jsonb(OLD)->>'subscription_id' IS NOT NULL)
  OR (TG_TABLE_NAME='subscriptions' AND coalesce((to_jsonb(OLD)->>'amount_paid')::bigint,0)>0)) THEN
  RAISE EXCEPTION 'retained subscription financial source is immutable';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 -- 360 never upgrades a retained pre-360 row in place. A new cycle gets a new
 -- canonical billing source; historical additive invoices keep their full money
 -- identity. Operational subscription status/dunning updates remain permitted.
 IF OLD.subscription_tax_snapshot IS NULL AND NEW.subscription_tax_snapshot IS NOT NULL THEN
  RAISE EXCEPTION 'legacy subscription source cannot be rewritten with a tax snapshot';END IF;
 IF OLD.subscription_tax_snapshot IS NULL AND (
  (TG_TABLE_NAME='billing_history' AND coalesce((to_jsonb(OLD)->>'amount')::bigint,0)>0 AND to_jsonb(OLD)->>'subscription_id' IS NOT NULL
   AND EXISTS(SELECT 1 FROM unnest(ARRAY['id','user_id','store_id','site_id','subscription_id','invoice_number','description',
    'amount','total_amount','tax_amount','currency','payment_gateway','payment_id','provider_payment_reference','payment_status',
    'billing_period','period_start','period_end','subscription_tax_source_id']) AS protected(key)
    WHERE to_jsonb(NEW)->protected.key IS DISTINCT FROM to_jsonb(OLD)->protected.key))
  OR (TG_TABLE_NAME='subscriptions' AND coalesce((to_jsonb(OLD)->>'amount_paid')::bigint,0)>0
   AND EXISTS(SELECT 1 FROM unnest(ARRAY['id','user_id','store_id','site_id','plan','plan_id','billing_period',
    'current_period_start','current_period_end','amount_paid','currency','payment_gateway','razorpay_payment_id',
    'razorpay_order_id','external_subscription_id','subscription_tax_source_id']) AS protected(key)
    WHERE to_jsonb(NEW)->protected.key IS DISTINCT FROM to_jsonb(OLD)->protected.key))) THEN
  RAISE EXCEPTION 'legacy subscription financial source is immutable';END IF;
 IF OLD.subscription_tax_snapshot IS NOT NULL AND coalesce(current_setting('letbuyy.subscription_tax_writer',true),'') NOT IN('claim_merchant_subscription_checkout_v1:360','bind_merchant_subscription_checkout_v1:360','activate_merchant_subscription_v1:360','record_merchant_subscription_invoice_v1:360','record_merchant_subscription_failure_v1:360')
  AND (TG_TABLE_NAME='billing_history' OR EXISTS(SELECT 1 FROM unnest(ARRAY[
   'id','user_id','store_id','site_id','plan','plan_id','billing_period','current_period_start','current_period_end',
   'amount_paid','currency','payment_gateway','razorpay_payment_id','razorpay_order_id','external_subscription_id',
   'subscription_tax_snapshot','subscription_tax_source_id']) AS protected(key)
   WHERE to_jsonb(NEW)->protected.key IS DISTINCT FROM to_jsonb(OLD)->protected.key)) THEN
  RAISE EXCEPTION 'subscription financial source updates require the canonical writer';END IF;
 -- Writer markers reject stale/accidental callers; the immutable data
 -- invariants also hold if a trusted SQL caller manually sets that marker.
 IF TG_TABLE_NAME='billing_history' AND OLD.subscription_tax_snapshot IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['id','user_id','store_id','site_id','amount','total_amount','currency','payment_gateway',
    'billing_period','subscription_checkout_key','subscription_checkout_request','subscription_tax_source_id']) AS protected(key)
    WHERE to_jsonb(NEW)->protected.key IS DISTINCT FROM to_jsonb(OLD)->protected.key)
   OR ((to_jsonb(NEW)->'subscription_checkout')-'short_url') IS DISTINCT FROM ((to_jsonb(OLD)->'subscription_checkout')-'short_url')
   OR (to_jsonb(OLD)->>'subscription_checkout_reference' IS NOT NULL
       AND to_jsonb(OLD)->>'subscription_checkout_reference' IS DISTINCT FROM to_jsonb(NEW)->>'subscription_checkout_reference') THEN
   RAISE EXCEPTION 'retained subscription quote money and source identity are immutable';END IF;
  IF to_jsonb(OLD)->>'payment_status'='pending' THEN
   IF to_jsonb(NEW)->>'payment_status'='pending' AND (to_jsonb(NEW)->>'tax_amount')::bigint IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'pending subscription quote tax cannot be rewritten';END IF;
   IF to_jsonb(NEW)->>'payment_status' IN('paid','failed') AND (
    (to_jsonb(NEW)->>'tax_amount')::bigint IS DISTINCT FROM (NEW.subscription_tax_snapshot->>'tax_minor')::bigint
    OR NOT EXISTS(SELECT 1 FROM public.subscriptions x WHERE x.id=(to_jsonb(NEW)->>'subscription_id')::uuid
     AND x.site_id=NEW.site_id AND x.store_id=NEW.store_id AND x.user_id=NEW.user_id
     AND x.subscription_tax_source_id=NEW.subscription_tax_source_id AND x.subscription_tax_snapshot=NEW.subscription_tax_snapshot
     AND x.amount_paid=(to_jsonb(NEW)->>'amount')::bigint AND x.currency=to_jsonb(NEW)->>'currency'
     AND x.billing_period=to_jsonb(NEW)->>'billing_period'
     AND x.current_period_start=(to_jsonb(NEW)->>'period_start')::timestamptz AND x.current_period_end=(to_jsonb(NEW)->>'period_end')::timestamptz)) THEN
    RAISE EXCEPTION 'subscription quote finalization requires its exact activated source';END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME='subscriptions' AND OLD.subscription_tax_snapshot IS NOT NULL
  AND EXISTS(SELECT 1 FROM unnest(ARRAY['id','user_id','store_id','site_id','plan','plan_id','billing_period','current_period_start','current_period_end',
    'amount_paid','currency','payment_gateway','razorpay_payment_id','razorpay_order_id','external_subscription_id','subscription_tax_snapshot','subscription_tax_source_id']) AS protected(key)
   WHERE to_jsonb(NEW)->protected.key IS DISTINCT FROM to_jsonb(OLD)->protected.key)
  AND NOT EXISTS(SELECT 1 FROM public.billing_history b JOIN public.billing_history origin ON origin.id=b.subscription_tax_source_id
   WHERE b.id=NEW.subscription_tax_source_id AND b.subscription_id=NEW.id AND b.payment_status='paid' AND b.deleted_at IS NULL
    AND b.site_id=NEW.site_id AND b.store_id=NEW.store_id AND b.user_id=NEW.user_id
    AND b.subscription_tax_snapshot=NEW.subscription_tax_snapshot AND b.amount=(to_jsonb(NEW)->>'amount_paid')::bigint
    AND b.currency=to_jsonb(NEW)->>'currency' AND b.payment_gateway IS NOT DISTINCT FROM to_jsonb(NEW)->>'payment_gateway'
    AND b.billing_period=to_jsonb(NEW)->>'billing_period'
    AND b.period_start=(to_jsonb(NEW)->>'current_period_start')::timestamptz AND b.period_end=(to_jsonb(NEW)->>'current_period_end')::timestamptz
    AND b.subscription_tax_snapshot->'source'->>'plan_id'=to_jsonb(NEW)->>'plan_id'
    AND b.subscription_tax_snapshot->'source'->>'plan_slug'=to_jsonb(NEW)->>'plan'
    AND origin.subscription_checkout_reference IS NOT DISTINCT FROM to_jsonb(NEW)->>'external_subscription_id'
    AND (b.payment_gateway<>'razorpay' OR b.provider_payment_reference IS NOT DISTINCT FROM to_jsonb(NEW)->>'razorpay_payment_id')) THEN
  RAISE EXCEPTION 'subscription financial fields must equal their immutable paid invoice source';END IF;
 IF OLD.subscription_tax_snapshot IS NOT NULL AND OLD.subscription_tax_snapshot IS DISTINCT FROM NEW.subscription_tax_snapshot
  AND NOT (TG_TABLE_NAME='subscriptions' AND NEW.subscription_tax_source_id IS DISTINCT FROM OLD.subscription_tax_source_id
   AND EXISTS(SELECT 1 FROM public.billing_history b WHERE b.id=NEW.subscription_tax_source_id AND b.subscription_id=NEW.id
    AND b.site_id=NEW.site_id AND b.user_id=NEW.user_id AND b.subscription_tax_snapshot=NEW.subscription_tax_snapshot AND b.payment_status='paid')) THEN
  RAISE EXCEPTION 'retained tax snapshot requires a distinct canonical paid cycle source';END IF;
 IF TG_TABLE_NAME='billing_history' AND OLD.subscription_tax_snapshot IS NOT NULL AND to_jsonb(OLD)->>'payment_status' IN('paid','failed','refunded')
  AND (to_jsonb(NEW)-ARRAY['updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at']) THEN RAISE EXCEPTION 'issued subscription invoice is immutable';END IF;
 IF TG_TABLE_NAME='subscriptions' AND OLD.subscription_tax_source_id IS NOT NULL AND OLD.subscription_tax_source_id IS DISTINCT FROM NEW.subscription_tax_source_id
  AND NOT EXISTS(SELECT 1 FROM public.billing_history b WHERE b.id=NEW.subscription_tax_source_id AND b.subscription_id=NEW.id
   AND b.site_id=NEW.site_id AND b.user_id=NEW.user_id AND b.subscription_tax_snapshot=NEW.subscription_tax_snapshot AND b.payment_status='paid') THEN
  RAISE EXCEPTION 'current subscription tax pointer requires a distinct canonical paid source';END IF;
 RETURN NEW;
END $g$;
CREATE TRIGGER billing_history_tax_source_immutable_360 BEFORE UPDATE OR DELETE ON public.billing_history FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_tax_rows_360();
CREATE TRIGGER subscriptions_tax_source_immutable_360 BEFORE UPDATE OR DELETE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_tax_rows_360();
CREATE TRIGGER billing_history_tax_source_truncate_360 BEFORE TRUNCATE ON public.billing_history FOR EACH STATEMENT EXECUTE FUNCTION public.guard_subscription_tax_rows_360();
CREATE TRIGGER subscriptions_tax_source_truncate_360 BEFORE TRUNCATE ON public.subscriptions FOR EACH STATEMENT EXECUTE FUNCTION public.guard_subscription_tax_rows_360();
CREATE TRIGGER subscription_tax_audit_immutable_360 BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_tax_rows_360();
CREATE TRIGGER subscription_tax_audit_truncate_360 BEFORE TRUNCATE ON public.audit_logs FOR EACH STATEMENT EXECUTE FUNCTION public.guard_subscription_tax_rows_360();
REVOKE ALL ON FUNCTION public.valid_subscription_tax_snapshot_360(jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.valid_subscription_tax_snapshot_360(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.issue_subscription_tax_invoice_360(uuid,jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.issue_subscription_tax_invoice_360(uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.read_merchant_subscription_checkout_key_v1(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.read_merchant_subscription_checkout_key_v1(uuid,uuid,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.record_merchant_subscription_invoice_v1(jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.record_merchant_subscription_invoice_v1(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.guard_subscription_tax_rows_360() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.guard_subscription_tax_rows_360() TO service_role;

CREATE FUNCTION public.record_merchant_subscription_failure_v1(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public SET letbuyy.subscription_tax_writer='record_merchant_subscription_failure_v1:360' AS $failure$
DECLARE o public.sites%ROWTYPE;b public.billing_history%ROWTYPE;sub public.subscriptions%ROWTYPE;v jsonb;actor uuid;site uuid;pay text;
BEGIN
 actor:=(p_input->>'user_id')::uuid;site:=(p_input->>'store_id')::uuid;pay:=p_input->>'payment_id';
 IF pay IS NULL OR length(pay)>200 THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:subscription:invoice:'||pay,0));
 SELECT * INTO o FROM public.sites WHERE id=site AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(actor=o.custom_user_id OR actor=o.user_id,false) THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED');END IF;
 SELECT * INTO b FROM public.billing_history WHERE id=(p_input->>'source_id')::uuid FOR UPDATE;
 IF NOT FOUND OR b.deleted_at IS NOT NULL OR b.site_id IS DISTINCT FROM site OR b.user_id IS DISTINCT FROM actor
  OR NOT public.valid_subscription_tax_snapshot_360(b.subscription_tax_snapshot)
  OR b.subscription_checkout->>'mode' IS DISTINCT FROM 'sandbox_activation'
  OR b.subscription_checkout_request->>'sandbox_payment_status' IS DISTINCT FROM 'failed'
  OR pay IS DISTINCT FROM 'sandbox_failed:'||b.subscription_checkout_key THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
 IF b.subscription_id IS NOT NULL THEN
  SELECT * INTO sub FROM public.subscriptions WHERE id=b.subscription_id;
  IF b.payment_status IS DISTINCT FROM 'failed' OR sub.store_id IS DISTINCT FROM site OR sub.user_id IS DISTINCT FROM actor THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
  RETURN jsonb_build_object('accepted',true,'subscription',to_jsonb(sub),'invoice',to_jsonb(b),'replayed',true);
 END IF;
 IF b.payment_status IS DISTINCT FROM 'pending' OR NOT EXISTS(SELECT 1 FROM public.plans p WHERE p.id=(b.subscription_checkout->'plan'->>'id')::uuid AND p.is_active)
  OR (p_input->>'period_end')::timestamptz<=(p_input->>'period_start')::timestamptz THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');END IF;
 INSERT INTO public.subscriptions(user_id,store_id,site_id,plan,plan_id,status,billing_period,current_period_start,current_period_end,
  payment_gateway,external_subscription_id,amount_paid,currency,mandate_id,idempotency_key,dunning_status,dunning_attempts,next_dunning_at,subscription_tax_snapshot,subscription_tax_source_id)
 VALUES(actor,site,site,b.subscription_checkout->'plan'->>'slug',(b.subscription_checkout->'plan'->>'id')::uuid,'past_due',b.billing_period,
  (p_input->>'period_start')::timestamptz,(p_input->>'period_end')::timestamptz,'razorpay',b.subscription_checkout_reference,b.amount,'INR',
  nullif(p_input->>'mandate_id','')::uuid,b.subscription_checkout_key,p_input->>'dunning_status',(p_input->>'dunning_attempts')::integer,
  nullif(p_input->>'next_dunning_at','')::timestamptz,b.subscription_tax_snapshot,b.id) RETURNING * INTO sub;
 v:=public.record_merchant_subscription_invoice_v1(jsonb_build_object('user_id',actor,'store_id',site,'subscription_id',sub.id,
  'invoice_number',p_input->>'invoice_number','description',p_input->>'description','amount',b.amount,'currency','INR',
  'tax_amount',(b.subscription_tax_snapshot->>'tax_minor')::bigint,'total_amount',b.amount,'payment_gateway','razorpay','payment_id',pay,
  'payment_status','failed','billing_period',b.billing_period,'period_start',p_input->>'period_start','period_end',p_input->>'period_end'));
 IF v->>'accepted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'canonical failed invoice source unavailable';END IF;
 RETURN jsonb_build_object('accepted',true,'subscription',to_jsonb(sub),'invoice',v->'invoice','replayed',false);
END $failure$;
CREATE FUNCTION public.guard_subscription_tax_invoice_360() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $invoice$
DECLARE b public.billing_history%ROWTYPE;t jsonb;
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME<>'merchant_billing_invoices' THEN RAISE EXCEPTION 'unexpected subscription tax invoice retention relation';END IF;
 IF TG_OP='TRUNCATE' THEN
  IF EXISTS(SELECT 1 FROM public.merchant_billing_invoices i LEFT JOIN public.billing_history h ON h.id=i.billing_history_id
   WHERE i.metadata->>'policy_version'='D-SUB-TAX-INCLUSIVE-V1' OR i.metadata?'provider_invoice'
    OR h.subscription_tax_snapshot IS NOT NULL OR (h.amount>0 AND h.subscription_id IS NOT NULL)) THEN
   RAISE EXCEPTION 'retained subscription billing documents cannot be truncated';END IF;
  RETURN NULL;
 END IF;
 IF TG_OP<>'INSERT' THEN
  IF EXISTS(SELECT 1 FROM public.billing_history WHERE id=OLD.billing_history_id AND subscription_tax_snapshot IS NOT NULL) THEN RAISE EXCEPTION 'issued subscription tax invoice is immutable';END IF;
  IF TG_OP='DELETE' THEN
   IF EXISTS(SELECT 1 FROM public.billing_history h WHERE h.id=OLD.billing_history_id AND h.amount>0 AND h.subscription_id IS NOT NULL) THEN
    RAISE EXCEPTION 'retained subscription billing document is immutable';END IF;
   RETURN OLD;
  END IF;
 END IF;
 SELECT * INTO b FROM public.billing_history WHERE id=NEW.billing_history_id;t:=b.subscription_tax_snapshot;
 IF t IS NULL AND NEW.metadata->>'policy_version'='D-SUB-TAX-INCLUSIVE-V1' THEN RAISE EXCEPTION 'tax invoice metadata requires its canonical history source';END IF;
 IF t IS NULL AND EXISTS(SELECT 1 FROM public.subscriptions WHERE id=NEW.subscription_id AND subscription_tax_snapshot IS NOT NULL) THEN RAISE EXCEPTION 'tax-backed subscription invoice requires canonical tax history';END IF;
 IF t IS NOT NULL AND (NOT public.valid_subscription_tax_snapshot_360(t) OR b.payment_status NOT IN('paid','failed')
  OR NEW.site_id IS DISTINCT FROM b.site_id OR NEW.subscription_id IS DISTINCT FROM b.subscription_id OR NEW.invoice_number IS DISTINCT FROM b.invoice_number
  OR NEW.currency IS DISTINCT FROM 'INR' OR NEW.subtotal_minor IS DISTINCT FROM (t->>'taxable_minor')::bigint
  OR NEW.cgst_minor IS DISTINCT FROM (t->>'cgst_minor')::bigint OR NEW.sgst_minor IS DISTINCT FROM (t->>'sgst_minor')::bigint
  OR NEW.igst_minor IS DISTINCT FROM (t->>'igst_minor')::bigint OR NEW.total_minor IS DISTINCT FROM b.amount
  OR NEW.period_start IS DISTINCT FROM b.period_start OR NEW.period_end IS DISTINCT FROM b.period_end
  OR NEW.status IS DISTINCT FROM CASE WHEN b.payment_status='paid' THEN 'issued' ELSE 'payment_failed' END
  OR NEW.metadata->>'source_id' IS DISTINCT FROM b.id::text OR NEW.metadata->>'basis' IS DISTINCT FROM 'inclusive'
  OR NEW.metadata->>'policy_version' IS DISTINCT FROM 'D-SUB-TAX-INCLUSIVE-V1') THEN RAISE EXCEPTION 'subscription tax invoice differs from canonical source';END IF;
 IF NEW.metadata?'provider_invoice' AND (
  t IS NULL OR b.payment_status IS DISTINCT FROM 'paid' OR jsonb_typeof(NEW.metadata->'provider_invoice') IS DISTINCT FROM 'object'
  OR NOT coalesce((NEW.metadata->'provider_invoice'->>'invoice_id')~'^inv_[A-Za-z0-9]{1,116}$',false)
  OR NEW.metadata->'provider_invoice'->>'payment_id' IS DISTINCT FROM b.provider_payment_reference
  OR NEW.metadata->'provider_invoice'->>'gross_minor' IS DISTINCT FROM b.amount::text
  OR (NEW.metadata->'provider_invoice'->>'period_start')::timestamptz IS DISTINCT FROM b.period_start
  OR (NEW.metadata->'provider_invoice'->>'period_end')::timestamptz IS DISTINCT FROM b.period_end
  OR NOT EXISTS(SELECT 1 FROM public.billing_history origin WHERE origin.id=b.subscription_tax_source_id
   AND origin.subscription_checkout->>'mode'='razorpay_subscription' AND origin.subscription_checkout_reference=NEW.metadata->'provider_invoice'->>'subscription_reference'
   AND ((NEW.metadata->'provider_invoice'->>'phase'='initial_with_upfront' AND origin.id=b.id AND origin.subscription_tax_snapshot=t
         AND (origin.subscription_checkout->'charge_schedule'->>'upfront_gross_minor')::bigint>0)
     OR (NEW.metadata->'provider_invoice'->>'phase'='base_cycle' AND origin.subscription_checkout->'recurring_tax_snapshot'=t)))) THEN
  RAISE EXCEPTION 'provider invoice evidence differs from its immutable billing source';END IF;
 RETURN NEW;
END $invoice$;
CREATE TRIGGER merchant_billing_tax_invoice_immutable_360 BEFORE INSERT OR UPDATE OR DELETE ON public.merchant_billing_invoices FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_tax_invoice_360();
CREATE TRIGGER merchant_billing_tax_invoice_truncate_360 BEFORE TRUNCATE ON public.merchant_billing_invoices FOR EACH STATEMENT EXECUTE FUNCTION public.guard_subscription_tax_invoice_360();
CREATE UNIQUE INDEX merchant_billing_tax_source_360_uidx ON public.merchant_billing_invoices(billing_history_id) WHERE metadata->>'policy_version'='D-SUB-TAX-INCLUSIVE-V1';
CREATE UNIQUE INDEX merchant_billing_provider_invoice_360_uidx ON public.merchant_billing_invoices((metadata->'provider_invoice'->>'invoice_id')) WHERE metadata->>'policy_version'='D-SUB-TAX-INCLUSIVE-V1' AND metadata?'provider_invoice';
REVOKE ALL ON FUNCTION public.record_merchant_subscription_failure_v1(jsonb),public.guard_subscription_tax_invoice_360() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.record_merchant_subscription_failure_v1(jsonb),public.guard_subscription_tax_invoice_360() TO service_role;

-- Operational provider status never owns invoice periods or historical rows.
-- Serialize on the same site lock as activation, then select the current cycle.
CREATE FUNCTION public.sync_merchant_subscription_state_v1(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public SET letbuyy.subscription_tax_version='360' AS $sync$
DECLARE ref text:=nullif(btrim(p_input->>'external_subscription_id'),'');state text:=p_input->>'status';site uuid;
 o public.sites%ROWTYPE;s public.subscriptions%ROWTYPE;b public.billing_history%ROWTYPE;started timestamptz;finished timestamptz;
BEGIN
 IF ref IS NULL OR length(ref)>200 OR state IS NULL OR state NOT IN('active','cancelled','past_due','trialing') THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');END IF;
 IF p_input->>'current_period_start' IS NOT NULL THEN started:=(p_input->>'current_period_start')::timestamptz;END IF;
 IF p_input->>'current_period_end' IS NOT NULL THEN finished:=(p_input->>'current_period_end')::timestamptz;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:subscription:status:'||ref,0));
 SELECT store_id INTO site FROM public.subscriptions WHERE external_subscription_id=ref AND deleted_at IS NULL
  ORDER BY current_period_start DESC NULLS LAST,created_at DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',true,'subscription',NULL);END IF;
 SELECT * INTO o FROM public.sites WHERE id=site AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED');END IF;
 -- Cached frames waiting behind retirement must observe the current binding.
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.sync_merchant_subscription_state_v1(jsonb)')
  AND 'letbuyy.subscription_tax_version=360'=ANY(proconfig)) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');END IF;
 SELECT * INTO s FROM public.subscriptions WHERE external_subscription_id=ref AND store_id=site AND deleted_at IS NULL
  ORDER BY current_period_start DESC NULLS LAST,created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR s.site_id IS DISTINCT FROM site OR NOT coalesce(s.user_id=o.custom_user_id OR s.user_id=o.user_id,false) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED');END IF;
 -- An external reference may never ambiguously select another tenant/actor.
 IF EXISTS(SELECT 1 FROM public.subscriptions x WHERE x.external_subscription_id=ref AND x.deleted_at IS NULL
  AND (x.store_id IS DISTINCT FROM site OR x.site_id IS DISTINCT FROM site OR x.user_id IS DISTINCT FROM s.user_id)) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
 IF (started IS NOT NULL AND started IS DISTINCT FROM s.current_period_start)
  OR (finished IS NOT NULL AND finished IS DISTINCT FROM s.current_period_end) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');END IF;
 IF s.subscription_tax_snapshot IS NOT NULL THEN
  SELECT * INTO b FROM public.billing_history WHERE id=s.subscription_tax_source_id FOR SHARE;
  IF NOT FOUND OR b.deleted_at IS NOT NULL OR b.subscription_id IS DISTINCT FROM s.id OR b.site_id IS DISTINCT FROM site
   OR b.user_id IS DISTINCT FROM s.user_id OR b.payment_status IS DISTINCT FROM 'paid'
   OR b.subscription_tax_snapshot IS DISTINCT FROM s.subscription_tax_snapshot OR NOT public.valid_subscription_tax_snapshot_360(b.subscription_tax_snapshot)
   OR b.amount IS DISTINCT FROM s.amount_paid OR b.currency IS DISTINCT FROM s.currency
   OR b.period_start IS DISTINCT FROM s.current_period_start OR b.period_end IS DISTINCT FROM s.current_period_end THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_TAX_REVIEW_REQUIRED');END IF;
 END IF;
 UPDATE public.subscriptions SET status=state,cancelled_at=CASE WHEN state='cancelled' THEN coalesce(cancelled_at,now()) ELSE NULL END,
  updated_at=now() WHERE id=s.id RETURNING * INTO s;
 RETURN jsonb_build_object('accepted',true,'subscription',to_jsonb(s));
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
 RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');
END $sync$;
REVOKE ALL ON FUNCTION public.sync_merchant_subscription_state_v1(jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.sync_merchant_subscription_state_v1(jsonb) TO service_role;

CREATE FUNCTION public.guard_subscription_tax_ddl_360() RETURNS event_trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $g$
DECLARE binding jsonb;v_entry record;v_fn pg_proc%ROWTYPE;v_journal public.migration_privilege_journal%ROWTYPE;
BEGIN
 -- TAX360-CUSTODY-BEGIN: private actual grant receipt binds this verifier,
 -- including its catalog SET birth identities. Comments are cosmetic only.
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('anon','authenticated','app_tenant') AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolcanlogin OR NOT rolinherit))
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND rolbypassrls AND NOT rolcanlogin AND rolinherit)
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres' AND rolsuper)
  OR EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.roleid IN('service_role'::regrole,'anon'::regrole,'authenticated'::regrole,'app_tenant'::regrole)
   AND NOT((m.roleid='app_tenant'::regrole AND m.member IN('postgres'::regrole,'service_role'::regrole) AND NOT m.admin_option AND m.inherit_option AND m.set_option)
    OR(m.member=to_regrole('authenticator') AND m.roleid IN('anon'::regrole,'authenticated'::regrole,'service_role'::regrole) AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option)))
  OR EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member IN('anon'::regrole,'authenticated'::regrole,'app_tenant'::regrole,'service_role'::regrole)
   AND NOT(m.member='service_role'::regrole AND m.roleid='app_tenant'::regrole AND NOT m.admin_option AND m.inherit_option AND m.set_option)) THEN
  RAISE EXCEPTION '360 refuses unknown critical role or membership profile';END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator' AND (NOT rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION '360 refuses changed authenticator profile';END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant','service_role'])role WHERE has_schema_privilege(role,'public','CREATE')) THEN RAISE EXCEPTION '360 refuses untrusted public CREATE';END IF;

 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.migration_privilege_journal'::regclass AND relkind='r' AND relpersistence='p'
  AND relowner='postgres'::regrole AND relrowsecurity AND relforcerowsecurity AND NOT relispartition AND relreplident='d' AND reloptions IS NULL AND reltablespace=0)
  OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid='public.migration_privilege_journal'::regclass OR inhparent='public.migration_privilege_journal'::regclass)
  OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class='public.migration_privilege_journal'::regclass)
  OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.migration_privilege_journal'::regclass)
  OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.migration_privilege_journal'::regclass) THEN RAISE EXCEPTION '360 refuses unknown private journal relation profile';END IF;
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.migration_privilege_journal'::regclass AND attnum>0)<>9 OR EXISTS(
  SELECT 1 FROM(VALUES (1,'migration','text',true,NULL),
 (2,'object_signature','text',true,NULL),
 (3,'grantee','text',true,NULL),
 (4,'privilege','text',true,NULL),
 (5,'action','text',true,NULL),
 (6,'recorded_at','timestamptz',true,'now()'),
 (7,'object_oid','oid',false,NULL),
 (8,'object_owner','oid',false,NULL),
 (9,'object_definition_hash','text',false,NULL))e(num,name,typ,required,def)
  LEFT JOIN pg_attribute ca ON ca.attrelid='public.migration_privilege_journal'::regclass AND ca.attnum=e.num
  LEFT JOIN pg_attrdef df ON df.adrelid=ca.attrelid AND df.adnum=ca.attnum
  WHERE ca.attname IS DISTINCT FROM e.name OR ca.atttypid IS DISTINCT FROM e.typ::regtype OR ca.attnotnull IS DISTINCT FROM e.required
   OR ca.atttypmod<>-1 OR ca.attisdropped OR ca.attidentity<>'' OR ca.attgenerated<>'' OR ca.atthasmissing OR ca.attmissingval IS NOT NULL
   OR ca.attndims<>0 OR NOT ca.attislocal OR ca.attinhcount<>0 OR ca.attacl IS NOT NULL OR ca.attoptions IS NOT NULL OR ca.attfdwoptions IS NOT NULL
   OR ca.attstorage IS DISTINCT FROM(SELECT typstorage FROM pg_type WHERE oid=e.typ::regtype)
   OR ca.attcollation IS DISTINCT FROM CASE WHEN e.typ='text' THEN 'pg_catalog.default'::regcollation::oid ELSE 0::oid END
   OR pg_get_expr(df.adbin,df.adrelid,false) IS DISTINCT FROM e.def) THEN RAISE EXCEPTION '360 refuses changed private journal columns/defaults/grants';END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.migration_privilege_journal'::regclass)<>2
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.migration_privilege_journal'::regclass AND conname='migration_privilege_journal_pkey'
   AND contype='p' AND conkey=ARRAY[1,2,3,4,5]::smallint[] AND NOT condeferrable AND NOT condeferred AND convalidated AND conislocal AND coninhcount=0 AND conparentid=0)
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.migration_privilege_journal'::regclass AND conname='migration_privilege_journal_action_check'
   AND contype='c' AND convalidated AND NOT condeferrable AND NOT condeferred
   AND pg_get_constraintdef(oid,false)='CHECK ((action = ANY (ARRAY[''revoked''::text, ''granted''::text])))') THEN RAISE EXCEPTION '360 refuses changed private journal constraints';END IF;
 IF (SELECT count(*) FROM pg_index WHERE indrelid='public.migration_privilege_journal'::regclass)<>1 OR NOT EXISTS(
  SELECT 1 FROM pg_index ix JOIN pg_class ci ON ci.oid=ix.indexrelid JOIN pg_constraint co ON co.conindid=ix.indexrelid AND co.conrelid=ix.indrelid AND co.contype='p'
  WHERE ix.indrelid='public.migration_privilege_journal'::regclass AND ci.relnamespace='public'::regnamespace AND ci.relname='migration_privilege_journal_pkey'
   AND ci.relkind='i' AND ci.relpersistence='p' AND ci.relowner='postgres'::regrole AND ci.relacl IS NULL AND ci.reloptions IS NULL AND ci.reltablespace=0 AND NOT ci.relispartition
   AND ci.relam=(SELECT oid FROM pg_am WHERE amname='btree') AND ix.indnatts=5 AND ix.indnkeyatts=5 AND ix.indkey::text='1 2 3 4 5'
   AND ix.indisunique AND ix.indisprimary AND ix.indisvalid AND ix.indisready AND ix.indislive AND ix.indimmediate AND NOT ix.indnullsnotdistinct
   AND NOT ix.indisexclusion AND NOT ix.indisclustered AND NOT ix.indisreplident AND NOT ix.indcheckxmin AND ix.indexprs IS NULL AND ix.indpred IS NULL
   AND ix.indoption::text='0 0 0 0 0'
   AND ARRAY(SELECT x FROM unnest(ix.indclass::oid[])x)=array_fill((SELECT oid FROM pg_opclass WHERE opcnamespace='pg_catalog'::regnamespace AND opcname='text_ops' AND opcmethod=ci.relam AND opcdefault),ARRAY[5])
   AND ARRAY(SELECT x FROM unnest(ix.indcollation::oid[])x)=array_fill('pg_catalog.default'::regcollation::oid,ARRAY[5])) THEN
  RAISE EXCEPTION '360 refuses changed private journal PK index profile';END IF;
 IF NOT has_table_privilege('service_role','public.migration_privilege_journal','SELECT')
  OR has_table_privilege('service_role','public.migration_privilege_journal','SELECT WITH GRANT OPTION')
  OR EXISTS(SELECT 1 FROM aclexplode(coalesce((SELECT relacl FROM pg_class WHERE oid='public.migration_privilege_journal'::regclass),acldefault('r','postgres'::regrole)))acl
   WHERE acl.grantee NOT IN('postgres'::regrole,'service_role'::regrole) OR acl.grantor<>'postgres'::regrole OR (acl.grantee='service_role'::regrole AND acl.is_grantable)) THEN
  RAISE EXCEPTION '360 refuses unknown private journal ACL/grant options';END IF;

 IF EXISTS(SELECT 1 FROM unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])priv WHERE has_table_privilege('service_role','public.migration_privilege_journal',priv))
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant'])role WHERE has_table_privilege(role,'public.migration_privilege_journal','SELECT')) THEN
  RAISE EXCEPTION '360 refuses writable or untrusted custody receipts';END IF;

 SELECT * INTO v_fn FROM pg_proc WHERE oid=to_regprocedure('public.guard_subscription_tax_ddl_360()');
 SELECT * INTO v_journal FROM public.migration_privilege_journal WHERE migration='360' AND object_signature='public.guard_subscription_tax_ddl_360()'
  AND grantee='service_role' AND privilege='EXECUTE' AND action='granted';
 IF v_fn.oid IS NULL OR v_journal.object_oid IS DISTINCT FROM v_fn.oid OR v_journal.object_owner IS DISTINCT FROM v_fn.proowner
  OR v_journal.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex') THEN
  RAISE EXCEPTION '360 refuses changed historical custody verifier identity or definition';END IF;
 SELECT substring(config from length('letbuyy.subscription_tax_birth_bindings=')+1)::jsonb INTO binding FROM unnest(v_fn.proconfig)config
  WHERE starts_with(config,'letbuyy.subscription_tax_birth_bindings=');
 IF jsonb_typeof(binding) IS DISTINCT FROM 'object' OR binding->>'schema_version' IS DISTINCT FROM '1'
  OR (SELECT count(*) FROM jsonb_each(binding->'functions'))<>14 THEN RAISE EXCEPTION '360 refuses missing or incomplete birth bindings';END IF;
 IF 'public'::regnamespace::oid IS DISTINCT FROM (binding->>'namespace_oid')::oid THEN RAISE EXCEPTION '360 refuses changed namespace identity';END IF;
 FOR v_entry IN SELECT key,value FROM jsonb_each_text(binding->'roles') LOOP
  IF to_regrole(v_entry.key)::oid IS DISTINCT FROM v_entry.value::oid THEN RAISE EXCEPTION '360 refuses changed critical role identity';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each_text(binding->'relations') LOOP
  IF to_regclass(v_entry.key)::oid IS DISTINCT FROM v_entry.value::oid THEN RAISE EXCEPTION '360 refuses changed parent relation identity';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each(binding->'functions') LOOP
  SELECT * INTO v_fn FROM pg_proc WHERE oid=to_regprocedure(v_entry.key);
  IF v_fn.oid IS NULL OR v_fn.oid IS DISTINCT FROM (v_entry.value->>'oid')::oid OR v_fn.proowner IS DISTINCT FROM (v_entry.value->>'owner')::oid
   OR v_fn.proacl::text IS DISTINCT FROM v_entry.value->>'acl' OR v_fn.proowner<>'postgres'::regrole
   OR encode(sha256(convert_to(v_fn.prosrc,'UTF8')),'hex') IS DISTINCT FROM v_entry.value->>'body_hash'
   OR (v_entry.key<>'public.guard_subscription_tax_ddl_360()' AND encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex') IS DISTINCT FROM v_entry.value->>'definition_hash')
   OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=v_fn.proname)<>1
   OR v_fn.prokind<>'f' OR v_fn.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql') OR v_fn.prosecdef OR v_fn.proretset OR v_fn.proisstrict
   OR v_fn.proleakproof OR v_fn.proparallel<>'u' OR v_fn.prosupport<>0 OR v_fn.provariadic<>0 OR v_fn.proargmodes IS NOT NULL OR v_fn.proallargtypes IS NOT NULL
   OR NOT has_function_privilege('service_role',v_fn.oid,'EXECUTE') OR has_function_privilege('service_role',v_fn.oid,'EXECUTE WITH GRANT OPTION')
   OR has_function_privilege('anon',v_fn.oid,'EXECUTE') OR has_function_privilege('authenticated',v_fn.oid,'EXECUTE') OR has_function_privilege('app_tenant',v_fn.oid,'EXECUTE')
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(v_fn.proacl,acldefault('f',v_fn.proowner)))acl WHERE acl.grantee NOT IN(v_fn.proowner,'service_role'::regrole) OR acl.privilege_type<>'EXECUTE') THEN
   RAISE EXCEPTION '360 refuses changed known function source/ABI/owner/grants/history: %',v_entry.key;END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.migration_privilege_journal WHERE migration='360')<>jsonb_array_length(binding->'journal_revocations')+1
  OR (SELECT coalesce(jsonb_agg(to_jsonb(jr) ORDER BY privilege),'[]'::jsonb) FROM public.migration_privilege_journal jr
   WHERE migration='360' AND object_signature='TABLE public.migration_privilege_journal') IS DISTINCT FROM binding->'journal_revocations' THEN
  RAISE EXCEPTION '360 refuses changed table privilege receipts';END IF;
 IF 'public.migration_privilege_journal_pkey'::regclass::oid IS DISTINCT FROM (binding->>'journal_pk_oid')::oid THEN RAISE EXCEPTION '360 refuses replaced journal PK identity';END IF;
 FOR v_entry IN SELECT key,value FROM jsonb_each(binding->'ri_triggers') LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger tr WHERE tr.oid=v_entry.key::oid AND to_jsonb(tr)=v_entry.value) THEN RAISE EXCEPTION '360 refuses replaced native RI trigger identity';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each(binding->'indexes') LOOP
  IF to_regclass('public.'||v_entry.key)::oid IS DISTINCT FROM (v_entry.value->>'oid')::oid
   OR encode(sha256(convert_to(pg_get_indexdef((v_entry.value->>'oid')::oid),'UTF8')),'hex') IS DISTINCT FROM v_entry.value->>'definition_hash' THEN
   RAISE EXCEPTION '360 refuses changed historical invoice index identity/expression';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each(binding->'columns') LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_attribute ca WHERE ca.attrelid=(v_entry.value->>'relation')::oid AND ca.attnum=(v_entry.value->>'number')::smallint
   AND ca.attname=split_part(v_entry.key,'.',2) AND NOT ca.attisdropped) THEN RAISE EXCEPTION '360 refuses replaced tax column identity';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each_text(binding->'triggers') LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger tr WHERE tr.oid=v_entry.value::oid AND tr.tgname=v_entry.key) THEN RAISE EXCEPTION '360 refuses replaced tax trigger identity';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each_text(binding->'policies') LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_policy pol WHERE pol.oid=v_entry.value::oid AND pol.polname=v_entry.key) THEN RAISE EXCEPTION '360 refuses replaced tax policy identity';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each_text(binding->'constraints') LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_constraint con WHERE con.oid=v_entry.value::oid AND con.conname=v_entry.key) THEN RAISE EXCEPTION '360 refuses replaced tax constraint identity';END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_event_trigger WHERE evtname='subscription_tax_ddl_guard_360' AND oid=(binding->>'event_oid')::oid
  AND evtfoid='public.guard_subscription_tax_ddl_360()'::regprocedure AND evtowner='postgres'::regrole AND evtenabled='O' AND evtevent='ddl_command_end' AND evttags IS NULL) THEN
  RAISE EXCEPTION '360 refuses replaced or disabled event guard';END IF;
 IF EXISTS(SELECT 1 FROM pg_depend dep WHERE dep.refclassid='pg_proc'::regclass AND dep.refobjid IN(SELECT (value->>'oid')::oid FROM jsonb_each(binding->'functions'))
  AND NOT coalesce((dep.classid='pg_trigger'::regclass AND dep.objsubid=0 AND dep.deptype='n'
    AND dep.objid IN(SELECT value::oid FROM jsonb_each_text(binding->'triggers')))
   OR(dep.classid='pg_event_trigger'::regclass AND dep.objid=(binding->>'event_oid')::oid AND dep.objsubid=0 AND dep.deptype='n'),false)) THEN
  RAISE EXCEPTION '360 refuses unknown incoming function dependency';END IF;
 -- TAX360-CUSTODY-END
 -- TAX360-OWNED-SHAPE-BEGIN: deterministic extension shape, never a live-profile capture.
 -- This closes only the owned extension's shape/dependency subset. Historical
 -- OID custody, baseline role/schema profiles and native lifetime fences remain
 -- separate mandatory retirement requirements; comments are not that custody.
 IF EXISTS(SELECT 1 FROM (VALUES ('billing_history','subscription_tax_snapshot','jsonb'),('billing_history','subscription_tax_source_id','uuid'),
  ('subscriptions','subscription_tax_snapshot','jsonb'),('subscriptions','subscription_tax_source_id','uuid')) e(tbl,col,typ)
  LEFT JOIN pg_attribute a ON a.attrelid=('public.'||e.tbl)::regclass AND a.attname=e.col AND a.attnum>0 AND NOT a.attisdropped
  LEFT JOIN pg_type ty ON ty.oid=e.typ::regtype
  WHERE a.attnum IS NULL OR a.atttypid IS DISTINCT FROM ty.oid OR a.atttypmod<>-1 OR a.attndims<>0
   OR a.attnotnull OR a.atthasdef OR a.attidentity<>'' OR a.attgenerated<>'' OR a.atthasmissing OR a.attmissingval IS NOT NULL
   OR NOT a.attislocal OR a.attinhcount<>0 OR a.attcollation<>0 OR a.attacl IS NOT NULL
   OR a.attoptions IS NOT NULL OR a.attfdwoptions IS NOT NULL OR a.attstorage IS DISTINCT FROM ty.typstorage) THEN
  RAISE EXCEPTION '360 refuses changed tax column schema or grants';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES
  ('billing_history','billing_history_tax_writer_360','guard_subscription_tax_new_writer_360',7),
  ('subscriptions','subscriptions_tax_writer_360','guard_subscription_tax_new_writer_360',7),
  ('billing_history','billing_history_tax_source_immutable_360','guard_subscription_tax_rows_360',27),
  ('subscriptions','subscriptions_tax_source_immutable_360','guard_subscription_tax_rows_360',27),
  ('merchant_billing_invoices','merchant_billing_tax_invoice_immutable_360','guard_subscription_tax_invoice_360',31),
  ('billing_history','billing_history_tax_source_truncate_360','guard_subscription_tax_rows_360',34),
  ('subscriptions','subscriptions_tax_source_truncate_360','guard_subscription_tax_rows_360',34),
  ('audit_logs','subscription_tax_audit_immutable_360','guard_subscription_tax_rows_360',27),
  ('audit_logs','subscription_tax_audit_truncate_360','guard_subscription_tax_rows_360',34),
  ('merchant_billing_invoices','merchant_billing_tax_invoice_truncate_360','guard_subscription_tax_invoice_360',34)) e(tbl,trg,fn,mask)
  LEFT JOIN pg_trigger tr ON tr.tgrelid=('public.'||e.tbl)::regclass AND tr.tgname=e.trg
  WHERE tr.oid IS NULL OR tr.tgenabled<>'O' OR tr.tgfoid IS DISTINCT FROM to_regprocedure('public.'||e.fn||'()')
   OR tr.tgtype IS DISTINCT FROM e.mask::smallint OR tr.tgisinternal OR tr.tgparentid<>0
   OR tr.tgconstrrelid<>0 OR tr.tgconstrindid<>0 OR tr.tgconstraint<>0 OR tr.tgdeferrable OR tr.tginitdeferred
   OR tr.tgnargs<>0 OR tr.tgargs<>''::bytea OR tr.tgattr::text<>'' OR tr.tgqual IS NOT NULL
   OR tr.tgoldtable IS NOT NULL OR tr.tgnewtable IS NOT NULL)
  OR (SELECT count(*) FROM pg_trigger WHERE tgfoid IN('public.guard_subscription_tax_new_writer_360()'::regprocedure,
   'public.guard_subscription_tax_rows_360()'::regprocedure,'public.guard_subscription_tax_invoice_360()'::regprocedure))<>10 THEN
  RAISE EXCEPTION '360 refuses changed tax trigger shape';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES ('billing_history','subscription_tax_history_backend_read_360'),
  ('subscriptions','subscription_tax_current_backend_read_360')) e(tbl,policy)
  LEFT JOIN pg_policy pol ON pol.polrelid=('public.'||e.tbl)::regclass AND pol.polname=e.policy
  JOIN pg_class rel ON rel.oid=('public.'||e.tbl)::regclass
  WHERE pol.oid IS NULL OR pol.polcmd<>'r' OR pol.polpermissive OR NOT rel.relrowsecurity
   OR ARRAY(SELECT role_oid FROM unnest(pol.polroles) AS roles(role_oid) ORDER BY role_oid)
    IS DISTINCT FROM ARRAY(SELECT role_oid FROM unnest(ARRAY['anon'::regrole::oid,'authenticated'::regrole::oid,'app_tenant'::regrole::oid]) AS roles(role_oid) ORDER BY role_oid)
   OR pg_get_expr(pol.polqual,pol.polrelid,false) IS DISTINCT FROM '(subscription_tax_snapshot IS NULL)'
   OR pol.polwithcheck IS NOT NULL)
  OR (SELECT count(*) FROM pg_policy WHERE polname IN('subscription_tax_history_backend_read_360','subscription_tax_current_backend_read_360'))<>2 THEN
  RAISE EXCEPTION '360 refuses changed tax policy shape';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES ('billing_history','billing_history_subscription_tax_source_id_fkey'),
  ('subscriptions','subscriptions_subscription_tax_source_id_fkey')) e(tbl,fk)
  LEFT JOIN pg_constraint k ON k.conrelid=('public.'||e.tbl)::regclass AND k.conname=e.fk
  JOIN pg_attribute source_col ON source_col.attrelid=('public.'||e.tbl)::regclass AND source_col.attname='subscription_tax_source_id' AND NOT source_col.attisdropped
  JOIN pg_attribute target_col ON target_col.attrelid='public.billing_history'::regclass AND target_col.attname='id' AND NOT target_col.attisdropped
  WHERE k.oid IS NULL OR k.contype<>'f' OR k.connamespace<>'public'::regnamespace OR k.contypid<>0
   OR k.conkey IS DISTINCT FROM ARRAY[source_col.attnum]::smallint[] OR k.confkey IS DISTINCT FROM ARRAY[target_col.attnum]::smallint[]
   OR k.confrelid<>'public.billing_history'::regclass OR k.condeferrable OR k.condeferred OR NOT k.convalidated
   OR k.confupdtype<>'a' OR k.confdeltype<>'a' OR k.confmatchtype<>'s' OR k.confdelsetcols IS NOT NULL
   OR NOT k.conislocal OR k.coninhcount<>0 OR NOT k.connoinherit OR k.conparentid<>0 OR k.conbin IS NOT NULL OR k.conexclop IS NOT NULL
   OR k.conindid IS DISTINCT FROM (SELECT pk.conindid FROM pg_constraint pk WHERE pk.conrelid='public.billing_history'::regclass AND pk.contype='p' AND pk.conkey=ARRAY[target_col.attnum]::smallint[])
   OR k.conpfeqop IS DISTINCT FROM ARRAY['pg_catalog.=(uuid,uuid)'::regoperator::oid]
   OR k.conppeqop IS DISTINCT FROM ARRAY['pg_catalog.=(uuid,uuid)'::regoperator::oid]
   OR k.conffeqop IS DISTINCT FROM ARRAY['pg_catalog.=(uuid,uuid)'::regoperator::oid]) THEN
  RAISE EXCEPTION '360 refuses changed tax foreign key shape';END IF;
 -- DROP COLUMN can automatically remove constraints/indexes/policies. Refuse
 -- every incoming column dependency except the exact two FKs and two policies
 -- whose complete shapes were checked above. Expression indexes and views are
 -- covered by pg_depend even when their pg_index.indkey entry is zero.
 IF EXISTS(SELECT 1 FROM pg_depend dep
  JOIN pg_attribute col ON dep.refclassid='pg_class'::regclass AND dep.refobjid=col.attrelid AND dep.refobjsubid=col.attnum
  WHERE col.attrelid IN('public.billing_history'::regclass,'public.subscriptions'::regclass)
   AND col.attname IN('subscription_tax_snapshot','subscription_tax_source_id') AND NOT col.attisdropped
   AND NOT coalesce((dep.classid='pg_constraint'::regclass AND dep.objsubid=0 AND dep.deptype='a'
    AND col.attname='subscription_tax_source_id' AND EXISTS(SELECT 1 FROM pg_constraint k WHERE k.oid=dep.objid AND k.conrelid=col.attrelid
     AND k.conname=CASE WHEN col.attrelid='public.billing_history'::regclass THEN 'billing_history_subscription_tax_source_id_fkey' ELSE 'subscriptions_subscription_tax_source_id_fkey' END))
    OR (dep.classid='pg_policy'::regclass AND dep.objsubid=0 AND dep.deptype='n' AND col.attname='subscription_tax_snapshot'
     AND EXISTS(SELECT 1 FROM pg_policy pol WHERE pol.oid=dep.objid AND pol.polrelid=col.attrelid
      AND pol.polname=CASE WHEN col.attrelid='public.billing_history'::regclass THEN 'subscription_tax_history_backend_read_360' ELSE 'subscription_tax_current_backend_read_360' END)),false)) THEN
  RAISE EXCEPTION '360 refuses unknown tax column dependency';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES ('merchant_billing_tax_source_360_uidx'),('merchant_billing_provider_invoice_360_uidx')) e(idx)
  LEFT JOIN pg_class rel ON rel.relnamespace='public'::regnamespace AND rel.relname=e.idx
  LEFT JOIN pg_index ix ON ix.indexrelid=rel.oid
  WHERE rel.oid IS NULL OR rel.relkind<>'i' OR rel.relpersistence<>'p' OR rel.relispartition
   OR rel.relowner IS DISTINCT FROM (SELECT relowner FROM pg_class WHERE oid='public.merchant_billing_invoices'::regclass)
   OR rel.relam IS DISTINCT FROM (SELECT oid FROM pg_am WHERE amname='btree') OR rel.relacl IS NOT NULL OR rel.reloptions IS NOT NULL
   OR ix.indexrelid IS NULL OR ix.indrelid IS DISTINCT FROM 'public.merchant_billing_invoices'::regclass
   OR NOT ix.indisunique OR NOT ix.indisvalid OR NOT ix.indisready OR NOT ix.indislive OR NOT ix.indimmediate
   OR ix.indisprimary OR ix.indisexclusion OR ix.indisclustered OR ix.indisreplident OR ix.indcheckxmin OR ix.indnullsnotdistinct
   OR ix.indnatts<>1 OR ix.indnkeyatts<>1 OR ix.indpred IS NULL
   OR (e.idx='merchant_billing_tax_source_360_uidx' AND (ix.indexprs IS NOT NULL
    OR ix.indkey::text IS DISTINCT FROM (SELECT attnum::text FROM pg_attribute WHERE attrelid='public.merchant_billing_invoices'::regclass AND attname='billing_history_id' AND NOT attisdropped)
    OR ix.indclass::text IS DISTINCT FROM (SELECT op.oid::text FROM pg_opclass op WHERE op.opcnamespace='pg_catalog'::regnamespace AND op.opcmethod=rel.relam AND op.opcname='uuid_ops') OR ix.indcollation::text<>'0'))
   OR (e.idx='merchant_billing_provider_invoice_360_uidx' AND (ix.indexprs IS NULL OR ix.indkey::text<>'0'
    OR ix.indclass::text IS DISTINCT FROM (SELECT op.oid::text FROM pg_opclass op WHERE op.opcnamespace='pg_catalog'::regnamespace AND op.opcmethod=rel.relam AND op.opcname='text_ops')
    OR ix.indcollation::text IS DISTINCT FROM '"default"'::regcollation::oid::text))
   OR ix.indoption::text<>'0') THEN
  RAISE EXCEPTION '360 refuses changed tax index shape';END IF;
 IF EXISTS(SELECT 1 FROM pg_index ix JOIN pg_class ci ON ci.oid=ix.indexrelid
  WHERE ci.relnamespace='public'::regnamespace AND ci.relname IN('merchant_billing_tax_source_360_uidx','merchant_billing_provider_invoice_360_uidx')
   AND ((ci.relname='merchant_billing_tax_source_360_uidx' AND (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce(pg_get_expr(ix.indpred,ix.indrelid,false),''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)) IS DISTINCT FROM (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce('((metadata ->> ''policy_version''::text) = ''D-SUB-TAX-INCLUSIVE-V1''::text)',''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)))
    OR(ci.relname='merchant_billing_provider_invoice_360_uidx' AND ((SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce(pg_get_expr(ix.indpred,ix.indrelid,false),''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)) IS DISTINCT FROM (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce('(((metadata ->> ''policy_version''::text) = ''D-SUB-TAX-INCLUSIVE-V1''::text) AND (metadata ? ''provider_invoice''::text))',''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)) OR (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce(pg_get_expr(ix.indexprs,ix.indrelid,false),''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)) IS DISTINCT FROM (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce('((metadata -> ''provider_invoice''::text) ->> ''invoice_id''::text)',''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)))))) THEN
  RAISE EXCEPTION '360 refuses tax index expression outside canonical source';END IF;
 -- RI trigger names contain generated OIDs; admit functions/relations/masks
 -- from native FK semantics and retain the actual four identities per FK.
 FOR v_entry IN SELECT con.oid,con.conrelid,con.confrelid FROM pg_constraint con
  WHERE con.conrelid IN('public.billing_history'::regclass,'public.subscriptions'::regclass)
   AND con.conname IN('billing_history_subscription_tax_source_id_fkey','subscriptions_subscription_tax_source_id_fkey') LOOP
  IF (SELECT count(*) FROM pg_trigger WHERE tgconstraint=v_entry.oid)<>4 OR EXISTS(
   SELECT 1 FROM(VALUES ('RI_FKey_check_ins',v_entry.conrelid,v_entry.confrelid,5),('RI_FKey_check_upd',v_entry.conrelid,v_entry.confrelid,17),
    ('RI_FKey_noaction_del',v_entry.confrelid,v_entry.conrelid,9),('RI_FKey_noaction_upd',v_entry.confrelid,v_entry.conrelid,17))e(fn,rel,parent,mask)
   LEFT JOIN pg_trigger tr ON tr.tgconstraint=v_entry.oid AND tr.tgrelid=e.rel AND tr.tgfoid=to_regprocedure('pg_catalog.'||quote_ident(e.fn)||'()')
   WHERE tr.oid IS NULL OR NOT tr.tgisinternal OR tr.tgtype IS DISTINCT FROM e.mask::smallint OR tr.tgenabled<>'O' OR tr.tgparentid<>0
    OR tr.tgconstrrelid IS DISTINCT FROM e.parent OR tr.tgdeferrable OR tr.tginitdeferred OR tr.tgnargs<>0 OR tr.tgargs<>''::bytea
    OR tr.tgattr::text<>'' OR tr.tgqual IS NOT NULL OR tr.tgoldtable IS NOT NULL OR tr.tgnewtable IS NOT NULL) THEN
   RAISE EXCEPTION '360 refuses changed native RI trigger profile';END IF;
 END LOOP;
 -- TAX360-OWNED-SHAPE-END
END $g$;
-- This new guard is created inside the locked, previously empty360 allocation.
-- PostgreSQL16 does not fire event triggers for event-trigger DDL itself. Keep
-- this NEW event disabled only while installing its immutable catalog binding;
-- no prior event guard is disabled. Final same-transaction verification requires O.
CREATE EVENT TRIGGER subscription_tax_ddl_guard_360 ON ddl_command_end EXECUTE FUNCTION public.guard_subscription_tax_ddl_360();
ALTER EVENT TRIGGER subscription_tax_ddl_guard_360 DISABLE;
REVOKE ALL ON FUNCTION public.guard_subscription_tax_ddl_360() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.guard_subscription_tax_ddl_360() TO service_role;
DO $birth360$
DECLARE binding jsonb;v_entry record;v_fn pg_proc%ROWTYPE;
BEGIN
 FOR v_entry IN SELECT * FROM(VALUES
('valid_subscription_tax_snapshot_360','public.valid_subscription_tax_snapshot_360(jsonb)','9537560cc154162de305d3ee629ed178e0b17fdaed066ead183bcf82cc3e59a9','boolean',ARRAY['s']::text[],0,NULL,ARRAY['search_path=pg_catalog, public']::text[],'i'),
 ('issue_subscription_tax_invoice_360','public.issue_subscription_tax_invoice_360(uuid,jsonb)','cccc3a7d12c27624ea71febfac57563859203b3cc219013b5d8404a5f07d5d5c','void',ARRAY['p_history','p_evidence']::text[],1,'NULL::jsonb',ARRAY['search_path=pg_catalog, public']::text[],'v'),
 ('read_merchant_subscription_checkout_key_v1','public.read_merchant_subscription_checkout_key_v1(uuid,uuid,text,jsonb)','824e484fbc9dbbf73b56a5c91c17810d955af228d84f1e7ce6bf233870a9bb6b','jsonb',ARRAY['p_actor','p_site','p_key','p_request']::text[],0,NULL,ARRAY['search_path=pg_catalog, public']::text[],'v'),
 ('claim_merchant_subscription_checkout_v1','public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb)','39600a4309adb4aaaa9693cfbcc68f1fdfe24f689b27916e6996f7f9a3be0229','jsonb',ARRAY['p_actor','p_site','p_key','p_request','p_quote']::text[],1,'NULL::jsonb',ARRAY['search_path=pg_catalog, public','letbuyy.subscription_checkout_version=347','letbuyy.subscription_tax_version=360','letbuyy.subscription_tax_writer=claim_merchant_subscription_checkout_v1:360']::text[],'v'),
 ('bind_merchant_subscription_checkout_v1','public.bind_merchant_subscription_checkout_v1(uuid,uuid,uuid,text,text)','6265e6e694d75928f35c49546819beb6646543a54fb0de34858a2d0412f32858','jsonb',ARRAY['p_actor','p_site','p_charge','p_reference','p_short_url']::text[],1,'NULL::text',ARRAY['search_path=pg_catalog, public','letbuyy.subscription_tax_writer=bind_merchant_subscription_checkout_v1:360']::text[],'v'),
 ('read_merchant_subscription_checkout_v1','public.read_merchant_subscription_checkout_v1(uuid,uuid,text,text,text,text)','cdb813ff7bf6da49006c167934a37d3e6592ed5b763c1aa5cba184f28b021757','jsonb',ARRAY['p_actor','p_site','p_reference','p_payment','p_plan_slug','p_period']::text[],0,NULL,ARRAY['search_path=pg_catalog, public']::text[],'v'),
 ('activate_merchant_subscription_v1','public.activate_merchant_subscription_v1(jsonb)','4081a86bc776b45d3d18bfac6bafb898a3e53b01a5dc9f82c84d060eec23af46','jsonb',ARRAY['p_input']::text[],0,NULL,ARRAY['search_path=pg_catalog, public','letbuyy.subscription_checkout_version=347','letbuyy.subscription_tax_version=360','letbuyy.subscription_tax_writer=activate_merchant_subscription_v1:360']::text[],'v'),
 ('record_merchant_subscription_invoice_v1','public.record_merchant_subscription_invoice_v1(jsonb)','629a7d12fa62804e8d1daf66254c9e6a529ceb8a3e20155eb904cbb66a141257','jsonb',ARRAY['p_input']::text[],0,NULL,ARRAY['search_path=pg_catalog, public','letbuyy.subscription_tax_writer=record_merchant_subscription_invoice_v1:360']::text[],'v'),
 ('guard_subscription_tax_new_writer_360','public.guard_subscription_tax_new_writer_360()','7d373a239b507198007890f910d0d032877e9916cd9a2445d74790155ad9a34d','trigger',NULL::text[],0,NULL,ARRAY['search_path=pg_catalog, public']::text[],'v'),
 ('guard_subscription_tax_rows_360','public.guard_subscription_tax_rows_360()','fd9451b9ee74e588afc309ef76a7b6e5c8f1cab10f6092e43082427a4fe84fde','trigger',NULL::text[],0,NULL,ARRAY['search_path=pg_catalog, public']::text[],'v'),
 ('record_merchant_subscription_failure_v1','public.record_merchant_subscription_failure_v1(jsonb)','41557ea0c2fb67180c4ab190299027af1da5dac89e3e5485900b9110840c8fc4','jsonb',ARRAY['p_input']::text[],0,NULL,ARRAY['search_path=pg_catalog, public','letbuyy.subscription_tax_writer=record_merchant_subscription_failure_v1:360']::text[],'v'),
 ('guard_subscription_tax_invoice_360','public.guard_subscription_tax_invoice_360()','a9ab7af21d56248b05a3af4e886b3f6b14b8d247a7b002aa1421ee3c632416b4','trigger',NULL::text[],0,NULL,ARRAY['search_path=pg_catalog, public']::text[],'v'),
 ('sync_merchant_subscription_state_v1','public.sync_merchant_subscription_state_v1(jsonb)','57d1f8b73a6722611bbd86988643d76d1aadddeb44425e1b9b1a32407ffe7996','jsonb',ARRAY['p_input']::text[],0,NULL,ARRAY['search_path=pg_catalog, public','letbuyy.subscription_tax_version=360']::text[],'v')
 )e(name,signature,body_hash,result_type,arg_names,default_count,default_expr,configs,volatility) LOOP
 SELECT * INTO v_fn FROM pg_proc WHERE oid=to_regprocedure(v_entry.signature);
 IF v_fn.oid IS NULL OR v_fn.proowner<>'postgres'::regrole OR v_fn.proargnames IS DISTINCT FROM v_entry.arg_names OR v_fn.pronargdefaults IS DISTINCT FROM v_entry.default_count
  OR pg_get_expr(v_fn.proargdefaults,0) IS DISTINCT FROM v_entry.default_expr OR v_fn.proconfig IS DISTINCT FROM v_entry.configs
  OR v_fn.prorettype IS DISTINCT FROM v_entry.result_type::regtype OR v_fn.provolatile IS DISTINCT FROM v_entry.volatility::"char"
  OR encode(sha256(convert_to(v_fn.prosrc,'UTF8')),'hex') IS DISTINCT FROM v_entry.body_hash
  OR v_fn.prokind<>'f' OR v_fn.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql') OR v_fn.prosecdef OR v_fn.proretset OR v_fn.proisstrict
  OR v_fn.proleakproof OR v_fn.proparallel<>'u' OR v_fn.prosupport<>0 OR v_fn.provariadic<>0 OR v_fn.proargmodes IS NOT NULL OR v_fn.proallargtypes IS NOT NULL
  OR v_fn.procost<>100 OR v_fn.prorows<>0 OR v_fn.probin IS NOT NULL
  OR has_function_privilege('anon',v_fn.oid,'EXECUTE') OR has_function_privilege('authenticated',v_fn.oid,'EXECUTE') OR has_function_privilege('app_tenant',v_fn.oid,'EXECUTE')
  OR NOT has_function_privilege('service_role',v_fn.oid,'EXECUTE') OR has_function_privilege('service_role',v_fn.oid,'EXECUTE WITH GRANT OPTION')
  OR EXISTS(SELECT 1 FROM aclexplode(coalesce(v_fn.proacl,acldefault('f',v_fn.proowner)))acl WHERE acl.grantee NOT IN(v_fn.proowner,'service_role'::regrole) OR acl.privilege_type<>'EXECUTE') THEN
  RAISE EXCEPTION '360 refuses family outside source-derived ABI/body/default/owner/grants: %',v_entry.name;END IF;
 END LOOP;

 -- TAX360-OWNED-SHAPE-BEGIN: deterministic extension shape, never a live-profile capture.
 -- This closes only the owned extension's shape/dependency subset. Historical
 -- OID custody, baseline role/schema profiles and native lifetime fences remain
 -- separate mandatory retirement requirements; comments are not that custody.
 IF EXISTS(SELECT 1 FROM (VALUES ('billing_history','subscription_tax_snapshot','jsonb'),('billing_history','subscription_tax_source_id','uuid'),
  ('subscriptions','subscription_tax_snapshot','jsonb'),('subscriptions','subscription_tax_source_id','uuid')) e(tbl,col,typ)
  LEFT JOIN pg_attribute a ON a.attrelid=('public.'||e.tbl)::regclass AND a.attname=e.col AND a.attnum>0 AND NOT a.attisdropped
  LEFT JOIN pg_type ty ON ty.oid=e.typ::regtype
  WHERE a.attnum IS NULL OR a.atttypid IS DISTINCT FROM ty.oid OR a.atttypmod<>-1 OR a.attndims<>0
   OR a.attnotnull OR a.atthasdef OR a.attidentity<>'' OR a.attgenerated<>'' OR a.atthasmissing OR a.attmissingval IS NOT NULL
   OR NOT a.attislocal OR a.attinhcount<>0 OR a.attcollation<>0 OR a.attacl IS NOT NULL
   OR a.attoptions IS NOT NULL OR a.attfdwoptions IS NOT NULL OR a.attstorage IS DISTINCT FROM ty.typstorage) THEN
  RAISE EXCEPTION '360 refuses changed tax column schema or grants';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES
  ('billing_history','billing_history_tax_writer_360','guard_subscription_tax_new_writer_360',7),
  ('subscriptions','subscriptions_tax_writer_360','guard_subscription_tax_new_writer_360',7),
  ('billing_history','billing_history_tax_source_immutable_360','guard_subscription_tax_rows_360',27),
  ('subscriptions','subscriptions_tax_source_immutable_360','guard_subscription_tax_rows_360',27),
  ('merchant_billing_invoices','merchant_billing_tax_invoice_immutable_360','guard_subscription_tax_invoice_360',31),
  ('billing_history','billing_history_tax_source_truncate_360','guard_subscription_tax_rows_360',34),
  ('subscriptions','subscriptions_tax_source_truncate_360','guard_subscription_tax_rows_360',34),
  ('audit_logs','subscription_tax_audit_immutable_360','guard_subscription_tax_rows_360',27),
  ('audit_logs','subscription_tax_audit_truncate_360','guard_subscription_tax_rows_360',34),
  ('merchant_billing_invoices','merchant_billing_tax_invoice_truncate_360','guard_subscription_tax_invoice_360',34)) e(tbl,trg,fn,mask)
  LEFT JOIN pg_trigger tr ON tr.tgrelid=('public.'||e.tbl)::regclass AND tr.tgname=e.trg
  WHERE tr.oid IS NULL OR tr.tgenabled<>'O' OR tr.tgfoid IS DISTINCT FROM to_regprocedure('public.'||e.fn||'()')
   OR tr.tgtype IS DISTINCT FROM e.mask::smallint OR tr.tgisinternal OR tr.tgparentid<>0
   OR tr.tgconstrrelid<>0 OR tr.tgconstrindid<>0 OR tr.tgconstraint<>0 OR tr.tgdeferrable OR tr.tginitdeferred
   OR tr.tgnargs<>0 OR tr.tgargs<>''::bytea OR tr.tgattr::text<>'' OR tr.tgqual IS NOT NULL
   OR tr.tgoldtable IS NOT NULL OR tr.tgnewtable IS NOT NULL)
  OR (SELECT count(*) FROM pg_trigger WHERE tgfoid IN('public.guard_subscription_tax_new_writer_360()'::regprocedure,
   'public.guard_subscription_tax_rows_360()'::regprocedure,'public.guard_subscription_tax_invoice_360()'::regprocedure))<>10 THEN
  RAISE EXCEPTION '360 refuses changed tax trigger shape';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES ('billing_history','subscription_tax_history_backend_read_360'),
  ('subscriptions','subscription_tax_current_backend_read_360')) e(tbl,policy)
  LEFT JOIN pg_policy pol ON pol.polrelid=('public.'||e.tbl)::regclass AND pol.polname=e.policy
  JOIN pg_class rel ON rel.oid=('public.'||e.tbl)::regclass
  WHERE pol.oid IS NULL OR pol.polcmd<>'r' OR pol.polpermissive OR NOT rel.relrowsecurity
   OR ARRAY(SELECT role_oid FROM unnest(pol.polroles) AS roles(role_oid) ORDER BY role_oid)
    IS DISTINCT FROM ARRAY(SELECT role_oid FROM unnest(ARRAY['anon'::regrole::oid,'authenticated'::regrole::oid,'app_tenant'::regrole::oid]) AS roles(role_oid) ORDER BY role_oid)
   OR pg_get_expr(pol.polqual,pol.polrelid,false) IS DISTINCT FROM '(subscription_tax_snapshot IS NULL)'
   OR pol.polwithcheck IS NOT NULL)
  OR (SELECT count(*) FROM pg_policy WHERE polname IN('subscription_tax_history_backend_read_360','subscription_tax_current_backend_read_360'))<>2 THEN
  RAISE EXCEPTION '360 refuses changed tax policy shape';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES ('billing_history','billing_history_subscription_tax_source_id_fkey'),
  ('subscriptions','subscriptions_subscription_tax_source_id_fkey')) e(tbl,fk)
  LEFT JOIN pg_constraint k ON k.conrelid=('public.'||e.tbl)::regclass AND k.conname=e.fk
  JOIN pg_attribute source_col ON source_col.attrelid=('public.'||e.tbl)::regclass AND source_col.attname='subscription_tax_source_id' AND NOT source_col.attisdropped
  JOIN pg_attribute target_col ON target_col.attrelid='public.billing_history'::regclass AND target_col.attname='id' AND NOT target_col.attisdropped
  WHERE k.oid IS NULL OR k.contype<>'f' OR k.connamespace<>'public'::regnamespace OR k.contypid<>0
   OR k.conkey IS DISTINCT FROM ARRAY[source_col.attnum]::smallint[] OR k.confkey IS DISTINCT FROM ARRAY[target_col.attnum]::smallint[]
   OR k.confrelid<>'public.billing_history'::regclass OR k.condeferrable OR k.condeferred OR NOT k.convalidated
   OR k.confupdtype<>'a' OR k.confdeltype<>'a' OR k.confmatchtype<>'s' OR k.confdelsetcols IS NOT NULL
   OR NOT k.conislocal OR k.coninhcount<>0 OR NOT k.connoinherit OR k.conparentid<>0 OR k.conbin IS NOT NULL OR k.conexclop IS NOT NULL
   OR k.conindid IS DISTINCT FROM (SELECT pk.conindid FROM pg_constraint pk WHERE pk.conrelid='public.billing_history'::regclass AND pk.contype='p' AND pk.conkey=ARRAY[target_col.attnum]::smallint[])
   OR k.conpfeqop IS DISTINCT FROM ARRAY['pg_catalog.=(uuid,uuid)'::regoperator::oid]
   OR k.conppeqop IS DISTINCT FROM ARRAY['pg_catalog.=(uuid,uuid)'::regoperator::oid]
   OR k.conffeqop IS DISTINCT FROM ARRAY['pg_catalog.=(uuid,uuid)'::regoperator::oid]) THEN
  RAISE EXCEPTION '360 refuses changed tax foreign key shape';END IF;
 -- DROP COLUMN can automatically remove constraints/indexes/policies. Refuse
 -- every incoming column dependency except the exact two FKs and two policies
 -- whose complete shapes were checked above. Expression indexes and views are
 -- covered by pg_depend even when their pg_index.indkey entry is zero.
 IF EXISTS(SELECT 1 FROM pg_depend dep
  JOIN pg_attribute col ON dep.refclassid='pg_class'::regclass AND dep.refobjid=col.attrelid AND dep.refobjsubid=col.attnum
  WHERE col.attrelid IN('public.billing_history'::regclass,'public.subscriptions'::regclass)
   AND col.attname IN('subscription_tax_snapshot','subscription_tax_source_id') AND NOT col.attisdropped
   AND NOT coalesce((dep.classid='pg_constraint'::regclass AND dep.objsubid=0 AND dep.deptype='a'
    AND col.attname='subscription_tax_source_id' AND EXISTS(SELECT 1 FROM pg_constraint k WHERE k.oid=dep.objid AND k.conrelid=col.attrelid
     AND k.conname=CASE WHEN col.attrelid='public.billing_history'::regclass THEN 'billing_history_subscription_tax_source_id_fkey' ELSE 'subscriptions_subscription_tax_source_id_fkey' END))
    OR (dep.classid='pg_policy'::regclass AND dep.objsubid=0 AND dep.deptype='n' AND col.attname='subscription_tax_snapshot'
     AND EXISTS(SELECT 1 FROM pg_policy pol WHERE pol.oid=dep.objid AND pol.polrelid=col.attrelid
      AND pol.polname=CASE WHEN col.attrelid='public.billing_history'::regclass THEN 'subscription_tax_history_backend_read_360' ELSE 'subscription_tax_current_backend_read_360' END)),false)) THEN
  RAISE EXCEPTION '360 refuses unknown tax column dependency';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES ('merchant_billing_tax_source_360_uidx'),('merchant_billing_provider_invoice_360_uidx')) e(idx)
  LEFT JOIN pg_class rel ON rel.relnamespace='public'::regnamespace AND rel.relname=e.idx
  LEFT JOIN pg_index ix ON ix.indexrelid=rel.oid
  WHERE rel.oid IS NULL OR rel.relkind<>'i' OR rel.relpersistence<>'p' OR rel.relispartition
   OR rel.relowner IS DISTINCT FROM (SELECT relowner FROM pg_class WHERE oid='public.merchant_billing_invoices'::regclass)
   OR rel.relam IS DISTINCT FROM (SELECT oid FROM pg_am WHERE amname='btree') OR rel.relacl IS NOT NULL OR rel.reloptions IS NOT NULL
   OR ix.indexrelid IS NULL OR ix.indrelid IS DISTINCT FROM 'public.merchant_billing_invoices'::regclass
   OR NOT ix.indisunique OR NOT ix.indisvalid OR NOT ix.indisready OR NOT ix.indislive OR NOT ix.indimmediate
   OR ix.indisprimary OR ix.indisexclusion OR ix.indisclustered OR ix.indisreplident OR ix.indcheckxmin OR ix.indnullsnotdistinct
   OR ix.indnatts<>1 OR ix.indnkeyatts<>1 OR ix.indpred IS NULL
   OR (e.idx='merchant_billing_tax_source_360_uidx' AND (ix.indexprs IS NOT NULL
    OR ix.indkey::text IS DISTINCT FROM (SELECT attnum::text FROM pg_attribute WHERE attrelid='public.merchant_billing_invoices'::regclass AND attname='billing_history_id' AND NOT attisdropped)
    OR ix.indclass::text IS DISTINCT FROM (SELECT op.oid::text FROM pg_opclass op WHERE op.opcnamespace='pg_catalog'::regnamespace AND op.opcmethod=rel.relam AND op.opcname='uuid_ops') OR ix.indcollation::text<>'0'))
   OR (e.idx='merchant_billing_provider_invoice_360_uidx' AND (ix.indexprs IS NULL OR ix.indkey::text<>'0'
    OR ix.indclass::text IS DISTINCT FROM (SELECT op.oid::text FROM pg_opclass op WHERE op.opcnamespace='pg_catalog'::regnamespace AND op.opcmethod=rel.relam AND op.opcname='text_ops')
    OR ix.indcollation::text IS DISTINCT FROM '"default"'::regcollation::oid::text))
   OR ix.indoption::text<>'0') THEN
  RAISE EXCEPTION '360 refuses changed tax index shape';END IF;
 IF EXISTS(SELECT 1 FROM pg_index ix JOIN pg_class ci ON ci.oid=ix.indexrelid
  WHERE ci.relnamespace='public'::regnamespace AND ci.relname IN('merchant_billing_tax_source_360_uidx','merchant_billing_provider_invoice_360_uidx')
   AND ((ci.relname='merchant_billing_tax_source_360_uidx' AND (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce(pg_get_expr(ix.indpred,ix.indrelid,false),''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)) IS DISTINCT FROM (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce('((metadata ->> ''policy_version''::text) = ''D-SUB-TAX-INCLUSIVE-V1''::text)',''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)))
    OR(ci.relname='merchant_billing_provider_invoice_360_uidx' AND ((SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce(pg_get_expr(ix.indpred,ix.indrelid,false),''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)) IS DISTINCT FROM (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce('(((metadata ->> ''policy_version''::text) = ''D-SUB-TAX-INCLUSIVE-V1''::text) AND (metadata ? ''provider_invoice''::text))',''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)) OR (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce(pg_get_expr(ix.indexprs,ix.indrelid,false),''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)) IS DISTINCT FROM (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce('((metadata -> ''provider_invoice''::text) ->> ''invoice_id''::text)',''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)))))) THEN
  RAISE EXCEPTION '360 refuses tax index expression outside canonical source';END IF;
 -- RI trigger names contain generated OIDs; admit functions/relations/masks
 -- from native FK semantics and retain the actual four identities per FK.
 FOR v_entry IN SELECT con.oid,con.conrelid,con.confrelid FROM pg_constraint con
  WHERE con.conrelid IN('public.billing_history'::regclass,'public.subscriptions'::regclass)
   AND con.conname IN('billing_history_subscription_tax_source_id_fkey','subscriptions_subscription_tax_source_id_fkey') LOOP
  IF (SELECT count(*) FROM pg_trigger WHERE tgconstraint=v_entry.oid)<>4 OR EXISTS(
   SELECT 1 FROM(VALUES ('RI_FKey_check_ins',v_entry.conrelid,v_entry.confrelid,5),('RI_FKey_check_upd',v_entry.conrelid,v_entry.confrelid,17),
    ('RI_FKey_noaction_del',v_entry.confrelid,v_entry.conrelid,9),('RI_FKey_noaction_upd',v_entry.confrelid,v_entry.conrelid,17))e(fn,rel,parent,mask)
   LEFT JOIN pg_trigger tr ON tr.tgconstraint=v_entry.oid AND tr.tgrelid=e.rel AND tr.tgfoid=to_regprocedure('pg_catalog.'||quote_ident(e.fn)||'()')
   WHERE tr.oid IS NULL OR NOT tr.tgisinternal OR tr.tgtype IS DISTINCT FROM e.mask::smallint OR tr.tgenabled<>'O' OR tr.tgparentid<>0
    OR tr.tgconstrrelid IS DISTINCT FROM e.parent OR tr.tgdeferrable OR tr.tginitdeferred OR tr.tgnargs<>0 OR tr.tgargs<>''::bytea
    OR tr.tgattr::text<>'' OR tr.tgqual IS NOT NULL OR tr.tgoldtable IS NOT NULL OR tr.tgnewtable IS NOT NULL) THEN
   RAISE EXCEPTION '360 refuses changed native RI trigger profile';END IF;
 END LOOP;
 -- TAX360-OWNED-SHAPE-END
 binding:=jsonb_build_object('schema_version',1,'namespace_oid','public'::regnamespace::oid,
  'event_oid',(SELECT oid FROM pg_event_trigger WHERE evtname='subscription_tax_ddl_guard_360'),
  'journal_pk_oid','public.migration_privilege_journal_pkey'::regclass::oid,
  'ri_triggers',(SELECT jsonb_object_agg(tr.oid::text,to_jsonb(tr)) FROM pg_trigger tr JOIN pg_constraint con ON con.oid=tr.tgconstraint WHERE con.conrelid IN('public.billing_history'::regclass,'public.subscriptions'::regclass) AND con.conname IN('billing_history_subscription_tax_source_id_fkey','subscriptions_subscription_tax_source_id_fkey')),
  'roles',(SELECT jsonb_object_agg(rolname,oid) FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','app_tenant','service_role')),
  'relations',(SELECT jsonb_object_agg(name,to_regclass(name)::oid) FROM unnest(ARRAY['public.sites','public.billing_history','public.subscriptions','public.merchant_billing_invoices','public.audit_logs','public.migration_privilege_journal'])name),
  'functions',(SELECT jsonb_object_agg('public.'||quote_ident(p.proname)||'('||oidvectortypes(p.proargtypes)||')',jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl::text,
   'body_hash',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
   'definition_hash',CASE WHEN p.proname='guard_subscription_tax_ddl_360' THEN NULL ELSE encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') END,
   'previous_comment',obj_description(p.oid,'pg_proc'))) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN('valid_subscription_tax_snapshot_360','issue_subscription_tax_invoice_360','read_merchant_subscription_checkout_key_v1','claim_merchant_subscription_checkout_v1','bind_merchant_subscription_checkout_v1','read_merchant_subscription_checkout_v1','activate_merchant_subscription_v1','record_merchant_subscription_invoice_v1','guard_subscription_tax_new_writer_360','guard_subscription_tax_rows_360','record_merchant_subscription_failure_v1','guard_subscription_tax_invoice_360','sync_merchant_subscription_state_v1','guard_subscription_tax_ddl_360')),
  'indexes',(SELECT jsonb_object_agg(c.relname,jsonb_build_object('oid',c.oid,'definition_hash',encode(sha256(convert_to(pg_get_indexdef(c.oid),'UTF8')),'hex'))) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname IN('merchant_billing_tax_source_360_uidx','merchant_billing_provider_invoice_360_uidx')),
  'columns',(SELECT jsonb_object_agg(c.relname||'.'||ca.attname,jsonb_build_object('relation',c.oid,'number',ca.attnum)) FROM pg_attribute ca JOIN pg_class c ON c.oid=ca.attrelid WHERE c.oid IN('public.billing_history'::regclass,'public.subscriptions'::regclass) AND ca.attname IN('subscription_tax_source_id','subscription_tax_snapshot') AND NOT ca.attisdropped),
  'triggers',(SELECT jsonb_object_agg(tgname,oid) FROM pg_trigger WHERE tgfoid IN('public.guard_subscription_tax_new_writer_360()'::regprocedure,'public.guard_subscription_tax_rows_360()'::regprocedure,'public.guard_subscription_tax_invoice_360()'::regprocedure)),
  'policies',(SELECT jsonb_object_agg(polname,oid) FROM pg_policy WHERE polname IN('subscription_tax_history_backend_read_360','subscription_tax_current_backend_read_360')),
  'constraints',(SELECT jsonb_object_agg(conname,oid) FROM pg_constraint WHERE conrelid IN('public.billing_history'::regclass,'public.subscriptions'::regclass) AND conname IN('billing_history_subscription_tax_source_id_fkey','subscriptions_subscription_tax_source_id_fkey')),
  'journal_revocations',(SELECT coalesce(jsonb_agg(to_jsonb(jr) ORDER BY privilege),'[]'::jsonb) FROM public.migration_privilege_journal jr WHERE migration='360' AND object_signature='TABLE public.migration_privilege_journal'));
 EXECUTE format('ALTER FUNCTION public.guard_subscription_tax_ddl_360() SET letbuyy.subscription_tax_birth_bindings=%L',binding::text);
END $birth360$;
-- An actual private EXECUTE grant delta, after explicit reset; the canonical
-- receipt binds its own historical OID/owner/full definition and catalog SET.
INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 SELECT '360','public.guard_subscription_tax_ddl_360()','service_role','EXECUTE','granted',oid,proowner,
  encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex') FROM pg_proc WHERE oid='public.guard_subscription_tax_ddl_360()'::regprocedure;
ALTER EVENT TRIGGER subscription_tax_ddl_guard_360 ENABLE;
DO $verify360$
DECLARE binding jsonb;v_entry record;v_fn pg_proc%ROWTYPE;v_journal public.migration_privilege_journal%ROWTYPE;
BEGIN
 -- TAX360-CUSTODY-BEGIN: private actual grant receipt binds this verifier,
 -- including its catalog SET birth identities. Comments are cosmetic only.
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('anon','authenticated','app_tenant') AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolcanlogin OR NOT rolinherit))
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND rolbypassrls AND NOT rolcanlogin AND rolinherit)
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres' AND rolsuper)
  OR EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.roleid IN('service_role'::regrole,'anon'::regrole,'authenticated'::regrole,'app_tenant'::regrole)
   AND NOT((m.roleid='app_tenant'::regrole AND m.member IN('postgres'::regrole,'service_role'::regrole) AND NOT m.admin_option AND m.inherit_option AND m.set_option)
    OR(m.member=to_regrole('authenticator') AND m.roleid IN('anon'::regrole,'authenticated'::regrole,'service_role'::regrole) AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option)))
  OR EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member IN('anon'::regrole,'authenticated'::regrole,'app_tenant'::regrole,'service_role'::regrole)
   AND NOT(m.member='service_role'::regrole AND m.roleid='app_tenant'::regrole AND NOT m.admin_option AND m.inherit_option AND m.set_option)) THEN
  RAISE EXCEPTION '360 refuses unknown critical role or membership profile';END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator' AND (NOT rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION '360 refuses changed authenticator profile';END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant','service_role'])role WHERE has_schema_privilege(role,'public','CREATE')) THEN RAISE EXCEPTION '360 refuses untrusted public CREATE';END IF;

 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.migration_privilege_journal'::regclass AND relkind='r' AND relpersistence='p'
  AND relowner='postgres'::regrole AND relrowsecurity AND relforcerowsecurity AND NOT relispartition AND relreplident='d' AND reloptions IS NULL AND reltablespace=0)
  OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid='public.migration_privilege_journal'::regclass OR inhparent='public.migration_privilege_journal'::regclass)
  OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class='public.migration_privilege_journal'::regclass)
  OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.migration_privilege_journal'::regclass)
  OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.migration_privilege_journal'::regclass) THEN RAISE EXCEPTION '360 refuses unknown private journal relation profile';END IF;
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.migration_privilege_journal'::regclass AND attnum>0)<>9 OR EXISTS(
  SELECT 1 FROM(VALUES (1,'migration','text',true,NULL),
 (2,'object_signature','text',true,NULL),
 (3,'grantee','text',true,NULL),
 (4,'privilege','text',true,NULL),
 (5,'action','text',true,NULL),
 (6,'recorded_at','timestamptz',true,'now()'),
 (7,'object_oid','oid',false,NULL),
 (8,'object_owner','oid',false,NULL),
 (9,'object_definition_hash','text',false,NULL))e(num,name,typ,required,def)
  LEFT JOIN pg_attribute ca ON ca.attrelid='public.migration_privilege_journal'::regclass AND ca.attnum=e.num
  LEFT JOIN pg_attrdef df ON df.adrelid=ca.attrelid AND df.adnum=ca.attnum
  WHERE ca.attname IS DISTINCT FROM e.name OR ca.atttypid IS DISTINCT FROM e.typ::regtype OR ca.attnotnull IS DISTINCT FROM e.required
   OR ca.atttypmod<>-1 OR ca.attisdropped OR ca.attidentity<>'' OR ca.attgenerated<>'' OR ca.atthasmissing OR ca.attmissingval IS NOT NULL
   OR ca.attndims<>0 OR NOT ca.attislocal OR ca.attinhcount<>0 OR ca.attacl IS NOT NULL OR ca.attoptions IS NOT NULL OR ca.attfdwoptions IS NOT NULL
   OR ca.attstorage IS DISTINCT FROM(SELECT typstorage FROM pg_type WHERE oid=e.typ::regtype)
   OR ca.attcollation IS DISTINCT FROM CASE WHEN e.typ='text' THEN 'pg_catalog.default'::regcollation::oid ELSE 0::oid END
   OR pg_get_expr(df.adbin,df.adrelid,false) IS DISTINCT FROM e.def) THEN RAISE EXCEPTION '360 refuses changed private journal columns/defaults/grants';END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.migration_privilege_journal'::regclass)<>2
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.migration_privilege_journal'::regclass AND conname='migration_privilege_journal_pkey'
   AND contype='p' AND conkey=ARRAY[1,2,3,4,5]::smallint[] AND NOT condeferrable AND NOT condeferred AND convalidated AND conislocal AND coninhcount=0 AND conparentid=0)
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.migration_privilege_journal'::regclass AND conname='migration_privilege_journal_action_check'
   AND contype='c' AND convalidated AND NOT condeferrable AND NOT condeferred
   AND pg_get_constraintdef(oid,false)='CHECK ((action = ANY (ARRAY[''revoked''::text, ''granted''::text])))') THEN RAISE EXCEPTION '360 refuses changed private journal constraints';END IF;
 IF (SELECT count(*) FROM pg_index WHERE indrelid='public.migration_privilege_journal'::regclass)<>1 OR NOT EXISTS(
  SELECT 1 FROM pg_index ix JOIN pg_class ci ON ci.oid=ix.indexrelid JOIN pg_constraint co ON co.conindid=ix.indexrelid AND co.conrelid=ix.indrelid AND co.contype='p'
  WHERE ix.indrelid='public.migration_privilege_journal'::regclass AND ci.relnamespace='public'::regnamespace AND ci.relname='migration_privilege_journal_pkey'
   AND ci.relkind='i' AND ci.relpersistence='p' AND ci.relowner='postgres'::regrole AND ci.relacl IS NULL AND ci.reloptions IS NULL AND ci.reltablespace=0 AND NOT ci.relispartition
   AND ci.relam=(SELECT oid FROM pg_am WHERE amname='btree') AND ix.indnatts=5 AND ix.indnkeyatts=5 AND ix.indkey::text='1 2 3 4 5'
   AND ix.indisunique AND ix.indisprimary AND ix.indisvalid AND ix.indisready AND ix.indislive AND ix.indimmediate AND NOT ix.indnullsnotdistinct
   AND NOT ix.indisexclusion AND NOT ix.indisclustered AND NOT ix.indisreplident AND NOT ix.indcheckxmin AND ix.indexprs IS NULL AND ix.indpred IS NULL
   AND ix.indoption::text='0 0 0 0 0'
   AND ARRAY(SELECT x FROM unnest(ix.indclass::oid[])x)=array_fill((SELECT oid FROM pg_opclass WHERE opcnamespace='pg_catalog'::regnamespace AND opcname='text_ops' AND opcmethod=ci.relam AND opcdefault),ARRAY[5])
   AND ARRAY(SELECT x FROM unnest(ix.indcollation::oid[])x)=array_fill('pg_catalog.default'::regcollation::oid,ARRAY[5])) THEN
  RAISE EXCEPTION '360 refuses changed private journal PK index profile';END IF;
 IF NOT has_table_privilege('service_role','public.migration_privilege_journal','SELECT')
  OR has_table_privilege('service_role','public.migration_privilege_journal','SELECT WITH GRANT OPTION')
  OR EXISTS(SELECT 1 FROM aclexplode(coalesce((SELECT relacl FROM pg_class WHERE oid='public.migration_privilege_journal'::regclass),acldefault('r','postgres'::regrole)))acl
   WHERE acl.grantee NOT IN('postgres'::regrole,'service_role'::regrole) OR acl.grantor<>'postgres'::regrole OR (acl.grantee='service_role'::regrole AND acl.is_grantable)) THEN
  RAISE EXCEPTION '360 refuses unknown private journal ACL/grant options';END IF;

 IF EXISTS(SELECT 1 FROM unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])priv WHERE has_table_privilege('service_role','public.migration_privilege_journal',priv))
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant'])role WHERE has_table_privilege(role,'public.migration_privilege_journal','SELECT')) THEN
  RAISE EXCEPTION '360 refuses writable or untrusted custody receipts';END IF;

 SELECT * INTO v_fn FROM pg_proc WHERE oid=to_regprocedure('public.guard_subscription_tax_ddl_360()');
 SELECT * INTO v_journal FROM public.migration_privilege_journal WHERE migration='360' AND object_signature='public.guard_subscription_tax_ddl_360()'
  AND grantee='service_role' AND privilege='EXECUTE' AND action='granted';
 IF v_fn.oid IS NULL OR v_journal.object_oid IS DISTINCT FROM v_fn.oid OR v_journal.object_owner IS DISTINCT FROM v_fn.proowner
  OR v_journal.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex') THEN
  RAISE EXCEPTION '360 refuses changed historical custody verifier identity or definition';END IF;
 SELECT substring(config from length('letbuyy.subscription_tax_birth_bindings=')+1)::jsonb INTO binding FROM unnest(v_fn.proconfig)config
  WHERE starts_with(config,'letbuyy.subscription_tax_birth_bindings=');
 IF jsonb_typeof(binding) IS DISTINCT FROM 'object' OR binding->>'schema_version' IS DISTINCT FROM '1'
  OR (SELECT count(*) FROM jsonb_each(binding->'functions'))<>14 THEN RAISE EXCEPTION '360 refuses missing or incomplete birth bindings';END IF;
 IF 'public'::regnamespace::oid IS DISTINCT FROM (binding->>'namespace_oid')::oid THEN RAISE EXCEPTION '360 refuses changed namespace identity';END IF;
 FOR v_entry IN SELECT key,value FROM jsonb_each_text(binding->'roles') LOOP
  IF to_regrole(v_entry.key)::oid IS DISTINCT FROM v_entry.value::oid THEN RAISE EXCEPTION '360 refuses changed critical role identity';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each_text(binding->'relations') LOOP
  IF to_regclass(v_entry.key)::oid IS DISTINCT FROM v_entry.value::oid THEN RAISE EXCEPTION '360 refuses changed parent relation identity';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each(binding->'functions') LOOP
  SELECT * INTO v_fn FROM pg_proc WHERE oid=to_regprocedure(v_entry.key);
  IF v_fn.oid IS NULL OR v_fn.oid IS DISTINCT FROM (v_entry.value->>'oid')::oid OR v_fn.proowner IS DISTINCT FROM (v_entry.value->>'owner')::oid
   OR v_fn.proacl::text IS DISTINCT FROM v_entry.value->>'acl' OR v_fn.proowner<>'postgres'::regrole
   OR encode(sha256(convert_to(v_fn.prosrc,'UTF8')),'hex') IS DISTINCT FROM v_entry.value->>'body_hash'
   OR (v_entry.key<>'public.guard_subscription_tax_ddl_360()' AND encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex') IS DISTINCT FROM v_entry.value->>'definition_hash')
   OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=v_fn.proname)<>1
   OR v_fn.prokind<>'f' OR v_fn.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql') OR v_fn.prosecdef OR v_fn.proretset OR v_fn.proisstrict
   OR v_fn.proleakproof OR v_fn.proparallel<>'u' OR v_fn.prosupport<>0 OR v_fn.provariadic<>0 OR v_fn.proargmodes IS NOT NULL OR v_fn.proallargtypes IS NOT NULL
   OR NOT has_function_privilege('service_role',v_fn.oid,'EXECUTE') OR has_function_privilege('service_role',v_fn.oid,'EXECUTE WITH GRANT OPTION')
   OR has_function_privilege('anon',v_fn.oid,'EXECUTE') OR has_function_privilege('authenticated',v_fn.oid,'EXECUTE') OR has_function_privilege('app_tenant',v_fn.oid,'EXECUTE')
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(v_fn.proacl,acldefault('f',v_fn.proowner)))acl WHERE acl.grantee NOT IN(v_fn.proowner,'service_role'::regrole) OR acl.privilege_type<>'EXECUTE') THEN
   RAISE EXCEPTION '360 refuses changed known function source/ABI/owner/grants/history: %',v_entry.key;END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.migration_privilege_journal WHERE migration='360')<>jsonb_array_length(binding->'journal_revocations')+1
  OR (SELECT coalesce(jsonb_agg(to_jsonb(jr) ORDER BY privilege),'[]'::jsonb) FROM public.migration_privilege_journal jr
   WHERE migration='360' AND object_signature='TABLE public.migration_privilege_journal') IS DISTINCT FROM binding->'journal_revocations' THEN
  RAISE EXCEPTION '360 refuses changed table privilege receipts';END IF;
 IF 'public.migration_privilege_journal_pkey'::regclass::oid IS DISTINCT FROM (binding->>'journal_pk_oid')::oid THEN RAISE EXCEPTION '360 refuses replaced journal PK identity';END IF;
 FOR v_entry IN SELECT key,value FROM jsonb_each(binding->'ri_triggers') LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger tr WHERE tr.oid=v_entry.key::oid AND to_jsonb(tr)=v_entry.value) THEN RAISE EXCEPTION '360 refuses replaced native RI trigger identity';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each(binding->'indexes') LOOP
  IF to_regclass('public.'||v_entry.key)::oid IS DISTINCT FROM (v_entry.value->>'oid')::oid
   OR encode(sha256(convert_to(pg_get_indexdef((v_entry.value->>'oid')::oid),'UTF8')),'hex') IS DISTINCT FROM v_entry.value->>'definition_hash' THEN
   RAISE EXCEPTION '360 refuses changed historical invoice index identity/expression';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each(binding->'columns') LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_attribute ca WHERE ca.attrelid=(v_entry.value->>'relation')::oid AND ca.attnum=(v_entry.value->>'number')::smallint
   AND ca.attname=split_part(v_entry.key,'.',2) AND NOT ca.attisdropped) THEN RAISE EXCEPTION '360 refuses replaced tax column identity';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each_text(binding->'triggers') LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger tr WHERE tr.oid=v_entry.value::oid AND tr.tgname=v_entry.key) THEN RAISE EXCEPTION '360 refuses replaced tax trigger identity';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each_text(binding->'policies') LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_policy pol WHERE pol.oid=v_entry.value::oid AND pol.polname=v_entry.key) THEN RAISE EXCEPTION '360 refuses replaced tax policy identity';END IF;
 END LOOP;
 FOR v_entry IN SELECT key,value FROM jsonb_each_text(binding->'constraints') LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_constraint con WHERE con.oid=v_entry.value::oid AND con.conname=v_entry.key) THEN RAISE EXCEPTION '360 refuses replaced tax constraint identity';END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_event_trigger WHERE evtname='subscription_tax_ddl_guard_360' AND oid=(binding->>'event_oid')::oid
  AND evtfoid='public.guard_subscription_tax_ddl_360()'::regprocedure AND evtowner='postgres'::regrole AND evtenabled='O' AND evtevent='ddl_command_end' AND evttags IS NULL) THEN
  RAISE EXCEPTION '360 refuses replaced or disabled event guard';END IF;
 IF EXISTS(SELECT 1 FROM pg_depend dep WHERE dep.refclassid='pg_proc'::regclass AND dep.refobjid IN(SELECT (value->>'oid')::oid FROM jsonb_each(binding->'functions'))
  AND NOT coalesce((dep.classid='pg_trigger'::regclass AND dep.objsubid=0 AND dep.deptype='n'
    AND dep.objid IN(SELECT value::oid FROM jsonb_each_text(binding->'triggers')))
   OR(dep.classid='pg_event_trigger'::regclass AND dep.objid=(binding->>'event_oid')::oid AND dep.objsubid=0 AND dep.deptype='n'),false)) THEN
  RAISE EXCEPTION '360 refuses unknown incoming function dependency';END IF;
 -- TAX360-CUSTODY-END

 -- TAX360-OWNED-SHAPE-BEGIN: deterministic extension shape, never a live-profile capture.
 -- This closes only the owned extension's shape/dependency subset. Historical
 -- OID custody, baseline role/schema profiles and native lifetime fences remain
 -- separate mandatory retirement requirements; comments are not that custody.
 IF EXISTS(SELECT 1 FROM (VALUES ('billing_history','subscription_tax_snapshot','jsonb'),('billing_history','subscription_tax_source_id','uuid'),
  ('subscriptions','subscription_tax_snapshot','jsonb'),('subscriptions','subscription_tax_source_id','uuid')) e(tbl,col,typ)
  LEFT JOIN pg_attribute a ON a.attrelid=('public.'||e.tbl)::regclass AND a.attname=e.col AND a.attnum>0 AND NOT a.attisdropped
  LEFT JOIN pg_type ty ON ty.oid=e.typ::regtype
  WHERE a.attnum IS NULL OR a.atttypid IS DISTINCT FROM ty.oid OR a.atttypmod<>-1 OR a.attndims<>0
   OR a.attnotnull OR a.atthasdef OR a.attidentity<>'' OR a.attgenerated<>'' OR a.atthasmissing OR a.attmissingval IS NOT NULL
   OR NOT a.attislocal OR a.attinhcount<>0 OR a.attcollation<>0 OR a.attacl IS NOT NULL
   OR a.attoptions IS NOT NULL OR a.attfdwoptions IS NOT NULL OR a.attstorage IS DISTINCT FROM ty.typstorage) THEN
  RAISE EXCEPTION '360 refuses changed tax column schema or grants';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES
  ('billing_history','billing_history_tax_writer_360','guard_subscription_tax_new_writer_360',7),
  ('subscriptions','subscriptions_tax_writer_360','guard_subscription_tax_new_writer_360',7),
  ('billing_history','billing_history_tax_source_immutable_360','guard_subscription_tax_rows_360',27),
  ('subscriptions','subscriptions_tax_source_immutable_360','guard_subscription_tax_rows_360',27),
  ('merchant_billing_invoices','merchant_billing_tax_invoice_immutable_360','guard_subscription_tax_invoice_360',31),
  ('billing_history','billing_history_tax_source_truncate_360','guard_subscription_tax_rows_360',34),
  ('subscriptions','subscriptions_tax_source_truncate_360','guard_subscription_tax_rows_360',34),
  ('audit_logs','subscription_tax_audit_immutable_360','guard_subscription_tax_rows_360',27),
  ('audit_logs','subscription_tax_audit_truncate_360','guard_subscription_tax_rows_360',34),
  ('merchant_billing_invoices','merchant_billing_tax_invoice_truncate_360','guard_subscription_tax_invoice_360',34)) e(tbl,trg,fn,mask)
  LEFT JOIN pg_trigger tr ON tr.tgrelid=('public.'||e.tbl)::regclass AND tr.tgname=e.trg
  WHERE tr.oid IS NULL OR tr.tgenabled<>'O' OR tr.tgfoid IS DISTINCT FROM to_regprocedure('public.'||e.fn||'()')
   OR tr.tgtype IS DISTINCT FROM e.mask::smallint OR tr.tgisinternal OR tr.tgparentid<>0
   OR tr.tgconstrrelid<>0 OR tr.tgconstrindid<>0 OR tr.tgconstraint<>0 OR tr.tgdeferrable OR tr.tginitdeferred
   OR tr.tgnargs<>0 OR tr.tgargs<>''::bytea OR tr.tgattr::text<>'' OR tr.tgqual IS NOT NULL
   OR tr.tgoldtable IS NOT NULL OR tr.tgnewtable IS NOT NULL)
  OR (SELECT count(*) FROM pg_trigger WHERE tgfoid IN('public.guard_subscription_tax_new_writer_360()'::regprocedure,
   'public.guard_subscription_tax_rows_360()'::regprocedure,'public.guard_subscription_tax_invoice_360()'::regprocedure))<>10 THEN
  RAISE EXCEPTION '360 refuses changed tax trigger shape';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES ('billing_history','subscription_tax_history_backend_read_360'),
  ('subscriptions','subscription_tax_current_backend_read_360')) e(tbl,policy)
  LEFT JOIN pg_policy pol ON pol.polrelid=('public.'||e.tbl)::regclass AND pol.polname=e.policy
  JOIN pg_class rel ON rel.oid=('public.'||e.tbl)::regclass
  WHERE pol.oid IS NULL OR pol.polcmd<>'r' OR pol.polpermissive OR NOT rel.relrowsecurity
   OR ARRAY(SELECT role_oid FROM unnest(pol.polroles) AS roles(role_oid) ORDER BY role_oid)
    IS DISTINCT FROM ARRAY(SELECT role_oid FROM unnest(ARRAY['anon'::regrole::oid,'authenticated'::regrole::oid,'app_tenant'::regrole::oid]) AS roles(role_oid) ORDER BY role_oid)
   OR pg_get_expr(pol.polqual,pol.polrelid,false) IS DISTINCT FROM '(subscription_tax_snapshot IS NULL)'
   OR pol.polwithcheck IS NOT NULL)
  OR (SELECT count(*) FROM pg_policy WHERE polname IN('subscription_tax_history_backend_read_360','subscription_tax_current_backend_read_360'))<>2 THEN
  RAISE EXCEPTION '360 refuses changed tax policy shape';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES ('billing_history','billing_history_subscription_tax_source_id_fkey'),
  ('subscriptions','subscriptions_subscription_tax_source_id_fkey')) e(tbl,fk)
  LEFT JOIN pg_constraint k ON k.conrelid=('public.'||e.tbl)::regclass AND k.conname=e.fk
  JOIN pg_attribute source_col ON source_col.attrelid=('public.'||e.tbl)::regclass AND source_col.attname='subscription_tax_source_id' AND NOT source_col.attisdropped
  JOIN pg_attribute target_col ON target_col.attrelid='public.billing_history'::regclass AND target_col.attname='id' AND NOT target_col.attisdropped
  WHERE k.oid IS NULL OR k.contype<>'f' OR k.connamespace<>'public'::regnamespace OR k.contypid<>0
   OR k.conkey IS DISTINCT FROM ARRAY[source_col.attnum]::smallint[] OR k.confkey IS DISTINCT FROM ARRAY[target_col.attnum]::smallint[]
   OR k.confrelid<>'public.billing_history'::regclass OR k.condeferrable OR k.condeferred OR NOT k.convalidated
   OR k.confupdtype<>'a' OR k.confdeltype<>'a' OR k.confmatchtype<>'s' OR k.confdelsetcols IS NOT NULL
   OR NOT k.conislocal OR k.coninhcount<>0 OR NOT k.connoinherit OR k.conparentid<>0 OR k.conbin IS NOT NULL OR k.conexclop IS NOT NULL
   OR k.conindid IS DISTINCT FROM (SELECT pk.conindid FROM pg_constraint pk WHERE pk.conrelid='public.billing_history'::regclass AND pk.contype='p' AND pk.conkey=ARRAY[target_col.attnum]::smallint[])
   OR k.conpfeqop IS DISTINCT FROM ARRAY['pg_catalog.=(uuid,uuid)'::regoperator::oid]
   OR k.conppeqop IS DISTINCT FROM ARRAY['pg_catalog.=(uuid,uuid)'::regoperator::oid]
   OR k.conffeqop IS DISTINCT FROM ARRAY['pg_catalog.=(uuid,uuid)'::regoperator::oid]) THEN
  RAISE EXCEPTION '360 refuses changed tax foreign key shape';END IF;
 -- DROP COLUMN can automatically remove constraints/indexes/policies. Refuse
 -- every incoming column dependency except the exact two FKs and two policies
 -- whose complete shapes were checked above. Expression indexes and views are
 -- covered by pg_depend even when their pg_index.indkey entry is zero.
 IF EXISTS(SELECT 1 FROM pg_depend dep
  JOIN pg_attribute col ON dep.refclassid='pg_class'::regclass AND dep.refobjid=col.attrelid AND dep.refobjsubid=col.attnum
  WHERE col.attrelid IN('public.billing_history'::regclass,'public.subscriptions'::regclass)
   AND col.attname IN('subscription_tax_snapshot','subscription_tax_source_id') AND NOT col.attisdropped
   AND NOT coalesce((dep.classid='pg_constraint'::regclass AND dep.objsubid=0 AND dep.deptype='a'
    AND col.attname='subscription_tax_source_id' AND EXISTS(SELECT 1 FROM pg_constraint k WHERE k.oid=dep.objid AND k.conrelid=col.attrelid
     AND k.conname=CASE WHEN col.attrelid='public.billing_history'::regclass THEN 'billing_history_subscription_tax_source_id_fkey' ELSE 'subscriptions_subscription_tax_source_id_fkey' END))
    OR (dep.classid='pg_policy'::regclass AND dep.objsubid=0 AND dep.deptype='n' AND col.attname='subscription_tax_snapshot'
     AND EXISTS(SELECT 1 FROM pg_policy pol WHERE pol.oid=dep.objid AND pol.polrelid=col.attrelid
      AND pol.polname=CASE WHEN col.attrelid='public.billing_history'::regclass THEN 'subscription_tax_history_backend_read_360' ELSE 'subscription_tax_current_backend_read_360' END)),false)) THEN
  RAISE EXCEPTION '360 refuses unknown tax column dependency';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES ('merchant_billing_tax_source_360_uidx'),('merchant_billing_provider_invoice_360_uidx')) e(idx)
  LEFT JOIN pg_class rel ON rel.relnamespace='public'::regnamespace AND rel.relname=e.idx
  LEFT JOIN pg_index ix ON ix.indexrelid=rel.oid
  WHERE rel.oid IS NULL OR rel.relkind<>'i' OR rel.relpersistence<>'p' OR rel.relispartition
   OR rel.relowner IS DISTINCT FROM (SELECT relowner FROM pg_class WHERE oid='public.merchant_billing_invoices'::regclass)
   OR rel.relam IS DISTINCT FROM (SELECT oid FROM pg_am WHERE amname='btree') OR rel.relacl IS NOT NULL OR rel.reloptions IS NOT NULL
   OR ix.indexrelid IS NULL OR ix.indrelid IS DISTINCT FROM 'public.merchant_billing_invoices'::regclass
   OR NOT ix.indisunique OR NOT ix.indisvalid OR NOT ix.indisready OR NOT ix.indislive OR NOT ix.indimmediate
   OR ix.indisprimary OR ix.indisexclusion OR ix.indisclustered OR ix.indisreplident OR ix.indcheckxmin OR ix.indnullsnotdistinct
   OR ix.indnatts<>1 OR ix.indnkeyatts<>1 OR ix.indpred IS NULL
   OR (e.idx='merchant_billing_tax_source_360_uidx' AND (ix.indexprs IS NOT NULL
    OR ix.indkey::text IS DISTINCT FROM (SELECT attnum::text FROM pg_attribute WHERE attrelid='public.merchant_billing_invoices'::regclass AND attname='billing_history_id' AND NOT attisdropped)
    OR ix.indclass::text IS DISTINCT FROM (SELECT op.oid::text FROM pg_opclass op WHERE op.opcnamespace='pg_catalog'::regnamespace AND op.opcmethod=rel.relam AND op.opcname='uuid_ops') OR ix.indcollation::text<>'0'))
   OR (e.idx='merchant_billing_provider_invoice_360_uidx' AND (ix.indexprs IS NULL OR ix.indkey::text<>'0'
    OR ix.indclass::text IS DISTINCT FROM (SELECT op.oid::text FROM pg_opclass op WHERE op.opcnamespace='pg_catalog'::regnamespace AND op.opcmethod=rel.relam AND op.opcname='text_ops')
    OR ix.indcollation::text IS DISTINCT FROM '"default"'::regcollation::oid::text))
   OR ix.indoption::text<>'0') THEN
  RAISE EXCEPTION '360 refuses changed tax index shape';END IF;
 IF EXISTS(SELECT 1 FROM pg_index ix JOIN pg_class ci ON ci.oid=ix.indexrelid
  WHERE ci.relnamespace='public'::regnamespace AND ci.relname IN('merchant_billing_tax_source_360_uidx','merchant_billing_provider_invoice_360_uidx')
   AND ((ci.relname='merchant_billing_tax_source_360_uidx' AND (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce(pg_get_expr(ix.indpred,ix.indrelid,false),''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)) IS DISTINCT FROM (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce('((metadata ->> ''policy_version''::text) = ''D-SUB-TAX-INCLUSIVE-V1''::text)',''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)))
    OR(ci.relname='merchant_billing_provider_invoice_360_uidx' AND ((SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce(pg_get_expr(ix.indpred,ix.indrelid,false),''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)) IS DISTINCT FROM (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce('(((metadata ->> ''policy_version''::text) = ''D-SUB-TAX-INCLUSIVE-V1''::text) AND (metadata ? ''provider_invoice''::text))',''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)) OR (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce(pg_get_expr(ix.indexprs,ix.indrelid,false),''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)) IS DISTINCT FROM (SELECT string_agg(CASE WHEN left(z.token[1],1)='''' THEN z.token[1] ELSE regexp_replace(z.token[1],'[[:space:]]','','g') END,'' ORDER BY z.ordinal) FROM regexp_matches(coalesce('((metadata -> ''provider_invoice''::text) ->> ''invoice_id''::text)',''),$tokens$'(?:[^']|'')*'|[^']+$tokens$,'g') WITH ORDINALITY z(token,ordinal)))))) THEN
  RAISE EXCEPTION '360 refuses tax index expression outside canonical source';END IF;
 -- RI trigger names contain generated OIDs; admit functions/relations/masks
 -- from native FK semantics and retain the actual four identities per FK.
 FOR v_entry IN SELECT con.oid,con.conrelid,con.confrelid FROM pg_constraint con
  WHERE con.conrelid IN('public.billing_history'::regclass,'public.subscriptions'::regclass)
   AND con.conname IN('billing_history_subscription_tax_source_id_fkey','subscriptions_subscription_tax_source_id_fkey') LOOP
  IF (SELECT count(*) FROM pg_trigger WHERE tgconstraint=v_entry.oid)<>4 OR EXISTS(
   SELECT 1 FROM(VALUES ('RI_FKey_check_ins',v_entry.conrelid,v_entry.confrelid,5),('RI_FKey_check_upd',v_entry.conrelid,v_entry.confrelid,17),
    ('RI_FKey_noaction_del',v_entry.confrelid,v_entry.conrelid,9),('RI_FKey_noaction_upd',v_entry.confrelid,v_entry.conrelid,17))e(fn,rel,parent,mask)
   LEFT JOIN pg_trigger tr ON tr.tgconstraint=v_entry.oid AND tr.tgrelid=e.rel AND tr.tgfoid=to_regprocedure('pg_catalog.'||quote_ident(e.fn)||'()')
   WHERE tr.oid IS NULL OR NOT tr.tgisinternal OR tr.tgtype IS DISTINCT FROM e.mask::smallint OR tr.tgenabled<>'O' OR tr.tgparentid<>0
    OR tr.tgconstrrelid IS DISTINCT FROM e.parent OR tr.tgdeferrable OR tr.tginitdeferred OR tr.tgnargs<>0 OR tr.tgargs<>''::bytea
    OR tr.tgattr::text<>'' OR tr.tgqual IS NOT NULL OR tr.tgoldtable IS NOT NULL OR tr.tgnewtable IS NOT NULL) THEN
   RAISE EXCEPTION '360 refuses changed native RI trigger profile';END IF;
 END LOOP;
 -- TAX360-OWNED-SHAPE-END
END $verify360$;
NOTIFY pgrst,'reload schema';
COMMIT;
