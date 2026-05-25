import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Failure domain validator");

const manifestPath = "config/runtime/failure-domain-manifest.json";
const schemaPath = "config/runtime/failure-domain-manifest.schema.json";
const manifest = readJson(manifestPath);
const engine = manifest?.engine || {};

reporter.assert(exists(manifestPath), `Missing failure domain manifest: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing failure domain schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Failure domain manifest must reference its schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Failure domain manifest must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Failure domain manifest must fail closed");
reporter.assert(engine.engineSource === "packages/distributed-runtime/src/failure-domain-runtime.ts", "Failure domain engine must live in distributed-runtime");
reporter.assert(engine.compiler === "compileFailureDomainManifest", "Failure domain manifest must name compiler");
reporter.assert(engine.assertionFunction === "assertFailureDomainsContained", "Failure domain manifest must name assertion");

for (const kind of ["runtime", "rollback", "queue", "replay", "projection", "deployment", "reconciliation"]) {
  reporter.assert((manifest?.domains || []).some((domain) => domain.isolationKind === kind), `Failure domain missing isolation kind: ${kind}`);
}
for (const domain of manifest?.domains || []) {
  reporter.assert(Boolean(domain.blastRadiusBoundary), `Failure domain missing blast radius boundary: ${domain.domainId}`);
  reporter.assert(Boolean(domain.recoveryBoundary), `Failure domain missing recovery boundary: ${domain.domainId}`);
}

const source = readFile(engine.engineSource || "");
for (const fragment of [
  "compileFailureDomainManifest",
  "assertFailureDomainsContained",
  "Failure blast radius undefined",
  "Failure containment zones overlap",
  "containmentChecksum",
]) {
  reporter.assert(source.includes(fragment), `Failure domain source missing fragment: ${fragment}`);
}

reporter.finish(`${manifest?.domains?.length || 0} failure domains checked`);
