import {
  canonicalAppRoots,
  createReporter,
  getTrackedFiles,
  readJson,
  reservedMobileRuntimeRoots,
  startsWithPrefix,
} from "./governance-common.mjs";

const reporter = createReporter("Mobile topology honesty validator");
const trackedFiles = getTrackedFiles();

reporter.assert(
  canonicalAppRoots.includes("apps/mobile/merchant-app"),
  "Mobile merchant app must remain the only active mobile app runtime",
);

for (const runtimeRoot of reservedMobileRuntimeRoots) {
  reporter.assert(
    !canonicalAppRoots.includes(runtimeRoot),
    `Reserved mobile root must not be listed as an active canonical app runtime: ${runtimeRoot}`,
  );

  const allowedFiles = new Set([
    `${runtimeRoot}/AGENTS.md`,
    `${runtimeRoot}/runtime.manifest.json`,
  ]);
  const activeFiles = trackedFiles.filter((file) => startsWithPrefix(file, runtimeRoot) && !allowedFiles.has(file));
  reporter.assert(
    activeFiles.length === 0,
    `Reserved mobile root contains active source/config: ${runtimeRoot} (${activeFiles.slice(0, 5).join(", ")})`,
  );

  const manifest = readJson(`${runtimeRoot}/runtime.manifest.json`);
  reporter.assert(
    manifest?.implementationStatus?.status === "reserved-not-implemented",
    `Reserved mobile manifest must declare reserved-not-implemented status: ${runtimeRoot}`,
  );
  reporter.assert(
    manifest?.implementationStatus?.sourceState === "manifest-and-agents-only",
    `Reserved mobile manifest must declare manifest-and-agents-only source state: ${runtimeRoot}`,
  );
  reporter.assert(
    /Reserved\/not-implemented|does not own active/i.test(manifest?.ownership?.businessAuthority || ""),
    `Reserved mobile manifest business authority must be explicit about inactive ownership: ${runtimeRoot}`,
  );
  reporter.assert(
    /Reserved only - no deployable mobile runtime artifact/i.test(manifest?.deploymentAuthority?.platform || ""),
    `Reserved mobile manifest must not claim a deployable mobile platform artifact: ${runtimeRoot}`,
  );
}

const deploymentTopology = readJson("config/runtime/deployment-topology.json");
const deploymentNodes = new Set((deploymentTopology?.nodes || []).map((node) => node.runtimeRoot));
const deploymentDependencies = deploymentTopology?.dependencies || [];

for (const runtimeRoot of reservedMobileRuntimeRoots) {
  const runtimeName = readJson(`${runtimeRoot}/runtime.manifest.json`)?.runtimeName;
  reporter.assert(
    !deploymentNodes.has(runtimeRoot),
    `Reserved mobile root must not appear as a deployed topology node: ${runtimeRoot}`,
  );
  reporter.assert(
    !deploymentDependencies.some((dependency) => dependency.fromRuntime === runtimeName),
    `Reserved mobile root must not declare deployment dependencies: ${runtimeRoot}`,
  );
}

const productionTopology = readJson("config/runtime/production-topology.json");
const productionRoots = new Set((productionTopology?.runtimes || []).map((runtime) => runtime.runtimeRoot));

for (const runtimeRoot of reservedMobileRuntimeRoots) {
  reporter.assert(
    !productionRoots.has(runtimeRoot),
    `Reserved mobile root must not appear in production topology as an active runtime: ${runtimeRoot}`,
  );
}

reporter.finish(`${reservedMobileRuntimeRoots.length} reserved mobile roots checked`);
