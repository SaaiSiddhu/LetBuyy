import {
  canonicalAppRoots,
  canonicalServiceRoots,
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Deploy matrix topology validator");
const workflow = readFile(".github/workflows/production-deploy.yml");
const retiredProductionDomain = ["letbuyy", "store"].join(".");

const expectedApps = [
  "apps/marketing-site",
  "apps/identity-platform",
  "apps/merchant-control-plane",
  "apps/storefront-runtime",
  "apps/platform-console",
];

const expectedWorkers = [
  "services/api-gateway",
  "services/webhook-service",
  "services/queue-workers",
  "services/mobile-bff",
];

for (const appRoot of expectedApps) {
  reporter.assert(workflow.includes(`- app: ${appRoot.replace("apps/", "")}`), `Production deploy matrix missing ${appRoot}`);
}

for (const workerRoot of expectedWorkers) {
  reporter.assert(workflow.includes(`working-directory: ${workerRoot}`), `Production worker deploy missing ${workerRoot}`);
}

for (const frozenRoot of [
  "apps/app-marketplace",
  "apps/developer-portal",
  "apps/theme-marketplace",
  "apps/platform-operations-portal",
]) {
  reporter.assert(
    !workflow.includes(`- app: ${frozenRoot.replace("apps/", "")}`),
    `Frozen app must not be in production deploy matrix: ${frozenRoot}`,
  );
}

for (const reservedRoot of [
  "services/checkout-runtime",
  "services/search-service",
  "services/media-service",
  "services/notification-service",
  "services/event-bus",
  "services/analytics-pipeline",
]) {
  reporter.assert(
    !workflow.includes(`working-directory: ${reservedRoot}`),
    `Reserved service must not be deployed to production: ${reservedRoot}`,
  );
}

for (const activeRoot of [...expectedApps, ...expectedWorkers]) {
  reporter.assert(
    canonicalAppRoots.includes(activeRoot) || canonicalServiceRoots.includes(activeRoot),
    `Production deploy root is not registered as active canonical runtime: ${activeRoot}`,
  );
}

reporter.assert(
  !workflow.includes(retiredProductionDomain),
  "Production deploy workflow must use letbuyy.com, not the retired production store domain",
);

reporter.finish(`${expectedApps.length + expectedWorkers.length} production deploy targets checked`);
