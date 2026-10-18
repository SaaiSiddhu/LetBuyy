--350 empty-only retirement of the non-content buyer AI admission schema.
-- Any operation receipt or daily quota row, including zero counters, is retained.
-- Installed profile: owned PG16 run8be680d04aee, exact350forward62ebdb47... .
-- Different owner/ABI/body/ACL/schema/dependency provenance requires review.
-- No cancellation, refund, erasure, quota reset or provider recovery is implied.
BEGIN;
-- Fix lookup visibility before the early fence or bounded lock code.
SET LOCAL search_path = pg_catalog, public, pg_temp;
-- An already-prepared writer must refuse before any lock acquisition.
DO $ai350_early_prepared_quiescence$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
    RAISE EXCEPTION 'rollback350 refuses concurrent/prepared writes or non-read-committed state';
  END IF;
END;
$ai350_early_prepared_quiescence$;
-- Bound each genuine lock wait and revalidate actual prepared state on retry.
-- Each successful stage survives subsequent failed inner subtransactions, so
-- owning buyer_accounts continues to fence new admission while quota waits.
DO $ai350_bounded_locks$
DECLARE
  v_stage pg_catalog.int4;
  v_deadline pg_catalog.timestamptz := pg_catalog.clock_timestamp() + '10 seconds'::pg_catalog.interval;
  v_previous_lock_timeout pg_catalog.text := pg_catalog.current_setting('lock_timeout');
BEGIN
  FOR v_stage IN 0..3 LOOP
    LOOP
      IF EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
        RAISE EXCEPTION 'rollback350 refuses concurrent/prepared writes or non-read-committed state';
      END IF;
      IF pg_catalog.clock_timestamp()>=v_deadline THEN
        RAISE EXCEPTION 'rollback350 lock acquisition deadline exceeded' USING ERRCODE='55P03';
      END IF;
      BEGIN
        PERFORM pg_catalog.set_config('lock_timeout','250ms',true);
        CASE v_stage
          WHEN 0 THEN
            LOCK TABLE pg_catalog.pg_proc, pg_catalog.pg_class, pg_catalog.pg_depend,
              pg_catalog.pg_type, pg_catalog.pg_constraint, pg_catalog.pg_attribute,
              pg_catalog.pg_index, pg_catalog.pg_policy, pg_catalog.pg_trigger,
              pg_catalog.pg_attrdef IN SHARE ROW EXCLUSIVE MODE;
          WHEN 1 THEN LOCK TABLE public.buyer_accounts IN ACCESS EXCLUSIVE MODE;
          WHEN 2 THEN LOCK TABLE public.buyer_ai_daily_quotas IN ACCESS EXCLUSIVE MODE;
          WHEN 3 THEN LOCK TABLE public.buyer_ai_operations IN ACCESS EXCLUSIVE MODE;
          ELSE RAISE EXCEPTION 'rollback350 refuses unknown lock stage';
        END CASE;
        PERFORM pg_catalog.set_config('lock_timeout',v_previous_lock_timeout,true);
      EXCEPTION
        WHEN lock_not_available THEN
          -- The failed attempt is rolled back. Earlier successful stage locks
          -- remain owned by the outer transaction. A deadline is never a
          -- certificate: only this real registry query earns prepared refusal.
          IF EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
            RAISE EXCEPTION 'rollback350 refuses concurrent/prepared writes or non-read-committed state';
          END IF;
          IF pg_catalog.clock_timestamp()>=v_deadline THEN
            RAISE EXCEPTION 'rollback350 lock acquisition deadline exceeded' USING ERRCODE='55P03';
          END IF;
          CONTINUE;
        WHEN undefined_table THEN
          RAISE EXCEPTION 'rollback350 refuses missing canonical relations';
      END;
      IF pg_catalog.clock_timestamp()>=v_deadline THEN
        RAISE EXCEPTION 'rollback350 lock acquisition deadline exceeded' USING ERRCODE='55P03';
      END IF;
      EXIT;
    END LOOP;
  END LOOP;
END;
$ai350_bounded_locks$;
-- Never let forced RLS turn retained rows into a false empty result.
SET LOCAL row_security = off;
DO $ai350_retirement_precondition$
DECLARE
  v_expected record; v_live pg_catalog.pg_proc%ROWTYPE; v_count integer;
  v_contract jsonb := $ai350_profile${"functions":[{"catalog":{"probin":null,"procost":100,"prokind":"f","proname":"reserve_buyer_ai_request","prorows":0,"pronargs":9,"proconfig":["search_path=pg_catalog, public, pg_temp"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_buyer_account_id","p_session_epoch","p_conversation_id","p_request_id","p_payload_hash","p_profile_id","p_request_limit","p_token_limit","p_reserved_tokens"],"proargtypes":["2950","20","2950","2950","25","25","23","20","23"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"proallargtypes":null,"proargdefaults":null,"pronargdefaults":0},"owner":"postgres","namespace":"public","language":"plpgsql","body_md5":"c98217fce24cb9d81495e54dc06892c9","acl":[{"grantee":"postgres","grantor":"postgres","privilege":"EXECUTE","grantable":false},{"grantee":"service_role","grantor":"postgres","privilege":"EXECUTE","grantable":false}]},{"catalog":{"probin":null,"procost":100,"prokind":"f","proname":"transition_buyer_ai_request","prorows":0,"pronargs":5,"proconfig":["search_path=pg_catalog, public, pg_temp"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_buyer_account_id","p_session_epoch","p_request_id","p_from_state","p_to_state"],"proargtypes":["2950","20","2950","25","25"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"proallargtypes":null,"proargdefaults":null,"pronargdefaults":0},"owner":"postgres","namespace":"public","language":"plpgsql","body_md5":"a03fd86fec730d2d08a1ea01ad22ee89","acl":[{"grantee":"postgres","grantor":"postgres","privilege":"EXECUTE","grantable":false},{"grantee":"service_role","grantor":"postgres","privilege":"EXECUTE","grantable":false}]}],"relations":[{"kind":"r","name":"buyer_ai_daily_quotas","partition":false,"persistence":"p","row_security":true,"partition_bound":null,"replica_identity":"d","force_row_security":true,"owner":"postgres","namespace":"public","acl":[{"grantee":"postgres","grantor":"postgres","privilege":"DELETE","grantable":false},{"grantee":"postgres","grantor":"postgres","privilege":"INSERT","grantable":false},{"grantee":"postgres","grantor":"postgres","privilege":"REFERENCES","grantable":false},{"grantee":"postgres","grantor":"postgres","privilege":"SELECT","grantable":false},{"grantee":"postgres","grantor":"postgres","privilege":"TRIGGER","grantable":false},{"grantee":"postgres","grantor":"postgres","privilege":"TRUNCATE","grantable":false},{"grantee":"postgres","grantor":"postgres","privilege":"UPDATE","grantable":false}]},{"kind":"r","name":"buyer_ai_operations","partition":false,"persistence":"p","row_security":true,"partition_bound":null,"replica_identity":"d","force_row_security":true,"owner":"postgres","namespace":"public","acl":[{"grantee":"postgres","grantor":"postgres","privilege":"DELETE","grantable":false},{"grantee":"postgres","grantor":"postgres","privilege":"INSERT","grantable":false},{"grantee":"postgres","grantor":"postgres","privilege":"REFERENCES","grantable":false},{"grantee":"postgres","grantor":"postgres","privilege":"SELECT","grantable":false},{"grantee":"postgres","grantor":"postgres","privilege":"TRIGGER","grantable":false},{"grantee":"postgres","grantor":"postgres","privilege":"TRUNCATE","grantable":false},{"grantee":"postgres","grantor":"postgres","privilege":"UPDATE","grantable":false}]}],"columns":[{"table":"buyer_ai_daily_quotas","catalog":{"attacl":null,"attlen":16,"attnum":1,"attname":"buyer_account_id","attalign":"c","attbyval":false,"attndims":0,"atttypid":"2950","atthasdef":false,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"p","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"0","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":null},{"table":"buyer_ai_daily_quotas","catalog":{"attacl":null,"attlen":4,"attnum":2,"attname":"quota_day","attalign":"i","attbyval":true,"attndims":0,"atttypid":"1082","atthasdef":false,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"p","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"0","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":null},{"table":"buyer_ai_daily_quotas","catalog":{"attacl":null,"attlen":4,"attnum":3,"attname":"requests_reserved","attalign":"i","attbyval":true,"attndims":0,"atttypid":"23","atthasdef":false,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"p","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"0","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":null},{"table":"buyer_ai_daily_quotas","catalog":{"attacl":null,"attlen":8,"attnum":4,"attname":"tokens_reserved","attalign":"d","attbyval":true,"attndims":0,"atttypid":"20","atthasdef":false,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"p","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"0","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":null},{"table":"buyer_ai_operations","catalog":{"attacl":null,"attlen":16,"attnum":1,"attname":"buyer_account_id","attalign":"c","attbyval":false,"attndims":0,"atttypid":"2950","atthasdef":false,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"p","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"0","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":null},{"table":"buyer_ai_operations","catalog":{"attacl":null,"attlen":16,"attnum":2,"attname":"request_id","attalign":"c","attbyval":false,"attndims":0,"atttypid":"2950","atthasdef":false,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"p","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"0","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":null},{"table":"buyer_ai_operations","catalog":{"attacl":null,"attlen":16,"attnum":3,"attname":"conversation_id","attalign":"c","attbyval":false,"attndims":0,"atttypid":"2950","atthasdef":false,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"p","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"0","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":null},{"table":"buyer_ai_operations","catalog":{"attacl":null,"attlen":8,"attnum":4,"attname":"session_epoch","attalign":"d","attbyval":true,"attndims":0,"atttypid":"20","atthasdef":false,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"p","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"0","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":null},{"table":"buyer_ai_operations","catalog":{"attacl":null,"attlen":-1,"attnum":5,"attname":"payload_hash","attalign":"i","attbyval":false,"attndims":0,"atttypid":"25","atthasdef":false,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"x","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"100","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":null},{"table":"buyer_ai_operations","catalog":{"attacl":null,"attlen":-1,"attnum":6,"attname":"profile_id","attalign":"i","attbyval":false,"attndims":0,"atttypid":"25","atthasdef":false,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"x","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"100","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":null},{"table":"buyer_ai_operations","catalog":{"attacl":null,"attlen":4,"attnum":7,"attname":"reserved_tokens","attalign":"i","attbyval":true,"attndims":0,"atttypid":"23","atthasdef":false,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"p","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"0","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":null},{"table":"buyer_ai_operations","catalog":{"attacl":null,"attlen":-1,"attnum":8,"attname":"state","attalign":"i","attbyval":false,"attndims":0,"atttypid":"25","atthasdef":false,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"x","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"100","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":null},{"table":"buyer_ai_operations","catalog":{"attacl":null,"attlen":8,"attnum":9,"attname":"created_at","attalign":"d","attbyval":true,"attndims":0,"atttypid":"1184","atthasdef":true,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"p","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"0","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":"now()"},{"table":"buyer_ai_operations","catalog":{"attacl":null,"attlen":8,"attnum":10,"attname":"updated_at","attalign":"d","attbyval":true,"attndims":0,"atttypid":"1184","atthasdef":true,"atttypmod":-1,"attislocal":true,"attnotnull":true,"attoptions":null,"attstorage":"p","attcacheoff":-1,"attidentity":"","attinhcount":0,"attcollation":"0","attgenerated":"","attisdropped":false,"attfdwoptions":null,"atthasmissing":false,"attmissingval":null,"attstattarget":-1,"attcompression":""},"default":"now()"}],"constraints":[{"table":"buyer_ai_daily_quotas","namespace":"public","catalog":{"conkey":[1],"confkey":[1],"conname":"buyer_ai_daily_quotas_buyer_account_id_fkey","contype":"f","contypid":"0","conexclop":null,"conffeqop":["2972"],"conpfeqop":["2972"],"conppeqop":["2972"],"conislocal":true,"condeferred":false,"confdeltype":"c","confupdtype":"a","coninhcount":0,"conparentid":"0","connoinherit":true,"convalidated":true,"condeferrable":false,"confmatchtype":"s","confdelsetcols":null},"index":"buyer_accounts_pkey","references":"buyer_accounts","definition":"FOREIGN KEY (buyer_account_id) REFERENCES buyer_accounts(id) ON DELETE CASCADE"},{"table":"buyer_ai_daily_quotas","namespace":"public","catalog":{"conkey":[1,2],"confkey":null,"conname":"buyer_ai_daily_quotas_pkey","contype":"p","contypid":"0","conexclop":null,"conffeqop":null,"conpfeqop":null,"conppeqop":null,"conislocal":true,"condeferred":false,"confdeltype":" ","confupdtype":" ","coninhcount":0,"conparentid":"0","connoinherit":true,"convalidated":true,"condeferrable":false,"confmatchtype":" ","confdelsetcols":null},"index":"buyer_ai_daily_quotas_pkey","references":null,"definition":"PRIMARY KEY (buyer_account_id, quota_day)"},{"table":"buyer_ai_daily_quotas","namespace":"public","catalog":{"conkey":[3],"confkey":null,"conname":"buyer_ai_daily_quotas_requests_reserved_check","contype":"c","contypid":"0","conexclop":null,"conffeqop":null,"conpfeqop":null,"conppeqop":null,"conislocal":true,"condeferred":false,"confdeltype":" ","confupdtype":" ","coninhcount":0,"conparentid":"0","connoinherit":false,"convalidated":true,"condeferrable":false,"confmatchtype":" ","confdelsetcols":null},"index":null,"references":null,"definition":"CHECK ((requests_reserved >= 0))"},{"table":"buyer_ai_daily_quotas","namespace":"public","catalog":{"conkey":[4],"confkey":null,"conname":"buyer_ai_daily_quotas_tokens_reserved_check","contype":"c","contypid":"0","conexclop":null,"conffeqop":null,"conpfeqop":null,"conppeqop":null,"conislocal":true,"condeferred":false,"confdeltype":" ","confupdtype":" ","coninhcount":0,"conparentid":"0","connoinherit":false,"convalidated":true,"condeferrable":false,"confmatchtype":" ","confdelsetcols":null},"index":null,"references":null,"definition":"CHECK ((tokens_reserved >= 0))"},{"table":"buyer_ai_operations","namespace":"public","catalog":{"conkey":[1],"confkey":[1],"conname":"buyer_ai_operations_buyer_account_id_fkey","contype":"f","contypid":"0","conexclop":null,"conffeqop":["2972"],"conpfeqop":["2972"],"conppeqop":["2972"],"conislocal":true,"condeferred":false,"confdeltype":"c","confupdtype":"a","coninhcount":0,"conparentid":"0","connoinherit":true,"convalidated":true,"condeferrable":false,"confmatchtype":"s","confdelsetcols":null},"index":"buyer_accounts_pkey","references":"buyer_accounts","definition":"FOREIGN KEY (buyer_account_id) REFERENCES buyer_accounts(id) ON DELETE CASCADE"},{"table":"buyer_ai_operations","namespace":"public","catalog":{"conkey":[5],"confkey":null,"conname":"buyer_ai_operations_payload_hash_check","contype":"c","contypid":"0","conexclop":null,"conffeqop":null,"conpfeqop":null,"conppeqop":null,"conislocal":true,"condeferred":false,"confdeltype":" ","confupdtype":" ","coninhcount":0,"conparentid":"0","connoinherit":false,"convalidated":true,"condeferrable":false,"confmatchtype":" ","confdelsetcols":null},"index":null,"references":null,"definition":"CHECK ((payload_hash ~ '^[a-f0-9]{64}$'::text))"},{"table":"buyer_ai_operations","namespace":"public","catalog":{"conkey":[1,2],"confkey":null,"conname":"buyer_ai_operations_pkey","contype":"p","contypid":"0","conexclop":null,"conffeqop":null,"conpfeqop":null,"conppeqop":null,"conislocal":true,"condeferred":false,"confdeltype":" ","confupdtype":" ","coninhcount":0,"conparentid":"0","connoinherit":true,"convalidated":true,"condeferrable":false,"confmatchtype":" ","confdelsetcols":null},"index":"buyer_ai_operations_pkey","references":null,"definition":"PRIMARY KEY (buyer_account_id, request_id)"},{"table":"buyer_ai_operations","namespace":"public","catalog":{"conkey":[6],"confkey":null,"conname":"buyer_ai_operations_profile_id_check","contype":"c","contypid":"0","conexclop":null,"conffeqop":null,"conpfeqop":null,"conppeqop":null,"conislocal":true,"condeferred":false,"confdeltype":" ","confupdtype":" ","coninhcount":0,"conparentid":"0","connoinherit":false,"convalidated":true,"condeferrable":false,"confmatchtype":" ","confdelsetcols":null},"index":null,"references":null,"definition":"CHECK (((length(profile_id) >= 1) AND (length(profile_id) <= 80)))"},{"table":"buyer_ai_operations","namespace":"public","catalog":{"conkey":[7],"confkey":null,"conname":"buyer_ai_operations_reserved_tokens_check","contype":"c","contypid":"0","conexclop":null,"conffeqop":null,"conpfeqop":null,"conppeqop":null,"conislocal":true,"condeferred":false,"confdeltype":" ","confupdtype":" ","coninhcount":0,"conparentid":"0","connoinherit":false,"convalidated":true,"condeferrable":false,"confmatchtype":" ","confdelsetcols":null},"index":null,"references":null,"definition":"CHECK ((reserved_tokens > 0))"},{"table":"buyer_ai_operations","namespace":"public","catalog":{"conkey":[4],"confkey":null,"conname":"buyer_ai_operations_session_epoch_check","contype":"c","contypid":"0","conexclop":null,"conffeqop":null,"conpfeqop":null,"conppeqop":null,"conislocal":true,"condeferred":false,"confdeltype":" ","confupdtype":" ","coninhcount":0,"conparentid":"0","connoinherit":false,"convalidated":true,"condeferrable":false,"confmatchtype":" ","confdelsetcols":null},"index":null,"references":null,"definition":"CHECK ((session_epoch >= 0))"},{"table":"buyer_ai_operations","namespace":"public","catalog":{"conkey":[8],"confkey":null,"conname":"buyer_ai_operations_state_check","contype":"c","contypid":"0","conexclop":null,"conffeqop":null,"conpfeqop":null,"conppeqop":null,"conislocal":true,"condeferred":false,"confdeltype":" ","confupdtype":" ","coninhcount":0,"conparentid":"0","connoinherit":false,"convalidated":true,"condeferrable":false,"confmatchtype":" ","confdelsetcols":null},"index":null,"references":null,"definition":"CHECK ((state = ANY (ARRAY['reserved'::text, 'dispatched'::text, 'completed'::text, 'outcome_unknown'::text])))"}],"indexes":[{"table":"buyer_ai_daily_quotas","catalog":{"indkey":[1,2],"indpred":null,"indclass":["10065","3122"],"indexprs":null,"indnatts":2,"indislive":true,"indoption":[0,0],"indisready":true,"indisvalid":true,"indisunique":true,"indnkeyatts":2,"indcheckxmin":false,"indcollation":["0","0"],"indimmediate":true,"indisprimary":true,"indisclustered":false,"indisexclusion":false,"indisreplident":false,"indnullsnotdistinct":false},"definition":"CREATE UNIQUE INDEX buyer_ai_daily_quotas_pkey ON public.buyer_ai_daily_quotas USING btree (buyer_account_id, quota_day)","owner":"postgres","acl":null},{"table":"buyer_ai_operations","catalog":{"indkey":[1,2],"indpred":null,"indclass":["10065","10065"],"indexprs":null,"indnatts":2,"indislive":true,"indoption":[0,0],"indisready":true,"indisvalid":true,"indisunique":true,"indnkeyatts":2,"indcheckxmin":false,"indcollation":["0","0"],"indimmediate":true,"indisprimary":true,"indisclustered":false,"indisexclusion":false,"indisreplident":false,"indnullsnotdistinct":false},"definition":"CREATE UNIQUE INDEX buyer_ai_operations_pkey ON public.buyer_ai_operations USING btree (buyer_account_id, request_id)","owner":"postgres","acl":null}],"policies":[{"table":"buyer_ai_daily_quotas","catalog":{"polcmd":"*","polname":"buyer_ai_daily_owner","polroles":["0"],"polpermissive":true},"using":"((buyer_account_id)::text = NULLIF(current_setting('app.buyer_account_id'::text, true), ''::text))","check":"((buyer_account_id)::text = NULLIF(current_setting('app.buyer_account_id'::text, true), ''::text))"},{"table":"buyer_ai_operations","catalog":{"polcmd":"*","polname":"buyer_ai_operation_owner","polroles":["0"],"polpermissive":true},"using":"((buyer_account_id)::text = NULLIF(current_setting('app.buyer_account_id'::text, true), ''::text))","check":"((buyer_account_id)::text = NULLIF(current_setting('app.buyer_account_id'::text, true), ''::text))"}],"triggers":[{"table":"buyer_accounts","other_table":"buyer_ai_daily_quotas","constraint_table":"buyer_ai_daily_quotas","constraint":"buyer_ai_daily_quotas_buyer_account_id_fkey","index":"buyer_accounts_pkey","function":"pg_catalog.RI_FKey_cascade_del","generated_name_kind":"a","catalog":{"tgargs":"\\x","tgattr":[],"tgqual":null,"tgtype":9,"tgnargs":0,"tgenabled":"O","tgnewtable":null,"tgoldtable":null,"tgparentid":"0","tgdeferrable":false,"tgisinternal":true,"tginitdeferred":false}},{"table":"buyer_accounts","other_table":"buyer_ai_daily_quotas","constraint_table":"buyer_ai_daily_quotas","constraint":"buyer_ai_daily_quotas_buyer_account_id_fkey","index":"buyer_accounts_pkey","function":"pg_catalog.RI_FKey_noaction_upd","generated_name_kind":"a","catalog":{"tgargs":"\\x","tgattr":[],"tgqual":null,"tgtype":17,"tgnargs":0,"tgenabled":"O","tgnewtable":null,"tgoldtable":null,"tgparentid":"0","tgdeferrable":false,"tgisinternal":true,"tginitdeferred":false}},{"table":"buyer_ai_daily_quotas","other_table":"buyer_accounts","constraint_table":"buyer_ai_daily_quotas","constraint":"buyer_ai_daily_quotas_buyer_account_id_fkey","index":"buyer_accounts_pkey","function":"pg_catalog.RI_FKey_check_ins","generated_name_kind":"c","catalog":{"tgargs":"\\x","tgattr":[],"tgqual":null,"tgtype":5,"tgnargs":0,"tgenabled":"O","tgnewtable":null,"tgoldtable":null,"tgparentid":"0","tgdeferrable":false,"tgisinternal":true,"tginitdeferred":false}},{"table":"buyer_ai_daily_quotas","other_table":"buyer_accounts","constraint_table":"buyer_ai_daily_quotas","constraint":"buyer_ai_daily_quotas_buyer_account_id_fkey","index":"buyer_accounts_pkey","function":"pg_catalog.RI_FKey_check_upd","generated_name_kind":"c","catalog":{"tgargs":"\\x","tgattr":[],"tgqual":null,"tgtype":17,"tgnargs":0,"tgenabled":"O","tgnewtable":null,"tgoldtable":null,"tgparentid":"0","tgdeferrable":false,"tgisinternal":true,"tginitdeferred":false}},{"table":"buyer_accounts","other_table":"buyer_ai_operations","constraint_table":"buyer_ai_operations","constraint":"buyer_ai_operations_buyer_account_id_fkey","index":"buyer_accounts_pkey","function":"pg_catalog.RI_FKey_cascade_del","generated_name_kind":"a","catalog":{"tgargs":"\\x","tgattr":[],"tgqual":null,"tgtype":9,"tgnargs":0,"tgenabled":"O","tgnewtable":null,"tgoldtable":null,"tgparentid":"0","tgdeferrable":false,"tgisinternal":true,"tginitdeferred":false}},{"table":"buyer_accounts","other_table":"buyer_ai_operations","constraint_table":"buyer_ai_operations","constraint":"buyer_ai_operations_buyer_account_id_fkey","index":"buyer_accounts_pkey","function":"pg_catalog.RI_FKey_noaction_upd","generated_name_kind":"a","catalog":{"tgargs":"\\x","tgattr":[],"tgqual":null,"tgtype":17,"tgnargs":0,"tgenabled":"O","tgnewtable":null,"tgoldtable":null,"tgparentid":"0","tgdeferrable":false,"tgisinternal":true,"tginitdeferred":false}},{"table":"buyer_ai_operations","other_table":"buyer_accounts","constraint_table":"buyer_ai_operations","constraint":"buyer_ai_operations_buyer_account_id_fkey","index":"buyer_accounts_pkey","function":"pg_catalog.RI_FKey_check_ins","generated_name_kind":"c","catalog":{"tgargs":"\\x","tgattr":[],"tgqual":null,"tgtype":5,"tgnargs":0,"tgenabled":"O","tgnewtable":null,"tgoldtable":null,"tgparentid":"0","tgdeferrable":false,"tgisinternal":true,"tginitdeferred":false}},{"table":"buyer_ai_operations","other_table":"buyer_accounts","constraint_table":"buyer_ai_operations","constraint":"buyer_ai_operations_buyer_account_id_fkey","index":"buyer_accounts_pkey","function":"pg_catalog.RI_FKey_check_upd","generated_name_kind":"c","catalog":{"tgargs":"\\x","tgattr":[],"tgqual":null,"tgtype":17,"tgnargs":0,"tgenabled":"O","tgnewtable":null,"tgoldtable":null,"tgparentid":"0","tgdeferrable":false,"tgisinternal":true,"tginitdeferred":false}}]}
$ai350_profile$::jsonb;
  v_actual jsonb;
BEGIN
  IF pg_catalog.current_setting('transaction_isolation')<>'read committed'
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid'
       AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
    RAISE EXCEPTION 'rollback350 refuses concurrent/prepared writes or non-read-committed state';
  END IF;
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'rollback350 refuses an unreviewed migration owner or RLS visibility';
  END IF;
  FOR v_expected IN SELECT * FROM (VALUES
    ('reserve_buyer_ai_request','public.reserve_buyer_ai_request(uuid,bigint,uuid,uuid,text,text,integer,bigint,integer)',ARRAY['p_buyer_account_id','p_session_epoch','p_conversation_id','p_request_id','p_payload_hash','p_profile_id','p_request_limit','p_token_limit','p_reserved_tokens']::text[],'jsonb',false,1),
    ('transition_buyer_ai_request','public.transition_buyer_ai_request(uuid,bigint,uuid,text,text)',ARRAY['p_buyer_account_id','p_session_epoch','p_request_id','p_from_state','p_to_state']::text[],'boolean',false,1)
  ) AS expected(name,signature,input_names,result_type,returns_set,overloads) LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count<>v_expected.overloads OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback350 refuses changed typed identity or full overload family';
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs],ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
      OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
      OR v_live.proretset IS DISTINCT FROM v_expected.returns_set OR v_live.prokind<>'f' THEN
      RAISE EXCEPTION 'rollback350 refuses changed input names or result ABI';
    END IF;
  END LOOP;

  WITH relations AS (
    SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN('buyer_ai_daily_quotas','buyer_ai_operations')
  ), functions AS (
    SELECT p.* FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN('reserve_buyer_ai_request','transition_buyer_ai_request')
  ) SELECT jsonb_build_object(
    'functions',(SELECT jsonb_agg(jsonb_build_object(
      'catalog',to_jsonb(p)-ARRAY['oid','proowner','prolang','prosrc','proacl','pronamespace'],
      'owner',pg_catalog.pg_get_userbyid(p.proowner),'namespace','public',
      'language',(SELECT lanname FROM pg_catalog.pg_language WHERE oid=p.prolang),
      'body_md5',pg_catalog.md5(p.prosrc),
      'acl',(SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
        'grantor',pg_catalog.pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)
        ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,pg_catalog.pg_get_userbyid(a.grantor),a.privilege_type)
        FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a)) ORDER BY p.proname) FROM functions p),
    'relations',(SELECT jsonb_agg(jsonb_build_object('name',r.relname,'kind',r.relkind,'persistence',r.relpersistence,
      'row_security',r.relrowsecurity,'force_row_security',r.relforcerowsecurity,'replica_identity',r.relreplident,
      'partition',r.relispartition,'partition_bound',r.relpartbound::text,'owner',pg_catalog.pg_get_userbyid(r.relowner),'namespace','public',
      'acl',(SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
        'grantor',pg_catalog.pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)
        ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,pg_catalog.pg_get_userbyid(a.grantor),a.privilege_type)
        FROM pg_catalog.aclexplode(coalesce(r.relacl,pg_catalog.acldefault('r',r.relowner))) a)) ORDER BY r.relname) FROM relations r),
    'columns',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'catalog',to_jsonb(a)-'attrelid',
      'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid)) ORDER BY r.relname,a.attnum)
      FROM relations r JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'namespace',(SELECT nspname FROM pg_catalog.pg_namespace WHERE oid=c.connamespace),
      'catalog',to_jsonb(c)-ARRAY['oid','conrelid','connamespace','conindid','confrelid','conbin'],
      'index',(SELECT relname FROM pg_catalog.pg_class WHERE oid=c.conindid),
      'references',(SELECT relname FROM pg_catalog.pg_class WHERE oid=c.confrelid),
      'definition',pg_catalog.pg_get_constraintdef(c.oid)) ORDER BY r.relname,c.conname)
      FROM relations r JOIN pg_catalog.pg_constraint c ON c.conrelid=r.oid),
    'indexes',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'catalog',to_jsonb(i)-ARRAY['indexrelid','indrelid'],
      'definition',pg_catalog.pg_get_indexdef(i.indexrelid),'owner',pg_catalog.pg_get_userbyid(c.relowner),'acl',c.relacl)
      ORDER BY r.relname) FROM relations r JOIN pg_catalog.pg_index i ON i.indrelid=r.oid JOIN pg_catalog.pg_class c ON c.oid=i.indexrelid),
    'policies',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,
      'catalog',to_jsonb(p)-ARRAY['oid','polrelid','polqual','polwithcheck'],
      'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid),'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid))
      ORDER BY r.relname,p.polname) FROM relations r JOIN pg_catalog.pg_policy p ON p.polrelid=r.oid),
    'triggers',(SELECT jsonb_agg(jsonb_build_object(
      'table',r.relname,'other_table',other.relname,'constraint_table',cr.relname,'constraint',c.conname,'index',ix.relname,
      'function',pn.nspname||'.'||p.proname,
      'generated_name_kind',CASE WHEN t.tgname='RI_ConstraintTrigger_'||CASE WHEN t.tgrelid=c.conrelid THEN 'c' ELSE 'a' END||'_'||t.oid::text
        THEN CASE WHEN t.tgrelid=c.conrelid THEN 'c' ELSE 'a' END ELSE t.tgname END,
      'catalog',to_jsonb(t)-ARRAY['oid','tgrelid','tgconstrrelid','tgconstraint','tgconstrindid','tgfoid','tgname'])
      ORDER BY cr.relname,r.relname,t.tgtype)
      FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class r ON r.oid=t.tgrelid
      JOIN pg_catalog.pg_class other ON other.oid=t.tgconstrrelid
      JOIN pg_catalog.pg_constraint c ON c.oid=t.tgconstraint JOIN pg_catalog.pg_class cr ON cr.oid=c.conrelid
      JOIN pg_catalog.pg_class ix ON ix.oid=t.tgconstrindid JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
      JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
      WHERE c.conrelid IN(SELECT oid FROM relations) AND c.contype='f')
  ) INTO v_actual;
  IF v_actual IS DISTINCT FROM v_contract THEN
    RAISE EXCEPTION 'rollback350 refuses unknown function/table/constraint/index/policy/ACL profile';
  END IF;
  -- Effective rights, namespaces and supporting physical/rowtype structures are
  -- checked independently of portable name-normalized catalog JSON.
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid IN(
      'public.reserve_buyer_ai_request(uuid,bigint,uuid,uuid,text,text,integer,bigint,integer)'::regprocedure,
      'public.transition_buyer_ai_request(uuid,bigint,uuid,text,text)'::regprocedure)
    AND (pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE WITH GRANT OPTION')))
    OR EXISTS(SELECT 1 FROM (VALUES('anon'),('authenticated'),('app_tenant'),('service_role')) roles(name)
      CROSS JOIN (VALUES('public.buyer_ai_daily_quotas'::regclass),('public.buyer_ai_operations'::regclass)) tables(id)
      CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) rights(privilege)
      WHERE pg_catalog.has_table_privilege(roles.name,tables.id,rights.privilege)) THEN
    RAISE EXCEPTION 'rollback350 refuses changed effective runtime privileges';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid IN('public.buyer_ai_daily_quotas'::regclass,'public.buyer_ai_operations'::regclass)
      AND (c.reloptions IS NOT NULL OR c.reltablespace<>0 OR NOT c.relispopulated
        OR c.relam<>(SELECT oid FROM pg_catalog.pg_am WHERE amname='heap')))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_inherits WHERE inhrelid IN('public.buyer_ai_daily_quotas'::regclass,'public.buyer_ai_operations'::regclass)
      OR inhparent IN('public.buyer_ai_daily_quotas'::regclass,'public.buyer_ai_operations'::regclass))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_class r LEFT JOIN pg_catalog.pg_type t ON t.oid=r.reltype LEFT JOIN pg_catalog.pg_type a ON a.oid=t.typarray
      WHERE r.oid IN('public.buyer_ai_daily_quotas'::regclass,'public.buyer_ai_operations'::regclass)
      AND (t.oid IS NULL OR a.oid IS NULL OR t.typname<>r.relname OR t.typnamespace<>r.relnamespace OR t.typowner<>r.relowner OR t.typtype<>'c'
        OR t.typrelid<>r.oid OR t.typacl IS NOT NULL OR t.typnotnull OR t.typbasetype<>0 OR t.typdefaultbin IS NOT NULL OR t.typdefault IS NOT NULL
        OR a.typname<>'_'||r.relname OR a.typnamespace<>r.relnamespace OR a.typowner<>r.relowner OR a.typtype<>'b'
        OR a.typelem<>t.oid OR a.typacl IS NOT NULL OR a.typnotnull OR a.typbasetype<>0 OR a.typdefaultbin IS NOT NULL OR a.typdefault IS NOT NULL))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid IN('public.buyer_ai_daily_quotas'::regclass,'public.buyer_ai_operations'::regclass)
      AND NOT t.tgisinternal)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid IN('public.buyer_ai_daily_quotas'::regclass,'public.buyer_ai_operations'::regclass)
      AND c.contype='f' AND (c.confrelid<>'public.buyer_accounts'::regclass OR c.connamespace<>'public'::regnamespace
        OR c.conindid<>(SELECT indexrelid FROM pg_catalog.pg_index WHERE indrelid='public.buyer_accounts'::regclass AND indisprimary))) THEN
    RAISE EXCEPTION 'rollback350 refuses changed relation/rowtype/supporting provenance';
  END IF;

  IF EXISTS(SELECT 1 FROM pg_catalog.pg_class r JOIN pg_catalog.pg_class t ON t.oid=r.reltoastrelid
      WHERE r.oid IN('public.buyer_ai_daily_quotas'::regclass,'public.buyer_ai_operations'::regclass)
      AND (t.relkind<>'t' OR t.relnamespace<>'pg_toast'::regnamespace OR t.relowner<>r.relowner
        OR t.relname<>'pg_toast_'||r.oid::text OR t.relacl IS NOT NULL OR t.reloptions IS NOT NULL
        OR t.relrowsecurity OR t.relforcerowsecurity
        OR (SELECT count(*) FROM pg_catalog.pg_index WHERE indrelid=t.oid)<>1))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indexrelid
      WHERE i.indrelid IN('public.buyer_ai_daily_quotas'::regclass,'public.buyer_ai_operations'::regclass)
      AND (c.relkind<>'i' OR c.relnamespace<>'public'::regnamespace OR c.reloptions IS NOT NULL
        OR c.relam<>(SELECT oid FROM pg_catalog.pg_am WHERE amname='btree')))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite WHERE ev_class IN('public.buyer_ai_daily_quotas'::regclass,'public.buyer_ai_operations'::regclass)) THEN
    RAISE EXCEPTION 'rollback350 refuses changed TOAST/index/rule provenance';
  END IF;

  -- The closed owned object set includes each automatically owned type, array,
  -- TOAST/index, default, constraint, policy and FK trigger. A new external
  -- catalog-recorded function, view, FK, trigger, statistic or extension dependency
  -- cannot be cascaded away or left until after the first DROP.
  IF EXISTS(
    WITH roots AS (SELECT * FROM pg_catalog.pg_class WHERE oid IN('public.buyer_ai_daily_quotas'::regclass,'public.buyer_ai_operations'::regclass)),
    owned(classid,objid) AS (
      SELECT 'pg_catalog.pg_class'::regclass::oid,oid FROM roots
      UNION SELECT 'pg_catalog.pg_proc'::regclass::oid,p.oid FROM pg_catalog.pg_proc p WHERE p.oid IN(
        'public.reserve_buyer_ai_request(uuid,bigint,uuid,uuid,text,text,integer,bigint,integer)'::regprocedure,
        'public.transition_buyer_ai_request(uuid,bigint,uuid,text,text)'::regprocedure)
      UNION SELECT 'pg_catalog.pg_type'::regclass::oid,t.oid FROM pg_catalog.pg_type t WHERE t.oid IN(SELECT reltype FROM roots
        UNION SELECT typarray FROM pg_catalog.pg_type WHERE oid IN(SELECT reltype FROM roots))
      UNION SELECT 'pg_catalog.pg_constraint'::regclass::oid,oid FROM pg_catalog.pg_constraint WHERE conrelid IN(SELECT oid FROM roots)
      UNION SELECT 'pg_catalog.pg_attrdef'::regclass::oid,oid FROM pg_catalog.pg_attrdef WHERE adrelid IN(SELECT oid FROM roots)
      UNION SELECT 'pg_catalog.pg_policy'::regclass::oid,oid FROM pg_catalog.pg_policy WHERE polrelid IN(SELECT oid FROM roots)
      UNION SELECT 'pg_catalog.pg_trigger'::regclass::oid,oid FROM pg_catalog.pg_trigger
        WHERE tgconstraint IN(SELECT oid FROM pg_catalog.pg_constraint WHERE conrelid IN(SELECT oid FROM roots) AND contype='f')
      UNION SELECT 'pg_catalog.pg_class'::regclass::oid,indexrelid FROM pg_catalog.pg_index
        WHERE indrelid IN(SELECT oid FROM roots UNION SELECT reltoastrelid FROM roots WHERE reltoastrelid<>0)
      UNION SELECT 'pg_catalog.pg_class'::regclass::oid,reltoastrelid FROM roots WHERE reltoastrelid<>0
    ), allowed_external(classid,objid) AS (
      SELECT 'pg_catalog.pg_namespace'::regclass::oid,'public'::regnamespace::oid
      UNION SELECT 'pg_catalog.pg_namespace'::regclass::oid,'pg_toast'::regnamespace::oid
      UNION SELECT 'pg_catalog.pg_language'::regclass::oid,oid FROM pg_catalog.pg_language WHERE lanname='plpgsql'
      UNION SELECT 'pg_catalog.pg_class'::regclass::oid,'public.buyer_accounts'::regclass::oid
      UNION SELECT 'pg_catalog.pg_class'::regclass::oid,indexrelid FROM pg_catalog.pg_index WHERE indrelid='public.buyer_accounts'::regclass AND indisprimary
    )
    SELECT 1 FROM pg_catalog.pg_depend d
    WHERE (EXISTS(SELECT 1 FROM owned o WHERE o.classid=d.refclassid AND o.objid=d.refobjid)
        AND NOT EXISTS(SELECT 1 FROM owned o WHERE o.classid=d.classid AND o.objid=d.objid))
      OR (EXISTS(SELECT 1 FROM owned o WHERE o.classid=d.classid AND o.objid=d.objid)
        AND NOT EXISTS(SELECT 1 FROM owned o WHERE o.classid=d.refclassid AND o.objid=d.refobjid)
        AND NOT EXISTS(SELECT 1 FROM allowed_external o WHERE o.classid=d.refclassid AND o.objid=d.refobjid))
  ) THEN
    RAISE EXCEPTION 'rollback350 refuses unknown incoming/outgoing object dependencies';
  END IF;
  IF EXISTS(SELECT 1 FROM public.buyer_ai_operations) OR EXISTS(SELECT 1 FROM public.buyer_ai_daily_quotas) THEN
    RAISE EXCEPTION 'rollback350 refuses retained buyer AI receipts or quota rows';
  END IF;
END;
$ai350_retirement_precondition$;
-- Recheck the full quiescence contract after profile/dependency/retention checks.
DO $ai350_final_quiescence$
BEGIN
  IF pg_catalog.current_setting('transaction_isolation')<>'read committed'
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid'
       AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
    RAISE EXCEPTION 'rollback350 refuses concurrent/prepared writes or non-read-committed state';
  END IF;
END;
$ai350_final_quiescence$;
DROP FUNCTION public.transition_buyer_ai_request(uuid,bigint,uuid,text,text) RESTRICT;
DROP FUNCTION public.reserve_buyer_ai_request(uuid,bigint,uuid,uuid,text,text,integer,bigint,integer) RESTRICT;
DROP TABLE public.buyer_ai_operations RESTRICT;
DROP TABLE public.buyer_ai_daily_quotas RESTRICT;
COMMIT;
