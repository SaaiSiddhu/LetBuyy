import path from "node:path";
import {
  createReporter,
  exists,
  getTrackedFiles,
  packageRootForManifest,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("TypeScript governance validator");
const trackedFiles = getTrackedFiles();

reporter.assert(exists("tsconfig.base.json"), "Missing root tsconfig.base.json");
reporter.assert(exists("tsconfig.workspace.json"), "Missing root tsconfig.workspace.json");

const workspaceReferences = new Set((readJson("tsconfig.workspace.json")?.references ?? []).map((reference) => path.posix.normalize(reference.path.replace(/^\.\//, ""))));
const packageManifests = trackedFiles.filter((file) => file.startsWith("packages/") && file.endsWith("/package.json"));

for (const manifestPath of packageManifests) {
  const root = packageRootForManifest(manifestPath);
  const tsconfigPath = `${root}/tsconfig.json`;
  if (!exists(tsconfigPath)) continue;

  const manifest = readJson(manifestPath);
  const tsconfig = readJson(tsconfigPath);
  const compilerOptions = tsconfig?.compilerOptions ?? {};
  const expectedExtends = path.posix.relative(root, "tsconfig.base.json") || "./tsconfig.base.json";
  const normalizedExpectedExtends = expectedExtends.startsWith(".") ? expectedExtends : `./${expectedExtends}`;

  reporter.assert(tsconfig?.extends === normalizedExpectedExtends, `Package tsconfig must extend root base config: ${tsconfigPath}`);
  reporter.assert(compilerOptions.composite === true, `Package tsconfig must enable composite builds: ${tsconfigPath}`);
  reporter.assert(compilerOptions.declaration === true, `Package tsconfig must emit declarations: ${tsconfigPath}`);
  reporter.assert(compilerOptions.declarationMap === true, `Package tsconfig must emit declaration maps: ${tsconfigPath}`);
  reporter.assert(compilerOptions.emitDeclarationOnly === true, `Package tsconfig must emit declarations only for package builds: ${tsconfigPath}`);
  reporter.assert(typeof compilerOptions.outDir === "string" && compilerOptions.outDir.includes("dist"), `Package tsconfig must isolate build output under dist: ${tsconfigPath}`);
  reporter.assert(Boolean(manifest?.scripts?.build), `Package manifest must define build script: ${manifestPath}`);
  reporter.assert(Boolean(manifest?.scripts?.typecheck), `Package manifest must define typecheck script: ${manifestPath}`);
  reporter.assert(workspaceReferences.has(root), `Root tsconfig.workspace.json must reference package: ${root}`);
}

for (const manifestPath of trackedFiles.filter((file) => (file.startsWith("apps/") || file.startsWith("services/")) && file.endsWith("/package.json"))) {
  const manifest = readJson(manifestPath);
  reporter.assert(Boolean(manifest?.scripts?.typecheck), `Runtime package must define a typecheck script: ${manifestPath}`);
}

reporter.finish(`${packageManifests.length} package manifests checked for TS governance`);
