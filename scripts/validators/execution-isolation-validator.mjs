import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Execution isolation validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const isolation = manifest?.executionIsolation || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Execution isolation must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Execution isolation must fail closed");
reporter.assert(isolation.engineSource === "packages/distributed-runtime/src/execution-isolation-runtime.ts", "Execution isolation engine must live in distributed-runtime");
reporter.assert(isolation.graphCompiler === "compileExecutionAuthorityGraph", "Execution isolation must name authority graph compiler");
reporter.assert(isolation.assertionFunction === "assertExecutionIsolation", "Execution isolation must name assertion");
reporter.assert(isolation.capabilityModel === "deny-by-default-capability-token", "Execution capability model must deny by default");
reporter.assert(isolation.authorityPolicy === "one-runtime-owner-per-operation", "Execution authority must be single-owner per operation");
reporter.assert(isolation.sandboxPolicy === "manifest-granted-or-deny-by-default", "Execution sandbox policy must be explicit");
for (const domain of ["worker-runtime", "queue-runtime", "replay-runtime", "projection-runtime", "deployment-runtime"]) {
  reporter.assert((isolation.trustDomains || []).includes(domain), `Execution isolation trust domain missing: ${domain}`);
}

const source = readFile(isolation.engineSource || "");
for (const fragment of [
  "compileExecutionAuthorityGraph",
  "assertExecutionIsolation",
  "Execution authority overlap exists",
  "Runtime sandbox broken",
  "Capability ownership ambiguous",
]) {
  reporter.assert(source.includes(fragment), `Execution isolation source missing fragment: ${fragment}`);
}

reporter.finish("execution capability model, sandboxing, and authority isolation checked");
