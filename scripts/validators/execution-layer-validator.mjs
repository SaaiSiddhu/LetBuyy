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
  "packages/runtime-composition/src/query-runtime.ts",
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
