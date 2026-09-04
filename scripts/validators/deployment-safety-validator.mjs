import {
  createReporter,
  exists,
  getTrackedFiles,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Deployment safety validator");

const deployWrapper = readFile("infrastructure/scripts/deploy/deploy-worker-runtime.mjs");
for (const fragment of [
  "if (!config) fail(\"--config is required for governed Worker deployment\")",
  "if (!environment) fail(\"--env is required for governed Worker deployment\")",
  "invalid --env",
  "\"wrangler\", \"deploy\", \"--config\", configPath, \"--env\", environment",
  "\"--keep-vars\"",
]) {
  reporter.assert(deployWrapper.includes(fragment), `Worker deploy wrapper must fail closed with fragment: ${fragment}`);
}

const productionDeploy = readFile("infrastructure/scripts/deploy/production-deploy.mjs");
for (const fragment of [
  "const supportedEnvironments = [\"staging\", \"production\"]",
  "run(\"pnpm\", [\"run\", \"validate:governance\"])",
  "materialize-wrangler-config.mjs",
  "deploy-worker-runtime.mjs",
  "--require-real-bindings",
  "verify-health-gates.mjs",
]) {
  reporter.assert(productionDeploy.includes(fragment), `Production deploy orchestration missing safety fragment: ${fragment}`);
}

const rollback = readFile("infrastructure/scripts/deploy/production-rollback.mjs");
for (const fragment of [
  "--worker is required",
  "--version-id is required for deterministic Worker rollback lineage",
  "validate:rollback",
  "CLOUDFLARE_API_TOKEN is required for Worker rollback",
  "\"wrangler\", \"rollback\"",
  "\"--env\", environment",
  "deployment-lineage-manifest.json",
]) {
  reporter.assert(rollback.includes(fragment), `Rollback wrapper missing safety fragment: ${fragment}`);
}

for (const root of ["services/api-gateway", "services/webhook-service", "services/queue-workers"]) {
  const manifest = readJson(`${root}/package.json`);
  reporter.assert(
    manifest?.scripts?.deploy?.includes("deploy-worker-runtime.mjs") && !/wrangler deploy(\s|$)/.test(manifest.scripts.deploy),
    `Worker package deploy script must use governed wrapper only: ${root}/package.json`,
  );
}

const releasePromotion = readFile("infrastructure/deployment/release-promotion.yaml");
for (const fragment of [
  "staging:",
  "production:",
  "rollbackCommand",
  "rollbackIntegrity",
  "deploy-worker-runtime.mjs --config services/queue-workers/wrangler.toml --env production",
  "deploy-worker-runtime.mjs --config services/api-gateway/wrangler.toml --env production",
  "deploy-worker-runtime.mjs --config services/webhook-service/wrangler.toml --env production",
  "driftValidation",
]) {
  reporter.assert(releasePromotion.includes(fragment), `Release promotion manifest missing deployment safety fragment: ${fragment}`);
}

const productionRollout = readFile(".github/workflows/production-rollout.yml");
const productionDeployWorkflow = readFile(".github/workflows/production-deploy.yml");
const workflowFiles = getTrackedFiles().filter((file) => file.startsWith(".github/workflows/") && file.endsWith(".yml") && exists(file));
const PRODUCTION_DEPLOY_VERBS = /(wrangler deploy --env production|vercel@latest deploy[\s\S]{0,120}--prod|supabase@latest db push[\s\S]{0,160}PRODUCTION_DB_CONNECTION_STRING|Smoke test production|Smoke Test Production)/;
// A production deploy workflow both carries a production deploy verb AND targets the `production` environment
// (`vercel deploy --prod` also appears in the staging lane, where it publishes to a staging project).
const productionDeployWorkflows = workflowFiles.filter((file) => {
  const text = readFile(file);
  return PRODUCTION_DEPLOY_VERBS.test(text) && text.includes("environment: production");
});
// OWNER_DECISION D-DEPLOY (2026-09-04): the production lane is reachable only from `main` (push) or manual
// dispatch, and until a DEPLOY-1 phase retargets it with verified cloud targets it carries no push trigger
// at all. The invariant that survives both states: only production-deploy.yml may deploy production, it
// must be dispatchable, it never runs on pull_request, and a push trigger — when present — is restricted to main.
const productionPushDeployWorkflows = productionDeployWorkflows.filter((file) => /^\s*push:\s*$/m.test(readFile(file)));

function indexOf(source, fragment) {
  const index = source.indexOf(fragment);
  reporter.assert(index !== -1, `Production deployment workflow missing fragment: ${fragment}`);
  return index;
}

reporter.assert(!exists(".github/workflows/deploy-production.yml"), "Legacy deploy-production.yml must stay retired; production deploys use one gated path");
reporter.assert(
  productionDeployWorkflows.length === 1 && productionDeployWorkflows[0] === ".github/workflows/production-deploy.yml",
  `Exactly one production deploy workflow is allowed; found ${productionDeployWorkflows.join(", ") || "none"}`,
);
reporter.assert(
  productionPushDeployWorkflows.every((file) => file === ".github/workflows/production-deploy.yml"),
  `Only production-deploy.yml may deploy production on a push; found push triggers in ${productionPushDeployWorkflows.join(", ")}`,
);
const productionTriggerBlock = productionDeployWorkflow.slice(
  productionDeployWorkflow.indexOf("\non:"),
  productionDeployWorkflow.indexOf("\npermissions:"),
);
reporter.assert(/^\s*workflow_dispatch:/m.test(productionTriggerBlock), "Production deploy workflow must be dispatchable (workflow_dispatch)");
reporter.assert(!/^\s*pull_request:/m.test(productionTriggerBlock), "Production deploy workflow must never run on pull_request");
if (/^\s*push:\s*$/m.test(productionTriggerBlock)) {
  const pushBranches = [...productionTriggerBlock.matchAll(/^\s+- (\S+)\s*$/gm)].map((match) => match[1]);
  reporter.assert(
    pushBranches.length > 0 && pushBranches.every((branch) => branch === "main"),
    `Production deploy push trigger, when present, must be restricted to main (found: ${pushBranches.join(", ") || "none"})`,
  );
}
reporter.assert(
  productionDeployWorkflow.includes("group: production-release-production"),
  "Production deploy workflow must use the shared production release concurrency group",
);
reporter.assert(
  productionRollout.includes("group: production-release-${{ inputs.environment }}"),
  "Production rollout workflow must share the production release concurrency group for production",
);

const releasePreflightIndex = indexOf(productionDeployWorkflow, "release-preflight:");
const governanceGateIndex = indexOf(productionDeployWorkflow, "governance-gate:");
const migrationPreflightIndex = indexOf(productionDeployWorkflow, "migration-preflight:");
const stagingSmokeIndex = indexOf(productionDeployWorkflow, "staging-e2e:");
const migrateProductionIndex = indexOf(productionDeployWorkflow, "migrate-production:");
const deployWorkersIndex = indexOf(productionDeployWorkflow, "deploy-workers-production:");
const deployAppsIndex = indexOf(productionDeployWorkflow, "deploy-apps-production:");
const untrackedMigrationGuardIndex = indexOf(productionDeployWorkflow, "Reject untracked Supabase migrations");
const productionDbPushIndex = indexOf(productionDeployWorkflow, "supabase@latest db push");
reporter.assert(governanceGateIndex < releasePreflightIndex, "Governance gate must precede release credential preflight");
reporter.assert(releasePreflightIndex < migrationPreflightIndex, "Release credential preflight must precede migration gate");
reporter.assert(migrationPreflightIndex < stagingSmokeIndex, "Migration gate must precede staging smoke");
reporter.assert(stagingSmokeIndex < migrateProductionIndex, "Staging smoke must precede production migration");
reporter.assert(migrateProductionIndex < deployWorkersIndex, "Production migration must precede Worker deployment");
reporter.assert(deployWorkersIndex < deployAppsIndex, "Worker deployment must precede app deployment");
reporter.assert(untrackedMigrationGuardIndex < productionDbPushIndex, "Untracked migration rejection must precede production db push --include-all");
for (const fragment of [
  "node scripts/validate-governance.mjs --lane=gate",
  "Validate migration safety",
  "production-migration-diff",
  "production-pre-migration-backup",
  "Untracked Supabase migrations are forbidden before production db push --include-all",
  "git ls-files --others --exclude-standard database/supabase/migrations/",
  "- migrate-production",
  "- governance-gate",
  "HAS_PRODUCTION_CHECKOUT_SIGNING_SECRET",
  'missing+=("PRODUCTION_CHECKOUT_SIGNING_SECRET")',
  "wrangler secret put CHECKOUT_SIGNING_SECRET --env production",
  "HAS_PRODUCTION_STEP_UP_SIGNING_SECRET",
  'missing+=("PRODUCTION_STEP_UP_SIGNING_SECRET")',
  "wrangler secret put STEP_UP_SIGNING_SECRET --env production",
  "migration-preflight=${MIGRATION_PREFLIGHT_RESULT}",
  "governance-gate=${GOVERNANCE_RESULT}",
  "wrangler secret put TURNSTILE_SECRET_KEY --env production",
]) {
  reporter.assert(productionDeployWorkflow.includes(fragment), `Production deploy workflow missing gated release fragment: ${fragment}`);
}

for (const forbidden of [
  "HAS_PRODUCTION_RAZORPAY_KEY_ID",
  "HAS_PRODUCTION_RAZORPAY_KEY_SECRET",
  "HAS_PRODUCTION_RAZORPAY_WEBHOOK_SECRET",
  "HAS_PRODUCTION_STRIPE_WEBHOOK_SECRET",
  'missing+=("PRODUCTION_RAZORPAY_KEY_ID")',
  'missing+=("PRODUCTION_RAZORPAY_KEY_SECRET")',
  'missing+=("PRODUCTION_RAZORPAY_WEBHOOK_SECRET")',
  'missing+=("PRODUCTION_STRIPE_WEBHOOK_SECRET")',
  "wrangler secret put RAZORPAY_KEY_ID --env production",
  "wrangler secret put RAZORPAY_KEY_SECRET --env production",
  "wrangler secret put RAZORPAY_WEBHOOK_SECRET --env production",
  "wrangler secret put STRIPE_WEBHOOK_SECRET --env production",
  "NEXT_PUBLIC_RAZORPAY_KEY_ID: ${{ secrets.PRODUCTION_RAZORPAY_KEY_ID }}",
]) {
  reporter.assert(!productionDeployWorkflow.includes(forbidden), `A4 production go-live atom must not require or provision provider-money secret: ${forbidden}`);
}

reporter.assert(
  productionRollout.includes("governance-gate:") &&
    productionRollout.includes("needs: governance-gate") &&
    productionRollout.includes("node scripts/validate-governance.mjs --lane=gate"),
  "Production rollout workflow must require the governance-gate job before rollout",
);
reporter.assert(
  productionRollout.includes("Reject untracked Supabase migrations") &&
    productionRollout.includes("git ls-files --others --exclude-standard database/supabase/migrations/"),
  "Production rollout workflow must reject untracked migrations before execution",
);

for (const fragment of [
  "pnpm run validate:governance",
  "pnpm run validate:lifecycle",
  "pnpm run validate:runtime",
  "pnpm run validate:migrations",
  "pnpm run validate:deployment",
  "pnpm run validate:topology",
  "pnpm run validate:cloudflare",
  "pnpm run validate:security",
  "pnpm run test",
  "pnpm run typecheck",
]) {
  reporter.assert(productionRollout.includes(fragment), `Production rollout workflow missing fail-closed gate: ${fragment}`);
}

// B3 staging gate assertions: deploy-staging.yml must run the governance gate before any deploy job.
const stagingDeployWorkflow = readFile(".github/workflows/deploy-staging.yml");
for (const fragment of [
  "governance-gate:",
  "node scripts/validate-governance.mjs --lane=gate",
  "git ls-files --others --exclude-standard database/supabase/migrations/",
]) {
  reporter.assert(
    stagingDeployWorkflow.includes(fragment),
    `deploy-staging.yml missing governance-gate fragment: ${fragment}`,
  );
}
reporter.assert(
  (stagingDeployWorkflow.match(/needs:.*governance-gate/g) || []).length >= 2,
  "deploy-staging.yml: both deploy-workers and deploy-apps must declare needs: governance-gate",
);

// B3 staging-deploy.yml: push trigger for develop must be disabled (develop is stale).
const stagingDeployLegacy = readFile(".github/workflows/staging-deploy.yml");
reporter.assert(
  !(/^\s*push:/m.test(stagingDeployLegacy) && stagingDeployLegacy.includes("develop")),
  "staging-deploy.yml must not have an active push trigger for develop — disable it or add the governance gate (B3 closure)",
);

reporter.finish("Deployment wrappers, rollback wrapper, release promotion, CI deployment gates, and staging gate checked");
