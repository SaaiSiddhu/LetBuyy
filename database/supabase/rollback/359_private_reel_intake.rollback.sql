-- 359 empty-only retirement. Retained intake, charge, audit or custody evidence
-- requires reviewed forward recovery. This file authorizes no object deletion.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL lock_timeout='5s';
-- NOWAIT refuses an already-active catalog/table writer. Locks serialize new
-- DDL, grants/role changes and every private table access until commit/abort.
LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_attribute,
 pg_catalog.pg_attrdef,pg_catalog.pg_constraint,pg_catalog.pg_trigger,
 pg_catalog.pg_policy,pg_catalog.pg_index,pg_catalog.pg_namespace,
 pg_catalog.pg_type,pg_catalog.pg_depend,pg_catalog.pg_rewrite,
 pg_catalog.pg_authid,pg_catalog.pg_auth_members,pg_catalog.pg_database,
 pg_catalog.pg_inherits,pg_catalog.pg_description,pg_catalog.pg_seclabel,
 pg_catalog.pg_extension IN SHARE ROW EXCLUSIVE MODE NOWAIT;
LOCK TABLE public.sites,public.users_custom,public.sessions,public.media_assets,
 public.reel_asset_provenance,public.audit_logs,public.outbox_events IN SHARE MODE NOWAIT;
LOCK TABLE public.reel_upload_intents IN ACCESS EXCLUSIVE MODE NOWAIT;
DO $intake_retirement_guard$
DECLARE prerequisite jsonb;e record;inspected_function pg_proc%ROWTYPE;actual_family text[];actual_profile jsonb;
 expected_profile jsonb:=$intake_frozen_profile$
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
 "functions": [
  {
   "signature": "protect_reel_upload_intent_v1()",
   "input_names": [],
   "result": "trigger",
   "returns_set": false,
   "body_md5": "3ef3e4c7cb1631754fc21e1cfd12dd36",
   "owner": "postgres",
   "language": "plpgsql",
   "security_definer": false,
   "volatility": "v",
   "strict": false,
   "leakproof": false,
   "parallel": "u",
   "kind": "f",
   "config": [
    "search_path=pg_catalog, public, pg_temp"
   ],
   "defaults": null,
   "acl": [
    "postgres=X/postgres"
   ]
  },
  {
   "signature": "reel_upload_backend_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)",
   "input_names": [
    "p_session",
    "p_actor",
    "p_site",
    "p_action",
    "p_intent",
    "p_command",
    "p_admission",
    "p_evidence"
   ],
   "result": "jsonb",
   "returns_set": false,
   "body_md5": "7c2699dda84e4f78a9cbb8b6aa9c8efd",
   "owner": "postgres",
   "language": "plpgsql",
   "security_definer": true,
   "volatility": "v",
   "strict": false,
   "leakproof": false,
   "parallel": "u",
   "kind": "f",
   "config": [
    "search_path=pg_catalog, public, pg_temp"
   ],
   "defaults": null,
   "acl": [
    "postgres=X/postgres",
    "service_role=X/postgres"
   ]
  },
  {
   "signature": "reel_upload_event_v1(jsonb,text)",
   "input_names": [
    "p_row",
    "p_action"
   ],
   "result": "void",
   "returns_set": false,
   "body_md5": "8e44c5d441a1a3b4dd950cfab654faf7",
   "owner": "postgres",
   "language": "plpgsql",
   "security_definer": false,
   "volatility": "v",
   "strict": false,
   "leakproof": false,
   "parallel": "u",
   "kind": "f",
   "config": [
    "search_path=pg_catalog, public, pg_temp"
   ],
   "defaults": null,
   "acl": [
    "postgres=X/postgres"
   ]
  },
  {
   "signature": "reel_upload_public_v1(jsonb,boolean)",
   "input_names": [
    "p_row",
    "p_replayed"
   ],
   "result": "jsonb",
   "returns_set": false,
   "body_md5": "e4f1a657fe2a19a72f725375a3390ec2",
   "owner": "postgres",
   "language": "sql",
   "security_definer": false,
   "volatility": "i",
   "strict": false,
   "leakproof": false,
   "parallel": "u",
   "kind": "f",
   "config": [
    "search_path=pg_catalog, public, pg_temp"
   ],
   "defaults": null,
   "acl": [
    "postgres=X/postgres"
   ]
  },
  {
   "signature": "reel_upload_row_valid_v1(text,integer,bigint,text,text,text,text,text,bigint,text,timestamp with time zone,uuid,uuid,text,text,text)",
   "input_names": [
    "p_state",
    "p_version",
    "p_bytes",
    "p_sha",
    "p_mime",
    "p_key",
    "p_filename",
    "p_digest",
    "p_charge",
    "p_lease",
    "p_until",
    "p_media",
    "p_provenance",
    "p_object_version",
    "p_completion",
    "p_error"
   ],
   "result": "boolean",
   "returns_set": false,
   "body_md5": "4b4ce9ea8fdf9d396e81fcb9a29b1a91",
   "owner": "postgres",
   "language": "sql",
   "security_definer": false,
   "volatility": "i",
   "strict": false,
   "leakproof": false,
   "parallel": "u",
   "kind": "f",
   "config": [
    "search_path=pg_catalog, public, pg_temp"
   ],
   "defaults": null,
   "acl": [
    "postgres=X/postgres"
   ]
  },
  {
   "signature": "reel_upload_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)",
   "input_names": [
    "p_session",
    "p_actor",
    "p_site",
    "p_action",
    "p_intent",
    "p_command",
    "p_admission",
    "p_evidence"
   ],
   "result": "jsonb",
   "returns_set": false,
   "body_md5": "1120c27c1d209a56b7cdaaa2712e71a5",
   "owner": "postgres",
   "language": "sql",
   "security_definer": false,
   "volatility": "v",
   "strict": false,
   "leakproof": false,
   "parallel": "u",
   "kind": "f",
   "config": [
    "search_path=pg_catalog, public, pg_temp"
   ],
   "defaults": null,
   "acl": [
    "postgres=X/postgres",
    "service_role=X/postgres"
   ]
  }
 ],
 "tables": [
  {
   "name": "reel_upload_intents",
   "owner": "postgres",
   "kind": "r",
   "persistence": "p",
   "rls": true,
   "force_rls": true,
   "acl": [
    "postgres=arwdDxt/postgres"
   ],
   "columns": [
    {
     "ordinal": 1,
     "name": "id",
     "type": "uuid",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": "gen_random_uuid()"
    },
    {
     "ordinal": 2,
     "name": "site_id",
     "type": "uuid",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 3,
     "name": "actor_id",
     "type": "uuid",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 4,
     "name": "session_id",
     "type": "uuid",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 5,
     "name": "idempotency_key",
     "type": "text",
     "not_null": true,
     "collation": "\"default\"",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 6,
     "name": "request_sha256",
     "type": "text",
     "not_null": true,
     "collation": "\"default\"",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 7,
     "name": "filename",
     "type": "text",
     "not_null": true,
     "collation": "\"default\"",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 8,
     "name": "content_type",
     "type": "text",
     "not_null": true,
     "collation": "\"default\"",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 9,
     "name": "size_bytes",
     "type": "bigint",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 10,
     "name": "checksum_sha256",
     "type": "text",
     "not_null": true,
     "collation": "\"default\"",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 11,
     "name": "profile_ref",
     "type": "text",
     "not_null": true,
     "collation": "\"default\"",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 12,
     "name": "profile_digest",
     "type": "text",
     "not_null": true,
     "collation": "\"default\"",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 13,
     "name": "admission",
     "type": "jsonb",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 14,
     "name": "object_nonce",
     "type": "uuid",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": "gen_random_uuid()"
    },
    {
     "ordinal": 15,
     "name": "state",
     "type": "text",
     "not_null": true,
     "collation": "\"default\"",
     "generated": "",
     "identity": "",
     "default": "'reserved'::text"
    },
    {
     "ordinal": 16,
     "name": "version",
     "type": "integer",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": "1"
    },
    {
     "ordinal": 17,
     "name": "charged_bytes",
     "type": "bigint",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 18,
     "name": "expires_at",
     "type": "timestamp with time zone",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 19,
     "name": "lease_sha256",
     "type": "text",
     "not_null": false,
     "collation": "\"default\"",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 20,
     "name": "lease_expires_at",
     "type": "timestamp with time zone",
     "not_null": false,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 21,
     "name": "media_asset_id",
     "type": "uuid",
     "not_null": false,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 22,
     "name": "provenance_id",
     "type": "uuid",
     "not_null": false,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 23,
     "name": "object_version",
     "type": "text",
     "not_null": false,
     "collation": "\"default\"",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 24,
     "name": "completion_sha256",
     "type": "text",
     "not_null": false,
     "collation": "\"default\"",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 25,
     "name": "last_error_code",
     "type": "text",
     "not_null": false,
     "collation": "\"default\"",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 26,
     "name": "created_by",
     "type": "uuid",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 27,
     "name": "updated_by",
     "type": "uuid",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    },
    {
     "ordinal": 28,
     "name": "created_at",
     "type": "timestamp with time zone",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": "clock_timestamp()"
    },
    {
     "ordinal": 29,
     "name": "updated_at",
     "type": "timestamp with time zone",
     "not_null": true,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": "clock_timestamp()"
    },
    {
     "ordinal": 30,
     "name": "deleted_at",
     "type": "timestamp with time zone",
     "not_null": false,
     "collation": "-",
     "generated": "",
     "identity": "",
     "default": null
    }
   ],
   "constraints": [
    {
     "name": "reel_upload_intents_actor_fkey",
     "type": "f",
     "definition": "FOREIGN KEY (actor_id) REFERENCES users_custom(id) ON DELETE RESTRICT",
     "validated": true,
     "deferrable": false,
     "deferred": false,
     "no_inherit": true
    },
    {
     "name": "reel_upload_intents_media_fkey",
     "type": "f",
     "definition": "FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT",
     "validated": true,
     "deferrable": false,
     "deferred": false,
     "no_inherit": true
    },
    {
     "name": "reel_upload_intents_pkey",
     "type": "p",
     "definition": "PRIMARY KEY (id)",
     "validated": true,
     "deferrable": false,
     "deferred": false,
     "no_inherit": true
    },
    {
     "name": "reel_upload_intents_provenance_fkey",
     "type": "f",
     "definition": "FOREIGN KEY (provenance_id) REFERENCES reel_asset_provenance(id) ON DELETE RESTRICT",
     "validated": true,
     "deferrable": false,
     "deferred": false,
     "no_inherit": true
    },
    {
     "name": "reel_upload_intents_request_key",
     "type": "u",
     "definition": "UNIQUE (site_id, actor_id, idempotency_key)",
     "validated": true,
     "deferrable": false,
     "deferred": false,
     "no_inherit": true
    },
    {
     "name": "reel_upload_intents_session_fkey",
     "type": "f",
     "definition": "FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE RESTRICT",
     "validated": true,
     "deferrable": false,
     "deferred": false,
     "no_inherit": true
    },
    {
     "name": "reel_upload_intents_site_fkey",
     "type": "f",
     "definition": "FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE RESTRICT",
     "validated": true,
     "deferrable": false,
     "deferred": false,
     "no_inherit": true
    },
    {
     "name": "reel_upload_intents_valid",
     "type": "c",
     "definition": "CHECK (reel_upload_row_valid_v1(state, version, size_bytes, checksum_sha256, content_type, idempotency_key, filename, profile_digest, charged_bytes, lease_sha256, lease_expires_at, media_asset_id, provenance_id, object_version, completion_sha256, last_error_code))",
     "validated": true,
     "deferrable": false,
     "deferred": false,
     "no_inherit": false
    }
   ],
   "indexes": [
    "CREATE INDEX reel_upload_intents_site_page_idx ON public.reel_upload_intents USING btree (site_id, created_at, id)",
    "CREATE UNIQUE INDEX reel_upload_intents_pkey ON public.reel_upload_intents USING btree (id)",
    "CREATE UNIQUE INDEX reel_upload_intents_request_key ON public.reel_upload_intents USING btree (site_id, actor_id, idempotency_key)"
   ],
   "policies": [
    {
     "name": "tenant_read",
     "permissive": true,
     "command": "r",
     "roles": [
      "app_tenant"
     ],
     "using": "(site_id = current_site_id())",
     "check": null
    }
   ]
  }
 ]
}
$intake_frozen_profile$::jsonb;
BEGIN
 IF current_user<>'postgres' OR NOT(SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'postgres'
 OR current_setting('transaction_isolation')<>'read committed' OR current_setting('session_replication_role')<>'origin'
 OR EXISTS(SELECT 1 FROM pg_locks WHERE locktype='transactionid' AND mode='ExclusiveLock' AND granted AND(pid IS NULL OR pid<>pg_backend_pid()))
 OR EXISTS(SELECT 1 FROM pg_prepared_xacts) THEN RAISE EXCEPTION 'REEL_UPLOAD_ROLLBACK_UNSAFE_SESSION_OR_WRITER';END IF;
 SELECT coalesce(array_agg(n.nspname||'.'||p.proname ORDER BY n.nspname,p.proname),'{}'::text[]) INTO actual_family
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname~'(^|_)reels?(_|$)';
 IF actual_family IS DISTINCT FROM ARRAY['public.mutate_reel_review_v1','public.protect_reel_record_v1','public.protect_reel_upload_intent_v1','public.read_reel_reviews_v1','public.reel_actor_v1','public.reel_json_compact_v1','public.reel_payload_v1','public.reel_upload_backend_v1','public.reel_upload_event_v1','public.reel_upload_public_v1','public.reel_upload_row_valid_v1','public.reel_upload_v1']::text[] THEN RAISE EXCEPTION 'REEL_UPLOAD_ROLLBACK_UNKNOWN_FUNCTION_FAMILY';END IF;
 SELECT coalesce(array_agg(n.nspname||'.'||c.relname ORDER BY n.nspname,c.relname),'{}'::text[]) INTO actual_family
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname~'(^|_)reels?(_|$)' AND c.relkind NOT IN('i','I');
 IF actual_family IS DISTINCT FROM ARRAY['public.commerce_reel_events','public.commerce_reel_revisions','public.commerce_reels','public.reel_asset_provenance','public.reel_processing_receipts','public.reel_review_inspections','public.reel_upload_intents']::text[]
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname~'(^|_)reels?(_|$)') THEN RAISE EXCEPTION 'REEL_UPLOAD_ROLLBACK_UNKNOWN_RELATION_OR_SCHEMA';END IF;
 FOR e IN SELECT * FROM(VALUES
  ('protect_reel_record_v1','public.protect_reel_record_v1()',ARRAY[]::text[],'trigger','6164422dd7400ef9681e3ac058f9ed9b',0,false),
  ('reel_json_compact_v1','public.reel_json_compact_v1(json)',ARRAY['p_value']::text[],'text','0010259af51e8762637125afceb690a3',0,false),
  ('reel_actor_v1','public.reel_actor_v1(uuid,uuid,jsonb,boolean)',ARRAY['p_actor','p_site','p_console','p_write']::text[],'uuid','d99d69c697e36990561e8cfbb600d511',0,false),
  ('reel_payload_v1','public.reel_payload_v1(uuid,jsonb)',ARRAY['p_site','p_selection']::text[],'text','a0391dd81ec416922ce8c016c2b6460c',0,false),
  ('mutate_reel_review_v1','public.mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb)',ARRAY['p_actor','p_site','p_reel','p_command','p_console']::text[],'jsonb','b2c5009020c5993bc443250ea314e457',1,true),
  ('read_reel_reviews_v1','public.read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer)',ARRAY['p_actor','p_site','p_reel','p_console','p_page']::text[],'jsonb','385edefbc18555e10b669430c3aaac02',3,true)
 ) expected(name,signature,input_names,result_type,source_md5,default_count,service_execute) LOOP
  SELECT * INTO inspected_function FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(e.signature);
  IF inspected_function.oid IS NULL OR inspected_function.pronamespace IS DISTINCT FROM 'public'::regnamespace
   OR inspected_function.prokind<>'f' OR inspected_function.proretset
   OR inspected_function.prorettype IS DISTINCT FROM pg_catalog.to_regtype(e.result_type)
   OR coalesce(inspected_function.proargnames[1:inspected_function.pronargs],ARRAY[]::text[]) IS DISTINCT FROM e.input_names
   OR inspected_function.pronargs<>cardinality(e.input_names) OR inspected_function.pronargdefaults<>e.default_count
   OR inspected_function.proargmodes IS NOT NULL OR inspected_function.proallargtypes IS NOT NULL OR inspected_function.provariadic<>0
   OR inspected_function.proowner IS DISTINCT FROM pg_catalog.to_regrole(current_user)
   OR pg_catalog.md5(inspected_function.prosrc) IS DISTINCT FROM e.source_md5
   OR (SELECT count(*) FROM pg_catalog.pg_proc f WHERE f.pronamespace=inspected_function.pronamespace AND f.proname=inspected_function.proname)<>1
   OR pg_catalog.has_function_privilege('anon',inspected_function.oid,'EXECUTE')
   OR pg_catalog.has_function_privilege('authenticated',inspected_function.oid,'EXECUTE')
   OR pg_catalog.has_function_privilege('app_tenant',inspected_function.oid,'EXECUTE')
   OR pg_catalog.has_function_privilege('service_role',inspected_function.oid,'EXECUTE') IS DISTINCT FROM e.service_execute THEN
   RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_FUNCTION_ABI_BODY_OWNER_OR_PRIVILEGE: %',e.signature;
  END IF;
 END LOOP;
 FOR e IN SELECT * FROM(VALUES
('public.reel_upload_row_valid_v1(text,integer,bigint,text,text,text,text,text,bigint,text,timestamp with time zone,uuid,uuid,text,text,text)',ARRAY['p_state','p_version','p_bytes','p_sha','p_mime','p_key','p_filename','p_digest','p_charge','p_lease','p_until','p_media','p_provenance','p_object_version','p_completion','p_error']::text[],'boolean',false),
('public.protect_reel_upload_intent_v1()',ARRAY[]::text[],'trigger',false),
('public.reel_upload_public_v1(jsonb,boolean)',ARRAY['p_row','p_replayed']::text[],'jsonb',false),
('public.reel_upload_event_v1(jsonb,text)',ARRAY['p_row','p_action']::text[],'void',false),
('public.reel_upload_backend_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)',ARRAY['p_session','p_actor','p_site','p_action','p_intent','p_command','p_admission','p_evidence']::text[],'jsonb',true),
('public.reel_upload_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)',ARRAY['p_session','p_actor','p_site','p_action','p_intent','p_command','p_admission','p_evidence']::text[],'jsonb',true))v(signature,input_names,result_type,service_execute) LOOP
 SELECT * INTO inspected_function FROM pg_proc WHERE oid=to_regprocedure(e.signature);
 IF inspected_function.oid IS NULL OR inspected_function.pronamespace<>'public'::regnamespace
 OR inspected_function.pronargs<>cardinality(e.input_names) OR inspected_function.pronargdefaults<>0
 OR coalesce(inspected_function.proargnames,ARRAY[]::text[]) IS DISTINCT FROM e.input_names
 OR inspected_function.prorettype IS DISTINCT FROM to_regtype(e.result_type)
 OR inspected_function.proargmodes IS NOT NULL OR inspected_function.proallargtypes IS NOT NULL OR inspected_function.provariadic<>0
 OR inspected_function.prosupport<>0 OR inspected_function.procost<>100 OR inspected_function.prorows<>0
 OR has_function_privilege('anon',inspected_function.oid,'EXECUTE') OR has_function_privilege('authenticated',inspected_function.oid,'EXECUTE')
 OR has_function_privilege('app_tenant',inspected_function.oid,'EXECUTE')
 OR has_function_privilege('service_role',inspected_function.oid,'EXECUTE') IS DISTINCT FROM e.service_execute THEN
 RAISE EXCEPTION 'REEL_UPLOAD_ROLLBACK_UNKNOWN_FUNCTION_ABI_OR_PRIVILEGE';END IF;
 END LOOP;

 FOR prerequisite IN SELECT value FROM jsonb_array_elements($frozen_helpers$[{"acl":["postgres=X/postgres","service_role=X/postgres"],"kind":"f","owner":"postgres","config":["search_path=pg_catalog, public"],"result":"jsonb","strict":false,"body_md5":"b2c5009020c5993bc443250ea314e457","defaults":"NULL::jsonb","language":"plpgsql","parallel":"u","leakproof":false,"signature":"mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb)","volatility":"v","input_names":["p_actor","p_site","p_reel","p_command","p_console"],"returns_set":false,"security_definer":true,"definition_md5":"9e443d58433ade19e2efac97557d3993"},{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","config":null,"result":"trigger","strict":false,"body_md5":"6164422dd7400ef9681e3ac058f9ed9b","defaults":null,"language":"plpgsql","parallel":"u","leakproof":false,"signature":"protect_reel_record_v1()","volatility":"v","input_names":[],"returns_set":false,"security_definer":false,"definition_md5":"36a0735f3cf4a4309551e6340e05841c"},{"acl":["postgres=X/postgres","service_role=X/postgres"],"kind":"f","owner":"postgres","config":["search_path=pg_catalog, public"],"result":"jsonb","strict":false,"body_md5":"385edefbc18555e10b669430c3aaac02","defaults":"NULL::uuid, NULL::jsonb, 1","language":"plpgsql","parallel":"u","leakproof":false,"signature":"read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer)","volatility":"v","input_names":["p_actor","p_site","p_reel","p_console","p_page"],"returns_set":false,"security_definer":true,"definition_md5":"606eb4e368c8270fad0ad6c5828cd201"},{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","config":["search_path=pg_catalog, public"],"result":"uuid","strict":false,"body_md5":"d99d69c697e36990561e8cfbb600d511","defaults":null,"language":"plpgsql","parallel":"u","leakproof":false,"signature":"reel_actor_v1(uuid,uuid,jsonb,boolean)","volatility":"v","input_names":["p_actor","p_site","p_console","p_write"],"returns_set":false,"security_definer":true,"definition_md5":"f6dcb9321e8c66866659c53d2d5e3d26"},{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","config":["search_path=pg_catalog, public"],"result":"text","strict":false,"body_md5":"0010259af51e8762637125afceb690a3","defaults":null,"language":"sql","parallel":"u","leakproof":false,"signature":"reel_json_compact_v1(json)","volatility":"i","input_names":["p_value"],"returns_set":false,"security_definer":false,"definition_md5":"a4f01cc2da87dd6bfe9a7bff28dbda4b"},{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","config":["search_path=pg_catalog, public"],"result":"text","strict":false,"body_md5":"a0391dd81ec416922ce8c016c2b6460c","defaults":null,"language":"plpgsql","parallel":"u","leakproof":false,"signature":"reel_payload_v1(uuid,jsonb)","volatility":"v","input_names":["p_site","p_selection"],"returns_set":false,"security_definer":true,"definition_md5":"904696528e249aa246588666da541238"}]$frozen_helpers$::jsonb) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.'||(prerequisite->>'signature'))
   AND p.proowner='postgres'::regrole AND md5(pg_get_functiondef(p.oid))=prerequisite->>'definition_md5'
   AND to_jsonb(p.proacl)=prerequisite->'acl') THEN RAISE EXCEPTION 'REEL_UPLOAD_ROLLBACK_FROZEN_HELPER_DRIFT';END IF;
 END LOOP;
 -- Relation/type inventory, non-default storage/column grants, index validity,
 -- inheritance, annotations and extension membership are not silently discarded.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid IN('public.reel_upload_intents'::regclass)
   AND (c.relkind<>'r' OR c.relpersistence<>'p' OR c.reloptions IS NOT NULL
    OR c.relreplident<>'d' OR c.relam IS DISTINCT FROM(SELECT oid FROM pg_catalog.pg_am WHERE amname='heap' AND amtype='t')
    OR c.reltablespace<>0 OR c.relrewrite<>0 OR NOT c.relispopulated OR c.relhasrules OR c.relhassubclass OR c.relispartition OR c.reloftype<>0))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_inherits WHERE inhrelid IN('public.reel_upload_intents'::regclass) OR inhparent IN('public.reel_upload_intents'::regclass))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
   WHERE a.attrelid IN('public.reel_upload_intents'::regclass) AND a.attnum>0
    AND (a.attacl IS NOT NULL OR a.attoptions IS NOT NULL OR a.attfdwoptions IS NOT NULL
     OR a.atthasmissing OR a.attstattarget<>-1 OR a.attcompression<>'' OR a.attstorage<>t.typstorage))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_index WHERE indrelid IN('public.reel_upload_intents'::regclass)
   AND (NOT indisvalid OR NOT indisready OR NOT indislive OR indisclustered OR indisreplident))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_description WHERE
   (classoid='pg_catalog.pg_class'::regclass AND objoid IN('public.reel_upload_intents'::regclass))
   OR (classoid='pg_catalog.pg_proc'::regclass AND objoid IN('public.reel_upload_row_valid_v1(text,integer,bigint,text,text,text,text,text,bigint,text,timestamp with time zone,uuid,uuid,text,text,text)'::regprocedure,'public.protect_reel_upload_intent_v1()'::regprocedure,'public.reel_upload_public_v1(jsonb,boolean)'::regprocedure,'public.reel_upload_event_v1(jsonb,text)'::regprocedure,'public.reel_upload_backend_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure,'public.reel_upload_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure))
   OR (classoid='pg_catalog.pg_type'::regclass AND objoid IN(SELECT reltype FROM pg_catalog.pg_class WHERE oid IN('public.reel_upload_intents'::regclass))))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_seclabel WHERE
   (classoid='pg_catalog.pg_class'::regclass AND objoid IN('public.reel_upload_intents'::regclass))
   OR (classoid='pg_catalog.pg_proc'::regclass AND objoid IN('public.reel_upload_row_valid_v1(text,integer,bigint,text,text,text,text,text,bigint,text,timestamp with time zone,uuid,uuid,text,text,text)'::regprocedure,'public.protect_reel_upload_intent_v1()'::regprocedure,'public.reel_upload_public_v1(jsonb,boolean)'::regprocedure,'public.reel_upload_event_v1(jsonb,text)'::regprocedure,'public.reel_upload_backend_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure,'public.reel_upload_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure)))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_depend WHERE deptype='e' AND
   ((classid='pg_catalog.pg_class'::regclass AND objid IN('public.reel_upload_intents'::regclass))
    OR (classid='pg_catalog.pg_proc'::regclass AND objid IN('public.reel_upload_row_valid_v1(text,integer,bigint,text,text,text,text,text,bigint,text,timestamp with time zone,uuid,uuid,text,text,text)'::regprocedure,'public.protect_reel_upload_intent_v1()'::regprocedure,'public.reel_upload_public_v1(jsonb,boolean)'::regprocedure,'public.reel_upload_event_v1(jsonb,text)'::regprocedure,'public.reel_upload_backend_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure,'public.reel_upload_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure)))) THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_SCHEMA_ATTRIBUTES: use reviewed forward recovery';
 END IF;
 -- 359 FKs are immediate RESTRICT references. Verify their four
 -- internal RI triggers, including action triggers on canonical parent tables.
 -- PostgreSQL16 tgtype: ROW=1, INSERT=4, DELETE=8, UPDATE=16, AFTER=0.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint fk
  CROSS JOIN(VALUES
   ('pg_catalog."RI_FKey_check_ins"()',true,5),
   ('pg_catalog."RI_FKey_check_upd"()',true,17),
   ('pg_catalog."RI_FKey_restrict_del"()',false,9),
   ('pg_catalog."RI_FKey_noaction_upd"()',false,17)
  ) expected(function_name,on_child,trigger_type)
  WHERE fk.contype='f' AND fk.conrelid IN('public.reel_upload_intents'::regclass) AND
   ((SELECT count(*) FROM pg_catalog.pg_trigger t WHERE t.tgconstraint=fk.oid)<>4
    OR(SELECT count(*) FROM pg_catalog.pg_trigger t WHERE t.tgconstraint=fk.oid
     AND t.tgfoid=pg_catalog.to_regprocedure(expected.function_name)
     AND t.tgrelid=CASE WHEN expected.on_child THEN fk.conrelid ELSE fk.confrelid END
     AND t.tgconstrrelid=CASE WHEN expected.on_child THEN fk.confrelid ELSE fk.conrelid END
     AND t.tgtype=expected.trigger_type AND t.tgenabled='O' AND t.tgisinternal
     AND NOT t.tgdeferrable AND NOT t.tginitdeferred AND t.tgnargs=0
     AND t.tgqual IS NULL)<>1)) THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_FOREIGN_KEY_TRIGGER_PROFILE';
 END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_type WHERE typname~'^_?reel_upload_')<>2
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
   WHERE t.typname~'^_?reel_upload_' AND NOT(n.nspname='public' AND t.typowner=pg_catalog.to_regrole(current_user) AND t.typacl IS NULL AND
    ((t.typtype='c' AND t.typrelid IN('public.reel_upload_intents'::regclass)) OR
     (t.typtype='b' AND t.typcategory='A' AND EXISTS(SELECT 1 FROM pg_catalog.pg_class c
       WHERE c.oid IN('public.reel_upload_intents'::regclass) AND t.typelem=c.reltype AND t.typname='_'||c.relname))))) THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_TYPE_FAMILY: use reviewed forward recovery';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c
   CROSS JOIN(VALUES('anon'),('authenticated'),('app_tenant'),('service_role')) roles(name)
   CROSS JOIN(VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) privileges(name)
   WHERE c.oid IN('public.reel_upload_intents'::regclass) AND pg_catalog.has_table_privilege(roles.name,c.oid,privileges.name)) THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_INHERITED_TABLE_PRIVILEGE';
 END IF;
 -- Reject outside dependent views/functions/foreign keys before any retirement.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_depend d WHERE
   ((d.refclassid='pg_catalog.pg_class'::regclass AND d.refobjid IN('public.reel_upload_intents'::regclass))
    OR(d.refclassid='pg_catalog.pg_proc'::regclass AND d.refobjid IN('public.reel_upload_row_valid_v1(text,integer,bigint,text,text,text,text,text,bigint,text,timestamp with time zone,uuid,uuid,text,text,text)'::regprocedure,'public.protect_reel_upload_intent_v1()'::regprocedure,'public.reel_upload_public_v1(jsonb,boolean)'::regprocedure,'public.reel_upload_event_v1(jsonb,text)'::regprocedure,'public.reel_upload_backend_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure,'public.reel_upload_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure))
    OR(d.refclassid='pg_catalog.pg_type'::regclass AND d.refobjid IN(
      SELECT t.oid FROM pg_catalog.pg_type t WHERE t.typrelid IN('public.reel_upload_intents'::regclass)
      OR t.typelem IN(SELECT reltype FROM pg_catalog.pg_class WHERE oid IN('public.reel_upload_intents'::regclass)))))
   AND NOT(
    (d.classid='pg_catalog.pg_class'::regclass AND (d.objid IN('public.reel_upload_intents'::regclass)
      OR d.objid IN(SELECT indexrelid FROM pg_catalog.pg_index WHERE indrelid IN('public.reel_upload_intents'::regclass))
      OR d.objid IN(SELECT reltoastrelid FROM pg_catalog.pg_class WHERE oid IN('public.reel_upload_intents'::regclass))))
    OR(d.classid='pg_catalog.pg_proc'::regclass AND d.objid IN('public.reel_upload_row_valid_v1(text,integer,bigint,text,text,text,text,text,bigint,text,timestamp with time zone,uuid,uuid,text,text,text)'::regprocedure,'public.protect_reel_upload_intent_v1()'::regprocedure,'public.reel_upload_public_v1(jsonb,boolean)'::regprocedure,'public.reel_upload_event_v1(jsonb,text)'::regprocedure,'public.reel_upload_backend_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure,'public.reel_upload_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure))
    OR(d.classid='pg_catalog.pg_type'::regclass AND d.objid IN(SELECT t.oid FROM pg_catalog.pg_type t
      WHERE t.typrelid IN('public.reel_upload_intents'::regclass) OR t.typelem IN(SELECT reltype FROM pg_catalog.pg_class WHERE oid IN('public.reel_upload_intents'::regclass))))
    OR(d.classid='pg_catalog.pg_constraint'::regclass AND d.objid IN(SELECT oid FROM pg_catalog.pg_constraint WHERE conrelid IN('public.reel_upload_intents'::regclass)))
    OR(d.classid='pg_catalog.pg_attrdef'::regclass AND d.objid IN(SELECT oid FROM pg_catalog.pg_attrdef WHERE adrelid IN('public.reel_upload_intents'::regclass)))
    OR(d.classid='pg_catalog.pg_policy'::regclass AND d.objid IN(SELECT oid FROM pg_catalog.pg_policy WHERE polrelid IN('public.reel_upload_intents'::regclass)))
    OR(d.classid='pg_catalog.pg_trigger'::regclass AND d.objid IN(SELECT oid FROM pg_catalog.pg_trigger WHERE tgrelid IN('public.reel_upload_intents'::regclass) OR(tgisinternal AND tgconstraint IN(SELECT oid FROM pg_catalog.pg_constraint WHERE conrelid IN('public.reel_upload_intents'::regclass)))))
   )) THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_EXTERNAL_DEPENDENCY: use reviewed forward recovery';
 END IF;

 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.reel_upload_intents'::regclass)<>11
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.reel_upload_intents'::regclass AND NOT tgisinternal
  AND tgname='protect_reel_upload_intent' AND tgfoid='public.protect_reel_upload_intent_v1()'::regprocedure
  AND tgtype=27 AND tgenabled='O' AND NOT tgdeferrable AND NOT tginitdeferred AND tgnargs=0
  AND tgqual IS NULL AND tgattr=''::int2vector AND tgoldtable IS NULL AND tgnewtable IS NULL)<>1
 OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.reel_upload_intents'::regclass AND
  (conislocal IS NOT TRUE OR coninhcount<>0 OR connoinherit IS DISTINCT FROM (contype<>'c') OR conparentid<>0 OR (contype='f' AND(confupdtype<>'a' OR confdeltype<>'r' OR confmatchtype<>'s')))) THEN
 RAISE EXCEPTION 'REEL_UPLOAD_ROLLBACK_UNKNOWN_TRIGGER_OR_CONSTRAINT';END IF;

 IF(SELECT count(*) FROM pg_type WHERE typname~'(^|_)reels?(_|$)')<>14
 OR EXISTS(SELECT 1 FROM pg_type t WHERE t.typname~'(^|_)reels?(_|$)' AND
  (t.typname NOT IN('commerce_reel_events','commerce_reel_revisions','commerce_reels','reel_asset_provenance','reel_processing_receipts','reel_review_inspections','reel_upload_intents','_commerce_reel_events','_commerce_reel_revisions','_commerce_reels','_reel_asset_provenance','_reel_processing_receipts','_reel_review_inspections','_reel_upload_intents') OR t.typnamespace<>'public'::regnamespace OR t.typowner<>'postgres'::regrole OR t.typacl IS NOT NULL)) THEN
 RAISE EXCEPTION 'REEL_UPLOAD_ROLLBACK_UNKNOWN_GLOBAL_TYPE_FAMILY';END IF;
 -- Index, array-type, constraint, trigger and policy annotations are also
 -- retained evidence; do not discard them implicitly with their parent table.
 IF EXISTS(SELECT 1 FROM pg_description d WHERE
  (d.classoid='pg_class'::regclass AND d.objoid IN(SELECT oid FROM pg_class WHERE relname~'^reel_upload_' OR oid IN(SELECT indexrelid FROM pg_index WHERE indrelid='reel_upload_intents'::regclass)))
  OR(d.classoid='pg_type'::regclass AND d.objoid IN(SELECT oid FROM pg_type WHERE typname~'^_?reel_upload_'))
  OR(d.classoid='pg_constraint'::regclass AND d.objoid IN(SELECT oid FROM pg_constraint WHERE conrelid='reel_upload_intents'::regclass))
  OR(d.classoid='pg_trigger'::regclass AND d.objoid IN(SELECT oid FROM pg_trigger WHERE tgrelid='reel_upload_intents'::regclass OR tgconstraint IN(SELECT oid FROM pg_constraint WHERE conrelid='reel_upload_intents'::regclass)))
  OR(d.classoid='pg_policy'::regclass AND d.objoid IN(SELECT oid FROM pg_policy WHERE polrelid='reel_upload_intents'::regclass)))
 OR EXISTS(SELECT 1 FROM pg_seclabel d WHERE
  (d.classoid='pg_class'::regclass AND d.objoid IN(SELECT oid FROM pg_class WHERE relname~'^reel_upload_'))
  OR(d.classoid='pg_type'::regclass AND d.objoid IN(SELECT oid FROM pg_type WHERE typname~'^_?reel_upload_'))
  OR(d.classoid='pg_constraint'::regclass AND d.objoid IN(SELECT oid FROM pg_constraint WHERE conrelid='reel_upload_intents'::regclass))
  OR(d.classoid='pg_trigger'::regclass AND d.objoid IN(SELECT oid FROM pg_trigger WHERE tgrelid='reel_upload_intents'::regclass OR tgconstraint IN(SELECT oid FROM pg_constraint WHERE conrelid='reel_upload_intents'::regclass)))
  OR(d.classoid='pg_policy'::regclass AND d.objoid IN(SELECT oid FROM pg_policy WHERE polrelid='reel_upload_intents'::regclass))) THEN
 RAISE EXCEPTION 'REEL_UPLOAD_ROLLBACK_UNKNOWN_RETAINED_ANNOTATION';END IF;
SELECT jsonb_build_object(
    'namespace',(SELECT jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl) FROM pg_namespace WHERE nspname='public'),
    'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.proname||'('||coalesce((SELECT string_agg(format_type(typ,NULL),',' ORDER BY ord) FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY types(typ,ord)),'')||')','input_names',coalesce(p.proargnames[1:p.pronargs],ARRAY[]::text[]),'result',format_type(p.prorettype,NULL),'returns_set',p.proretset,'body_md5',md5(p.prosrc),'owner',pg_get_userbyid(p.proowner),'language',l.lanname,'security_definer',p.prosecdef,'volatility',p.provolatile,'strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,'kind',p.prokind,'config',p.proconfig,'defaults',pg_get_expr(p.proargdefaults,0),'acl',p.proacl) ORDER BY p.proname,p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE p.oid IN('public.reel_upload_row_valid_v1(text,integer,bigint,text,text,text,text,text,bigint,text,timestamp with time zone,uuid,uuid,text,text,text)'::regprocedure,'public.protect_reel_upload_intent_v1()'::regprocedure,'public.reel_upload_public_v1(jsonb,boolean)'::regprocedure,'public.reel_upload_event_v1(jsonb,text)'::regprocedure,'public.reel_upload_backend_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure,'public.reel_upload_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure)),
    'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'persistence',c.relpersistence,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl,
      'columns',(SELECT jsonb_agg(jsonb_build_object('ordinal',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'collation',a.attcollation::regcollation::text,'generated',a.attgenerated,'identity',a.attidentity,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
      'constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'type',contype,'definition',pg_get_constraintdef(oid),'validated',convalidated,'deferrable',condeferrable,'deferred',condeferred,'no_inherit',connoinherit) ORDER BY conname) FROM pg_constraint WHERE conrelid=c.oid),
      'indexes',(SELECT jsonb_agg(pg_get_indexdef(indexrelid) ORDER BY pg_get_indexdef(indexrelid)) FROM pg_index WHERE indrelid=c.oid),
      'policies',(SELECT jsonb_agg(jsonb_build_object('name',polname,'permissive',polpermissive,'command',polcmd,'roles',(SELECT jsonb_agg(CASE WHEN role_oid=0 THEN 'PUBLIC' ELSE pg_get_userbyid(role_oid) END ORDER BY role_oid) FROM unnest(polroles) role_oid),'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) ORDER BY polname) FROM pg_policy WHERE polrelid=c.oid)) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('reel_upload_intents'))) INTO actual_profile;
 IF actual_profile IS DISTINCT FROM expected_profile THEN RAISE EXCEPTION 'REEL_UPLOAD_ROLLBACK_UNKNOWN_FULL_PROFILE';END IF;
 IF EXISTS(SELECT 1 FROM public.reel_upload_intents)
 OR EXISTS(SELECT 1 FROM public.audit_logs WHERE resource_type='reel_upload')
 OR EXISTS(SELECT 1 FROM public.outbox_events WHERE event_type='reel.upload.changed') THEN
 RAISE EXCEPTION 'REEL_UPLOAD_ROLLBACK_RETAINED_DATA: preserve charge, key, receipts and audit; use reviewed forward recovery';END IF;
END;
$intake_retirement_guard$;
-- RESTRICT is deliberate. Any unexpected dependency atomically aborts retirement.
DROP FUNCTION public.reel_upload_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb) RESTRICT;
DROP FUNCTION public.reel_upload_backend_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb) RESTRICT;
DROP FUNCTION public.reel_upload_event_v1(jsonb,text) RESTRICT;
DROP FUNCTION public.reel_upload_public_v1(jsonb,boolean) RESTRICT;
DROP TABLE public.reel_upload_intents RESTRICT;
DROP FUNCTION public.protect_reel_upload_intent_v1() RESTRICT;
DROP FUNCTION public.reel_upload_row_valid_v1(text,integer,bigint,text,text,text,text,text,bigint,text,timestamp with time zone,uuid,uuid,text,text,text) RESTRICT;
NOTIFY pgrst,'reload schema';
COMMIT;
