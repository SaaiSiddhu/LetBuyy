// F-LEDGER-1 — the guard arm added to canonical-ledger-only-validator, exercised rather than read.
//
// A validator that passes proves nothing on its own: it may be passing because the repository is
// clean, or because the check can never fire. Every case here runs the REAL validator — the same
// file the gate runs — over synthetic fixtures injected through phase-b-common's own
// LETBUYY_PHASE_B_EXTRA_FILES_JSON seam, so nothing is written into the repository and nothing is a
// re-typed copy of the pattern under test.
//
// The instrument check matters as much as the positive ones. The stored-value arm extracts a window
// after `.from('<table>')` and looks for a mutation verb inside it; a plain `[\s\S]{0,1400}` window
// runs past the end of that query into whatever follows, so an innocent `.select()` sitting above an
// unrelated `.insert()` would be reported as a money mutation. Case 2 pins that it does not.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VALIDATOR = 'scripts/validators/canonical-ledger-only-validator.mjs';

// Runs the validator with the given synthetic files added to what it scans.
// Returns { ok, output } rather than throwing, so a refusal can be asserted on by its text.
function runValidator(files) {
    try {
        const stdout = execFileSync('node', [VALIDATOR], {
            cwd: repoRoot,
            encoding: 'utf8',
            env: { ...process.env, LETBUYY_PHASE_B_EXTRA_FILES_JSON: JSON.stringify(files) },
        });
        return { ok: true, output: stdout };
    } catch (error) {
        return { ok: false, output: `${error.stdout || ''}${error.stderr || ''}` };
    }
}

const TS_PATH = 'services/api-gateway/src/routes/ledger1-fixture.ts';
const SQL_PATH_AFTER_FENCE = 'database/supabase/migrations/237_ledger1_fixture.sql';
const SQL_PATH_BEFORE_FENCE = 'database/supabase/migrations/230_ledger1_fixture.sql';

test('the repository is clean under the extended validator, with no fixtures injected', () => {
    const { ok, output } = runValidator([]);
    assert.ok(ok, `the validator must pass on develop as it stands: ${output}`);
});

test('a direct write to a stored-value ledger table from TypeScript is refused', () => {
    for (const table of ['loyalty_accounts', 'loyalty_ledger_entries', 'ad_credit_accounts', 'ad_credit_ledger_entries']) {
        const { ok, output } = runValidator([{
            path: TS_PATH,
            text: `export async function award(db) {\n`
                + `    await db.from('${table}').insert({ site_id: 'x', points: 1000 });\n`
                + `}\n`,
        }]);
        assert.equal(ok, false, `a direct insert into ${table} must fail the gate`);
        assert.match(output, new RegExp(`${table} is stored value`), `the message must name ${table}: ${output}`);
    }
});

test('there is no escape hatch: naming a canonical ledger symbol does not excuse the write', () => {
    // The arm above this one lets a money-table write pass when the file also posts to the canonical
    // ledger. These four tables have no such case, and this pins that the file-level evidence
    // pattern does not leak into the strict arm.
    const { ok, output } = runValidator([{
        path: TS_PATH,
        text: `import { postCanonicalPayoutLedger } from './x';\n`
            + `// ledger_transactions post_settlement_ledger_transaction canonical_ledger_transaction_id\n`
            + `export async function sneak(db) {\n`
            + `    await db.from('loyalty_ledger_entries').update({ points: 0 });\n`
            + `}\n`,
    }]);
    assert.equal(ok, false, 'canonical-ledger vocabulary must not buy a direct stored-value write');
    assert.match(output, /loyalty_ledger_entries is stored value/, output);
});

test('INSTRUMENT: the window stops at the next query, so a read above an unrelated write is not flagged', () => {
    // This is the exact shape a false positive would take: a legitimate read of a stored-value table
    // followed, within the character budget, by a mutation of a completely different table.
    const innocent = `export async function summary(db) {\n`
        + `    const balance = await db.from('loyalty_ledger_entries')\n`
        + `        .select('id, entry_type, points, balance_after, order_id, created_at')\n`
        + `        .eq('site_id', siteId)\n`
        + `        .order('created_at', { ascending: false })\n`
        + `        .limit(25);\n`
        + `    // An ordinary, unrelated write further down the same function.\n`
        + `    await db.from('analytics_events').insert({ kind: 'loyalty_viewed' });\n`
        + `    return balance;\n`
        + `}\n`;

    const { ok, output } = runValidator([{ path: TS_PATH, text: innocent }]);
    assert.ok(ok, `a read followed by an unrelated write must NOT be reported: ${output}`);

    // And the same text, with the unrelated write changed to target the stored-value table, MUST be
    // reported — otherwise the case above would be passing because the arm is inert, not because the
    // window is bounded.
    const guilty = innocent.replace("from('analytics_events')", "from('loyalty_ledger_entries')");
    const second = runValidator([{ path: TS_PATH, text: guilty }]);
    assert.equal(second.ok, false, 'the control: the same shape aimed at the ledger table must fail');
});

test('a migration after 236 may not re-grant a write on a stored-value ledger table', () => {
    const { ok, output } = runValidator([{
        path: SQL_PATH_AFTER_FENCE,
        text: `BEGIN;\nGRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_accounts TO service_role;\nCOMMIT;\n`,
    }]);
    assert.equal(ok, false, 'a later migration handing the write back must fail the gate');
    assert.match(output, /re-grants a write on a stored-value ledger table/, output);
});

test('GRANT ALL is caught too — the privilege list does not have to name the verb', () => {
    const { ok, output } = runValidator([{
        path: SQL_PATH_AFTER_FENCE,
        text: `GRANT ALL PRIVILEGES ON public.ad_credit_ledger_entries TO service_role;\n`,
    }]);
    assert.equal(ok, false, 'GRANT ALL is a write grant');
    assert.match(output, /re-grants a write on a stored-value ledger table/, output);
});

test('an unscoped write grant on ad_campaigns is refused, a column-scoped one is allowed', () => {
    const unscoped = runValidator([{
        path: SQL_PATH_AFTER_FENCE,
        text: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_campaigns TO service_role;\n`,
    }]);
    assert.equal(unscoped.ok, false, 'a table-wide UPDATE grant would put allocated_minor back in reach');
    assert.match(unscoped.output, /grants an unscoped write on ad_campaigns/, unscoped.output);

    // The shape 236 itself uses. If this were flagged, the fence could not be re-stated by a future
    // migration that legitimately adds a settings column.
    const scoped = runValidator([{
        path: SQL_PATH_AFTER_FENCE,
        text: `GRANT UPDATE (name, status, starts_at, ends_at, updated_at) ON public.ad_campaigns TO service_role;\n`
            + `GRANT INSERT (id, site_id, name, status) ON public.ad_campaigns TO service_role;\n`,
    }]);
    assert.ok(scoped.ok, `a column-scoped grant is the correct shape and must pass: ${scoped.output}`);
});

test('the ratchet looks forward only: migrations at or below 236 are history, not drift', () => {
    // 231 and 232 contain the very grants 236 revokes. Flagging them would report the past as a
    // regression and make the check impossible to keep green.
    const { ok, output } = runValidator([{
        path: SQL_PATH_BEFORE_FENCE,
        text: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_ledger_entries TO service_role;\n`,
    }]);
    assert.ok(ok, `a pre-fence migration must not be flagged: ${output}`);
});
