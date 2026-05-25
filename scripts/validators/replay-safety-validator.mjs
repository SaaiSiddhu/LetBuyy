import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Replay safety validator");

const contractPath = "config/runtime/replay-safety-contract.json";
const schemaPath = "config/runtime/replay-safety-contract.schema.json";
const contract = readJson(contractPath);

reporter.assert(exists(contractPath), `Missing replay safety contract: ${contractPath}`);
reporter.assert(exists(schemaPath), `Missing replay safety schema: ${schemaPath}`);
reporter.assert(contract?.$schema === schemaPath, "Replay safety contract must reference its checked-in schema");
reporter.assert(contract?.determinism?.eventTimeSource === "producer-supplied-occurredAt-only", "Replay event time must be producer-supplied");
reporter.assert(contract?.determinism?.serialization === "stable-json-sorted-keys", "Replay serialization must be stable sorted JSON");
reporter.assert(contract?.determinism?.checksum === "fnv1a32-stable-json", "Replay checksum must be deterministic and repository-owned");
reporter.assert(contract?.eventOrdering?.gapPolicy === "fail-closed", "Replay ordering gaps must fail closed");
reporter.assert(contract?.projectionIntegrity?.sourceEventIdRequired === true, "Projection replay must require source event ids");
reporter.assert(contract?.projectionIntegrity?.sourceGlobalPositionRequired === true, "Projection replay must require source global positions");
reporter.assert(contract?.authorization?.nonDryRunReplay === "approved-and-timeboxed", "Non-dry-run replay must be approved and timeboxed");

const eventEnvelope = readFile("packages/distributed-runtime/src/event-envelope-runtime.ts");
for (const fragment of [
  "occurredAt: RuntimeIsoTimestamp",
  "producer-supplied occurredAt",
  "stableReplaySerialize",
  "replayPayloadChecksum",
  "canonicalizeReplayValue",
  "Number.isInteger(event.schema_version)",
]) {
  reporter.assert(eventEnvelope.includes(fragment), `Distributed event envelope must enforce replay determinism fragment: ${fragment}`);
}

reporter.assert(
  !/occurred_at:\s*input\.occurredAt\s*\|\|\s*new Date\(\)\.toISOString\(\)/.test(eventEnvelope),
  "Distributed event envelope must not default occurred_at from wall-clock time",
);

for (const { file, forbidden } of [
  {
    file: "packages/distributed-runtime/src/event-envelope-runtime.ts",
    forbidden: [/Math\.random\s*\(/, /crypto\.randomUUID\s*\(/, /Date\.now\s*\(/],
  },
  {
    file: "packages/distributed-runtime/src/replay-storage-runtime.ts",
    forbidden: [/Math\.random\s*\(/, /crypto\.randomUUID\s*\(/, /Date\.now\s*\(/, /new Date\(\)\.toISOString\(\)/],
  },
  {
    file: "packages/orchestration/src/replay-runtime.ts",
    forbidden: [/Math\.random\s*\(/, /crypto\.randomUUID\s*\(/, /Date\.now\s*\(/, /new Date\(\)\.toISOString\(\)/],
  },
  {
    file: "packages/projection-runtime/src/projection-replay-runtime.ts",
    forbidden: [/Math\.random\s*\(/, /crypto\.randomUUID\s*\(/, /Date\.now\s*\(/, /new Date\(\)\.toISOString\(\)/],
  },
]) {
  const text = readFile(file);
  for (const pattern of forbidden) {
    reporter.assert(!pattern.test(text), `${file}: replay-critical code must not use nondeterministic entropy ${pattern}`);
  }
}

const replayRuntime = readFile("packages/orchestration/src/replay-runtime.ts");
reporter.assert(replayRuntime.includes("causationId: context.causationId || plan.replayId"), "Replay runtime must propagate replay causation id");
reporter.assert(replayRuntime.includes("completeReplay(result)"), "Replay runtime must persist terminal replay result");

const replayStorage = readFile("packages/distributed-runtime/src/replay-storage-runtime.ts");
reporter.assert(replayStorage.includes("assertReplayAuthorized(plan)"), "Replay storage runtime must fail closed without approval");
reporter.assert(replayStorage.includes("authorization expired"), "Replay authorization must expire");
reporter.assert(replayStorage.includes("dryRun"), "Replay storage plan must preserve dry-run authority");

reporter.finish("Replay determinism, ordering, authorization, and serialization gates checked");
