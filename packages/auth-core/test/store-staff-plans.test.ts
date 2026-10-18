// APPID-P5b — what a store owner may write into their own staff's record.
//
// A store's staff row lives in the same `employees` table as the platform's own staff. The merchant
// routes therefore accept only the store roles and permission keys the merchant app offers
// (apps/merchant/web/src/lib/staff/roles.ts), so no platform role or scope is ever written there.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LETBUYY_STORE_STAFF_PERMISSIONS,
  LETBUYY_STORE_STAFF_ROLES,
  planEmployeeStaffCreate,
  planEmployeeUpdate,
} from '../src/index.ts';

test('an update takes a store role and store permission keys, deduplicated', () => {
  assert.deepEqual(planEmployeeUpdate({ role: 'editor', permissions: { granted: ['products:write', 'content:write', 'products:write'] } }), {
    ok: true,
    value: { role: 'editor', permissions: { granted: ['products:write', 'content:write'] } },
  });
  for (const role of LETBUYY_STORE_STAFF_ROLES) {
    assert.equal(planEmployeeUpdate({ role }).ok, true, role);
  }
  assert.deepEqual(planEmployeeUpdate({ permissions: { granted: [...LETBUYY_STORE_STAFF_PERMISSIONS] } }).ok, true);
});

test('a platform role, a platform scope, a wildcard or any other shape is refused', () => {
  for (const body of [
    { role: 'admin' },
    { role: 'operations' },
    { role: 'sales' },
    { role: 'owner' },
    { permissions: { granted: ['review:decide'] } },
    { permissions: { granted: ['rbac:manage'] } },
    { permissions: { granted: ['*'] } },
    { permissions: { granted: ['products:*'] } },
    { permissions: { granted: ['products:write'], scopes: ['review:decide'] } },
    { permissions: ['products:write'] },
    { permissions: { granted: 'products:write' } },
    { permissions: null },
    {},
  ] as Record<string, unknown>[]) {
    assert.equal(planEmployeeUpdate(body).ok, false, JSON.stringify(body));
  }
});

test('a new staff record defaults to editor and refuses a platform role', () => {
  const plan = planEmployeeStaffCreate({ email: 'Staff@Shop.test', store_id: 'site-1' }, 'owner-1');
  assert.equal(plan.ok, true);
  assert.equal(plan.ok && plan.value.role, 'editor');
  assert.equal(plan.ok && plan.value.status, 'invited');
  assert.equal(planEmployeeStaffCreate({ email: 'a@b.test', store_id: 'site-1', role: 'viewer' }, 'o').ok, true);
  for (const role of ['admin', 'operations', 'sales', 'superuser']) {
    assert.equal(planEmployeeStaffCreate({ email: 'a@b.test', store_id: 'site-1', role }, 'o').ok, false, role);
  }
});

test('role-only downgrades replace prior grants with canonical role defaults; create preserves the owner supplied display name', () => {
  assert.deepEqual(planEmployeeUpdate({role:'viewer'}),{ok:true,value:{role:'viewer',permissions:{granted:['products:read','orders:read','reports:read']}}});
  const plan=planEmployeeStaffCreate({email:'staff@example.invalid',store_id:'site-1',role:'editor',full_name:'  Synthetic Staff  '},'owner');
  assert.equal(plan.ok && plan.value.full_name,'Synthetic Staff');
  assert.deepEqual(plan.ok && plan.value.permissions,{granted:['products:write','content:write','reports:read']});
  assert.equal(planEmployeeStaffCreate({email:'staff@example.invalid',store_id:'site-1',full_name:'x'.repeat(121)},'owner').ok,false);
});

test('staff invitation proofs bind one ID and purpose/key without becoming session tokens', async () => {
  const {createMerchantStaffInvitationToken,verifyMerchantStaffInvitationToken}=await import('../src/index.ts');
  const id=crypto.randomUUID(),secret=crypto.randomUUID()+crypto.randomUUID();
  const token=await createMerchantStaffInvitationToken(id,secret);
  assert.equal(await verifyMerchantStaffInvitationToken(token,secret),id);
  assert.equal(await verifyMerchantStaffInvitationToken(token,crypto.randomUUID()+crypto.randomUUID()),null);
  assert.equal(await verifyMerchantStaffInvitationToken(token.replace(id,crypto.randomUUID()),secret),null);
  assert.equal(await verifyMerchantStaffInvitationToken(token.replace('lb-staff-invite-v1','merchant_session'),secret),null);
  assert.equal(await verifyMerchantStaffInvitationToken('header.payload.signature',secret),null);
  await assert.rejects(()=>createMerchantStaffInvitationToken(id,'short'),/unavailable/);
});
