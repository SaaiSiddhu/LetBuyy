import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Operational proof validator");

const requiredFiles = [
  "load/AGENTS.md",
  "load/run-load-evidence.mjs",
  "load/scenarios/internet-scale-load.json",
  "load/k6/black-friday-commerce.js",
  "load/k6/runtime-saturation.js",
  "load/k6/webhook-flood.js",
  "load/locust/checkout_flood.py",
  "load/gatling/WorkerSaturationSimulation.scala",
  "chaos/AGENTS.md",
  "chaos/run-chaos-evidence.mjs",
  "chaos/scenarios/failure-matrix.json",
];

for (const file of requiredFiles) {
  reporter.assert(exists(file), `Missing operational proof source file: ${file}`);
}

const loadManifest = readJson("load/scenarios/internet-scale-load.json");
const chaosManifest = readJson("chaos/scenarios/failure-matrix.json");
const loadRunner = readFile("load/run-load-evidence.mjs");
const chaosRunner = readFile("chaos/run-chaos-evidence.mjs");
const gitignore = readFile(".gitignore");
const packageJson = readJson("package.json");

reporter.assert(loadManifest?.certification === false, "Load manifest must not claim certification");
reporter.assert(chaosManifest?.certification === false, "Chaos manifest must not claim certification");

for (const ignored of ["load/reports/", "chaos/reports/"]) {
  reporter.assert(gitignore.includes(ignored), `Generated operational proof reports must be ignored: ${ignored}`);
}

for (const category of [
  "black-friday",
  "checkout-flood",
  "replay-flood",
  "queue-saturation",
  "worker-saturation",
  "db-saturation",
  "webhook-flood",
  "cache-saturation",
  "deployment-saturation",
]) {
  reporter.assert(
    loadManifest?.scenarios?.some((scenario) => scenario.category === category),
    `Load proof matrix missing category: ${category}`,
  );
}

for (const tool of ["k6", "locust", "gatling"]) {
  reporter.assert(
    loadManifest?.scenarios?.some((scenario) => scenario.tool === tool),
    `Load proof matrix missing tool: ${tool}`,
  );
}

for (const scenario of loadManifest?.scenarios || []) {
  reporter.assert(exists(scenario.script), `Load scenario references missing script: ${scenario.id} -> ${scenario.script}`);
  reporter.assert(
    Array.isArray(scenario.requiredMetrics) && scenario.requiredMetrics.length >= 4,
    `Load scenario must declare required measured metrics: ${scenario.id}`,
  );
}

for (const fragment of [
  "LETBUYY_API_BASE_URL",
  "LETBUYY_OPERATIONS_TOKEN",
  "LETBUYY_SURVIVABILITY_EXECUTION_APPROVED",
  "certification: false",
  "command -v",
  "--summary-export",
]) {
  reporter.assert(loadRunner.includes(fragment), `Load evidence runner missing fail-closed fragment: ${fragment}`);
}

for (const experiment of [
  "queue-outage",
  "db-outage",
  "replay-corruption",
  "provider-outage",
  "worker-crash",
  "deployment-interruption",
  "cache-outage",
  "regional-outage",
  "network-partition",
]) {
  reporter.assert(
    chaosManifest?.experiments?.some((candidate) => candidate.id === experiment),
    `Chaos proof matrix missing experiment: ${experiment}`,
  );
}

for (const fragment of [
  "LETBUYY_CHAOS_EXECUTION_APPROVED",
  "LETBUYY_OPERATIONS_TOKEN",
  "LETBUYY_API_BASE_URL",
  "LETBUYY_SURVIVABILITY_EXECUTION_APPROVED",
  "certification: false",
  "--status=requested",
]) {
  reporter.assert(chaosRunner.includes(fragment), `Chaos evidence runner missing fail-closed fragment: ${fragment}`);
}

reporter.assert(!/status:\s*"passed"/.test(chaosRunner), "Chaos evidence runner must not hardcode passed status");
reporter.assert(!/status:\s*"passed"/.test(loadRunner), "Load evidence runner must not hardcode passed status");

reporter.assert(
  packageJson?.scripts?.["validate:operational-proof"] === "node scripts/validators/operational-proof-validator.mjs",
  "Root package must expose validate:operational-proof",
);
reporter.assert(
  packageJson?.scripts?.["load:plan"] === "node load/run-load-evidence.mjs --mode=plan",
  "Root package must expose load:plan",
);
reporter.assert(
  packageJson?.scripts?.["chaos:plan"] === "node chaos/run-chaos-evidence.mjs --mode=plan",
  "Root package must expose chaos:plan",
);

reporter.finish(`${loadManifest?.scenarios?.length || 0} load scenarios and ${chaosManifest?.experiments?.length || 0} chaos experiments checked`);
