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
// and cannot be mistaken for full gateway acceptance. They run only through the owned-cluster runner, which gives each
// one a database cloned from a pristine, fully migrated template, a real PostgREST sidecar and an ownership check.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const LIVE_EXTERNAL_SUITES = [];

export const GATEWAY_DB_SUITE_DIR = 'services/api-gateway/src/__tests__/owned-db';
export const isGatewayDatabaseSuite = (suite) => suite.startsWith(`${GATEWAY_DB_SUITE_DIR}/`) && suite.endsWith('.test.ts');

/** Every gateway database suite, sorted; empty when the directory does not exist. */
export function discoverGatewayDatabaseSuites(repoRoot) {
    const dir = join(repoRoot, GATEWAY_DB_SUITE_DIR);
    let entries = [];
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
        .map((entry) => `${GATEWAY_DB_SUITE_DIR}/${entry.name}`)
        .sort();
}

const POSTGRES_MARKER = /process\.env\.LETBUYY_EXECUTABLE_PG_CONTAINER/;

export function discoverSuites(repoRoot, liveExternal = LIVE_EXTERNAL_SUITES) {
    const all = [];
    for (const dir of readdirSync(join(repoRoot, 'tests'), { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        for (const file of readdirSync(join(repoRoot, 'tests', dir.name), { withFileTypes: true })) {
            if (file.isFile() && file.name.endsWith('.test.mjs')) all.push(`tests/${dir.name}/${file.name}`);
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
    return { all, pure, postgres, live, gatewayDb: discoverGatewayDatabaseSuites(repoRoot) };
}
