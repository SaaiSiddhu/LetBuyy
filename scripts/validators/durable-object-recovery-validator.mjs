import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Durable Object recovery validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const objectRecovery = manifest?.durableObjectRecovery || {};
const ownership = readJson(objectRecovery.bindingOwnershipManifest || "config/runtime/cloudflare-binding-ownership.json");

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Durable Object recovery must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Durable Object recovery must fail closed");
reporter.assert(objectRecovery.engineSource === "packages/distributed-runtime/src/durable-object-recovery-runtime.ts", "Durable Object recovery engine must live in distributed-runtime");
reporter.assert(objectRecovery.planFunction === "compileDurableObjectRecoveryPlan", "Durable Object recovery must name plan function");
reporter.assert(objectRecovery.assertionFunction === "assertDurableObjectRecovery", "Durable Object recovery must name assertion function");
reporter.assert(objectRecovery.bindingOwnershipManifest === "config/runtime/cloudflare-binding-ownership.json", "Durable Object recovery must bind Cloudflare ownership manifest");
for (const env of ["dev", "staging", "production"]) {
  reporter.assert((objectRecovery.requiredEnvironments || []).includes(env), `Durable Object recovery environment missing: ${env}`);
}
reporter.assert(objectRecovery.migrationPolicy === "durable-object-migration-lineage-per-environment", "Durable Object recovery must govern migrations per environment");
reporter.assert(objectRecovery.resurrectionPolicy === "snapshot-and-replay-cursor-required", "Durable Object resurrection must require snapshots and replay cursors");
reporter.assert(objectRecovery.bindingPolicy === "non-inheritable-binding-explicit-per-environment", "Durable Object bindings must be explicit per environment");
reporter.assert((ownership?.nonInheritableKeys || []).includes("durable_objects"), "Cloudflare binding ownership must mark Durable Objects non-inheritable");

const source = readFile(objectRecovery.engineSource || "");
for (const fragment of [
  "compileDurableObjectRecoveryPlan",
  "assertDurableObjectRecovery",
  "Durable Object ownership ambiguous",
  "object replay corruption possible",
  "env crossover exists",
  "migrationLineageChecksum",
]) {
  reporter.assert(source.includes(fragment), `Durable Object recovery source missing fragment: ${fragment}`);
}

reporter.finish("Durable Object migration, resurrection, snapshot, replay cursor, and env binding governance checked");
