import {
  canonicalRuntimeRoots,
  createReporter,
  exists,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Runtime manifest validator");

const requiredStringFields = [
  "runtimeName",
  "runtimeRoot",
  "runtimeCategory",
  "runtimeClassification",
];

const requiredObjectFields = [
  "ownership",
  "allowedDependencies",
  "deploymentAuthority",
  "environmentAuthority",
  "observabilityAuthority",
];

for (const runtimeRoot of canonicalRuntimeRoots) {
  const manifestPath = `${runtimeRoot}/runtime.manifest.json`;
  reporter.assert(exists(manifestPath), `Missing runtime manifest: ${manifestPath}`);

  const manifest = readJson(manifestPath);
  if (!manifest) {
    reporter.errors.push(`Runtime manifest is not valid JSON: ${manifestPath}`);
    continue;
  }

  for (const field of requiredStringFields) {
    reporter.assert(
      typeof manifest[field] === "string" && manifest[field].trim().length > 0,
      `Runtime manifest lacks required string field ${field}: ${manifestPath}`,
    );
  }

  for (const field of requiredObjectFields) {
    reporter.assert(
      typeof manifest[field] === "object" && manifest[field] !== null && !Array.isArray(manifest[field]),
      `Runtime manifest lacks required object field ${field}: ${manifestPath}`,
    );
  }

  reporter.assert(
    manifest.runtimeRoot === runtimeRoot,
    `Runtime manifest root mismatch in ${manifestPath}: expected ${runtimeRoot}, found ${manifest.runtimeRoot}`,
  );

  reporter.assert(
    Array.isArray(manifest.actorType) && manifest.actorType.length > 0,
    `Runtime manifest actorType must be a non-empty array: ${manifestPath}`,
  );

  reporter.assert(
    Array.isArray(manifest.forbiddenDependencies) && manifest.forbiddenDependencies.length > 0,
    `Runtime manifest forbiddenDependencies must be a non-empty array: ${manifestPath}`,
  );

  const schema = manifest.environmentAuthority?.schema;
  reporter.assert(
    typeof schema === "string" && exists(schema),
    `Runtime manifest environment schema must exist: ${manifestPath}`,
  );

  const docs = manifest.ownership?.governanceDocs;
  reporter.assert(
    Array.isArray(docs) && docs.length > 0 && docs.every((doc) => typeof doc === "string" && exists(doc)),
    `Runtime manifest must reference existing governance docs: ${manifestPath}`,
  );
}

const platformConsole = readJson("apps/platform-console/runtime.manifest.json");
const operationsPortal = readJson("apps/platform-operations-portal/runtime.manifest.json");

reporter.assert(
  platformConsole?.actorType?.includes("platform-operator"),
  "Platform Console manifest must classify platform-operator authority",
);

reporter.assert(
  operationsPortal?.actorType?.includes("platform-employee"),
  "Platform Operations Portal manifest must classify platform-employee authority",
);

reporter.finish(`${canonicalRuntimeRoots.length} runtime manifests checked`);
