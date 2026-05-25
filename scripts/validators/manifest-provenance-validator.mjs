import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Manifest provenance validator");

const intelligence = readJson("config/runtime/runtime-survivability-intelligence.json");
const provenance = intelligence?.manifestProvenance || {};
const lineage = readJson(provenance.lineageManifest || "config/runtime/manifest-lineage.json");

reporter.assert(intelligence?.mode === "governance-contract-not-live-evidence", "Manifest provenance must not claim live evidence");
reporter.assert(provenance.engineSource === "packages/distributed-runtime/src/manifest-provenance-runtime.ts", "Manifest provenance engine must live in distributed-runtime");
reporter.assert(provenance.lineageManifest === "config/runtime/manifest-lineage.json", "Manifest provenance must bind manifest lineage");
reporter.assert(provenance.checksumAlgorithm === "sha256", "Manifest provenance must use sha256");
reporter.assert(provenance.snapshotFunction === "compileManifestProvenance", "Manifest provenance must name snapshot compiler");
reporter.assert(provenance.assertionFunction === "assertManifestProvenance", "Manifest provenance must name assertion");
reporter.assert(provenance.signaturePolicy === "detached-signature-required-before-execute-mode", "Manifest provenance must require detached signatures before execute mode");

const source = readFile(provenance.engineSource || "");
for (const fragment of [
  "compileManifestProvenance",
  "assertManifestProvenance",
  "sha256",
  "parentChecksum",
  "detached-signature-required-before-execute-mode",
  "tamperDetectable",
]) {
  reporter.assert(source.includes(fragment), `Manifest provenance engine missing fragment: ${fragment}`);
}

const lineageByPath = new Map((lineage?.entries || []).map((entry) => [entry.path, entry]));
for (const entry of provenance.ancestryEntries || []) {
  const lineageEntry = lineageByPath.get(entry.path);
  reporter.assert(Boolean(lineageEntry), `Manifest provenance ancestry missing lineage entry: ${entry.path}`);
  reporter.assert(Boolean(entry.owner), `Manifest provenance ancestry missing owner: ${entry.path}`);
  if (entry.parentChecksum !== null) {
    reporter.assert(/^[a-f0-9]{64}$/.test(entry.parentChecksum), `Manifest provenance parent checksum must be sha256: ${entry.path}`);
  }
}

reporter.finish(`${provenance.ancestryEntries?.length || 0} manifest provenance ancestry entries checked`);
