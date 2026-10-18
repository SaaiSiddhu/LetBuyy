-- N1.6: ordinary Data API/tenant roles cannot manufacture independent approval.
-- Reuse the canonical sensitive_action_approvals owner and private migration
-- journal. This closes storage authority only; it does not complete the real
-- approver-session/action/payload/expiry/atomic-effect protocol.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
DO $approval_fence$
DECLARE
  v_table oid := 'public.sensitive_action_approvals'::regclass;
  v_owner oid; v_hash text; v_role text; v_permission text; v_entry record;
  v_grantee text; v_privilege text; v_signature text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:migration:313:approval-table',0));
  IF to_regclass('public.migration_privilege_journal') IS NULL THEN
    RAISE EXCEPTION 'migration 313 requires the canonical private privilege journal';
  END IF;
  SELECT relowner INTO v_owner FROM pg_class WHERE oid=v_table AND relkind='r';
  IF v_owner IS NULL THEN RAISE EXCEPTION 'migration 313 requires the canonical approval table'; END IF;
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
  IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='313') THEN
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
    RETURN;
  END IF;
  -- Do not guess how to replay a delegated grantor's authority. RESTRICT also
  -- refuses dependent grants rather than changing a third role as a side effect.
  FOR v_entry IN
    SELECT a.grantee,a.grantor,a.privilege_type,a.is_grantable,NULL::text AS column_name
      FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid=v_table
    UNION ALL
    SELECT a.grantee,a.grantor,a.privilege_type,a.is_grantable,c.attname
      FROM pg_attribute c CROSS JOIN LATERAL aclexplode(c.attacl) a
      WHERE c.attrelid=v_table AND c.attnum>0 AND NOT c.attisdropped
  LOOP
    v_grantee := CASE WHEN v_entry.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(v_entry.grantee) END;
    IF NOT(v_grantee=ANY(ARRAY['PUBLIC','anon','authenticated','app_tenant'])) THEN CONTINUE; END IF;
    IF v_entry.grantor<>v_owner OR v_entry.grantee=v_owner THEN
      RAISE EXCEPTION 'migration 313 refuses a delegated/owner approval grant';
    END IF;
    v_signature := 'public.sensitive_action_approvals' || CASE WHEN v_entry.column_name IS NULL THEN '' ELSE '.'||v_entry.column_name END;
    v_privilege := v_entry.privilege_type || CASE WHEN v_entry.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END;
    INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
      VALUES('313',v_signature,v_grantee,v_privilege,'revoked',v_table,v_owner,v_hash);
  END LOOP;
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
    VALUES('313','public.sensitive_action_approvals',pg_get_userbyid(v_owner),'TABLE PRIVILEGE FENCE','granted',v_table,v_owner,v_hash);
  REVOKE ALL PRIVILEGES ON TABLE public.sensitive_action_approvals FROM PUBLIC,anon,authenticated,app_tenant;
  FOR v_entry IN SELECT * FROM public.migration_privilege_journal WHERE migration='313' AND action='revoked'
    AND object_signature LIKE 'public.sensitive_action_approvals.%' ORDER BY object_signature,grantee,privilege LOOP
    v_role := CASE WHEN v_entry.grantee='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(v_entry.grantee) END;
    EXECUTE format('REVOKE %s (%I) ON TABLE public.sensitive_action_approvals FROM %s RESTRICT',
      split_part(v_entry.privilege,' WITH GRANT OPTION',1),substring(v_entry.object_signature FROM length('public.sensitive_action_approvals.')+1),v_role);
  END LOOP;
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
END;
$approval_fence$;
NOTIFY pgrst,'reload schema';
COMMIT;
