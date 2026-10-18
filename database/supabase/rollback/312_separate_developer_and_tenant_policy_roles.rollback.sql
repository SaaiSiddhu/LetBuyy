-- Restore exactly the previous policy applicability. This reopens the
-- app_tenant private-developer dependency error; prefer a reviewed forward fix.
-- Rows, function/table grants and every pre-existing policy body remain intact.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
DO $rollback_precondition$
DECLARE
  v_saved record;
  v_policy pg_catalog.pg_policy%ROWTYPE;
  v_owner oid;
  v_hash text;
  v_roles oid[];
  v_api_roles oid[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:migration:312:policy-closure',0));
  IF to_regclass('public.migration_privilege_journal') IS NULL THEN
    RAISE EXCEPTION 'rollback 312 refuses to run without the privilege journal';
  END IF;
  IF (SELECT count(*) FROM public.migration_privilege_journal WHERE migration='312') <> 18
     OR (SELECT count(DISTINCT object_signature) FROM public.migration_privilege_journal WHERE migration='312') <> 18
     OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='312'
       AND (NOT(object_signature = ANY(ARRAY['public.app_api_quotas.app_api_quotas_developer_read','public.app_api_quotas.app_tenant_312_guc','public.app_billing_charges.app_billing_charges_partner_read','public.app_billing_charges.app_tenant_312_guc','public.app_partner_agency_seats.app_partner_agency_seats_developer_read','public.app_partner_agency_seats.app_tenant_312_guc','public.app_reviews.app_reviews_site_or_developer_read','public.app_reviews.app_tenant_312_guc','public.app_sandbox_stores.app_sandbox_stores_developer_read','public.app_sandbox_stores.app_tenant_312_guc','public.app_uninstall_feedback.app_uninstall_feedback_developer_read','public.app_uninstall_feedback.app_tenant_312_guc','public.app_usage_events.app_usage_events_developer_read','public.app_usage_events.app_tenant_312_guc','public.app_usage_meter_rollups.app_usage_meter_rollups_developer_read','public.app_usage_meter_rollups.app_tenant_312_guc','public.partner_payout_ledger_entries.partner_payout_ledger_entries_partner_read','public.partner_payout_ledger_entries.app_tenant_312_guc']::text[])) OR NOT(
         (grantee='PUBLIC' AND privilege='POLICY ROLE APPLICABILITY' AND action='revoked')
         OR (grantee='app_tenant' AND privilege='RESTRICTIVE POLICY' AND action='granted')))) THEN
    RAISE EXCEPTION 'rollback 312 refuses incomplete or unexpected policy journal';
  END IF;
  SELECT array_agg(x ORDER BY x) INTO v_api_roles
    FROM unnest(ARRAY['anon'::regrole::oid,'authenticated'::regrole::oid,'service_role'::regrole::oid]) x;
  FOR v_saved IN SELECT * FROM public.migration_privilege_journal WHERE migration='312' ORDER BY object_signature LOOP
    SELECT * INTO v_policy FROM pg_catalog.pg_policy
      WHERE polrelid=format('public.%I',split_part(v_saved.object_signature,'.',2))::regclass
        AND polname=split_part(v_saved.object_signature,'.',3);
    IF NOT FOUND THEN RAISE EXCEPTION 'rollback 312 refuses missing policy %',v_saved.object_signature; END IF;
    SELECT relowner INTO v_owner FROM pg_catalog.pg_class WHERE oid=v_policy.polrelid;
    v_hash := encode(sha256(convert_to(v_policy.polcmd::text || ':' || v_policy.polpermissive::text || ':' ||
      coalesce(pg_get_expr(v_policy.polqual,v_policy.polrelid),'') || ':' ||
      coalesce(pg_get_expr(v_policy.polwithcheck,v_policy.polrelid),''),'UTF8')),'hex');
    SELECT array_agg(x ORDER BY x) INTO v_roles FROM unnest(v_policy.polroles) x;
    IF v_saved.object_oid IS DISTINCT FROM v_policy.oid OR v_saved.object_owner IS DISTINCT FROM v_owner
       OR v_saved.object_definition_hash IS DISTINCT FROM v_hash
       OR (v_saved.action='revoked' AND v_roles IS DISTINCT FROM v_api_roles)
       OR (v_saved.action='granted' AND (v_policy.polpermissive OR v_policy.polcmd <> '*' OR v_roles IS DISTINCT FROM ARRAY['app_tenant'::regrole::oid])) THEN
      RAISE EXCEPTION 'rollback 312 refuses changed policy identity/owner/body/roles %',v_saved.object_signature;
    END IF;
  END LOOP;
END;
$rollback_precondition$;
DO $restore$
DECLARE v_saved record;
BEGIN
  FOR v_saved IN SELECT * FROM public.migration_privilege_journal WHERE migration='312' ORDER BY action,object_signature LOOP
    IF v_saved.action='granted' THEN
      EXECUTE format('DROP POLICY %I ON public.%I',split_part(v_saved.object_signature,'.',3),split_part(v_saved.object_signature,'.',2));
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I TO PUBLIC',split_part(v_saved.object_signature,'.',3),split_part(v_saved.object_signature,'.',2));
    END IF;
  END LOOP;
  DELETE FROM public.migration_privilege_journal WHERE migration='312';
END;
$restore$;
NOTIFY pgrst, 'reload schema';
COMMIT;
