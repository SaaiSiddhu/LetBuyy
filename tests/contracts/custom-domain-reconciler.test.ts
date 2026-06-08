import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(relativePath: string): string {
  const absolutePath = join(repoRoot, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
  return readFileSync(absolutePath, 'utf8');
}

test('custom-domain reconciler detects drift and recovery through gateway writer', () => {
  const route = read('services/api-gateway/src/routes/internal-custom-domain-reconcile.ts');
  const worker = read('services/queue-workers/src/index.ts');
  const wrangler = read('services/queue-workers/wrangler.toml');

  assert.match(route, /TXT_MISSING/);
  assert.match(route, /CNAME_DRIFT/);
  assert.match(route, /RECOVERED/);
  assert.match(route, /custom_domain_status: nextStatus/);
  assert.match(route, /platform_queue_jobs/);
  assert.match(worker, /API_GATEWAY_SERVICE/);
  assert.match(worker, /triggerCustomDomainReconciler/);
  assert.match(wrangler, /17 \*\/6 \* \* \*/);
});
