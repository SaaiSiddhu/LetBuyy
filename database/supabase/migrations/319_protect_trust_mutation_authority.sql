-- N1.6: tenant visibility never grants platform T&S mutation authority.
-- Preserve read/backend privileges and exact owner-authored DML deltas in the
-- existing private journal; no table, policy, data or approval owner is replaced.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
DO $trust_fence$
DECLARE v_name text; v_signature text; v_table oid; v_owner oid; v_hash text; v_replay boolean;
 v_entry record; v_role text; v_privilege text; v_backend jsonb; v_after jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:migration:319:trust-authority',0));
 IF to_regclass('public.migration_privilege_journal') IS NULL THEN RAISE EXCEPTION 'migration319 requires the private privilege journal'; END IF;
 IF to_regprocedure('public.create_console_trust_approval_v1(uuid,text,text,uuid,text,uuid,jsonb)') IS NULL THEN
  RAISE EXCEPTION 'migration319 requires canonical318 trust authority';
 END IF;
 SELECT EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='319') INTO v_replay;
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal j WHERE migration='319' AND NOT EXISTS(
   SELECT 1 FROM unnest(ARRAY['ts_policies','ts_cases','ts_case_events','ts_evidence','ts_appeals','ts_takedowns']) n WHERE j.object_signature='public.'||n OR starts_with(j.object_signature,'public.'||n||'.'))) THEN
  RAISE EXCEPTION 'migration319 refuses an unknown journal object';
 END IF;
 IF v_replay AND (SELECT count(*) FROM public.migration_privilege_journal WHERE migration='319' AND privilege='TABLE MUTATION FENCE' AND action='granted')<>6 THEN
  RAISE EXCEPTION 'migration319 refuses missing table markers';
 END IF;
 FOREACH v_name IN ARRAY ARRAY['ts_policies','ts_cases','ts_case_events','ts_evidence','ts_appeals','ts_takedowns'] LOOP
  v_signature:='public.'||v_name; v_table:=to_regclass(v_signature);
  SELECT relowner INTO v_owner FROM pg_class WHERE oid=v_table AND relkind='r';
  IF v_table IS NULL OR v_owner IS NULL THEN RAISE EXCEPTION 'migration319 requires canonical table %',v_signature; END IF;
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
  IF v_replay THEN
  IF NOT EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='319' AND object_signature=v_signature
    AND grantee=pg_get_userbyid(v_owner) AND privilege='TABLE MUTATION FENCE' AND action='granted')
   OR EXISTS(SELECT 1 FROM public.migration_privilege_journal j WHERE migration='319'
    AND (j.object_signature=v_signature OR starts_with(j.object_signature,v_signature||'.')) AND (
      object_oid IS DISTINCT FROM v_table OR object_owner IS DISTINCT FROM v_owner OR object_definition_hash IS DISTINCT FROM v_hash
      OR NOT((object_signature=v_signature AND grantee=pg_get_userbyid(v_owner) AND privilege='TABLE MUTATION FENCE' AND action='granted')
       OR(action='revoked' AND grantee=ANY(ARRAY['PUBLIC','anon','authenticated','app_tenant'])
        AND((object_signature=v_signature AND split_part(privilege,' WITH GRANT OPTION',1)=ANY(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']))
          OR(starts_with(object_signature,v_signature||'.') AND split_part(privilege,' WITH GRANT OPTION',1)=ANY(ARRAY['INSERT','UPDATE','REFERENCES'])
            AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=v_table AND a.attnum>0 AND NOT a.attisdropped
              AND a.attname=substring(object_signature FROM length(v_signature)+2))))
        AND privilege=split_part(privilege,' WITH GRANT OPTION',1)||CASE WHEN right(privilege,18)=' WITH GRANT OPTION' THEN ' WITH GRANT OPTION' ELSE '' END)))) THEN
    RAISE EXCEPTION 'migration319 refuses missing/changed identity, owner, schema or journal for %',v_signature;
  END IF;
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','app_tenant'] LOOP
   IF EXISTS(SELECT 1 FROM aclexplode(acldefault('r',v_owner)) p WHERE p.privilege_type=ANY(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) AND has_table_privilege(v_role,v_table,p.privilege_type))
    OR has_any_column_privilege(v_role,v_table,'INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'migration319 refuses effective mutation authority for % on %',v_role,v_signature;
   END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE c.oid=v_table AND a.grantee=0 AND a.privilege_type=ANY(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']))
   OR EXISTS(SELECT 1 FROM pg_attribute c CROSS JOIN LATERAL aclexplode(c.attacl) a WHERE c.attrelid=v_table
    AND c.attnum>0 AND NOT c.attisdropped AND a.grantee=0 AND a.privilege_type=ANY(ARRAY['INSERT','UPDATE','REFERENCES'])) THEN
    RAISE EXCEPTION 'migration319 refuses PUBLIC mutation authority on %',v_signature;
  END IF;
   CONTINUE;
  END IF;
  SELECT jsonb_object_agg(p,has_table_privilege('service_role',v_table,p)) INTO v_backend
   FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;
  FOR v_entry IN
   SELECT a.grantee,a.grantor,a.privilege_type,a.is_grantable,NULL::text column_name FROM pg_class c
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE c.oid=v_table AND a.privilege_type=ANY(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])
   UNION ALL
   SELECT a.grantee,a.grantor,a.privilege_type,a.is_grantable,c.attname FROM pg_attribute c
    CROSS JOIN LATERAL aclexplode(c.attacl) a WHERE c.attrelid=v_table AND c.attnum>0 AND NOT c.attisdropped
      AND a.privilege_type=ANY(ARRAY['INSERT','UPDATE','REFERENCES'])
  LOOP
   v_role:=CASE WHEN v_entry.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(v_entry.grantee) END;
   IF NOT(v_role=ANY(ARRAY['PUBLIC','anon','authenticated','app_tenant'])) THEN CONTINUE; END IF;
   IF v_entry.grantor<>v_owner OR v_entry.grantee=v_owner THEN RAISE EXCEPTION 'migration319 refuses delegated/owner mutation grants'; END IF;
   v_privilege:=v_entry.privilege_type||CASE WHEN v_entry.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END;
   INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
    VALUES('319',v_signature||CASE WHEN v_entry.column_name IS NULL THEN '' ELSE '.'||v_entry.column_name END,
     v_role,v_privilege,'revoked',v_table,v_owner,v_hash);
  END LOOP;
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
   VALUES('319',v_signature,pg_get_userbyid(v_owner),'TABLE MUTATION FENCE','granted',v_table,v_owner,v_hash);
  FOR v_entry IN SELECT * FROM public.migration_privilege_journal WHERE migration='319' AND action='revoked'
    AND(object_signature=v_signature OR starts_with(object_signature,v_signature||'.')) ORDER BY object_signature,grantee,privilege LOOP
   v_role:=CASE WHEN v_entry.grantee='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(v_entry.grantee) END;
   IF v_entry.object_signature=v_signature THEN
    EXECUTE format('REVOKE %s ON TABLE %s FROM %s RESTRICT',split_part(v_entry.privilege,' WITH GRANT OPTION',1),v_signature,v_role);
   ELSE
    EXECUTE format('REVOKE %s (%I) ON TABLE %s FROM %s RESTRICT',split_part(v_entry.privilege,' WITH GRANT OPTION',1),
      substring(v_entry.object_signature FROM length(v_signature)+2),v_signature,v_role);
   END IF;
  END LOOP;
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','app_tenant'] LOOP
   IF EXISTS(SELECT 1 FROM aclexplode(acldefault('r',v_owner)) p WHERE p.privilege_type=ANY(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) AND has_table_privilege(v_role,v_table,p.privilege_type))
    OR has_any_column_privilege(v_role,v_table,'INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'migration319 refuses effective mutation authority for % on %',v_role,v_signature;
   END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE c.oid=v_table AND a.grantee=0 AND a.privilege_type=ANY(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']))
   OR EXISTS(SELECT 1 FROM pg_attribute c CROSS JOIN LATERAL aclexplode(c.attacl) a WHERE c.attrelid=v_table
    AND c.attnum>0 AND NOT c.attisdropped AND a.grantee=0 AND a.privilege_type=ANY(ARRAY['INSERT','UPDATE','REFERENCES'])) THEN
    RAISE EXCEPTION 'migration319 refuses PUBLIC mutation authority on %',v_signature;
  END IF;
  SELECT jsonb_object_agg(p,has_table_privilege('service_role',v_table,p)) INTO v_after
   FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;
  IF v_backend IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'migration319 refuses changing effective backend access on %',v_signature; END IF;
 END LOOP;
END $trust_fence$;
NOTIFY pgrst,'reload schema';
COMMIT;
