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

function jobBlock(name, nextName) {
  const block = workflow.split(`  ${name}:`)[1]?.split(`\n  ${nextName}:`)[0] || '';
  assert.notEqual(block, '', `${name} job block exists`);
  return block;
}

function productionVercelApps() {
  const activeProductionAppRoots = new Set(
    productionTopology.runtimes
      .filter((runtime) => runtime.environment === 'production' && runtime.status === 'active')
      .map((runtime) => runtime.runtimeRoot),
  );
  return vercelProjects.apps
    .filter((app) => activeProductionAppRoots.has(app.directory))
    .map((app) => ({
      appName: app.directory.replace(/^apps\//, ''),
      directory: app.directory,
      projectId: app.production.project_id,
    }));
}

test('production deploy workflow fails closed on missing release credentials', () => {
  assert.match(workflow, /governance-gate:/);
  assert.match(workflow, /node scripts\/validate-governance\.mjs --lane=gate/);
  assert.match(rolloutWorkflow, /governance-gate:/);
  assert.match(rolloutWorkflow, /needs: governance-gate/);
  assert.match(rolloutWorkflow, /node scripts\/validate-governance\.mjs --lane=gate/);
  assert.match(workflow, /release-preflight:/);
  assert.match(workflow, /group: production-release-production/);
  assert.match(rolloutWorkflow, /group: production-release-\$\{\{ inputs\.environment \}\}/);
  assert.match(workflow, /Missing required production release credentials/);
  assert.match(workflow, /PRODUCTION_CUSTOMER_SESSION_SECRET/);
  assert.match(workflow, /PRODUCTION_CHECKOUT_SIGNING_SECRET/);
  assert.match(workflow, /PRODUCTION_STEP_UP_SIGNING_SECRET/);
  assert.match(workflow, /PRODUCTION_BACKUP_ARTIFACT_PASSPHRASE/);
  assert.doesNotMatch(workflow, /Skip production migrations/);
  assert.doesNotMatch(workflow, /Skip worker deployment/);
  assert.doesNotMatch(workflow, /Skip app deployment/);
  assert.doesNotMatch(workflow, /SKIP - production/);
});

test('governance gate job has full history, integration branch context, and installed dependencies before running the gate', () => {
  // Regression guard for run 31874926206 (commit 5af69e0c): the embedded
  // branch-lag-guard-validator.mjs and the typescript-resolving validators
  // failed inside this job specifically, even though an identical-looking
  // assertion elsewhere in the file (the dedicated branch-lag-guard job)
  // was already satisfied. Assertions here MUST be scoped to this job's own
  // text — matching anywhere in the workflow file would have passed before
  // the fix and given no protection against reverting it.
  const block = jobBlock('governance-gate', 'release-preflight');

  assert.match(block, /fetch-depth: 0/, 'governance-gate checkout must fetch full history');
  assert.match(block, /pnpm\/action-setup@v4/, 'governance-gate must install pnpm before running the gate');
  assert.match(block, /cache: pnpm/, 'governance-gate node setup must cache pnpm');
  assert.match(block, /pnpm install --frozen-lockfile/, 'governance-gate must install dependencies before running the gate');
  assert.match(block, /LETBUYY_ENFORCE_BRANCH_LAG: "1"/, 'governance-gate must enforce branch lag for the embedded validator');
  assert.match(block, /LETBUYY_PRODUCTION_BRANCH: main/, 'governance-gate must scope branch-lag enforcement to main');
  assert.match(block, /LETBUYY_RELEASE_INTEGRATION_BRANCH: stepup\/main/, 'governance-gate must scope branch-lag enforcement to stepup/main');

  const installIndex = block.indexOf('pnpm install --frozen-lockfile');
  const gateRunIndex = block.indexOf('node scripts/validate-governance.mjs --lane=gate');
  assert.ok(
    installIndex !== -1 && gateRunIndex !== -1 && installIndex < gateRunIndex,
    'dependencies must be installed before the governance gate runs',
  );
  assert.match(
    block,
    /node scripts\/validate-governance\.mjs --lane=gate\s+env:\s+LETBUYY_ENFORCE_BRANCH_LAG: "1"/,
    'branch-lag enforcement env must be attached to the governance gate run step itself, not merely present in the job',
  );
});

test('production migration gate precedes staging smoke and production migration', () => {
  const governanceGateIndex = indexOf('governance-gate:');
  const preflightIndex = indexOf('release-preflight:');
  const migrationGateIndex = indexOf('migration-preflight:');
  const stagingIndex = indexOf('staging-e2e:');
  const migrateIndex = indexOf('migrate-production:');
  const workerDeployIndex = indexOf('deploy-workers-production:');
  const appDeployIndex = indexOf('deploy-apps-production:');

  assert.ok(governanceGateIndex < preflightIndex, 'governance gate must precede credential preflight');
  assert.ok(preflightIndex < migrationGateIndex, 'credential preflight must precede migration gate');
  assert.ok(migrationGateIndex < stagingIndex, 'migration gate must precede staging smoke');
  assert.ok(stagingIndex < migrateIndex, 'staging smoke must precede production migration');
  assert.ok(migrateIndex < workerDeployIndex, 'production migration must precede Worker deployment');
  assert.ok(workerDeployIndex < appDeployIndex, 'Workers must deploy before apps');
  assert.match(workflow, /migration-preflight:\n[\s\S]*?environment: production-migrations/);
  assert.match(workflow, /staging-e2e:\n[\s\S]*?needs:\n\s+- migration-preflight\n\s+- governance-gate/);
  assert.match(workflow, /migrate-production:\n[\s\S]*?needs:\n\s+- staging-e2e\n\s+- governance-gate/);
  assert.match(workflow, /deploy-workers-production:\n[\s\S]*?needs:\n\s+- migrate-production\n\s+- governance-gate/);
  assert.match(workflow, /deploy-apps-production:\n[\s\S]*?needs:\n\s+- deploy-workers-production\n\s+- governance-gate/);
});

test('production migrations require approval plus diff and encrypted backup evidence', () => {
  const untrackedGuardIndex = indexOf('Reject untracked Supabase migrations');
  const dbPushIndex = indexOf('supabase@latest db push');
  assert.ok(untrackedGuardIndex < dbPushIndex, 'untracked migration rejection must precede db push');
  assert.match(workflow, /supabase@latest db diff/);
  assert.match(workflow, /name: production-migration-diff/);
  assert.match(workflow, /pg_dump --format=custom/);
  assert.match(workflow, /gpg --batch --yes --symmetric/);
  assert.match(workflow, /name: production-pre-migration-backup/);
  assert.match(workflow, /supabase@latest db push/);
  assert.match(workflow, /git ls-files --others --exclude-standard database\/supabase\/migrations\//);
  assert.match(workflow, /Untracked Supabase migrations are forbidden before production db push --include-all/);
  assert.match(rolloutWorkflow, /Reject untracked Supabase migrations/);
  assert.match(rolloutWorkflow, /git ls-files --others --exclude-standard database\/supabase\/migrations\//);
});

test('worker secrets are written before production Worker deploys', () => {
  const apiSecretIndex = indexOf('Set api-gateway production secrets');
  const apiDeployIndex = indexOf('Deploy api-gateway to production');
  assert.ok(apiSecretIndex < apiDeployIndex, 'api-gateway secrets must be set before deploy');

  const webhookSecretIndex = indexOf('Set webhook-service production secrets');
  const webhookDeployIndex = indexOf('Deploy webhook-service to production');
  assert.ok(webhookSecretIndex < webhookDeployIndex, 'webhook secrets must be set before deploy');

  assert.match(workflow, /wrangler secret put CUSTOMER_SESSION_SECRET --env production/);
  assert.match(workflow, /wrangler secret put CHECKOUT_SIGNING_SECRET --env production/);
  assert.match(workflow, /wrangler secret put STEP_UP_SIGNING_SECRET --env production/);
  assert.match(workflow, /Set mobile-bff production secrets[\s\S]*?wrangler secret put TURNSTILE_SECRET_KEY --env production[\s\S]*?working-directory: services\/mobile-bff/);
});

test('A4 go-live atom excludes live provider-money secrets', () => {
  assert.doesNotMatch(workflow, /HAS_PRODUCTION_RAZORPAY_KEY_ID/);
  assert.doesNotMatch(workflow, /HAS_PRODUCTION_RAZORPAY_KEY_SECRET/);
  assert.doesNotMatch(workflow, /HAS_PRODUCTION_RAZORPAY_WEBHOOK_SECRET/);
  assert.doesNotMatch(workflow, /HAS_PRODUCTION_STRIPE_WEBHOOK_SECRET/);
  assert.doesNotMatch(workflow, /missing\+=\("PRODUCTION_RAZORPAY_KEY_ID"\)/);
  assert.doesNotMatch(workflow, /missing\+=\("PRODUCTION_RAZORPAY_KEY_SECRET"\)/);
  assert.doesNotMatch(workflow, /missing\+=\("PRODUCTION_RAZORPAY_WEBHOOK_SECRET"\)/);
  assert.doesNotMatch(workflow, /missing\+=\("PRODUCTION_STRIPE_WEBHOOK_SECRET"\)/);
  assert.doesNotMatch(workflow, /wrangler secret put RAZORPAY_KEY_ID --env production/);
  assert.doesNotMatch(workflow, /wrangler secret put RAZORPAY_KEY_SECRET --env production/);
  assert.doesNotMatch(workflow, /wrangler secret put RAZORPAY_WEBHOOK_SECRET --env production/);
  assert.doesNotMatch(workflow, /wrangler secret put STRIPE_WEBHOOK_SECRET --env production/);
  assert.doesNotMatch(workflow, /NEXT_PUBLIC_RAZORPAY_KEY_ID: \$\{\{ secrets\.PRODUCTION_RAZORPAY_KEY_ID \}\}/);
});

test('production smoke runs only after explicit required-job success gate', () => {
  const gateIndex = indexOf('release-required-jobs-succeeded:');
  const smokeIndex = indexOf('smoke-test-production:');
  assert.ok(gateIndex < smokeIndex, 'required-job gate must precede smoke tests');
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /governance-gate=\$\{GOVERNANCE_RESULT\}/);
  assert.match(workflow, /migration-preflight=\$\{MIGRATION_PREFLIGHT_RESULT\}/);
  assert.match(workflow, /deploy-workers-production=\$\{WORKERS_RESULT\}/);
  assert.match(workflow, /deploy-apps-production=\$\{APPS_RESULT\}/);
  assert.match(workflow, /needs: release-required-jobs-succeeded/);
});

test('production app deployment matrices match production Vercel topology', () => {
  const topologyAppRoots = productionTopology.runtimes
    .filter((runtime) => runtime.environment === 'production' && runtime.status === 'active')
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
