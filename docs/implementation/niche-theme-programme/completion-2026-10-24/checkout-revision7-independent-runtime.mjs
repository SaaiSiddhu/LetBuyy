import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
const candidate = '/private/tmp/madeyours-checkout-reentry-proposal-20261024-07';
const req = createRequire(candidate + '/services/api-gateway/package.json');
let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; throw Error('Independent admission forbids network'); };
const resolved = realpathSync(req.resolve('@letbuyy/checkout-core'));
assert.equal(resolved, candidate + '/packages/checkout-core/src/index.ts');
assert.equal(typeof req('@letbuyy/checkout-core').canonicalCheckoutBuyerBinding, 'function');
assert.equal(typeof req('./src/index.ts').default.fetch, 'function');
const { seedBuyerAccount } = req('./src/__tests__/owned-db/gateway-harness.ts');
let sqlStubCalls = 0;
const stub = () => { sqlStubCalls++; return ''; };
assert.throws(() => seedBuyerAccount(stub, `reentry-${crypto.randomUUID()}`), /buyer label/);
assert.equal(sqlStubCalls, 0);
const label = `reentry-${crypto.randomUUID().slice(0, 16)}`;
assert.equal(label.length, 24);
const buyer = seedBuyerAccount(stub, label);
assert.equal(sqlStubCalls, 1);
assert.match(buyer.email, /@example\.invalid$/);
const loaded = Object.keys(req.cache).filter(path => /\.[cm]?[jt]sx?$/.test(path));
const mainSource = loaded.filter(path => path.startsWith('/Volumes/Projects/LetBuyy/') && !path.includes('/node_modules/.pnpm/'));
const declarations = loaded.filter(path => /\.d\.[cm]?ts$/.test(path));
assert.deepEqual(mainSource, []);
assert.deepEqual(declarations, []);
assert.equal(fetchCalls, 0);
const result = {
  recordedAt: new Date().toISOString(), classification: 'INDEPENDENT_ACTUAL07_RUNTIME_AND_FIXTURE_GUARD_PROOF_NOT_NATIVE',
  candidate, buyerBindingResolved: resolved, workerFetch: true,
  actualHarnessNegativePositiveControls: 'PASS', loadedPrivateModules: loaded.filter(path => path.startsWith(candidate + '/')).length,
  loadedMainSource: mainSource.length, declarationsExecuted: declarations.length, fetchCalls, realSqlCalls: 0,
  testFileSha256: createHash('sha256').update(readFileSync(candidate + '/services/api-gateway/src/__tests__/owned-db/hosted-checkout-contact-reentry.postgres.test.ts')).digest('hex'),
  nativeExecuted: false, browser: false, providerCalls: 0,
};
writeFileSync(new URL('checkout-revision7-independent-runtime.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
