import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { MockRegistrarProvider, createDomainRegistrarProvider } from '../../services/api-gateway/src/lib/registrar';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(relativePath: string): string {
  const absolutePath = join(repoRoot, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
  return readFileSync(absolutePath, 'utf8');
}

test('mock registrar covers search and purchase happy path without live credentials', async () => {
  const provider = new MockRegistrarProvider({ REGISTRAR_DEFAULT_CURRENCY: 'INR' });
  const quote = await provider.searchDomain('example-buy-domain.in');
  assert.equal(quote.available, true);
  assert.equal(quote.provider, 'mock');

  const purchase = await provider.purchaseDomain({
    domain: quote.domain,
    years: 1,
    owner: { name: 'Example Merchant', email: 'merchant@example.test' },
    paymentReference: 'razorpay:test',
    idempotencyKey: 'test-key',
  });
  assert.equal(purchase.domain, quote.domain);
  assert.equal(purchase.provider, 'mock');
});

test('registrar provider fails loud without credentials and gateway owns domain_orders', () => {
  assert.throws(() => createDomainRegistrarProvider({ REGISTRAR_PROVIDER: 'resellerclub' }));

  const route = read('services/api-gateway/src/routes/domains.ts');
  const migration = read('database/supabase/migrations/090_custom_domains_and_store_access.sql');
  const singleWriter = read('scripts/validators/single-writer-ownership-validator.mjs');

  assert.match(route, /router\.get\('\/search'/);
  assert.match(route, /router\.post\('\/purchase'/);
  assert.match(route, /domain_orders/);
  assert.match(route, /payment_provider: 'razorpay'/);
  assert.match(route, /attachVercelProjectDomain/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.domain_orders/);
  assert.match(singleWriter, /domain_orders/);
});
