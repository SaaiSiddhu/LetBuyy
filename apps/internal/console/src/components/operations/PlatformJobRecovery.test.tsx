import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlatformJobRecovery} from './PlatformJobRecovery';
import type {InternalPlatformJob} from '@letbuyy/shared-types';
const actorId='11111111-1111-4111-8111-111111111111',sessionId='22222222-2222-4222-8222-222222222222';
const job:InternalPlatformJob & {request_key:string}={id:'33333333-3333-4333-8333-333333333333',site_id:actorId,order_id:sessionId,
 redeemed_entry_id:'44444444-4444-4444-8444-444444444444',queue_name:'loyalty-refunds',job_type:'loyalty.restore_redeemed',status:'dead',
 attempts:10,max_attempts:10,points:'50',point_value_minor:'100',value_minor:'5000',created_at:'2026-10-18T00:00:00Z',failed_at:'2026-10-18T00:00:00Z',completed_at:null,
 eligible:true,source_valid:true,reason_code:'eligible',source_identity:'a'.repeat(64),source_fingerprint:'b'.repeat(64),request_key:'55555555-5555-4555-8555-555555555555'};
const render=(jobs:typeof job[],error?:string)=>renderToStaticMarkup(<PlatformJobRecovery jobs={jobs} actorId={actorId} sessionId={sessionId} error={error} page={1} hasNext={false}/>);
test('empty and unavailable inspection states never display a recovery action',()=>{
 assert.match(render([]),/No exhausted loyalty jobs/);
 const failed=render([job],'Current permission is unavailable');assert.match(failed,/role="alert"/);assert.doesNotMatch(failed,/<form/);
});
test('an eligible job shows its original source, one-attempt effect and current-session refusal precondition',()=>{
 const html=render([job]);assert.match(html,/10 attempts used of 10/);assert.match(html,/5000 minor units/);
 assert.match(html,/different active platform super admin/);assert.match(html,/Approval alone does not retry/);
 assert.match(html,/name="expected_session_id" value="22222222-2222-4222-8222-222222222222"/);
 assert.match(html,/name="request_key" value="55555555-5555-4555-8555-555555555555"/);
 assert.doesNotMatch(html,/name="actor_id"|name="payload"|error_message|synthetic_private_marker/);
});
test('an ineligible or already completed job has no retry form',()=>{
 const html=render([{...job,status:'succeeded',eligible:false,reason_code:'debt_not_owed'}]);assert.doesNotMatch(html,/<form/);assert.match(html,/cannot be retried/);
});
