// Phase R5 — closes the issue_gift_card double-issuance defect a later CTO
// measurement found: Phase R4's own test replayed the SAME code with the
// SAME idempotency key, so ON CONFLICT (site_id, code_hash) caught the
// duplicate and masked the real defect. Replaying the same key with
// DIFFERENT codes -- exactly what a retrying caller that regenerates its
// code does -- dedupes on nothing, because neither ON CONFLICT in
// 173_v1_gift_card_issuance_lifecycle.sql guards p_idempotency_key itself.
//
// This file proves both directions with one rollback control:
// W1 bootstraps through migration 206 (pre-fix) and reproduces the
// varying-code defect for real. W2 then applies migration 207 (the
// advisory-lock fix) in place and re-runs the identical scenario, proving
// exactly one account/one ledger row and a graceful idempotent return.
//
// DESTRUCTIVE (full migration replay, DROP DATABASE). MUST NOT run against
// the shared letbuyy-executable-pg container — the guard below refuses,
// mirroring tests/executable/money-rpc-idempotency-sweep-postgres.test.mjs
// (Phase R4) exactly.

import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER;
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';

if (!containerName || containerName === 'letbuyy-executable-pg') {
  throw new Error(
    'gift-card-issue-idempotency-postgres.test.mjs is destructive (recreates the database and replays ' +
    'every migration, twice). Refusing to run without LETBUYY_EXECUTABLE_PG_CONTAINER set to a dedicated, ' +
    'uniquely-named throwaway container.',
  );
}

function psql(sql, targetDatabase = databaseName, options = {}) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options },
  ).trim();
}

async function psqlAsync(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [
      'exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `psql exited with ${code}`));
    });
    child.stdin.end(sql);
  });
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

// Same fix as Phase R2/R4's harnesses: pgcrypto must live in `public`, not a
// separate `extensions` schema, because these RPCs are SECURITY DEFINER SET
// search_path TO 'public'.
function stripUnsupportedPg17Guc(sql) {
  return sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
}

function listMigrations(maxPrefix = Infinity) {
  return readdirSync(join(repoRoot, 'database/supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .filter((name) => {
      const prefix = parseInt(name.match(/^(\d+)/)?.[1] ?? '0', 10);
      return prefix <= maxPrefix;
    })
    .sort((a, b) => {
      const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
      const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
      return na - nb || a.localeCompare(b);
    });
}

// The bootstrap lives in a shared, Supabase-faithful module since F-HARNESS-1: pgcrypto in
// `extensions` rather than `public`, Supabase's own ALTER DEFAULT PRIVILEGES, and role attributes
// stated rather than inherited from whichever suite created them first. See CAP-C62 and CAP-C64 —
// each of those three differences has silently flipped a test result in this repository.
const BOOTSTRAP_SQL = SUPABASE_FAITHFUL_BOOTSTRAP_SQL;

function applyMigrations(migrations) {
  for (const name of migrations) {
    const sql = stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8'));
    try {
      psql(sql);
    } catch (error) {
      throw new Error(`migration ${name} failed to apply against the fixture: ${error.message}`);
    }
  }
}

function bootstrapDatabase(maxPrefix) {
  psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
  psql(BOOTSTRAP_SQL);
  const migrations = listMigrations(maxPrefix);
  applyMigrations(migrations);
  return migrations.length;
}

const SITE_ID = '11111111-1111-4111-8111-111111111111';

function seedSite() {
  psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
    VALUES (${sqlString(SITE_ID)}::uuid, 'R5 Gift Card Store', 'R5 Gift Card Store', 'store', 'r5-gift-card-store', true);
  `);
}

function issueGiftCardSql({ code, key, initialValue = 5000 }) {
  return `
    SELECT public.issue_gift_card(
      ${sqlString(SITE_ID)}::uuid,
      ${sqlString(code)},
      ${initialValue},
      'INR',
      NULL,
      '{}'::jsonb,
      NULL,
      ${sqlString(`req-${key}`)},
      ${sqlString(key)}
    );
  `;
}

async function runVaryingCodeReplay(key) {
  // Three concurrent callers, ONE idempotency key, THREE DIFFERENT codes --
  // exactly what a retrying caller that regenerates its code on every
  // attempt produces (services/api-gateway/src/routes/gift-cards.ts:86-87).
  const attempts = await Promise.allSettled([
    psqlAsync(issueGiftCardSql({ code: `R5-VARY-CODE-A-${key}`, key })),
    psqlAsync(issueGiftCardSql({ code: `R5-VARY-CODE-B-${key}`, key })),
    psqlAsync(issueGiftCardSql({ code: `R5-VARY-CODE-C-${key}`, key })),
  ]);

  const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
  const rejected = attempts.filter((a) => a.status === 'rejected');

  const accountCount = psql(`
    SELECT count(*) FROM public.gift_card_accounts
     WHERE site_id = ${sqlString(SITE_ID)}::uuid
       AND metadata->>'issue_idempotency_key' = ${sqlString(key)};
  `);
  const issuedLedgerCount = psql(`
    SELECT count(*) FROM public.gift_card_ledger_entries gle
     JOIN public.gift_card_accounts gca ON gca.id = gle.gift_card_account_id
    WHERE gca.site_id = ${sqlString(SITE_ID)}::uuid
      AND gca.metadata->>'issue_idempotency_key' = ${sqlString(key)}
      AND gle.entry_type = 'issued';
  `);
  const totalIssuedValue = psql(`
    SELECT COALESCE(SUM(gle.amount), 0) FROM public.gift_card_ledger_entries gle
     JOIN public.gift_card_accounts gca ON gca.id = gle.gift_card_account_id
    WHERE gca.site_id = ${sqlString(SITE_ID)}::uuid
      AND gca.metadata->>'issue_idempotency_key' = ${sqlString(key)}
      AND gle.entry_type = 'issued';
  `);

  return {
    fulfilled: fulfilled.length,
    rejected: rejected.length,
    rejectMessages: rejected.map((r) => r.reason.message),
    accountCount: Number(accountCount),
    issuedLedgerCount: Number(issuedLedgerCount),
    totalIssuedValue: Number(totalIssuedValue),
  };
}

let migrationCountPreFix = 0;

before(() => {
  // Bootstraps through migration 206 ONLY -- the state BEFORE this phase's
  // fix exists, so W1 measures the real, unpatched defect.
  migrationCountPreFix = bootstrapDatabase(206);
  seedSite();
});

test('fresh pre-fix fixture: migrations applied cleanly through 206 and site seeded', () => {
  assert.ok(migrationCountPreFix > 0);
  const siteCount = psql(`SELECT count(*) FROM public.sites WHERE id = ${sqlString(SITE_ID)}::uuid;`);
  assert.equal(siteCount, '1');
});

test('W1 — REPRODUCTION (pre-fix): varying-code replay of one idempotency key duplicates money', async () => {
  const key = 'race:issue-gift-card:varying-code-prefix';
  const result = await runVaryingCodeReplay(key);

  console.log(
    `[W1 pre-fix, migrations through 206] fulfilled=${result.fulfilled} rejected=${result.rejected} ` +
    `accounts=${result.accountCount} issued-ledger-rows=${result.issuedLedgerCount} ` +
    `totalIssuedValue=₹${result.totalIssuedValue} rejectMessages=${JSON.stringify(result.rejectMessages)}`,
  );

  // This is the reproduction, not a fix-proving assertion: it asserts the
  // DEFECT is real, on the pre-fix schema. If this ever fails (i.e. the
  // defect does not reproduce), STOP -- the phase's premise would be wrong.
  assert.ok(result.accountCount > 1, `expected the varying-code defect to duplicate accounts (>1), got ${result.accountCount}`);
  assert.ok(result.issuedLedgerCount > 1, `expected the varying-code defect to duplicate ledger rows (>1), got ${result.issuedLedgerCount}`);
  assert.equal(result.totalIssuedValue, result.accountCount * 5000, 'total issued value must scale with the duplicated account count');
});

// ---------------------------------------------------------------------
// W2 — apply migration 207 (the fix) in place on the SAME database and
// re-run the identical scenario. This is the rollback control: the ONLY
// thing that changes between the two tests below is migration 207's
// presence.
// ---------------------------------------------------------------------

test('W2 — apply migration 207 in place', () => {
  const sql = stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations/207_gift_card_issue_idempotency_advisory_lock.sql'), 'utf8'));
  psql(sql);
  const fnDef = psql(`SELECT prosrc FROM pg_proc WHERE proname = 'issue_gift_card' LIMIT 1;`);
  assert.match(fnDef, /pg_advisory_xact_lock/, 'issue_gift_card must now take the advisory lock');
});

test('W2 — POST-FIX: varying-code replay of one idempotency key is deduplicated, not multiplied', async () => {
  const key = 'race:issue-gift-card:varying-code-postfix';
  const result = await runVaryingCodeReplay(key);

  console.log(
    `[W2 post-fix, migration 207 applied] fulfilled=${result.fulfilled} rejected=${result.rejected} ` +
    `accounts=${result.accountCount} issued-ledger-rows=${result.issuedLedgerCount} ` +
    `totalIssuedValue=₹${result.totalIssuedValue} rejectMessages=${JSON.stringify(result.rejectMessages)}`,
  );

  assert.equal(result.accountCount, 1, 'exactly one gift_card_accounts row must exist after the fix, no matter how many concurrent replays with varying codes');
  assert.equal(result.issuedLedgerCount, 1, 'exactly one issued ledger entry must exist after the fix');
  assert.equal(result.totalIssuedValue, 5000, 'total issued value must equal exactly one card worth, not N cards worth');

  // The fix's promise is a GRACEFUL idempotent return, not merely "no
  // duplication" -- every concurrent caller should fulfil (get the same
  // account back), none should see the 'gift card code collision' error.
  assert.equal(result.fulfilled, 3, 'every concurrent caller must receive a graceful idempotent return, not a collision error');
  assert.equal(result.rejected, 0, 'no concurrent caller should be rejected once the advisory lock serializes the replay');
});

test('W3 — migration 207 rolls back to migration 173\'s exact pre-fix definition', () => {
  const rollbackSql = stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/rollback/207_gift_card_issue_idempotency_advisory_lock.rollback.sql'), 'utf8'));
  psql(rollbackSql);

  const fnDef = psql(`SELECT prosrc FROM pg_proc WHERE proname = 'issue_gift_card' LIMIT 1;`);
  assert.doesNotMatch(fnDef, /pg_advisory_xact_lock/, 'the rollback must remove the advisory lock, restoring the pre-fix function body');
});
