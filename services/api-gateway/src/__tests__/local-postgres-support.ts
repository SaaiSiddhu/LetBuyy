// Shared real-local-Postgres test support (D03 Section 12, 2026-09-28).
//
// Every *.postgres.test.ts file independently duplicated its own copy of "find the local Supabase
// Postgres container and shell out to psql" -- and every copy hardcoded the SAME machine-specific
// container name (`supabase_db_letbuyy-newmac-20260926`) as its fallback. That string has already gone
// stale and broken this suite once this same pass (the container-rename fix that preceded this file,
// committed earlier: 5 files silently reporting real assertions as passed while actually never
// reaching Postgres at all, because `docker exec <stale-name>` fails and every caller's own catch
// swallowed it into a false "skip" or an unrelated-looking failure). A second, differently shaped copy
// of the identical hardcoded string exists in five more, non-D03 test files
// (merchant-tenant-predicate.test.ts and friends) -- deliberately left alone here: they are unrelated
// to staff-mutation/shadow-runtime, already passing, and out of this phase's scope; rewriting them
// risks an unrelated regression for no requirement this mandate names. Centralizing the fix for the
// four D03/real-database rehearsal files this pass actually depends on means a future rename breaks
// once, in one place, with a clear cause -- not four (or nine) more silent, differently-shaped copies
// of the same bug to rediscover by hand.
//
// "Positively identify the owned local/test database, reject hosted/unrelated endpoints" is enforced
// two ways, matching the mandate's own phrasing:
//   1. readLocalSupabaseConfig requires `.dev.vars`' own SUPABASE_URL to resolve to a
//      localhost/127.0.0.1/::1 origin -- unchanged from every file that already had this check.
//   2. resolveLocalSupabaseContainer never falls back to a fixed, machine-specific slug. An explicit
//      LETBUYY_LOCAL_SUPABASE_CONTAINER env var, when set, is trusted outright (the caller has told us
//      directly). Otherwise the container is discovered by the Supabase CLI's OWN container-naming
//      convention (`supabase_db_<project-id>`), never guessed at by any other means -- and discovery
//      requires EXACTLY ONE running match. Zero or more than one is refused (null): a test using this
//      helper then SKIPS cleanly (t.skip, never a silent false pass or a misleading failure) rather
//      than guessing at, or silently targeting, the wrong database.
//
// No secret is ever logged by anything in this file: SUPABASE_SERVICE_ROLE_KEY is read and returned
// for the caller's own use, never printed; psql() output is returned to the caller, not logged here.
// Nothing here performs, or authorizes, any Docker cleanup beyond the single read-only `docker exec
// <container> true` reachability probe and the caller's own SQL.

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export interface LocalSupabaseConfig {
    url: string;
    serviceRoleKey: string;
}

/** Reads `.dev.vars` at the given URL (pass `new URL('../../.dev.vars', import.meta.url)` from the
 *  calling test file so the path resolves relative to THAT file, matching every existing caller) and
 *  returns its Supabase config only when SUPABASE_URL is genuinely local. Returns null for a missing
 *  file, missing values, an unparseable URL, or ANY non-local hostname -- a hosted/unrelated endpoint
 *  must never be treated as the owned local test database. */
export function readLocalSupabaseConfig(devVarsUrl: URL): LocalSupabaseConfig | null {
    if (!existsSync(devVarsUrl)) return null;
    const devVars = readFileSync(devVarsUrl, 'utf8');
    const url = devVars.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim();
    const serviceRoleKey = devVars.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();
    if (!url || !serviceRoleKey) return null;
    let hostname = '';
    try { hostname = new URL(url).hostname.toLowerCase(); } catch { return null; }
    return ['localhost', '127.0.0.1', '::1'].includes(hostname) ? { url, serviceRoleKey } : null;
}

let cachedContainer: string | null | undefined;

/** Positively identifies the owned local Supabase Postgres container -- see the file header. Cached
 *  for the life of the process: the answer cannot change mid-run, and this is called once per `psql()`
 *  invocation across every file that imports it. */
export function resolveLocalSupabaseContainer(): string | null {
    if (cachedContainer !== undefined) return cachedContainer;

    const explicit = process.env.LETBUYY_LOCAL_SUPABASE_CONTAINER?.trim();
    if (explicit) {
        cachedContainer = explicit;
        return cachedContainer;
    }

    try {
        const names = execFileSync(
            'docker',
            ['ps', '--format', '{{.Names}}', '--filter', 'name=^supabase_db_'],
            { encoding: 'utf8', timeout: 5000 },
        )
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        // Exactly one match is a positive identification; zero or an ambiguous multiple is refused
        // rather than guessed at (a second local Supabase project's db container would also match this
        // prefix, and this helper has no basis to prefer one over the other).
        cachedContainer = names.length === 1 ? names[0] : null;
    } catch {
        cachedContainer = null;
    }
    return cachedContainer;
}

/** Read-only reachability probe for the resolved container -- never a Docker mutation. */
export function isLocalPostgresReachable(container: string | null): boolean {
    if (!container) return false;
    try {
        execFileSync('docker', ['exec', container, 'true'], { stdio: 'ignore', timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

/** Runs `sql` (one or more statements, `ON_ERROR_STOP=1`) against the resolved container via stdin.
 *  Returns the trimmed output, or null on any failure (unreachable container, SQL error, no container
 *  resolved at all) -- callers that need to tell "no container" apart from "a real SQL error" should
 *  check `resolveLocalSupabaseContainer()`/`isLocalPostgresReachable()` themselves first, matching the
 *  existing convention every caller of this shape already follows. */
export function psql(container: string | null, sql: string): string | null {
    if (!container) return null;
    try {
        return execFileSync(
            'docker',
            ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'],
            { input: sql, encoding: 'utf8' },
        ).trim();
    } catch {
        return null;
    }
}
