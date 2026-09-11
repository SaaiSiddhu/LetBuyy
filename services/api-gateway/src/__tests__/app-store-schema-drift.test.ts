// F-DRIFT-1 — the app-store column-drift predicate must not treat an unrelated error as schema drift.
//
// `routes/app-store.ts` calls isMissingColumnError at five sites (group_name, built_for_letbuyy,
// supported_site_types) and DROPS the column from its select when it returns true. The predicate used
// to return true for any error whose text merely mentioned the column name, so a permission denial or
// a constraint violation naming one of those columns silently degraded the response instead of
// surfacing. Twelve other definitions of this predicate in the gateway require the column name AND a
// drift-shaped phrase; this file pins app-store to the same semantics.

import assert from 'node:assert/strict';
import test from 'node:test';
import { isMissingColumnError, missingColumnFromError } from '../routes/app-store/schema-drift';
import { isMissingColumnError as canonicalIsMissingColumnError } from '../lib/order-read-compat';

const err = (message: string) => ({ message });

test('a genuine drift error is still detected', () => {
    assert.equal(isMissingColumnError(err('column app_categories.group_name does not exist'), 'group_name'), true);
    assert.equal(isMissingColumnError(err("Could not find the 'built_for_letbuyy' column of 'apps'"), 'built_for_letbuyy'), true);
    assert.equal(isMissingColumnError(err('supported_site_types not in schema cache'), 'supported_site_types'), true);
});

test('an UNRELATED error that merely names the column is no longer treated as drift', () => {
    // Each of these mentions the column and would have returned true before F-DRIFT-1, causing the
    // route to drop the column and retry rather than report the real failure.
    for (const message of [
        'permission denied for column group_name',
        'new row for relation "apps" violates check constraint "apps_group_name_check"',
        'invalid input syntax for type boolean: built_for_letbuyy',
        'null value in column "supported_site_types" violates not-null constraint',
    ]) {
        const column = ['group_name', 'built_for_letbuyy', 'supported_site_types']
            .find((c) => message.includes(c))!;
        assert.equal(
            isMissingColumnError(err(message), column),
            false,
            `must not read as missing-column drift: ${message}`,
        );
    }
});

test('a drift error about a DIFFERENT column does not match this one', () => {
    assert.equal(isMissingColumnError(err('column apps.group_name does not exist'), 'built_for_letbuyy'), false);
});

test('null and empty errors are not drift', () => {
    assert.equal(isMissingColumnError(null, 'group_name'), false);
    assert.equal(isMissingColumnError(undefined, 'group_name'), false);
    assert.equal(isMissingColumnError(err(''), 'group_name'), false);
});

test('the precise parse is kept — it is stricter than the majority predicate, not looser', () => {
    // missingColumnFromError extracts the column from the message; an exact match is conclusive and
    // is why this predicate can be at least as precise as the twelve it now agrees with.
    assert.equal(missingColumnFromError(err('column apps.group_name does not exist')), 'group_name');
    assert.equal(isMissingColumnError(err('column apps.group_name does not exist'), 'group_name'), true);
});

test('PARITY: app-store now agrees with the canonical predicate on every case', () => {
    // The point of the fix: one family, one meaning. If these ever diverge again this fails and names
    // the input that split them.
    const cases: Array<[string, string]> = [
        ['column app_categories.group_name does not exist', 'group_name'],
        ["Could not find the 'built_for_letbuyy' column of 'apps'", 'built_for_letbuyy'],
        ['supported_site_types not in schema cache', 'supported_site_types'],
        ['permission denied for column group_name', 'group_name'],
        ['violates check constraint "apps_group_name_check"', 'group_name'],
        ['invalid input syntax for type boolean: built_for_letbuyy', 'built_for_letbuyy'],
        ['column apps.group_name does not exist', 'built_for_letbuyy'],
        ['', 'group_name'],
    ];
    for (const [message, column] of cases) {
        assert.equal(
            isMissingColumnError(err(message), column),
            canonicalIsMissingColumnError(err(message), column),
            `app-store and lib/order-read-compat disagree on (${JSON.stringify(message)}, ${column})`,
        );
    }
});
