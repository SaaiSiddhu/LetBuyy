import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { LETBUYY_STORE_STAFF_PERMISSIONS } from '@letbuyy/auth-core';
import { LEGACY_PERMISSION_ALIASES } from '@letbuyy/permission-core';

// P2-HERMETIC-GATEWAY-DB, secondary item (the `reports:read` alias): a decision pinned as a test.
//
// The twelve permissions a store owner may give their own staff (LETBUYY_STORE_STAFF_PERMISSIONS, the keys the merchant
// app offers) are translated to canonical `resource.verb` actions by LEGACY_PERMISSION_ALIASES, which is what the target
// role backfill and the target-side shadow comparator read. Eleven of the twelve are aliased. `reports:read` is not, and
// it was deliberately left that way, for two reasons this file keeps true rather than remembered:
//
//   1. Nothing consumes it. The gateway's StaffPermissionKey does not contain it, and no route names it: the analytics
//      routes are owner-only (verifySiteOwnership), so a staff member's `reports:read` grants nothing on either the legacy
//      or the target side today. An alias would create a canonical name for a permission nothing enforces.
//   2. The canonical name is an open product decision, not a translation. The catalog has no `report.*` or `analytics.*`
//      action for the merchant-staff realm (`analytics.read` exists only as a platform-employee permission in the seed, and
//      `analytics:read` is an OAuth-style API scope on the GraphQL schema: a third vocabulary). Choosing `report.read` or
//      `analytics.read` is the owner's, together with whether staff analytics access is to exist at all.
//
// When that decision is made, this test is the thing that changes: add the alias, and route the analytics reads through
// assertStaffPermission with a StaffPermissionKey, in one change, and update the expectations below.

const gatewaySrc = join(process.cwd(), 'services/api-gateway/src');

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
        return entry.name.endsWith('.ts') ? [path] : [];
    });
}

test('every permission a store owner can grant staff has a canonical alias except reports:read', () => {
    const aliased = new Set(LEGACY_PERMISSION_ALIASES.map((alias) => alias.legacy));
    const unaliased = LETBUYY_STORE_STAFF_PERMISSIONS.filter((key) => !aliased.has(key));
    assert.deepEqual(unaliased, ['reports:read'], 'a new grantable key, or an alias for reports:read, is a decision: update this file with it');
    assert.equal(LETBUYY_STORE_STAFF_PERMISSIONS.length, 12);
    assert.equal(LETBUYY_STORE_STAFF_PERMISSIONS.length - unaliased.length, 11);
});

test('no canonical alias points at a report or analytics action yet, so an alias for reports:read has no name to take', () => {
    const canonical = LEGACY_PERMISSION_ALIASES.map((alias) => alias.canonical);
    assert.deepEqual(canonical.filter((action) => /^(report|reports|analytic|analytics)\./.test(action)), []);
});

test('nothing in the gateway enforces reports:read, on either side of the shadow comparison', () => {
    const consumers = sourceFiles(gatewaySrc)
        .filter((file) => /reports:read/.test(readFileSync(file, 'utf8')))
        .map((file) => file.slice(gatewaySrc.length + 1));
    assert.deepEqual(consumers, [], 'a route or middleware that names reports:read makes the alias a real decision');
    const analytics = readFileSync(join(gatewaySrc, 'routes/analytics.ts'), 'utf8');
    assert.match(analytics, /verifySiteOwnership/, 'the analytics routes are owner-only today');
    assert.doesNotMatch(analytics, /assertStaffPermission|evaluateStaffRequest/, 'and have no staff path');
});
