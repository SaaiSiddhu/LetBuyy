#!/usr/bin/env node
// SUSTAINED-J -- wraps `node --test --test-concurrency=1 tests/*/*.test.mjs` so the
// destructive-guard suites (the ones that refuse to run against the shared default
// container/database -- see each file's own thrown Error text) get the dedicated,
// uniquely-named throwaway environment their guard asks for, instead of always failing under
// the bare invocation regardless of code changes.
//
// WHY THIS EXISTS
// tests/behavioral's previous one-line package.json script never set
// LETBUYY_EXECUTABLE_PG_CONTAINER, so any suite whose own safety guard requires a name other
// than the shared "letbuyy-executable-pg" default (because it recreates its database and
// replays every migration, and running that against the shared container would destroy other
// sessions' in-progress state) refused unconditionally, at module load time, every single run.
// The guard itself is correct and stays; this script gives it what it asks for instead of
// weakening it. See docs/evidence/appid-2026-09-24/SUSTAINED_J.md.
//
// scripts/governance/run-executable-suites.mjs already implements exactly the "unique
// container, unique per-suite database, create-then-drop" lifecycle these suites need (built
// for CAP-C66, used by `pnpm run test:executable`) -- this script reuses it for just the
// guarded suites via its own --filter flag, rather than re-implementing the same lifecycle a
// second time or routing every suite through it (which would change every other suite's
// established, already-verified execution mode for no benefit).
//
// Exit code is the sum of every failing suite's contribution, so it composes like the plain
// `node --test` invocation it replaces: 0 only if everything passed.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Explicit, reviewed allowlist -- not derived by grepping for the guard string at run time, so a
// suite whose guard shape changes doesn't silently join or leave this list without a human
// deciding it belongs here. Keep in sync with docs/evidence/appid-2026-09-24/SUSTAINED_J.md.
const DESTRUCTIVE_GUARD_SUITES = [
  'tests/executable/checkout-order-concurrency-postgres.test.mjs',
  'tests/executable/gift-card-issue-idempotency-postgres.test.mjs',
  'tests/executable/late-capture-after-release-postgres.test.mjs',
  'tests/executable/money-rpc-idempotency-sweep-postgres.test.mjs',
];

function discoverAll() {
  const out = [];
  for (const dir of readdirSync(join(repoRoot, 'tests'), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const file of readdirSync(join(repoRoot, 'tests', dir.name), { withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith('.test.mjs')) {
        out.push(`tests/${dir.name}/${file.name}`);
      }
    }
  }
  return out.sort();
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const all = discoverAll();
const missing = DESTRUCTIVE_GUARD_SUITES.filter((f) => !all.includes(f));
if (missing.length > 0) {
  process.stderr.write(
    `test-behavioral: expected destructive-guard suite(s) not found on disk -- the allowlist is stale, fix it: ${missing.join(', ')}\n`,
  );
  process.exit(2);
}

const guarded = all.filter((f) => DESTRUCTIVE_GUARD_SUITES.includes(f));
const rest = all.filter((f) => !DESTRUCTIVE_GUARD_SUITES.includes(f));

console.log(
  `test-behavioral: ${all.length} suites total -- ${guarded.length} destructive-guard (own dedicated container+database) + ${rest.length} shared-container`,
);

let exitCode = 0;

console.log('test-behavioral: starting the shared ephemeral Postgres fixture');
exitCode = Math.max(exitCode, run('node', ['scripts/governance/foundation-ephemeral-postgres.mjs', 'start']));

for (const suite of guarded) {
  const name = suite.split('/').pop();
  console.log(`test-behavioral: running destructive-guard suite in its own dedicated container: ${name}`);
  exitCode = Math.max(exitCode, run('node', ['scripts/governance/run-executable-suites.mjs', '--filter', name]));
}

if (rest.length > 0) {
  console.log(`test-behavioral: running the remaining ${rest.length} suites against the shared container`);
  exitCode = Math.max(exitCode, run('node', ['--test', '--test-concurrency=1', ...rest]));
}

process.exit(exitCode === 0 ? 0 : 1);
