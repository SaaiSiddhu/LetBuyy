import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    evaluateStaffPermission,
    staffRbacMode,
} from '../middleware/staff-permission';
import type { Env } from '../index';

const env = (mode?: string, environment = 'staging') => ({ MERCHANT_STAFF_RBAC_MODE: mode, ENVIRONMENT: environment } as unknown as Env);

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

// APPID-P5b: the guard fails closed. It enforces unless a dry run is asked for outside production.
test('rbac mode enforces by default, and for anything it does not recognise, including the old "off"', () => {
    assert.equal(staffRbacMode(env(undefined)), 'enforce');
    assert.equal(staffRbacMode(env('')), 'enforce');
    assert.equal(staffRbacMode(env('garbage')), 'enforce');
    assert.equal(staffRbacMode(env('off')), 'enforce');
    assert.equal(staffRbacMode(env('ENFORCE')), 'enforce');
});

test('a dry run is honoured outside production only', () => {
    assert.equal(staffRbacMode(env('DryRun', 'staging')), 'dryrun');
    assert.equal(staffRbacMode(env('dryrun', 'test')), 'dryrun');
    assert.equal(staffRbacMode(env('dryrun', 'production')), 'enforce');
    assert.equal(staffRbacMode(env('dryrun', ' Production ')), 'enforce');
});
