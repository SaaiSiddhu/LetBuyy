import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const runnerSource = readFileSync(new URL('../src/money-ledger-reconciliation.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

test('money ledger reconciliation runner refreshes every active site through the canonical RPC', () => {
  assert.match(runnerSource, /createSupabaseServiceClient/);
  assert.match(runnerSource, /\.from\('sites'\)/);
  assert.match(runnerSource, /refresh_money_ledger_site_reconciliation/);
  assert.match(runnerSource, /MONEY_LEDGER_RECONCILIATION_BATCH_LIMIT/);
  assert.match(runnerSource, /status:\s*'failed'/);
});

test('queue-worker scheduled handler runs money ledger reconciliation without a new service', () => {
  assert.match(indexSource, /runMoneyLedgerReconciliation/);
  assert.match(indexSource, /scheduled:money-ledger-reconciliation/);
  assert.match(indexSource, /scheduled\.money_ledger_reconciliation/);
});
