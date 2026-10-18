// F2.6 (Phase 2) — the allowlist for the operator-permission tenant-guard bypass.
//
// getSupabaseAdminForOperatorRead returns the service-role client WITHOUT
// createTenantGuardedSupabaseClient, exactly like getSupabaseAdminUnguarded, but for a different
// shape of exception: a permission-gated, bounded, cross-site query (an operator moderation queue,
// or an operator's own ticket dashboard) rather than a single-row bootstrap lookup. Nothing else in
// the repository stops it spreading to an ungated route, so this file is the control, mirroring
// unguarded-admin-client-contract.test.ts's method exactly (strip comments/strings before scanning,
// so prose mentions cannot pass as a use).
//
// Extended this pass (Mandate 7 follow-up) to allow MULTIPLE call sites per file: a single-route file
// (marketplace-listings.ts) and a many-routes-at-different-scopes file (operations/support.ts) are
// both real shapes, and collapsing the second into "one scope for the whole file" would either
// under-verify (checking only one of several routes) or force a false single scope. Each entry in a
// file's `calls` array is independently checked against its own route registration and its own
// boundedness -- one call site being correctly bounded never excuses another from also being checked.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

type BoundedBy =
    | { kind: 'schema-limit'; schemaFile: string; schemaLimitField: string; queryLimitExpression?: string }
    | { kind: 'fixed-query-bounds'; limits: number[]; note: string }
    | { kind: 'single-row-by-id'; note: string }
    | { kind: 'count-only'; note: string };

interface CallSite {
    requiredScope: string | null;
    routeRegistration: string;
    boundedIn: { symbol: string } & BoundedBy;
}

// The ONLY files permitted to call it, each with the ONLY call sites permitted within it. Adding a
// file or a call site is a deliberate security decision: re-read getSupabaseAdminForOperatorRead's
// four documented conditions in lib/supabase.ts before doing so.
const ALLOWED_CALLERS: Record<string, { why: string; calls: CallSite[] }> = {
    'routes/internal-console/money-reconciliation.ts': {
        why: 'The live-session payout:view gate permits the platform money-break queue. The client is used only for this paginated projection read, not mutations or ledger writes; action authority separately requires money:reconcile and independent consent.',
        calls: [{ requiredScope: 'payout:view', routeRegistration: "router.get('/reconciliation', consolePermission('payout:view')",
            boundedIn: { symbol: 'money reconciliation queue', kind: 'schema-limit', schemaFile: 'routes/internal-console/money-reconciliation.ts',
                schemaLimitField: 'limit: z.coerce.number().int().min(1).max(100).default(25)', queryLimitExpression: '.range(from, to)' } }],
    },
    'routes/internal-console.ts': {
        why: 'Merchant 360 risk records are keyed by platform entity_type/entity_id and may have no site_id. The real Console cookie/durable-session risk:view gate and merchant:pii check precede the single risk-only client; all other merchant queries retain the ordinary tenant guard.',
        calls: [{
            requiredScope: 'risk:view',
            routeRegistration: "router.get('/merchants/:id/overview', consolePermission('risk:view')",
            boundedIn: { symbol: 'Merchant 360 risk record', kind: 'fixed-query-bounds', limits: [1],
                note: 'riskDb is used only for risk_scores filtered by entity_type=site and exact resolved site.id, ordered and capped at one; the other guarded client is unchanged' },
        }],
    },
    'routes/operations/marketplace-listings.ts': {
        why: 'the operator moderation queue lists pending listings across every site by design -- narrowing to one site_id would hide every other site\'s queue from review, not make it safer',
        calls: [
            {
                requiredScope: 'review:view',
                routeRegistration: "router.get('/', deps.permission('review:view')",
                boundedIn: {
                    symbol: 'listListings',
                    kind: 'schema-limit',
                    schemaFile: 'schemas/channel-listing.schema.ts',
                    schemaLimitField: 'limit: z.coerce.number().int().min(1).max(100).default(20)',
                },
            },
        ],
    },
    'routes/operations/support.ts': {
        why: 'the platform operator\'s support-ticket dashboard and queue read and mutate tickets across every site by design (an operator\'s job is to triage tickets platform-wide, not one store at a time) -- support_tickets is a registered tenant table (site_id, requester_user_id) with no predicate these routes could correctly supply without defeating their own purpose. Every route below is already gated by requirePlatformOperator() (router-level, verifies platform-operator eligibility) AND its own requirePermission(scope) (route-level, verifies the specific action) before any query runs -- matching this function\'s condition 4 (the permission check already happened) exactly.',
        calls: [
            {
                requiredScope: 'support:view',
                routeRegistration: "router.get('/overview', requirePermission('support:view')",
                boundedIn: { symbol: 'overview aggregate counts', kind: 'count-only', note: 'every support_tickets query here uses {count:\'exact\', head:true} -- no row is ever returned, only a number, so there is nothing to enumerate' },
            },
            {
                requiredScope: 'support:view',
                routeRegistration: "router.get('/tickets', requirePermission('support:view')",
                boundedIn: { symbol: 'GET /tickets list', kind: 'schema-limit', schemaFile: 'routes/operations/support.ts', schemaLimitField: 'limit: z.coerce.number().int().min(1).max(100).default(25)' },
            },
            {
                requiredScope: 'support:view',
                routeRegistration: "router.get('/tickets/:id', requirePermission('support:view')",
                boundedIn: { symbol: 'fetchTicket via GET /tickets/:id', kind: 'single-row-by-id', note: 'fetchTicket queries .eq(\'id\', ticketId).maybeSingle() -- id is the primary key, so this can never return or touch more than the one named row regardless of tenant' },
            },
        ],
    },
    'routes/operations.ts': {
        why: 'the outbox and dead-letter queues remain super-admin-only through this router’s explicit ops/super-admin middleware; each platform-wide read is bounded by the shared 1..200 list schema',
        calls: [
            {
                requiredScope: null,
                routeRegistration: "router.get('/outbox', async (c) =>",
                boundedIn: {
                    symbol: 'outbox list',
                    kind: 'schema-limit',
                    schemaFile: 'packages/event-core/src/index.ts',
                    schemaLimitField: 'limit: z.coerce.number().int().min(1).max(200).default(50)',
                    queryLimitExpression: '.limit(query.limit)',
                },
            },
            {
                requiredScope: null,
                routeRegistration: "router.get('/outbox/dead-letters', async (c) =>",
                boundedIn: {
                    symbol: 'dead-letter list',
                    kind: 'schema-limit',
                    schemaFile: 'packages/event-core/src/index.ts',
                    schemaLimitField: 'limit: z.coerce.number().int().min(1).max(200).default(50)',
                    queryLimitExpression: '.limit(query.limit)',
                },
            },
        ],
    },
    'routes/operations/risk.ts': {
        why: 'risk overview is a bounded cross-site operator dashboard; its exact route requires risk:view and remains behind the router super-admin gate',
        calls: [
            {
                requiredScope: 'risk:view',
                routeRegistration: "router.get('/overview', requirePermission('risk:view')",
                boundedIn: {
                    symbol: 'risk overview',
                    kind: 'fixed-query-bounds',
                    limits: [25, 500, 15],
                    note: 'all four dashboard reads have fixed limits: 25 scores, 1 count-only query, 500 signals and 15 recent actions',
                },
            },
        ],
    },
    'routes/operations/trust-safety.ts': {
        why: 'trust-and-safety reads/actions require actual active platform-operator eligibility and exact per-route scopes. The private Console facade also binds its durable MFA session; public legacy auth remains independently verified.',
        calls: [
            {
                requiredScope: 'ts:view',
                routeRegistration: "router.get('/overview', requirePermission('ts:view')",
                boundedIn: {
                    symbol: 'trust-and-safety overview',
                    kind: 'fixed-query-bounds',
                    limits: [25],
                    note: 'all four dashboard reads have a fixed 25-row cap',
                },
            },
            { requiredScope:'ts:view',routeRegistration:"router.get('/cases/:id', requirePermission('ts:view')",
              boundedIn:{symbol:'trust case detail',kind:'fixed-query-bounds',limits:[100,25],
                note:'one case primary key and named case-owned collections capped100 events/evidence and25 appeals/takedowns'} },
        ],
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

test('every allowlisted call site is gated by requirePermission for its declared scope before the bypass can run', () => {
    for (const [rel, entry] of Object.entries(ALLOWED_CALLERS)) {
        const rawBody = files.find((f) => f.rel === rel)!.body;
        for (const call of entry.calls) {
            // Raw (un-stripped) source here, deliberately: the registration text this checks
            // INCLUDES the quoted scope literal, which code() would blank out along with every
            // other string.
            const routeIndex = rawBody.indexOf(call.routeRegistration);
            assert.ok(
                routeIndex >= 0,
                `${rel} must register its route exactly as documented for ${call.boundedIn.symbol} (${JSON.stringify(call.routeRegistration)}), so this test is actually looking at the gated handler`,
            );
            if (call.requiredScope) {
                assert.match(
                    call.routeRegistration,
                    // Matches both this codebase's two permission-check spellings: `deps.permission(...)`
                    // (marketplace-listings.ts) and `requirePermission(...)` (operations/support.ts).
                    new RegExp(`[Pp]ermission\\(\\s*['"]${call.requiredScope}['"]\\s*\\)`),
                    `${rel}'s route registration for ${call.boundedIn.symbol} must call a permission check for '${call.requiredScope}'`,
                );
            } else {
                const routerGate = "router.use('*', requireRoleCategory('ops'), requireSuperAdmin);";
                assert.ok(
                    rawBody.indexOf(routerGate) >= 0 && rawBody.indexOf(routerGate) < routeIndex,
                    `${rel}'s ${call.boundedIn.symbol} must be registered after the router-level ops/super-admin gate`,
                );
            }
        }
    }
});

test('every allowlisted cross-site read/write is bounded -- by an enforced page-size cap, by returning only a count, or by a primary-key predicate that can only ever touch one row -- never left open to enumerate a whole tenant table', () => {
    for (const [rel, entry] of Object.entries(ALLOWED_CALLERS)) {
        for (const call of entry.calls) {
            const boundedIn = call.boundedIn;
            if (boundedIn.kind === 'schema-limit') {
                const schemaFile: string = boundedIn.schemaFile;
                const schemaLimitField: string = boundedIn.schemaLimitField;
                const schemaHost = files.find((f) => f.rel === schemaFile)
                    || { body: readFileSync(join(SRC, '../../..', schemaFile), 'utf8') };
                assert.ok(
                    code(schemaHost.body).includes(schemaLimitField),
                    `${schemaFile} must cap the page size exactly as documented for ${rel}'s ${boundedIn.symbol} -- an uncapped page size on a cross-site query can enumerate the whole table`,
                );
                if (boundedIn.queryLimitExpression) {
                    const rawBody = files.find((f) => f.rel === rel)!.body;
                    const start = rawBody.indexOf(call.routeRegistration);
                    const nextRoute = rawBody.indexOf('\nrouter.', start + call.routeRegistration.length);
                    const handler = rawBody.slice(start, nextRoute === -1 ? undefined : nextRoute);
                    assert.ok(handler.includes(boundedIn.queryLimitExpression), `${rel}'s ${boundedIn.symbol} must apply its validated list limit to the database query`);
                }
            } else if (boundedIn.kind === 'single-row-by-id' || boundedIn.kind === 'count-only') {
                // These two kinds are bounded by construction (a primary-key equality predicate can
                // only ever match its one row; a head:true count query returns no rows at all), not
                // by a runtime-checkable schema field -- the `note` on each entry above is the
                // reviewed justification. Nothing further to assert here without re-implementing the
                // query itself; this branch exists so a THIRD, unbounded kind cannot be added
                // silently (the exhaustiveness check below catches that).
                assert.ok(boundedIn.note.length > 0, `${rel}'s ${boundedIn.symbol} must state its bounding justification`);
            } else if (boundedIn.kind === 'fixed-query-bounds') {
                const rawBody = files.find((f) => f.rel === rel)!.body;
                const start = rawBody.indexOf(call.routeRegistration);
                assert.notEqual(start, -1, `${rel}'s bounded handler must still be registered behind its exact permission`);
                const nextRoute = rawBody.indexOf('\nrouter.', start + call.routeRegistration.length);
                const handler = rawBody.slice(start, nextRoute === -1 ? undefined : nextRoute);
                for (const limit of boundedIn.limits) {
                    assert.match(handler, new RegExp(`\\.limit\\(${limit}\\)`), `${rel}'s ${boundedIn.symbol} must retain fixed .limit(${limit}) bounding`);
                }
                assert.ok(boundedIn.note.length > 0, `${rel}'s ${boundedIn.symbol} must state its bounding justification`);
            } else {
                assert.fail(`Unknown boundedIn.kind for ${rel}'s ${(boundedIn as { symbol: string }).symbol} -- add a case above, do not fall through unchecked`);
            }
        }
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
