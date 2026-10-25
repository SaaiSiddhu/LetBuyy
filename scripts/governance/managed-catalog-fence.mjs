import { sqlStatements, sqlTokens, tokenText, splitSqlList } from './definer-role-closure.mjs';

// This is the reviewed control flow, not a source-file/hash exemption. Both
// branches must acquire native relation locks. The provider branch must verify
// the sole helper's complete ABI/owner/body/private ACL and prove held locks.
const PROVIDER_CATALOGS = new Set(["pg_am", "pg_attrdef", "pg_attribute", "pg_auth_members", "pg_authid", "pg_class", "pg_collation", "pg_constraint", "pg_database", "pg_default_acl", "pg_depend", "pg_description", "pg_event_trigger", "pg_extension", "pg_index", "pg_inherits", "pg_init_privs", "pg_language", "pg_namespace", "pg_opclass", "pg_operator", "pg_opfamily", "pg_policy", "pg_proc", "pg_rewrite", "pg_seclabel", "pg_shdepend", "pg_statistic_ext", "pg_tablespace", "pg_trigger", "pg_type"]);
const MANAGED_FENCE_BODY = String.raw`
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  __CATALOG_LOCK__
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
  IF EXISTS(SELECT 1 FROM unnest(__CATALOG_OIDS__) catalog_oid
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
     AND l.locktype='relation' AND l.relation=catalog_oid AND l.granted
     AND l.mode IN('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
     AND l.database IN(0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())))) THEN
   RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED';END IF;
 END IF;
END `;

const proofText = tokens => tokenText(tokens.map((token,index) =>
    token.kind === 'string' && tokens[index-2]?.value === 'raise' && tokens[index-1]?.value === 'exception'
        ? {...token,value:'__refusal__'} : token));

export function normalizeVerifiedManagedCatalogFences(sql) {
    const edits = [];
    for (const statement of sqlStatements(sql)) {
        if (statement[0]?.value !== 'do' || statement.length !== 3 || statement[1]?.kind !== 'body') continue;
        const body = statement[1].value;
        const tokens = sqlTokens(body);
        const start = tokens.findIndex((t,i) => t.kind === 'word' && t.value === 'lock' && tokens[i+1]?.value === 'table');
        if (start < 0) continue;
        const end = tokens.findIndex((t,i) => i > start && t.value === ';');
        const lock = tokens.slice(start,end+1), mode = lock.findIndex(t => t.value === 'in');
        if (mode < 0 || !['in share row exclusive mode nowait ;','in share row exclusive mode ;'].includes(tokenText(lock.slice(mode)))) continue;
        const rows = splitSqlList(lock.slice(2,mode));
        if (!rows.length || rows.some(row => row.length !== 3 || row[0].value !== 'pg_catalog' || row[1].value !== '.' || row[2].kind !== 'word' || !PROVIDER_CATALOGS.has(row[2].value))) continue;
        const catalogs = rows.map(row => row[2].value);
        if (new Set(catalogs).size !== catalogs.length) continue;
        const held = 'ARRAY[' + catalogs.map(name => "'pg_catalog."+name+"'::pg_catalog.regclass").join(',') + ']::oid[]';
        const expected = MANAGED_FENCE_BODY.replace('__CATALOG_LOCK__', tokenText(lock)).replace('__CATALOG_OIDS__', held);
        if (proofText(tokens) !== proofText(sqlTokens(expected))) continue;
        // Equal-length replacement retains guard/restoration source offsets.
        const replacement = tokenText(lock);
        const from = statement[0].start, to = statement.at(-1).end;
        edits.push([from,to,replacement+' '.repeat(to-from-replacement.length)]);
    }
    for (const [from,to,text] of edits.reverse()) sql = sql.slice(0,from)+text+sql.slice(to);
    return sql;
}
