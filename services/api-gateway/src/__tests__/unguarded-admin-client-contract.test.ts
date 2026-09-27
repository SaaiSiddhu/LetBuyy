// GW-1 — the allowlist for the tenant-guard bypass.
//
// getSupabaseAdminUnguarded returns the service-role client WITHOUT createTenantGuardedSupabaseClient,
// so every registered tenant table becomes queryable with no tenant predicate. That is correct for the
// documented bootstrap shape and catastrophic anywhere else, and nothing else in the repository would
// stop it spreading: tenant-isolation-validator matches `getSupabaseAdmin(...).from('<table>')` and has
// a known blind spot for `const db = getSupabaseAdmin(c); db.from(...)` — which is exactly how both
// existing call sites are written. This file is the control.
//
// Every scan below strips comments and string literals FIRST. Both call sites discuss the function by
// name in prose, and a test that cannot tell a mention from a use would pass on a file that only talks
// about the bypass while a real one goes unnoticed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// tsx transpiles this file to CJS, where import.meta.dirname is undefined; the repo's other
// contract tests resolve the same way.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

// The ONLY files permitted to call it, and why. Adding an entry is a deliberate security decision:
// re-read getSupabaseAdminUnguarded's four documented conditions in lib/supabase.ts before doing so.
// `boundedIn` names where this call site's reads are actually bounded. A caller may hand the
// unguarded client to a helper (internal-store-access does), so asserting boundedness inline would
// be false for the delegating shape and would quietly pass for the wrong reason.
const ALLOWED_CALLERS: Record<string, { why: string; boundedIn: { file: string; symbol: string } }> = {
    'lib/payment-route-support.ts': {
        why: 'cross-tenant payment-replay detection: a provider payment id is unique across the provider, and scoping it to one site would delete the cross-tenant protection',
        boundedIn: { file: 'lib/payment-route-support.ts', symbol: 'assertProviderPaymentNotReplayed' },
    },
    'routes/internal-store-access.ts': {
        why: 'host -> site bootstrap: the tenant is not known until the host resolves, so no scope predicate can exist yet',
        boundedIn: { file: 'middleware/store-context.ts', symbol: 'resolveStorefrontSiteByHost' },
    },
    // APPID-P4b: the same bootstrap for a buyer sign-in callback's host. Its answer only decides
    // whether a code may be sent there; the code stays bound to the buyer's session and click, the
    // exact callback and a PKCE verifier. Kept in a one-function file so this entry admits nothing else.
    'lib/storefront-callback-site.ts': {
        why: 'callback host -> site bootstrap for buyer sign-in: the store is not known until the callback host resolves',
        boundedIn: { file: 'middleware/store-context.ts', symbol: 'resolveStorefrontSiteByHost' },
    },
    // F2.6 (Phase 2): the operator moderation route's GET /:id and decide() actions look a listing up
    // by its globally-unique id before its site is known -- the same bootstrap shape as the other
    // three entries, just for a different resource.
    'routes/operations/marketplace-listings.ts': {
        why: 'operator listing-by-id lookup: a channel_listings.id is unique across every site, and the site is not known until the row returns',
        boundedIn: { file: 'routes/operations/marketplace-listings.ts', symbol: 'loadChannelListingById' },
    },
};

// Where it is DEFINED, and the test that guards it. Neither is a caller.
const NON_CALLER_EXEMPT = new Set(['lib/supabase.ts', '__tests__/unguarded-admin-client-contract.test.ts']);

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (entry.endsWith('.ts')) out.push(full);
    }
    return out;
}

// Comments and string/template literals removed, so only executable code remains. Replaced with a
// space rather than deleted so nothing on either side of a removal is accidentally joined into a
// new identifier.
function code(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "' '")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '" "')
        .replace(/`(?:[^`\\]|\\.)*`/g, '` `');
}

const files = walk(SRC).map((path) => ({
    rel: path.slice(SRC.length + 1),
    body: readFileSync(path, 'utf8'),
}));

test('the comment stripper distinguishes a mention from a use', () => {
    // Proving the instrument before trusting it: without this, an over-eager stripper that removed
    // everything would make every absence assertion below vacuously true.
    const decoy = [
        '// getSupabaseAdminUnguarded(c) in a line comment',
        '/* getSupabaseAdminUnguarded(c) in a block comment */',
        "const s = 'getSupabaseAdminUnguarded(c) in a string';",
        'const real = getSupabaseAdminUnguarded(c);',
    ].join('\n');
    const stripped = code(decoy);
    assert.equal(
        (stripped.match(/getSupabaseAdminUnguarded\s*\(/g) || []).length,
        1,
        'exactly the one real call should survive stripping',
    );
    assert.match(stripped, /const real = getSupabaseAdminUnguarded\s*\(/);
});

test('only the allowlisted files call the unguarded admin client', () => {
    const callers = files
        .filter((f) => !NON_CALLER_EXEMPT.has(f.rel))
        .filter((f) => /getSupabaseAdminUnguarded\s*\(/.test(code(f.body)))
        .map((f) => f.rel)
        .sort();
    assert.deepEqual(
        callers,
        Object.keys(ALLOWED_CALLERS).sort(),
        'a file outside the allowlist calls getSupabaseAdminUnguarded. This bypasses the tenant query guard on every registered tenant table — read its four documented conditions in lib/supabase.ts and either use getSupabaseAdmin or extend this allowlist deliberately.',
    );
});

// The body of a top-level function, from its declaration to the next top-level declaration. Anchored
// with `\n` + the exact `function <name>(` so a longer same-prefix name cannot be matched instead —
// `resolveStorefrontSiteByHost` and a hypothetical `resolveStorefrontSiteByHostAndPath` would
// otherwise collide, and `indexOf` would silently take whichever is declared first.
function functionBody(source: string, symbol: string): string {
    const declaration = new RegExp(`\\n(?:export\\s+)?(?:async\\s+)?function ${symbol}\\s*[(<]`);
    const found = declaration.exec(source);
    assert.ok(found, `${symbol} should be declared as a top-level function`);
    const rest = source.slice(found.index + 1);
    const next = /\n(?:export\s+)?(?:async\s+)?function [A-Za-z_]/.exec(rest.slice(1));
    return next ? rest.slice(0, next.index + 1) : rest;
}

test('the function-body extractor cannot be fooled by a same-prefix neighbour', () => {
    // The instrument again: a plain indexOf on 'function resolve' would take whichever declaration
    // came first, so this proves the anchor picks the exact symbol regardless of declaration order.
    const decoy = [
        'function resolveStorefrontSiteByHostAndPath(a) {',
        '  return decoyMarker;',
        '}',
        'function resolveStorefrontSiteByHost(a) {',
        '  return realMarker;',
        '}',
    ].join('\n');
    const body = functionBody(decoy, 'resolveStorefrontSiteByHost');
    assert.match(body, /realMarker/);
    assert.doesNotMatch(body, /decoyMarker/);
});

test('every read reachable from an allowlisted bypass is bounded to a single row', () => {
    for (const [rel, entry] of Object.entries(ALLOWED_CALLERS)) {
        const callerBody = code(files.find((f) => f.rel === rel)!.body);
        assert.match(callerBody, /getSupabaseAdminUnguarded\s*\(/, `${rel} should still call it`);

        const host = files.find((f) => f.rel === entry.boundedIn.file);
        assert.ok(host, `${entry.boundedIn.file} should exist`);
        const body = functionBody(code(host.body), entry.boundedIn.symbol);

        // Split on each table access: every query started inside this function must reach a bounding
        // call before the next one begins. An unbounded read here could enumerate across tenants,
        // which is precisely what the guard this bypasses exists to prevent.
        const queries = body.split(/\.from\s*\(/).slice(1);
        assert.ok(queries.length > 0, `${entry.boundedIn.symbol} should read at least one table`);
        queries.forEach((query, index) => {
            assert.match(
                query,
                /\.(limit\s*\(\s*1\s*\)|maybeSingle\s*\(\s*\)|single\s*\(\s*\))/,
                `${entry.boundedIn.file}:${entry.boundedIn.symbol} query #${index + 1} is unbounded while running on the unguarded client (reached from ${rel})`,
            );
        });
    }
});

test('the unguarded client is genuinely unguarded and the default one is genuinely guarded', () => {
    // If getSupabaseAdminUnguarded were quietly wrapped, every call site's stated reason would be
    // false and the payment replay check would resume throwing — the exact live defect GW-1 closes.
    const supabase = code(files.find((f) => f.rel === 'lib/supabase.ts')!.body);
    const unguarded = supabase.slice(supabase.indexOf('export function getSupabaseAdminUnguarded'));
    assert.doesNotMatch(
        unguarded.slice(0, 400),
        /createTenantGuardedSupabaseClient/,
        'getSupabaseAdminUnguarded must NOT apply the tenant guard — that is its entire purpose',
    );
    const guarded = supabase.slice(
        supabase.indexOf('export function getSupabaseAdminFromEnv'),
        supabase.indexOf('export function getSupabaseAdmin('),
    );
    assert.match(
        guarded,
        /createTenantGuardedSupabaseClient\s*\(/,
        'the DEFAULT admin client must still apply the tenant guard',
    );
});
