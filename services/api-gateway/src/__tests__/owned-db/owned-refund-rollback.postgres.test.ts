import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {requireOwnedDatabase} from './owned-db-support';
const owned=requireOwnedDatabase();
const migration=readFileSync('database/supabase/migrations/336_owned_refund_completion.sql','utf8');
const currentMigration=readFileSync('database/supabase/migrations/341_live_merchant_refund_approval.sql','utf8');
const currentRollback=readFileSync('database/supabase/rollback/341_live_merchant_refund_approval.rollback.sql','utf8');
const rollback=readFileSync('database/supabase/rollback/336_owned_refund_completion.rollback.sql','utf8');
const guard=rollback.match(/DO \$guard\$[\s\S]*?END \$guard\$;/)![0];
const snapshot=()=>owned.psql(`SELECT md5(string_agg(p.proname||p.prosrc||p.proconfig::text||p.proacl::text,','ORDER BY p.proname))FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND p.proname IN('complete_order_refund','complete_owned_order_refund_v1');`);
test('empty-history336 rollback retains service-only permissions and reapply restores exact definitions and grants',()=>{
 const before=snapshot();assert.match(owned.psqlExpectError(rollback),/newer341 approval boundary/);owned.script(currentRollback);owned.script(migration);owned.script(rollback);
 assert.equal(owned.psql(`SELECT to_regprocedure('public.complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text)')IS NULL;`),'t');
 for(const role of ['anon','authenticated','app_tenant'])assert.equal(owned.psql(`SELECT has_function_privilege('${role}','public.complete_order_refund(uuid,text,text,uuid,text,text)','EXECUTE');`),'f');
 assert.equal(owned.psql(`SELECT has_function_privilege('service_role','public.complete_order_refund(uuid,text,text,uuid,text,text)','EXECUTE');`),'t');
 owned.script(migration);owned.script(currentMigration);assert.equal(snapshot(),before);
});
test('rollback refuses changed input names, return ABI or overloads before changing definitions',()=>{
 const before=snapshot();
 for(const definition of [
 `DROP FUNCTION complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text);CREATE FUNCTION complete_owned_order_refund_v1(p_wrong uuid,p_order_id uuid,p_return_id uuid,p_actor_id uuid,p_intent jsonb,p_request_id text)RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`,
 `DROP FUNCTION complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text);CREATE FUNCTION complete_owned_order_refund_v1(p_site_id uuid,p_order_id uuid,p_return_id uuid,p_actor_id uuid,p_intent jsonb,p_request_id text)RETURNS text LANGUAGE sql AS $$SELECT ''::text$$;`,
 `CREATE FUNCTION complete_owned_order_refund_v1(text)RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`
 ]){assert.match(owned.psqlExpectError('BEGIN;'+definition+guard),/rollback336 refuses changed completion ABI/);assert.equal(snapshot(),before);}
});

test('empty-history341 rollback fails closed without the merchant wrapper and reapply restores exact stronger source',()=>{
 const before=snapshot();owned.script(currentRollback);assert.equal(owned.psql(`SELECT to_regprocedure('public.complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text)')IS NULL;`),'t');
 assert.equal(owned.psql(`SELECT to_regprocedure('public.complete_order_refund(uuid,text,text,uuid,text,text)')IS NOT NULL;`),'t');owned.script(currentMigration);assert.equal(snapshot(),before);
});

test('concurrent ABI drift sessions both refuse atomically and leave the current definitions intact',async()=>{
 const before=snapshot();
 const barrier=crypto.getRandomValues(new Uint32Array(1))[0] % 1000000000 + 1000000000;
 // The holder waits for two actual advisory-lock waiters. Time bounds only fail
 // the test; they never decide that the concurrent path has been exercised.
 const holder=owned.psqlAsync(`BEGIN; SET LOCAL statement_timeout='20s';
 SELECT pg_advisory_xact_lock(${barrier}::bigint);
 DO $$DECLARE deadline timestamptz:=clock_timestamp()+interval '15 seconds';BEGIN
  WHILE(SELECT count(*)FROM pg_locks WHERE locktype='advisory' AND classid=0 AND objid=${barrier} AND NOT granted)<2 LOOP
   IF clock_timestamp()>deadline THEN RAISE EXCEPTION 'ABI refusal barrier did not obtain both waiters';END IF;
   PERFORM pg_sleep(0.01);
  END LOOP;
 END$$;COMMIT;`);
 // Attach rejection handling immediately, including failures during setup.
 const holderResult=holder.then(()=>null,(error:Error)=>error);
 const deadline=Date.now()+5000;
 while(owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=0 AND objid=${barrier} AND granted);`)!=='t'){
  if(Date.now()>deadline)throw new Error('Owned ABI barrier holder did not acquire its exact lock');
 }
 const changes=['text','boolean'].map(type=>owned.psqlAsync(`BEGIN; SET LOCAL statement_timeout='20s';
 CREATE FUNCTION public.complete_owned_order_refund_v1(p_control ${type})RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
 SELECT pg_advisory_xact_lock(${barrier}::bigint);${guard}COMMIT;`)
  .then(()=>{throw new Error('ABI drift unexpectedly passed');},(error:Error)=>{assert.match(error.message,/rollback336 refuses changed completion ABI/);}));
 await Promise.all(changes);
 assert.equal(await holderResult,null);
 assert.equal(snapshot(),before);
 for(const type of ['text','boolean'])assert.equal(owned.psql(`SELECT to_regprocedure('public.complete_owned_order_refund_v1(${type})')IS NULL;`),'t');
});
