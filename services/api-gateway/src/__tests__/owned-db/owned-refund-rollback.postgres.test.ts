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
