import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const WORKER_CONFIGS = [
  'services/api-gateway/wrangler.toml',
  'services/queue-workers/wrangler.toml',
  'services/webhook-service/wrangler.toml',
];

const OBSERVABILITY_SECTIONS = [
  'observability',
  'observability.logs',
  'env.staging.observability',
  'env.staging.observability.logs',
  'env.production.observability',
  'env.production.observability.logs',
];

function sectionBlock(source, sectionName, configPath) {
  const header = `[${sectionName}]`;
  const start = source.indexOf(header);
  assert.notEqual(start, -1, `${configPath} must declare ${header}`);

  const rest = source.slice(start + header.length);
  const nextHeader = rest.search(/\n\[[^\n]+\]/);
  return nextHeader === -1 ? rest : rest.slice(0, nextHeader);
}

function headSamplingRate(block, sectionName, configPath) {
  const match = block.match(/^head_sampling_rate\s*=\s*([0-9.]+)$/m);
  assert.ok(match, `${configPath} ${sectionName} must declare head_sampling_rate`);
  return Number(match[1]);
}

test('canonical Worker configs sample observability heads at the cost-control target', () => {
  for (const configPath of WORKER_CONFIGS) {
    const source = readFileSync(configPath, 'utf8');

    for (const sectionName of OBSERVABILITY_SECTIONS) {
      const block = sectionBlock(source, sectionName, configPath);
      const rate = headSamplingRate(block, sectionName, configPath);
      assert.equal(rate, 0.1, `${configPath} ${sectionName} should sample at 10%`);
    }

    assert.doesNotMatch(
      source,
      /^head_sampling_rate\s*=\s*1$/m,
      `${configPath} must not retain full Worker head sampling`,
    );
  }
});

test('Worker log sections keep invocation logs enabled while sampling heads', () => {
  for (const configPath of WORKER_CONFIGS) {
    const source = readFileSync(configPath, 'utf8');

    for (const sectionName of OBSERVABILITY_SECTIONS.filter((section) => section.endsWith('.logs'))) {
      const block = sectionBlock(source, sectionName, configPath);
      assert.match(block, /^enabled\s*=\s*true$/m, `${configPath} ${sectionName} must remain enabled`);
      assert.match(block, /^invocation_logs\s*=\s*true$/m, `${configPath} ${sectionName} must keep invocation logs`);
    }
  }
});
