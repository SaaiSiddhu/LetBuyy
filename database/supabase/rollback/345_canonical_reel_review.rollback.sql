-- 345 retention/recovery: retire ONLY the exact known, entirely empty family.
-- Any retained root/revision/event/custody/receipt/inspection requires reviewed
-- forward recovery. This is not a retention/deletion policy or an erasure path.
-- Frozen forward345 and both352 sources remain unchanged.
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
LOCK TABLE public.sites,public.media_assets IN SHARE MODE NOWAIT;
LOCK TABLE public.commerce_reels,public.commerce_reel_revisions,
 public.commerce_reel_events,public.reel_asset_provenance,
 public.reel_processing_receipts,public.reel_review_inspections
 IN ACCESS EXCLUSIVE MODE NOWAIT;
DO $reel_retirement_guard$
DECLARE
 e record;
 inspected_function pg_catalog.pg_proc%ROWTYPE;
 actual_family text[];
 actual_profile jsonb;
 expected_profile jsonb := $reel_frozen_profile$
{
 "tables": [
  {
   "acl": [
    "postgres=arwdDxt/postgres"
   ],
   "rls": true,
   "kind": "r",
   "name": "commerce_reel_events",
   "owner": "postgres",
   "columns": [
    {
     "name": "id",
     "type": "uuid",
     "default": "gen_random_uuid()",
     "ordinal": 1,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "site_id",
     "type": "uuid",
     "default": null,
     "ordinal": 2,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "reel_id",
     "type": "uuid",
     "default": null,
     "ordinal": 3,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "revision_id",
     "type": "uuid",
     "default": null,
     "ordinal": 4,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "actor_id",
     "type": "uuid",
     "default": null,
     "ordinal": 5,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "actor_realm",
     "type": "text",
     "default": null,
     "ordinal": 6,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "action",
     "type": "text",
     "default": null,
     "ordinal": 7,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "reason",
     "type": "text",
     "default": null,
     "ordinal": 8,
     "identity": "",
     "not_null": false,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "request_key",
     "type": "text",
     "default": null,
     "ordinal": 9,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "command_hash",
     "type": "text",
     "default": null,
     "ordinal": 10,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "result",
     "type": "jsonb",
     "default": null,
     "ordinal": 11,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "created_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "ordinal": 12,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "updated_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "ordinal": 13,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "deleted_at",
     "type": "timestamp with time zone",
     "default": null,
     "ordinal": 14,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "created_by",
     "type": "uuid",
     "default": null,
     "ordinal": 15,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "updated_by",
     "type": "uuid",
     "default": null,
     "ordinal": 16,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    }
   ],
   "indexes": [
    "CREATE INDEX commerce_reel_events_site_page_idx ON public.commerce_reel_events USING btree (site_id, created_at, id)",
    "CREATE UNIQUE INDEX commerce_reel_events_pkey ON public.commerce_reel_events USING btree (id)",
    "CREATE UNIQUE INDEX commerce_reel_events_site_id_actor_id_request_key_key ON public.commerce_reel_events USING btree (site_id, actor_id, request_key)"
   ],
   "policies": [
    {
     "name": "tenant_read",
     "check": null,
     "roles": [
      "app_tenant"
     ],
     "using": "(site_id = current_site_id())",
     "command": "r",
     "permissive": true
    }
   ],
   "triggers": [
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.commerce_reel_events FROM commerce_reel_revisions NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.commerce_reel_events FROM commerce_reels NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.commerce_reel_events FROM sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.commerce_reel_events FROM commerce_reel_revisions NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.commerce_reel_events FROM commerce_reels NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.commerce_reel_events FROM sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "immutable_record",
     "enabled": "O",
     "internal": false,
     "definition": "CREATE TRIGGER immutable_record BEFORE DELETE OR UPDATE ON public.commerce_reel_events FOR EACH ROW EXECUTE FUNCTION protect_reel_record_v1()"
    }
   ],
   "force_rls": true,
   "constraints": [
    {
     "name": "commerce_reel_events_pkey",
     "type": "p",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "PRIMARY KEY (id)"
    },
    {
     "name": "commerce_reel_events_reel_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (reel_id) REFERENCES commerce_reels(id)"
    },
    {
     "name": "commerce_reel_events_revision_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (revision_id) REFERENCES commerce_reel_revisions(id)"
    },
    {
     "name": "commerce_reel_events_site_id_actor_id_request_key_key",
     "type": "u",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "UNIQUE (site_id, actor_id, request_key)"
    },
    {
     "name": "commerce_reel_events_site_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (site_id) REFERENCES sites(id)"
    }
   ],
   "persistence": "p"
  },
  {
   "acl": [
    "postgres=arwdDxt/postgres"
   ],
   "rls": true,
   "kind": "r",
   "name": "commerce_reel_revisions",
   "owner": "postgres",
   "columns": [
    {
     "name": "id",
     "type": "uuid",
     "default": "gen_random_uuid()",
     "ordinal": 1,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "site_id",
     "type": "uuid",
     "default": null,
     "ordinal": 2,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "reel_id",
     "type": "uuid",
     "default": null,
     "ordinal": 3,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "version",
     "type": "integer",
     "default": null,
     "ordinal": 4,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "selection",
     "type": "jsonb",
     "default": null,
     "ordinal": 5,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "payload",
     "type": "jsonb",
     "default": null,
     "ordinal": 6,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "canonical_payload",
     "type": "text",
     "default": null,
     "ordinal": 7,
     "identity": "",
     "not_null": false,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "fingerprint",
     "type": "text",
     "default": null,
     "ordinal": 8,
     "identity": "",
     "not_null": false,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "created_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "ordinal": 9,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "updated_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "ordinal": 10,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "deleted_at",
     "type": "timestamp with time zone",
     "default": null,
     "ordinal": 11,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "created_by",
     "type": "uuid",
     "default": null,
     "ordinal": 12,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "updated_by",
     "type": "uuid",
     "default": null,
     "ordinal": 13,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    }
   ],
   "indexes": [
    "CREATE INDEX commerce_reel_revisions_site_page_idx ON public.commerce_reel_revisions USING btree (site_id, created_at, id)",
    "CREATE UNIQUE INDEX commerce_reel_revisions_pkey ON public.commerce_reel_revisions USING btree (id)",
    "CREATE UNIQUE INDEX commerce_reel_revisions_reel_id_version_key ON public.commerce_reel_revisions USING btree (reel_id, version)"
   ],
   "policies": [
    {
     "name": "tenant_read",
     "check": null,
     "roles": [
      "app_tenant"
     ],
     "using": "(site_id = current_site_id())",
     "command": "r",
     "permissive": true
    }
   ],
   "triggers": [
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER DELETE ON public.commerce_reel_revisions FROM commerce_reel_events NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_del\"()"
    },
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER DELETE ON public.commerce_reel_revisions FROM commerce_reels NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_del\"()"
    },
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER DELETE ON public.commerce_reel_revisions FROM reel_review_inspections NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_del\"()"
    },
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER UPDATE ON public.commerce_reel_revisions FROM commerce_reel_events NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER UPDATE ON public.commerce_reel_revisions FROM commerce_reels NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER UPDATE ON public.commerce_reel_revisions FROM reel_review_inspections NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.commerce_reel_revisions FROM commerce_reels NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.commerce_reel_revisions FROM sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.commerce_reel_revisions FROM commerce_reels NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.commerce_reel_revisions FROM sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "immutable_record",
     "enabled": "O",
     "internal": false,
     "definition": "CREATE TRIGGER immutable_record BEFORE DELETE OR UPDATE ON public.commerce_reel_revisions FOR EACH ROW EXECUTE FUNCTION protect_reel_record_v1()"
    }
   ],
   "force_rls": true,
   "constraints": [
    {
     "name": "commerce_reel_revisions_check",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK (((payload IS NULL) = (fingerprint IS NULL)))"
    },
    {
     "name": "commerce_reel_revisions_check1",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK (((fingerprint IS NULL) OR (fingerprint = encode(sha256(convert_to(canonical_payload, 'UTF8'::name)), 'hex'::text))))"
    },
    {
     "name": "commerce_reel_revisions_pkey",
     "type": "p",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "PRIMARY KEY (id)"
    },
    {
     "name": "commerce_reel_revisions_reel_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (reel_id) REFERENCES commerce_reels(id)"
    },
    {
     "name": "commerce_reel_revisions_reel_id_version_key",
     "type": "u",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "UNIQUE (reel_id, version)"
    },
    {
     "name": "commerce_reel_revisions_site_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (site_id) REFERENCES sites(id)"
    },
    {
     "name": "commerce_reel_revisions_version_check",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK ((version > 0))"
    }
   ],
   "persistence": "p"
  },
  {
   "acl": [
    "postgres=arwdDxt/postgres"
   ],
   "rls": true,
   "kind": "r",
   "name": "commerce_reels",
   "owner": "postgres",
   "columns": [
    {
     "name": "id",
     "type": "uuid",
     "default": null,
     "ordinal": 1,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "site_id",
     "type": "uuid",
     "default": null,
     "ordinal": 2,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "status",
     "type": "text",
     "default": "'draft'::text",
     "ordinal": 3,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "version",
     "type": "integer",
     "default": "0",
     "ordinal": 4,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "current_revision_id",
     "type": "uuid",
     "default": null,
     "ordinal": 5,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "assigned_reviewer_id",
     "type": "uuid",
     "default": null,
     "ordinal": 6,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "created_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "ordinal": 7,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "updated_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "ordinal": 8,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "deleted_at",
     "type": "timestamp with time zone",
     "default": null,
     "ordinal": 9,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "created_by",
     "type": "uuid",
     "default": null,
     "ordinal": 10,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "updated_by",
     "type": "uuid",
     "default": null,
     "ordinal": 11,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    }
   ],
   "indexes": [
    "CREATE INDEX commerce_reels_site_page_idx ON public.commerce_reels USING btree (site_id, created_at, id)",
    "CREATE UNIQUE INDEX commerce_reels_pkey ON public.commerce_reels USING btree (id)"
   ],
   "policies": [
    {
     "name": "tenant_read",
     "check": null,
     "roles": [
      "app_tenant"
     ],
     "using": "(site_id = current_site_id())",
     "command": "r",
     "permissive": true
    }
   ],
   "triggers": [
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER DELETE ON public.commerce_reels FROM commerce_reel_events NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_del\"()"
    },
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER DELETE ON public.commerce_reels FROM commerce_reel_revisions NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_del\"()"
    },
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER UPDATE ON public.commerce_reels FROM commerce_reel_events NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER UPDATE ON public.commerce_reels FROM commerce_reel_revisions NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.commerce_reels FROM commerce_reel_revisions NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.commerce_reels FROM sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.commerce_reels FROM commerce_reel_revisions NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.commerce_reels FROM sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    }
   ],
   "force_rls": true,
   "constraints": [
    {
     "name": "commerce_reels_pkey",
     "type": "p",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "PRIMARY KEY (id)"
    },
    {
     "name": "commerce_reels_revision_fk",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (current_revision_id) REFERENCES commerce_reel_revisions(id)"
    },
    {
     "name": "commerce_reels_site_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (site_id) REFERENCES sites(id)"
    },
    {
     "name": "commerce_reels_status_check",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'approved'::text, 'rejected'::text, 'delisted'::text])))"
    },
    {
     "name": "commerce_reels_version_check",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK ((version >= 0))"
    }
   ],
   "persistence": "p"
  },
  {
   "acl": [
    "postgres=arwdDxt/postgres"
   ],
   "rls": true,
   "kind": "r",
   "name": "reel_asset_provenance",
   "owner": "postgres",
   "columns": [
    {
     "name": "id",
     "type": "uuid",
     "default": "gen_random_uuid()",
     "ordinal": 1,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "site_id",
     "type": "uuid",
     "default": null,
     "ordinal": 2,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "media_asset_id",
     "type": "uuid",
     "default": null,
     "ordinal": 3,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "asset_version",
     "type": "text",
     "default": null,
     "ordinal": 4,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "checksum_sha256",
     "type": "text",
     "default": null,
     "ordinal": 5,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "kind",
     "type": "text",
     "default": null,
     "ordinal": 6,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "provider_asset_id",
     "type": "text",
     "default": null,
     "ordinal": 7,
     "identity": "",
     "not_null": false,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "custody_verified_at",
     "type": "timestamp with time zone",
     "default": null,
     "ordinal": 8,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "created_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "ordinal": 9,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "updated_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "ordinal": 10,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "deleted_at",
     "type": "timestamp with time zone",
     "default": null,
     "ordinal": 11,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "created_by",
     "type": "uuid",
     "default": null,
     "ordinal": 12,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "updated_by",
     "type": "uuid",
     "default": null,
     "ordinal": 13,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    }
   ],
   "indexes": [
    "CREATE INDEX reel_asset_provenance_site_page_idx ON public.reel_asset_provenance USING btree (site_id, created_at, id)",
    "CREATE UNIQUE INDEX reel_asset_provenance_pkey ON public.reel_asset_provenance USING btree (id)",
    "CREATE UNIQUE INDEX reel_asset_provenance_site_id_media_asset_id_asset_version_key ON public.reel_asset_provenance USING btree (site_id, media_asset_id, asset_version)"
   ],
   "policies": [
    {
     "name": "tenant_read",
     "check": null,
     "roles": [
      "app_tenant"
     ],
     "using": "(site_id = current_site_id())",
     "command": "r",
     "permissive": true
    }
   ],
   "triggers": [
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER DELETE ON public.reel_asset_provenance FROM reel_processing_receipts NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_del\"()"
    },
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER UPDATE ON public.reel_asset_provenance FROM reel_processing_receipts NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.reel_asset_provenance FROM media_assets NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.reel_asset_provenance FROM sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.reel_asset_provenance FROM media_assets NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.reel_asset_provenance FROM sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "immutable_record",
     "enabled": "O",
     "internal": false,
     "definition": "CREATE TRIGGER immutable_record BEFORE DELETE OR UPDATE ON public.reel_asset_provenance FOR EACH ROW EXECUTE FUNCTION protect_reel_record_v1()"
    }
   ],
   "force_rls": true,
   "constraints": [
    {
     "name": "reel_asset_provenance_asset_version_check",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK ((asset_version ~ '^[A-Za-z0-9._:-]{1,200}$'::text))"
    },
    {
     "name": "reel_asset_provenance_checksum_sha256_check",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK ((checksum_sha256 ~ '^[a-f0-9]{64}$'::text))"
    },
    {
     "name": "reel_asset_provenance_kind_check",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK ((kind = ANY (ARRAY['video'::text, 'image'::text, 'rights'::text])))"
    },
    {
     "name": "reel_asset_provenance_media_asset_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (media_asset_id) REFERENCES media_assets(id)"
    },
    {
     "name": "reel_asset_provenance_pkey",
     "type": "p",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "PRIMARY KEY (id)"
    },
    {
     "name": "reel_asset_provenance_provider_asset_id_check",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK (((provider_asset_id IS NULL) OR (provider_asset_id ~ '^[A-Za-z0-9_-]{1,200}$'::text)))"
    },
    {
     "name": "reel_asset_provenance_site_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (site_id) REFERENCES sites(id)"
    },
    {
     "name": "reel_asset_provenance_site_id_media_asset_id_asset_version_key",
     "type": "u",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "UNIQUE (site_id, media_asset_id, asset_version)"
    }
   ],
   "persistence": "p"
  },
  {
   "acl": [
    "postgres=arwdDxt/postgres"
   ],
   "rls": true,
   "kind": "r",
   "name": "reel_processing_receipts",
   "owner": "postgres",
   "columns": [
    {
     "name": "id",
     "type": "uuid",
     "default": "gen_random_uuid()",
     "ordinal": 1,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "site_id",
     "type": "uuid",
     "default": null,
     "ordinal": 2,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "provenance_id",
     "type": "uuid",
     "default": null,
     "ordinal": 3,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "provider_asset_id",
     "type": "text",
     "default": null,
     "ordinal": 4,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "provider_event_id",
     "type": "text",
     "default": null,
     "ordinal": 5,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "checksum_sha256",
     "type": "text",
     "default": null,
     "ordinal": 6,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "media_version",
     "type": "text",
     "default": null,
     "ordinal": 7,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "state",
     "type": "text",
     "default": null,
     "ordinal": 8,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "verified_at",
     "type": "timestamp with time zone",
     "default": null,
     "ordinal": 9,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "created_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "ordinal": 10,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "updated_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "ordinal": 11,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "deleted_at",
     "type": "timestamp with time zone",
     "default": null,
     "ordinal": 12,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "created_by",
     "type": "uuid",
     "default": null,
     "ordinal": 13,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "updated_by",
     "type": "uuid",
     "default": null,
     "ordinal": 14,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    }
   ],
   "indexes": [
    "CREATE INDEX reel_processing_receipts_site_page_idx ON public.reel_processing_receipts USING btree (site_id, created_at, id)",
    "CREATE UNIQUE INDEX reel_processing_receipts_pkey ON public.reel_processing_receipts USING btree (id)",
    "CREATE UNIQUE INDEX reel_processing_receipts_site_id_provider_event_id_key ON public.reel_processing_receipts USING btree (site_id, provider_event_id)"
   ],
   "policies": [
    {
     "name": "tenant_read",
     "check": null,
     "roles": [
      "app_tenant"
     ],
     "using": "(site_id = current_site_id())",
     "command": "r",
     "permissive": true
    }
   ],
   "triggers": [
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER DELETE ON public.reel_processing_receipts FROM reel_review_inspections NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_del\"()"
    },
    {
     "name": "RI_ConstraintTrigger_a_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_<oid>\" AFTER UPDATE ON public.reel_processing_receipts FROM reel_review_inspections NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.reel_processing_receipts FROM reel_asset_provenance NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.reel_processing_receipts FROM sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.reel_processing_receipts FROM reel_asset_provenance NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.reel_processing_receipts FROM sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "immutable_record",
     "enabled": "O",
     "internal": false,
     "definition": "CREATE TRIGGER immutable_record BEFORE DELETE OR UPDATE ON public.reel_processing_receipts FOR EACH ROW EXECUTE FUNCTION protect_reel_record_v1()"
    }
   ],
   "force_rls": true,
   "constraints": [
    {
     "name": "reel_processing_receipts_checksum_sha256_check",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK ((checksum_sha256 ~ '^[a-f0-9]{64}$'::text))"
    },
    {
     "name": "reel_processing_receipts_pkey",
     "type": "p",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "PRIMARY KEY (id)"
    },
    {
     "name": "reel_processing_receipts_provenance_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (provenance_id) REFERENCES reel_asset_provenance(id)"
    },
    {
     "name": "reel_processing_receipts_site_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (site_id) REFERENCES sites(id)"
    },
    {
     "name": "reel_processing_receipts_site_id_provider_event_id_key",
     "type": "u",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "UNIQUE (site_id, provider_event_id)"
    },
    {
     "name": "reel_processing_receipts_state_check",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK ((state = 'ready'::text))"
    }
   ],
   "persistence": "p"
  },
  {
   "acl": [
    "postgres=arwdDxt/postgres"
   ],
   "rls": true,
   "kind": "r",
   "name": "reel_review_inspections",
   "owner": "postgres",
   "columns": [
    {
     "name": "id",
     "type": "uuid",
     "default": "gen_random_uuid()",
     "ordinal": 1,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "site_id",
     "type": "uuid",
     "default": null,
     "ordinal": 2,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "revision_id",
     "type": "uuid",
     "default": null,
     "ordinal": 3,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "reviewer_id",
     "type": "uuid",
     "default": null,
     "ordinal": 4,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "processing_receipt_id",
     "type": "uuid",
     "default": null,
     "ordinal": 5,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "rights_policy_version",
     "type": "text",
     "default": null,
     "ordinal": 6,
     "identity": "",
     "not_null": true,
     "collation": "\"default\"",
     "generated": ""
    },
    {
     "name": "inspected_at",
     "type": "timestamp with time zone",
     "default": null,
     "ordinal": 7,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "expires_at",
     "type": "timestamp with time zone",
     "default": null,
     "ordinal": 8,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "created_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "ordinal": 9,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "updated_at",
     "type": "timestamp with time zone",
     "default": "now()",
     "ordinal": 10,
     "identity": "",
     "not_null": true,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "deleted_at",
     "type": "timestamp with time zone",
     "default": null,
     "ordinal": 11,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "created_by",
     "type": "uuid",
     "default": null,
     "ordinal": 12,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    },
    {
     "name": "updated_by",
     "type": "uuid",
     "default": null,
     "ordinal": 13,
     "identity": "",
     "not_null": false,
     "collation": "-",
     "generated": ""
    }
   ],
   "indexes": [
    "CREATE INDEX reel_review_inspections_site_page_idx ON public.reel_review_inspections USING btree (site_id, created_at, id)",
    "CREATE UNIQUE INDEX reel_review_inspections_pkey ON public.reel_review_inspections USING btree (id)"
   ],
   "policies": [
    {
     "name": "tenant_read",
     "check": null,
     "roles": [
      "app_tenant"
     ],
     "using": "(site_id = current_site_id())",
     "command": "r",
     "permissive": true
    }
   ],
   "triggers": [
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.reel_review_inspections FROM commerce_reel_revisions NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.reel_review_inspections FROM reel_processing_receipts NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER INSERT ON public.reel_review_inspections FROM sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.reel_review_inspections FROM commerce_reel_revisions NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.reel_review_inspections FROM reel_processing_receipts NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "RI_ConstraintTrigger_c_<oid>",
     "enabled": "O",
     "internal": true,
     "definition": "CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_<oid>\" AFTER UPDATE ON public.reel_review_inspections FROM sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()"
    },
    {
     "name": "immutable_record",
     "enabled": "O",
     "internal": false,
     "definition": "CREATE TRIGGER immutable_record BEFORE DELETE OR UPDATE ON public.reel_review_inspections FOR EACH ROW EXECUTE FUNCTION protect_reel_record_v1()"
    }
   ],
   "force_rls": true,
   "constraints": [
    {
     "name": "reel_review_inspections_check",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK ((expires_at > inspected_at))"
    },
    {
     "name": "reel_review_inspections_pkey",
     "type": "p",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "PRIMARY KEY (id)"
    },
    {
     "name": "reel_review_inspections_processing_receipt_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (processing_receipt_id) REFERENCES reel_processing_receipts(id)"
    },
    {
     "name": "reel_review_inspections_revision_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (revision_id) REFERENCES commerce_reel_revisions(id)"
    },
    {
     "name": "reel_review_inspections_rights_policy_version_check",
     "type": "c",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "CHECK ((length(rights_policy_version) > 0))"
    },
    {
     "name": "reel_review_inspections_site_id_fkey",
     "type": "f",
     "deferred": false,
     "validated": true,
     "deferrable": false,
     "definition": "FOREIGN KEY (site_id) REFERENCES sites(id)"
    }
   ],
   "persistence": "p"
  }
 ],
 "functions": [
  {
   "acl": [
    "postgres=X/postgres",
    "service_role=X/postgres"
   ],
   "kind": "f",
   "owner": "postgres",
   "config": [
    "search_path=pg_catalog, public"
   ],
   "result": "jsonb",
   "strict": false,
   "body_md5": "b2c5009020c5993bc443250ea314e457",
   "defaults": "NULL::jsonb",
   "language": "plpgsql",
   "parallel": "u",
   "leakproof": false,
   "signature": "mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb)",
   "volatility": "v",
   "input_names": [
    "p_actor",
    "p_site",
    "p_reel",
    "p_command",
    "p_console"
   ],
   "returns_set": false,
   "security_definer": true,
   "definition_md5": "9e443d58433ade19e2efac97557d3993"
  },
  {
   "acl": [
    "postgres=X/postgres"
   ],
   "kind": "f",
   "owner": "postgres",
   "config": null,
   "result": "trigger",
   "strict": false,
   "body_md5": "6164422dd7400ef9681e3ac058f9ed9b",
   "defaults": null,
   "language": "plpgsql",
   "parallel": "u",
   "leakproof": false,
   "signature": "protect_reel_record_v1()",
   "volatility": "v",
   "input_names": [],
   "returns_set": false,
   "security_definer": false,
   "definition_md5": "36a0735f3cf4a4309551e6340e05841c"
  },
  {
   "acl": [
    "postgres=X/postgres",
    "service_role=X/postgres"
   ],
   "kind": "f",
   "owner": "postgres",
   "config": [
    "search_path=pg_catalog, public"
   ],
   "result": "jsonb",
   "strict": false,
   "body_md5": "385edefbc18555e10b669430c3aaac02",
   "defaults": "NULL::uuid, NULL::jsonb, 1",
   "language": "plpgsql",
   "parallel": "u",
   "leakproof": false,
   "signature": "read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer)",
   "volatility": "v",
   "input_names": [
    "p_actor",
    "p_site",
    "p_reel",
    "p_console",
    "p_page"
   ],
   "returns_set": false,
   "security_definer": true,
   "definition_md5": "606eb4e368c8270fad0ad6c5828cd201"
  },
  {
   "acl": [
    "postgres=X/postgres"
   ],
   "kind": "f",
   "owner": "postgres",
   "config": [
    "search_path=pg_catalog, public"
   ],
   "result": "uuid",
   "strict": false,
   "body_md5": "d99d69c697e36990561e8cfbb600d511",
   "defaults": null,
   "language": "plpgsql",
   "parallel": "u",
   "leakproof": false,
   "signature": "reel_actor_v1(uuid,uuid,jsonb,boolean)",
   "volatility": "v",
   "input_names": [
    "p_actor",
    "p_site",
    "p_console",
    "p_write"
   ],
   "returns_set": false,
   "security_definer": true,
   "definition_md5": "f6dcb9321e8c66866659c53d2d5e3d26"
  },
  {
   "acl": [
    "postgres=X/postgres"
   ],
   "kind": "f",
   "owner": "postgres",
   "config": [
    "search_path=pg_catalog, public"
   ],
   "result": "text",
   "strict": false,
   "body_md5": "0010259af51e8762637125afceb690a3",
   "defaults": null,
   "language": "sql",
   "parallel": "u",
   "leakproof": false,
   "signature": "reel_json_compact_v1(json)",
   "volatility": "i",
   "input_names": [
    "p_value"
   ],
   "returns_set": false,
   "security_definer": false,
   "definition_md5": "a4f01cc2da87dd6bfe9a7bff28dbda4b"
  },
  {
   "acl": [
    "postgres=X/postgres"
   ],
   "kind": "f",
   "owner": "postgres",
   "config": [
    "search_path=pg_catalog, public"
   ],
   "result": "text",
   "strict": false,
   "body_md5": "a0391dd81ec416922ce8c016c2b6460c",
   "defaults": null,
   "language": "plpgsql",
   "parallel": "u",
   "leakproof": false,
   "signature": "reel_payload_v1(uuid,jsonb)",
   "volatility": "v",
   "input_names": [
    "p_site",
    "p_selection"
   ],
   "returns_set": false,
   "security_definer": true,
   "definition_md5": "904696528e249aa246588666da541238"
  }
 ],
 "namespace": {
  "acl": [
   "pg_database_owner=UC/pg_database_owner",
   "=U/pg_database_owner",
   "postgres=UC/pg_database_owner",
   "app_tenant=U/pg_database_owner"
  ],
  "owner": "pg_database_owner"
 }
}
$reel_frozen_profile$::jsonb;
BEGIN
 IF current_user<>'postgres'
  OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user)
  OR (SELECT pg_catalog.pg_get_userbyid(datdba) FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())<>'postgres'
  OR pg_catalog.current_setting('transaction_isolation')<>'read committed'
  OR pg_catalog.current_setting('session_replication_role')<>'origin'
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNSAFE_SESSION_OR_WRITER: reviewed administrator/read-committed/origin session with no other or prepared writes required';
 END IF;
 SELECT coalesce(array_agg(n.nspname||'.'||f.proname ORDER BY n.nspname,f.proname),'{}'::text[])
 INTO actual_family FROM pg_catalog.pg_proc f JOIN pg_catalog.pg_namespace n ON n.oid=f.pronamespace
 WHERE f.proname~'(^|_)reels?(_|$)';
 IF actual_family IS DISTINCT FROM ARRAY['public.mutate_reel_review_v1','public.protect_reel_record_v1','public.read_reel_reviews_v1','public.reel_actor_v1','public.reel_json_compact_v1','public.reel_payload_v1']::text[] THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_FUNCTION_FAMILY: use reviewed forward recovery';
 END IF;
 SELECT coalesce(array_agg(n.nspname||'.'||c.relname ORDER BY n.nspname,c.relname),'{}'::text[])
 INTO actual_family FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relname~'(^|_)reels?(_|$)' AND c.relkind NOT IN('i','I');
 IF actual_family IS DISTINCT FROM ARRAY['public.commerce_reel_events','public.commerce_reel_revisions','public.commerce_reels','public.reel_asset_provenance','public.reel_processing_receipts','public.reel_review_inspections']::text[]
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname~'(^|_)reels?(_|$)') THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_RELATION_OR_SCHEMA_FAMILY: use reviewed forward recovery';
 END IF;
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
 -- Relation/type inventory, non-default storage/column grants, index validity,
 -- inheritance, annotations and extension membership are not silently discarded.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass)
   AND (c.relkind<>'r' OR c.relpersistence<>'p' OR c.reloptions IS NOT NULL
    OR c.relreplident<>'d' OR c.relam IS DISTINCT FROM(SELECT oid FROM pg_catalog.pg_am WHERE amname='heap' AND amtype='t')
    OR c.reltablespace<>0 OR c.relrewrite<>0 OR NOT c.relispopulated OR c.relhasrules OR c.relhassubclass OR c.relispartition OR c.reloftype<>0))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_inherits WHERE inhrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass) OR inhparent IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
   WHERE a.attrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass) AND a.attnum>0
    AND (a.attacl IS NOT NULL OR a.attoptions IS NOT NULL OR a.attfdwoptions IS NOT NULL
     OR a.atthasmissing OR a.attstattarget<>-1 OR a.attcompression<>'' OR a.attstorage<>t.typstorage))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_index WHERE indrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass)
   AND (NOT indisvalid OR NOT indisready OR NOT indislive OR indisclustered OR indisreplident))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_description WHERE
   (classoid='pg_catalog.pg_class'::regclass AND objoid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass))
   OR (classoid='pg_catalog.pg_proc'::regclass AND objoid IN('public.protect_reel_record_v1()'::regprocedure,'public.reel_json_compact_v1(json)'::regprocedure,'public.reel_actor_v1(uuid,uuid,jsonb,boolean)'::regprocedure,'public.reel_payload_v1(uuid,jsonb)'::regprocedure,'public.mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure,'public.read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer)'::regprocedure))
   OR (classoid='pg_catalog.pg_type'::regclass AND objoid IN(SELECT reltype FROM pg_catalog.pg_class WHERE oid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass))))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_seclabel WHERE
   (classoid='pg_catalog.pg_class'::regclass AND objoid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass))
   OR (classoid='pg_catalog.pg_proc'::regclass AND objoid IN('public.protect_reel_record_v1()'::regprocedure,'public.reel_json_compact_v1(json)'::regprocedure,'public.reel_actor_v1(uuid,uuid,jsonb,boolean)'::regprocedure,'public.reel_payload_v1(uuid,jsonb)'::regprocedure,'public.mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure,'public.read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer)'::regprocedure)))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_depend WHERE deptype='e' AND
   ((classid='pg_catalog.pg_class'::regclass AND objid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass))
    OR (classid='pg_catalog.pg_proc'::regclass AND objid IN('public.protect_reel_record_v1()'::regprocedure,'public.reel_json_compact_v1(json)'::regprocedure,'public.reel_actor_v1(uuid,uuid,jsonb,boolean)'::regprocedure,'public.reel_payload_v1(uuid,jsonb)'::regprocedure,'public.mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure,'public.read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer)'::regprocedure)))) THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_SCHEMA_ATTRIBUTES: use reviewed forward recovery';
 END IF;
 -- Frozen345 FKs are immediate NO ACTION references. Verify their four
 -- internal RI triggers, including action triggers on canonical parent tables.
 -- PostgreSQL16 tgtype: ROW=1, INSERT=4, DELETE=8, UPDATE=16, AFTER=0.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint fk
  CROSS JOIN(VALUES
   ('pg_catalog."RI_FKey_check_ins"()',true,5),
   ('pg_catalog."RI_FKey_check_upd"()',true,17),
   ('pg_catalog."RI_FKey_noaction_del"()',false,9),
   ('pg_catalog."RI_FKey_noaction_upd"()',false,17)
  ) expected(function_name,on_child,trigger_type)
  WHERE fk.contype='f' AND fk.conrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass) AND
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
 IF (SELECT count(*) FROM pg_catalog.pg_type WHERE typname~'(^|_)reels?(_|$)')<>12
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
   WHERE t.typname~'(^|_)reels?(_|$)' AND NOT(n.nspname='public' AND t.typowner=pg_catalog.to_regrole(current_user) AND t.typacl IS NULL AND
    ((t.typtype='c' AND t.typrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass)) OR
     (t.typtype='b' AND t.typcategory='A' AND EXISTS(SELECT 1 FROM pg_catalog.pg_class c
       WHERE c.oid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass) AND t.typelem=c.reltype AND t.typname='_'||c.relname))))) THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_TYPE_FAMILY: use reviewed forward recovery';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c
   CROSS JOIN(VALUES('anon'),('authenticated'),('app_tenant'),('service_role')) roles(name)
   CROSS JOIN(VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) privileges(name)
   WHERE c.oid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass) AND pg_catalog.has_table_privilege(roles.name,c.oid,privileges.name)) THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_INHERITED_TABLE_PRIVILEGE';
 END IF;
 -- Reject outside dependent views/functions/foreign keys before any retirement.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_depend d WHERE
   ((d.refclassid='pg_catalog.pg_class'::regclass AND d.refobjid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass))
    OR(d.refclassid='pg_catalog.pg_proc'::regclass AND d.refobjid IN('public.protect_reel_record_v1()'::regprocedure,'public.reel_json_compact_v1(json)'::regprocedure,'public.reel_actor_v1(uuid,uuid,jsonb,boolean)'::regprocedure,'public.reel_payload_v1(uuid,jsonb)'::regprocedure,'public.mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure,'public.read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer)'::regprocedure))
    OR(d.refclassid='pg_catalog.pg_type'::regclass AND d.refobjid IN(
      SELECT t.oid FROM pg_catalog.pg_type t WHERE t.typrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass)
      OR t.typelem IN(SELECT reltype FROM pg_catalog.pg_class WHERE oid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass)))))
   AND NOT(
    (d.classid='pg_catalog.pg_class'::regclass AND (d.objid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass)
      OR d.objid IN(SELECT indexrelid FROM pg_catalog.pg_index WHERE indrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass))
      OR d.objid IN(SELECT reltoastrelid FROM pg_catalog.pg_class WHERE oid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass))))
    OR(d.classid='pg_catalog.pg_proc'::regclass AND d.objid IN('public.protect_reel_record_v1()'::regprocedure,'public.reel_json_compact_v1(json)'::regprocedure,'public.reel_actor_v1(uuid,uuid,jsonb,boolean)'::regprocedure,'public.reel_payload_v1(uuid,jsonb)'::regprocedure,'public.mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure,'public.read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer)'::regprocedure))
    OR(d.classid='pg_catalog.pg_type'::regclass AND d.objid IN(SELECT t.oid FROM pg_catalog.pg_type t
      WHERE t.typrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass) OR t.typelem IN(SELECT reltype FROM pg_catalog.pg_class WHERE oid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass))))
    OR(d.classid='pg_catalog.pg_constraint'::regclass AND d.objid IN(SELECT oid FROM pg_catalog.pg_constraint WHERE conrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass)))
    OR(d.classid='pg_catalog.pg_attrdef'::regclass AND d.objid IN(SELECT oid FROM pg_catalog.pg_attrdef WHERE adrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass)))
    OR(d.classid='pg_catalog.pg_policy'::regclass AND d.objid IN(SELECT oid FROM pg_catalog.pg_policy WHERE polrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass)))
    OR(d.classid='pg_catalog.pg_trigger'::regclass AND d.objid IN(SELECT oid FROM pg_catalog.pg_trigger WHERE tgrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass) OR(tgisinternal AND tgconstraint IN(SELECT oid FROM pg_catalog.pg_constraint WHERE conrelid IN('public.commerce_reel_events'::regclass,'public.commerce_reel_revisions'::regclass,'public.commerce_reels'::regclass,'public.reel_asset_provenance'::regclass,'public.reel_processing_receipts'::regclass,'public.reel_review_inspections'::regclass)))))
   )) THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_EXTERNAL_DEPENDENCY: use reviewed forward recovery';
 END IF;
SELECT jsonb_build_object(
    'namespace',(SELECT jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl) FROM pg_namespace WHERE nspname='public'),
    'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'input_names',coalesce(p.proargnames[1:p.pronargs],ARRAY[]::text[]),'result',format_type(p.prorettype,NULL),'returns_set',p.proretset,'body_md5',md5(p.prosrc),'definition_md5',md5(pg_get_functiondef(p.oid)),'owner',pg_get_userbyid(p.proowner),'language',l.lanname,'security_definer',p.prosecdef,'volatility',p.provolatile,'strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,'kind',p.prokind,'config',p.proconfig,'defaults',pg_get_expr(p.proargdefaults,0),'acl',p.proacl) ORDER BY p.proname,p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE p.proname IN('protect_reel_record_v1','reel_json_compact_v1','reel_actor_v1','reel_payload_v1','mutate_reel_review_v1','read_reel_reviews_v1')),
    'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'persistence',c.relpersistence,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl,
      'columns',(SELECT jsonb_agg(jsonb_build_object('ordinal',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'collation',a.attcollation::regcollation::text,'generated',a.attgenerated,'identity',a.attidentity,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
      'constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'type',contype,'definition',pg_get_constraintdef(oid),'validated',convalidated,'deferrable',condeferrable,'deferred',condeferred) ORDER BY conname) FROM pg_constraint WHERE conrelid=c.oid),
      'triggers',(SELECT jsonb_agg(v ORDER BY (v->>'name') COLLATE "C",(v->>'definition') COLLATE "C") FROM (
       SELECT jsonb_build_object('name',CASE WHEN tgisinternal THEN regexp_replace(tgname,'^(RI_ConstraintTrigger_[ac]_)[0-9]+$','\1<oid>') ELSE tgname END,
       'definition',CASE WHEN tgisinternal THEN regexp_replace(pg_get_triggerdef(oid),'(RI_ConstraintTrigger_[ac]_)[0-9]+','\1<oid>','g') ELSE pg_get_triggerdef(oid) END,
       'enabled',tgenabled,'internal',tgisinternal) AS v FROM pg_trigger WHERE tgrelid=c.oid) stable),
      'indexes',(SELECT jsonb_agg(pg_get_indexdef(indexrelid) ORDER BY pg_get_indexdef(indexrelid)) FROM pg_index WHERE indrelid=c.oid),
      'policies',(SELECT jsonb_agg(jsonb_build_object('name',polname,'permissive',polpermissive,'command',polcmd,'roles',(SELECT jsonb_agg(CASE WHEN role_oid=0 THEN 'PUBLIC' ELSE pg_get_userbyid(role_oid) END ORDER BY role_oid) FROM unnest(polroles) role_oid),'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) ORDER BY polname) FROM pg_policy WHERE polrelid=c.oid)) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('commerce_reel_events','commerce_reel_revisions','commerce_reels','reel_asset_provenance','reel_processing_receipts','reel_review_inspections'))) INTO actual_profile;
 IF actual_profile IS DISTINCT FROM expected_profile THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_UNKNOWN_SCHEMA_FUNCTION_OR_ACL_PROFILE: use reviewed forward recovery';
 END IF;
 IF EXISTS(SELECT 1 FROM public.commerce_reel_events)
  OR EXISTS(SELECT 1 FROM public.commerce_reel_revisions)
  OR EXISTS(SELECT 1 FROM public.commerce_reels)
  OR EXISTS(SELECT 1 FROM public.reel_asset_provenance)
  OR EXISTS(SELECT 1 FROM public.reel_processing_receipts)
  OR EXISTS(SELECT 1 FROM public.reel_review_inspections) THEN
  RAISE EXCEPTION 'REEL_ROLLBACK_RETAINED_DATA: preserve all reel workflow and custody evidence; use reviewed forward recovery';
 END IF;
END;
$reel_retirement_guard$;
-- Only the exact known empty family reaches these unconditional, non-cascading
-- retirements. A missing object/unknown dependency remains an atomic failure.
DROP FUNCTION public.read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer);
DROP FUNCTION public.mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb);
DROP FUNCTION public.reel_payload_v1(uuid,jsonb);
DROP FUNCTION public.reel_actor_v1(uuid,uuid,jsonb,boolean);
DROP FUNCTION public.reel_json_compact_v1(json);
DROP TABLE public.reel_review_inspections;
DROP TABLE public.commerce_reel_events;
ALTER TABLE public.commerce_reels DROP CONSTRAINT commerce_reels_revision_fk;
DROP TABLE public.commerce_reel_revisions;
DROP TABLE public.commerce_reels;
DROP TABLE public.reel_processing_receipts;
DROP TABLE public.reel_asset_provenance;
DROP FUNCTION public.protect_reel_record_v1();
NOTIFY pgrst,'reload schema';
COMMIT;
