// One classification of every `tests/<dir>/*.test.mjs` suite, shared by the runner, the behavioral
// wrapper and the governance test that pins the partition.
//
//   postgres  a suite that stands up its own schema inside a Postgres container it is told about
//             through process.env.LETBUYY_EXECUTABLE_PG_CONTAINER. Derived from the source, not from
//             a hand-kept list, so a new suite cannot silently fall back to the shared container.
//             These run only inside owned, disposable clusters (executable-pg-fixture.mjs).
//   live      a suite that reads a LIVE, already-running Supabase database instead. It never gets an
//             owned cluster and is never pointed at one; it reports its own skip when that database
//             is absent. The list is explicit and reviewed: adding to it is a decision. It is EMPTY
//             today: the one suite that lived here (theme tenant isolation) skipped itself on every
//             machine without a Supabase stack of one particular name, and needed a role grant and an
//             auth.uid() the repository does not provide, so it builds its own database in an owned
//             cluster instead (2026-09-29). A live suite must never write to, or replace anything in,
//             the database it reads.
//   pure      everything else: needs no database.
//
// The gateway's database suites are a fourth kind and live elsewhere on purpose: every `*.test.ts` under
// services/api-gateway/src/__tests__/owned-db/. They are outside the `tests/<dir>/*.test.mjs` partition above, and
// outside the gateway's unit glob (`src/__tests__/*.test.ts` does not descend), so the fast unit lane cannot run them
// Cross-runtime/provider fixtures live under the reviewed root tests/owned-db inventory in this SAME kind.
// Root tests/owned-device remains explicit-only and is never part of database auto-discovery.
// and cannot be mistaken for full gateway acceptance. They run only through the owned-cluster runner, which gives each
// one a database cloned from a pristine, fully migrated template, a real PostgREST sidecar and an ownership check.

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

export const LIVE_EXTERNAL_SUITES = [];
export const EXPLICIT_RUNTIME_SUITES = ['tests/runtime/reel-private-r2.workerd.test.mjs'];

export const GATEWAY_DB_SUITE_DIR = 'services/api-gateway/src/__tests__/owned-db';
// These suites intentionally qualify an exact predecessor and then apply/retire
// its next migration. Newer current-stack journeys stay on the full chain.
export const HISTORICAL_GATEWAY_MIGRATION_CEILINGS = Object.freeze({
    'services/api-gateway/src/__tests__/owned-db/storefront-discovery.postgres.test.ts': 387,
    'services/api-gateway/src/__tests__/owned-db/storefront-measurement-discovery.postgres.test.ts': 388,
    'services/api-gateway/src/__tests__/owned-db/storefront-electronics-search.postgres.test.ts': 391,
    'services/api-gateway/src/__tests__/owned-db/theme-draft-cas.postgres.test.ts': 390,
    'services/api-gateway/src/__tests__/owned-db/theme-editor-template-keys.postgres.test.ts': 390,
    'services/api-gateway/src/__tests__/owned-db/pantry-variant-facts.postgres.test.ts': 387,
});

export const ROOT_GATEWAY_DB_SUITE_DIR = 'tests/owned-db';
// Explicit reviewed ownership inventory; new root suites must be registered,
// never silently admitted as pure tests or provider/runtime code.
export const ROOT_GATEWAY_DB_SUITES = [
    'tests/owned-db/ad-credit-purchase.postgres.test.ts',
    'tests/owned-db/console-current-oncall-browser.postgres.test.ts',
    'tests/owned-db/console-mfa-reset-delivery.postgres.test.ts',
    'tests/owned-db/console-mfa-reset.postgres.test.ts',
    'tests/owned-db/console-oncall-schedules-browser.postgres.test.ts',
    'tests/owned-db/console-runtime-command-history-browser.postgres.test.ts',
    'tests/owned-db/core-catalog-refresh.postgres.test.ts',
    'tests/owned-db/core-presets-browser.postgres.test.ts',
    'tests/owned-db/core-scheduled-search.postgres.test.ts',
    'tests/owned-db/core-store-bootstrap.postgres.test.ts',
    'tests/owned-db/loyalty-earn-worker.postgres.test.ts',
    'tests/owned-db/loyalty-refund-scheduler.postgres.test.ts',
    'tests/owned-db/loyalty-reversal-recovery.postgres.test.ts',
    'tests/owned-db/managed-supabase-migration-admission.postgres.test.ts',
    'tests/owned-db/merchant-collection-membership-browser.postgres.test.ts',
    'tests/owned-db/merchant-dashboard-access.postgres.test.ts',
    'tests/owned-db/merchant-entitlement-authority-browser.postgres.test.ts',
    'tests/owned-db/merchant-export.postgres.test.ts',
    'tests/owned-db/merchant-free-subscription-browser.postgres.test.ts',
    'tests/owned-db/merchant-inventory-adjustment-browser.postgres.test.ts',
    'tests/owned-db/merchant-loyalty-browser.postgres.test.ts',
    'tests/owned-db/merchant-mobile-mfa-transport.postgres.test.ts',
    'tests/owned-db/merchant-product-edit-browser.postgres.test.ts',
    'tests/owned-db/merchant-product-status-browser.postgres.test.ts',
    'tests/owned-db/merchant-public-signup-browser.postgres.test.ts',
    'tests/owned-db/merchant-push-preferences.postgres.test.ts',
    'tests/owned-db/merchant-smart-collection-preview-browser.postgres.test.ts',
    'tests/owned-db/merchant-staff-invitation-delivery.postgres.test.ts',
    'tests/owned-db/money-ledger-reconciliation-traversal.postgres.test.ts',
    'tests/owned-db/native-core-storefront-browser.postgres.test.ts',
    'tests/owned-db/payment-refund-reconciliation.postgres.test.ts',
    'tests/owned-db/payout-statement-replay.postgres.test.ts',
    'tests/owned-db/platform-job-recovery-browser.postgres.test.ts',
    'tests/owned-db/platform-job-recovery.postgres.test.ts',
    'tests/owned-db/private-reel-intake.postgres.test.ts',
    'tests/owned-db/published-storefront-recovery-browser.postgres.test.ts',
    'tests/owned-db/reel-review-revisions.postgres.test.ts',
    'tests/owned-db/storefront-access-worker.postgres.test.ts',
    'tests/owned-db/storefront-buyer-support-recovery-browser.postgres.test.ts',
    'tests/owned-db/subscription-tax-gross-conservation.postgres.test.ts',
    'tests/owned-db/worker-sql-invocation.postgres.test.ts',
];
export const isGatewayDatabaseSuite = (suite) =>
    new RegExp(`^${GATEWAY_DB_SUITE_DIR}/[^/]+\\.test\\.ts$`).test(suite) || ROOT_GATEWAY_DB_SUITES.includes(suite);

/** Same hermetic gateway-db lane, including root cross-runtime/provider fixtures.
 * Device/browser prerequisites remain explicit; owned-device is never auto-discovered.
 */
export function discoverGatewayDatabaseSuites(repoRoot) {
    function list(dir) {
        const absolute = join(repoRoot, dir);
        let prefix = repoRoot;
        for (const segment of dir.split('/')) {
            prefix = join(prefix, segment);
            let stat;
            try { stat = lstatSync(prefix); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
            if (stat.isSymbolicLink()) throw new Error(`suite directory must not be a symlink: ${dir}`);
            if (!stat.isDirectory()) throw new Error(`suite directory must be a directory: ${dir}`);
        }
        const entries = readdirSync(absolute, {withFileTypes:true});
        for (const entry of entries) {
            if (entry.name.endsWith('.test.ts') && !entry.isFile()) throw new Error(`suite must be a regular file: ${dir}/${entry.name}`);
        }
        return entries.filter(entry => entry.isFile() && entry.name.endsWith('.test.ts')).map(entry => `${dir}/${entry.name}`).sort();
    }
    const gateway = list(GATEWAY_DB_SUITE_DIR), root = list(ROOT_GATEWAY_DB_SUITE_DIR);
    if (gateway.length || existsSync(join(repoRoot, ROOT_GATEWAY_DB_SUITE_DIR))) {
        const extra = root.filter(suite => !ROOT_GATEWAY_DB_SUITES.includes(suite));
        const missing = ROOT_GATEWAY_DB_SUITES.filter(suite => !root.includes(suite));
        if (extra.length || missing.length) throw new Error(`root gateway-db inventory mismatch; unregistered: ${extra.join(', ')}; missing: ${missing.join(', ')}`);
    }
    const suites = [...gateway, ...root].sort();
    const names = suites.map(suite => basename(suite));
    if (new Set(names).size !== names.length) throw new Error('duplicate gateway-db suite basenames across owned roots');
    return suites;
}

const POSTGRES_MARKER = /process\.env\.LETBUYY_EXECUTABLE_PG_CONTAINER/;

export function discoverSuites(repoRoot, liveExternal = LIVE_EXTERNAL_SUITES) {
    if (lstatSync(join(repoRoot, 'tests')).isSymbolicLink()) throw new Error('suite directory must not be a symlink: tests');
    const gatewayDb = discoverGatewayDatabaseSuites(repoRoot);
    const all = [];
    for (const dir of readdirSync(join(repoRoot, 'tests'), { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        for (const file of readdirSync(join(repoRoot, 'tests', dir.name), { withFileTypes: true })) {
            if (file.isFile() && file.name.endsWith('.test.mjs')) {
                const suite = `tests/${dir.name}/${file.name}`;
                if (!EXPLICIT_RUNTIME_SUITES.includes(suite)) all.push(suite);
            }
        }
    }
    all.sort();

    const missingLive = liveExternal.filter((suite) => !all.includes(suite));
    if (missingLive.length > 0) {
        throw new Error(`live-external suite(s) not found on disk, the catalog is stale: ${missingLive.join(', ')}`);
    }

    const postgres = [];
    const live = [];
    const pure = [];
    for (const suite of all) {
        const usesOwnedPostgres = POSTGRES_MARKER.test(readFileSync(join(repoRoot, suite), 'utf8'));
        if (liveExternal.includes(suite)) {
            if (usesOwnedPostgres) throw new Error(`${suite} is listed as live-external but also targets the owned Postgres container`);
            live.push(suite);
        } else if (usesOwnedPostgres) {
            postgres.push(suite);
        } else {
            pure.push(suite);
        }
    }
    return { all, pure, postgres, live, gatewayDb };
}
