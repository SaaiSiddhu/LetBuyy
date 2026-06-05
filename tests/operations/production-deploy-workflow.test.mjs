import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/production-deploy.yml', 'utf8');
const legacyWorkflow = readFileSync('.github/workflows/deploy-production.yml', 'utf8');
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
    assert.match(
      legacyWorkflow,
      new RegExp(`name: ${regexEscape(app.appName)}, project_secret: ${regexEscape(app.projectId)}`),
      `${app.appName} is in deploy-production.yml`,
    );
  }

  assert.match(legacyWorkflow, /https:\/\/developers\.letbuyy\.store/);
});
