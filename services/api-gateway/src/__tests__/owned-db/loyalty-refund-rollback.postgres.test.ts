import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {requireOwnedDatabase} from './owned-db-support';
const owned=requireOwnedDatabase();
const migration=readFileSync(new URL('../../../../../database/supabase/migrations/335_durable_loyalty_refund_recovery.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../../../../../database/supabase/rollback/335_durable_loyalty_refund_recovery.rollback.sql',import.meta.url),'utf8');
const guard=rollback.match(/DO \$guard\$[\s\S]*?END \$guard\$;/)![0];
const digest=()=>owned.psql(`SELECT md5(string_agg(p.proname||p.prosrc||p.proacl::text,','ORDER BY p.proname))FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND p.proname IN('restore_loyalty_on_refund','loyalty_order_reversal_eligible_v1','enqueue_pending_loyalty_refunds_v1','recover_loyalty_refund_job_v1','recover_expired_loyalty_refund_jobs_v1');`);
test('335 rollback and forward repair preserve exact bodies/ACLs without deleting business history',()=>{
 const before=digest();owned.script(rollback);
 assert.equal(owned.psql(`SELECT to_regprocedure('public.enqueue_pending_loyalty_refunds_v1(integer)') IS NULL;`),'t');
 assert.equal(owned.psql(`SELECT has_function_privilege('service_role','public.restore_loyalty_on_refund(uuid,uuid,uuid,text)','EXECUTE');`),'t');
 assert.equal(owned.psql(`SELECT has_function_privilege('app_tenant','public.restore_loyalty_on_refund(uuid,uuid,uuid,text)','EXECUTE');`),'f');
 owned.script(migration);assert.equal(digest(),before);
});
test('rollback refuses changed input names, return ABI and overloads before any definition changes',()=>{
 const before=digest();
 for(const definition of [
  `DROP FUNCTION enqueue_pending_loyalty_refunds_v1(integer);CREATE FUNCTION enqueue_pending_loyalty_refunds_v1(p_wrong integer)RETURNS integer LANGUAGE sql AS $$SELECT 0$$;`,
  `DROP FUNCTION enqueue_pending_loyalty_refunds_v1(integer);CREATE FUNCTION enqueue_pending_loyalty_refunds_v1(p_limit integer)RETURNS bigint LANGUAGE sql AS $$SELECT 0::bigint$$;`,
  `CREATE FUNCTION enqueue_pending_loyalty_refunds_v1(text)RETURNS integer LANGUAGE sql AS $$SELECT 0$$;`
 ]){
  assert.match(owned.psqlExpectError('BEGIN;'+definition+guard),/rollback335 refuses changed recovery ABI/);
  assert.equal(digest(),before);
 }
});
