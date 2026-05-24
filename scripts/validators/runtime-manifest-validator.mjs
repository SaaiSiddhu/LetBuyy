import {
  canonicalRuntimeRoots,
  createReporter,
  exists,
  getTrackedFiles,
  listWorkspaceFiles,
  packageRootForManifest,
  readJson,
  readFile,
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

const trackedFiles = [...new Set([...getTrackedFiles(), ...listWorkspaceFiles()])].sort();
const packageNameToRoot = new Map();

for (const file of trackedFiles.filter((candidate) => candidate.endsWith("/package.json") || candidate === "package.json")) {
  const json = readJson(file);
  if (json?.name) packageNameToRoot.set(json.name, packageRootForManifest(file));
}

for (const file of trackedFiles.filter((candidate) => candidate.endsWith("/pubspec.yaml") || candidate === "pubspec.yaml")) {
  const text = readFile(file);
  const match = text.match(/^name:\s*([A-Za-z0-9_]+)/m);
  if (match) packageNameToRoot.set(match[1], packageRootForManifest(file));
}

function manifestDeclaredInternalDependencies(runtimeRoot) {
  const dependencies = new Set();
  const packageJson = readJson(`${runtimeRoot}/package.json`);
  if (packageJson) {
    for (const block of [
      packageJson.dependencies,
      packageJson.devDependencies,
      packageJson.peerDependencies,
      packageJson.optionalDependencies,
    ]) {
      for (const dependencyName of Object.keys(block ?? {})) {
        if (packageNameToRoot.has(dependencyName)) dependencies.add(dependencyName);
      }
    }
  }

  const pubspecPath = `${runtimeRoot}/pubspec.yaml`;
  if (exists(pubspecPath)) {
    const text = readFile(pubspecPath);
    for (const dependencyName of packageNameToRoot.keys()) {
      const dependencyPattern = new RegExp(`^\\s{2}${dependencyName}:\\s`, "m");
      if (dependencyPattern.test(text)) dependencies.add(dependencyName);
    }
  }

  return dependencies;
}

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

  const allowedWorkspacePackages = manifest.allowedDependencies?.workspacePackages;
  reporter.assert(
    Array.isArray(allowedWorkspacePackages),
    `Runtime manifest allowedDependencies.workspacePackages must be an array: ${manifestPath}`,
  );

  if (Array.isArray(allowedWorkspacePackages)) {
    for (const dependencyName of allowedWorkspacePackages) {
      reporter.assert(
        packageNameToRoot.has(dependencyName),
        `Runtime manifest references unknown workspace package ${dependencyName}: ${manifestPath}`,
      );
    }

    const declaredInternalDependencies = manifestDeclaredInternalDependencies(runtimeRoot);
    const hasDependencyManifest = exists(`${runtimeRoot}/package.json`) || exists(`${runtimeRoot}/pubspec.yaml`);
    if (hasDependencyManifest) {
      const missingManifestDependencies = [...declaredInternalDependencies].filter(
        (dependencyName) => !allowedWorkspacePackages.includes(dependencyName),
      );
      const staleManifestDependencies = allowedWorkspacePackages.filter(
        (dependencyName) => !declaredInternalDependencies.has(dependencyName),
      );

      reporter.assert(
        missingManifestDependencies.length === 0,
        `Runtime manifest missing declared internal dependencies in ${manifestPath}: ${missingManifestDependencies.join(", ")}`,
      );
      reporter.assert(
        staleManifestDependencies.length === 0,
        `Runtime manifest lists undeclared internal dependencies in ${manifestPath}: ${staleManifestDependencies.join(", ")}`,
      );
    }
  }
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
