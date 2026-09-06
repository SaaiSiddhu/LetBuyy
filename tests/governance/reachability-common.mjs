// Shared machinery for the two reachability guards — money-rpc-reachability.test.mjs (functions) and
// table-reachability.test.mjs (tables). Extracted deliberately rather than copied: both need the same
// answer to "what counts as application source, and what counts as a reference", and two drifting
// copies of that answer would mean two guards enforcing subtly different rules.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const migrationsDir = join(repoRoot, 'database/supabase/migrations');

// This programme's own work. Earlier migrations are a different question — the baseline alone defines
// hundreds of objects, most of them triggers and helpers with no application caller by design.
export const FIRST_GOVERNED_MIGRATION = 217;

export function numericPrefix(name) {
    const m = /^(\d+)/.exec(name);
    return m ? Number(m[1]) : -1;
}

export function migrationFiles() {
    return readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort((a, b) => numericPrefix(a) - numericPrefix(b));
}

export const stripTsComments = (s) => s.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
export const stripSqlComments = (s) => s.replace(/--[^\n]*/g, ' ');

// Application source: tracked, non-test, and NOT the generated tenant registry.
//
// Excluding the registry is load-bearing rather than tidy. `tenant-tables.registry.ts` is generated
// from the migrations and names every tenant table, so counting it as a reference would make the
// table guard vacuous for precisely the tables it most needs to check — every tenant table would be
// "reachable" the moment it existed.
export function applicationSources() {
    return execFileSync('git', ['ls-files', 'services', 'apps', 'packages'], {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
    })
        .split('\n')
        .filter((p) => /\.(ts|tsx|mjs|cjs)$/.test(p))
        .filter((p) => !/__tests__|\/test\/|\.test\./.test(p))
        .filter((p) => !/tenant-tables\.registry\.ts$/.test(p))
        .map((path) => {
            try {
                return { path, text: stripTsComments(readFileSync(join(repoRoot, path), 'utf8')) };
            } catch {
                return { path, text: '' };
            }
        });
}

export function migrationBodies() {
    return migrationFiles().map((file) => ({
        file,
        text: stripSqlComments(readFileSync(join(migrationsDir, file), 'utf8')),
    }));
}

// A reference in application source, in every shape this codebase actually uses.
//
// Three hand-written sweeps of this question each failed differently (F-GOV-RPC-1): counting bare
// mentions read a comment explaining an absence as coverage; requiring `public.<name>(` missed
// callers that build SQL as `public.${CONST}(`; requiring a quoted literal missed names that appear
// only inside raw SQL strings. Only the union is correct.
export function referencesIn(sources, name) {
    const quoted = new RegExp(`['"\`]${name}['"\`]`);
    const qualified = new RegExp(`public\\.${name}\\b`);
    return sources.filter(({ text }) => quoted.test(text) || qualified.test(text)).map(({ path }) => path);
}

// Every exemption must say WHY and name the decision or phase that removes it. An exemption without
// a named blocker is a TODO with better formatting, and it never expires.
export function assertExemptionIsWellFormed(assert, name, exemption) {
    assert.ok(exemption.blockedOn, `${name}'s exemption must name the decision or phase that unblocks it`);
    assert.ok(
        typeof exemption.why === 'string' && exemption.why.length > 40,
        `${name}'s exemption must say why, not merely that`,
    );
}
