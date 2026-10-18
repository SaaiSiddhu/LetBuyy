import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptUrl = new URL('../../scripts/governance/foundation-restore-drill.mjs', import.meta.url);
const scriptPath = fileURLToPath(scriptUrl);
const SOURCE = 'postgresql://fixture:synthetic-password@127.0.0.1:5433/source';
const TARGET = 'postgresql://fixture:synthetic-password@127.0.0.1:5433/target';

// These executable tripwires never load libpq or contact a database. Both denied
// and allowed CLI paths use this private PATH; no installed PostgreSQL tool runs.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'letbuyy-restore-preflight-test-'));
  const bin = join(root, 'bin');
  const tripwire = join(root, 'dispatch.jsonl');
  mkdirSync(bin);
  for (const command of ['pg_dump', 'pg_restore']) {
    const path = join(bin, command);
    writeFileSync(path, `#!${process.execPath}\n` + `
const fs = require('node:fs');
fs.appendFileSync(process.env.LETBUYY_RESTORE_TEST_TRIPWIRE, JSON.stringify({ command: '${command}', args: process.argv.slice(2) }) + '\\n');
if (process.env.LETBUYY_RESTORE_TEST_FAIL === '${command}') {
  process.stderr.write('sensitive-child-output synthetic-password postgresql://fixture:synthetic-password@remote.invalid/private');
  process.exit(1);
}
if ('${command}' === 'pg_dump') {
  fs.writeFileSync(process.argv[process.argv.indexOf('--file') + 1], 'synthetic archive; no database');
}
`);
    chmodSync(path, 0o700);
  }
  const env = { ...process.env };
  // Ambient operator libpq settings must not select any fixture's destination.
  for (const key of Object.keys(env)) if (key.startsWith('PG')) delete env[key];
  delete env.LETBUYY_RESTORE_TEST_FAIL;
  Object.assign(env, {
    PATH: `${bin}${delimiter}${process.env.PATH || ''}`,
    TMPDIR: root,
    LETBUYY_RESTORE_TEST_TRIPWIRE: tripwire,
    LETBUYY_RESTORE_DRILL_ALLOW_EXECUTE: 'true',
    LETBUYY_RESTORE_DRILL_SOURCE_URL: SOURCE,
    LETBUYY_RESTORE_DRILL_TARGET_URL: TARGET,
  });
  return {
    root, env,
    cli(args = ['--execute'], overrides = {}) {
      return spawnSync(process.execPath, [scriptPath, ...args], {
        encoding: 'utf8', env: { ...env, ...overrides }, timeout: 5000,
      });
    },
    calls() { return existsSync(tripwire) ? readFileSync(tripwire, 'utf8').trim().split('\n').map(JSON.parse) : []; },
    noDispatch(result) {
      assert.deepEqual(this.calls(), [], 'denied input dispatched a PostgreSQL executable');
      assert.notEqual(result.status, 0, 'unsafe input was accepted');
      assert.equal(result.signal, null);
      assert.deepEqual(readdirSync(root), ['bin'], 'denied input created a restore workspace');
      assert.doesNotMatch(`${result.stdout}${result.stderr}`, /synthetic-password|remote\.invalid|postgresql:\/\//);
    },
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}

test('restore CLI rejects remote endpoints and localhost decoys before dispatch', async (t) => {
  for (const url of [
    'postgresql://fixture:synthetic-password@remote.invalid/db',
    'postgresql://fixture:synthetic-password@remote.invalid/db?application_name=localhost',
    'postgresql://fixture:localhost@remote.invalid/db',
    'postgresql://fixture@localhost.remote.invalid/db',
    'postgresql://fixture@127.0.0.1.remote.invalid/db',
    'postgresql://fixture@0.0.0.0/db',
    'postgresql://fixture@[::]/db',
    'postgresql://fixture@127.0.0.2/db',
    'postgresql://fixture@localhost./db',
    'postgresql://fixture@localhost,remote.invalid/db',
    'postgresql://fixture@%2Ftmp/db',
    'postgresql://fixture@%6cocalhost/db',
  ]) {
    await t.test(new URL(url).hostname || 'socket or encoded host', () => {
      const f = fixture();
      try { f.noDispatch(f.cli(['--execute'], { LETBUYY_RESTORE_DRILL_TARGET_URL: url })); }
      finally { f.cleanup(); }
    });
  }
  const f = fixture();
  try { f.noDispatch(f.cli(['--execute'], { LETBUYY_RESTORE_DRILL_SOURCE_URL: 'postgresql://fixture@remote.invalid/db?application_name=localhost' })); }
  finally { f.cleanup(); }
});

test('restore CLI rejects libpq URI routing overrides and unsupported options', async (t) => {
  for (const query of [
    'host=remote.invalid', 'hostaddr=192.0.2.1', 'port=5434', 'dbname=source',
    'service=remote', 'servicefile=/tmp/service', 'user=other', 'password=other',
    'options=-csearch_path%3Dpublic', 'h%6fst=remote.invalid', 'HOST=remote.invalid',
    'host=', 'application_name=a&application_name=b', 'application_name=%ZZ',
    'application_name=%00', 'sslmode=invalid', 'connect_timeout=-1',
  ]) {
    await t.test(query.split('=')[0], () => {
      const f = fixture();
      try { f.noDispatch(f.cli(['--execute'], { LETBUYY_RESTORE_DRILL_TARGET_URL: `${TARGET}?${query}` })); }
      finally { f.cleanup(); }
    });
  }
});

test('restore CLI rejects ambiguous or implicit database identity', async (t) => {
  for (const url of [
    'host=localhost dbname=target', 'https://localhost/target',
    'postgresql:///target', 'postgresql://fixture@localhost', 'postgresql://fixture@localhost/',
    'postgresql://fixture@localhost/a/b', 'postgresql://fixture@localhost/%00',
    'postgresql://fixture@localhost/%ZZ', 'postgresql://fixture@localhost/dbname%3Dsource',
    'postgresql://fixture@localhost/source/../target', 'postgresql://fixture@localhost/source/%2e%2e/target',
    'postgresql://fixture%00@localhost/target', 'postgresql://fixture:encoded%0a@localhost/target',
    `postgresql://fixture@localhost/${'a'.repeat(64)}`,
    'postgresql://fixture@localhost:0/target', 'postgresql://fixture@localhost:65536/target',
    'postgresql://fixture@localhost/target#ignored', 'postgresql://fixture@localhost/target#',
    'postgresql://fixture@localhost/target\n', 'postgresql://fixture@localhost\\remote.invalid/target',
  ]) {
    await t.test(`invalid input ${url.indexOf(':')}`, () => {
      const f = fixture();
      try { f.noDispatch(f.cli(['--execute'], { LETBUYY_RESTORE_DRILL_TARGET_URL: url })); }
      finally { f.cleanup(); }
    });
  }
});

test('restore CLI rejects same database despite credentials, loopback aliases, encoding or default ports', async (t) => {
  const pairs = [
    [SOURCE, SOURCE],
    [SOURCE, 'postgresql://another@localhost:5433/source?application_name=different'],
    [SOURCE, 'postgresql://another@[::1]:5433/%73ource'],
    [SOURCE, 'postgres://another@127.0.0.1:05433/source'],
    ['postgresql://fixture@localhost/source', 'postgresql://other@[::1]:5432/source'],
    ['postgresql://fixture@[0:0:0:0:0:0:0:1]:5433/source', SOURCE],
  ];
  for (let i = 0; i < pairs.length; i++) {
    await t.test(`alias ${i + 1}`, () => {
      const f = fixture();
      try { f.noDispatch(f.cli(['--execute'], { LETBUYY_RESTORE_DRILL_SOURCE_URL: pairs[i][0], LETBUYY_RESTORE_DRILL_TARGET_URL: pairs[i][1] })); }
      finally { f.cleanup(); }
    });
  }
});

test('restore CLI rejects ambient libpq routing defaults before dispatch', async (t) => {
  for (const key of ['PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGDATABASE', 'PGSERVICE', 'PGSERVICEFILE', 'PGSYSCONFDIR', 'PGLOADBALANCEHOSTS', 'PGTARGETSESSIONATTRS']) {
    await t.test(key, () => {
      const f = fixture();
      try { f.noDispatch(f.cli(['--execute'], { [key]: 'remote.invalid' })); }
      finally { f.cleanup(); }
    });
  }
});

test('restore CLI preserves no-effect plan default and explicit execution opt-in', () => {
  for (const args of [[], ['--plan']]) {
    const f = fixture();
    try {
      const result = f.cli(args, { LETBUYY_RESTORE_DRILL_TARGET_URL: 'hostile input', PGHOSTADDR: '192.0.2.1' });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /plan only; no production\/shared DB action/);
      assert.deepEqual(f.calls(), []);
      assert.deepEqual(readdirSync(f.root), ['bin']);
    } finally { f.cleanup(); }
  }
  for (const [args, overrides] of [
    [['--execute'], { LETBUYY_RESTORE_DRILL_ALLOW_EXECUTE: '' }],
    [['--execute'], { LETBUYY_RESTORE_DRILL_ALLOW_EXECUTE: 'TRUE' }],
    [['--execute'], { LETBUYY_RESTORE_DRILL_SOURCE_URL: '' }],
    [['--execute'], { LETBUYY_RESTORE_DRILL_TARGET_URL: '' }],
    [['--execute', '--plan'], {}], [['--execuet'], {}], [['--execute', '--execute'], {}],
  ]) {
    const f = fixture();
    try { f.noDispatch(f.cli(args, overrides)); }
    finally { f.cleanup(); }
  }
});

test('valid distinct local CLI reaches only fake tools, normalizes endpoints and removes its exact workspace', () => {
  const f = fixture();
  try {
    const result = f.cli(['--execute'], {
      LETBUYY_RESTORE_DRILL_SOURCE_URL: 'postgres://fixture:synthetic-password@LOCALHOST:05433/%73ource?application_name=owned-drill&sslmode=disable&connect_timeout=2',
      LETBUYY_RESTORE_DRILL_TARGET_URL: 'postgresql://fixture:synthetic-password@[0:0:0:0:0:0:0:1]:5433/target',
    });
    assert.equal(result.status, 0, result.stderr);
    const [dump, restore] = f.calls();
    assert.deepEqual(f.calls().map(row => row.command), ['pg_dump', 'pg_restore']);
    assert.ok(dump.args.includes('--no-owner') && dump.args.includes('--no-acl'));
    assert.ok(restore.args.includes('--clean') && restore.args.includes('--if-exists'));
    assert.match(dump.args.at(-1), /^postgresql:\/\/fixture:synthetic-password@127\.0\.0\.1:5433\/source\?/);
    assert.match(restore.args[restore.args.indexOf('--dbname') + 1], /@\[::1\]:5433\/target$/);
    assert.equal(dump.args[dump.args.indexOf('--file') + 1], restore.args.at(-1));
    assert.equal(existsSync(restore.args.at(-1)), false);
    assert.deepEqual(readdirSync(f.root).sort(), ['bin', 'dispatch.jsonl']);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /synthetic-password/);
  } finally { f.cleanup(); }
});

test('tool failures stop later dispatch, clean only the owned workspace and suppress sensitive stderr', async (t) => {
  for (const command of ['pg_dump', 'pg_restore']) {
    await t.test(command, () => {
      const f = fixture();
      const unrelated = join(f.root, 'preserved-original');
      writeFileSync(unrelated, 'preserve');
      try {
        const result = f.cli(['--execute'], { LETBUYY_RESTORE_TEST_FAIL: command });
        assert.equal(result.status, 1);
        assert.match(result.stderr, new RegExp(`${command} failed`));
        assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sensitive-child-output|synthetic-password|postgresql:\/\//);
        assert.deepEqual(f.calls().map(row => row.command), command === 'pg_dump' ? ['pg_dump'] : ['pg_dump', 'pg_restore']);
        assert.deepEqual(readdirSync(f.root).sort(), ['bin', 'dispatch.jsonl', 'preserved-original']);
        assert.equal(readFileSync(unrelated, 'utf8'), 'preserve');
      } finally { f.cleanup(); }
    });
  }
});

test('import is inert even with execution opt-in and exports a pure preflight', async () => {
  const f = fixture();
  try {
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `const m = await import(${JSON.stringify(scriptUrl.href)}); if (typeof m.preflightRestore !== 'function') throw new Error('missing preflight');`], { env: f.env, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(f.calls(), []);
    assert.deepEqual(readdirSync(f.root), ['bin']);
    const { preflightRestore } = await import(scriptUrl.href);
    const plan = preflightRestore(['--execute'], { ...f.env, LETBUYY_RESTORE_DRILL_SOURCE_URL: 'postgresql://fixture@localhost/same', LETBUYY_RESTORE_DRILL_TARGET_URL: 'postgresql://fixture@127.0.0.1:5434/same' });
    assert.equal(plan.execute, true, 'distinct loopback ports must stay usable');
    assert.deepEqual(f.calls(), []);
  } finally { f.cleanup(); }
});

test('missing local tool fails safely without fallback dispatch and preserves unrelated files', () => {
  const f = fixture();
  try {
    rmSync(join(f.root, 'bin', 'pg_dump'));
    const result = f.cli(['--execute'], { PATH: join(f.root, 'bin') });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /pg_dump failed/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /synthetic-password|postgresql:\/\//);
    assert.deepEqual(f.calls(), []);
    assert.deepEqual(readdirSync(f.root), ['bin']);
    assert.equal(existsSync(join(f.root, 'bin', 'pg_restore')), true);
  } finally { f.cleanup(); }
});
