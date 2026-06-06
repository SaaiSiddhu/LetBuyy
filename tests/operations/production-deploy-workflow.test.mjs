import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/production-deploy.yml', 'utf8');
const rolloutWorkflow = readFileSync('.github/workflows/production-rollout.yml', 'utf8');
const vercelProjects = JSON.parse(readFileSync('config/vercel/projects.json', 'utf8'));
const productionTopology = JSON.parse(readFileSync('config/runtime/production-topology.json', 'utf8'));

function indexOf(fragment) {
  const index = workflow.indexOf(fragment);
  assert.notEqual(index, -1, `${fragment} exists`);
  return index;
}

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function productionVercelApps() {
  return vercelProjects.apps.map((app) => ({
    appName: app.directory.replace(/^apps\//, ''),
    directory: app.directory,
    projectId: app.production.project_id,
  }));
}

test('production deploy workflow fails closed on missing release credentials', () => {
  assert.match(workflow, /release-preflight:/);
  assert.match(workflow, /group: production-release-production/);
  assert.match(rolloutWorkflow, /group: production-release-\$\{\{ inputs\.environment \}\}/);
  assert.match(workflow, /Missing required production release credentials/);
  assert.match(workflow, /PRODUCTION_CUSTOMER_SESSION_SECRET/);
  assert.match(workflow, /PRODUCTION_BACKUP_ARTIFACT_PASSPHRASE/);
  assert.doesNotMatch(workflow, /Skip production migrations/);
  assert.doesNotMatch(workflow, /Skip worker deployment/);
  assert.doesNotMatch(workflow, /Skip app deployment/);
  assert.doesNotMatch(workflow, /SKIP - production/);
});

test('production migration gate precedes staging smoke and production migration', () => {
  const preflightIndex = indexOf('release-preflight:');
  const migrationGateIndex = indexOf('migration-preflight:');
  const stagingIndex = indexOf('staging-e2e:');
  const migrateIndex = indexOf('migrate-production:');
  const workerDeployIndex = indexOf('deploy-workers-production:');
  const appDeployIndex = indexOf('deploy-apps-production:');

  assert.ok(preflightIndex < migrationGateIndex, 'credential preflight must precede migration gate');
  assert.ok(migrationGateIndex < stagingIndex, 'migration gate must precede staging smoke');
  assert.ok(stagingIndex < migrateIndex, 'staging smoke must precede production migration');
  assert.ok(migrateIndex < workerDeployIndex, 'production migration must precede Worker deployment');
  assert.ok(workerDeployIndex < appDeployIndex, 'Workers must deploy before apps');
  assert.match(workflow, /migration-preflight:\n[\s\S]*?environment: production-migrations/);
  assert.match(workflow, /staging-e2e:\n[\s\S]*?needs: migration-preflight/);
  assert.match(workflow, /migrate-production:\n[\s\S]*?needs: staging-e2e/);
  assert.match(workflow, /deploy-workers-production:\n[\s\S]*?needs: migrate-production/);
  assert.match(workflow, /deploy-apps-production:\n[\s\S]*?needs: deploy-workers-production/);
});

test('production migrations require approval plus diff and encrypted backup evidence', () => {
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
  assert.match(workflow, /migration-preflight=\$\{MIGRATION_PREFLIGHT_RESULT\}/);
  assert.match(workflow, /deploy-workers-production=\$\{WORKERS_RESULT\}/);
  assert.match(workflow, /deploy-apps-production=\$\{APPS_RESULT\}/);
  assert.match(workflow, /needs: release-required-jobs-succeeded/);
});

test('production app deployment matrices match production Vercel topology', () => {
  const topologyAppRoots = productionTopology.runtimes
    .map((runtime) => runtime.runtimeRoot)
    .filter((runtimeRoot) => runtimeRoot.startsWith('apps/') && !runtimeRoot.startsWith('apps/mobile/'))
    .sort();
  const vercelAppRoots = productionVercelApps()
    .map((app) => app.directory)
    .sort();

  assert.deepEqual(vercelAppRoots, topologyAppRoots);

  for (const app of productionVercelApps()) {
    assert.match(
      workflow,
      new RegExp(`- app: ${regexEscape(app.appName)}\\s+project_id: ${regexEscape(app.projectId)}`),
      `${app.appName} is in production-deploy.yml`,
    );
    assert.ok(workflow.includes(`HAS_${app.projectId}:`), `${app.projectId} is required by release preflight`);
    assert.ok(workflow.includes(`missing+=("${app.projectId}")`), `${app.projectId} fails closed when missing`);
  }
});

test('legacy production deploy workflow stays retired', () => {
  assert.equal(existsSync('.github/workflows/deploy-production.yml'), false);
});
