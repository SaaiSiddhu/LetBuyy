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

test('Cloudflare binding gate refuses a KYC bucket that names public media storage', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'letbuyy-kyc-bucket-gate-'));
  try {
    mkdirSync(join(fixture, 'config/runtime'), { recursive: true });
    mkdirSync(join(fixture, 'services/api-gateway'), { recursive: true });
    writeFileSync(join(fixture, sourceManifest.$schema), '{}');
    const manifest = { ...sourceManifest, workers: [structuredClone(sourceManifest.workers[0])] };
    manifest.workers[0].environments.staging.r2Buckets.push('KYC_PRIVATE_BUCKET');
    writeFileSync(join(fixture, 'config/runtime/cloudflare-binding-ownership.json'), JSON.stringify(manifest));
    const run = (bucketName, productionBucketName, defaultBucketName) => {
      let config = sourceWrangler.replace(publicStaging,
        `${publicStaging}\n\n[[env.staging.r2_buckets]]\nbinding = "KYC_PRIVATE_BUCKET"\nbucket_name = "${bucketName}"`);
      if (productionBucketName) config = config.replace(publicProduction,
        `${publicProduction}\n\n[[env.production.r2_buckets]]\nbinding = "KYC_PRIVATE_BUCKET"\nbucket_name = "${productionBucketName}"`);
      if (defaultBucketName) config = config.replace(publicDefault,
        `${publicDefault}\n\n[[r2_buckets]]\nbinding = "KYC_PRIVATE_BUCKET"\nbucket_name = "${defaultBucketName}"`);
      writeFileSync(join(fixture, 'services/api-gateway/wrangler.toml'), config);
      return spawnSync(process.execPath, [validator], { cwd: fixture, encoding: 'utf8' });
    };
    const isolated = run('letbuyy-kyc-private-staging');
    assert.equal(isolated.status, 0, isolated.stdout + isolated.stderr);
    const aliased = run('letbuyy-media-staging');
    assert.notEqual(aliased.status, 0, 'a public bucket alias must fail the gate');
    assert.match(aliased.stdout + aliased.stderr, /KYC private R2 bucket must name a different bucket/);
    manifest.workers[0].environments.production.r2Buckets.push('KYC_PRIVATE_BUCKET');
    writeFileSync(join(fixture, 'config/runtime/cloudflare-binding-ownership.json'), JSON.stringify(manifest));
    const crossEnvironment = run('letbuyy-kyc-private-staging', 'letbuyy-media-staging');
    assert.notEqual(crossEnvironment.status, 0, 'production KYC cannot reuse staging public media');
    assert.match(crossEnvironment.stdout + crossEnvironment.stderr, /KYC private R2 bucket must not reuse any public media bucket/);
    const defaultAlias = run('letbuyy-kyc-private-staging', 'letbuyy-kyc-private-production', 'letbuyy-media-staging');
    assert.notEqual(defaultAlias.status, 0, 'the default Worker cannot use public media for KYC');
    assert.match(defaultAlias.stdout + defaultAlias.stderr, /KYC private R2 bucket must name a different bucket.*default/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
