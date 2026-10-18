-- Remove only direct privileges introduced by 364; preserve preexisting grants.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
DO $backend_grants_restore$
DECLARE
  v_entry record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:migration:364:backend-grants',0));
  FOR v_entry IN SELECT * FROM public.migration_privilege_journal WHERE migration='364' LOOP
    IF v_entry.grantee<>'service_role' OR v_entry.action<>'granted'
      OR NOT ((v_entry.object_signature='public.employees' AND v_entry.privilege='SELECT')
        OR (v_entry.object_signature IN ('public.runtime_telemetry_metrics','public.worker_request_logs') AND v_entry.privilege='INSERT'))
      OR v_entry.object_oid IS DISTINCT FROM to_regclass(v_entry.object_signature)::oid
      OR v_entry.object_owner IS DISTINCT FROM (SELECT relowner FROM pg_class WHERE oid=to_regclass(v_entry.object_signature)) THEN
      RAISE EXCEPTION '364 rollback refuses changed backend privilege journal';
    END IF;
    EXECUTE format('REVOKE %s ON TABLE %s FROM service_role RESTRICT',v_entry.privilege,v_entry.object_signature);
  END LOOP;
  DELETE FROM public.migration_privilege_journal WHERE migration='364';
END;
$backend_grants_restore$;
NOTIFY pgrst,'reload schema';
COMMIT;
