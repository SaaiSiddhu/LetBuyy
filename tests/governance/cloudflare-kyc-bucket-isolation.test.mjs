import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const validator = join(root, 'scripts/validators/cloudflare-binding-validator.mjs');
const sourceManifest = JSON.parse(readFileSync(join(root, 'config/runtime/cloudflare-binding-ownership.json'), 'utf8'));
const sourceWrangler = readFileSync(join(root, 'services/api-gateway/wrangler.toml'), 'utf8');
const publicStaging = '[[env.staging.r2_buckets]]\nbinding = "R2_BUCKET"\nbucket_name = "letbuyy-media-staging"';
const publicProduction = '[[env.production.r2_buckets]]\nbinding = "R2_BUCKET"\nbucket_name = "letbuyy-media-production"';
const publicDefault = '[[r2_buckets]]\nbinding = "R2_BUCKET"\nbucket_name = "letbuyy-media-staging"';

test('Cloudflare binding gate refuses every R2 KYC bucket under India-only evidence policy', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'letbuyy-kyc-bucket-gate-'));
  try {
    mkdirSync(join(fixture, 'config/runtime'), { recursive: true });
    mkdirSync(join(fixture, 'services/api-gateway'), { recursive: true });
    writeFileSync(join(fixture, sourceManifest.$schema), '{}');
    const run = (scope, bucketName) => {
      const manifest = { ...sourceManifest, workers: [structuredClone(sourceManifest.workers[0])] };
      if (scope !== 'default') manifest.workers[0].environments[scope].r2Buckets.push('KYC_PRIVATE_BUCKET');
      writeFileSync(join(fixture, 'config/runtime/cloudflare-binding-ownership.json'), JSON.stringify(manifest));
      const publicBlock = scope === 'staging' ? publicStaging : scope === 'production' ? publicProduction : publicDefault;
      const table = scope === 'default' ? 'r2_buckets' : `env.${scope}.r2_buckets`;
      const config = sourceWrangler.replace(publicBlock,
        `${publicBlock}\n\n[[${table}]]\nbinding = "KYC_PRIVATE_BUCKET"\nbucket_name = "${bucketName}"`);
      writeFileSync(join(fixture, 'services/api-gateway/wrangler.toml'), config);
      return spawnSync(process.execPath, [validator], { cwd: fixture, encoding: 'utf8' });
    };
    for (const scope of ['default', 'staging', 'production']) {
      const separateBucket = run(scope, `letbuyy-kyc-private-${scope}`);
      assert.notEqual(separateBucket.status, 0, `${scope} must reject even a separate R2 KYC bucket`);
      assert.match(separateBucket.stdout + separateBucket.stderr,
        new RegExp(`India-only KYC evidence must not use a Cloudflare R2 binding.*${scope}`));
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
