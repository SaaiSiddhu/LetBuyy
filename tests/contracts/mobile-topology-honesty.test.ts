import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const reservedMobileRoots = [
  'apps/mobile/shopper-app',
  'apps/mobile/operator-app',
];

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));
}

function trackedFiles(prefix: string) {
  return execFileSync('git', ['ls-files', prefix], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

test('shopper and operator mobile roots are reserved rather than active canonical app runtimes', () => {
  const source = readFileSync(resolve(repoRoot, 'scripts/validators/governance-common.mjs'), 'utf8');

  assert.match(source, /export const reservedMobileRuntimeRoots = \[/);
  assert.match(source, /"apps\/mobile\/shopper-app"/);
  assert.match(source, /"apps\/mobile\/operator-app"/);

  const canonicalBlock = source.match(/export const canonicalAppRoots = \[([\s\S]*?)\];/)?.[1] ?? '';
  // F-RENAMESTALE-1. This read /"apps\/mobile\/merchant-app"/ and had been failing since Phase M
  // renamed that root to apps/merchant_app (governance-common.mjs:81). The load-bearing half of this
  // test is the two doesNotMatch assertions below — a RESERVED root must never appear among the
  // canonical ones — and they never stopped holding. Only the positive literal went stale. It is now
  // checked to exist as well, so a future rename fails this for the right reason.
  const merchantAppRoot = 'apps/merchant_app';
  assert.match(canonicalBlock, new RegExp(`"${merchantAppRoot.replace(/\//g, '\\/')}"`));
  assert.equal(
    existsSync(resolve(repoRoot, merchantAppRoot)),
    true,
    `canonicalAppRoots must name a root that exists; ${merchantAppRoot} is missing`,
  );
  assert.doesNotMatch(canonicalBlock, /apps\/mobile\/shopper-app/);
  assert.doesNotMatch(canonicalBlock, /apps\/mobile\/operator-app/);
});

test('reserved mobile roots contain only AGENTS and runtime manifest files', () => {
  for (const root of reservedMobileRoots) {
    assert.deepEqual(trackedFiles(root).sort(), [
      `${root}/AGENTS.md`,
      `${root}/runtime.manifest.json`,
    ]);

    const manifest = readJson(`${root}/runtime.manifest.json`);
    assert.equal(manifest.implementationStatus.status, 'reserved-not-implemented');
    assert.equal(manifest.implementationStatus.sourceState, 'manifest-and-agents-only');
    assert.match(manifest.ownership.businessAuthority, /Reserved\/not-implemented|does not own active/i);
    assert.match(manifest.deploymentAuthority.platform, /Reserved only - no deployable mobile runtime artifact/);
  }
});

test('operator Flutter counter starter is archived outside active mobile source', () => {
  const archivedMain = readFileSync(resolve(repoRoot, 'docs/archive/mobile-topology/operator-app-starter/lib/main.dart'), 'utf8');
  const archivedTest = readFileSync(resolve(repoRoot, 'docs/archive/mobile-topology/operator-app-starter/test/widget_test.dart'), 'utf8');

  assert.match(archivedMain, /Flutter Demo/);
  assert.match(archivedMain, /_counter/);
  assert.match(archivedTest, /Counter increments smoke test/);
});

test('reserved mobile roots are absent from deployment and production topology', () => {
  const deployment = readJson('config/runtime/deployment-topology.json');
  const production = readJson('config/runtime/production-topology.json');
  const deploymentRoots = new Set(deployment.nodes.map((node: { runtimeRoot: string }) => node.runtimeRoot));
  const productionRoots = new Set(production.runtimes.map((runtime: { runtimeRoot: string }) => runtime.runtimeRoot));

  for (const root of reservedMobileRoots) {
    assert.equal(deploymentRoots.has(root), false);
    assert.equal(productionRoots.has(root), false);
  }

  assert.equal(deploymentRoots.has('apps/merchant_app'), true);
  assert.equal(productionRoots.has('apps/merchant_app'), true);
});
