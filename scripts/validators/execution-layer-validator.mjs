import {
  canonicalRuntimeRoots,
  createReporter,
  exists,
  getTrackedFiles,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Execution layer validator");
const trackedFiles = getTrackedFiles();

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

const legacyServiceOrchestration = trackedFiles.filter((file) =>
  file.startsWith("services/api-gateway/src/services/") && file.endsWith(".service.ts"),
);
reporter.warn(
  legacyServiceOrchestration.length === 0,
  `Legacy API gateway service orchestration remains for incremental extraction: ${legacyServiceOrchestration.length} files`,
);

reporter.finish(`${requiredExecutionRoots.length} execution foundation files checked`);
