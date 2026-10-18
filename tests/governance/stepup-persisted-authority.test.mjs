import assert from 'node:assert/strict';
import {spawnSync}from 'node:child_process';
import {readFileSync}from 'node:fs';
import test from 'node:test';
const validator='scripts/validators/stepup-crypto-validator.mjs';
const run=(fixture)=>spawnSync(process.execPath,[validator],{encoding:'utf8',env:{...process.env,...(fixture?{LETBUYY_PHASE_B_EXTRA_FILES_JSON:JSON.stringify([fixture])}:{})}});
test('current canonical MAC/persistence/refund authority passes the crypto validator',()=>{
 const result=run();assert.equal(result.status,0,result.stdout+result.stderr);
});
for(const [name,path,from,to,expected]of [
 ['route persistence','services/api-gateway/src/routes/security.ts',"db.rpc('issue_merchant_step_up_v1'","db.rpc('unbound_cached_challenge'",/must persist challenge evidence/],
 ['atomic persistence','database/supabase/migrations/340_merchant_step_up_challenges.sql','INSERT INTO public.step_up_challenges','PERFORM public.unbound_challenge',/must persist challenge evidence/],
 ['MAC composition','services/api-gateway/src/lib/merchant-step-up.ts','await verifySensitiveActionStepUp(input)','({ ok: true, metadata: {} })',/compose MAC validation/],
 ['transaction proof guard','database/supabase/migrations/341_live_merchant_refund_approval.sql'," IF NOT public.verify_merchant_step_up_v1(p_site_id,p_actor_id,'refund.approve',p_intent->'_step_up')THEN RETURN jsonb_build_object('status',428,'error','STEP_UP_INVALID');END IF;",'',/bind current persisted approval/]
])test('crypto validator rejects removal of '+name,()=>{
 const original=readFileSync(path,'utf8');assert.ok(original.includes(from));const result=run({path,text:original.replace(from,to)});assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,expected);
});

for (const [name,returns,expected] of [['complete_owned_order_refund_v1','jsonb',/bind current persisted approval/],['verify_merchant_step_up_v1','boolean',/bind token, source timestamps/]]) test('a later unsafe '+name+' definition cannot hide behind earlier migration evidence',()=>{
 const text=`CREATE OR REPLACE FUNCTION public.${name}()RETURNS ${returns} LANGUAGE plpgsql AS $unsafe$ BEGIN RETURN ${returns==='boolean'?'true':"'{}'::jsonb"};END $unsafe$;`;
 const result=run({path:'database/supabase/migrations/999_bad_stepup.sql',text});assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,expected);
});

for (const [name,action] of [['reserve_owned_payment_refund_v1','refund.approve'],['claim_owned_payout_release_v1','payout.release']]) test('money claim validator rejects removal of '+name+' live approval guard',()=>{
 const path='database/supabase/migrations/342_live_merchant_money_claims.sql',original=readFileSync(path,'utf8');
 const guard=` IF NOT public.verify_merchant_step_up_v1(p_site_id,p_actor_id,'${action}',p_step_up)THEN RETURN jsonb_build_object('accepted',false,'status',428,'code','STEP_UP_INVALID');END IF;`;
 assert.ok(original.includes(guard));const result=run({path,text:original.replace(guard,'')});assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/bind current owned proof/);
});
for (const name of ['reserve_owned_payment_refund_v1','claim_owned_payout_release_v1']) test('a later unsafe '+name+' cannot bypass current money claim checks',()=>{
 const text=`CREATE OR REPLACE FUNCTION public.${name}()RETURNS jsonb LANGUAGE plpgsql AS $unsafe$ BEGIN RETURN '{}'::jsonb;END $unsafe$;`;
 const result=run({path:'database/supabase/migrations/999_bad_money_claim.sql',text});assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/bind current owned proof/);
});
