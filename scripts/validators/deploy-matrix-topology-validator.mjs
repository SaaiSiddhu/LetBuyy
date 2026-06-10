import {
  canonicalAppRoots,
  canonicalServiceRoots,
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Deploy matrix topology validator");
const workflow = readFile(".github/workflows/production-deploy.yml");
const stagingWorkflows = [
  ".github/workflows/deploy-staging.yml",
  ".github/workflows/staging-deploy.yml",
];
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

const frozenAppRoots = [
  "apps/app-marketplace",
  "apps/developer-portal",
  "apps/theme-marketplace",
  "apps/platform-operations-portal",
];

for (const appRoot of expectedApps) {
  reporter.assert(workflow.includes(`- app: ${appRoot.replace("apps/", "")}`), `Production deploy matrix missing ${appRoot}`);
}

for (const workerRoot of expectedWorkers) {
  reporter.assert(workflow.includes(`working-directory: ${workerRoot}`), `Production worker deploy missing ${workerRoot}`);
}

for (const frozenRoot of frozenAppRoots) {
  const frozenName = frozenRoot.replace("apps/", "");
  reporter.assert(
    !workflow.includes(`- app: ${frozenName}`),
    `Frozen app must not be in production deploy matrix: ${frozenRoot}`,
  );

  for (const stagingWorkflowPath of stagingWorkflows) {
    const stagingWorkflow = readFile(stagingWorkflowPath);
    reporter.assert(
      !stagingWorkflow.includes(`- app: ${frozenName}`) &&
        !stagingWorkflow.includes(`name: ${frozenName}`) &&
        !stagingWorkflow.includes(`apps/${frozenName}`),
      `Frozen app must not be in staging deploy matrix: ${stagingWorkflowPath} -> ${frozenRoot}`,
    );
  }
}

const vercelProjects = readJson("config/vercel/projects.json");
const vercelProjectDirs = new Set((vercelProjects?.apps || []).map((app) => app.directory));

for (const appRoot of expectedApps) {
  reporter.assert(vercelProjectDirs.has(appRoot), `Vercel project registry missing active app: ${appRoot}`);
}

for (const frozenRoot of frozenAppRoots) {
  reporter.assert(!vercelProjectDirs.has(frozenRoot), `Frozen app must not be in Vercel project registry: ${frozenRoot}`);
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

reporter.finish(`${expectedApps.length + expectedWorkers.length} production deploy targets and staging/Vercel frozen exclusions checked`);
