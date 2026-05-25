import fs from "node:fs";
import path from "node:path";
import {
  createReporter,
  exists,
  getTrackedFiles,
  packageRootForManifest,
  readFile,
  readJson,
  root,
} from "./governance-common.mjs";

const reporter = createReporter("Workspace lifecycle validator");
const trackedFiles = getTrackedFiles();

for (const file of [
  "package.json",
  ".npmrc",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "turbo.json",
  "tsconfig.base.json",
  "tsconfig.workspace.json",
]) {
  reporter.assert(exists(file), `Missing monorepo lifecycle file: ${file}`);
}

const rootPackage = readJson("package.json");
const npmrc = readFile(".npmrc");
const workspace = readFile("pnpm-workspace.yaml");
const lockfile = readFile("pnpm-lock.yaml");
const turbo = readJson("turbo.json");

const requiredNpmrc = [
  "node-linker=isolated",
  "shamefully-hoist=false",
  "strict-peer-dependencies=true",
  "auto-install-peers=false",
  "frozen-lockfile=true",
  "shared-workspace-lockfile=true",
];

for (const setting of requiredNpmrc) {
  reporter.assert(npmrc.includes(setting), `.npmrc must enforce ${setting}`);
}

for (const forbidden of [
  "node-linker=hoisted",
  "node-linker=pnp",
  "shamefully-hoist=true",
  "auto-install-peers=true",
  "strict-peer-dependencies=false",
  "shared-workspace-lockfile=false",
  "frozen-lockfile=false",
]) {
  reporter.assert(!npmrc.includes(forbidden), `.npmrc must not allow ${forbidden}`);
}

reporter.assert(rootPackage?.private === true, "Root package must remain private");
reporter.assert(rootPackage?.packageManager === "pnpm@10.6.2", "Root packageManager must pin pnpm@10.6.2");
reporter.assert(rootPackage?.scripts?.["validate:workspace"] === "node scripts/validators/workspace-lifecycle-validator.mjs", "Root package must expose validate:workspace");

for (const [name, version] of Object.entries(rootPackage?.devDependencies ?? {})) {
  reporter.assert(!/^[\^~*xX<>]/.test(version), `Root toolchain dependency must be exact: ${name}@${version}`);
}

for (const requiredPattern of [
  '- "apps/*"',
  '- "apps/mobile/*"',
  '- "packages/typescript/*"',
  '- "services/*"',
]) {
  reporter.assert(workspace.includes(requiredPattern), `pnpm workspace missing required pattern ${requiredPattern}`);
}

for (const requiredPackage of [
  '- "packages/shared-types"',
  '- "packages/application-services"',
  '- "packages/distributed-runtime"',
  '- "packages/projection-runtime"',
  '- "packages/orchestration"',
  '- "packages/runtime-composition"',
  '- "packages/infrastructure"',
]) {
  reporter.assert(workspace.includes(requiredPackage), `pnpm workspace missing governed package ${requiredPackage}`);
}

for (const builtDependency of ["esbuild", "sharp", "unrs-resolver", "workerd"]) {
  reporter.assert(workspace.includes(`  - ${builtDependency}`), `pnpm workspace must explicitly allow built dependency ${builtDependency}`);
}

reporter.assert(lockfile.includes("lockfileVersion: '9.0'"), "pnpm lockfile must be v9");
reporter.assert(lockfile.includes("autoInstallPeers: false"), "pnpm lockfile must preserve autoInstallPeers=false");
reporter.assert(lockfile.includes("excludeLinksFromLockfile: false"), "pnpm lockfile must preserve linked workspace packages");
reporter.assert(lockfile.includes("specifier: 2.8.9") && lockfile.includes("version: 2.8.9"), "pnpm lockfile must pin turbo exactly");
reporter.assert(lockfile.includes("specifier: 5.9.3") && lockfile.includes("version: 5.9.3"), "pnpm lockfile must pin TypeScript exactly at root");

const packageManifestFiles = trackedFiles.filter((file) =>
  (file.startsWith("apps/") || file.startsWith("services/") || file.startsWith("packages/")) &&
  file.endsWith("/package.json")
);

const workspacePackageNames = new Map();
for (const file of packageManifestFiles) {
  const manifest = readJson(file);
  if (manifest?.name) workspacePackageNames.set(manifest.name, packageRootForManifest(file));
}

for (const file of packageManifestFiles) {
  const manifest = readJson(file);
  const rootPath = packageRootForManifest(file);

  reporter.assert(typeof manifest?.name === "string" && manifest.name.length > 0, `Workspace manifest missing package name: ${file}`);
  reporter.assert(!manifest?.packageManager || manifest.packageManager === rootPackage.packageManager, `Workspace packageManager must not drift from root: ${file}`);

  for (const blockName of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    for (const [dependencyName, specifier] of Object.entries(manifest?.[blockName] ?? {})) {
      if (!workspacePackageNames.has(dependencyName)) continue;
      reporter.assert(
        specifier === "workspace:*",
        `Internal workspace dependency must use workspace:* in ${rootPath}: ${dependencyName}@${specifier}`,
      );
    }
  }
}

for (const lock of trackedFiles.filter((file) =>
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb|pnpm-lock\.yaml)$/.test(file)
)) {
  if (lock === "pnpm-lock.yaml") continue;
  reporter.assert(lock.startsWith("legacy/"), `Non-pnpm lockfile is forbidden outside legacy isolation: ${lock}`);
}

for (const file of trackedFiles) {
  reporter.assert(
    !/(^|\/)node_modules\//.test(file) && !/(^|\/)(\.next|\.turbo|\.wrangler|dist|build|coverage)\//.test(file),
    `Generated dependency/build artifact must not be tracked: ${file}`,
  );
}

function workflowFiles() {
  const workflowsDir = path.join(root, ".github/workflows");
  if (!fs.existsSync(workflowsDir)) return [];
  return fs.readdirSync(workflowsDir)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
    .map((file) => `.github/workflows/${file}`);
}

for (const workflowFile of workflowFiles()) {
  const text = readFile(workflowFile);
  if (text.includes("pnpm install")) {
    reporter.assert(text.includes("pnpm install --frozen-lockfile"), `Workflow pnpm installs must be frozen: ${workflowFile}`);
  }
  reporter.assert(!/\bnpm\s+install\b/.test(text), `Workflow must not use npm install: ${workflowFile}`);
  reporter.assert(!/\byarn\s+install\b/.test(text), `Workflow must not use yarn install: ${workflowFile}`);
}

const tasks = turbo?.tasks ?? {};
reporter.assert(Array.isArray(tasks.build?.dependsOn) && tasks.build.dependsOn.includes("^typecheck") && tasks.build.dependsOn.includes("^build"), "Turbo build must depend on upstream typecheck and build tasks");
reporter.assert(Array.isArray(tasks.typecheck?.dependsOn) && tasks.typecheck.dependsOn.includes("^build"), "Turbo typecheck must depend on upstream builds for deterministic declaration order");
reporter.assert(Array.isArray(tasks.typecheck?.outputs) && tasks.typecheck.outputs.length === 0, "Turbo typecheck must not cache generated outputs");
reporter.assert(Array.isArray(tasks.test?.dependsOn) && tasks.test.dependsOn.includes("^typecheck"), "Turbo test must depend on upstream typecheck");
reporter.assert(Array.isArray(tasks.build?.outputs) && tasks.build.outputs.includes(".next/**") && tasks.build.outputs.includes("dist/**"), "Turbo build outputs must declare app and package artifact directories");

reporter.finish(`${packageManifestFiles.length} workspace manifests, ${workflowFiles().length} workflows, pnpm lifecycle, tracked artifacts, and Turbo tasks checked`);
