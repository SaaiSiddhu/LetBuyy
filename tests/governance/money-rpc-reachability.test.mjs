// F-GOV-RPC-1 — a SECURITY DEFINER RPC that nothing calls is a gate failure.
//
// WHY. "DDL exists, wiring is dead" is this programme's named failure mode, and it has been a REAL
// defect three times, found by hand every time: award_loyalty_points had no caller (F-LOY-2),
// loyalty_programs had no writer at all (F-LOY-3), and both ad-credit RPCs had none (F-ADS-2). Each
// time the money path looked complete and could not be reached.
//
// WHY THE SWEEP IS SHAPED LIKE THIS. Three hand-written passes over this exact question each returned
// a WRONG answer, in a different direction:
//   1. counting MENTIONS of the name reported record_ad_credit_purchase as covered — the only text
//      naming it is routes/ads.ts's comment explaining why it has no caller;
//   2. requiring `public.<name>(` missed allocate_ad_campaign_budget and set_loyalty_program, whose
//      callers build SQL as `public.${CONST}(`, so the name is never adjacent to `public.`;
//   3. requiring a QUOTED literal then missed ad_campaign_spent_minor and loyalty_outstanding_points,
//      which are called inside raw SQL strings and never quoted.
// Only the union is correct. And redeem_loyalty_points is reachable ONLY from SQL —
// create_checkout_order calls it — so a TypeScript-only sweep is wrong by construction.
//
// SCOPE: SECURITY DEFINER functions introduced at migration 217 or later, which is this programme's
// own work. Trigger functions are excluded: they are invoked by the database and have no caller by
// design. The ~400 baseline functions are a different question and mostly triggers.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationsDir = join(root, 'database/supabase/migrations');
const FIRST_GOVERNED_MIGRATION = 217;

// The canonical money RPCs CLAUDE.md names. They predate 217 — create_checkout_order goes back to
// 073 — so the migration-rank rule alone would leave the most important functions in the schema
// ungoverned by this guard. They are all reachable today, so adding them costs nothing and means the
// guard covers the money path proper rather than only this programme's additions. Including all ~400
// baseline functions instead would be a different question and mostly triggers.
const ALSO_GOVERNED = [
    'create_checkout_order',
    'confirm_order_payment_with_ledger',
    'complete_order_refund',
    'issue_gift_card',
    'set_gift_card_status',
    'restore_gift_card_on_refund',
    'issue_gst_invoice',
];

// Each exemption states WHY it cannot be reachable yet and WHICH decision unblocks it. An exemption
// without a named blocker is a TODO with better formatting.
const EXEMPT = {
    record_ad_credit_purchase: {
        why: 'a merchant cannot buy ad credits yet: Razorpay verification here is bound to `orders` and '
            + 'fails closed unless orders.payment_id matches the provider order id, so wiring it means '
            + 'inventing an orders row for a platform charge, building a second verification path '
            + '(which migration 232 forbids), or riding billing\'s mandate model',
        blockedOn: 'D-PLATFORM-CHARGE',
    },
};

function numericPrefix(name) {
    const m = /^(\d+)/.exec(name);
    return m ? Number(m[1]) : -1;
}

const migrations = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => numericPrefix(a) - numericPrefix(b));

// name -> { firstFile, isTrigger }
function governedFunctions() {
    const found = new Map();
    for (const file of migrations) {
        const source = readFileSync(join(migrationsDir, file), 'utf8');
        const pattern = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)\s*\(/gi;
        let match;
        while ((match = pattern.exec(source))) {
            const name = match[1];
            // A generous window: enough to reach RETURNS and the SECURITY clause past a long
            // parameter list, but bounded so it cannot read the NEXT function's header.
            const nextFunction = source.slice(match.index + 1).search(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i);
            const header = source.slice(match.index, nextFunction === -1 ? undefined : match.index + 1 + nextFunction);
            if (!/SECURITY\s+DEFINER/i.test(header)) continue;
            if (/RETURNS\s+trigger/i.test(header)) continue;
            if (!found.has(name)) found.set(name, { firstFile: file, firstRank: numericPrefix(file) });
        }
    }
    return [...found.entries()]
        .filter(([name, meta]) => meta.firstRank >= FIRST_GOVERNED_MIGRATION || ALSO_GOVERNED.includes(name))
        .sort(([a], [b]) => a.localeCompare(b));
}

const stripTsComments = (s) => s.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
const stripSqlComments = (s) => s.replace(/--[^\n]*/g, ' ');

const sourceFiles = execFileSync(
    'git',
    ['ls-files', 'services', 'apps', 'packages'],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
)
    .split('\n')
    .filter((p) => /\.(ts|tsx|mjs|cjs)$/.test(p))
    .filter((p) => !/__tests__|\/test\/|\.test\./.test(p));

const sources = sourceFiles.map((path) => {
    try {
        return { path, text: stripTsComments(readFileSync(join(root, path), 'utf8')) };
    } catch {
        return { path, text: '' };
    }
});

const migrationBodies = migrations.map((file) => ({
    file,
    text: stripSqlComments(readFileSync(join(migrationsDir, file), 'utf8')),
}));

// All four caller shapes, because each of the first three alone gave a wrong answer.
function callersOf(name) {
    const quoted = new RegExp(`['"\`]${name}['"\`]`);
    const qualified = new RegExp(`public\\.${name}\\s*\\(`);
    const hits = [];
    for (const { path, text } of sources) {
        if (quoted.test(text) || qualified.test(text)) hits.push(path);
    }
    // SQL-to-SQL: redeem_loyalty_points has no TypeScript caller and never will — create_checkout_order
    // calls it. A function reachable from another function is wired.
    for (const { file, text } of migrationBodies) {
        const defines = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${name}\\s*\\(`, 'i');
        const callsIt = new RegExp(`(?:PERFORM|SELECT|:=|=)\\s*public\\.${name}\\s*\\(`, 'i');
        if (callsIt.test(text.replace(defines, ' '))) hits.push(`sql:${file}`);
    }
    return hits;
}

const governed = governedFunctions();

test('the sweep actually found the programme\'s SECURITY DEFINER functions', () => {
    // Non-vacuity: a sweep that matched nothing would pass every assertion below.
    assert.ok(governed.length >= 14, `expected the 217+ RPCs plus the canonical money ones, found ${governed.length}`);
    const names = governed.map(([n]) => n);
    // Two from this programme and two from the canonical money path, so neither half of the scope
    // rule can quietly stop matching.
    for (const expected of ['award_loyalty_points', 'allocate_ad_campaign_budget', 'create_checkout_order', 'complete_order_refund']) {
        assert.ok(names.includes(expected), `${expected} must be in scope`);
    }
    // Every ALSO_GOVERNED name must resolve to a real function, or the list is a set of typos that
    // silently govern nothing.
    for (const name of ALSO_GOVERNED) {
        assert.ok(names.includes(name), `${name} is listed as canonical but no migration defines it as SECURITY DEFINER`);
    }
});

for (const [name, meta] of governed) {
    const exemption = EXEMPT[name];
    const callers = callersOf(name);

    if (exemption) {
        test(`${name} is exempt, and the exemption is still true`, () => {
            // A stale exemption is worse than none: it is a permission for a gap that has since been
            // closed, and it stops the guard reporting the next one.
            assert.equal(
                callers.length,
                0,
                `${name} now HAS callers (${callers.join(', ')}) — remove its exemption rather than leaving a standing waiver`,
            );
            assert.ok(exemption.blockedOn, `${name}'s exemption must name the decision that unblocks it`);
            assert.ok(exemption.why.length > 40, `${name}'s exemption must say why, not merely that`);
        });
        continue;
    }

    test(`${name} (introduced by ${meta.firstFile}) is reachable`, () => {
        assert.ok(
            callers.length > 0,
            `${name} is a SECURITY DEFINER RPC that NOTHING calls. DDL wired to nothing is this `
            + `programme's named failure mode: either wire it, or add it to EXEMPT with a reason and `
            + `the decision it waits on.`,
        );
    });
}

test('every exemption names a function that actually exists', () => {
    const names = new Set(governed.map(([n]) => n));
    for (const name of Object.keys(EXEMPT)) {
        assert.ok(names.has(name), `${name} is exempted but is not a governed function — stale entry`);
    }
});
