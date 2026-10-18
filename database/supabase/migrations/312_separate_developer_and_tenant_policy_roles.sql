-- Separate legacy developer Data API policies from the backend tenant role.
-- No table/function grant or policy expression is broadened. Existing anon,
-- authenticated and service_role applicability remains. app_tenant uses its
-- existing permissive GUC policy plus a restrictive GUC boundary, so public or
-- owner policies cannot return a rival site's rows. Private developer access
-- remains denied. Every change uses the existing private privilege journal.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
DO $policy_closure$
DECLARE
  v_target record;
  v_policy pg_catalog.pg_policy%ROWTYPE;
  v_saved public.migration_privilege_journal%ROWTYPE;
  v_owner oid;
  v_hash text;
  v_signature text;
  v_roles oid[];
  v_api_roles oid[];
  v_role text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:migration:312:policy-closure',0));
  IF to_regclass('public.migration_privilege_journal') IS NULL THEN
    RAISE EXCEPTION 'migration 312 refuses to run without the privilege journal';
  END IF;
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF pg_has_role('app_tenant',v_role,'USAGE') THEN
      RAISE EXCEPTION 'migration 312 refuses inherited API/backend role % on app_tenant',v_role;
    END IF;
  END LOOP;
  SELECT array_agg(x ORDER BY x) INTO v_api_roles
    FROM unnest(ARRAY['anon'::regrole::oid,'authenticated'::regrole::oid,'service_role'::regrole::oid]) x;
  FOR v_target IN SELECT * FROM (VALUES
    ('app_api_quotas', 'app_api_quotas_developer_read', '6b0e945a08e1150da73eaf9ceb8bc3d7eb0b6c93302494ac9575165491d7bfe5', 'site_id = public.current_site_id()'),
    ('app_billing_charges', 'app_billing_charges_partner_read', '45088aaa4cefe6728cc7f2ca4dadc9f035ddabb6d48e2f9b9c9a6101bfb966a0', 'site_id = public.current_site_id()'),
    ('app_partner_agency_seats', 'app_partner_agency_seats_developer_read', 'c0fb04f27674a0e65675e93b47d4e361ed72b8c52b474dc132618ba4c089d018', 'site_id = public.current_site_id()'),
    ('app_reviews', 'app_reviews_site_or_developer_read', '138a76009c19b1666cefda124b68474156c6928af05e5b9dd2616435baa8b531', 'COALESCE(site_id, store_id) = public.current_site_id()'),
    ('app_sandbox_stores', 'app_sandbox_stores_developer_read', '6b76f8db9393eb1ce21e34781186524217bbb43321f00b8da7f434dc27a31145', 'site_id = public.current_site_id()'),
    ('app_uninstall_feedback', 'app_uninstall_feedback_developer_read', '323818a58f627587fab5ba026f5498fb68e72accf35c1602b2f74e282ecd01b0', 'site_id = public.current_site_id()'),
    ('app_usage_events', 'app_usage_events_developer_read', '4f6e6b0b82618f67f2cea6d23c3406841e2ff5abb31c1629515fd598aeebcbcf', 'site_id = public.current_site_id()'),
    ('app_usage_meter_rollups', 'app_usage_meter_rollups_developer_read', '14f6d2a51de23e1f13533febd694773286454ce7e86efd2f82ea8b5313a08290', 'site_id = public.current_site_id()'),
    ('partner_payout_ledger_entries', 'partner_payout_ledger_entries_partner_read', '02c71cdaa45d1c8f2e4b39aaed6b5c1dd6a6127edc1a2930aa6752c56a8465d5', 'site_id = public.current_site_id()')
  ) target(table_name,policy_name,expected_hash,predicate)
  LOOP
    SELECT * INTO v_policy FROM pg_catalog.pg_policy
     WHERE polrelid=format('public.%I',v_target.table_name)::regclass AND polname=v_target.policy_name;
    IF NOT FOUND THEN RAISE EXCEPTION 'migration 312 refuses missing policy %.%',v_target.table_name,v_target.policy_name; END IF;
    SELECT relowner INTO v_owner FROM pg_catalog.pg_class WHERE oid=v_policy.polrelid;
    v_hash := encode(sha256(convert_to(v_policy.polcmd::text || ':' || v_policy.polpermissive::text || ':' ||
      coalesce(pg_get_expr(v_policy.polqual,v_policy.polrelid),'') || ':' ||
      coalesce(pg_get_expr(v_policy.polwithcheck,v_policy.polrelid),''),'UTF8')),'hex');
    IF v_hash IS DISTINCT FROM v_target.expected_hash THEN
      RAISE EXCEPTION 'migration 312 refuses changed policy expression %.%',v_target.table_name,v_target.policy_name;
    END IF;
    SELECT array_agg(x ORDER BY x) INTO v_roles FROM unnest(v_policy.polroles) x;
    v_signature := 'public.' || v_target.table_name || '.' || v_target.policy_name;
    SELECT * INTO v_saved FROM public.migration_privilege_journal
     WHERE migration='312' AND object_signature=v_signature AND grantee='PUBLIC'
       AND privilege='POLICY ROLE APPLICABILITY' AND action='revoked';
    IF FOUND THEN
      IF v_saved.object_oid IS DISTINCT FROM v_policy.oid OR v_saved.object_owner IS DISTINCT FROM v_owner
         OR v_saved.object_definition_hash IS DISTINCT FROM v_hash OR v_roles IS DISTINCT FROM v_api_roles THEN
        RAISE EXCEPTION 'migration 312 refuses changed journaled policy %',v_signature;
      END IF;
    ELSE
      IF v_roles IS DISTINCT FROM ARRAY[0::oid] THEN RAISE EXCEPTION 'migration 312 refuses non-PUBLIC original policy %',v_signature; END IF;
      INSERT INTO public.migration_privilege_journal
        (migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
      VALUES ('312',v_signature,'PUBLIC','POLICY ROLE APPLICABILITY','revoked',v_policy.oid,v_owner,v_hash);
      EXECUTE format('ALTER POLICY %I ON public.%I TO anon, authenticated, service_role',v_target.policy_name,v_target.table_name);
    END IF;

    v_signature := 'public.' || v_target.table_name || '.app_tenant_312_guc';
    SELECT * INTO v_saved FROM public.migration_privilege_journal
     WHERE migration='312' AND object_signature=v_signature AND grantee='app_tenant'
       AND privilege='RESTRICTIVE POLICY' AND action='granted';
    IF NOT FOUND THEN
      IF EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=format('public.%I',v_target.table_name)::regclass AND polname='app_tenant_312_guc') THEN
        RAISE EXCEPTION 'migration 312 refuses an unjournaled existing restriction %',v_signature;
      END IF;
      EXECUTE format('CREATE POLICY app_tenant_312_guc ON public.%I AS RESTRICTIVE FOR ALL TO app_tenant USING (%s) WITH CHECK (%s)',
        v_target.table_name,v_target.predicate,v_target.predicate);
      SELECT * INTO v_policy FROM pg_catalog.pg_policy WHERE polrelid=format('public.%I',v_target.table_name)::regclass AND polname='app_tenant_312_guc';
      v_hash := encode(sha256(convert_to(v_policy.polcmd::text || ':' || v_policy.polpermissive::text || ':' ||
        coalesce(pg_get_expr(v_policy.polqual,v_policy.polrelid),'') || ':' ||
        coalesce(pg_get_expr(v_policy.polwithcheck,v_policy.polrelid),''),'UTF8')),'hex');
      INSERT INTO public.migration_privilege_journal
        (migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
      VALUES ('312',v_signature,'app_tenant','RESTRICTIVE POLICY','granted',v_policy.oid,v_owner,v_hash);
    ELSE
      SELECT * INTO v_policy FROM pg_catalog.pg_policy WHERE polrelid=format('public.%I',v_target.table_name)::regclass AND polname='app_tenant_312_guc';
      v_hash := encode(sha256(convert_to(v_policy.polcmd::text || ':' || v_policy.polpermissive::text || ':' ||
        coalesce(pg_get_expr(v_policy.polqual,v_policy.polrelid),'') || ':' ||
        coalesce(pg_get_expr(v_policy.polwithcheck,v_policy.polrelid),''),'UTF8')),'hex');
      IF NOT FOUND OR v_policy.polpermissive OR v_policy.polcmd <> '*'
         OR v_policy.polroles IS DISTINCT FROM ARRAY['app_tenant'::regrole::oid]
         OR v_saved.object_oid IS DISTINCT FROM v_policy.oid OR v_saved.object_owner IS DISTINCT FROM v_owner
         OR v_saved.object_definition_hash IS DISTINCT FROM v_hash THEN
        RAISE EXCEPTION 'migration 312 refuses changed restriction %',v_signature;
      END IF;
    END IF;
  END LOOP;
END;
$policy_closure$;
NOTIFY pgrst, 'reload schema';
COMMIT;
