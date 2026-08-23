import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Durable Object validator");
const topology = readJson("config/runtime/cloudflare-topology.json");
const bindingOwnership = readJson("config/runtime/cloudflare-binding-ownership.json");
const apiWrangler = readFile("services/api-gateway/wrangler.toml");
const durableSource = readFile("services/api-gateway/src/durable/runtime-coordinator.ts");
const indexSource = readFile("services/api-gateway/src/index.ts");

const apiGatewayOwnership = (bindingOwnership?.workers || []).find((worker) => worker.runtimeRoot === "services/api-gateway");

reporter.assert(exists("services/api-gateway/src/durable/runtime-coordinator.ts"), "Runtime Durable Object source must exist");
reporter.assert(apiWrangler.includes("[[migrations]]"), "API Gateway wrangler must declare Durable Object migration");
reporter.assert(apiWrangler.includes(`tag = "${topology.durableObjects.migrationTag}"`), "Durable Object migration tag must match topology");
reporter.assert(apiWrangler.includes('new_sqlite_classes = ["LetbuyyRuntimeDurableObject"]'), "Durable Object must use SQLite-backed class migration");
reporter.assert(indexSource.includes("export { LetbuyyRuntimeDurableObject }"), "API Gateway main module must export Durable Object class");
reporter.assert(durableSource.includes("blockConcurrencyWhile"), "Durable Object must initialize storage through blockConcurrencyWhile");
reporter.assert(durableSource.includes("checkpoint"), "Durable Object must expose checkpoint state for rollback recovery");

// The class migration above is repository-wide (SQLite storage backend is
// declared once for the Worker), but the *binding* into a specific
// environment's Worker is governed per-environment by
// cloudflare-binding-ownership.json — the same manifest cloudflare-binding-
// validator.mjs already treats as the single source of truth for "is this
// environment supposed to have this binding at all" (Phase V0 W2: production
// de-deployed the binding; the class/migration/staging binding are untouched).
for (const environment of ["staging", "production"]) {
  const env = topology.environments[environment];
  const envOwnership = apiGatewayOwnership?.environments?.[environment];
  const expectsBinding = (envOwnership?.durableObjects || []).includes("RUNTIME_COORDINATOR");
  const marker = `[[env.${environment}.durable_objects.bindings]]`;
  const start = apiWrangler.indexOf(marker);

  if (!expectsBinding) {
    reporter.assert(start < 0, `Durable Object binding present in ${environment} but not declared in cloudflare-binding-ownership.json`);
    continue;
  }

  reporter.assert(start >= 0, `Missing Durable Object binding for ${environment}`);
  if (start < 0) continue;
  const section = apiWrangler.slice(start, apiWrangler.indexOf("[env.", start + marker.length) > 0 ? apiWrangler.indexOf("[env.", start + marker.length) : undefined);
  reporter.assert(section.includes('name = "RUNTIME_COORDINATOR"'), `Durable Object binding name drift for ${environment}`);
  reporter.assert(section.includes(`class_name = "${topology.durableObjects.className}"`), `Durable Object class drift for ${environment}`);
  reporter.assert(env.durableObjectNamespace.startsWith(env.resourcePrefix), `Durable Object namespace must be environment-prefixed for ${environment}`);
}

reporter.finish("Durable Object namespace, class, and migration governance checked");
