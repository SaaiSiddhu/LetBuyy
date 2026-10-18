-- N3.2 canonical manual membership command, monotonic revision and private receipts.
-- Prepared SOURCE ONLY under the coordinator's exact361 grant; no hosted apply.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:361:collection-membership',0));
DO $dependency$
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
 IF to_regclass('public.collections') IS NULL OR to_regclass('public.collection_products')IS NULL
  OR to_regclass('public.audit_activity_events')IS NULL OR to_regclass('public.outbox_events')IS NULL OR to_regclass('public.migration_privilege_journal')IS NULL
  OR to_regclass('public.collection_membership_receipts')IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.collections'::regclass AND attname='membership_version' AND NOT attisdropped)
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='361')
  OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('guard_collection_membership_receipt_v1','guard_collection_membership_junction_v1','bump_collection_membership_junction_v1','prepare_collection_membership_revision_v1','record_collection_membership_revision_v1','protect_collection_membership_audit_v1','assert_collection_membership_owner_v1','collection_membership_snapshot_v1','apply_collection_membership_v1')) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_DEPENDENCY_OR_EXISTING_FOOTPRINT';END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN('public.collections'::regclass,'public.collection_products'::regclass,'public.audit_activity_events'::regclass) AND (relowner<>'postgres'::regrole OR relkind<>'r' OR relpersistence<>'p'))
  OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.collection_products'::regclass AND attnum>0 AND attacl IS NOT NULL)
  OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))x WHERE c.oid='public.collection_products'::regclass
   AND (x.grantor<>c.relowner OR x.grantee NOT IN(c.relowner,'anon'::regrole,'authenticated'::regrole,'service_role'::regrole,'app_tenant'::regrole) OR x.is_grantable)) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP361_UNKNOWN_OWNER_OR_ACL';END IF;
END $dependency$;
LOCK TABLE public.collections,public.collection_products,public.audit_activity_events,public.outbox_events IN ACCESS EXCLUSIVE MODE;

-- Record only the grants actually narrowed on this existing junction. Known
-- legacy/current default ACL variants are restored by an EMPTY-only retirement.
INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
SELECT '361','public.collection_products',pg_get_userbyid(x.grantee),x.privilege_type,'revoked',c.oid,c.relowner,encode(sha256(convert_to('361 junction ACL restoration v1','UTF8')),'hex')
FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))x
WHERE c.oid='public.collection_products'::regclass AND x.grantee<>c.relowner;
REVOKE ALL ON TABLE public.collection_products FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT SELECT ON TABLE public.collection_products TO service_role;

ALTER TABLE public.collections ADD COLUMN membership_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.collections ADD CONSTRAINT collections_membership_version_check CHECK(membership_version>0);

CREATE FUNCTION public.assert_collection_membership_owner_v1(p_store_id uuid,p_actor_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'app_tenant' OR current_setting('session_replication_role') IS DISTINCT FROM 'origin'
  OR p_store_id IS NULL OR p_actor_id IS NULL OR nullif(current_setting('app.site_id',true),'') IS DISTINCT FROM p_store_id::text
  OR nullif(current_setting('app.actor_id',true),'') IS DISTINCT FROM p_actor_id::text OR nullif(current_setting('app.request_id',true),'') IS NULL THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM id FROM public.users_custom WHERE id=p_actor_id AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM id FROM public.sites WHERE id=p_store_id AND deleted_at IS NULL AND (custom_user_id=p_actor_id OR user_id=p_actor_id) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_FORBIDDEN' USING ERRCODE='42501';END IF;
END
$fn$;
CREATE TABLE public.collection_membership_receipts (
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
);
CREATE INDEX collection_membership_receipts_target ON public.collection_membership_receipts(store_id,collection_id,created_at);
ALTER TABLE public.collection_membership_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_membership_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.collection_membership_receipts FROM PUBLIC,anon,authenticated,app_tenant,service_role;

CREATE FUNCTION public.guard_collection_membership_receipt_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 RAISE EXCEPTION 'collection membership receipts are immutable' USING ERRCODE='42501';
END
$fn$;

CREATE FUNCTION public.guard_collection_membership_junction_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE parent public.collections%ROWTYPE; product_store uuid; product_deleted timestamptz;
BEGIN
 IF TG_OP='TRUNCATE' OR current_user::regrole::oid IS DISTINCT FROM (SELECT relowner FROM pg_class WHERE oid='public.collections'::regclass) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_RAW_WRITE_FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('letbuyy:migration:361:collection-membership',0));
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 SELECT * INTO parent FROM public.collections WHERE id=NEW.collection_id FOR UPDATE;
 IF NOT FOUND OR parent.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 SELECT store_id,deleted_at INTO product_store,product_deleted FROM public.products WHERE id=NEW.product_id FOR SHARE;
 IF NOT FOUND OR product_store IS DISTINCT FROM parent.store_id OR product_deleted IS NOT NULL THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 RETURN NEW;
END
$fn$;

CREATE FUNCTION public.bump_collection_membership_junction_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE target uuid; old_id uuid; new_id uuid;
BEGIN
 IF TG_OP='UPDATE' AND to_jsonb(NEW) IS NOT DISTINCT FROM to_jsonb(OLD) THEN RETURN NEW;END IF;
 IF TG_OP<>'INSERT' THEN old_id:=OLD.collection_id;END IF;
 IF TG_OP<>'DELETE' THEN new_id:=NEW.collection_id;END IF;
 FOR target IN SELECT DISTINCT id FROM unnest(ARRAY[old_id,new_id]) AS t(id) WHERE id IS NOT NULL ORDER BY id LOOP
  UPDATE public.collections SET updated_at=clock_timestamp() WHERE id=target;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END
$fn$;

CREATE FUNCTION public.prepare_collection_membership_revision_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE owner_name text;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('letbuyy:migration:361:collection-membership',0));
 IF TG_OP='INSERT' THEN
  IF NEW.membership_version IS DISTINCT FROM 1 OR EXISTS(SELECT 1 FROM public.audit_activity_events WHERE resource_type='collection' AND resource_id=NEW.id::text AND action IN('collection.membership.revision','collection.membership.updated')) THEN
   RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_ID_HISTORY' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN
  SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='public.collections'::regclass;
  IF current_setting('role',true) NOT IN('none',owner_name) THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_RAW_WRITE_FORBIDDEN' USING ERRCODE='42501';END IF;
  RETURN OLD;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.store_id IS DISTINCT FROM OLD.store_id OR NEW.membership_version IS DISTINCT FROM OLD.membership_version THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_VERSION_TAMPER' USING ERRCODE='42501';END IF;
 NEW.membership_version:=OLD.membership_version+1;
 RETURN NEW;
END
$fn$;

CREATE FUNCTION public.record_collection_membership_revision_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE subject uuid; tenant uuid; previous jsonb; following jsonb;
BEGIN
 IF TG_OP='INSERT' THEN subject:=NEW.id;tenant:=NEW.store_id;previous:=NULL;following:=to_jsonb(NEW);
 ELSIF TG_OP='DELETE' THEN subject:=OLD.id;tenant:=OLD.store_id;previous:=to_jsonb(OLD);following:=NULL;
 ELSE subject:=NEW.id;tenant:=NEW.store_id;previous:=to_jsonb(OLD);following:=to_jsonb(NEW);END IF;
 INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,request_id,before_state,after_state,metadata)
 VALUES(tenant,NULL,'system','collection.membership.revision','collection',subject::text,nullif(current_setting('app.request_id',true),''),previous,following,
  jsonb_build_object('source','collection_membership_revision_trigger','transition',TG_OP,'database_role',current_setting('role',true)));
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END
$fn$;

CREATE FUNCTION public.protect_collection_membership_audit_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE owner_oid oid;
BEGIN
 SELECT relowner INTO owner_oid FROM pg_class WHERE oid='public.audit_activity_events'::regclass;
 IF TG_OP='TRUNCATE' THEN
  IF current_user::regrole::oid IS DISTINCT FROM owner_oid OR EXISTS(SELECT 1 FROM public.audit_activity_events WHERE action IN('collection.membership.revision','collection.membership.updated')) THEN
   RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_AUDIT_RETAINED' USING ERRCODE='42501';END IF;RETURN NULL;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.action IN('collection.membership.revision','collection.membership.updated') AND current_user::regrole::oid IS DISTINCT FROM owner_oid THEN
   RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_AUDIT_FORBIDDEN' USING ERRCODE='42501';END IF;RETURN NEW;
 END IF;
 IF OLD.action IN('collection.membership.revision','collection.membership.updated') OR (TG_OP='UPDATE' AND NEW.action IN('collection.membership.revision','collection.membership.updated')) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_AUDIT_RETAINED' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END
$fn$;

CREATE FUNCTION public.collection_membership_snapshot_v1(p_store_id uuid,p_collection_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $fn$
 SELECT jsonb_build_object('collection_id',c.id,'store_id',c.store_id,'membership_version',c.membership_version,
  'product_ids',coalesce(a.ids,'[]'::jsonb),'products',coalesce(a.products,'[]'::jsonb),'unavailable_product_ids',coalesce(a.unavailable,'[]'::jsonb))
 FROM public.collections c LEFT JOIN LATERAL(
  SELECT jsonb_agg(cp.product_id ORDER BY cp.position,cp.id) AS ids,
   jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'price',p.price,'is_active',p.is_active,'thumbnail_url',p.thumbnail_url) ORDER BY cp.position,cp.id) FILTER(WHERE p.id IS NOT NULL) AS products,
   jsonb_agg(cp.product_id ORDER BY cp.position,cp.id) FILTER(WHERE p.id IS NULL) AS unavailable
  FROM public.collection_products cp LEFT JOIN public.products p ON p.id=cp.product_id AND p.store_id=c.store_id AND p.deleted_at IS NULL WHERE cp.collection_id=c.id
 )a ON true WHERE c.id=p_collection_id AND c.store_id=p_store_id AND c.deleted_at IS NULL;
$fn$;

CREATE FUNCTION public.apply_collection_membership_v1(p_store_id uuid,p_collection_id uuid,p_actor_id uuid,p_expected_version integer,p_idempotency_key uuid,p_product_ids jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE parent public.collections%ROWTYPE; receipt public.collection_membership_receipts%ROWTYPE; ids uuid[]; product public.products%ROWTYPE; validated integer:=0; previous jsonb; response jsonb; request_id text;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('letbuyy:migration:361:collection-membership',0));
 PERFORM public.assert_collection_membership_owner_v1(p_store_id,p_actor_id);
 IF p_collection_id IS NULL OR p_expected_version IS NULL OR p_expected_version<=0 OR p_idempotency_key IS NULL OR jsonb_typeof(p_product_ids) IS DISTINCT FROM 'array' OR jsonb_array_length(p_product_ids)>500 THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_product_ids) AS j(value) WHERE jsonb_typeof(value)<>'string' OR value#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 SELECT coalesce(array_agg((value#>>'{}')::uuid ORDER BY ordinal),'{}'::uuid[]) INTO ids FROM jsonb_array_elements(p_product_ids) WITH ORDINALITY AS j(value,ordinal);
 IF cardinality(ids)<>(SELECT count(DISTINCT id)FROM unnest(ids)AS t(id))THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:collection.membership.v1:'||p_idempotency_key::text,0));
 SELECT * INTO parent FROM public.collections WHERE id=p_collection_id AND store_id=p_store_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_NOT_FOUND';END IF;
 SELECT * INTO receipt FROM public.collection_membership_receipts WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF receipt.operation<>'collection.membership.v1' OR receipt.store_id IS DISTINCT FROM p_store_id OR receipt.collection_id IS DISTINCT FROM p_collection_id OR receipt.actor_id IS DISTINCT FROM p_actor_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.product_ids IS DISTINCT FROM p_product_ids THEN
   RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_KEY_CONFLICT';END IF;RETURN receipt.response;
 END IF;
 IF EXISTS(SELECT 1 FROM public.idempotency_keys WHERE site_id=p_store_id AND scope='http:PUT:/products/collections/'||p_collection_id::text||'/products' AND key=p_idempotency_key::text) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_LEGACY_KEY';END IF;
 IF parent.membership_version<>p_expected_version THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_VERSION_CONFLICT';END IF;
 FOR product IN SELECT p.* FROM public.products p WHERE p.id=ANY(ids) AND p.store_id=p_store_id AND p.deleted_at IS NULL ORDER BY p.id FOR SHARE LOOP validated:=validated+1;END LOOP;
 IF validated<>cardinality(ids)THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 previous:=public.collection_membership_snapshot_v1(p_store_id,p_collection_id);
 DELETE FROM public.collection_products WHERE collection_id=p_collection_id AND NOT(product_id=ANY(ids));
 INSERT INTO public.collection_products(collection_id,product_id,position)
 SELECT p_collection_id,id,ordinal-1 FROM unnest(ids)WITH ORDINALITY AS t(id,ordinal)
 ON CONFLICT(collection_id,product_id)DO UPDATE SET position=EXCLUDED.position;
 UPDATE public.collections SET updated_by=p_actor_id,updated_at=clock_timestamp()WHERE id=p_collection_id AND store_id=p_store_id;
 response:=public.collection_membership_snapshot_v1(p_store_id,p_collection_id);request_id:=current_setting('app.request_id');
 IF jsonb_array_length(response->'unavailable_product_ids')<>0 THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,request_id,before_state,after_state,metadata)
 VALUES(p_store_id,p_actor_id,'user','collection.membership.updated','collection',p_collection_id::text,request_id,previous,response,jsonb_build_object('idempotency_key',p_idempotency_key,'expected_version',p_expected_version,'membership_version',response->'membership_version'));
 INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
 VALUES(p_store_id,p_store_id,'collection',p_collection_id::text,'collection.membership.updated',jsonb_build_object('site_id',p_store_id,'collection_id',p_collection_id,'membership_version',response->'membership_version'),'collection.membership.updated:'||p_idempotency_key::text,request_id,p_actor_id,1);
 INSERT INTO public.collection_membership_receipts(idempotency_key,operation,store_id,collection_id,actor_id,expected_version,product_ids,response)
 VALUES(p_idempotency_key,'collection.membership.v1',p_store_id,p_collection_id,p_actor_id,p_expected_version,p_product_ids,response);
 RETURN response;
END
$fn$;
CREATE TRIGGER collections_membership_prepare BEFORE INSERT OR UPDATE OR DELETE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.prepare_collection_membership_revision_v1();
CREATE TRIGGER collections_membership_history AFTER INSERT OR UPDATE OR DELETE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.record_collection_membership_revision_v1();
CREATE TRIGGER collection_products_membership_guard BEFORE INSERT OR UPDATE OR DELETE ON public.collection_products FOR EACH ROW EXECUTE FUNCTION public.guard_collection_membership_junction_v1();
CREATE TRIGGER collection_products_membership_revision AFTER INSERT OR UPDATE OR DELETE ON public.collection_products FOR EACH ROW EXECUTE FUNCTION public.bump_collection_membership_junction_v1();
CREATE TRIGGER collection_products_membership_no_truncate BEFORE TRUNCATE ON public.collection_products FOR EACH STATEMENT EXECUTE FUNCTION public.guard_collection_membership_junction_v1();
CREATE TRIGGER collection_membership_receipts_immutable BEFORE UPDATE OR DELETE ON public.collection_membership_receipts FOR EACH ROW EXECUTE FUNCTION public.guard_collection_membership_receipt_v1();
CREATE TRIGGER collection_membership_receipts_no_truncate BEFORE TRUNCATE ON public.collection_membership_receipts FOR EACH STATEMENT EXECUTE FUNCTION public.guard_collection_membership_receipt_v1();
CREATE TRIGGER audit_collection_membership_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.audit_activity_events FOR EACH ROW EXECUTE FUNCTION public.protect_collection_membership_audit_v1();
CREATE TRIGGER audit_collection_membership_no_truncate BEFORE TRUNCATE ON public.audit_activity_events FOR EACH STATEMENT EXECUTE FUNCTION public.protect_collection_membership_audit_v1();
REVOKE ALL ON FUNCTION public.guard_collection_membership_receipt_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.guard_collection_membership_junction_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.bump_collection_membership_junction_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.prepare_collection_membership_revision_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.record_collection_membership_revision_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.protect_collection_membership_audit_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.assert_collection_membership_owner_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.collection_membership_snapshot_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb) TO app_tenant;

-- Own-object provenance supplements, rather than replaces, the static source
-- and schema/ACL/dependency/role checks embedded in the paired retirement.
DO $provenance$
DECLARE signature text; role_name text; role_oid oid; f record; c record; column_number integer;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.guard_collection_membership_receipt_v1()','public.guard_collection_membership_junction_v1()','public.bump_collection_membership_junction_v1()','public.prepare_collection_membership_revision_v1()','public.record_collection_membership_revision_v1()','public.protect_collection_membership_audit_v1()','public.assert_collection_membership_owner_v1(uuid,uuid)','public.collection_membership_snapshot_v1(uuid,uuid)','public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)'] LOOP
  SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure(signature);
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
  VALUES('361',signature,current_user,'361 FUNCTION','granted',f.oid,f.proowner,encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex'));
 END LOOP;
 FOREACH role_name IN ARRAY ARRAY['postgres','anon','authenticated','service_role','app_tenant'] LOOP
  SELECT oid INTO role_oid FROM pg_roles WHERE rolname=role_name;
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
  VALUES('361','role:'||role_name,current_user,'361 AUTHORITY ROLE','granted',role_oid,'postgres'::regrole,encode(sha256(convert_to('361 source authority role profile v1','UTF8')),'hex'));
 END LOOP;
 SELECT * INTO c FROM pg_class WHERE oid='public.collection_membership_receipts'::regclass;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('361','public.collection_membership_receipts',current_user,'361 RECEIPT','granted',c.oid,c.relowner,encode(sha256(convert_to('361 receipt source profile v1','UTF8')),'hex'));
 SELECT * INTO c FROM pg_class WHERE oid='public.collections'::regclass;
 SELECT attnum INTO column_number FROM pg_attribute WHERE attrelid=c.oid AND attname='membership_version' AND NOT attisdropped;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('361','public.collections.membership_version',current_user,'361 COLUMN:'||column_number::text,'granted',c.oid,c.relowner,encode(sha256(convert_to('361 membership column source profile v1','UTF8')),'hex'));
END $provenance$;
NOTIFY pgrst,'reload schema';
COMMIT;
