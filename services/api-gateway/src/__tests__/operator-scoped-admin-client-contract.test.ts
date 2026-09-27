// F2.6 (Phase 2) — the allowlist for the operator-permission tenant-guard bypass.
//
// getSupabaseAdminForOperatorRead returns the service-role client WITHOUT
// createTenantGuardedSupabaseClient, exactly like getSupabaseAdminUnguarded, but for a different
// shape of exception: a permission-gated, paginated, cross-site read (an operator moderation queue)
// rather than a single-row bootstrap lookup. Nothing else in the repository stops it spreading to an
// ungated route, so this file is the control, mirroring unguarded-admin-client-contract.test.ts's
// method exactly (strip comments/strings before scanning, so prose mentions cannot pass as a use).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

// The ONLY files permitted to call it. Adding an entry is a deliberate security decision: re-read
// getSupabaseAdminForOperatorRead's four documented conditions in lib/supabase.ts before doing so.
// `requiredScope` is the requirePermission(...) scope that must gate the exact route calling the
// bounded symbol; `boundedIn` names where the call is made and its request-schema page-size cap.
const ALLOWED_CALLERS: Record<string, {
    why: string;
    requiredScope: string;
    routeRegistration: string;
    boundedIn: { file: string; symbol: string; schemaLimitField: string; schemaFile: string };
}> = {
    'routes/operations/marketplace-listings.ts': {
        why: 'the operator moderation queue lists pending listings across every site by design -- narrowing to one site_id would hide every other site\'s queue from review, not make it safer',
        requiredScope: 'review:view',
        routeRegistration: "router.get('/', deps.permission('review:view')",
        boundedIn: {
            file: 'routes/operations/marketplace-listings.ts',
            symbol: 'listListings',
            schemaLimitField: 'limit: z.coerce.number().int().min(1).max(100).default(20)',
            schemaFile: 'schemas/channel-listing.schema.ts',
        },
    },
};

const NON_CALLER_EXEMPT = new Set(['lib/supabase.ts', '__tests__/operator-scoped-admin-client-contract.test.ts']);

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (entry.endsWith('.ts')) out.push(full);
    }
    return out;
}

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
    const decoy = [
        '// getSupabaseAdminForOperatorRead(c) in a line comment',
        '/* getSupabaseAdminForOperatorRead(c) in a block comment */',
        "const s = 'getSupabaseAdminForOperatorRead(c) in a string';",
        'const real = getSupabaseAdminForOperatorRead(c);',
    ].join('\n');
    const stripped = code(decoy);
    assert.equal(
        (stripped.match(/getSupabaseAdminForOperatorRead\s*\(/g) || []).length,
        1,
        'exactly the one real call should survive stripping',
    );
    assert.match(stripped, /const real = getSupabaseAdminForOperatorRead\s*\(/);
});

test('only the allowlisted files call the operator-scoped admin client', () => {
    const callers = files
        .filter((f) => !NON_CALLER_EXEMPT.has(f.rel))
        .filter((f) => /getSupabaseAdminForOperatorRead\s*\(/.test(code(f.body)))
        .map((f) => f.rel)
        .sort();
    assert.deepEqual(
        callers,
        Object.keys(ALLOWED_CALLERS).sort(),
        'a file outside the allowlist calls getSupabaseAdminForOperatorRead. This bypasses the tenant query guard on every registered tenant table -- read its four documented conditions in lib/supabase.ts and either use getSupabaseAdmin/getSupabaseAdminUnguarded or extend this allowlist deliberately.',
    );
});

test('every allowlisted route is gated by requirePermission for the declared scope before the bypass can run', () => {
    for (const [rel, entry] of Object.entries(ALLOWED_CALLERS)) {
        // Raw (un-stripped) source here, deliberately: the registration text this checks INCLUDES the
        // quoted scope literal, which code() would blank out along with every other string.
        const rawBody = files.find((f) => f.rel === rel)!.body;
        assert.ok(
            rawBody.includes(entry.routeRegistration),
            `${rel} must register its route exactly as documented (${JSON.stringify(entry.routeRegistration)}), so this test is actually looking at the gated handler`,
        );
        assert.match(
            entry.routeRegistration,
            new RegExp(`permission\\(\\s*['"]${entry.requiredScope}['"]\\s*\\)`),
            `${rel}'s route registration must call requirePermission('${entry.requiredScope}')`,
        );
    }
});

test('every allowlisted cross-site read is capped by its own request schema page size, not left unbounded', () => {
    for (const [rel, entry] of Object.entries(ALLOWED_CALLERS)) {
        const schemaHost = files.find((f) => f.rel === entry.boundedIn.schemaFile);
        assert.ok(schemaHost, `${entry.boundedIn.schemaFile} should exist`);
        assert.ok(
            code(schemaHost.body).includes(entry.boundedIn.schemaLimitField),
            `${entry.boundedIn.schemaFile} must cap the page size exactly as documented for ${rel}'s ${entry.boundedIn.symbol} (found no match for ${JSON.stringify(entry.boundedIn.schemaLimitField)}) -- an uncapped page size on a cross-site query can enumerate the whole table`,
        );
    }
});

test('the operator-scoped client is genuinely unguarded and distinct from the default guarded one', () => {
    const supabase = code(files.find((f) => f.rel === 'lib/supabase.ts')!.body);
    const operatorScoped = supabase.slice(supabase.indexOf('export function getSupabaseAdminForOperatorRead'));
    assert.doesNotMatch(
        operatorScoped.slice(0, 200),
        /createTenantGuardedSupabaseClient/,
        'getSupabaseAdminForOperatorRead must NOT apply the tenant guard -- that is its entire purpose',
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
