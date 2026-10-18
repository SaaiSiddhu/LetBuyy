import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync}from 'node:fs';
import {requireOwnedDatabase}from './owned-db-support';
const owned=requireOwnedDatabase();
const sql=(n:number,kind:'migrations'|'rollback')=>readFileSync(`database/supabase/${kind}/${n}_${n===340?'merchant_step_up_challenges':'live_merchant_refund_approval'}${kind==='rollback'?'.rollback':''}.sql`,'utf8');
const snapshot=()=>owned.psql(`SELECT md5(string_agg(proname||prosrc||coalesce(proconfig::text,'')||coalesce(proacl::text,''),','ORDER BY proname))FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('issue_merchant_step_up_v1','verify_merchant_step_up_v1','complete_owned_order_refund_v1');`);
test('empty challenge/refund history rolls back in reverse order, fails closed, then reapplies exact guarded source',()=>{
 const before=snapshot();owned.script(sql(341,'rollback'));owned.script(sql(340,'rollback'));
 for(const sig of ['issue_merchant_step_up_v1(uuid,uuid,uuid,text,text,text,jsonb)','verify_merchant_step_up_v1(uuid,uuid,text,jsonb)','complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text)'])assert.equal(owned.psql(`SELECT to_regprocedure('public.${sig}')IS NULL;`),'t');
 owned.script(sql(340,'migrations'));owned.script(sql(341,'migrations'));assert.equal(snapshot(),before);
 for(const role of ['anon','authenticated','app_tenant'])assert.equal(owned.psql(`SELECT has_function_privilege('${role}','public.complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text)','EXECUTE');`),'f');
});
for(const [n,name,sig,args]of [[340,'issue_merchant_step_up_v1','uuid,uuid,uuid,text,text,text,jsonb','p_site uuid,p_actor uuid,p_factor uuid,p_action text,p_key text,p_factor_sha256 text,p_proof jsonb'],[341,'complete_owned_order_refund_v1','uuid,uuid,uuid,uuid,jsonb,text','p_site_id uuid,p_order_id uuid,p_return_id uuid,p_actor_id uuid,p_intent jsonb,p_request_id text']]as const)test('rollback'+n+' refuses return/argument/overload drift before mutation',()=>{
 const guard=sql(n,'rollback').match(/DO \$guard\$[\s\S]*?END \$guard\$;/)![0],before=snapshot();
 for(const definition of [
 `DROP FUNCTION public.${name}(${sig});CREATE FUNCTION public.${name}(${args})RETURNS text LANGUAGE sql AS $$SELECT ''::text$$;`,
 `DROP FUNCTION public.${name}(${sig});CREATE FUNCTION public.${name}(${args.replace('p_site uuid','p_wrong uuid').replace('p_site_id uuid','p_wrong uuid')})RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`,
 `CREATE FUNCTION public.${name}(text)RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`
 ]){assert.match(owned.psqlExpectError('BEGIN;'+definition+guard),/refuses changed/);assert.equal(snapshot(),before);}
});
