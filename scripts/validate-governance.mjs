import { spawnSync } from "node:child_process";
import path from "node:path";

const validators = [
  "architecture-validator.mjs",
  "runtime-validator.mjs",
  "runtime-manifest-validator.mjs",
  "execution-layer-validator.mjs",
  "distributed-runtime-validator.mjs",
  "production-readiness-validator.mjs",
  "operational-lifecycle-validator.mjs",
  "workspace-lifecycle-validator.mjs",
  "package-ownership-validator.mjs",
  "import-validator.mjs",
  "dependency-manifest-validator.mjs",
  "undeclared-import-validator.mjs",
  "dependency-graph-validator.mjs",
  "circular-import-validator.mjs",
  "package-export-validator.mjs",
  "provider-isolation-validator.mjs",
  "supply-chain-validator.mjs",
  "typescript-governance-validator.mjs",
  "cloudflare-environment-validator.mjs",
  "migration-safety-validator.mjs",
  "test-coverage-governance-validator.mjs",
  "survivability-governance-validator.mjs",
  "operational-proof-validator.mjs",
  "ci-simulation-validator.mjs",
  "domain-boundary-validator.mjs",
  "environment-validator.mjs",
  "generated-artifact-validator.mjs",
  "stale-artifact-validator.mjs",
  "tooling-governance-validator.mjs",
];

for (const validator of validators) {
  const script = path.posix.join("scripts/validators", validator);
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Governance validation passed (${validators.length} validators).`);
