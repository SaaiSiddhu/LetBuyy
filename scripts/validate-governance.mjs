import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const laneArg = [...args].find((arg) => arg.startsWith("--lane="));
const lane = laneArg ? laneArg.slice("--lane=".length) : "gate";
const validLanes = new Set(["gate", "report", "all"]);

if (!validLanes.has(lane)) {
  console.error(`Invalid governance lane: ${lane}. Expected one of: ${[...validLanes].join(", ")}`);
  process.exit(1);
}

const validators = [
  "foundation-antifabrication-gate.mjs",
  "tenant-isolation-validator.mjs",
  "production-safety-validator.mjs",
  "session-security-validator.mjs",
  "operational-lifecycle-validator.mjs",
  "validate-design-system.mjs",
  "mobile-token-validator.mjs",
  "theme-governance-validator.mjs",
  "beta-readiness-validator.mjs",
  "architecture-validator.mjs",
  "runtime-validator.mjs",
  "runtime-manifest-validator.mjs",
  "runtime-topology-validator.mjs",
  "topology-drift-validator.mjs",
  "package-ownership-validator.mjs",
  "import-validator.mjs",
  "dependency-manifest-validator.mjs",
  "undeclared-import-validator.mjs",
  "dependency-graph-validator.mjs",
  "circular-import-validator.mjs",
  "cycle-budget-validator.mjs",
  "package-export-validator.mjs",
  "provider-isolation-validator.mjs",
  "supply-chain-validator.mjs",
  "typescript-governance-validator.mjs",
  "cloudflare-topology-validator.mjs",
  "wrangler-env-validator.mjs",
  "cloudflare-environment-validator.mjs",
  "cloudflare-binding-validator.mjs",
  "env-isolation-validator.mjs",
  "environment-honesty-validator.mjs",
  "cookie-realm-validator.mjs",
  "reserved-subdomain-single-source-validator.mjs",
  "storefront-access-gate-validator.mjs",
  "custom-domain-target-validator.mjs",
  "merchant-domains-settings-validator.mjs",
  "storefront-seo-access-validator.mjs",
  "platform-domain-literal-validator.mjs",
  "route-ownership-validator.mjs",
  "legacy-site-type-validator.mjs",
  "app-utils-service-role-edge-validator.mjs",
  "migration-safety-validator.mjs",
  "deployment-safety-validator.mjs",
  "domain-boundary-validator.mjs",
  "single-writer-ownership-validator.mjs",
  "fail-closed-internal-routes-validator.mjs",
  "source-ledger-residue-validator.mjs",
  "foundation-sql-policy-residue-validator.mjs",
  "dead-residue-validator.mjs",
  "repository-intelligence-validator.mjs",
  "mobile-topology-honesty-validator.mjs",
  "route-line-count-validator.mjs",
  "single-source-crypto-validator.mjs",
  "cms-slugify-validator.mjs",
  "inr-currency-format-validator.mjs",
  "date-format-validator.mjs",
  "marketplace-single-source-validator.mjs",
  "api-client-runtime-base-validator.mjs",
  "marketing-dead-twin-validator.mjs",
  "theme-editor-dead-shell-validator.mjs",
  "typescript-dead-source-validator.mjs",
  "dart-dead-source-validator.mjs",
  "settings-apps-dead-twin-validator.mjs",
  "raw-error-message-validator.mjs",
  "dev-auth-bypass-validator.mjs",
  "no-noop-test-script-validator.mjs",
  "environment-validator.mjs",
  "generated-artifact-validator.mjs",
  "stale-artifact-validator.mjs",
  "tooling-governance-validator.mjs",
  "ci-simulation-validator.mjs",
  "committed-secret-placeholder-validator.mjs",
  "d1-governance-validator.mjs",
  "deployment-lineage-validator.mjs",
  "durable-object-validator.mjs",
  "manifest-lineage-validator.mjs",
  "production-readiness-validator.mjs",
  "provider-evidence-validator.mjs",
  "queue-topology-validator.mjs",
  "rollback-integrity-validator.mjs",
  "test-coverage-governance-validator.mjs",
  "workspace-lifecycle-validator.mjs",
  "commission-bps-zero-validator.mjs",
  "canonical-ledger-only-validator.mjs",
  "no-self-custody-rail-validator.mjs",
  "stepup-crypto-validator.mjs",
  "identity-sole-issuer-validator.mjs",
  "no-blanket-service-role-validator.mjs",
  "no-public-using-true-validator.mjs",
  "rls-force-coverage-validator.mjs",
  "provider-mode-badge-validator.mjs",
  "one-system-per-domain-validator.mjs",
  "no-rejected-package-imports-validator.mjs",
  "no-reserved-service-activation-validator.mjs",
  "no-new-react-sections-validator.mjs",
  "token-source-single-validator.mjs",
  "shell-single-validator.mjs",
  "meta-no-theater-validator.mjs",
  "phase-c-forced-decisions-validator.mjs",
  "branch-lag-guard-validator.mjs",
  "deploy-matrix-topology-validator.mjs",
  "topology-json-antifabrication-validator.mjs",
  "no-scan-generated-agents-validator.mjs",
  "prompt-perimeter-validator.mjs",
  "whole-repo-end-state-validator.mjs",
];

const reportValidators = [
  "foundation-stepup-report-validator.mjs",
];

const criticalGateValidators = [
  "dependency-manifest-validator.mjs",
  "undeclared-import-validator.mjs",
  "package-export-validator.mjs",
  "dependency-graph-validator.mjs",
  "circular-import-validator.mjs",
];

const demotedValidators = [];

for (const validator of criticalGateValidators) {
  if (!validators.includes(validator)) {
    console.error(`Critical validator must stay in the gate lane: ${validator}`);
    process.exit(1);
  }
}

if (demotedValidators.length) {
  console.error(`Validator demotions are forbidden without a Wave 0 governance entry: ${demotedValidators.join(", ")}`);
  process.exit(1);
}

const selectedValidators =
  lane === "report" ? reportValidators : lane === "all" ? [...validators, ...reportValidators] : validators;

const generatedDirectoryNames = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  ".dart_tool",
  "build",
  "coverage",
  ".cache",
  ".wrangler",
  ".vercel",
  ".symlinks",
  "Pods",
]);

function removeGeneratedArtifactDirectories(startDirs = ["apps", "packages", "services"]) {
  function walk(absDir) {
    if (!fs.existsSync(absDir)) return;

    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const absPath = path.join(absDir, entry.name);
      if (!entry.isDirectory()) continue;

      if (generatedDirectoryNames.has(entry.name)) {
        fs.rmSync(absPath, { recursive: true, force: true });
        continue;
      }

      walk(absPath);
    }
  }

  for (const dir of startDirs) walk(path.join(process.cwd(), dir));
}

for (const validator of selectedValidators) {
  if (validator === "stale-artifact-validator.mjs") {
    removeGeneratedArtifactDirectories();
  }

  const script = path.posix.join("scripts/validators", validator);
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Governance ${lane} lane passed (${selectedValidators.length} validators).`);
