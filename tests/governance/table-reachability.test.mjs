// F-GOV-TBL-1 — a table this programme created that nothing in the application reads or writes.
//
// The sibling of money-rpc-reachability.test.mjs, and the other half of the same failure mode. That
// guard catches an RPC nothing calls; this catches a TABLE nothing touches. `loyalty_programs` is the
// worked example: the table, its ledger, both money RPCs and the checkout wiring all existed while
// nothing in the application could write a single row, so loyalty was complete and impossible to
// enable. Nothing failed. `marketplace_trending_searches` could have shipped the same way.
//
// The generated tenant registry is excluded from the sources — see reachability-common.mjs, where
// that exclusion is explained. Without it this guard would be vacuous for every tenant table.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    FIRST_GOVERNED_MIGRATION,
    applicationSources,
    assertExemptionIsWellFormed,
    migrationFiles,
    migrationsDir,
    numericPrefix,
    referencesIn,
    stripSqlComments,
} from './reachability-common.mjs';

// Each exemption states why the table is legitimately untouched by application code, and what
// removes the exemption.
const EXEMPT = {
    purchases: {
        why: 'written by create_checkout_order in SQL and deliberately unreadable by merchants '
            + '(D-PURCHASE-TENANCY: FORCE RLS with app_tenant revoked outright). While D-3 keeps '
            + 'single-merchant enforced, one purchase is exactly one order, so a reader would show '
            + 'what the order already shows',
        blockedOn: 'D-3 (the multi-merchant flag, which is what gives the parent something to say)',
    },
    migration_privilege_journal: {
        why: 'rollback evidence, not application data: migration 256 records every EXECUTE privilege it '
            + 'changes here before changing it, and only 256\'s rollback reads it back. PUBLIC, anon, '
            + 'authenticated and app_tenant are revoked from it',
        blockedOn: 'nothing in the application should ever read it; the table is dropped by 256\'s rollback',
    },
    buyer_email_challenges: {
        why: 'holds the salted hashes of buyer one-time email codes, and only its own functions touch it: '
            + 'start_buyer_email_challenge and consume_buyer_email_challenge (257), which the gateway calls '
            + 'from services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts. The table is wired; '
            + 'application code reading it directly would be the defect',
        blockedOn: 'nothing: its functions are its only intended readers and writers',
    },
};

function governedTables() {
    const found = new Map();
    for (const file of migrationFiles()) {
        if (numericPrefix(file) < FIRST_GOVERNED_MIGRATION) continue;
        const source = stripSqlComments(readFileSync(join(migrationsDir, file), 'utf8'));
        const pattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z0-9_]+)/gi;
        let match;
        while ((match = pattern.exec(source))) {
            if (!found.has(match[1])) found.set(match[1], file);
        }
    }
    return [...found.entries()].sort(([a], [b]) => a.localeCompare(b));
}

const sources = applicationSources();
const governed = governedTables();

test('the sweep actually found this programme\'s tables', () => {
    // Non-vacuity: a sweep that matched nothing would pass every assertion below.
    assert.ok(governed.length >= 15, `expected the 217+ tables, found ${governed.length}`);
    const names = governed.map(([n]) => n);
    for (const expected of ['channel_listings', 'loyalty_programs', 'ad_campaigns', 'buyer_accounts']) {
        assert.ok(names.includes(expected), `${expected} must be in scope`);
    }
});

test('the generated tenant registry is not counted as a reference', () => {
    // If this ever stops holding, every tenant table becomes trivially reachable and the guard below
    // is decoration. Asserted directly rather than trusted to the helper.
    assert.equal(
        sources.filter(({ path }) => /tenant-tables\.registry\.ts$/.test(path)).length,
        0,
        'the generated registry names every tenant table and must not count as application use',
    );
    // And the registry really does name them, so the exclusion is doing work rather than guarding a
    // file that would not have matched anyway.
    const registry = readFileSync(
        join(migrationsDir, '..', '..', '..', 'services/api-gateway/src/tenant/tenant-tables.registry.ts'),
        'utf8',
    );
    assert.match(registry, /"table": "loyalty_ledger_entries"/, 'the registry does list this programme\'s tables');
});

for (const [name, file] of governed) {
    const exemption = EXEMPT[name];
    const users = referencesIn(sources, name);

    if (exemption) {
        test(`${name} is exempt, and the exemption is still true`, () => {
            // A stale exemption is worse than none: it is a standing waiver for a gap that has since
            // been closed, and it would hide the next one.
            assert.equal(
                users.length,
                0,
                `${name} is now used (${users.join(', ')}) — remove its exemption rather than leaving a waiver`,
            );
            assertExemptionIsWellFormed(assert, name, exemption);
        });
        continue;
    }

    test(`${name} (created by ${file}) is reached by application code`, () => {
        assert.ok(
            users.length > 0,
            `${name} is a table nothing in the application reads or writes. DDL wired to nothing is `
            + `this programme's named failure mode — loyalty_programs shipped exactly this way. Either `
            + `wire it, or add it to EXEMPT with a reason and the decision that unblocks it.`,
        );
    });
}

test('every exemption names a table that actually exists', () => {
    const names = new Set(governed.map(([n]) => n));
    for (const name of Object.keys(EXEMPT)) {
        assert.ok(names.has(name), `${name} is exempted but no governed migration creates it — stale entry`);
    }
});
