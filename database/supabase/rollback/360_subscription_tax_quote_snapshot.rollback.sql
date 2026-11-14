-- 360 retirement is an empty-source operation. Never erase evidence to make it pass.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL search_path=pg_catalog,public;
-- Partial maintenance admission. Full native writer/DDL lifetime and historical
-- OID/schema provenance controls still require the final reviewed guard profile.
DO $maintenance$
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed'
  OR pg_current_xact_id_if_assigned() IS NOT NULL THEN
  RAISE EXCEPTION '360 rollback requires a fresh read-committed maintenance transaction';END IF;
 -- 364 is an allocated dependent source-reference extension. PL/pgSQL body
 -- references need not create catalog dependencies, so detect its whole family,
 -- typed source column, event guard and private receipts before any mutation.
 IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN(
   'guard_subscription_refund_source_reference_v1','read_merchant_subscription_refund_source_v1','record_subscription_refund_source_reference_v1',
   'assert_subscription_refund_source_profile_364','guard_subscription_refund_source_ddl_364'))
  OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.refunds'::regclass AND attname='subscription_billing_history_id' AND NOT attisdropped)
  OR EXISTS(SELECT 1 FROM pg_event_trigger WHERE evtname='subscription_refund_source_ddl_guard_364')
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='364') THEN
  RAISE EXCEPTION '360 rollback requires empty364 retirement first';END IF;
 IF EXISTS(SELECT 1 FROM pg_prepared_xacts WHERE database=current_database()) THEN
  RAISE EXCEPTION '360 rollback refuses prepared transactions in this database';END IF;
 IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE datid=(SELECT oid FROM pg_database WHERE datname=current_database())
  AND pid<>pg_backend_pid() AND backend_xid IS NOT NULL) THEN
  RAISE EXCEPTION '360 rollback refuses a foreign assigned transaction';END IF;
END $maintenance$;
LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_attribute,pg_catalog.pg_attrdef,pg_catalog.pg_constraint,
 pg_catalog.pg_index,pg_catalog.pg_trigger,pg_catalog.pg_event_trigger,pg_catalog.pg_policy,pg_catalog.pg_depend,pg_catalog.pg_shdepend,
 pg_catalog.pg_namespace,pg_catalog.pg_type,pg_catalog.pg_description,pg_catalog.pg_seclabel,pg_catalog.pg_authid,pg_catalog.pg_auth_members,
 pg_catalog.pg_inherits,pg_catalog.pg_rewrite,pg_catalog.pg_language,pg_catalog.pg_opclass,pg_catalog.pg_opfamily,pg_catalog.pg_operator,
 pg_catalog.pg_am,pg_catalog.pg_collation,pg_catalog.pg_tablespace,pg_catalog.pg_default_acl IN SHARE ROW EXCLUSIVE MODE NOWAIT;
LOCK TABLE public.sites IN EXCLUSIVE MODE NOWAIT;
LOCK TABLE public.billing_history,public.subscriptions,public.merchant_billing_invoices,public.audit_logs,public.migration_privilege_journal IN SHARE ROW EXCLUSIVE MODE NOWAIT;
DO $guard$
DECLARE binding jsonb;v_entry record;v_fn pg_proc%ROWTYPE;v_journal public.migration_privilege_journal%ROWTYPE;
BEGIN
 IF EXISTS(SELECT 1 FROM pg_prepared_xacts WHERE database=current_database())
  OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE datid=(SELECT oid FROM pg_database WHERE datname=current_database())
   AND pid<>pg_backend_pid() AND backend_xid IS NOT NULL) THEN
  RAISE EXCEPTION '360 rollback refuses a foreign assigned or prepared transaction';END IF;
 IF EXISTS(SELECT 1 FROM public.billing_history WHERE subscription_tax_snapshot IS NOT NULL OR subscription_tax_source_id IS NOT NULL)
  OR EXISTS(SELECT 1 FROM public.subscriptions WHERE subscription_tax_snapshot IS NOT NULL OR subscription_tax_source_id IS NOT NULL)
  OR EXISTS(SELECT 1 FROM public.merchant_billing_invoices WHERE metadata->>'policy_version'='D-SUB-TAX-INCLUSIVE-V1' OR metadata?'provider_invoice')
  OR EXISTS(SELECT 1 FROM public.audit_logs WHERE metadata?'subscription_tax_source_id' OR metadata->>'subscription_tax_policy'='D-SUB-TAX-INCLUSIVE-V1') THEN
  RAISE EXCEPTION '360 rollback refuses retained tax evidence; retain forward schema';END IF;
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
END $guard$;
CREATE TEMP TABLE tax360_retirement_binding ON COMMIT DROP AS
 SELECT substring(config from length('letbuyy.subscription_tax_birth_bindings=')+1)::jsonb AS binding
 FROM pg_proc p CROSS JOIN LATERAL unnest(p.proconfig)config
 WHERE p.oid='public.guard_subscription_tax_ddl_360()'::regprocedure AND starts_with(config,'letbuyy.subscription_tax_birth_bindings=');
CREATE TEMP TABLE tax360_original_comments ON COMMIT DROP AS
 SELECT key AS signature,value->>'previous_comment' AS original_comment FROM tax360_retirement_binding b CROSS JOIN LATERAL jsonb_each(b.binding->'functions')
 WHERE split_part(key,'(',1) IN('public.claim_merchant_subscription_checkout_v1','public.bind_merchant_subscription_checkout_v1','public.read_merchant_subscription_checkout_v1','public.activate_merchant_subscription_v1');
DROP EVENT TRIGGER subscription_tax_ddl_guard_360;
DROP FUNCTION public.guard_subscription_tax_ddl_360();
DROP FUNCTION public.sync_merchant_subscription_state_v1(jsonb);
DROP TRIGGER merchant_billing_tax_invoice_immutable_360 ON public.merchant_billing_invoices;
DROP TRIGGER merchant_billing_tax_invoice_truncate_360 ON public.merchant_billing_invoices;
DROP INDEX public.merchant_billing_tax_source_360_uidx;
DROP INDEX public.merchant_billing_provider_invoice_360_uidx;
DROP FUNCTION public.guard_subscription_tax_invoice_360();
DROP FUNCTION public.record_merchant_subscription_failure_v1(jsonb);
DROP TRIGGER billing_history_tax_writer_360 ON public.billing_history;
DROP TRIGGER subscriptions_tax_writer_360 ON public.subscriptions;
DROP FUNCTION public.guard_subscription_tax_new_writer_360();
DROP TRIGGER billing_history_tax_source_immutable_360 ON public.billing_history;
DROP TRIGGER subscriptions_tax_source_immutable_360 ON public.subscriptions;
DROP TRIGGER billing_history_tax_source_truncate_360 ON public.billing_history;
DROP TRIGGER subscriptions_tax_source_truncate_360 ON public.subscriptions;
DROP TRIGGER subscription_tax_audit_immutable_360 ON public.audit_logs;
DROP TRIGGER subscription_tax_audit_truncate_360 ON public.audit_logs;
DROP FUNCTION public.guard_subscription_tax_rows_360();
CREATE OR REPLACE FUNCTION public.claim_merchant_subscription_checkout_v1(
 p_actor uuid,p_site uuid,p_key text,p_request jsonb,p_quote jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public SET letbuyy.subscription_checkout_version='347' AS $f$
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
  RETURN jsonb_build_object('accepted',true,'claimed',false,'charge',to_jsonb(c));
 END IF;
 IF p_quote IS NULL THEN RETURN jsonb_build_object('accepted',true,'missing',true); END IF;
 -- 347: one discriminated internal free quote alongside unchanged paid modes.
 amount:=(p_quote->>'amount_minor')::bigint;
 free_quote:=p_quote->>'mode'='free_activation';
 IF amount IS NULL OR amount<0 OR amount>2147483647 OR (NOT free_quote AND amount=0) OR p_quote->>'currency' IS DISTINCT FROM 'INR'
  OR p_quote->>'mode' IS NULL OR p_quote->>'mode' NOT IN('razorpay_order','razorpay_subscription','free_activation') OR p_quote->'plan'->>'slug' IS DISTINCT FROM p_request->>'plan_slug'
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
 -- A pre-347 HTTP receipt can outlive the old unbound free activation. It
 -- cannot be guessed from the latest subscription or its creation time. After
 -- canonical route ownership is installed, refuse this ambiguous legacy key
 -- rather than creating a second outcome. Existing canonical quotes replay above.
 IF free_quote AND EXISTS(SELECT 1 FROM public.idempotency_keys old_http
  WHERE old_http.site_id=p_site AND old_http.key=btrim(p_key) AND old_http.deleted_at IS NULL
   AND old_http.scope IN('http:POST:/payments/subscription/order','http:POST:/payments/subscription/recover')) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_LEGACY_CHECKOUT_PENDING'); END IF;
 INSERT INTO public.billing_history(id,user_id,store_id,site_id,invoice_number,description,amount,total_amount,currency,payment_gateway,
  payment_status,billing_period,subscription_checkout,subscription_checkout_key,subscription_checkout_request,subscription_checkout_reference)
 VALUES(receipt,p_actor,p_site,p_site,'QUOTE-'||receipt,'Pending subscription checkout',amount,amount,'INR',CASE WHEN free_quote THEN NULL ELSE 'razorpay' END,'pending',
  p_request->>'billing_period',p_quote,p_key,p_request,CASE WHEN free_quote THEN 'free_checkout:'||receipt ELSE NULL END) RETURNING * INTO c;
 INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,resource_type,resource_id,expires_at)
 VALUES(p_site,p_key,scope,encode(sha256(convert_to(p_request::text,'UTF8')),'hex'),'billing_history',receipt,'infinity');
 RETURN jsonb_build_object('accepted',true,'claimed',true,'charge',to_jsonb(c));
END $f$;
CREATE OR REPLACE FUNCTION public.bind_merchant_subscription_checkout_v1(p_actor uuid,p_site uuid,p_charge uuid,p_reference text,p_short_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $f$
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
DECLARE s public.sites%ROWTYPE;c public.billing_history%ROWTYPE;retained public.subscriptions%ROWTYPE;plan public.plans%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL;
 IF NOT FOUND OR NOT coalesce(p_actor=s.custom_user_id OR p_actor=s.user_id,false) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED'); END IF;
 SELECT * INTO c FROM public.billing_history WHERE subscription_checkout_reference=p_reference;
 IF FOUND THEN
  IF c.subscription_checkout->>'mode'='free_activation' OR c.deleted_at IS NOT NULL OR c.site_id IS DISTINCT FROM p_site OR c.user_id IS DISTINCT FROM p_actor
   OR c.subscription_checkout->'plan'->>'slug' IS DISTINCT FROM p_plan_slug OR c.billing_period IS DISTINCT FROM p_period THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
  RETURN jsonb_build_object('accepted',true,'charge',to_jsonb(c));
 END IF;
 -- A retained paid receipt can be read back; it cannot authorize a new purchase.
 SELECT * INTO retained FROM public.subscriptions WHERE razorpay_payment_id=p_payment AND deleted_at IS NULL;
 IF FOUND AND retained.user_id=p_actor AND retained.store_id=p_site AND retained.plan=p_plan_slug AND retained.billing_period=p_period THEN
  SELECT * INTO plan FROM public.plans WHERE slug=retained.plan AND site_type=s.site_type;
  RETURN jsonb_build_object('accepted',true,'charge',jsonb_build_object('amount',retained.amount_paid,'currency','INR',
   'subscription_checkout_reference',p_reference,'subscription_checkout',jsonb_build_object('plan',to_jsonb(plan),'mode',
    CASE WHEN p_reference LIKE 'sub_%' THEN 'razorpay_subscription' ELSE 'razorpay_order' END)));
 END IF;
 RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');
END $f$;
CREATE OR REPLACE FUNCTION public.activate_merchant_subscription_v1(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public SET letbuyy.subscription_checkout_version='347' AS $function$
DECLARE s public.sites%ROWTYPE;plan public.plans%ROWTYPE;existing public.subscriptions%ROWTYPE;created public.subscriptions%ROWTYPE;
 actor uuid;site uuid;plan_id uuid;gateway text;payment text;period text;amount bigint;tax bigint;total bigint;
 charge public.billing_history%ROWTYPE;source_ref text;free_id uuid;is_free boolean;
 started timestamptz;finished timestamptz;promo timestamptz;constraint_name text;
BEGIN
 IF p_input IS NULL OR jsonb_typeof(p_input)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k
  WHERE k NOT IN('user_id','store_id','plan_id','plan_slug','plan_name','billing_period','amount_paid','payment_gateway',
   'external_subscription_id','razorpay_order_id','razorpay_payment_id','period_start','period_end','promo_ends_at',
   'products_limit','invoice_number','invoice_description','tax_amount','total_amount',
   'subscription_checkout_id','subscription_checkout_key','subscription_checkout_request')) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');
 END IF;
 actor:=(p_input->>'user_id')::uuid;site:=(p_input->>'store_id')::uuid;plan_id:=(p_input->>'plan_id')::uuid;
 gateway:=p_input->>'payment_gateway';payment:=nullif(btrim(p_input->>'razorpay_payment_id'),'');period:=p_input->>'billing_period';
 amount:=(p_input->>'amount_paid')::bigint;tax:=(p_input->>'tax_amount')::bigint;total:=(p_input->>'total_amount')::bigint;
 -- 347: explicit retained free checkout context; the existing paid ABI remains intact.
 free_id:=nullif(p_input->>'subscription_checkout_id','')::uuid;is_free:=free_id IS NOT NULL;
 started:=(p_input->>'period_start')::timestamptz;finished:=(p_input->>'period_end')::timestamptz;promo:=(p_input->>'promo_ends_at')::timestamptz;
 IF actor IS NULL OR site IS NULL OR plan_id IS NULL OR period IS NULL OR period NOT IN('monthly','yearly')
  OR amount IS NULL OR amount<0 OR amount>2147483647 OR tax IS NULL OR tax<0 OR total IS NULL OR total<>amount+tax OR total>2147483647
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
 -- Global payment lock first, then the exact store. Different payments at the
 -- same store also serialize old-entitlement retirement with the new receipt.
 IF payment IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:subscription:razorpay:'||payment,0));END IF;
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
 SELECT * INTO plan FROM public.plans WHERE id=plan_id AND site_type=s.site_type AND slug=p_input->>'plan_slug' AND is_active=true FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PLAN_CHANGED');END IF;
 IF payment IS NOT NULL THEN
  SELECT * INTO existing FROM public.subscriptions WHERE razorpay_payment_id=payment;
  IF FOUND THEN
   IF existing.deleted_at IS NOT NULL OR existing.store_id IS DISTINCT FROM site OR existing.site_id IS DISTINCT FROM site OR existing.user_id IS DISTINCT FROM actor
    OR (existing.plan_id IS NOT NULL AND existing.plan_id IS DISTINCT FROM plan_id) OR existing.plan IS DISTINCT FROM plan.slug
    OR existing.billing_period IS DISTINCT FROM period OR existing.amount_paid IS DISTINCT FROM amount
    OR (existing.razorpay_order_id IS NOT NULL AND existing.razorpay_order_id IS DISTINCT FROM p_input->>'razorpay_order_id')
    OR (existing.external_subscription_id IS NOT NULL AND existing.external_subscription_id IS DISTINCT FROM p_input->>'external_subscription_id') THEN
    RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');
   END IF;
   RETURN jsonb_build_object('accepted',true,'subscription',to_jsonb(existing),'replayed',true);
  END IF;
  IF EXISTS(SELECT 1 FROM public.billing_history WHERE provider_payment_reference=payment)
   OR EXISTS(SELECT 1 FROM public.payment_transactions t WHERE t.gateway='razorpay' AND t.provider_payment_id=payment) THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');
  END IF;
 END IF;
 -- Only a server-persisted checkout can authorize a new real Razorpay activation.
 -- Explicit synthetic AutoPay IDs retain their existing sandbox classification.
 IF gateway='razorpay' AND payment NOT LIKE 'sandbox_autopay_payment:%' THEN
  source_ref:=coalesce(nullif(p_input->>'external_subscription_id',''),nullif(p_input->>'razorpay_order_id',''));
  SELECT * INTO charge FROM public.billing_history WHERE subscription_checkout_reference=source_ref FOR UPDATE;
  IF NOT FOUND OR charge.deleted_at IS NOT NULL OR charge.site_id IS DISTINCT FROM site OR charge.store_id IS DISTINCT FROM site
   OR charge.user_id IS DISTINCT FROM actor OR charge.subscription_checkout->'plan'->>'id' IS DISTINCT FROM plan_id::text
   OR charge.subscription_checkout->'plan'->>'slug' IS DISTINCT FROM plan.slug OR charge.billing_period IS DISTINCT FROM period
   OR charge.payment_gateway IS DISTINCT FROM 'razorpay' OR charge.amount IS DISTINCT FROM amount OR charge.currency IS DISTINCT FROM 'INR'
   OR charge.subscription_checkout->'plan'->'products_limit' IS DISTINCT FROM p_input->'products_limit'
   OR charge.payment_status NOT IN('pending','paid')
   OR (charge.payment_status='paid' AND charge.subscription_checkout->>'mode'<>'razorpay_subscription') THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');
  END IF;
 END IF;
 INSERT INTO public.subscriptions(user_id,store_id,site_id,plan,plan_id,status,billing_period,current_period_start,current_period_end,promo_ends_at,
  payment_gateway,external_subscription_id,razorpay_order_id,razorpay_payment_id,amount_paid,currency,products_limit,stores_limit,idempotency_key)
 VALUES(actor,site,site,plan.slug,plan.id,'active',period,started,finished,promo,gateway,p_input->>'external_subscription_id',
  p_input->>'razorpay_order_id',payment,amount,'INR',(p_input->>'products_limit')::integer,1,
  CASE WHEN is_free THEN 'free_checkout:'||free_id WHEN payment IS NOT NULL THEN 'razorpay_payment:'||payment ELSE NULL END) RETURNING * INTO created;
 UPDATE public.subscriptions SET status='cancelled',cancelled_at=started WHERE store_id=site AND status='active' AND id<>created.id;
 UPDATE public.sites SET trial_status=CASE WHEN amount>0 THEN 'paid' ELSE 'active' END,updated_at=started WHERE id=site;
 IF charge.id IS NOT NULL AND charge.payment_status='pending' THEN
  UPDATE public.billing_history SET subscription_id=created.id,invoice_number=p_input->>'invoice_number',
   description=p_input->>'invoice_description',tax_amount=tax,total_amount=total,payment_id=CASE WHEN is_free THEN charge.subscription_checkout_reference ELSE payment END,
   provider_payment_reference=payment,payment_status='paid',period_start=started,period_end=finished,updated_at=now()
   WHERE id=charge.id;
 ELSE
 INSERT INTO public.billing_history(user_id,store_id,site_id,subscription_id,invoice_number,description,amount,currency,tax_amount,total_amount,
  payment_gateway,payment_id,provider_payment_reference,payment_status,billing_period,period_start,period_end)
 VALUES(actor,site,site,created.id,p_input->>'invoice_number',p_input->>'invoice_description',amount,'INR',tax,total,gateway,
  coalesce(payment,p_input->>'external_subscription_id',p_input->>'razorpay_order_id'),payment,'paid',period,started,finished);
 END IF;
 INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
 VALUES(actor,'user','merchant_subscription.activated','subscription',created.id,jsonb_build_object('site_id',site,'provider',gateway,'payment_reference',payment)
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
 IF constraint_name IN('subscriptions_razorpay_payment_global_uidx','billing_history_provider_payment_reference_uidx') THEN
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

DROP FUNCTION public.record_merchant_subscription_invoice_v1(jsonb);
DROP FUNCTION public.read_merchant_subscription_checkout_key_v1(uuid,uuid,text,jsonb);
DROP FUNCTION public.issue_subscription_tax_invoice_360(uuid,jsonb);
DROP FUNCTION public.valid_subscription_tax_snapshot_360(jsonb);
DROP POLICY subscription_tax_current_backend_read_360 ON public.subscriptions;
DROP POLICY subscription_tax_history_backend_read_360 ON public.billing_history;
ALTER TABLE public.subscriptions DROP COLUMN subscription_tax_source_id,DROP COLUMN subscription_tax_snapshot;
ALTER TABLE public.billing_history DROP COLUMN subscription_tax_source_id,DROP COLUMN subscription_tax_snapshot;
DO $comments$
DECLARE p record;
BEGIN FOR p IN SELECT * FROM tax360_original_comments LOOP EXECUTE format('COMMENT ON FUNCTION %s IS %L',p.signature,p.original_comment);END LOOP;END $comments$;
-- The full private binding/receipt set was validated before ANY drop above.
-- Restore only actual prior table privilege deltas, after dependent364 and all
-- own360 functions/evidence have been retired. This returns predecessor rights;
-- it does not claim the predecessor journal was already read-only.
DO $journal_restore360$
DECLARE v_entry record;
BEGIN
 FOR v_entry IN SELECT value FROM tax360_retirement_binding b CROSS JOIN LATERAL jsonb_array_elements(b.binding->'journal_revocations') LOOP
  IF v_entry.value->>'privilege' NOT IN('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER') THEN RAISE EXCEPTION '360 refuses unknown validated privilege delta';END IF;
  EXECUTE format('GRANT %s ON TABLE public.migration_privilege_journal TO service_role',v_entry.value->>'privilege');
 END LOOP;
 DELETE FROM public.migration_privilege_journal WHERE migration='360' AND
  ((object_signature='public.guard_subscription_tax_ddl_360()' AND grantee='service_role' AND privilege='EXECUTE' AND action='granted')
   OR(object_signature='TABLE public.migration_privilege_journal' AND grantee='service_role' AND action='revoked' AND privilege IN('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')));
END $journal_restore360$;
NOTIFY pgrst,'reload schema';
COMMIT;
