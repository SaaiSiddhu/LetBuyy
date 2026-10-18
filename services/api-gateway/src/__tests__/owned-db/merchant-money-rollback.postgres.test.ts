import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync}from 'node:fs';
import {requireOwnedDatabase}from './owned-db-support';
const owned=requireOwnedDatabase();
const migration=readFileSync('database/supabase/migrations/342_live_merchant_money_claims.sql','utf8');
const rollback=readFileSync('database/supabase/rollback/342_live_merchant_money_claims.rollback.sql','utf8');
const snapshot=(base=false)=>owned.psql(`SELECT md5(string_agg(proname||prosrc||coalesce(proconfig::text,'')||coalesce(proacl::text,''),','ORDER BY proname))FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN(${base?"'reserve_payment_refund_attempt','claim_payout_statement_release'":"'reserve_owned_payment_refund_v1','claim_owned_payout_release_v1'"});`);
test('empty-history342 rollback fails closed and reapply restores exact guards without changing canonical writers',()=>{
 const before=snapshot(),canonical=snapshot(true);owned.script(rollback);for(const sig of ['reserve_owned_payment_refund_v1(uuid,uuid,uuid,bigint,text,jsonb,text,jsonb)','claim_owned_payout_release_v1(uuid,uuid,text,uuid,jsonb,text)'])assert.equal(owned.psql(`SELECT to_regprocedure('public.${sig}')IS NULL;`),'t');assert.equal(snapshot(true),canonical);owned.script(migration);assert.equal(snapshot(),before);assert.equal(snapshot(true),canonical);
});
for(const [name,sig,args]of [
 ['reserve_owned_payment_refund_v1','uuid,uuid,uuid,bigint,text,jsonb,text,jsonb','p_site_id uuid,p_payment_id uuid,p_actor_id uuid,p_amount_minor bigint,p_idempotency_key text,p_step_up jsonb,p_request_id text,p_metadata jsonb'],
 ['claim_owned_payout_release_v1','uuid,uuid,text,uuid,jsonb,text','p_site_id uuid,p_statement_id uuid,p_idempotency_key text,p_actor_id uuid,p_step_up jsonb,p_request_id text']
])test('rollback342 refuses '+name+' argument/return/overload drift before mutation',()=>{
 const before=snapshot(),guard=rollback.match(/DO \$guard\$[\s\S]*?END \$guard\$;/)![0];for(const d of [
 `DROP FUNCTION public.${name}(${sig});CREATE FUNCTION public.${name}(${args.replace('p_site_id uuid','p_wrong uuid')})RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`,
 `DROP FUNCTION public.${name}(${sig});CREATE FUNCTION public.${name}(${args})RETURNS text LANGUAGE sql AS $$SELECT ''::text$$;`,
 `CREATE FUNCTION public.${name}(text)RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`
 ]){assert.match(owned.psqlExpectError('BEGIN;'+d+guard),/refuses changed merchant claim ABI/);assert.equal(snapshot(),before);}
});
