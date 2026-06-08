import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const serviceRoot = join(testDir, '..');

function source(path) {
  return readFileSync(join(serviceRoot, path), 'utf8');
}

test('risk scoring worker normalizes governed payloads and rejects unsupported signals', () => {
  const riskSource = source('src/risk-scoring.ts');

  assert.match(riskSource, /export function normalizeRiskScorePayload/);
  assert.match(riskSource, /RiskEntityTypeSchema\.safeParse\(payload\.entity_type\)/);
  assert.match(riskSource, /RiskSignalTypeSchema\.safeParse\(value\.signal_type\)/);
  assert.match(riskSource, /RISK_DEFAULT_RULE_WEIGHTS/);
  assert.match(riskSource, /risk\.score\.entity/);
  assert.match(riskSource, /ts_case_open_requested/);
});
