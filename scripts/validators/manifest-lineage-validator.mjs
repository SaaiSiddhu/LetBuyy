import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  createReporter,
  exists,
  readJson,
  root,
} from "./governance-common.mjs";

const reporter = createReporter("Manifest lineage validator");

const manifestPath = "config/runtime/manifest-lineage.json";
const schemaPath = "config/runtime/manifest-lineage.schema.json";
const manifest = readJson(manifestPath);

reporter.assert(exists(manifestPath), `Missing manifest lineage manifest: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing manifest lineage schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Manifest lineage must reference its checked-in schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Manifest lineage must not claim live evidence");
reporter.assert(manifest?.checksumAlgorithm === "sha256", "Manifest lineage must use sha256 checksums");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Manifest lineage must fail closed");

function checksum(relPath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, relPath)))
    .digest("hex");
}

const requiredEntries = [
  "config/runtime/queue-lifecycle-manifest.json",
  "config/runtime/deployment-lineage-manifest.json",
  "config/runtime/cloudflare-binding-ownership.json",
  "config/runtime/deployment-topology.json",
  "config/runtime/environment-lifecycle.json",
  "config/runtime/rollout-lifecycle.json",
  "config/runtime/production-topology.json",
  "config/runtime/live-production-certification.json",
  "config/runtime/operational-certification-policy.json",
];

const entries = manifest?.entries || [];
const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));
for (const relPath of requiredEntries) {
  const entry = entryByPath.get(relPath);
  reporter.assert(Boolean(entry), `Manifest lineage missing entry: ${relPath}`);
  reporter.assert(exists(relPath), `Manifest lineage entry path missing: ${relPath}`);
  reporter.assert(entry?.checksum && entry.checksum !== "PENDING", `Manifest lineage entry must have concrete checksum: ${relPath}`);
  if (entry?.checksum && exists(relPath)) {
    reporter.assert(entry.checksum === checksum(relPath), `Manifest lineage checksum drift: ${relPath}`);
  }
  reporter.assert(Boolean(entry?.owner), `Manifest lineage entry missing owner: ${relPath}`);
  reporter.assert(Boolean(entry?.compatibility), `Manifest lineage entry missing compatibility policy: ${relPath}`);
}

reporter.finish(`${entries.length} manifest lineage entries checked`);
