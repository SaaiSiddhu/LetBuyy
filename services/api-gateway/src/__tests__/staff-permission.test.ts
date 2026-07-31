import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    evaluateStaffPermission,
    staffRbacMode,
} from '../middleware/staff-permission';
import type { Env } from '../index';

const env = (mode?: string) => ({ MERCHANT_STAFF_RBAC_MODE: mode } as unknown as Env);

// --- the decision logic (security core) ---

test('owner bypasses every permission, even with no grants', () => {
    assert.equal(evaluateStaffPermission({ isOwner: true, granted: [], requiredKey: 'products:write' }).allowed, true);
    assert.equal(evaluateStaffPermission({ isOwner: true, granted: [], requiredKey: 'settings:write' }).reason, 'owner');
});

test('a viewer (read-only grants) is BLOCKED from a write', () => {
    const viewer = ['products:read', 'orders:read', 'reports:read'];
    const d = evaluateStaffPermission({ isOwner: false, granted: viewer, requiredKey: 'products:write' });
    assert.equal(d.allowed, false);
    assert.match(d.reason, /^missing:products:write$/);
});

test('a viewer IS allowed the read it was granted', () => {
    const viewer = ['products:read', 'orders:read', 'reports:read'];
    assert.equal(evaluateStaffPermission({ isOwner: false, granted: viewer, requiredKey: 'products:read' }).allowed, true);
});

test('a manager (has the write grant) is allowed', () => {
    const manager = ['products:write', 'orders:write', 'customers:write'];
    assert.equal(evaluateStaffPermission({ isOwner: false, granted: manager, requiredKey: 'products:write' }).allowed, true);
});

test('the "*" super-grant allows anything', () => {
    assert.equal(evaluateStaffPermission({ isOwner: false, granted: ['*'], requiredKey: 'settings:write' }).allowed, true);
});

test('a "prefix:*" wildcard allows matching keys', () => {
    assert.equal(evaluateStaffPermission({ isOwner: false, granted: ['products:*'], requiredKey: 'products:write' }).allowed, true);
    assert.equal(evaluateStaffPermission({ isOwner: false, granted: ['products:*'], requiredKey: 'orders:write' }).allowed, false);
});

test('empty / non-array grants are denied (non-owner)', () => {
    assert.equal(evaluateStaffPermission({ isOwner: false, granted: [], requiredKey: 'orders:write' }).reason, 'no-grants');
    assert.equal(evaluateStaffPermission({ isOwner: false, granted: undefined as unknown as string[], requiredKey: 'orders:write' }).allowed, false);
});

// --- the safe-rollout mode gate ---

test('rbac mode defaults to dryrun (never blocks until explicitly enforced)', () => {
    assert.equal(staffRbacMode(env(undefined)), 'dryrun');
    assert.equal(staffRbacMode(env('')), 'dryrun');
    assert.equal(staffRbacMode(env('garbage')), 'dryrun');
});

test('rbac mode parses off / dryrun / enforce (case-insensitive)', () => {
    assert.equal(staffRbacMode(env('off')), 'off');
    assert.equal(staffRbacMode(env('ENFORCE')), 'enforce');
    assert.equal(staffRbacMode(env('DryRun')), 'dryrun');
});
