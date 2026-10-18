-- Store discovery invokes a private SECURITY INVOKER function that reads
-- employees even for owners. Restored Supabase ACLs can omit its direct backend
-- grant. Make these three backend dependencies explicit without relying on
-- inherited app_tenant privileges or changing client/RLS/money authority.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
DO $backend_grants$
DECLARE
  v_entry record;
  v_table oid;
  v_owner oid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:migration:364:backend-grants',0));
  FOR v_entry IN SELECT * FROM (VALUES
    ('public.employees','SELECT'),
    ('public.runtime_telemetry_metrics','INSERT'),
    ('public.worker_request_logs','INSERT')
  ) AS dependencies(signature,permission) LOOP
    v_table := v_entry.signature::regclass;
    SELECT relowner INTO STRICT v_owner FROM pg_class WHERE oid=v_table AND relkind='r';
    IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='364'
      AND object_signature=v_entry.signature AND (object_oid IS DISTINCT FROM v_table
        OR object_owner IS DISTINCT FROM v_owner OR grantee<>'service_role'
        OR privilege<>v_entry.permission OR action<>'granted')) THEN
      RAISE EXCEPTION '364 refuses changed backend privilege journal';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
      WHERE c.oid=v_table AND a.grantee='service_role'::regrole AND a.privilege_type=v_entry.permission) THEN
      INSERT INTO public.migration_privilege_journal
        (migration,object_signature,grantee,privilege,action,object_oid,object_owner)
      VALUES('364',v_entry.signature,'service_role',v_entry.permission,'granted',v_table,v_owner)
      ON CONFLICT DO NOTHING;
      EXECUTE format('GRANT %s ON TABLE %s TO service_role',v_entry.permission,v_entry.signature);
    END IF;
  END LOOP;
END;
$backend_grants$;
NOTIFY pgrst,'reload schema';
COMMIT;
