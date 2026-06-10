import fs from "node:fs";

import {
  canonicalRuntimeRoots,
  createReporter,
  exists,
  readFile,
  readJson,
  rejectedPackageRoots,
  reservedMobileRuntimeRoots,
  reservedServiceRoots,
} from "./governance-common.mjs";

const reporter = createReporter("Whole-repo end-state validator");

const allowedRootMarkdown = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "EXECUTION_LEDGER.md",
  "SKIPPED_HUMAN_DECISIONS.md",
  "CAPABILITY_BACKLOG.md",
  "PROMPTS.md",
  "EXECUTABLE_HUMAN_REQUIRED.md",
  "MERGE_RUNBOOK.md",
]);

const rootMarkdown = fs
  .readdirSync(process.cwd(), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => entry.name)
  .sort();

const unexpectedRootMarkdown = rootMarkdown.filter((file) => !allowedRootMarkdown.has(file));
reporter.assert(
  unexpectedRootMarkdown.length === 0,
  `Root markdown sprawl must stay archived; unexpected root markdown: ${unexpectedRootMarkdown.join(", ")}`,
);

reporter.assert(!exists("CODEX_MASTER_IMPLEMENTATION_PROMPT.md"), "Master prompt must not remain at the repository root");
reporter.assert(
  exists("docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md"),
  "Archived master implementation prompt must be preserved under docs/archive/codex-prompts",
);
reporter.assert(
  exists("docs/archive/codex-prompts/CODEX_REPOSITORY_CONVERGENCE_EXECUTION_PROMPT.md"),
  "Archived HALT-mode repository convergence prompt must be preserved under docs/archive/codex-prompts",
);
reporter.assert(
  exists("docs/archive/prompt-drift-2026-06-10/README.md"),
  "Prompt drift quarantine archive must exist with a README sentinel",
);
reporter.assert(
  exists("docs/archive/root-governance-2026-06-10"),
  "Root governance archive must exist after D11 cleanup",
);
reporter.assert(
  exists("docs/archive/governance-theater-2026-06-10"),
  "Governance-theater archive must exist after D11 cleanup",
);

for (const root of rejectedPackageRoots) {
  reporter.assert(!exists(root), `Rejected architecture package root must be deleted: ${root}`);
}

const productionTopology = readJson("config/runtime/production-topology.json");
const productionRuntimeByRoot = new Map((productionTopology?.runtimes || []).map((runtime) => [runtime.runtimeRoot, runtime]));

for (const root of [...reservedServiceRoots, ...reservedMobileRuntimeRoots]) {
  const manifest = readJson(`${root}/runtime.manifest.json`);
  reporter.assert(manifest, `Reserved runtime root must keep a manifest: ${root}`);
  reporter.assert(
    manifest?.runtimeCategory?.startsWith("reserved-") &&
      manifest?.implementationStatus?.status === "reserved-not-implemented" &&
      manifest?.implementationStatus?.sourceState === "manifest-and-agents-only",
    `Reserved runtime manifest must remain reserved/not-implemented: ${root}`,
  );
  reporter.assert(
    !exists(`${root}/package.json`) && !exists(`${root}/src`) && !exists(`${root}/wrangler.toml`),
    `Reserved runtime root must remain manifest-only: ${root}`,
  );
}

for (const root of reservedServiceRoots) {
  const topologyRuntime = productionRuntimeByRoot.get(root);
  reporter.assert(topologyRuntime, `Reserved service root must be represented as reserved in production topology: ${root}`);
  reporter.assert(
    topologyRuntime?.environment === "reserved" &&
      topologyRuntime?.status === "reserved" &&
      topologyRuntime?.deploymentKind === "manifest-only" &&
      Array.isArray(topologyRuntime?.deploymentManifests) &&
      topologyRuntime.deploymentManifests.length === 0,
    `Reserved service topology entry must stay non-deployable: ${root}`,
  );
}

for (const root of reservedMobileRuntimeRoots) {
  reporter.assert(!productionRuntimeByRoot.has(root), `Reserved mobile root must not appear in production topology: ${root}`);
}

for (const root of canonicalRuntimeRoots) {
  reporter.assert(exists(`${root}/runtime.manifest.json`), `Canonical runtime must keep runtime.manifest.json: ${root}`);
}

const packageJson = readJson("package.json");
const requiredScripts = {
  "validate:governance": "node scripts/validate-governance.mjs --lane=gate",
  "validate:beta-readiness": "node scripts/validators/beta-readiness-validator.mjs",
  "certify:production:plan-report": "node infrastructure/scripts/operations/generate-certification-report.mjs --environment=production --mode=plan",
};

for (const [scriptName, fragment] of Object.entries(requiredScripts)) {
  reporter.assert(
    packageJson?.scripts?.[scriptName]?.includes(fragment),
    `package.json script ${scriptName} must include ${fragment}`,
  );
}

const governanceGate = readFile("scripts/validate-governance.mjs");
for (const validator of [
  "no-rejected-package-imports-validator.mjs",
  "platform-domain-literal-validator.mjs",
  "beta-readiness-validator.mjs",
  "production-safety-validator.mjs",
  "prompt-perimeter-validator.mjs",
  "whole-repo-end-state-validator.mjs",
]) {
  reporter.assert(governanceGate.includes(validator), `Governance gate must include ${validator}`);
}

const ledger = readFile("EXECUTION_LEDGER.md");
for (const actionId of [
  "PHASE-A-HARD-001",
  "PHASE-B-HW1",
  "PHASE-C-FORCED-DECISIONS",
  "D1-DEPLOYMENT-UNBLOCK",
  "D2-LIVE-DATA-LEAKS",
  "D3-P4-IDENTITY",
  "D4-TENANCY-LOAD-BEARING",
  "D5-MONEY-LEDGER",
  "D6-CHECKOUT-HOSTED-ORIGIN",
  "D7-THEME-LIQUID-PARITY",
  "D8-MOBILE-MERCHANT-OS",
  "D9-TOKEN-SOURCE",
  "D10-WHATSAPP-SCOPED",
  "D11-PLATFORM-SIMPLIFICATION",
  "D12-D13-GATE-RESTORE",
  "D11-D13-VERIFY",
  "D13-WHOLE-REPO-END-STATE",
  "D13-END-STATE-VERIFY",
]) {
  reporter.assert(ledger.includes(actionId), `EXECUTION_LEDGER.md missing completion row ${actionId}`);
}

const skipped = readFile("SKIPPED_HUMAN_DECISIONS.md");
for (const skipId of [
  "SKIP-GATE1-ARB-RATIFICATION",
  "SKIP-PROD-DEPLOY-PROMOTION",
  "SKIP-PROD-DNS-CUTOVER",
  "SKIP-PROVIDER-SECRETS",
  "SKIP-D2-LIVE-ANON-GRANT-PROBE",
  "SKIP-D3-IDENTITY-LIVE-PROVIDERS",
  "SKIP-D4-LIVE-FORCE-COVERAGE-PROBE",
  "SKIP-D5-LIVE-MONEY-RECONCILIATION",
  "SKIP-D6-LIVE-CHECKOUT-CUTOVER",
  "SKIP-D8-MOBILE-RELEASE-SIGNING-SECRETS",
  "SKIP-D10-WHATSAPP-BSP-WABA-HSM",
  "SKIP-W0-PITR-TIER",
  "SKIP-W3-SENTRY-DSN",
  "SKIP-W4-LIVE-SECRET-ROTATION",
  "SKIP-W4-MTLS-CF-ACCESS",
  "SKIP-W7-MOBILE-TURNSTILE-SECRET",
  "SKIP-W7-WHATSAPP-LIVE-CREDS",
  "SKIP-D11-PROVIDER-PAYMENT-ID-INDEX-LIVE-DB",
  "SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE",
]) {
  reporter.assert(skipped.includes(skipId), `SKIPPED_HUMAN_DECISIONS.md missing human seam ${skipId}`);
}

reporter.assert(productionTopology?.canonicalDomain === "letbuyy.com", "Production topology must declare letbuyy.com");
const retiredRegionContractKey = ["global", "Regions"].join("");
reporter.assert(
  !productionTopology?.regions?.[retiredRegionContractKey],
  "Production topology must not declare the retired global region contract",
);

for (const workflow of [
  ".github/workflows/architecture-governance.yml",
  ".github/workflows/production-rollout.yml",
  ".github/workflows/live-production-certification.yml",
]) {
  const source = readFile(workflow);
  for (const fragment of [
    "pnpm run validate:reconciliation",
    "pnpm run validate:queues",
  ]) {
    reporter.assert(source.includes(fragment), `${workflow} must include ${fragment}`);
  }
}

reporter.finish("root budget, phase ledger, human seams, topology, and final gate wiring checked");
