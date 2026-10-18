// The accepted N1.6 contract supersedes the retired GoTrue flow. Actual normal
// worker invitation/acceptance is proved in owned-db/merchant-staff-invitation.
// This transport contract retains fail-closed behavior when signing is absent.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../index';
import {createStaffInvitation} from '../execution/staff-invitation-execution.adapter';

test('unconfigured staff invitation signing returns explicit503 before database or provider calls',async()=>{
 let calls=0;
 await assert.rejects(()=>createStaffInvitation({
  db:{rpc:async()=>{calls++;throw new Error('Unexpected database call');}} as never,env:{} as Env,
  actor:{id:'00000000-0000-4000-8000-000000000001',email:'owner@example.invalid'},
  storeId:'00000000-0000-4000-8000-000000000002',intent:{email:'staff@example.invalid',role:'viewer'},key:'synthetic-stable-key',
 }),(e:any)=>e.statusCode===503 && e.code==='STAFF_INVITATION_UNAVAILABLE');
 assert.equal(calls,0);
});
