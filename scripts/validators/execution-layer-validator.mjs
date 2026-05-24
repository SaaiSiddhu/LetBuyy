import {
  canonicalRuntimeRoots,
  createReporter,
  exists,
  getTrackedFiles,
  listWorkspaceFiles,
  readJson,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Execution layer validator");
const workspaceFiles = [...new Set([...getTrackedFiles(), ...listWorkspaceFiles()])].sort();

const requiredExecutionRoots = [
  "packages/application-services/auth-application/index.ts",
  "packages/application-services/commerce-application/index.ts",
  "packages/application-services/checkout-application/index.ts",
  "packages/application-services/tenant-application/index.ts",
  "packages/application-services/cms-application/index.ts",
  "packages/application-services/theme-application/index.ts",
  "packages/application-services/billing-application/index.ts",
  "packages/application-services/notification-application/index.ts",
  "packages/application-services/search-application/index.ts",
  "packages/application-services/src/execution-pipeline.ts",
  "packages/infrastructure/stripe-adapter/index.ts",
  "packages/infrastructure/razorpay-adapter/index.ts",
  "packages/infrastructure/supabase-adapter/index.ts",
  "packages/infrastructure/cloudflare-adapter/index.ts",
  "packages/infrastructure/resend-adapter/index.ts",
  "packages/infrastructure/storage-adapter/index.ts",
  "packages/infrastructure/queue-adapter/index.ts",
  "packages/infrastructure/analytics-adapter/index.ts",
  "packages/infrastructure/cache-adapter/index.ts",
  "packages/infrastructure/search-provider-adapter/index.ts",
  "packages/orchestration/src/index.ts",
  "packages/orchestration/src/event-runtime.ts",
  "packages/orchestration/src/outbox-runtime.ts",
  "packages/orchestration/src/observability-runtime.ts",
  "packages/orchestration/src/replay-runtime.ts",
  "packages/orchestration/src/workflow-recovery-runtime.ts",
  "packages/orchestration/src/async-execution-runtime.ts",
  "packages/orchestration/src/reliability-runtime.ts",
  "packages/orchestration/src/workflow-checkpoint-runtime.ts",
  "packages/runtime-composition/src/query-runtime.ts",
  "packages/runtime-composition/src/projection-execution-runtime.ts",
  "packages/runtime-composition/src/composition-runtime.ts",
  "packages/runtime-composition/src/search-projection-runtime.ts",
  "packages/runtime-composition/storefront-query-layer/index.ts",
  "packages/runtime-composition/merchant-query-layer/index.ts",
  "packages/runtime-composition/analytics-query-layer/index.ts",
  "packages/runtime-composition/mobile-query-layer/index.ts",
  "packages/runtime-composition/checkout-runtime-adapter/index.ts",
  "packages/runtime-composition/identity-runtime-adapter/index.ts",
  "packages/theme-engine/src/execution-runtime.ts",
];

for (const file of requiredExecutionRoots) {
  reporter.assert(exists(file), `Missing Phase 2 execution foundation file: ${file}`);
}

for (const runtimeRoot of canonicalRuntimeRoots) {
  const manifest = readJson(`${runtimeRoot}/runtime.manifest.json`);
  reporter.assert(
    Boolean(manifest?.executionAuthority),
    `Runtime manifest missing executionAuthority: ${runtimeRoot}/runtime.manifest.json`,
  );
  for (const field of ["workflowRecoveryOwnership", "replayOwnership", "projectionOwnership"]) {
    reporter.assert(
      typeof manifest?.[field] === "string" && manifest[field].trim().length > 0,
      `Runtime manifest missing final execution ownership field ${field}: ${runtimeRoot}/runtime.manifest.json`,
    );
  }
}

const applicationServiceWorkflowFiles = [
  "packages/application-services/auth-application/index.ts",
  "packages/application-services/commerce-application/index.ts",
  "packages/application-services/checkout-application/index.ts",
  "packages/application-services/tenant-application/index.ts",
  "packages/application-services/cms-application/index.ts",
  "packages/application-services/theme-application/index.ts",
  "packages/application-services/billing-application/index.ts",
  "packages/application-services/notification-application/index.ts",
  "packages/application-services/search-application/index.ts",
];

for (const file of applicationServiceWorkflowFiles) {
  const content = readFile(file);
  reporter.assert(
    /defineApplicationWorkflows\s*\(/.test(content) && /defineExecutionPipelines\s*\(/.test(content),
    `Application-service workflow file must declare authoritative workflows and execution pipelines: ${file}`,
  );
}

const legacyServiceOrchestration = workspaceFiles.filter((file) =>
  /^services\/[^/]+\/src\/services\/.+\.service\.ts$/.test(file),
);
reporter.assert(
  legacyServiceOrchestration.length === 0,
  `Service-owned orchestration files are forbidden; move workflows to packages/application-services and use execution adapters: ${legacyServiceOrchestration.join(", ")}`,
);

const apiGatewaySourceFiles = workspaceFiles.filter(
  (file) => file.startsWith("services/api-gateway/src/") && file.endsWith(".ts"),
);

for (const file of apiGatewaySourceFiles) {
  const content = readFile(file);
  reporter.assert(
    !/from\s+['"](?:\.\.?\/)+services(?:\/|['"])/.test(content) &&
      !/import\(\s*['"](?:\.\.?\/)+services(?:\/|['"])/.test(content),
    `API gateway source must not import legacy service orchestration modules: ${file}`,
  );
}

const executionAdapters = workspaceFiles.filter((file) =>
  file.startsWith("services/api-gateway/src/execution/") && file.endsWith("-execution.adapter.ts"),
);

reporter.assert(
  executionAdapters.length >= 10,
  `API gateway execution adapters must replace legacy services; found ${executionAdapters.length}`,
);

for (const file of executionAdapters) {
  const content = readFile(file);
  reporter.assert(
    content.includes("applicationWorkflows") || content.includes("correlationContract"),
    `Execution adapter must declare application-service or observability authority: ${file}`,
  );
  reporter.assert(
    content.includes("runtimeBridge"),
    `Execution adapter must declare a pure runtime bridge contract: ${file}`,
  );
  reporter.assert(
    content.includes("executionPipelines") || content.includes("correlationContract"),
    `Execution adapter must consume application-service execution pipelines or observability contracts: ${file}`,
  );
  reporter.assert(
    !/function\s+(?:generateSlug|stableJson|retryDelaySeconds|queueNamesForEvent|eventMatchesSubscription|buildEventEnvelope|textParts|rollupDate)\b/.test(content),
    `Execution adapter contains workflow policy helpers that belong in application-services/orchestration/runtime-composition: ${file}`,
  );
  reporter.assert(
    !/\b(?:buildSearchProjectionDocument|analyticsRollupDate|project\w*SearchDocument|markSearchDocumentDeleted)\b/.test(content),
    `Execution adapter contains projection or aggregation ownership that belongs in packages/runtime-composition: ${file}`,
  );
  reporter.assert(
    !/\b(?:queueNamesForEvent|eventMatchesSubscription|eventRetryDelaySeconds|buildDomainEventEnvelope)\b/.test(content) ||
      content.includes("@letbuyy/orchestration"),
    `Execution adapter event routing, retry, and envelope helpers must come from packages/orchestration: ${file}`,
  );
}

const runtimeLeakageFiles = workspaceFiles.filter((file) =>
  (file.startsWith("apps/") || file.startsWith("services/")) &&
  file.includes("/src/") &&
  /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file) &&
  /(workflow|orchestr|aggregation|projection|pipeline)/i.test(file),
);
reporter.assert(
  runtimeLeakageFiles.length === 0,
  `Apps/services may not own workflow, orchestration, aggregation, projection, or pipeline modules: ${runtimeLeakageFiles.join(", ")}`,
);

const forbiddenRuntimeDefinitions = [
  /\bdefineExecutionPipelines\s*\(/,
  /\bdefineApplicationWorkflows\s*\(/,
  /\bclass\s+\w*Workflow\w*\b/,
  /\bclass\s+\w*Orchestr\w*\b/,
  /\binterface\s+\w*Workflow\w*\b/,
  /\binterface\s+\w*Aggregation\w*\b/,
  /\bfunction\s+\w*(?:Workflow|Orchestrat|Aggregation|Projection|Pipeline)\w*\s*\(/,
];

for (const file of workspaceFiles.filter((candidate) =>
  (candidate.startsWith("apps/") || candidate.startsWith("services/")) &&
  candidate.includes("/src/") &&
  /\.(ts|tsx)$/.test(candidate)
)) {
  const content = readFile(file);
  for (const pattern of forbiddenRuntimeDefinitions) {
    reporter.assert(
      !pattern.test(content),
      `Apps/services may not define workflow, orchestration, aggregation, projection, or pipeline authority: ${file}`,
    );
  }

  if (file.startsWith("services/")) {
    reporter.assert(
      !/\b(RuntimeAggregationPipeline|executeRuntimeAggregation|executeRuntimeQuery|composeRuntimeResponse|buildSearchProjectionDocument)\b/.test(content) ||
        content.includes("@letbuyy/runtime-composition"),
      `Service-side query/projection helpers must come from packages/runtime-composition: ${file}`,
    );
  }
}

for (const file of workspaceFiles.filter((candidate) =>
  candidate.startsWith("packages/application-services/") &&
  /\.(ts|tsx)$/.test(candidate)
)) {
  const content = readFile(file);
  reporter.assert(
    !/\b(RuntimeAggregationPipeline|executeRuntimeAggregation|executeRuntimeQuery|composeRuntimeResponse|buildSearchProjectionDocument|ProjectionExecutionRuntime|ProjectionAssembler)\b/.test(content),
    `Application services may not own query aggregation or projection assembly: ${file}`,
  );
}

const storefrontEntry = "apps/storefront-runtime/src/app/store/[subdomain]/page.tsx";
if (exists(storefrontEntry)) {
  const content = readFile(storefrontEntry);
  reporter.assert(
    content.includes("composeStorefrontRuntimeProjection"),
    `Storefront runtime entry must delegate read aggregation to packages/runtime-composition: ${storefrontEntry}`,
  );
}

reporter.finish(`${requiredExecutionRoots.length} execution foundation files checked; ${executionAdapters.length} execution adapters enforced`);
