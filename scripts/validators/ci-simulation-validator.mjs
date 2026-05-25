import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("CI simulation validator");

const architecture = readFile(".github/workflows/architecture-governance.yml");
for (const fragment of [
  "pnpm install --frozen-lockfile",
  "pnpm run validate:governance",
  "pnpm run validate:dependencies",
  "pnpm run validate:typescript",
  "pnpm run validate:survivability",
  "pnpm run test",
  "pnpm run typecheck",
  "pnpm audit --audit-level high --prod",
]) {
  reporter.assert(architecture.includes(fragment), `Architecture governance CI must include ${fragment}`);
}

const rollout = readFile(".github/workflows/production-rollout.yml");
for (const fragment of [
  "pnpm run validate:governance",
  "pnpm run validate:lifecycle",
  "pnpm run validate:dependencies",
  "pnpm run validate:migrations",
  "pnpm run validate:cloudflare",
  "pnpm run validate:survivability",
  "pnpm run test",
  "pnpm run typecheck",
  "verify-security-gates.mjs",
  "phase4-ultimate-validate.mjs",
  "run-survivability-suite.mjs",
  "pnpm audit --audit-level high --prod",
]) {
  reporter.assert(rollout.includes(fragment), `Production rollout CI must include ${fragment}`);
}

const certification = readFile(".github/workflows/live-production-certification.yml");
for (const fragment of [
  "pnpm run validate:governance",
  "pnpm run validate:lifecycle",
  "pnpm run validate:dependencies",
  "pnpm run validate:migrations",
  "pnpm run validate:cloudflare",
  "pnpm run validate:survivability",
  "pnpm run test",
  "pnpm run typecheck",
  "phase4-live-certify.mjs",
  "attest-build-provenance",
]) {
  reporter.assert(certification.includes(fragment), `Live certification CI must include ${fragment}`);
}

const releasePromotion = readFile("infrastructure/deployment/release-promotion.yaml");
for (const fragment of [
  "deploy-worker-runtime.mjs --config services/queue-workers/wrangler.toml --env production",
  "deploy-worker-runtime.mjs --config services/api-gateway/wrangler.toml --env production",
  "deploy-worker-runtime.mjs --config services/webhook-service/wrangler.toml --env production",
]) {
  reporter.assert(releasePromotion.includes(fragment), `Release promotion plan must include governed Worker deployment: ${fragment}`);
}

reporter.finish("CI workflows and release promotion plan checked for mandatory enterprise gates");
