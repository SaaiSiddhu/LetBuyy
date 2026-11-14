-- 349 retirement: only a frozen, known, entirely empty operational family.
-- Every traversal row and request receipt is retained evidence, including
-- soft-deleted/audit-only rows. Use reviewed forward recovery if any remain.
-- Source349 has no historical OID journal: this fixed source-derived profile
-- recognizes the current image only. It never learns or writes provenance.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
-- Prepared writers may retain locks after their backend disconnects. Refuse
-- their actual catalog rows before attempting NOWAIT catalog/domain locks.
DO $prepared349$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
  RAISE EXCEPTION 'ROLLBACK349_PREPARED_TRANSACTIONS: reviewed maintenance requires no prepared transactions';
 END IF;
END $prepared349$;
-- Serialize native DDL/ACL/role/schema changes. NOWAIT refuses active writers.
LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_attribute,
 pg_catalog.pg_attrdef,pg_catalog.pg_constraint,pg_catalog.pg_trigger,
 pg_catalog.pg_policy,pg_catalog.pg_index,pg_catalog.pg_namespace,
 pg_catalog.pg_type,pg_catalog.pg_depend,pg_catalog.pg_rewrite,
 pg_catalog.pg_authid,pg_catalog.pg_auth_members,pg_catalog.pg_database,
 pg_catalog.pg_inherits,pg_catalog.pg_description,pg_catalog.pg_seclabel,
 pg_catalog.pg_extension,pg_catalog.pg_default_acl,pg_catalog.pg_init_privs,
 pg_catalog.pg_statistic_ext,pg_catalog.pg_shdepend
 IN SHARE ROW EXCLUSIVE MODE NOWAIT;
LOCK TABLE public.sites IN SHARE MODE NOWAIT;
LOCK TABLE public.money_ledger_reconciliation_batches,
 public.money_ledger_reconciliation_traversal IN ACCESS EXCLUSIVE MODE NOWAIT;
DO $retirement349$
DECLARE
 actual_profile jsonb;
 family text[];
 tables oid[]:=ARRAY['public.money_ledger_reconciliation_batches'::regclass,'public.money_ledger_reconciliation_traversal'::regclass];
 indexes oid[];
 relations oid[];
 types oid[];
 rpc oid:='public.run_money_ledger_reconciliation_batch_v1(text,integer)'::regprocedure;
 unexpected_journal boolean;
 expected_profile constant jsonb:=$frozen349$
{
 "namespace": {
  "acl": [
   "pg_database_owner=UC/pg_database_owner",
   "=U/pg_database_owner",
   "postgres=UC/pg_database_owner",
   "app_tenant=U/pg_database_owner"
  ],
  "owner": "pg_database_owner"
 },
 "function": {
  "owner": "postgres",
  "acl": [
   "postgres=X/postgres",
   "service_role=X/postgres"
  ],
  "security_definer": true,
  "config": [
   "search_path=pg_catalog, public"
  ],
  "comment": "Service-only bounded serialized traversal using canonical refresh; atomic cursor/outcome/request receipt, no financial posting or plug.",
  "definition_sha256": "ba9c7fc010165a71a1b15e10dd4c2777e32ed8312957c2a309a5be02423c7f51"
 },
 "tables": [
  {
   "name": "money_ledger_reconciliation_batches",
   "owner": "postgres",
   "kind": "r",
   "persistence": "p",
   "acl": [
    "postgres=arwdDxt/postgres",
    "service_role=r/postgres"
   ],
   "rls": true,
   "force_rls": true,
   "columns": [
    {
     "name": "id",
     "type": "uuid",
     "default": "gen_random_uuid()",
     "dropped": false,
     "ordinal": 1,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "request_key",
     "type": "text",
     "default": null,
     "dropped": false,
     "ordinal": 2,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "\"default\""
    },
    {
     "name": "batch_limit",
     "type": "integer",
     "default": null,
     "dropped": false,
     "ordinal": 3,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "pass_id",
     "type": "uuid",
     "default": null,
     "dropped": false,
     "ordinal": 4,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "result",
     "type": "jsonb",
     "default": null,
     "dropped": false,
     "ordinal": 5,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "created_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "dropped": false,
     "ordinal": 6,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "updated_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "dropped": false,
     "ordinal": 7,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "deleted_at",
     "type": "timestamp with time zone",
     "default": null,
     "dropped": false,
     "ordinal": 8,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "created_by",
     "type": "uuid",
     "default": null,
     "dropped": false,
     "ordinal": 9,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "updated_by",
     "type": "uuid",
     "default": null,
     "dropped": false,
     "ordinal": 10,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    }
   ],
   "constraints": [
    {
     "name": "money_ledger_reconciliation_batches_batch_limit_check",
     "definition": "CHECK (((batch_limit >= 1) AND (batch_limit <= 500)))"
    },
    {
     "name": "money_ledger_reconciliation_batches_pkey",
     "definition": "PRIMARY KEY (id)"
    },
    {
     "name": "money_ledger_reconciliation_batches_request_key_check",
     "definition": "CHECK (((length(request_key) >= 1) AND (length(request_key) <= 200)))"
    },
    {
     "name": "money_ledger_reconciliation_batches_request_key_key",
     "definition": "UNIQUE (request_key)"
    },
    {
     "name": "money_ledger_reconciliation_batches_result_check",
     "definition": "CHECK ((jsonb_typeof(result) = 'object'::text))"
    }
   ],
   "indexes": [
    {
     "definition": "CREATE INDEX money_ledger_reconciliation_batches_pass_idx ON public.money_ledger_reconciliation_batches USING btree (pass_id, created_at, id)"
    },
    {
     "definition": "CREATE UNIQUE INDEX money_ledger_reconciliation_batches_pkey ON public.money_ledger_reconciliation_batches USING btree (id)"
    },
    {
     "definition": "CREATE UNIQUE INDEX money_ledger_reconciliation_batches_request_key_key ON public.money_ledger_reconciliation_batches USING btree (request_key)"
    }
   ],
   "triggers": [
    {
     "name": "money_ledger_reconciliation_batches_updated",
     "enabled": "O",
     "definition": "CREATE TRIGGER money_ledger_reconciliation_batches_updated BEFORE UPDATE ON public.money_ledger_reconciliation_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at()"
    }
   ],
   "policies": [
    {
     "name": "money_ledger_reconciliation_batches_service_read",
     "check": null,
     "roles": [
      "service_role"
     ],
     "using": "true",
     "command": "r",
     "permissive": true
    }
   ]
  },
  {
   "name": "money_ledger_reconciliation_traversal",
   "owner": "postgres",
   "kind": "r",
   "persistence": "p",
   "acl": [
    "postgres=arwdDxt/postgres",
    "service_role=r/postgres"
   ],
   "rls": true,
   "force_rls": true,
   "columns": [
    {
     "name": "id",
     "type": "uuid",
     "default": "'00000000-0000-4000-8000-000000000349'::uuid",
     "dropped": false,
     "ordinal": 1,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "pass_id",
     "type": "uuid",
     "default": null,
     "dropped": false,
     "ordinal": 2,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "pass_started_at",
     "type": "timestamp with time zone",
     "default": null,
     "dropped": false,
     "ordinal": 3,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "pass_completed_at",
     "type": "timestamp with time zone",
     "default": null,
     "dropped": false,
     "ordinal": 4,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "watermark_created_at",
     "type": "timestamp with time zone",
     "default": null,
     "dropped": false,
     "ordinal": 5,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "watermark_site_id",
     "type": "uuid",
     "default": null,
     "dropped": false,
     "ordinal": 6,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "cursor_created_at",
     "type": "timestamp with time zone",
     "default": null,
     "dropped": false,
     "ordinal": 7,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "cursor_site_id",
     "type": "uuid",
     "default": null,
     "dropped": false,
     "ordinal": 8,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "checked",
     "type": "integer",
     "default": "0",
     "dropped": false,
     "ordinal": 9,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "verified",
     "type": "integer",
     "default": "0",
     "dropped": false,
     "ordinal": 10,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "mismatches",
     "type": "integer",
     "default": "0",
     "dropped": false,
     "ordinal": 11,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "failed",
     "type": "integer",
     "default": "0",
     "dropped": false,
     "ordinal": 12,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "revision",
     "type": "bigint",
     "default": "0",
     "dropped": false,
     "ordinal": 13,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "created_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "dropped": false,
     "ordinal": 14,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "updated_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "dropped": false,
     "ordinal": 15,
     "identity": "",
     "not_null": true,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "deleted_at",
     "type": "timestamp with time zone",
     "default": null,
     "dropped": false,
     "ordinal": 16,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "created_by",
     "type": "uuid",
     "default": null,
     "dropped": false,
     "ordinal": 17,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    },
    {
     "name": "updated_by",
     "type": "uuid",
     "default": null,
     "dropped": false,
     "ordinal": 18,
     "identity": "",
     "not_null": false,
     "generated": "",
     "collation": "-"
    }
   ],
   "constraints": [
    {
     "name": "money_ledger_reconciliation_traversal_check",
     "definition": "CHECK ((checked = ((verified + mismatches) + failed)))"
    },
    {
     "name": "money_ledger_reconciliation_traversal_check1",
     "definition": "CHECK (((watermark_created_at IS NULL) = (watermark_site_id IS NULL)))"
    },
    {
     "name": "money_ledger_reconciliation_traversal_check2",
     "definition": "CHECK (((cursor_created_at IS NULL) = (cursor_site_id IS NULL)))"
    },
    {
     "name": "money_ledger_reconciliation_traversal_checked_check",
     "definition": "CHECK ((checked >= 0))"
    },
    {
     "name": "money_ledger_reconciliation_traversal_failed_check",
     "definition": "CHECK ((failed >= 0))"
    },
    {
     "name": "money_ledger_reconciliation_traversal_id_check",
     "definition": "CHECK ((id = '00000000-0000-4000-8000-000000000349'::uuid))"
    },
    {
     "name": "money_ledger_reconciliation_traversal_mismatches_check",
     "definition": "CHECK ((mismatches >= 0))"
    },
    {
     "name": "money_ledger_reconciliation_traversal_pkey",
     "definition": "PRIMARY KEY (id)"
    },
    {
     "name": "money_ledger_reconciliation_traversal_revision_check",
     "definition": "CHECK ((revision >= 0))"
    },
    {
     "name": "money_ledger_reconciliation_traversal_verified_check",
     "definition": "CHECK ((verified >= 0))"
    }
   ],
   "indexes": [
    {
     "definition": "CREATE UNIQUE INDEX money_ledger_reconciliation_traversal_pkey ON public.money_ledger_reconciliation_traversal USING btree (id)"
    }
   ],
   "triggers": [
    {
     "name": "money_ledger_reconciliation_traversal_updated",
     "enabled": "O",
     "definition": "CREATE TRIGGER money_ledger_reconciliation_traversal_updated BEFORE UPDATE ON public.money_ledger_reconciliation_traversal FOR EACH ROW EXECUTE FUNCTION update_updated_at()"
    }
   ],
   "policies": [
    {
     "name": "money_ledger_reconciliation_traversal_service_read",
     "check": null,
     "roles": [
      "service_role"
     ],
     "using": "true",
     "command": "r",
     "permissive": true
    }
   ]
  }
 ]
}
$frozen349$::jsonb;
BEGIN
 -- Native CREATE can release its catalog relation lock while retaining an
 -- uncommitted row. Fresh read-committed queries plus a foreign-XID/prepared
 -- fence close that gap; retain every lock until the final commit or abort.
 IF current_user<>'postgres' OR session_user<>current_user
  OR NOT(SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user)
  OR (SELECT pg_get_userbyid(datdba) FROM pg_catalog.pg_database WHERE datname=current_database())<>'postgres'
  OR current_setting('transaction_isolation')<>'read committed'
  OR current_setting('session_replication_role')<>'origin'
  OR nullif(current_setting('app.site_id',true),'') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks WHERE locktype='transactionid' AND mode='ExclusiveLock' AND granted AND(pid IS NULL OR pid<>pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
  RAISE EXCEPTION 'ROLLBACK349_UNSAFE_SESSION_OR_WRITER: reviewed administrator/read-committed/origin/quiescent maintenance required';
 END IF;
 IF to_regclass('public.migration_privilege_journal') IS NOT NULL THEN
  EXECUTE 'LOCK TABLE public.migration_privilege_journal IN SHARE MODE NOWAIT';
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration=''349'')' INTO unexpected_journal;
  IF unexpected_journal THEN RAISE EXCEPTION 'ROLLBACK349_UNKNOWN_PROVENANCE: original349 has no journal';END IF;
 END IF;
 SELECT coalesce(array_agg(n.nspname||'.'||p.proname ORDER BY n.nspname,p.proname),'{}'::text[]) INTO family
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE p.proname LIKE 'run_money_ledger_reconciliation_batch%';
 IF family IS DISTINCT FROM ARRAY['public.run_money_ledger_reconciliation_batch_v1']::text[] THEN
  RAISE EXCEPTION 'ROLLBACK349_UNKNOWN_FUNCTION_FAMILY';END IF;
 SELECT coalesce(array_agg(n.nspname||'.'||c.relname ORDER BY n.nspname,c.relname),'{}'::text[]) INTO family
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relname LIKE 'money_ledger_reconciliation_%';
 IF family IS DISTINCT FROM ARRAY[
  'public.money_ledger_reconciliation_batches','public.money_ledger_reconciliation_batches_pass_idx',
  'public.money_ledger_reconciliation_batches_pkey','public.money_ledger_reconciliation_batches_request_key_key',
  'public.money_ledger_reconciliation_sites_order_idx','public.money_ledger_reconciliation_traversal',
  'public.money_ledger_reconciliation_traversal_pkey']::text[]
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname LIKE 'money_ledger_reconciliation_%') THEN
  RAISE EXCEPTION 'ROLLBACK349_UNKNOWN_RELATION_OR_SCHEMA_FAMILY';END IF;
 SELECT array_agg(indexrelid ORDER BY indexrelid) INTO indexes FROM pg_catalog.pg_index
 WHERE indrelid=ANY(tables) OR indexrelid='public.money_ledger_reconciliation_sites_order_idx'::regclass;
 IF cardinality(indexes)<>5
  OR pg_get_indexdef('public.money_ledger_reconciliation_sites_order_idx'::regclass)<>
   'CREATE INDEX money_ledger_reconciliation_sites_order_idx ON public.sites USING btree (COALESCE(created_at, ''-infinity''::timestamp with time zone), id) WHERE (deleted_at IS NULL)' THEN
  RAISE EXCEPTION 'ROLLBACK349_UNKNOWN_INDEX_PROFILE';END IF;
 SELECT array_agg(t.oid ORDER BY t.oid) INTO types FROM pg_catalog.pg_type t
 WHERE t.typrelid=ANY(tables) OR t.typelem IN(SELECT reltype FROM pg_catalog.pg_class WHERE oid=ANY(tables));
 IF cardinality(types)<>4 OR (SELECT count(*) FROM pg_catalog.pg_type WHERE typname LIKE '%money_ledger_reconciliation_%')<>4
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_type t WHERE t.oid=ANY(types) AND
   (t.typnamespace<>'public'::regnamespace OR t.typowner<>'postgres'::regrole OR t.typacl IS NOT NULL
    OR t.typdefault IS NOT NULL OR t.typdefaultbin IS NOT NULL OR t.typnotnull OR t.typbasetype<>0 OR t.typcollation<>0
    OR NOT((t.typtype='c' AND t.typrelid=ANY(tables) AND t.typname=(SELECT relname FROM pg_catalog.pg_class WHERE oid=t.typrelid))
     OR(t.typtype='b' AND t.typcategory='A' AND EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid=ANY(tables) AND c.reltype=t.typelem AND t.typname='_'||c.relname))))) THEN
  RAISE EXCEPTION 'ROLLBACK349_UNKNOWN_TYPE_FAMILY';END IF;
 -- Catalog flags omitted by textual DDL renderers are checked explicitly.
 SELECT array_agg(oid ORDER BY oid) INTO relations FROM pg_catalog.pg_class WHERE oid=ANY(tables||indexes)
  OR oid IN(SELECT reltoastrelid FROM pg_catalog.pg_class WHERE oid=ANY(tables))
  OR oid IN(SELECT indexrelid FROM pg_catalog.pg_index WHERE indrelid IN(SELECT reltoastrelid FROM pg_catalog.pg_class WHERE oid=ANY(tables)));
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid=ANY(relations) AND
   (c.relowner<>'postgres'::regrole OR c.relpersistence<>'p' OR c.reloptions IS NOT NULL
    OR c.reltablespace<>0 OR c.relrewrite<>0 OR c.relhasrules OR c.relhassubclass OR c.relispartition OR c.reloftype<>0
    OR NOT c.relispopulated))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid=ANY(tables) AND(relkind<>'r' OR relreplident<>'d' OR relam<>(SELECT oid FROM pg_catalog.pg_am WHERE amname='heap' AND amtype='t')))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid=ANY(indexes) AND(relkind<>'i' OR relacl IS NOT NULL OR relam<>(SELECT oid FROM pg_catalog.pg_am WHERE amname='btree' AND amtype='i')))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_inherits WHERE inhrelid=ANY(relations) OR inhparent=ANY(relations))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_type t ON t.oid=a.atttypid WHERE a.attrelid=ANY(relations) AND a.attnum>0 AND
   (a.attisdropped OR a.attacl IS NOT NULL OR a.attoptions IS NOT NULL OR a.attfdwoptions IS NOT NULL OR a.atthasmissing
    OR a.attstattarget<>-1 OR a.attcompression<>''
    OR a.attstorage<>CASE WHEN a.attrelid IN(SELECT reltoastrelid FROM pg_catalog.pg_class WHERE oid=ANY(tables))
      THEN 'p'::"char" ELSE t.typstorage END))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_index WHERE indexrelid=ANY(indexes) AND
   (NOT indisvalid OR NOT indisready OR NOT indislive OR indisclustered OR indisreplident OR indisexclusion OR NOT indimmediate OR indnullsnotdistinct))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=ANY(tables) AND
   (contype NOT IN('c','p','u') OR NOT convalidated OR condeferrable OR condeferred OR connoinherit IS DISTINCT FROM (contype IN('p','u')) OR coninhcount<>0 OR NOT conislocal OR conparentid<>0))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=ANY(tables) AND
   (tgfoid<>'public.update_updated_at()'::regprocedure OR tgtype<>19 OR tgenabled<>'O' OR tgisinternal
    OR tgdeferrable OR tginitdeferred OR tgconstraint<>0 OR tgnargs<>0 OR tgqual IS NOT NULL
    OR tgoldtable IS NOT NULL OR tgnewtable IS NOT NULL)) THEN
  RAISE EXCEPTION 'ROLLBACK349_UNKNOWN_SCHEMA_ATTRIBUTES';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=rpc AND
   (p.proowner<>'postgres'::regrole OR p.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
    OR p.prokind<>'f' OR p.prorettype<>'jsonb'::regtype OR p.proretset OR p.proisstrict OR p.proleakproof
    OR p.provolatile<>'v' OR p.proparallel<>'u' OR p.provariadic<>0 OR p.prosupport<>0
    OR p.pronargs<>2 OR p.pronargdefaults<>1 OR p.proargmodes IS NOT NULL OR p.proallargtypes IS NOT NULL
    OR p.proargnames IS DISTINCT FROM ARRAY['p_request_key','p_limit']::text[]
    OR pg_get_expr(p.proargdefaults,0)<>'100' OR p.procost<>100 OR p.prorows<>0)) THEN
  RAISE EXCEPTION 'ROLLBACK349_UNKNOWN_FUNCTION_ABI';END IF;
 -- Effective permissions include inherited role membership and column grants.
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant','service_role']) r(name)
  CROSS JOIN unnest(tables) t(oid)
  CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) v(name)
  WHERE has_table_privilege(r.name,t.oid,v.name) IS DISTINCT FROM(r.name='service_role' AND v.name='SELECT'))
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant','service_role']) r(name)
   WHERE has_function_privilege(r.name,rpc,'EXECUTE') IS DISTINCT FROM(r.name='service_role')
    OR has_function_privilege(r.name,rpc,'EXECUTE WITH GRANT OPTION')) THEN
  RAISE EXCEPTION 'ROLLBACK349_UNKNOWN_EFFECTIVE_PRIVILEGES';END IF;
 -- Enumerate only known automatic subobjects; reject external dependencies,
 -- extension membership, annotations and security labels before any DROP.
 IF EXISTS(WITH addresses(classid,objid) AS(
   SELECT 'pg_catalog.pg_class'::regclass,unnest(relations) UNION ALL
   SELECT 'pg_catalog.pg_type'::regclass,unnest(types) UNION ALL
   SELECT 'pg_catalog.pg_proc'::regclass,rpc UNION ALL
   SELECT 'pg_catalog.pg_constraint'::regclass,oid FROM pg_catalog.pg_constraint WHERE conrelid=ANY(tables) UNION ALL
   SELECT 'pg_catalog.pg_attrdef'::regclass,oid FROM pg_catalog.pg_attrdef WHERE adrelid=ANY(tables) UNION ALL
   SELECT 'pg_catalog.pg_trigger'::regclass,oid FROM pg_catalog.pg_trigger WHERE tgrelid=ANY(tables) UNION ALL
   SELECT 'pg_catalog.pg_policy'::regclass,oid FROM pg_catalog.pg_policy WHERE polrelid=ANY(tables))
  SELECT 1 FROM pg_catalog.pg_depend d JOIN addresses a ON a.classid=d.refclassid AND a.objid=d.refobjid
   WHERE NOT EXISTS(SELECT 1 FROM addresses b WHERE b.classid=d.classid AND b.objid=d.objid)
  UNION ALL
  SELECT 1 FROM pg_catalog.pg_depend d JOIN addresses a ON a.classid=d.classid AND a.objid=d.objid WHERE d.deptype IN('e','x')
  UNION ALL
  SELECT 1 FROM pg_catalog.pg_description d JOIN addresses a ON a.classid=d.classoid AND a.objid=d.objoid
   WHERE NOT(d.classoid='pg_catalog.pg_proc'::regclass AND d.objoid=rpc AND d.objsubid=0)
  UNION ALL
  SELECT 1 FROM pg_catalog.pg_seclabel d JOIN addresses a ON a.classid=d.classoid AND a.objid=d.objoid
  UNION ALL
  SELECT 1 FROM pg_catalog.pg_init_privs d JOIN addresses a ON a.classid=d.classoid AND a.objid=d.objoid) THEN
  RAISE EXCEPTION 'ROLLBACK349_UNKNOWN_DEPENDENCY_OR_ANNOTATION';END IF;
 SELECT jsonb_build_object(
  'namespace',(SELECT jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl) FROM pg_catalog.pg_namespace WHERE nspname='public'),
  'function',(SELECT jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',proacl,'security_definer',prosecdef,
   'config',proconfig,'comment',obj_description(oid,'pg_proc'),'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex')) FROM pg_catalog.pg_proc WHERE oid=rpc),
  'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,
   'persistence',c.relpersistence,'acl',c.relacl,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
   'columns',(SELECT jsonb_agg(jsonb_build_object('ordinal',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
    'not_null',a.attnotnull,'dropped',a.attisdropped,'identity',a.attidentity,'generated',a.attgenerated,
    'collation',a.attcollation::regcollation::text,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
    FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
   'constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) ORDER BY conname) FROM pg_catalog.pg_constraint WHERE conrelid=c.oid),
   'indexes',(SELECT jsonb_agg(jsonb_build_object('definition',pg_get_indexdef(indexrelid)) ORDER BY pg_get_indexdef(indexrelid)) FROM pg_catalog.pg_index WHERE indrelid=c.oid),
   'triggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) ORDER BY tgname) FROM pg_catalog.pg_trigger WHERE tgrelid=c.oid),
   'policies',(SELECT jsonb_agg(jsonb_build_object('name',polname,'command',polcmd,'permissive',polpermissive,
    'roles',(SELECT jsonb_agg(CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END ORDER BY r) FROM unnest(polroles) r),
    'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) ORDER BY polname) FROM pg_catalog.pg_policy WHERE polrelid=c.oid)) ORDER BY c.relname)
   FROM pg_catalog.pg_class c WHERE c.oid=ANY(tables))) INTO actual_profile;
 IF actual_profile IS DISTINCT FROM expected_profile THEN
  RAISE EXCEPTION 'ROLLBACK349_UNKNOWN_SOURCE_SCHEMA_OR_ACL_PROFILE: use reviewed forward recovery';END IF;
 IF EXISTS(SELECT 1 FROM public.money_ledger_reconciliation_batches)
  OR EXISTS(SELECT 1 FROM public.money_ledger_reconciliation_traversal) THEN
  RAISE EXCEPTION 'ROLLBACK349_RETAINED_STATE: preserve all traversal and request evidence; use reviewed forward recovery';END IF;
END $retirement349$;
DO $final_quiescence349$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
  RAISE EXCEPTION 'ROLLBACK349_PREPARED_TRANSACTIONS: reviewed maintenance requires no prepared transactions';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks WHERE locktype='transactionid' AND mode='ExclusiveLock' AND granted AND(pid IS NULL OR pid<>pg_backend_pid())) THEN
  RAISE EXCEPTION 'ROLLBACK349_UNSAFE_SESSION_OR_WRITER: final maintenance recheck refuses foreign writes';
 END IF;
END $final_quiescence349$;
-- No CASCADE, conditional DROP, source rewrite, row clearing or repair-by-reapply.
DROP FUNCTION public.run_money_ledger_reconciliation_batch_v1(text,integer) RESTRICT;
DROP TABLE public.money_ledger_reconciliation_batches RESTRICT;
DROP TABLE public.money_ledger_reconciliation_traversal RESTRICT;
DROP INDEX public.money_ledger_reconciliation_sites_order_idx RESTRICT;
COMMIT;
