import path from "node:path";
import {
  canonicalAppRoots,
  createReporter,
  exists,
  getTrackedFiles,
  readFile,
  readJson,
  workspacePackageRoots,
} from "./governance-common.mjs";

const reporter = createReporter("App utils service-role edge validator");
const trackedFiles = getTrackedFiles();
const dependencyFields = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

for (const appRoot of canonicalAppRoots.filter((root) => !root.startsWith("apps/mobile/"))) {
  const packageJsonPath = `${appRoot}/package.json`;
  const packageJson = readJson(packageJsonPath);
  if (!packageJson) continue;

  for (const field of dependencyFields) {
    reporter.assert(
      !packageJson[field]?.["@letbuyy/utils"],
      `${packageJsonPath} must not declare @letbuyy/utils in ${field}`,
    );
  }

  const manifestPath = `${appRoot}/runtime.manifest.json`;
  const manifest = readJson(manifestPath);
  const allowedWorkspacePackages = manifest?.allowedDependencies?.workspacePackages ?? [];
  reporter.assert(
    !allowedWorkspacePackages.includes("@letbuyy/utils"),
    `${manifestPath} must not allow @letbuyy/utils`,
  );
}

const importOffenders = trackedFiles.filter((file) => {
  if (!/^(apps|services|packages)\//.test(file)) return false;
  if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file)) return false;
  const content = readFile(file);
  return /(?:from\s+['"]@letbuyy\/utils(?:\/[^'"]*)?['"]|require\(['"]@letbuyy\/utils(?:\/[^'"]*)?['"]\))/.test(content);
});
reporter.assert(
  importOffenders.length === 0,
  `Active source must not import retired @letbuyy/utils: ${importOffenders.join(", ")}`,
);

const manifestOffenders = trackedFiles.filter((file) => {
  if (!/^(apps|services|packages)\//.test(file)) return false;
  if (!/(?:package\.json|runtime\.manifest\.json)$/.test(file)) return false;
  return readFile(file).includes("@letbuyy/utils");
});
reporter.assert(
  manifestOffenders.length === 0,
  `Active manifests must not reference retired @letbuyy/utils: ${manifestOffenders.join(", ")}`,
);

reporter.assert(
  !exists("packages/typescript/utils/package.json"),
  "packages/typescript/utils must remain retired and out of the active pnpm workspace",
);
reporter.assert(
  !exists("packages/typescript/utils/src/supabase.ts"),
  "retired @letbuyy/utils must not expose a service-role Supabase helper from active source",
);
reporter.assert(
  !workspacePackageRoots.includes("packages/typescript/utils"),
  "governance-common workspacePackageRoots must not list retired packages/typescript/utils",
);

const appReachablePackageRoots = new Set();
for (const appRoot of canonicalAppRoots.filter((root) => !root.startsWith("apps/mobile/"))) {
  const packageJson = readJson(`${appRoot}/package.json`);
  for (const field of dependencyFields) {
    for (const dependencyName of Object.keys(packageJson?.[field] ?? {})) {
      if (!dependencyName.startsWith("@letbuyy/")) continue;

      const workspaceRoot = workspacePackageRoots.find((root) => {
        const manifest = readJson(path.posix.join(root, "package.json"));
        return manifest?.name === dependencyName;
      });
      if (workspaceRoot) appReachablePackageRoots.add(workspaceRoot);
    }
  }
}

const serviceRolePatterns = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /createSupabaseServiceClient/,
  /getSupabaseAdmin/,
  /service[-_\s]?role/i,
];
const serviceRoleOffenders = trackedFiles.filter((file) => {
  if (![...appReachablePackageRoots].some((root) => file.startsWith(`${root}/`))) return false;
  if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file)) return false;
  const content = readFile(file);
  return serviceRolePatterns.some((pattern) => pattern.test(content));
});
reporter.assert(
  serviceRoleOffenders.length === 0,
  `App-reachable workspace packages must not expose service-role helpers: ${serviceRoleOffenders.join(", ")}`,
);

reporter.finish("retired @letbuyy/utils is not app-reachable and no service-role helper is exposed through app package graphs");
