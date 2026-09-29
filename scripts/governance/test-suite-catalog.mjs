// One classification of every `tests/<dir>/*.test.mjs` suite, shared by the runner, the behavioral
// wrapper and the governance test that pins the partition.
//
//   postgres  a suite that stands up its own schema inside a Postgres container it is told about
//             through process.env.LETBUYY_EXECUTABLE_PG_CONTAINER. Derived from the source, not from
//             a hand-kept list, so a new suite cannot silently fall back to the shared container.
//             These run only inside owned, disposable clusters (executable-pg-fixture.mjs).
//   live      a suite that reads a LIVE, already-running Supabase database instead. It never gets an
//             owned cluster and is never pointed at one; it reports its own skip when that database
//             is absent. The list is explicit and reviewed: adding to it is a decision.
//   pure      everything else: needs no database.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const LIVE_EXTERNAL_SUITES = ['tests/security/theme-tenant-isolation.test.mjs'];

const POSTGRES_MARKER = /process\.env\.LETBUYY_EXECUTABLE_PG_CONTAINER/;

export function discoverSuites(repoRoot) {
    const all = [];
    for (const dir of readdirSync(join(repoRoot, 'tests'), { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        for (const file of readdirSync(join(repoRoot, 'tests', dir.name), { withFileTypes: true })) {
            if (file.isFile() && file.name.endsWith('.test.mjs')) all.push(`tests/${dir.name}/${file.name}`);
        }
    }
    all.sort();

    const missingLive = LIVE_EXTERNAL_SUITES.filter((suite) => !all.includes(suite));
    if (missingLive.length > 0) {
        throw new Error(`live-external suite(s) not found on disk, the catalog is stale: ${missingLive.join(', ')}`);
    }

    const postgres = [];
    const live = [];
    const pure = [];
    for (const suite of all) {
        const usesOwnedPostgres = POSTGRES_MARKER.test(readFileSync(join(repoRoot, suite), 'utf8'));
        if (LIVE_EXTERNAL_SUITES.includes(suite)) {
            if (usesOwnedPostgres) throw new Error(`${suite} is listed as live-external but also targets the owned Postgres container`);
            live.push(suite);
        } else if (usesOwnedPostgres) {
            postgres.push(suite);
        } else {
            pure.push(suite);
        }
    }
    return { all, pure, postgres, live };
}
