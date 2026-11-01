// F-ROLLBACK-1 (CAP-C65) — a rollback must refuse, not silently add a second overload.
//
// THE DEFECT, PRECISELY
// `CREATE OR REPLACE FUNCTION` matches on the parameter list. Given a different one it does not
// replace the function — it ADDS an overload, silently, and the script reports success. Six rollback
// files restore `create_checkout_order` with the signature that was live at their own point in
// history (16 or 18 parameters); migration 213 later took it to 18 and migration 234 to 20. Running
// any of them against a current database therefore left TWO overloads, after which every call fails
// `function public.create_checkout_order(...) is not unique` — checkout down entirely, caused by the
// script meant to recover from an incident.
//
// WHAT IS NOT THE FIX
// Rewriting those historical parameter lists to match today's signature. A rollback exists to
// restore a past body; "modernising" it would destroy the thing it is for. So each file gained a
// PRECONDITION instead: it states the signature it needs to find live, and refuses with that
// comparison spelled out if the database has moved on.
//
// WHAT THIS SUITE PROVES, IN BOTH DIRECTIONS
//   * at head, every one of the six refuses and leaves exactly one overload;
//   * at its OWN migration point, every one of the six still applies — the guard does not break the
//     legitimate use, which is the half that would be easy to skip;
//   * with the precondition stripped out, the defect reproduces exactly — two overloads and an
//     ambiguous call. A fence you have never seen absent is not a fence you have tested.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_rollback_precondition';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

// number -> rollback filename. The number is also the migration point at which the file is correct.
const GUARDED_ROLLBACKS = new Map([
    [202, '202_narrow_checkout_order_payment_method'],
    [206, '206_checkout_order_idempotency_advisory_lock'],
    [213, '213_checkout_order_gst_place_of_supply_and_tax_lines'],
    [215, '215_fix_gift_card_digest_search_path'],
    [218, '218_restore_checkout_idempotency_advisory_lock'],
    [219, '219_purchase_parent_child_orders'],
]);

// Candidate restorers keep their original bodies. Each is exercised at the exact
// migration where it belongs, not against a later body that happens to share its ABI.
const CANDIDATE_ROLLBACKS = new Map([
    [280, '280_price_reference_preceding_announcement'],
    [285, '285_storefront_web_onboarding_completion_status'],
    [288, '288_ledger_idempotency_payload_conflict'],
    [291, '291_ad_credit_idempotency_payload_conflict'],
    [293, '293_ad_credit_purchase_canonical_liability'],
    [294, '294_payout_release_payable_reservation'],
    [296, '296_marketplace_order_category_snapshot'],
    [303, '303_canonical_wallet_reconciliation_projection'],
    [305, '305_restore_payment_transaction_ledger_source_resolution'],
    [318, '318_session_bound_trust_reinstatement'],
    [324, '324_canonical_merchant_staff_invitations'],
    [328, '328_subscription_checkout_source'],
    [329, '329_approved_operator_mfa_reset'],
    [411, '411_authoritative_checkout_gst'],
]);
const ALL_SNAPSHOTS = new Map([...GUARDED_ROLLBACKS, ...CANDIDATE_ROLLBACKS]);

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    ).trim();
}

function psqlExpectingFailure(sql, targetDatabase = databaseName) {
    try {
        psql(sql, targetDatabase);
        return null;
    } catch (error) {
        return `${error.stderr || ''}${error.stdout || ''}`;
    }
}

const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const rollbackSql = (name) =>
    stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/rollback', `${name}.rollback.sql`), 'utf8'));

const migrationNumber = (filename) => parseInt(filename.match(/^(\d+)/)?.[1] ?? '-1', 10);

function listMigrations() {
    return readdirSync(join(repoRoot, 'database/supabase/migrations'))
        .filter((n) => n.endsWith('.sql'))
        .sort((a, b) => migrationNumber(a) - migrationNumber(b) || a.localeCompare(b));
}

const overloadCount = (db = databaseName) => psql(
    `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'create_checkout_order';`, db);

const parameterCount = (db = databaseName) => psql(
    `SELECT coalesce(array_length(p.proargnames, 1), 0) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'create_checkout_order';`, db);

// A snapshot database per guarded rollback, taken at exactly that migration, plus one at head.
const snapshotFor = (number) => `${databaseName}_at_${number}`;
const ROUND_TRIP_219 = `${databaseName}_roundtrip_219`;

before(() => {
    if (skip) return;
    psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(`ALTER DATABASE "${databaseName}" SET search_path = public, extensions;`, 'postgres');
    psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);

    for (const migration of listMigrations()) {
        psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', migration), 'utf8')));
        const number = migrationNumber(migration);
        if (ALL_SNAPSHOTS.has(number)) {
            // TEMPLATE copies the database as it stands, which is far cheaper than replaying the
            // migrations six times over. It needs no open connections to the source — every psql
            // call above has already disconnected.
            const snapshot = snapshotFor(number);
            psql(`DROP DATABASE IF EXISTS "${snapshot}"; CREATE DATABASE "${snapshot}" TEMPLATE "${databaseName}";`, 'postgres');
            // 219 gets a second, untouched copy: the "still applies" test consumes the first one by
            // actually running the rollback against it, and the round-trip test below needs a
            // database where the purchase model is still present.
            if (number === 219) {
                psql(`DROP DATABASE IF EXISTS "${ROUND_TRIP_219}"; CREATE DATABASE "${ROUND_TRIP_219}" TEMPLATE "${databaseName}";`, 'postgres');
            }
        }
    }
});

after(() => {
    if (skip) return;
    for (const number of ALL_SNAPSHOTS.keys()) {
        try { psql(`DROP DATABASE IF EXISTS "${snapshotFor(number)}";`, 'postgres'); } catch { /* leave for inspection */ }
    }
    try { psql(`DROP DATABASE IF EXISTS "${ROUND_TRIP_219}";`, 'postgres'); } catch { /* leave for inspection */ }
    try { psql(`DROP DATABASE IF EXISTS "${databaseName}";`, 'postgres'); } catch { /* leave for inspection */ }
});

const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const transactionBody = (sql) => sql.replace(/^BEGIN;\s*$/gm, '').replace(/^COMMIT;\s*$/gm, '');
const stripPrecondition = (sql) => sql.replace(/DO \$rollback_precondition\$[\s\S]*?\$rollback_precondition\$;\n/, '');
const functionState = (db) => psql(`SELECT coalesce(jsonb_agg(jsonb_build_object(
    'signature', p.oid::regprocedure::text, 'definition_hash', md5(pg_get_functiondef(p.oid)),
    'owner', p.proowner::regrole::text, 'acl', p.proacl::text) ORDER BY p.oid::regprocedure::text),'[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f';`, db);
const restoredFunctions = (sql, db) => {
    const names = [...new Set([...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\s*\(/gi)].map(match => match[1]))];
    return JSON.parse(psql(`SELECT jsonb_agg(jsonb_build_object(
        'name', p.proname, 'signature', p.oid::regprocedure::text,
        'definition', pg_get_functiondef(p.oid), 'input_names', p.proargnames[1:p.pronargs],
        'arguments', (SELECT string_agg(format('%I %s', p.proargnames[i+1], format_type(p.proargtypes[i],NULL)), ', ' ORDER BY i)
            FROM generate_series(0,p.pronargs-1) i)) ORDER BY p.proname)
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname IN (${names.map(quote).join(',')});`, db));
};

test('candidate rollback/forward pairs work at their own migration points and restore bodies, owners and ACLs', { skip }, () => {
    for (const [number, name] of CANDIDATE_ROLLBACKS) {
        const db = snapshotFor(number);
        const before = functionState(db);
        psql(rollbackSql(name), db);
        if (number === 296) assert.equal(psql("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='marketplace_category_id');",db),'f');
        const forward = listMigrations().find(file => migrationNumber(file) === number);
        psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot,'database/supabase/migrations',forward),'utf8')),db);
        assert.equal(functionState(db),before,`rollback ${number}: paired forward restores every public function body/owner/ACL`);
        if (number === 296) assert.equal(psql("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='marketplace_category_id');",db),'t');
    }
});

test('every candidate restorer refuses an extra overload, changed typed ABI, input names and result ABI atomically', { skip }, () => {
    let checked = 0;
    for (const [number, name] of CANDIDATE_ROLLBACKS) {
        const db = snapshotFor(number), rollback = transactionBody(rollbackSql(name));
        for (const fn of restoredFunctions(rollback,db)) {
            const before = functionState(db);
            const stub = `CREATE FUNCTION public.${fn.name}(synthetic_argument integer) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;`;
            for (const drift of [stub, `DROP FUNCTION ${fn.signature} CASCADE; ${stub}`,
                `DROP FUNCTION ${fn.signature} CASCADE; CREATE FUNCTION public.${fn.name}(${fn.arguments ?? ''}) RETURNS text LANGUAGE sql AS $$ SELECT 'synthetic ABI drift'::text $$;`]) {
                const error = psqlExpectingFailure(`BEGIN; ${drift}\n${rollback}\nCOMMIT;`,db);
                assert.match(error ?? '',new RegExp(`rollback ${number} refuses to run`),`${number}/${fn.name}: drift must be refused by the guard`);
                assert.equal(functionState(db),before,`${number}/${fn.name}: refusal preserves all function bodies/owners/ACLs`);
            }
            if (fn.input_names?.length) {
                const renamed = fn.definition.replace(new RegExp(`\\b${fn.input_names[0]}\\b`,'g'),'synthetic_renamed_input');
                const error = psqlExpectingFailure(`BEGIN; DROP FUNCTION ${fn.signature} CASCADE; ${renamed};\n${rollback}\nCOMMIT;`,db);
                assert.match(error ?? '',new RegExp(`rollback ${number} refuses to run: .*input names`));
                assert.equal(functionState(db),before);
            }
            // A negative control proves that the historical script itself accepts a
            // different typed ABI and adds its original overload when the guard is absent.
            const withoutGuard = stripPrecondition(rollback);
            assert.ok(!withoutGuard.includes('$rollback_precondition$'));
            const result = psql(`BEGIN; DROP FUNCTION ${fn.signature} CASCADE; ${stub}\n${withoutGuard}
                SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                WHERE n.nspname='public' AND p.proname=${quote(fn.name)}; ROLLBACK;`,db);
            assert.equal(result.split('\n').at(-1),'2',`${number}/${fn.name}: removing the guard reproduces two overloads`);
            assert.equal(functionState(db),before,'negative control rolls back its own synthetic drift and effects');
            checked += 1;
        }
    }
    assert.equal(checked,24,'each of the 24 current restored signatures receives real database drift/negative controls, including both intentional MFA overloads');
});

test('the database starts clean: exactly one create_checkout_order, taking 20 parameters', { skip }, () => {
    assert.equal(overloadCount(), '1');
    assert.equal(parameterCount(), '20', 'migration 234 took it to 20 — this is what the old rollbacks no longer match');
});

test('at head, every guarded rollback REFUSES and leaves the function untouched', { skip }, () => {
    for (const [number, name] of GUARDED_ROLLBACKS) {
        const error = psqlExpectingFailure(rollbackSql(name));
        assert.ok(error, `rollback ${number} must refuse to run against a current database`);
        assert.match(error, new RegExp(`rollback ${number} refuses to run`), `rollback ${number} must say so plainly`);
        // The message has to be actionable: both signatures, the consequence, and what to do.
        assert.match(error, /currently takes 20 parameters/);
        assert.match(error, /adds a second overload/);
        assert.match(error, /234 added p_buyer_account_id and p_loyalty_points/);

        assert.equal(overloadCount(), '1', `rollback ${number} must not leave a second overload behind`);
        assert.equal(parameterCount(), '20', `rollback ${number} must not have altered the live function`);
    }
});

test('at its OWN migration point, every guarded rollback still applies', { skip }, () => {
    // The half that is easy to skip. A guard that refuses everywhere would also make this suite's
    // first test pass, and would have broken every rollback in the repository.
    for (const [number, name] of GUARDED_ROLLBACKS) {
        const snapshot = snapshotFor(number);
        const before = parameterCount(snapshot);
        const error = psqlExpectingFailure(rollbackSql(name), snapshot);
        assert.equal(error, null, `rollback ${number} must still apply at migration ${number} (live signature had ${before} parameters)`);
        assert.equal(overloadCount(snapshot), '1', `rollback ${number} must leave exactly one overload at its own point`);
    }
});

test('at migration 219, the rollback does its actual job — and keeps CHK-0\'s advisory lock', { skip }, () => {
    // Moved here from purchase-parent-child-postgres.test.mjs, which runs at head where this
    // rollback cannot legitimately be applied at all. The round trip only means something at the
    // migration the rollback belongs to, and this is the one database in the repository that has it.
    const snapshot = ROUND_TRIP_219;

    assert.equal(psql("SELECT (to_regclass('public.purchases') IS NOT NULL)::text;", snapshot), 'true', 'precondition');
    assert.equal(psqlExpectingFailure(rollbackSql('219_purchase_parent_child_orders'), snapshot), null);

    assert.equal(psql("SELECT (to_regclass('public.purchases') IS NOT NULL)::text;", snapshot), 'false', 'purchases dropped');
    assert.equal(
        psql("SELECT (count(*) > 0)::text FROM information_schema.columns WHERE table_name='orders' AND column_name='purchase_id';", snapshot),
        'false',
        'orders.purchase_id dropped',
    );
    assert.equal(
        psql("SELECT (to_regclass('public.orders_single_child_per_purchase_idx') IS NOT NULL)::text;", snapshot),
        'false',
        'the single-child index dropped',
    );
    // Rolling back this FEATURE must never roll back CHK-0's S0 fix.
    assert.equal(
        psql(`SELECT (position('pg_advisory_xact_lock' in pg_get_functiondef(p.oid)) > 0)::text
                FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'create_checkout_order';`, snapshot),
        'true',
        "the rollback restores 218's body, lock included — a CHK-1 rollback must not reopen the idempotency race",
    );
    assert.equal(overloadCount(snapshot), '1', 'and exactly one overload throughout');

    // Round trip: re-applying 219 restores the model.
    const reapply = readFileSync(join(repoRoot, 'database/supabase/migrations/219_purchase_parent_child_orders.sql'), 'utf8');
    assert.equal(psqlExpectingFailure(stripUnsupportedPg17Guc(reapply), snapshot), null, 're-apply must be clean');
    assert.equal(psql("SELECT (to_regclass('public.purchases') IS NOT NULL)::text;", snapshot), 'true');
    assert.equal(overloadCount(snapshot), '1');
});

test('CONTROL: strip the precondition and the defect reproduces exactly', { skip }, () => {
    // Without this, "every rollback refuses" could be true because the files are broken in some
    // other way, and the guard would be decoration.
    const withoutGuard = rollbackSql('219_purchase_parent_child_orders')
        .replace(/DO \$rollback_precondition\$[\s\S]*?\$rollback_precondition\$;\n/, '');
    assert.ok(!withoutGuard.includes('rollback_precondition'), 'the control must actually remove the guard');

    const error = psqlExpectingFailure(withoutGuard);
    assert.equal(error, null, 'without the guard the rollback applies happily — that is the whole problem');
    assert.equal(overloadCount(), '2', 'and leaves TWO create_checkout_order functions');

    // The consequence, demonstrated rather than asserted: an ordinary call is now ambiguous.
    const callError = psqlExpectingFailure(
        `SELECT public.create_checkout_order('11111111-1111-4111-8111-111111111111'::uuid, 'n', 'e@x.z', '9', '{}'::jsonb, '[]'::jsonb, 'cod');`);
    assert.ok(callError, 'checkout must now be broken');
    assert.match(callError, /is not unique/);

    // Put the database back so later tests see a clean head.
    psql(`DROP FUNCTION public.create_checkout_order(uuid, text, text, text, jsonb, jsonb, text, text, text, text, text, text, uuid, text, uuid, numeric, text, jsonb);`);
    assert.equal(overloadCount(), '1');
    assert.equal(parameterCount(), '20');
});

test('no OTHER function in the schema has this exposure', { skip }, () => {
    // The sweep that scoped this phase, kept as a standing assertion: if a future rollback restores
    // some other function with a stale signature, this fails and names it.
    //
    // `pronargs`, not `array_length(proargnames, 1)`. For a RETURNS TABLE function proargnames also
    // carries the OUTPUT column names, which made `marketplace_sponsored_products` (1 input, 8 output
    // columns) and `transition_channel_listing` (7 inputs, 5 output columns) look mismatched when
    // their inputs matched their rollbacks exactly. Counting outputs as parameters would have widened
    // this phase's scope on a measurement error.
    const live = new Map();
    const liveSignatures = new Map();
    const normalizeSignature = (signature) => signature.replace(/^public\./, '').replace(/\s+/g, '').toLowerCase();
    for (const row of psql(`
        SELECT p.proname || E'\\x01' || p.pronargs || E'\\x01' || p.oid::regprocedure::text
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prokind = 'f';`).split('\n').filter(Boolean)) {
        const [name, count, signature] = row.split('\x01');
        if (!live.has(name)) live.set(name, new Set());
        live.get(name).add(Number(count));
        if (!liveSignatures.has(name)) liveSignatures.set(name, new Set());
        liveSignatures.get(name).add(normalizeSignature(signature));
    }

    const offenders = [];
    for (const file of readdirSync(join(repoRoot, 'database/supabase/rollback')).filter((n) => n.endsWith('.sql'))) {
        const sql = readFileSync(join(repoRoot, 'database/supabase/rollback', file), 'utf8');
        for (const match of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)\s*\(/gi)) {
            const name = match[1];
            if (!live.has(name)) continue;
            let index = match.index + match[0].length;
            let depth = 1;
            const start = index;
            while (depth) {
                if (sql[index] === '(') depth += 1;
                else if (sql[index] === ')') { depth -= 1; if (!depth) break; }
                index += 1;
            }
            // Whole-line comments are not arguments. In rollback 291 a comma in
            // the explanation of NULL made the old scanner report 7 instead of 6.
            const params = sql.slice(start, index).split('\n').filter(line => !/^\s*--/.test(line)).join('\n');
            let created = 0, nesting = 0, current = '';
            for (const character of params) {
                if (character === '(') nesting += 1;
                else if (character === ')') nesting -= 1;
                if (character === ',' && nesting === 0) { created += current.trim() ? 1 : 0; current = ''; }
                else current += character;
            }
            created += current.trim() ? 1 : 0;

            if (live.get(name).has(created)) continue;                 // matches a live signature: replaces
            if (sql.includes('$rollback_precondition$')) continue;     // guarded: refuses instead
            // An intentional signature change can drop the current function first.
            // Require exact DROP targets for ALL live overloads, not just a DROP
            // somewhere in the file. 284 drops six arguments before restoring five.
            const dropped = new Set([...sql.matchAll(/DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?public\.([a-z0-9_]+)\s*\(([^)]*)\)\s*;/gi)]
                .map(drop => normalizeSignature(`${drop[1]}(${drop[2]})`)));
            if ([...liveSignatures.get(name)].every(signature => dropped.has(signature))) continue;
            offenders.push(`${file}: ${name} creates ${created} parameters, live has [${[...live.get(name)]}]`);
        }
    }
    assert.deepEqual(
        offenders.sort(),
        [],
        'add the signature precondition to this rollback, or give it a DROP that targets the live signature',
    );
});
