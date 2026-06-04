import fs from "node:fs";
import path from "node:path";
import {
  createReporter,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Provider evidence validator");
const args = new Set(process.argv.slice(2));
const requireLiveEvidence = args.has("--require-live-evidence");
const environment = valueFor("--environment") || "production";
const topology = readJson("config/runtime/cloudflare-topology.json");
const evidenceRoot = topology.evidence?.artifactRoot || "artifacts/provider-evidence";

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

reporter.assert(["staging", "production"].includes(environment), "--environment must be staging or production");
reporter.assert(topology.mode === "governance-contract-not-live-evidence", "Checked-in provider topology must not claim live evidence");
reporter.assert(topology.evidence?.liveEvidenceTracked === false, "Provider evidence artifacts must not be tracked source authority");
reporter.assert(Array.isArray(topology.evidence?.executeModeRequires), "Provider execute-mode requirements must be declared");

for (const envName of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "LETBUYY_PROVIDER_MUTATION_APPROVED"]) {
  reporter.assert(topology.evidence.executeModeRequires.includes(envName), `Provider evidence execute mode missing ${envName}`);
}

if (requireLiveEvidence) {
  const reportPath = path.join(evidenceRoot, environment, "provider-execution-report.json");
  reporter.assert(fs.existsSync(reportPath), `Provider evidence report missing for execute mode: ${reportPath}`);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  reporter.assert(report.environment === environment, `Provider evidence environment mismatch: ${reportPath}`);
  reporter.assert(report.provider_certification === true, `Provider evidence report must certify provider execution: ${reportPath}`);
  reporter.assert(Array.isArray(report.evidence) && report.evidence.length > 0, `Provider evidence report missing command evidence: ${reportPath}`);
  for (const entry of report.evidence) {
    reporter.assert(entry.provider && entry.command && Number.isInteger(entry.exit_status), `Provider evidence entry incomplete: ${entry.id || "unknown"}`);
    reporter.assert(entry.artifact_hash && entry.trace_id, `Provider evidence entry missing hashes: ${entry.id || "unknown"}`);
  }
} else {
  reporter.assert(!fs.existsSync(path.join(evidenceRoot, environment, "provider-execution-report.json")), "Plan-mode validation must not require or imply live provider evidence");
}

reporter.finish(`Provider evidence contract checked for ${environment}`);
