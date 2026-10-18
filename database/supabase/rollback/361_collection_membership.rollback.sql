-- Empty-only retirement, source-derived closed361 footprint. Never erases
-- receipts, direct-write revision history, parent tombstones or pending effects.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL lock_timeout='2s';
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:361:collection-membership',0));
-- Freeze the catalog/role/dependency classes read below. A concurrent DDL or
-- privilege writer refuses this attempt rather than racing the source profile.
LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_attribute,pg_catalog.pg_attrdef,
 pg_catalog.pg_constraint,pg_catalog.pg_index,pg_catalog.pg_trigger,pg_catalog.pg_policy,pg_catalog.pg_rewrite,
 pg_catalog.pg_depend,pg_catalog.pg_type,pg_catalog.pg_namespace,pg_catalog.pg_authid,pg_catalog.pg_auth_members,pg_catalog.pg_default_acl,pg_catalog.pg_event_trigger,pg_catalog.pg_inherits,pg_catalog.pg_description,pg_catalog.pg_seclabel,pg_catalog.pg_shdepend
 IN SHARE ROW EXCLUSIVE MODE NOWAIT;
DO $quiescent$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' OR current_setting('session_replication_role')<>'origin'
  OR EXISTS(SELECT 1 FROM pg_prepared_xacts WHERE database=current_database())
  OR EXISTS(SELECT 1 FROM pg_stat_activity a WHERE a.datid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND a.pid<>pg_backend_pid() AND a.backend_xid IS NOT NULL) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_NOT_QUIESCENT';END IF;
END $quiescent$;
LOCK TABLE public.collections,public.collection_products,public.collection_membership_receipts,public.audit_activity_events,public.outbox_events,public.migration_privilege_journal IN ACCESS EXCLUSIVE MODE NOWAIT;
DO $source_preflight$
DECLARE expected record; f record; j record; role_name text; actual_acl jsonb; expected_acl jsonb; column_number integer;
 fn_signatures constant text[]:=ARRAY['public.guard_collection_membership_receipt_v1()','public.guard_collection_membership_junction_v1()','public.bump_collection_membership_junction_v1()','public.prepare_collection_membership_revision_v1()','public.record_collection_membership_revision_v1()','public.protect_collection_membership_audit_v1()','public.assert_collection_membership_owner_v1(uuid,uuid)','public.collection_membership_snapshot_v1(uuid,uuid)','public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)']::text[];
BEGIN
IF current_user<>'postgres' OR current_setting('session_replication_role')<>'origin'
  OR current_setting('default_tablespace')<>'' OR current_setting('temp_tablespaces')<>'' OR current_setting('default_table_access_method')<>'heap' OR current_setting('check_function_bodies')<>'on'
  OR EXISTS(SELECT 1 FROM pg_event_trigger WHERE evtenabled<>'D')
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','service_role','app_tenant','authenticator') AND (rolconnlimit<>-1 OR rolvaliduntil IS NOT NULL OR rolconfig IS NOT NULL))
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres' AND rolsuper AND rolinherit AND rolcreaterole AND rolcreatedb AND rolcanlogin AND rolreplication AND rolbypassrls)
  OR (SELECT count(*)FROM pg_roles WHERE rolname IN('anon','authenticated','app_tenant') AND NOT rolsuper AND rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolcanlogin AND NOT rolreplication AND NOT rolbypassrls)<>3
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND NOT rolsuper AND rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolcanlogin AND NOT rolreplication AND rolbypassrls)
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator' AND (rolsuper OR rolinherit OR rolcreaterole OR rolcreatedb OR NOT rolcanlogin OR rolreplication OR rolbypassrls)) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLE_PROFILE';END IF;
 IF (SELECT count(*)FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
   WHERE parent.rolname='app_tenant' AND member.rolname IN('postgres','service_role') AND NOT m.admin_option AND m.inherit_option AND m.set_option AND m.grantor='postgres'::regrole)<>2
  OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
   WHERE (parent.rolname IN('postgres','app_tenant','anon','authenticated','service_role') OR member.rolname IN('anon','authenticated','service_role','app_tenant','authenticator')) AND NOT(
    (parent.rolname='app_tenant' AND member.rolname IN('postgres','service_role') AND NOT m.admin_option AND m.inherit_option AND m.set_option AND m.grantor='postgres'::regrole)
    OR (parent.rolname IN('anon','authenticated','service_role') AND member.rolname='authenticator' AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option AND m.grantor='postgres'::regrole))) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLE_MEMBERSHIP';END IF;
 IF EXISTS(SELECT 1 FROM public.collection_membership_receipts)
  OR EXISTS(SELECT 1 FROM public.collections WHERE membership_version<>1)
  OR EXISTS(SELECT 1 FROM public.audit_activity_events WHERE action IN('collection.membership.revision','collection.membership.updated'))
  OR EXISTS(SELECT 1 FROM public.outbox_events WHERE event_type='collection.membership.updated') THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_RETAINED_EVIDENCE';END IF;
 IF EXISTS(SELECT 1 FROM pg_inherits WHERE inhparent IN('public.collections'::regclass,'public.collection_products'::regclass,'public.collection_membership_receipts'::regclass,'public.audit_activity_events'::regclass)
  OR inhrelid IN('public.collections'::regclass,'public.collection_products'::regclass,'public.collection_membership_receipts'::regclass,'public.audit_activity_events'::regclass)) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_INHERITANCE';END IF;
 IF (SELECT count(*)FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['guard_collection_membership_receipt_v1','guard_collection_membership_junction_v1','bump_collection_membership_junction_v1','prepare_collection_membership_revision_v1','record_collection_membership_revision_v1','protect_collection_membership_audit_v1','assert_collection_membership_owner_v1','collection_membership_snapshot_v1','apply_collection_membership_v1']::text[]))<>9 THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_FUNCTION_FAMILY';END IF;
 FOR expected IN SELECT * FROM(VALUES
('public.guard_collection_membership_receipt_v1()','guard_collection_membership_receipt_v1','a0b02f0827238ab21d61d8c2118316d53e553a5d22f3afd7edd402eb2f44ce12','plpgsql','trigger',false,'v',NULL::text[]),
('public.guard_collection_membership_junction_v1()','guard_collection_membership_junction_v1','aad2e02d6d939ae2ae0f014cf182de46c2828c13a91b02054df755eba8c22216','plpgsql','trigger',false,'v',NULL::text[]),
('public.bump_collection_membership_junction_v1()','bump_collection_membership_junction_v1','39871fb0e722b54731ad0798f300c56ca5ffab654aa8900ba17d66cd0904881f','plpgsql','trigger',false,'v',NULL::text[]),
('public.prepare_collection_membership_revision_v1()','prepare_collection_membership_revision_v1','9a6839bc52057158adca48fd5bbaff39473223e2cd40c9f22742300639228e64','plpgsql','trigger',true,'v',NULL::text[]),
('public.record_collection_membership_revision_v1()','record_collection_membership_revision_v1','dee8deb9f8c5dc62e0af2b57f2c74712096ea7ac1454b183f4c184ee77412b48','plpgsql','trigger',true,'v',NULL::text[]),
('public.protect_collection_membership_audit_v1()','protect_collection_membership_audit_v1','6186d7a96d6ced1e6e6ed2b0e9b301ed4b7aabe39a6e746c1bbfb0b28e3b7758','plpgsql','trigger',false,'v',NULL::text[]),
('public.assert_collection_membership_owner_v1(uuid,uuid)','assert_collection_membership_owner_v1','43a5a10c8d3af964e3d75626965e82ebfa63bc7c680b97deef089cd2a33a4146','plpgsql','void',true,'v',ARRAY['p_store_id','p_actor_id']::text[]),
('public.collection_membership_snapshot_v1(uuid,uuid)','collection_membership_snapshot_v1','99b00dd3c1eecac5977d0e6a88466704062ae587d5fc1e60f9dda4dbdf548077','sql','jsonb',false,'s',ARRAY['p_store_id','p_collection_id']::text[]),
('public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)','apply_collection_membership_v1','25b36ca094c5341030d703ac16ed4189bcf822431112e0261a16668d3cbf323c','plpgsql','jsonb',true,'v',ARRAY['p_store_id','p_collection_id','p_actor_id','p_expected_version','p_idempotency_key','p_product_ids']::text[])
 )AS v(signature,name,source_hash,language,result_type,definer,volatility,argnames) LOOP
  SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure(expected.signature);
  IF NOT FOUND OR f.pronamespace<>'public'::regnamespace OR f.proowner<>'postgres'::regrole OR f.prokind<>'f'
   OR f.prolang<>(SELECT oid FROM pg_language WHERE lanname=expected.language)
   OR f.prorettype<>expected.result_type::regtype OR f.prosecdef IS DISTINCT FROM expected.definer OR f.provolatile::text<>expected.volatility
   OR f.proparallel<>'u' OR f.proisstrict OR f.proleakproof OR f.proretset OR f.procost<>100 OR f.prorows<>0
   OR f.provariadic<>0 OR f.prosupport<>0 OR f.pronargdefaults<>0 OR f.proargdefaults IS NOT NULL
   OR f.proallargtypes IS NOT NULL OR f.proargmodes IS NOT NULL OR f.proargnames IS DISTINCT FROM expected.argnames
   OR f.probin IS NOT NULL OR f.prosqlbody IS NOT NULL OR f.protrftypes IS NOT NULL
   OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
   OR encode(sha256(convert_to(f.prosrc,'UTF8')),'hex')<>expected.source_hash THEN
   RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_FUNCTION_SOURCE:%',expected.signature;END IF;
  SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantee),pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable)
   INTO actual_acl FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a;
  SELECT jsonb_agg(jsonb_build_array(grantee,'postgres','EXECUTE',false)ORDER BY grantee::regrole::oid)INTO expected_acl
   FROM unnest(CASE WHEN expected.name='apply_collection_membership_v1'THEN ARRAY['postgres','app_tenant']ELSE ARRAY['postgres']END)AS t(grantee);
  IF actual_acl IS DISTINCT FROM expected_acl THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_FUNCTION_ACL:%',expected.signature;END IF;
  SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='361'AND object_signature=expected.signature AND grantee='postgres'AND privilege='361 FUNCTION'AND action='granted';
  IF NOT FOUND OR j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')THEN
   RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_FUNCTION_PROVENANCE:%',expected.signature;END IF;
 END LOOP;
 FOREACH role_name IN ARRAY ARRAY['postgres','anon','authenticated','service_role','app_tenant']LOOP
  SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='361'AND object_signature='role:'||role_name AND grantee='postgres'AND privilege='361 AUTHORITY ROLE'AND action='granted';
  IF NOT FOUND OR j.object_oid IS DISTINCT FROM(SELECT oid FROM pg_roles WHERE rolname=role_name) OR j.object_owner IS DISTINCT FROM 'postgres'::regrole::oid
   OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to('361 source authority role profile v1','UTF8')),'hex') THEN
   RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_ROLE_IDENTITY:%',role_name;END IF;
 END LOOP;
 SELECT attnum INTO column_number FROM pg_attribute WHERE attrelid='public.collections'::regclass AND attname='membership_version'AND NOT attisdropped;
 IF NOT FOUND OR column_number<>(SELECT max(attnum)FROM pg_attribute WHERE attrelid='public.collections'::regclass AND attnum>0)THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_COLUMN_IDENTITY';END IF;
 SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='361'AND object_signature='public.collections.membership_version'AND grantee='postgres'AND privilege='361 COLUMN:'||column_number::text AND action='granted';
 IF NOT FOUND OR j.object_oid IS DISTINCT FROM 'public.collections'::regclass::oid OR j.object_owner IS DISTINCT FROM 'postgres'::regrole::oid
  OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to('361 membership column source profile v1','UTF8')),'hex')THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_COLUMN_PROVENANCE';END IF;
 SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='361'AND object_signature='public.collection_membership_receipts'AND grantee='postgres'AND privilege='361 RECEIPT'AND action='granted';
 IF NOT FOUND OR j.object_oid IS DISTINCT FROM 'public.collection_membership_receipts'::regclass::oid OR j.object_owner IS DISTINCT FROM 'postgres'::regrole::oid
  OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to('361 receipt source profile v1','UTF8')),'hex')THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_RECEIPT_PROVENANCE';END IF;
 IF (SELECT count(*)FROM public.migration_privilege_journal WHERE migration='361'AND action='granted')<>16
  OR(SELECT count(DISTINCT recorded_at)FROM public.migration_privilege_journal WHERE migration='361')<>1
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='361'AND NOT(
   (action='granted'AND grantee='postgres'AND((object_signature=ANY(fn_signatures)AND privilege='361 FUNCTION')
    OR(object_signature IN('role:postgres','role:anon','role:authenticated','role:service_role','role:app_tenant')AND privilege='361 AUTHORITY ROLE')
    OR(object_signature='public.collection_membership_receipts'AND privilege='361 RECEIPT')
    OR(object_signature='public.collections.membership_version'AND privilege='361 COLUMN:'||column_number::text)))
   OR(action='revoked'AND object_signature='public.collection_products'AND grantee IN('anon','authenticated','service_role','app_tenant')
    AND privilege IN('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')AND object_oid='public.collection_products'::regclass AND object_owner='postgres'::regrole
    AND object_definition_hash=encode(sha256(convert_to('361 junction ACL restoration v1','UTF8')),'hex')))) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_JOURNAL_PROFILE';END IF;
 -- Unknown dynamic/PLpgSQL callers cannot be guessed away merely because
 -- PostgreSQL does not create normal pg_depend edges for their source strings.
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE NOT(p.oid=ANY(ARRAY(SELECT to_regprocedure(s)::oid FROM unnest(fn_signatures)AS t(s))))
   AND p.prosrc~('\m('||array_to_string(ARRAY['guard_collection_membership_receipt_v1','guard_collection_membership_junction_v1','bump_collection_membership_junction_v1','prepare_collection_membership_revision_v1','record_collection_membership_revision_v1','protect_collection_membership_audit_v1','assert_collection_membership_owner_v1','collection_membership_snapshot_v1','apply_collection_membership_v1']::text[],'|')||')\M'))THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_EXTERNAL_SOURCE_CALLER';END IF;
END $source_preflight$;

-- Normative verifier tables are built from literal361 SOURCE, not from LIKE,
-- CREATE TABLE AS, a copied live definition, or a post-runtime baseline hash.
-- Nothing executes the application trigger functions on these empty verifiers.
CREATE TEMP TABLE __letbuyy361_expected_receipts(
idempotency_key uuid NOT NULL,
 operation text NOT NULL,
 store_id uuid NOT NULL,
 collection_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 expected_version integer NOT NULL,
 product_ids jsonb NOT NULL,
 response jsonb NOT NULL,
 authority_guard regprocedure NOT NULL DEFAULT 'public.assert_collection_membership_owner_v1(uuid,uuid)'::regprocedure,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT collection_membership_receipts_key PRIMARY KEY(idempotency_key),
 CONSTRAINT collection_membership_receipts_operation CHECK(operation='collection.membership.v1'),
 CONSTRAINT collection_membership_receipts_version CHECK(expected_version>0),
 CONSTRAINT collection_membership_receipts_ids CHECK(jsonb_typeof(product_ids)='array' AND jsonb_array_length(product_ids)<=500),
 CONSTRAINT collection_membership_receipts_response CHECK(jsonb_typeof(response)='object')
)ON COMMIT DROP;
CREATE INDEX collection_membership_receipts_target ON __letbuyy361_expected_receipts(store_id,collection_id,created_at);
ALTER TABLE __letbuyy361_expected_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE __letbuyy361_expected_receipts FORCE ROW LEVEL SECURITY;
CREATE TEMP TABLE __letbuyy361_expected_collection_column(__seed boolean)ON COMMIT DROP;
ALTER TABLE __letbuyy361_expected_collection_column ADD COLUMN membership_version integer NOT NULL DEFAULT 1;
ALTER TABLE __letbuyy361_expected_collection_column ADD CONSTRAINT collections_membership_version_check CHECK(membership_version>0);
CREATE TEMP TABLE __letbuyy361_expected_junction(id uuid,collection_id uuid,product_id uuid,position integer)ON COMMIT DROP;
CREATE TEMP TABLE __letbuyy361_expected_audit(action text)ON COMMIT DROP;
CREATE TRIGGER collections_membership_prepare BEFORE INSERT OR UPDATE OR DELETE ON __letbuyy361_expected_collection_column FOR EACH ROW EXECUTE FUNCTION public.prepare_collection_membership_revision_v1();
CREATE TRIGGER collections_membership_history AFTER INSERT OR UPDATE OR DELETE ON __letbuyy361_expected_collection_column FOR EACH ROW EXECUTE FUNCTION public.record_collection_membership_revision_v1();
CREATE TRIGGER collection_products_membership_guard BEFORE INSERT OR UPDATE OR DELETE ON __letbuyy361_expected_junction FOR EACH ROW EXECUTE FUNCTION public.guard_collection_membership_junction_v1();
CREATE TRIGGER collection_products_membership_revision AFTER INSERT OR UPDATE OR DELETE ON __letbuyy361_expected_junction FOR EACH ROW EXECUTE FUNCTION public.bump_collection_membership_junction_v1();
CREATE TRIGGER collection_products_membership_no_truncate BEFORE TRUNCATE ON __letbuyy361_expected_junction FOR EACH STATEMENT EXECUTE FUNCTION public.guard_collection_membership_junction_v1();
CREATE TRIGGER collection_membership_receipts_immutable BEFORE UPDATE OR DELETE ON __letbuyy361_expected_receipts FOR EACH ROW EXECUTE FUNCTION public.guard_collection_membership_receipt_v1();
CREATE TRIGGER collection_membership_receipts_no_truncate BEFORE TRUNCATE ON __letbuyy361_expected_receipts FOR EACH STATEMENT EXECUTE FUNCTION public.guard_collection_membership_receipt_v1();
CREATE TRIGGER audit_collection_membership_immutable BEFORE INSERT OR UPDATE OR DELETE ON __letbuyy361_expected_audit FOR EACH ROW EXECUTE FUNCTION public.protect_collection_membership_audit_v1();
CREATE TRIGGER audit_collection_membership_no_truncate BEFORE TRUNCATE ON __letbuyy361_expected_audit FOR EACH STATEMENT EXECUTE FUNCTION public.protect_collection_membership_audit_v1();

DO $shape_preflight$
DECLARE actual jsonb; expected jsonb; table_name text; temp_name text; type_kind text; row record; role_oid oid;
BEGIN
 SELECT jsonb_build_object(
 'relation',jsonb_build_array(c.relkind,c.relam,c.reltablespace,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,c.relreplident,c.reloftype,c.relispartition),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,a.attlen,a.attbyval,a.attalign,a.attndims,a.attstattarget,a.attstorage,a.attcompression,a.atthasdef,a.atthasmissing,a.attmissingval,a.attoptions,a.attfdwoptions,a.attinhcount,a.attislocal,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid),k.convalidated,k.condeferrable,k.condeferred,k.connoinherit,k.conislocal,k.coninhcount,k.conparentid)ORDER BY k.conname)FROM pg_constraint k WHERE k.conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(CASE WHEN ic.relname~'^pg_toast_[0-9]+_index$'THEN'__toast_index__'ELSE ic.relname::text END,ic.relam,ic.relowner,ic.reloptions,ic.reltablespace,i.indnatts,i.indnkeyatts,i.indisunique,i.indisprimary,i.indisexclusion,i.indimmediate,i.indisclustered,i.indisvalid,i.indcheckxmin,i.indisready,i.indislive,i.indisreplident,i.indnullsnotdistinct,i.indkey::text,i.indcollation::text,i.indclass::text,i.indoption::text,pg_get_expr(i.indexprs,i.indrelid),pg_get_expr(i.indpred,i.indrelid))ORDER BY ic.relname)FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid),
 'policies',(SELECT jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))ORDER BY p.polname)FROM pg_policy p WHERE p.polrelid=c.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(r.oid)ORDER BY r.rulename)FROM pg_rewrite r WHERE r.ev_class=c.oid)) INTO actual FROM pg_class c WHERE c.oid='public.collection_membership_receipts'::regclass;
 SELECT jsonb_build_object(
 'relation',jsonb_build_array(c.relkind,c.relam,c.reltablespace,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,c.relreplident,c.reloftype,c.relispartition),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,a.attlen,a.attbyval,a.attalign,a.attndims,a.attstattarget,a.attstorage,a.attcompression,a.atthasdef,a.atthasmissing,a.attmissingval,a.attoptions,a.attfdwoptions,a.attinhcount,a.attislocal,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid),k.convalidated,k.condeferrable,k.condeferred,k.connoinherit,k.conislocal,k.coninhcount,k.conparentid)ORDER BY k.conname)FROM pg_constraint k WHERE k.conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(CASE WHEN ic.relname~'^pg_toast_[0-9]+_index$'THEN'__toast_index__'ELSE ic.relname::text END,ic.relam,ic.relowner,ic.reloptions,ic.reltablespace,i.indnatts,i.indnkeyatts,i.indisunique,i.indisprimary,i.indisexclusion,i.indimmediate,i.indisclustered,i.indisvalid,i.indcheckxmin,i.indisready,i.indislive,i.indisreplident,i.indnullsnotdistinct,i.indkey::text,i.indcollation::text,i.indclass::text,i.indoption::text,pg_get_expr(i.indexprs,i.indrelid),pg_get_expr(i.indpred,i.indrelid))ORDER BY ic.relname)FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid),
 'policies',(SELECT jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))ORDER BY p.polname)FROM pg_policy p WHERE p.polrelid=c.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(r.oid)ORDER BY r.rulename)FROM pg_rewrite r WHERE r.ev_class=c.oid)) INTO expected FROM pg_class c WHERE c.oid='pg_temp.__letbuyy361_expected_receipts'::regclass;
 IF actual IS DISTINCT FROM expected OR EXISTS(SELECT 1 FROM pg_class WHERE oid='public.collection_membership_receipts'::regclass AND(relowner<>'postgres'::regrole OR relpersistence<>'p'))
  OR(SELECT count(*)FROM pg_attribute WHERE attrelid='public.collection_membership_receipts'::regclass AND attnum>0)<>10
  OR(SELECT count(*)FROM pg_constraint WHERE conrelid='public.collection_membership_receipts'::regclass)<>5
  OR(SELECT count(*)FROM pg_index WHERE indrelid='public.collection_membership_receipts'::regclass)<>2
  OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.collection_membership_receipts'::regclass)
  OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class='public.collection_membership_receipts'::regclass) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_RECEIPT_SOURCE_SHAPE';END IF;
 SELECT jsonb_build_object(
 'relation',jsonb_build_array(c.relkind,c.relam,c.reltablespace,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,c.relreplident,c.reloftype,c.relispartition),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,a.attlen,a.attbyval,a.attalign,a.attndims,a.attstattarget,a.attstorage,a.attcompression,a.atthasdef,a.atthasmissing,a.attmissingval,a.attoptions,a.attfdwoptions,a.attinhcount,a.attislocal,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid),k.convalidated,k.condeferrable,k.condeferred,k.connoinherit,k.conislocal,k.coninhcount,k.conparentid)ORDER BY k.conname)FROM pg_constraint k WHERE k.conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(CASE WHEN ic.relname~'^pg_toast_[0-9]+_index$'THEN'__toast_index__'ELSE ic.relname::text END,ic.relam,ic.relowner,ic.reloptions,ic.reltablespace,i.indnatts,i.indnkeyatts,i.indisunique,i.indisprimary,i.indisexclusion,i.indimmediate,i.indisclustered,i.indisvalid,i.indcheckxmin,i.indisready,i.indislive,i.indisreplident,i.indnullsnotdistinct,i.indkey::text,i.indcollation::text,i.indclass::text,i.indoption::text,pg_get_expr(i.indexprs,i.indrelid),pg_get_expr(i.indpred,i.indrelid))ORDER BY ic.relname)FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid),
 'policies',(SELECT jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))ORDER BY p.polname)FROM pg_policy p WHERE p.polrelid=c.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(r.oid)ORDER BY r.rulename)FROM pg_rewrite r WHERE r.ev_class=c.oid)) INTO actual FROM pg_class c WHERE c.oid=(SELECT reltoastrelid FROM pg_class WHERE oid='public.collection_membership_receipts'::regclass);
 SELECT jsonb_build_object(
 'relation',jsonb_build_array(c.relkind,c.relam,c.reltablespace,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,c.relreplident,c.reloftype,c.relispartition),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,a.attlen,a.attbyval,a.attalign,a.attndims,a.attstattarget,a.attstorage,a.attcompression,a.atthasdef,a.atthasmissing,a.attmissingval,a.attoptions,a.attfdwoptions,a.attinhcount,a.attislocal,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid),k.convalidated,k.condeferrable,k.condeferred,k.connoinherit,k.conislocal,k.coninhcount,k.conparentid)ORDER BY k.conname)FROM pg_constraint k WHERE k.conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(CASE WHEN ic.relname~'^pg_toast_[0-9]+_index$'THEN'__toast_index__'ELSE ic.relname::text END,ic.relam,ic.relowner,ic.reloptions,ic.reltablespace,i.indnatts,i.indnkeyatts,i.indisunique,i.indisprimary,i.indisexclusion,i.indimmediate,i.indisclustered,i.indisvalid,i.indcheckxmin,i.indisready,i.indislive,i.indisreplident,i.indnullsnotdistinct,i.indkey::text,i.indcollation::text,i.indclass::text,i.indoption::text,pg_get_expr(i.indexprs,i.indrelid),pg_get_expr(i.indpred,i.indrelid))ORDER BY ic.relname)FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid),
 'policies',(SELECT jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))ORDER BY p.polname)FROM pg_policy p WHERE p.polrelid=c.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(r.oid)ORDER BY r.rulename)FROM pg_rewrite r WHERE r.ev_class=c.oid)) INTO expected FROM pg_class c WHERE c.oid=(SELECT reltoastrelid FROM pg_class WHERE oid='pg_temp.__letbuyy361_expected_receipts'::regclass);
 IF actual IS NULL OR actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_TOAST_PROFILE';END IF;
 FOR type_kind IN SELECT unnest(ARRAY['row','array'])LOOP
  SELECT jsonb_build_array(t.typowner,t.typlen,t.typbyval,t.typtype,t.typcategory,t.typispreferred,t.typisdefined,t.typdelim,
 CASE WHEN t.typrelid=c.oid THEN '__receipt__'ELSE t.typrelid::text END,
 CASE WHEN t.typelem=c.reltype THEN '__row__'ELSE t.typelem::text END,
 CASE WHEN t.typarray=(SELECT typarray FROM pg_type WHERE oid=c.reltype)THEN'__array__'ELSE t.typarray::text END,
 t.typinput,t.typoutput,t.typreceive,t.typsend,t.typmodin,t.typmodout,t.typanalyze,t.typsubscript,t.typalign,t.typstorage,t.typnotnull,t.typbasetype,t.typtypmod,t.typndims,t.typcollation,t.typdefaultbin::text,t.typdefault,t.typacl) INTO actual FROM pg_class c JOIN pg_type t ON t.oid=CASE WHEN type_kind='row'THEN c.reltype ELSE(SELECT typarray FROM pg_type WHERE oid=c.reltype)END WHERE c.oid='public.collection_membership_receipts'::regclass;
  SELECT jsonb_build_array(t.typowner,t.typlen,t.typbyval,t.typtype,t.typcategory,t.typispreferred,t.typisdefined,t.typdelim,
 CASE WHEN t.typrelid=c.oid THEN '__receipt__'ELSE t.typrelid::text END,
 CASE WHEN t.typelem=c.reltype THEN '__row__'ELSE t.typelem::text END,
 CASE WHEN t.typarray=(SELECT typarray FROM pg_type WHERE oid=c.reltype)THEN'__array__'ELSE t.typarray::text END,
 t.typinput,t.typoutput,t.typreceive,t.typsend,t.typmodin,t.typmodout,t.typanalyze,t.typsubscript,t.typalign,t.typstorage,t.typnotnull,t.typbasetype,t.typtypmod,t.typndims,t.typcollation,t.typdefaultbin::text,t.typdefault,t.typacl) INTO expected FROM pg_class c JOIN pg_type t ON t.oid=CASE WHEN type_kind='row'THEN c.reltype ELSE(SELECT typarray FROM pg_type WHERE oid=c.reltype)END WHERE c.oid='pg_temp.__letbuyy361_expected_receipts'::regclass;
  IF actual IS NULL OR actual IS DISTINCT FROM expected OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_type t ON t.oid=CASE WHEN type_kind='row'THEN c.reltype ELSE(SELECT typarray FROM pg_type WHERE oid=c.reltype)END WHERE c.oid='public.collection_membership_receipts'::regclass AND(t.typnamespace<>'public'::regnamespace OR t.typname<>CASE WHEN type_kind='row'THEN'collection_membership_receipts'ELSE'_collection_membership_receipts'END)) THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_OWN_TYPE_PROFILE:%',type_kind;END IF;
 END LOOP;


 SELECT jsonb_agg(jsonb_build_array(a.grantee,a.grantor,a.privilege_type,a.is_grantable)ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable)INTO actual FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a WHERE c.oid='public.collection_membership_receipts'::regclass;
 SELECT jsonb_agg(jsonb_build_array(a.grantee,a.grantor,a.privilege_type,a.is_grantable)ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable)INTO expected FROM aclexplode(acldefault('r','postgres'::regrole))a;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_RECEIPT_ACL';END IF;
 SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,a.attlen,a.attbyval,a.attalign,a.attndims,a.attstattarget,a.attstorage,a.attcompression,a.atthasdef,a.atthasmissing,a.attmissingval,a.attoptions,a.attfdwoptions,a.attinhcount,a.attislocal,pg_get_expr(d.adbin,d.adrelid)))INTO actual
  FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.collections'::regclass AND a.attname='membership_version'AND NOT a.attisdropped;
 SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,a.attlen,a.attbyval,a.attalign,a.attndims,a.attstattarget,a.attstorage,a.attcompression,a.atthasdef,a.atthasmissing,a.attmissingval,a.attoptions,a.attfdwoptions,a.attinhcount,a.attislocal,pg_get_expr(d.adbin,d.adrelid)))INTO expected
  FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='pg_temp.__letbuyy361_expected_collection_column'::regclass AND a.attname='membership_version'AND NOT a.attisdropped;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_COLUMN_SHAPE';END IF;
 SELECT jsonb_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid),k.convalidated,k.condeferrable,k.condeferred,k.connoinherit,k.conislocal,k.coninhcount,k.conparentid)INTO actual FROM pg_constraint k WHERE k.conrelid='public.collections'::regclass AND k.conname='collections_membership_version_check';
 SELECT jsonb_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid),k.convalidated,k.condeferrable,k.condeferred,k.connoinherit,k.conislocal,k.coninhcount,k.conparentid)INTO expected FROM pg_constraint k WHERE k.conrelid='pg_temp.__letbuyy361_expected_collection_column'::regclass AND k.conname='collections_membership_version_check';
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_COLUMN_CONSTRAINT';END IF;
 FOR table_name,temp_name IN SELECT *FROM(VALUES('collections','__letbuyy361_expected_collection_column'),('collection_products','__letbuyy361_expected_junction'),('collection_membership_receipts','__letbuyy361_expected_receipts'),('audit_activity_events','__letbuyy361_expected_audit'))AS t(name,verifier)LOOP
  SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgfoid,t.tgtype,t.tgenabled,t.tgisinternal,t.tgnargs,encode(t.tgargs,'hex'),t.tgattr::text,t.tgqual::text,t.tgconstraint,t.tgdeferrable,t.tginitdeferred,t.tgoldtable,t.tgnewtable,t.tgparentid) ORDER BY t.tgname)INTO actual FROM pg_trigger t WHERE t.tgrelid=to_regclass('public.'||table_name)AND NOT t.tgisinternal;
  SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgfoid,t.tgtype,t.tgenabled,t.tgisinternal,t.tgnargs,encode(t.tgargs,'hex'),t.tgattr::text,t.tgqual::text,t.tgconstraint,t.tgdeferrable,t.tginitdeferred,t.tgoldtable,t.tgnewtable,t.tgparentid) ORDER BY t.tgname)INTO expected FROM pg_trigger t WHERE t.tgrelid=to_regclass('pg_temp.'||temp_name)AND NOT t.tgisinternal;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_TRIGGER_PROFILE:%',table_name;END IF;
 END LOOP;
 SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantee),pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable)INTO actual FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a WHERE c.oid='public.collection_products'::regclass;
 SELECT jsonb_agg(jsonb_build_array(grantee,'postgres',privilege,false)ORDER BY grantee::regrole::oid,privilege)INTO expected FROM(
  SELECT 'postgres'::text AS grantee,unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])AS privilege UNION ALL SELECT 'service_role','SELECT')AS t;
 IF actual IS DISTINCT FROM expected OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.collection_products'::regclass AND attnum>0 AND attacl IS NOT NULL)THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_JUNCTION_ACL';END IF;
END $shape_preflight$;

CREATE TEMP TABLE __letbuyy361_owned_objects(classid oid,objid oid,objsubid integer,PRIMARY KEY(classid,objid,objsubid))ON COMMIT DROP;
INSERT INTO __letbuyy361_owned_objects SELECT 'pg_proc'::regclass,to_regprocedure(s)::oid,0 FROM unnest(ARRAY['public.guard_collection_membership_receipt_v1()','public.guard_collection_membership_junction_v1()','public.bump_collection_membership_junction_v1()','public.prepare_collection_membership_revision_v1()','public.record_collection_membership_revision_v1()','public.protect_collection_membership_audit_v1()','public.assert_collection_membership_owner_v1(uuid,uuid)','public.collection_membership_snapshot_v1(uuid,uuid)','public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)']::text[])AS t(s);
INSERT INTO __letbuyy361_owned_objects VALUES('pg_class'::regclass,'public.collection_membership_receipts'::regclass,0);
INSERT INTO __letbuyy361_owned_objects SELECT 'pg_class'::regclass,'public.collections'::regclass,attnum FROM pg_attribute WHERE attrelid='public.collections'::regclass AND attname='membership_version'AND NOT attisdropped;
INSERT INTO __letbuyy361_owned_objects SELECT 'pg_constraint'::regclass,oid,0 FROM pg_constraint WHERE conrelid='public.collection_membership_receipts'::regclass OR(conrelid='public.collections'::regclass AND conname='collections_membership_version_check');
INSERT INTO __letbuyy361_owned_objects SELECT 'pg_class'::regclass,indexrelid,0 FROM pg_index WHERE indrelid='public.collection_membership_receipts'::regclass;
INSERT INTO __letbuyy361_owned_objects SELECT 'pg_class'::regclass,indexrelid,0 FROM pg_index WHERE indrelid=(SELECT reltoastrelid FROM pg_class WHERE oid='public.collection_membership_receipts'::regclass);
INSERT INTO __letbuyy361_owned_objects SELECT 'pg_attrdef'::regclass,oid,0 FROM pg_attrdef WHERE adrelid='public.collection_membership_receipts'::regclass OR(adrelid='public.collections'::regclass AND adnum=(SELECT attnum FROM pg_attribute WHERE attrelid='public.collections'::regclass AND attname='membership_version'AND NOT attisdropped));
INSERT INTO __letbuyy361_owned_objects SELECT 'pg_trigger'::regclass,oid,0 FROM pg_trigger WHERE tgname IN('collections_membership_prepare','collections_membership_history','collection_products_membership_guard','collection_products_membership_revision','collection_products_membership_no_truncate','collection_membership_receipts_immutable','collection_membership_receipts_no_truncate','audit_collection_membership_immutable','audit_collection_membership_no_truncate')AND tgrelid IN('public.collections'::regclass,'public.collection_products'::regclass,'public.collection_membership_receipts'::regclass,'public.audit_activity_events'::regclass);
WITH RECURSIVE internal_support(classid,objid,objsubid)AS(
 SELECT classid,objid,objsubid FROM __letbuyy361_owned_objects
 UNION SELECT d.classid,d.objid,d.objsubid FROM pg_depend d JOIN internal_support own ON d.refclassid=own.classid AND d.refobjid=own.objid AND(d.refobjsubid=own.objsubid OR own.objsubid=0) WHERE d.deptype='i'
)INSERT INTO __letbuyy361_owned_objects SELECT *FROM internal_support ON CONFLICT DO NOTHING;
-- Expected temporary triggers refer to the validated public functions solely
-- for catalog flag comparison. Their exact names/relations are closed above.
DO $dependencies$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_depend d JOIN __letbuyy361_owned_objects target ON d.refclassid=target.classid AND d.refobjid=target.objid AND(d.refobjsubid=target.objsubid OR target.objsubid=0)
  WHERE NOT EXISTS(SELECT 1 FROM __letbuyy361_owned_objects own WHERE own.classid=d.classid AND own.objid=d.objid AND(own.objsubid=d.objsubid OR own.objsubid=0))
  AND NOT(d.classid='pg_trigger'::regclass AND EXISTS(SELECT 1 FROM pg_trigger t WHERE t.oid=d.objid AND t.tgname IN('collections_membership_prepare','collections_membership_history','collection_products_membership_guard','collection_products_membership_revision','collection_products_membership_no_truncate','collection_membership_receipts_immutable','collection_membership_receipts_no_truncate','audit_collection_membership_immutable','audit_collection_membership_no_truncate')AND t.tgrelid IN('pg_temp.__letbuyy361_expected_collection_column'::regclass,'pg_temp.__letbuyy361_expected_junction'::regclass,'pg_temp.__letbuyy361_expected_receipts'::regclass,'pg_temp.__letbuyy361_expected_audit'::regclass)))
  AND NOT(d.classid='pg_attrdef'::regclass AND EXISTS(SELECT 1 FROM pg_attrdef a WHERE a.oid=d.objid AND a.adrelid='pg_temp.__letbuyy361_expected_receipts'::regclass AND a.adnum=(SELECT attnum FROM pg_attribute WHERE attrelid=a.adrelid AND attname='authority_guard')))) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_EXTERNAL_DEPENDENCY';END IF;
 IF EXISTS(SELECT 1 FROM pg_depend d JOIN __letbuyy361_owned_objects own ON d.classid=own.classid AND d.objid=own.objid AND(d.objsubid=own.objsubid OR own.objsubid=0)WHERE d.deptype='e')
  OR EXISTS(SELECT 1 FROM pg_description d JOIN __letbuyy361_owned_objects own ON d.classoid=own.classid AND d.objoid=own.objid AND(d.objsubid=own.objsubid OR own.objsubid=0))
  OR EXISTS(SELECT 1 FROM pg_seclabel d JOIN __letbuyy361_owned_objects own ON d.classoid=own.classid AND d.objoid=own.objid AND(d.objsubid=own.objsubid OR own.objsubid=0))THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_ROLLBACK_EXTERNAL_MEMBERSHIP_OR_LABEL';END IF;
END $dependencies$;
-- Remove only verifier objects created by this execution before dropping the
-- public functions to which their trigger/default profiles deliberately refer.
DROP TABLE pg_temp.__letbuyy361_expected_receipts,pg_temp.__letbuyy361_expected_collection_column,pg_temp.__letbuyy361_expected_junction,pg_temp.__letbuyy361_expected_audit,pg_temp.__letbuyy361_owned_objects RESTRICT;
DROP TRIGGER collections_membership_prepare ON public.collections RESTRICT;
DROP TRIGGER collections_membership_history ON public.collections RESTRICT;
DROP TRIGGER collection_products_membership_guard ON public.collection_products RESTRICT;
DROP TRIGGER collection_products_membership_revision ON public.collection_products RESTRICT;
DROP TRIGGER collection_products_membership_no_truncate ON public.collection_products RESTRICT;
DROP TRIGGER collection_membership_receipts_immutable ON public.collection_membership_receipts RESTRICT;
DROP TRIGGER collection_membership_receipts_no_truncate ON public.collection_membership_receipts RESTRICT;
DROP TRIGGER audit_collection_membership_immutable ON public.audit_activity_events RESTRICT;
DROP TRIGGER audit_collection_membership_no_truncate ON public.audit_activity_events RESTRICT;
DROP FUNCTION public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb) RESTRICT;
DROP TABLE public.collection_membership_receipts RESTRICT;
DROP FUNCTION public.guard_collection_membership_receipt_v1() RESTRICT;
DROP FUNCTION public.guard_collection_membership_junction_v1() RESTRICT;
DROP FUNCTION public.bump_collection_membership_junction_v1() RESTRICT;
DROP FUNCTION public.prepare_collection_membership_revision_v1() RESTRICT;
DROP FUNCTION public.record_collection_membership_revision_v1() RESTRICT;
DROP FUNCTION public.protect_collection_membership_audit_v1() RESTRICT;
DROP FUNCTION public.assert_collection_membership_owner_v1(uuid,uuid) RESTRICT;
DROP FUNCTION public.collection_membership_snapshot_v1(uuid,uuid) RESTRICT;
ALTER TABLE public.collections DROP CONSTRAINT collections_membership_version_check RESTRICT;
ALTER TABLE public.collections DROP COLUMN membership_version RESTRICT;

REVOKE ALL ON TABLE public.collection_products FROM PUBLIC,anon,authenticated,app_tenant,service_role;
DO $restore_acl$
DECLARE entry record;
BEGIN
 FOR entry IN SELECT grantee,privilege FROM public.migration_privilege_journal WHERE migration='361'AND object_signature='public.collection_products'AND action='revoked'ORDER BY grantee,privilege LOOP
  -- Source preflight restricted both tokens to a closed privilege/role set.
  EXECUTE format('GRANT %s ON TABLE public.collection_products TO %I',entry.privilege,entry.grantee);
 END LOOP;
END $restore_acl$;
DELETE FROM public.migration_privilege_journal WHERE migration='361';
NOTIFY pgrst,'reload schema';
COMMIT;
