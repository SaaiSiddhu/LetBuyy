import {
  createReporter,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("No no-op test script validator");

const deployableWorkspaces = [
  "apps/app-marketplace",
  "apps/developer-portal",
  "apps/identity-platform",
  "apps/marketing-site",
  "apps/merchant-control-plane",
  "apps/platform-console",
  "apps/platform-operations-portal",
  "apps/storefront-runtime",
  "apps/theme-marketplace",
  "services/api-gateway",
  "services/queue-workers",
  "services/webhook-service",
];

for (const workspace of deployableWorkspaces) {
  const packageJson = readJson(`${workspace}/package.json`);
  const testScript = packageJson?.scripts?.test || "";

  reporter.assert(Boolean(testScript), `${workspace} must define a test script`);
  reporter.assert(
    !/No tests yet|echo\s+['"]?No tests|exit\s+0/i.test(testScript),
    `${workspace} test script must not be a no-op placeholder`,
  );
  reporter.assert(
    /node --test|tsx --test|pnpm exec tsx --test/.test(testScript),
    `${workspace} test script must invoke a real test runner`,
  );
}

const rootPackageJson = readJson("package.json");
reporter.assert(rootPackageJson?.scripts?.["test:workspaces"] === "turbo test", "Root test:workspaces must execute turbo test");

reporter.finish(`${deployableWorkspaces.length} deployable workspace test scripts checked`);
