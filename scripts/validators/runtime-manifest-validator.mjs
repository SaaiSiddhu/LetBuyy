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
  "orchestrationAuthority",
  "eventAuthority",
  "workflowAuthority",
  "queryAuthority",
  "compositionAuthority",
  "executionOwnership",
  "distributedExecutionOwnership",
  "queueOwnership",
  "providerOwnership",
  "executionBoundaries",
  "asyncExecutionOwnership",
  "observabilityOwnership",
  "telemetryOwnership",
  "workflowRecoveryOwnership",
  "recoveryOwnership",
  "replayOwnership",
  "checkpointOwnership",
  "projectionOwnership",
  "cqrsOwnership",
  "cacheOwnership",
  "coordinationOwnership",
  "resilienceOwnership",
  "regionalOwnership",
  "tenantScalingOwnership",
  "auditOwnership",
];

const requiredObjectFields = [
  "ownership",
  "allowedDependencies",
  "executionAuthority",
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

  const executionAuthority = manifest.executionAuthority;
  for (const field of [
    "executionRole",
    "orchestrationRole",
    "infrastructureOwnership",
    "eventOwnership",
    "queryOwnership",
    "compositionOwnership",
  ]) {
    reporter.assert(
      typeof executionAuthority?.[field] === "string" && executionAuthority[field].trim().length > 0,
      `Runtime manifest executionAuthority.${field} must be a non-empty string: ${manifestPath}`,
    );
  }

  if (runtimeRoot.startsWith("apps/")) {
    reporter.assert(
      /application-services|runtime-composition|none|delegate/i.test(manifest.workflowAuthority),
      `App manifest workflowAuthority must delegate workflow ownership out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|service|infrastructure adapter|provider/i.test(manifest.providerOwnership),
      `App manifest providerOwnership must make direct provider ownership unavailable: ${manifestPath}`,
    );
    reporter.assert(
      /routing|rendering|presentation|transport|runtime hooks|adapter/i.test(manifest.executionBoundaries),
      `App manifest executionBoundaries must restrict authority to thin runtime composition: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|service|queue/i.test(manifest.asyncExecutionOwnership),
      `App manifest asyncExecutionOwnership must delegate durable async ownership: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|service|distributed-runtime|runtime/i.test(manifest.distributedExecutionOwnership),
      `App manifest distributedExecutionOwnership must delegate durable distributed execution out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|service|queue-workers|api/i.test(manifest.queueOwnership),
      `App manifest queueOwnership must delegate queue execution ownership out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|application-services|orchestration|service/i.test(manifest.workflowRecoveryOwnership),
      `App manifest workflowRecoveryOwnership must delegate recovery ownership out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|service|telemetry|observability|distributed-runtime/i.test(manifest.telemetryOwnership),
      `App manifest telemetryOwnership must delegate durable telemetry ownership out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|application-services|orchestration|service/i.test(manifest.recoveryOwnership),
      `App manifest recoveryOwnership must delegate runtime recovery ownership out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|service|orchestration/i.test(manifest.replayOwnership),
      `App manifest replayOwnership must delegate event replay ownership out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /runtime-composition|delegate|none/i.test(manifest.projectionOwnership),
      `App manifest projectionOwnership must delegate projections to runtime-composition: ${manifestPath}`,
    );
    reporter.assert(
      /runtime-composition|application-services|delegate|none|service/i.test(manifest.cqrsOwnership),
      `App manifest cqrsOwnership must delegate command/query ownership out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|service|distributed-runtime|projection-runtime/i.test(manifest.checkpointOwnership),
      `App manifest checkpointOwnership must delegate checkpoint ownership out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|service|runtime-composition|distributed-runtime/i.test(manifest.cacheOwnership),
      `App manifest cacheOwnership must delegate durable cache coordination out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|service|distributed-runtime|coordination/i.test(manifest.coordinationOwnership),
      `App manifest coordinationOwnership must delegate distributed coordination out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|service|infrastructure|distributed-runtime/i.test(manifest.resilienceOwnership),
      `App manifest resilienceOwnership must delegate resilience policy out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|service|cloudflare|regional|distributed-runtime/i.test(manifest.regionalOwnership),
      `App manifest regionalOwnership must delegate regional execution out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|service|tenant|distributed-runtime/i.test(manifest.tenantScalingOwnership),
      `App manifest tenantScalingOwnership must delegate tenant workload governance out of the app: ${manifestPath}`,
    );
    reporter.assert(
      /none|delegate|service|audit|telemetry|distributed-runtime/i.test(manifest.auditOwnership),
      `App manifest auditOwnership must delegate execution audit ownership out of the app: ${manifestPath}`,
    );
  }

  if (runtimeRoot.startsWith("services/")) {
    reporter.assert(
      /execution|transport|worker|webhook|queue|scheduler|handler/i.test(manifest.executionOwnership),
      `Service manifest executionOwnership must describe execution-container authority: ${manifestPath}`,
    );
    reporter.assert(
      /application-services|packages\/application-services|delegate/i.test(manifest.workflowAuthority),
      `Service manifest workflowAuthority must delegate workflows to application-services: ${manifestPath}`,
    );
    reporter.assert(
      /api|worker|queue|webhook|scheduler|transport|adapter|runtime/i.test(manifest.executionBoundaries),
      `Service manifest executionBoundaries must describe execution-container boundaries: ${manifestPath}`,
    );
    reporter.assert(
      /queue|worker|webhook|scheduler|event|delegate|runtime/i.test(manifest.asyncExecutionOwnership),
      `Service manifest asyncExecutionOwnership must describe async execution-container ownership: ${manifestPath}`,
    );
    reporter.assert(
      /distributed-runtime|execution|durable|runtime|delegate/i.test(manifest.distributedExecutionOwnership),
      `Service manifest distributedExecutionOwnership must describe durable distributed execution ownership: ${manifestPath}`,
    );
    reporter.assert(
      /queue|worker|dead-letter|retry|visibility|runtime/i.test(manifest.queueOwnership),
      `Service manifest queueOwnership must describe queue execution, retry, or dead-letter ownership: ${manifestPath}`,
    );
    reporter.assert(
      /checkpoint|recovery|application-services|orchestration|delegate|runtime/i.test(manifest.workflowRecoveryOwnership),
      `Service manifest workflowRecoveryOwnership must describe recovery execution-container ownership with delegated policy: ${manifestPath}`,
    );
    reporter.assert(
      /telemetry|trace|metric|log|observability|distributed-runtime|runtime/i.test(manifest.telemetryOwnership),
      `Service manifest telemetryOwnership must describe telemetry execution ownership: ${manifestPath}`,
    );
    reporter.assert(
      /recovery|checkpoint|workflow|queue|replay|distributed-runtime|orchestration|runtime/i.test(manifest.recoveryOwnership),
      `Service manifest recoveryOwnership must describe runtime recovery execution ownership: ${manifestPath}`,
    );
    reporter.assert(
      /replay|event|orchestration|worker|scheduler|delegate|runtime/i.test(manifest.replayOwnership),
      `Service manifest replayOwnership must describe replay execution-container ownership with orchestration policy: ${manifestPath}`,
    );
    reporter.assert(
      /runtime-composition|delegate|none|projection/i.test(manifest.projectionOwnership),
      `Service manifest projectionOwnership must delegate projection policy to runtime-composition: ${manifestPath}`,
    );
    reporter.assert(
      /cqrs|command|query|runtime-composition|application-services|projection|distributed-runtime/i.test(manifest.cqrsOwnership),
      `Service manifest cqrsOwnership must describe command/query execution ownership: ${manifestPath}`,
    );
    reporter.assert(
      /checkpoint|distributed-runtime|projection-runtime|workflow|runtime/i.test(manifest.checkpointOwnership),
      `Service manifest checkpointOwnership must describe checkpoint execution ownership: ${manifestPath}`,
    );
    reporter.assert(
      /cache|invalidation|runtime-composition|distributed-runtime|projection/i.test(manifest.cacheOwnership),
      `Service manifest cacheOwnership must describe cache coordination or invalidation ownership: ${manifestPath}`,
    );
    reporter.assert(
      /coordination|lease|lock|fencing|leader|distributed-runtime|runtime/i.test(manifest.coordinationOwnership),
      `Service manifest coordinationOwnership must describe distributed coordination ownership: ${manifestPath}`,
    );
    reporter.assert(
      /resilience|circuit|retry|provider|fallback|distributed-runtime|infrastructure/i.test(manifest.resilienceOwnership),
      `Service manifest resilienceOwnership must describe resilience, retry, circuit, provider, or fallback ownership: ${manifestPath}`,
    );
    reporter.assert(
      /region|regional|cloudflare|failover|distributed-runtime|runtime/i.test(manifest.regionalOwnership),
      `Service manifest regionalOwnership must describe region-aware execution or explicit runtime routing: ${manifestPath}`,
    );
    reporter.assert(
      /tenant|quota|noisy|partition|scaling|distributed-runtime/i.test(manifest.tenantScalingOwnership),
      `Service manifest tenantScalingOwnership must describe tenant workload governance: ${manifestPath}`,
    );
    reporter.assert(
      /audit|execution|security|telemetry|distributed-runtime|runtime/i.test(manifest.auditOwnership),
      `Service manifest auditOwnership must describe execution audit ownership: ${manifestPath}`,
    );
  }

  reporter.assert(
    /runtime-composition|delegate|none|projection/i.test(manifest.projectionOwnership),
    `Runtime manifest projectionOwnership must describe runtime-composition projection ownership or explicit absence: ${manifestPath}`,
  );

  reporter.assert(
    /distributed-runtime|delegate|none|service|runtime|durable/i.test(manifest.distributedExecutionOwnership),
    `Runtime manifest distributedExecutionOwnership must describe distributed-runtime ownership or explicit delegation: ${manifestPath}`,
  );

  reporter.assert(
    /correlation|trace|audit|telemetry|observability|request/i.test(manifest.observabilityOwnership),
    `Runtime manifest observabilityOwnership must describe correlation, trace, audit, or telemetry ownership: ${manifestPath}`,
  );

  reporter.assert(
    /telemetry|trace|metric|log|delegate|none|runtime/i.test(manifest.telemetryOwnership),
    `Runtime manifest telemetryOwnership must describe telemetry ownership or explicit delegation: ${manifestPath}`,
  );

  reporter.assert(
    /audit|security|execution|delegate|none|runtime/i.test(manifest.auditOwnership),
    `Runtime manifest auditOwnership must describe audit ownership or explicit delegation: ${manifestPath}`,
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
