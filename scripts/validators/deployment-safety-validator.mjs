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
const productionPushDeployWorkflows = workflowFiles.filter((file) => {
  const text = readFile(file);
  return (
    text.includes("push:") &&
    text.includes("main") &&
    /(wrangler deploy --env production|vercel@latest deploy[\s\S]{0,120}--prod|supabase@latest db push[\s\S]{0,160}PRODUCTION_DB_CONNECTION_STRING|Smoke test production|Smoke Test Production)/.test(text)
  );
});

function indexOf(source, fragment) {
  const index = source.indexOf(fragment);
  reporter.assert(index !== -1, `Production deployment workflow missing fragment: ${fragment}`);
  return index;
}

reporter.assert(!exists(".github/workflows/deploy-production.yml"), "Legacy deploy-production.yml must stay retired; production deploys use one gated path");
reporter.assert(
  productionPushDeployWorkflows.length === 1 && productionPushDeployWorkflows[0] === ".github/workflows/production-deploy.yml",
  `Exactly one push-to-main production deploy workflow is allowed; found ${productionPushDeployWorkflows.join(", ") || "none"}`,
);
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

reporter.finish("Deployment wrappers, rollback wrapper, release promotion, and CI deployment gates checked");
