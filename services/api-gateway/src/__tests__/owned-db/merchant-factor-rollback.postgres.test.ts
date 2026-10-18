import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync}from 'node:fs';
import {requireOwnedDatabase}from './owned-db-support';
const owned=requireOwnedDatabase();
const migration=(n:number)=>readFileSync(n===338?'database/supabase/migrations/338_merchant_totp_authority.sql':'database/supabase/migrations/339_merchant_erasure_review_intake.sql','utf8');
const rollback=(n:number)=>readFileSync(n===338?'database/supabase/rollback/338_merchant_totp_authority.rollback.sql':'database/supabase/rollback/339_merchant_erasure_review_intake.rollback.sql','utf8');
const snap=()=>owned.psql(`SELECT md5(string_agg(proname||prosrc||coalesce(proconfig::text,'')||coalesce(proacl::text,''),','ORDER BY proname))FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('execute_merchant_totp_command_v1','retire_merchant_totp_http_credentials_v1','request_merchant_erasure_review_v1');`);
for(const n of [338,339])test('empty-history '+n+' rollback/reapply preserves exact definitions and the stronger private credential fence',()=>{
 const before=snap();owned.script(rollback(n));owned.script(migration(n));assert.equal(snap(),before);
 for(const role of ['anon','authenticated','app_tenant'])assert.equal(owned.psql(`SELECT has_table_privilege('${role}','merchant_2fa_factors','SELECT');`),'f');
 assert.equal(owned.psql(`SELECT has_column_privilege('service_role','merchant_2fa_factors','status','UPDATE');`),'f');
});
for(const [n,name,sig,names]of [[338,'execute_merchant_totp_command_v1','uuid,text,text,jsonb','p_actor_id uuid,p_command text,p_key text,p_input jsonb'],[339,'request_merchant_erasure_review_v1','uuid,uuid,text,text,text,text','p_site uuid,p_actor uuid,p_email text,p_reason text,p_key text,p_request_id text']]as const)test('rollback '+n+' refuses changed return ABI, argument names and overloads without mutations',()=>{
 const before=snap(),guard=rollback(n).match(/DO \$guard\$[\s\S]*?END \$guard\$;/)![0];
 for(const definition of [
  `DROP FUNCTION public.${name}(${sig});CREATE FUNCTION public.${name}(${names})RETURNS text LANGUAGE sql AS $$SELECT ''::text$$;`,
  `DROP FUNCTION public.${name}(${sig});CREATE FUNCTION public.${name}(${names.replace('p_actor_id','p_wrong').replace('p_site uuid','p_wrong uuid')})RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`,
  `CREATE FUNCTION public.${name}(text)RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`
 ]){assert.match(owned.psqlExpectError('BEGIN;'+definition+guard),/refuses changed/);assert.equal(snap(),before);}
});

test('rollback338 refuses retirement helper return drift without changing credential definitions',()=>{
 const before=snap(),guard=rollback(338).match(/DO \$guard\$[\s\S]*?END \$guard\$;/)![0];
 assert.match(owned.psqlExpectError("BEGIN;DROP FUNCTION retire_merchant_totp_http_credentials_v1();CREATE FUNCTION retire_merchant_totp_http_credentials_v1()RETURNS text LANGUAGE sql AS $$SELECT ''::text$$;"+guard),/refuses changed retirement ABI/);assert.equal(snap(),before);
});
