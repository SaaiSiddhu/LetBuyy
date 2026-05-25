import {
  createReporter,
  getTrackedFiles,
  listWorkspaceFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Supply-chain validator");
const files = [...new Set([...getTrackedFiles(), ...listWorkspaceFiles()])].sort();

const scannedPrefixes = [
  ".github/workflows/",
  "infrastructure/scripts/",
  "infrastructure/deployment/",
  "docs/governance/",
  "docs/runbooks/",
  "docs/operations/",
];

const forbiddenPatterns = [
  { pattern: /\bnpx\b/, message: "npx is forbidden in governed execution paths; use pnpm or a checked-in wrapper" },
  { pattern: /\bnpm\s+run\b/, message: "npm run is forbidden in governed execution paths; use pnpm run" },
  { pattern: /\bnpm\s+audit\b/, message: "npm audit is forbidden in governed execution paths; use pnpm audit" },
];

for (const file of files.filter((candidate) => scannedPrefixes.some((prefix) => candidate.startsWith(prefix)))) {
  const text = readFile(file);
  for (const { pattern, message } of forbiddenPatterns) {
    reporter.assert(!pattern.test(text), `${file}: ${message}`);
  }
}

for (const file of files.filter((candidate) => candidate.startsWith("services/") && candidate.endsWith("/package.json"))) {
  const text = readFile(file);
  reporter.assert(!/"deploy"\s*:\s*"wrangler deploy"/.test(text), `${file}: direct wrangler deploy script is forbidden`);
}

reporter.finish("governed workflows, scripts, deployment manifests, and docs checked for npm/npx leakage");
