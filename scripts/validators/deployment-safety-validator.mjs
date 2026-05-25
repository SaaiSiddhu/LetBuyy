import {
  createReporter,
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
  "const supportedEnvironments = [\"dev\", \"staging\", \"production\"]",
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
  "local",
  "dev:",
  "staging:",
  "production:",
  "rollbackCommand",
  "rollbackIntegrity",
  "replayCompatibility",
  "projectionRecovery",
  "queueLifecycle",
  "deploy-worker-runtime.mjs --config services/queue-workers/wrangler.toml --env production",
  "deploy-worker-runtime.mjs --config services/api-gateway/wrangler.toml --env production",
  "deploy-worker-runtime.mjs --config services/webhook-service/wrangler.toml --env production",
  "driftValidation",
]) {
  reporter.assert(releasePromotion.includes(fragment), `Release promotion manifest missing deployment safety fragment: ${fragment}`);
}

const productionRollout = readFile(".github/workflows/production-rollout.yml");
for (const fragment of [
  "pnpm run validate:governance",
  "pnpm run validate:lifecycle",
  "pnpm run validate:runtime",
  "pnpm run validate:replay",
  "pnpm run validate:migrations",
  "pnpm run validate:deployment",
  "pnpm run validate:rollback",
  "pnpm run validate:queues",
  "pnpm run validate:cloudflare",
  "pnpm run validate:security",
  "pnpm run test",
  "pnpm run typecheck",
]) {
  reporter.assert(productionRollout.includes(fragment), `Production rollout workflow missing fail-closed gate: ${fragment}`);
}

reporter.finish("Deployment wrappers, rollback wrapper, release promotion, and CI deployment gates checked");
