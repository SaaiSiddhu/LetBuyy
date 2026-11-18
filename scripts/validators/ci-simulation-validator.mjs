import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("CI simulation validator");

const ci = readFile(".github/workflows/ci.yml");
const mergeSafety = ci.split("  merge-safety-gate:")[1]?.split("\n  governance:")[0] || "";
const mergeHeader = mergeSafety.split("    steps:\n")[0];
const unitTests = ci.split("  unit-tests:")[1]?.split("\n  merge-safety-gate:")[0] || "";
const dependencyGuard = mergeSafety.match(/      - name: Require successful full behavioral and unit gates\n([\s\S]*?)(?=\n      - )/)?.[1] || "";
reporter.assert(unitTests.includes("run: pnpm run test:behavioral"), "Unit tests must execute the complete behavioral inventory");
reporter.assert(/^    needs: \[unit-tests\]$/m.test(mergeHeader), "Merge safety must depend on the complete same-workflow Unit result");
reporter.assert(mergeHeader.split("\n").some(line => line.trim() === "if: ${{ always() }}"), "Merge safety must run after failed or skipped dependencies");
reporter.assert(dependencyGuard.includes("UNIT_JOB_RESULT: ${{ needs.unit-tests.result }}")
  && dependencyGuard.includes('run: test "$UNIT_JOB_RESULT" = success')
  && dependencyGuard.split("\n").some(line => line.trim() === "if: ${{ always() }}"),
"Merge safety must explicitly reject every non-success Unit result");
for (const fragment of [
  "subosito/flutter-action@v2",
  "working-directory: apps/merchant/mobile",
  "run: flutter pub get",
  "run: flutter analyze",
  "run: flutter test",
]) {
  reporter.assert(mergeSafety.includes(fragment), `Merge safety gate must include merchant mobile blocker: ${fragment}`);
}

const architecture = readFile(".github/workflows/architecture-governance.yml");
for (const fragment of [
  "pnpm install --frozen-lockfile",
  "pnpm run validate:governance",
  "pnpm run validate:design-system",
  "pnpm run validate:design-tokens",
  "pnpm run validate:mobile-tokens",
  "pnpm run validate:runtime",
  "pnpm run validate:reconciliation",
  "pnpm run validate:deployment",
  "pnpm run validate:rollback",
  "pnpm run validate:queues",
  "pnpm run validate:topology",
  "pnpm run validate:dependencies",
  "pnpm run validate:typescript",
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
  "pnpm run validate:runtime",
  "pnpm run validate:reconciliation",
  "pnpm run validate:deployment",
  "pnpm run validate:rollback",
  "pnpm run validate:queues",
  "pnpm run validate:topology",
  "pnpm run validate:dependencies",
  "pnpm run validate:migrations",
  "pnpm run validate:cloudflare",
  "pnpm run validate:security",
  "pnpm run test",
  "pnpm run typecheck",
  "verify-security-gates.mjs",
  "phase4-ultimate-validate.mjs",
  "pnpm audit --audit-level high --prod",
]) {
  reporter.assert(rollout.includes(fragment), `Production rollout CI must include ${fragment}`);
}

const certification = readFile(".github/workflows/live-production-certification.yml");
for (const fragment of [
  "pnpm run validate:governance",
  "pnpm run validate:lifecycle",
  "pnpm run validate:runtime",
  "pnpm run validate:reconciliation",
  "pnpm run validate:deployment",
  "pnpm run validate:rollback",
  "pnpm run validate:queues",
  "pnpm run validate:topology",
  "pnpm run validate:dependencies",
  "pnpm run validate:migrations",
  "pnpm run validate:cloudflare",
  "pnpm run test",
  "pnpm run typecheck",
  "phase4-live-certify.mjs",
  "phase4-live-certification-report.json",
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
