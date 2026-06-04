import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Replay restoration validator");
const runtimeTopology = readJson("config/runtime/runtime-topology.json");
const cloudflareTopology = readJson("config/runtime/cloudflare-topology.json");
const d1Migration = readFile("database/cloudflare/d1/migrations/0001_provider_execution_foundation.sql");

reporter.assert(runtimeTopology?.recoveryRules?.replayStoragePerEnvironment === true, "Replay storage must be isolated per environment");
reporter.assert(runtimeTopology?.recoveryRules?.walStoragePerEnvironment === true, "WAL storage must be isolated per environment");
reporter.assert(runtimeTopology?.recoveryRules?.queueDlqPerEnvironment === true, "Queue DLQ storage must be isolated per environment");
reporter.assert(runtimeTopology?.recoveryRules?.durableObjectCheckpointBeforeRestoration === true, "Durable Object checkpoints must precede restoration");
reporter.assert(d1Migration.includes("replay_restoration_lineage"), "D1 migration must persist replay restoration lineage");
reporter.assert(d1Migration.includes("divergence_detected"), "Replay restoration lineage must record divergence");

const seen = new Set();
for (const environment of ["staging", "production"]) {
  const env = cloudflareTopology.environments[environment];
  for (const key of ["replayStorage", "walStorage"]) {
    reporter.assert(env[key].startsWith(env.resourcePrefix), `${key} must be prefixed for ${environment}`);
    reporter.assert(!seen.has(env[key]), `${key} must not be shared across environments: ${env[key]}`);
    seen.add(env[key]);
  }
}

reporter.finish("Replay restoration and WAL isolation governance checked");
