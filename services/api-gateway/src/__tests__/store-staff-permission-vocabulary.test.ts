import assert from 'node:assert/strict';
import test from 'node:test';
import { LETBUYY_STORE_STAFF_PERMISSIONS } from '@letbuyy/auth-core';
import { LEGACY_PERMISSION_ALIASES } from '@letbuyy/permission-core';
import { evaluateStaffPermission, type StaffPermissionKey } from '../lib/staff-permission-decision';

// reports:read is the maintained merchant grant already offered in role defaults.
// Analytics now enforces that exact grant against canonical users_custom/employees.
// The DEAD identity-foundation shadow is not a second authority to activate or backfill.
// Keep its historical alias vocabulary unchanged; actual route access is proved by
// tests/owned-db/merchant-dashboard-access.postgres.test.ts through the complete worker.
test('the historical shadow aliases still omit reports:read; maintained merchant vocabulary has twelve grants', () => {
    const aliased = new Set(LEGACY_PERMISSION_ALIASES.map(alias => alias.legacy));
    assert.deepEqual(LETBUYY_STORE_STAFF_PERMISSIONS.filter(key => !aliased.has(key)), ['reports:read']);
    assert.equal(LETBUYY_STORE_STAFF_PERMISSIONS.length, 12);
});

test('no report or analytics alias activates a shadow authority', () => {
    assert.deepEqual(LEGACY_PERMISSION_ALIASES.map(alias => alias.canonical)
        .filter(action => /^(report|reports|analytic|analytics)\./.test(action)), []);
});

test('maintained reports key permits explicit staff grants and owners while unrelated grants remain denied', () => {
    const requiredKey: StaffPermissionKey = 'reports:read';
    assert.equal(evaluateStaffPermission({ isOwner:false,granted:[requiredKey],requiredKey }).allowed,true);
    assert.equal(evaluateStaffPermission({ isOwner:false,granted:['products:read'],requiredKey }).allowed,false);
    assert.equal(evaluateStaffPermission({ isOwner:true,granted:[],requiredKey }).allowed,true);
});
