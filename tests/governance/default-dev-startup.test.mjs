// APPID-P2 — the default development commands start the maintained applications and never a frozen,
// deferred or reference one.
//
// The founder, 2026-09-24: "Default development startup should launch the maintained application set,
// not frozen or deferred surfaces." Until APPID-P2, `pnpm dev:all` was an unfiltered `turbo run dev`,
// which started all four frozen web apps alongside the workers. These tests read the committed root
// scripts, the port map and the local-stack app list, and ask turbo itself which packages each script
// would start.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
process.chdir(repoRoot);
const { APP_PORTS, DEFAULT_DEV_APPS, SERVICE_PORTS } = await import('../../scripts/dev/ports.mjs');
const { deferredAppRoots, frozenAppRoots, referenceAppRoots } = await import('../../scripts/validators/governance-common.mjs');

const readJson = (rel) => JSON.parse(fs.readFileSync(join(repoRoot, rel), 'utf8'));
const scripts = readJson('package.json').scripts;
const nameOf = (root) => readJson(`${root}/package.json`).name;
const maintained = DEFAULT_DEV_APPS.map((app) => nameOf(`apps/${app}`)).sort();
const frozen = frozenAppRoots.map(nameOf).sort();
const workers = Object.keys(SERVICE_PORTS).map((svc) => nameOf(`services/${svc}`)).sort();

// The packages a root script would start, as turbo resolves them (no process is launched).
function turboDevPackages(scriptName) {
  const script = scripts[scriptName];
  assert.ok(script && script.includes('turbo run dev'), `${scriptName} must run turbo dev`);
  const args = script.split('turbo run dev')[1];
  const result = spawnSync('/bin/sh', ['-c', `pnpm exec turbo run dev --dry=json ${args}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  return [...new Set(plan.tasks.filter((task) => task.task === 'dev').map((task) => task.package))].sort();
}

test('the maintained set is exactly the ACTIVE and SUPPORTING web applications', () => {
  for (const app of DEFAULT_DEV_APPS) {
    const root = `apps/${app}`;
    assert.ok(!frozenAppRoots.includes(root) && !deferredAppRoots.includes(root) && !referenceAppRoots.includes(root), `${root} is not maintained`);
  }
  const frozenPorts = Object.keys(APP_PORTS).filter((app) => frozenAppRoots.includes(`apps/${app}`));
  assert.equal(frozenPorts.length, frozenAppRoots.length, 'every frozen web app keeps a port for deliberate use');
  assert.deepEqual([...DEFAULT_DEV_APPS, ...frozenPorts].sort(), Object.keys(APP_PORTS).sort());
});

test('pnpm dev starts the maintained apps, Storybook and the gateway, and nothing frozen', () => {
  assert.deepEqual(turboDevPackages('dev'), [...maintained, '@letbuyy/api-gateway', '@letbuyy/ui'].sort());
});

test('pnpm dev:apps starts exactly the maintained apps', () => {
  assert.deepEqual(turboDevPackages('dev:apps'), maintained);
});

test('pnpm dev:all adds the four workers and still no frozen app', () => {
  const started = turboDevPackages('dev:all');
  assert.deepEqual(started, [...maintained, ...workers, '@letbuyy/ui'].sort());
  for (const name of frozen) assert.ok(!started.includes(name), `dev:all starts frozen ${name}`);
});

test('frozen apps start only through pnpm dev:frozen', () => {
  assert.deepEqual(turboDevPackages('dev:frozen'), frozen);
  for (const [name, script] of Object.entries(scripts)) {
    if (name === 'dev:frozen' || !script.includes('turbo run dev')) continue;
    for (const pkg of frozen) assert.ok(!script.includes(`--filter=${pkg}`), `${name} names frozen ${pkg}`);
    assert.match(script, /--filter=/, `${name} is an unfiltered turbo dev, which would start every frozen app`);
  }
});

test('the local stack starts frozen apps only with --include-frozen', () => {
  // local-stack-up.mjs boots Supabase when imported, so its app list is read, not executed.
  const source = fs.readFileSync(join(repoRoot, 'scripts/utilities/local-stack-up.mjs'), 'utf8');
  const entries = [...source.matchAll(/\{\s*name:\s*"[^"]+",\s*cwd:\s*"([^"]+)"[^}]*\}/g)];
  assert.ok(entries.length >= frozenAppRoots.length, 'no app entries found; the check would be inert');
  for (const [entry, cwd] of entries) {
    if (frozenAppRoots.includes(cwd)) assert.match(entry, /frozen:\s*true/, `${cwd} is frozen but not flagged`);
    assert.ok(!deferredAppRoots.includes(cwd) && !referenceAppRoots.some((r) => cwd.startsWith(r)), `${cwd} must never be in the local stack`);
  }
  assert.match(source, /\.filter\(\(app\) => includeFrozen \|\| !app\.frozen\)/);
  assert.match(source, /const includeFrozen = process\.argv\.includes\("--include-frozen"\)/);
});
