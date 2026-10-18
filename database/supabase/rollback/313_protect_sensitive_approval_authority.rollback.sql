-- Restore only313's exact table/column privilege deltas, including grant
-- options, after verifying identity/owner/schema/policies/triggers and closed
-- privilege state. This intentionally reopens the original direct-role access;
-- it does not remove approval rows or bypass immutable/audit protections.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
DO $approval_fence_restore$
DECLARE
  v_table oid := 'public.sensitive_action_approvals'::regclass;
  v_owner oid; v_hash text; v_role text; v_permission text; v_entry record; v_option text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:migration:313:approval-table',0));
  IF to_regclass('public.migration_privilege_journal') IS NULL THEN
    RAISE EXCEPTION 'rollback 313 requires the canonical private privilege journal';
  END IF;
  SELECT relowner INTO v_owner FROM pg_class WHERE oid=v_table AND relkind='r';
  SELECT encode(sha256(convert_to(jsonb_build_object(
    'kind',c.relkind,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
    'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,
      pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d
      ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_array(x.conname,pg_get_constraintdef(x.oid)) ORDER BY x.conname)
      FROM pg_constraint x WHERE x.conrelid=c.oid),
    'policies',(SELECT jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles,
      pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname)
      FROM pg_policy p WHERE p.polrelid=c.oid),
    'triggers',(SELECT jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid),pg_get_functiondef(t.tgfoid)) ORDER BY t.tgname)
      FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)
  )::text,'UTF8')),'hex') INTO v_hash FROM pg_class c WHERE c.oid=v_table;
  IF NOT EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='313'
      AND object_signature='public.sensitive_action_approvals' AND privilege='TABLE PRIVILEGE FENCE'
      AND grantee=pg_get_userbyid(v_owner) AND action='granted')
    OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='313' AND (
      object_oid IS DISTINCT FROM v_table OR object_owner IS DISTINCT FROM v_owner
      OR object_definition_hash IS DISTINCT FROM v_hash
      OR NOT ((object_signature='public.sensitive_action_approvals' AND privilege='TABLE PRIVILEGE FENCE'
        AND grantee=pg_get_userbyid(v_owner) AND action='granted')
        OR (action='revoked' AND grantee=ANY(ARRAY['PUBLIC','anon','authenticated','app_tenant'])
          AND ((object_signature='public.sensitive_action_approvals'
            AND split_part(privilege,' WITH GRANT OPTION',1)=ANY(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']))
          OR (object_signature LIKE 'public.sensitive_action_approvals.%'
            AND split_part(privilege,' WITH GRANT OPTION',1)=ANY(ARRAY['SELECT','INSERT','UPDATE','REFERENCES'])
            AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=v_table AND a.attnum>0 AND NOT a.attisdropped
              AND a.attname=substring(object_signature FROM length('public.sensitive_action_approvals.')+1))))
          AND privilege=split_part(privilege,' WITH GRANT OPTION',1)
            || CASE WHEN right(privilege,18)=' WITH GRANT OPTION' THEN ' WITH GRANT OPTION' ELSE '' END)))) THEN
    RAISE EXCEPTION 'migration 313 refuses missing or changed approval-table privilege journal';
  END IF;
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','app_tenant'] LOOP
    FOR v_permission IN SELECT privilege_type FROM aclexplode(acldefault('r',v_owner)) LOOP
      IF has_table_privilege(v_role,v_table,v_permission) THEN
        RAISE EXCEPTION 'migration 313 refuses remaining/changed effective approval privilege % for %',v_permission,v_role;
      END IF;
    END LOOP;
    IF has_any_column_privilege(v_role,v_table,'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'migration 313 refuses remaining/changed effective approval column privilege for %',v_role;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM aclexplode((SELECT relacl FROM pg_class WHERE oid=v_table)) WHERE grantee=0)
    OR EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
      WHERE a.attrelid=v_table AND a.attnum>0 AND NOT a.attisdropped AND x.grantee=0) THEN
    RAISE EXCEPTION 'migration 313 refuses remaining/changed PUBLIC approval privilege';
  END IF;
  FOR v_entry IN SELECT * FROM public.migration_privilege_journal WHERE migration='313' AND action='revoked'
    ORDER BY object_signature,grantee,privilege LOOP
    v_role := CASE WHEN v_entry.grantee='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(v_entry.grantee) END;
    v_option := CASE WHEN right(v_entry.privilege,18)=' WITH GRANT OPTION' THEN ' WITH GRANT OPTION' ELSE '' END;
    IF v_entry.object_signature='public.sensitive_action_approvals' THEN
      EXECUTE format('GRANT %s ON TABLE public.sensitive_action_approvals TO %s%s',
        split_part(v_entry.privilege,' WITH GRANT OPTION',1),v_role,v_option);
    ELSE
      EXECUTE format('GRANT %s (%I) ON TABLE public.sensitive_action_approvals TO %s%s',
        split_part(v_entry.privilege,' WITH GRANT OPTION',1),substring(v_entry.object_signature FROM length('public.sensitive_action_approvals.')+1),v_role,v_option);
    END IF;
  END LOOP;
  DELETE FROM public.migration_privilege_journal WHERE migration='313';
END;
$approval_fence_restore$;
NOTIFY pgrst,'reload schema';
COMMIT;
