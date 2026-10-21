-- Private canonical review authorship and one atomic current-source write. No historical attribution.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:357:buyer-review-ownership',0));
-- Catalog locks block later DDL. Native CREATE may already have released a
-- catalog relation lock, so the foreign/prepared write-XID refusal is essential.
-- Preserve native catalog exclusion. Managed PostgreSQL requires the reviewed
-- provider-admin bootstrap; no advisory/event-trigger substitute is accepted.
DO $managed_catalog_fence$
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_attribute,
 pg_catalog.pg_constraint,pg_catalog.pg_index,pg_catalog.pg_trigger,
 pg_catalog.pg_policy,pg_catalog.pg_depend,pg_catalog.pg_type,pg_catalog.pg_namespace,
 pg_catalog.pg_authid,pg_catalog.pg_auth_members IN SHARE ROW EXCLUSIVE MODE;
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
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['pg_catalog.pg_proc'::pg_catalog.regclass,'pg_catalog.pg_class'::pg_catalog.regclass,'pg_catalog.pg_attribute'::pg_catalog.regclass,'pg_catalog.pg_constraint'::pg_catalog.regclass,'pg_catalog.pg_index'::pg_catalog.regclass,'pg_catalog.pg_trigger'::pg_catalog.regclass,'pg_catalog.pg_policy'::pg_catalog.regclass,'pg_catalog.pg_depend'::pg_catalog.regclass,'pg_catalog.pg_type'::pg_catalog.regclass,'pg_catalog.pg_namespace'::pg_catalog.regclass,'pg_catalog.pg_authid'::pg_catalog.regclass,'pg_catalog.pg_auth_members'::pg_catalog.regclass]::oid[]) catalog_oid
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
     AND l.locktype='relation' AND l.relation=catalog_oid AND l.granted
     AND l.mode IN('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
     AND l.database IN(0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())))) THEN
   RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED';END IF;
 END IF;
END $managed_catalog_fence$;
DO $quiescent_precondition$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed'
  OR EXISTS(SELECT 1 FROM pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock'
   AND l.granted AND(l.pid IS NULL OR l.pid<>pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_prepared_xacts) THEN
  RAISE EXCEPTION 'migration357 refuses concurrent/prepared writes or non-read-committed state';END IF;
END $quiescent_precondition$;
LOCK TABLE public.product_reviews,public.store_customers,public.buyer_accounts,
 public.buyer_store_customers,public.products,public.sites,public.migration_privilege_journal
 IN SHARE ROW EXCLUSIVE MODE;
DO $precondition$ BEGIN
 IF to_regclass('public.buyer_review_links') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY(ARRAY[
   'buyer_review_links_pkey','buyer_review_links_buyer_site_idx','product_reviews_buyer_ownership_key','store_customers_buyer_review_scope_key']))
  OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['create_storefront_buyer_review_v1','protect_buyer_review_link_v1']))
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='357')
  OR EXISTS(SELECT 1 FROM pg_proc WHERE prokind IN('f','p') AND NOT(pronamespace='public'::regnamespace AND proname=ANY(ARRAY['create_storefront_buyer_review_v1','protect_buyer_review_link_v1'])) AND prosrc ILIKE '%buyer_review_links%')
  OR EXISTS(SELECT 1 FROM pg_constraint WHERE(conrelid='public.product_reviews'::regclass AND conname='product_reviews_buyer_ownership_key')
   OR(conrelid='public.store_customers'::regclass AND conname='store_customers_buyer_review_scope_key')) THEN
  RAISE EXCEPTION 'migration357 refuses preexisting ownership schema, function family or provenance';END IF;
 IF EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole=current_user::regrole AND d.defaclnamespace IN(0,'public'::regnamespace)
   AND d.defaclobjtype IN('r','f') AND a.grantee NOT IN(0,current_user::regrole::oid,
    'service_role'::regrole::oid,'anon'::regrole::oid,'authenticated'::regrole::oid,'app_tenant'::regrole::oid)) THEN
  RAISE EXCEPTION 'migration357 refuses unknown default privilege profile';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls AND NOT rolsuper AND NOT rolcanlogin AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=ANY(ARRAY['anon','authenticated','app_tenant'])
   AND(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolcanlogin)) THEN
  RAISE EXCEPTION 'migration357 refuses unexpected runtime role profile';END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant']) r
  WHERE pg_has_role(r::name,'service_role'::name,'MEMBER') OR pg_has_role(r::name,current_user::name,'MEMBER')) THEN
  RAISE EXCEPTION 'migration357 refuses inherited private authority';END IF;
 -- Only the existing canonical source columns/types are used; no legacy row is attributed.
 IF NOT EXISTS(SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid='public.buyer_store_customers'::regclass AND x.relname='buyer_store_customers_buyer_site_key'
  AND i.indisunique AND i.indisvalid AND i.indisready AND i.indnkeyatts=2 AND i.indpred IS NULL AND i.indexprs IS NULL
  AND pg_get_indexdef(i.indexrelid,1,true)='buyer_account_id' AND pg_get_indexdef(i.indexrelid,2,true)='site_id')
  OR NOT EXISTS(SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid='public.buyer_store_customers'::regclass AND x.relname='buyer_store_customers_store_customer_key'
  AND i.indisunique AND i.indisvalid AND i.indisready AND i.indnkeyatts=1 AND i.indpred IS NULL AND i.indexprs IS NULL AND pg_get_indexdef(i.indexrelid,1,true)='store_customer_id') THEN
  RAISE EXCEPTION 'migration357 requires unambiguous canonical relationship keys';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.buyer_accounts'::regclass AND attname='session_epoch' AND atttypid='integer'::regtype AND attnotnull AND NOT attisdropped)
  OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.buyer_store_customers'::regclass AND attname='verified_at' AND atttypid='timestamptz'::regtype AND NOT attisdropped)
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.buyer_store_customers'::regclass AND conname='buyer_store_customers_verified_at_check') THEN
  RAISE EXCEPTION 'migration357 requires canonical verified ownership and session sources';END IF;
END $precondition$;
ALTER TABLE public.product_reviews ADD CONSTRAINT product_reviews_buyer_ownership_key UNIQUE(id,store_id,product_id);
ALTER TABLE public.store_customers ADD CONSTRAINT store_customers_buyer_review_scope_key UNIQUE(id,store_id);
CREATE TABLE public.buyer_review_links (
 review_id uuid PRIMARY KEY,
 buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
 site_id uuid NOT NULL REFERENCES public.sites(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
 store_customer_id uuid NOT NULL,
 product_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT buyer_review_links_review_scope_fkey FOREIGN KEY(review_id,site_id,product_id)
  REFERENCES public.product_reviews(id,store_id,product_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
 CONSTRAINT buyer_review_links_customer_scope_fkey FOREIGN KEY(store_customer_id,site_id)
  REFERENCES public.store_customers(id,store_id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX buyer_review_links_buyer_site_idx ON public.buyer_review_links(buyer_account_id,site_id,product_id);
ALTER TABLE public.buyer_review_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_review_links FORCE ROW LEVEL SECURITY;
CREATE POLICY buyer_review_links_backend ON public.buyer_review_links FOR ALL TO service_role USING(true) WITH CHECK(true);
REVOKE ALL ON public.buyer_review_links FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT SELECT,INSERT ON public.buyer_review_links TO service_role;

-- Immutable private author provenance. No platform subject is added to review content.
CREATE FUNCTION public.protect_buyer_review_link_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Buyer review author evidence is immutable' USING ERRCODE='42501';END IF;
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'Backend review writer required' USING ERRCODE='42501';END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Current review snapshot required' USING ERRCODE='40001';END IF;
 IF(nullif(current_setting('app.site_id',true),'') IS NOT NULL AND current_setting('app.site_id',true) IS DISTINCT FROM NEW.site_id::text)
  OR(nullif(current_setting('app.tenant_id',true),'') IS NOT NULL AND current_setting('app.tenant_id',true) IS DISTINCT FROM NEW.site_id::text) THEN
  RAISE EXCEPTION 'Current review scope required' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:buyer-review:'||NEW.buyer_account_id::text,0));
 IF EXISTS(SELECT 1 FROM public.buyer_review_links e JOIN public.product_reviews r ON r.id=e.review_id
  WHERE e.buyer_account_id=NEW.buyer_account_id AND e.site_id=NEW.site_id AND e.product_id=NEW.product_id
   AND e.review_id<>NEW.review_id AND r.deleted_at IS NULL) THEN
  RAISE EXCEPTION 'Canonical author already reviewed this product' USING ERRCODE='23505';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.product_reviews r
  JOIN public.buyer_store_customers l ON l.buyer_account_id=NEW.buyer_account_id AND l.site_id=NEW.site_id AND l.store_customer_id=NEW.store_customer_id
  JOIN public.store_customers c ON c.id=l.store_customer_id AND c.store_id=NEW.site_id
  JOIN public.buyer_accounts b ON b.id=l.buyer_account_id
  JOIN public.products p ON p.id=r.product_id AND p.store_id=NEW.site_id
  JOIN public.sites s ON s.id=NEW.site_id
  WHERE r.id=NEW.review_id AND r.store_id=NEW.site_id AND r.product_id=NEW.product_id
   AND r.is_verified AND NOT r.is_approved AND r.status='pending' AND r.deleted_at IS NULL
   AND l.verified_at IS NOT NULL AND l.link_basis IN('verified_email','operator_resolution')
   AND c.status='active' AND c.deleted_at IS NULL AND b.status='active'
   AND r.customer_email IS NOT DISTINCT FROM c.email AND p.deleted_at IS NULL
   AND p.is_active IS DISTINCT FROM false AND p.status IS DISTINCT FROM 'archived'
   AND s.deleted_at IS NULL AND s.site_type='store') THEN
  RAISE EXCEPTION 'Current review ownership is unavailable' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER buyer_review_links_guard BEFORE INSERT OR UPDATE OR DELETE ON public.buyer_review_links
 FOR EACH ROW EXECUTE FUNCTION public.protect_buyer_review_link_v1();
CREATE TRIGGER buyer_review_links_truncate_guard BEFORE TRUNCATE ON public.buyer_review_links
 FOR EACH STATEMENT EXECUTE FUNCTION public.protect_buyer_review_link_v1();

CREATE FUNCTION public.create_storefront_buyer_review_v1(p_buyer uuid,p_site uuid,p_epoch integer,
 p_product uuid,p_rating integer,p_title text,p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE b public.buyer_accounts; c public.store_customers; l public.buyer_store_customers;
 p public.products; provisional_customer uuid; v_review_id uuid;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'Backend review writer required' USING ERRCODE='42501';END IF;
 -- A repeatable-read snapshot could miss a winner after waiting for the buyer
 -- lock. The canonical PostgREST transport uses read committed; refuse others.
 IF current_setting('transaction_isolation')<>'read committed' THEN RETURN jsonb_build_object('accepted',false,'code','REVIEW_SOURCE_BUSY');END IF;
 IF p_buyer IS NULL OR p_site IS NULL OR p_epoch IS NULL OR p_epoch<1 OR p_product IS NULL
  OR p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR length(p_title)>120 OR length(p_body)>2000 THEN
  RETURN jsonb_build_object('accepted',false,'code','VALIDATION');END IF;
 IF(nullif(current_setting('app.site_id',true),'') IS NOT NULL AND current_setting('app.site_id',true) IS DISTINCT FROM p_site::text)
  OR(nullif(current_setting('app.tenant_id',true),'') IS NOT NULL AND current_setting('app.tenant_id',true) IS DISTINCT FROM p_site::text) THEN
  RETURN jsonb_build_object('accepted',false,'code','BUYER_SCOPE_MISMATCH');END IF;
 -- This review-only lock is never acquired by255 link resolution. It serializes
 -- duplicate decisions for a canonical subject without upgrading the buyer row.
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:buyer-review:'||p_buyer::text,0));
 SELECT * INTO b FROM public.buyer_accounts WHERE id=p_buyer FOR SHARE NOWAIT;
 IF NOT FOUND OR b.session_epoch IS DISTINCT FROM p_epoch THEN RETURN jsonb_build_object('accepted',false,'code','BUYER_SESSION_INVALID');END IF;
 IF b.status IS DISTINCT FROM 'active' THEN RETURN jsonb_build_object('accepted',false,'code','BUYER_DISABLED');END IF;
 PERFORM 1 FROM public.sites WHERE id=p_site AND deleted_at IS NULL AND site_type='store' FOR SHARE NOWAIT;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','NOT_FOUND');END IF;
 -- A provisional lookup is not authority. Lock customer BEFORE link, matching
 --255's customer->link order, then re-read the exact relationship under its lock.
 SELECT store_customer_id INTO provisional_customer FROM public.buyer_store_customers WHERE buyer_account_id=p_buyer AND site_id=p_site;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','STORE_ACCOUNT_NOT_LINKED');END IF;
 SELECT * INTO c FROM public.store_customers WHERE id=provisional_customer AND store_id=p_site FOR SHARE NOWAIT;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','STORE_ACCOUNT_NOT_LINKED');END IF;
 SELECT * INTO l FROM public.buyer_store_customers WHERE buyer_account_id=p_buyer AND site_id=p_site
  AND store_customer_id=provisional_customer FOR SHARE NOWAIT;
 IF NOT FOUND OR l.verified_at IS NULL OR l.link_basis NOT IN('verified_email','operator_resolution') OR nullif(btrim(c.email),'') IS NULL THEN
  RETURN jsonb_build_object('accepted',false,'code','STORE_ACCOUNT_NOT_LINKED');END IF;
 IF c.status IS DISTINCT FROM 'active' OR c.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('accepted',false,'code','STORE_ACCOUNT_UNAVAILABLE');END IF;
 SELECT * INTO p FROM public.products WHERE id=p_product AND store_id=p_site AND deleted_at IS NULL FOR SHARE NOWAIT;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','NOT_FOUND');END IF;
 IF p.is_active IS FALSE OR p.status='archived' THEN RETURN jsonb_build_object('accepted',false,'code','PRODUCT_UNAVAILABLE');END IF;
 -- Historical/anonymous contact matches are not authorship. Only this private
 -- immutable edge establishes canonical authorship; soft-deleted content stays retained.
 IF EXISTS(SELECT 1 FROM public.buyer_review_links e JOIN public.product_reviews r ON r.id=e.review_id
  WHERE e.buyer_account_id=p_buyer AND e.site_id=p_site AND e.product_id=p_product AND r.deleted_at IS NULL) THEN
  RETURN jsonb_build_object('accepted',false,'code','CONFLICT');END IF;
 INSERT INTO public.product_reviews(store_id,product_id,customer_name,customer_email,rating,title,body,is_verified,is_approved,status)
 VALUES(p_site,p_product,coalesce(nullif(c.full_name,''),'Customer'),c.email,p_rating,nullif(btrim(p_title),''),nullif(btrim(p_body),''),true,false,'pending')
 RETURNING id INTO v_review_id;
 INSERT INTO public.buyer_review_links(review_id,buyer_account_id,site_id,store_customer_id,product_id)
 VALUES(v_review_id,p_buyer,p_site,c.id,p_product);
 -- Locks serialize external changes. Recheck also catches changes caused by an
 -- in-transaction trigger/fault, rolling back BOTH writes rather than returning a false receipt.
 IF NOT EXISTS(SELECT 1 FROM public.buyer_accounts bx
  JOIN public.buyer_store_customers lx ON lx.buyer_account_id=bx.id AND lx.site_id=p_site AND lx.store_customer_id=c.id
  JOIN public.store_customers cx ON cx.id=lx.store_customer_id AND cx.store_id=p_site
  JOIN public.sites sx ON sx.id=p_site
  JOIN public.products px ON px.id=p_product AND px.store_id=p_site
  JOIN public.product_reviews rx ON rx.id=v_review_id AND rx.store_id=p_site AND rx.product_id=p_product
  JOIN public.buyer_review_links ex ON ex.review_id=rx.id AND ex.buyer_account_id=p_buyer AND ex.site_id=p_site AND ex.store_customer_id=c.id AND ex.product_id=p_product
  WHERE bx.id=p_buyer AND bx.status='active' AND bx.session_epoch=p_epoch
   AND lx.verified_at IS NOT NULL AND lx.link_basis IN('verified_email','operator_resolution')
   AND cx.status='active' AND cx.deleted_at IS NULL AND cx.email IS NOT DISTINCT FROM c.email
   AND sx.deleted_at IS NULL AND sx.site_type='store' AND px.deleted_at IS NULL AND px.is_active IS DISTINCT FROM false AND px.status IS DISTINCT FROM 'archived'
   AND rx.deleted_at IS NULL AND rx.is_verified AND NOT rx.is_approved AND rx.status='pending'
   AND rx.customer_email IS NOT DISTINCT FROM c.email AND rx.rating=p_rating
   AND rx.title IS NOT DISTINCT FROM nullif(btrim(p_title),'') AND rx.body IS NOT DISTINCT FROM nullif(btrim(p_body),'')) THEN
  RAISE EXCEPTION 'Review authority changed before commit' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('accepted',true,'review_id',v_review_id);
EXCEPTION WHEN lock_not_available THEN
 RETURN jsonb_build_object('accepted',false,'code','REVIEW_SOURCE_BUSY');
END $fn$;
REVOKE ALL ON FUNCTION public.protect_buyer_review_link_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.create_storefront_buyer_review_v1(uuid,uuid,integer,uuid,integer,text,text) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.create_storefront_buyer_review_v1(uuid,uuid,integer,uuid,integer,text,text) TO service_role;
DO $journal$
DECLARE s text; f record; v_profile jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM aclexplode((SELECT relacl FROM pg_class WHERE oid='public.buyer_review_links'::regclass)) a
  WHERE a.grantee NOT IN(current_user::regrole::oid,'service_role'::regrole::oid)
   OR(a.grantee='service_role'::regrole::oid AND(a.is_grantable OR a.privilege_type NOT IN('SELECT','INSERT'))))
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant']) r WHERE has_table_privilege(r,'public.buyer_review_links','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
  RAISE EXCEPTION 'migration357 refuses unexpected private ownership grants';END IF;
 FOREACH s IN ARRAY ARRAY['public.create_storefront_buyer_review_v1(uuid,uuid,integer,uuid,integer,text,text)','public.protect_buyer_review_link_v1()'] LOOP
  SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure(s);
  IF f.prosecdef OR f.proargdefaults IS NOT NULL OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
    WHERE a.grantee NOT IN(f.proowner,'service_role'::regrole::oid) OR(a.grantee='service_role'::regrole::oid AND a.is_grantable))
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant']) r WHERE has_function_privilege(r,f.oid,'EXECUTE')) THEN
   RAISE EXCEPTION 'migration357 refuses unexpected function authority';END IF;
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
  VALUES('357',s,pg_get_userbyid(f.proowner),'FUNCTION EXECUTION FENCE','granted',f.oid,f.proowner,encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex'));
 END LOOP;
 SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(jsonb_build_object(
  'oid',c.oid,'name',c.relname,'owner',c.relowner,'kind',c.relkind,'persistence',c.relpersistence,'columns_count',c.relnatts,'replica_identity',c.relreplident,
  'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl,'options',c.reloptions,
  'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.attisdropped,a.atttypid,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
   FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
  'constraints',(SELECT jsonb_agg(jsonb_build_array(x.oid,x.conname,x.contype,x.convalidated,x.condeferrable,x.condeferred,pg_get_constraintdef(x.oid)) ORDER BY x.conname) FROM pg_constraint x WHERE x.conrelid=c.oid),
  'indexes',(SELECT jsonb_agg(jsonb_build_array(i.indexrelid,pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready,i.indisreplident,z.relowner,z.relacl,z.reloptions) ORDER BY i.indexrelid) FROM pg_index i JOIN pg_class z ON z.oid=i.indexrelid WHERE i.indrelid=c.oid),
  'policies',(SELECT jsonb_agg(jsonb_build_array(p.oid,p.polname,p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid=c.oid),
  'triggers',(SELECT jsonb_agg(jsonb_build_array(t.oid,pg_get_triggerdef(t.oid),t.tgenabled,t.tgfoid) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid),
  'rules',(SELECT jsonb_agg(jsonb_build_array(r.oid,pg_get_ruledef(r.oid),r.ev_enabled) ORDER BY r.oid) FROM pg_rewrite r WHERE r.ev_class=c.oid)
 ) ORDER BY c.relname) FROM pg_class c WHERE c.oid=ANY(ARRAY['public.buyer_review_links'::regclass,'public.product_reviews'::regclass,'public.store_customers'::regclass,'public.buyer_accounts'::regclass,'public.buyer_store_customers'::regclass,'public.sites'::regclass,'public.products'::regclass])),
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,p.proconfig,pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=ANY(ARRAY['create_storefront_buyer_review_v1','protect_buyer_review_link_v1'])),
 'roles',(SELECT jsonb_agg(jsonb_build_array(r.oid,r.rolname,r.rolsuper,r.rolinherit,r.rolcreaterole,r.rolcreatedb,r.rolcanlogin,r.rolreplication,r.rolbypassrls,r.rolconfig) ORDER BY r.oid) FROM pg_roles r WHERE r.oid=ANY(ARRAY[(SELECT relowner FROM pg_class WHERE oid='public.buyer_review_links'::regclass),'service_role'::regrole::oid,'anon'::regrole::oid,'authenticated'::regrole::oid,'app_tenant'::regrole::oid])),
 'external_routines',(SELECT jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) ORDER BY p.oid) FROM pg_proc p WHERE p.prokind IN('f','p') AND NOT(p.pronamespace='public'::regnamespace AND p.proname=ANY(ARRAY['create_storefront_buyer_review_v1','protect_buyer_review_link_v1'])) AND p.prosrc ILIKE '%buyer_review_links%'),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_auth_members m),
 'schema',(SELECT jsonb_build_array(n.oid,n.nspowner,n.nspacl) FROM pg_namespace n WHERE n.oid='public'::regnamespace),
 'dependencies',(SELECT jsonb_agg(jsonb_build_array(d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype)
 FROM pg_depend d WHERE
 (d.refclassid='pg_class'::regclass AND d.refobjid IN(
  SELECT c.oid FROM pg_class c WHERE c.oid='public.buyer_review_links'::regclass
  UNION SELECT indexrelid FROM pg_index WHERE indrelid='public.buyer_review_links'::regclass
  UNION SELECT conindid FROM pg_constraint WHERE (conrelid='public.product_reviews'::regclass AND conname='product_reviews_buyer_ownership_key') OR(conrelid='public.store_customers'::regclass AND conname='store_customers_buyer_review_scope_key')))
 OR(d.refclassid='pg_proc'::regclass AND d.refobjid IN(SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['create_storefront_buyer_review_v1','protect_buyer_review_link_v1'])))
 OR(d.refclassid='pg_type'::regclass AND d.refobjid=(SELECT reltype FROM pg_class WHERE oid='public.buyer_review_links'::regclass))
 OR(d.refclassid='pg_constraint'::regclass AND d.refobjid IN(SELECT oid FROM pg_constraint WHERE (conrelid='public.product_reviews'::regclass AND conname='product_reviews_buyer_ownership_key') OR(conrelid='public.store_customers'::regclass AND conname='store_customers_buyer_review_scope_key'))))
) INTO v_profile;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 SELECT '357','public.buyer_review_links:357_profile',pg_get_userbyid(c.relowner),'SCHEMA AND ROLE PROFILE','granted',c.oid,c.relowner,
  encode(sha256(convert_to(v_profile::text,'UTF8')),'hex') FROM pg_class c WHERE c.oid='public.buyer_review_links'::regclass;
END $journal$;
NOTIFY pgrst,'reload schema';
COMMIT;
