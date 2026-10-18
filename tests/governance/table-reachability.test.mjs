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
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
    FIRST_GOVERNED_MIGRATION,
    applicationSources,
    assertExemptionIsWellFormed,
    migrationFiles,
    migrationBodies,
    migrationsDir,
    numericPrefix,
    referencesIn,
    stripSqlComments,
} from './reachability-common.mjs';

// Each exemption states why the table is legitimately untouched by application code, and what
// removes the exemption.
const EXEMPT = {
    console_magic_link_consumptions: {
        why: 'single-use magic-link evidence is written atomically with the durable operator session '
            + 'inside exchange_identity_console_magic_v1 (332), called by the canonical Gateway '
            + 'accounts-only operator exchange. Direct runtime writes would split the transaction',
        blockedOn: 'nothing: the narrow exchange RPC is the intended writer; real browser and owned DB proof cover replay and audit failure',
        viaRpc: 'exchange_identity_console_magic_v1',
    },
    internal_auth_replay_claims: {
        why: 'private single-use JTI storage is read/written only by consume_internal_auth_replay_jti (307), '
            + 'called by the canonical Gateway replay consumer in src/lib/supabase.ts. Direct API-role table access '
            + 'is revoked; the owned operator replay suite proves concurrency, outage recovery and rollback',
        blockedOn: 'nothing: the narrow claim RPC is its intended access path',
        viaRpc: 'consume_internal_auth_replay_jti',
    },
    product_price_observations: {
        why: 'trigger-owned historical price records are read through product_price_reference_window, called '
            + 'by the actual public storefront and marketplace routes. Direct runtime writes would falsify the '
            + 'historical observations. The owned price-observation suite proves channel, time-window and ACL behavior',
        blockedOn: 'nothing: the read projection and observation triggers are the intended access paths',
        viaRpc: 'product_price_reference_window',
    },
    support_mutation_receipts: {
        why: 'written and replayed only inside execute_operator_support_mutation (265), called by '
            + 'services/api-gateway/src/execution/support-execution.adapter.ts. Separate application '
            + 'writes would break atomicity. The owned operator-mutation-integrity suite proves '
            + 'durable replay, concurrency and rollback after receipt completion failure',
        blockedOn: 'nothing: the transactional support function is its intended reader and writer',
    },
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
    buyer_authorization_codes: {
        why: 'holds the hashes of first-party sign-in codes, and only its own functions touch it: '
            + 'issue_buyer_authorization_code and redeem_buyer_authorization_code (258), which the gateway '
            + 'calls from services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts. The table is wired; '
            + 'application code reading it directly would be the defect',
        blockedOn: 'nothing: its functions are its only intended readers and writers',
    },
    buyer_firebase_links: {
        why: 'maps a Firebase uid to the buyer who proved the same verified address, and only its own function '
            + 'touches it: link_buyer_firebase_uid (259), which the gateway calls from '
            + 'services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts behind POST /buyer/firebase-link. '
            + 'The table is wired; it is read by FB-4 when each screen\'s Firestore data moves to its buyer',
        blockedOn: 'nothing: its function is its only intended writer until FB-4, and the table is dropped at FB-5',
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

test('reachability includes genuine untracked candidate source without counting tests or generated registries', () => {
    const path=`services/api-gateway/src/lib/reachability-fixture-${randomUUID()}.mjs`;
    const absolute=join(migrationsDir,'../../../',path);
    let created=false;
    try {
        writeFileSync(absolute,"export const readSynthetic = db => db.from('synthetic_reachability_table');\n",{flag:'wx'});
        created=true;
        assert.deepEqual(referencesIn(applicationSources(),'synthetic_reachability_table'),[path]);
    } finally { if(created)unlinkSync(absolute); }
});

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
            if(exemption.viaRpc) {
                assert.ok(referencesIn(sources,exemption.viaRpc).length>0,
                    `${name}'s private access RPC must remain called by actual application source`);
                let latestBody;
                for(const migration of migrationBodies()) {
                    const pattern=new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${exemption.viaRpc}\\s*\\([\\s\\S]*?\\bAS\\s+(\\$[a-z_]*\\$)([\\s\\S]*?)\\1`,'gi');
                    for(const definition of migration.text.matchAll(pattern)) latestBody=definition[2];
                }
                assert.ok(latestBody && referencesIn([{path:exemption.viaRpc,text:latestBody}],name).length>0,
                    `${name}'s latest RPC definition must actually access the private table`);
            }
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
