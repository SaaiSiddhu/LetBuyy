// F-HARNESS-1 — a shrinking register of executable suites that still bootstrap their own database.
//
// WHY A REGISTER AND NOT A BAN
// Converting a suite is not free: CAP-C64 records that a suite passing today may be passing BECAUSE
// of the unfaithful environment — pgcrypto in `public` makes an unqualified call resolve, a missing
// grant makes a permission probe fail. So conversion has to happen suite by suite with a re-run, and
// the honest way to track that is a list that can only get shorter.
//
// The two assertions below are what make it a ratchet rather than a comment:
//   * nothing NEW may appear — a suite added tomorrow must use the shared module;
//   * nothing may STAY once it is converted — the list must be trimmed in the same commit, so it
//     cannot quietly describe a state that no longer exists.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const executableDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'executable');

// Suites that still carry their own bootstrap. Remove a name when you convert it — do not add one.
const LEGACY_OWN_BOOTSTRAP = [
    'billing-postgres.test.mjs',
    'channel-listing-migration-realm-postgres.test.mjs',
    'checkout-postgres.test.mjs',
    'discount-postgres.test.mjs',
    'email-postgres.test.mjs',
    'foundation-reference-postgres.test.mjs',
    'foundation-wave1-money-postgres.test.mjs',
    'foundation-wave4-session-postgres.test.mjs',
    'inventory-postgres.test.mjs',
    'marketplace-channel-listings-postgres.test.mjs',
    'marketplace-listing-detail-postgres.test.mjs',
    'merchant-session-jti-consumption-postgres.test.mjs',
    'money-ledger-postgres.test.mjs',
    'notifications-postgres.test.mjs',
    'observability-analytics-media-postgres.test.mjs',
    'order-postgres.test.mjs',
    'payment-postgres.test.mjs',
    'security-postgres.test.mjs',
    'security-rls-hardening-postgres.test.mjs',
    'settlement-postgres.test.mjs',
    'shipping-postgres.test.mjs',
    'tax-postgres.test.mjs',
    'tenant-redteam-postgres.test.mjs',
    'theme-liquid-activation-postgres.test.mjs',
    'whatsapp-postgres.test.mjs',
];

// Permanent, for a stated reason rather than by omission: this suite exists to prove the DIFFERENCE
// between the two schema layouts, so it deliberately builds one database each way. Using the shared
// module for both halves would delete the thing it tests.
const PERMANENT_EXCEPTIONS = [
    'extension-schema-qualification-postgres.test.mjs',
];

function suiteNames() {
    return readdirSync(executableDir).filter((n) => n.endsWith('.test.mjs')).sort();
}

function bootstrapsItsOwnDatabase(name) {
    const source = readFileSync(join(executableDir, name), 'utf8');
    return source.includes('CREATE EXTENSION') && !source.includes('SUPABASE_FAITHFUL_BOOTSTRAP_SQL');
}

test('no NEW executable suite may bootstrap its own database', () => {
    const allowed = new Set([...LEGACY_OWN_BOOTSTRAP, ...PERMANENT_EXCEPTIONS]);
    const unexpected = suiteNames().filter((n) => bootstrapsItsOwnDatabase(n) && !allowed.has(n));
    assert.deepEqual(
        unexpected,
        [],
        "import SUPABASE_FAITHFUL_BOOTSTRAP_SQL from './supabase-faithful-bootstrap.mjs' instead. A " +
        'bespoke bootstrap is how pgcrypto ended up in the wrong schema in sixteen files, which kept ' +
        'the gift-card outage invisible from baseline to migration 215.',
    );
});

test('the legacy register may only shrink — a converted suite must be removed from it', () => {
    const stale = LEGACY_OWN_BOOTSTRAP.filter((n) => !bootstrapsItsOwnDatabase(n));
    assert.deepEqual(
        stale,
        [],
        'these suites no longer bootstrap their own database; delete them from LEGACY_OWN_BOOTSTRAP ' +
        'in the same commit that converted them, so the register never overstates the work remaining',
    );
});

test('every registered name exists, so the register cannot decay into fiction', () => {
    const names = new Set(suiteNames());
    const missing = [...LEGACY_OWN_BOOTSTRAP, ...PERMANENT_EXCEPTIONS].filter((n) => !names.has(n));
    assert.deepEqual(missing, [], 'a renamed or deleted suite must be removed from these lists');
});

test('the shared module carries all three fidelity fixes', () => {
    // If any of these is edited away, every suite that imports it silently reverts to the harness
    // that hid three production defects — so assert them here rather than trusting the module.
    const module = readFileSync(join(executableDir, 'supabase-faithful-bootstrap.mjs'), 'utf8');
    assert.match(module, /CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions/);
    assert.match(module, /ALTER DATABASE %I SET search_path = public, extensions/);
    assert.match(module, /ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role/);
    assert.match(module, /ALTER ROLE service_role NOLOGIN BYPASSRLS/);
    // And it must NOT reinstate the shim that made the old bootstrap look faithful while it was not.
    assert.doesNotMatch(module, /CREATE FUNCTION extensions\.gen_random_bytes\(integer\) RETURNS/);
});
