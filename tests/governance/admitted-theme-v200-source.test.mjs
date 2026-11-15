import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const script = 'scripts/governance/check-admitted-theme-v200-source.mjs';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

test('admitted 2.0.0 theme factory reproduces exact historical bytes in isolation', () => {
  assert.equal(sha256(readFileSync(join(root, script))),
    'a89ae8f87d1f5df27c449a8e1ad76887c84749847d97538545d0738ca332b2ea');
  const result = JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', join(root, script)],
    { cwd: root, encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 }));
  assert.equal(result.status, 'HISTORICAL_FACTORY_PARITY_ONLY');
  assert.equal(result.archivedOriginalsVerified, 21);
  assert.deepEqual(result.frozenDefaults, { match: 10, total: 10 });
  assert.deepEqual(result.admittedV200, { match: 9, total: 9 });
  assert.deepEqual(result.mismatches, []);
});
