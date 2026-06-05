import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/production-deploy.yml', 'utf8');

function indexOf(fragment) {
  const index = workflow.indexOf(fragment);
  assert.notEqual(index, -1, `${fragment} exists`);
  return index;
}

test('production deploy workflow fails closed on missing release credentials', () => {
  assert.match(workflow, /release-preflight:/);
  assert.match(workflow, /Missing required production release credentials/);
  assert.match(workflow, /PRODUCTION_CUSTOMER_SESSION_SECRET/);
  assert.match(workflow, /PRODUCTION_BACKUP_ARTIFACT_PASSPHRASE/);
  assert.doesNotMatch(workflow, /Skip production migrations/);
  assert.doesNotMatch(workflow, /Skip worker deployment/);
  assert.doesNotMatch(workflow, /Skip app deployment/);
  assert.doesNotMatch(workflow, /SKIP - production/);
});

test('production migrations require approval plus diff and encrypted backup evidence', () => {
  assert.match(workflow, /environment: production-migrations/);
  assert.match(workflow, /supabase@latest db diff/);
  assert.match(workflow, /name: production-migration-diff/);
  assert.match(workflow, /pg_dump --format=custom/);
  assert.match(workflow, /gpg --batch --yes --symmetric/);
  assert.match(workflow, /name: production-pre-migration-backup/);
  assert.match(workflow, /supabase@latest db push/);
});

test('worker secrets are written before production Worker deploys', () => {
  const apiSecretIndex = indexOf('Set api-gateway production secrets');
  const apiDeployIndex = indexOf('Deploy api-gateway to production');
  assert.ok(apiSecretIndex < apiDeployIndex, 'api-gateway secrets must be set before deploy');

  const webhookSecretIndex = indexOf('Set webhook-service production secrets');
  const webhookDeployIndex = indexOf('Deploy webhook-service to production');
  assert.ok(webhookSecretIndex < webhookDeployIndex, 'webhook secrets must be set before deploy');

  assert.match(workflow, /wrangler secret put CUSTOMER_SESSION_SECRET --env production/);
});

test('production smoke runs only after explicit required-job success gate', () => {
  const gateIndex = indexOf('release-required-jobs-succeeded:');
  const smokeIndex = indexOf('smoke-test-production:');
  assert.ok(gateIndex < smokeIndex, 'required-job gate must precede smoke tests');
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /deploy-workers-production=\$\{WORKERS_RESULT\}/);
  assert.match(workflow, /deploy-apps-production=\$\{APPS_RESULT\}/);
  assert.match(workflow, /needs: release-required-jobs-succeeded/);
});
