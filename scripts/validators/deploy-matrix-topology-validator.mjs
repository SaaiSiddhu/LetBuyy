import {
  canonicalAppRoots,
  canonicalServiceRoots,
  createReporter,
  exists,
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
  "apps/merchant_web",
  "apps/customer_web",
  "apps/admin_web",
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
const packageJson = readJson("package.json");
const vercelProjectBranches = JSON.stringify(vercelProjects);
reporter.assert(
  !vercelProjectBranches.includes('"branch":"develop"') && !vercelProjectBranches.includes('"branch": "develop"'),
  "Vercel project registry must not target retired develop branch",
);
reporter.assert(
  !readFile(".github/workflows/deploy-staging.yml").includes("branches: [develop]"),
  "Staging deploy workflow must not trigger from retired develop branch",
);

for (const appRoot of expectedApps) {
  reporter.assert(vercelProjectDirs.has(appRoot), `Vercel project registry missing active app: ${appRoot}`);
}

for (const frozenRoot of frozenAppRoots) {
  reporter.assert(!vercelProjectDirs.has(frozenRoot), `Frozen app must not be in Vercel project registry: ${frozenRoot}`);
  reporter.assert(!exists(`${frozenRoot}/vercel.json`), `Frozen app must not keep a Vercel deploy manifest: ${frozenRoot}/vercel.json`);

  const manifest = readJson(`${frozenRoot}/runtime.manifest.json`);
  reporter.assert(
    manifest?.runtimeCategory === "frozen-next-app",
    `Frozen app runtime manifest must declare frozen-next-app category: ${frozenRoot}`,
  );
  reporter.assert(
    manifest?.deploymentAuthority?.platform === "frozen-not-deployed",
    `Frozen app deployment authority must be frozen-not-deployed: ${frozenRoot}`,
  );
  reporter.assert(
    Array.isArray(manifest?.deploymentAuthority?.config) && manifest.deploymentAuthority.config.length === 0,
    `Frozen app deployment authority must not list deploy config: ${frozenRoot}`,
  );
  reporter.assert(
    manifest?.environmentAuthority?.secretStore === "none - frozen app is not deployed",
    `Frozen app must not claim a provider secret store: ${frozenRoot}`,
  );

  const packageName = readJson(`${frozenRoot}/package.json`)?.name;
  reporter.assert(
    typeof packageName === "string" &&
      packageJson.scripts?.build?.includes(`--filter=!${packageName}`) &&
      packageJson.scripts?.lint?.includes(`--filter=!${packageName}`) &&
      packageJson.scripts?.typecheck?.includes(`--filter=!${packageName}`),
    `Root build/lint/typecheck scripts must exclude frozen app package: ${frozenRoot}`,
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

reporter.finish(`${expectedApps.length + expectedWorkers.length} production deploy targets and staging/Vercel frozen exclusions checked`);
