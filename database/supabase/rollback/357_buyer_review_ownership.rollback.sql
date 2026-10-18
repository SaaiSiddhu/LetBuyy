-- Empty-only357 removal. All author evidence and unknown authority are retained by refusal.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:357:buyer-review-ownership',0));
-- Catalog locks block later DDL. Native CREATE may already have released a
-- catalog relation lock, so the foreign/prepared write-XID refusal is essential.
LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_attribute,
 pg_catalog.pg_constraint,pg_catalog.pg_index,pg_catalog.pg_trigger,
 pg_catalog.pg_policy,pg_catalog.pg_depend,pg_catalog.pg_type,pg_catalog.pg_namespace,
 pg_catalog.pg_authid,pg_catalog.pg_auth_members IN SHARE ROW EXCLUSIVE MODE;
DO $quiescent_precondition$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed'
  OR EXISTS(SELECT 1 FROM pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock'
   AND l.granted AND(l.pid IS NULL OR l.pid<>pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_prepared_xacts) THEN
  RAISE EXCEPTION 'rollback357 refuses concurrent/prepared writes or non-read-committed state';END IF;
END $quiescent_precondition$;
LOCK TABLE public.product_reviews,public.store_customers,public.buyer_accounts,
 public.buyer_store_customers,public.products,public.sites,public.migration_privilege_journal
 IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.buyer_review_links IN ACCESS EXCLUSIVE MODE;
DO $preflight$
DECLARE s text; f record; j record; v_profile jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM public.buyer_review_links) THEN
  RAISE EXCEPTION 'rollback357 refuses retained buyer review author evidence';END IF;
 IF(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['create_storefront_buyer_review_v1','protect_buyer_review_link_v1']))<>2 THEN
  RAISE EXCEPTION 'rollback357 refuses unexpected ownership function family';END IF;
 IF(SELECT count(*) FROM public.migration_privilege_journal WHERE migration='357')<>3
  OR EXISTS(SELECT object_signature FROM public.migration_privilege_journal WHERE migration='357' GROUP BY object_signature HAVING count(*)<>1)
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='357'
   AND NOT(object_signature=ANY(ARRAY['public.create_storefront_buyer_review_v1(uuid,uuid,integer,uuid,integer,text,text)','public.protect_buyer_review_link_v1()']) OR object_signature='public.buyer_review_links:357_profile')) THEN
  RAISE EXCEPTION 'rollback357 refuses unknown or duplicated provenance';END IF;
 FOREACH s IN ARRAY ARRAY['public.create_storefront_buyer_review_v1(uuid,uuid,integer,uuid,integer,text,text)','public.protect_buyer_review_link_v1()'] LOOP
  SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure(s);
  IF NOT FOUND THEN RAISE EXCEPTION 'rollback357 refuses missing typed ownership function';END IF;
  SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='357' AND object_signature=s;
  IF NOT FOUND OR j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner
   OR j.grantee IS DISTINCT FROM pg_get_userbyid(f.proowner) OR j.privilege IS DISTINCT FROM 'FUNCTION EXECUTION FENCE' OR j.action IS DISTINCT FROM 'granted'
   OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')
   OR f.prosecdef OR f.proargdefaults IS NOT NULL OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[] THEN
   RAISE EXCEPTION 'rollback357 refuses changed function body, defaults, owner or provenance';END IF;
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
 SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='357' AND object_signature='public.buyer_review_links:357_profile';
 IF NOT FOUND OR j.object_oid IS DISTINCT FROM 'public.buyer_review_links'::regclass::oid
  OR j.object_owner IS DISTINCT FROM(SELECT relowner FROM pg_class WHERE oid='public.buyer_review_links'::regclass)
  OR j.grantee IS DISTINCT FROM pg_get_userbyid(j.object_owner) OR j.privilege IS DISTINCT FROM 'SCHEMA AND ROLE PROFILE' OR j.action IS DISTINCT FROM 'granted'
  OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(v_profile::text,'UTF8')),'hex') THEN
  RAISE EXCEPTION 'rollback357 refuses changed schema, ACL, role profile or external dependencies';END IF;
END $preflight$;
DROP TRIGGER buyer_review_links_truncate_guard ON public.buyer_review_links;
DROP TRIGGER buyer_review_links_guard ON public.buyer_review_links;
DROP FUNCTION public.create_storefront_buyer_review_v1(uuid,uuid,integer,uuid,integer,text,text) RESTRICT;
DROP FUNCTION public.protect_buyer_review_link_v1() RESTRICT;
DROP TABLE public.buyer_review_links RESTRICT;
ALTER TABLE public.product_reviews DROP CONSTRAINT product_reviews_buyer_ownership_key RESTRICT;
ALTER TABLE public.store_customers DROP CONSTRAINT store_customers_buyer_review_scope_key RESTRICT;
DELETE FROM public.migration_privilege_journal WHERE migration='357';
NOTIFY pgrst,'reload schema';
COMMIT;
