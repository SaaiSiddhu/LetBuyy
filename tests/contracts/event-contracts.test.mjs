import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const eventCore = fs.readFileSync("packages/event-core/src/index.ts", "utf8");

test("event contracts expose operational recovery, replay, deployment, and SRE schemas", () => {
  for (const schema of [
    "RuntimeQueueRecoverySchema",
    "RuntimeDeadLetterRedriveSchema",
    "ScheduleRuntimeReplaySchema",
    "AuthorizeRuntimeReplaySchema",
    "RecordDeploymentPromotionSchema",
    "RecordDeploymentHealthGateSchema",
    "RecordChaosExperimentSchema",
    "RecordFailoverDrillSchema",
    "RecordLoadTestRunSchema",
    "RecordSreErrorBudgetSnapshotSchema",
  ]) {
    assert.match(eventCore, new RegExp(`export const ${schema}`), `${schema} must be exported by event-core`);
  }
});

test("control-plane command contracts include rollback, replay, and provider controls", () => {
  for (const operation of [
    "'rollback-deployment'",
    "'replay-events'",
    "'redrive-dead-letter'",
    "'pause-provider'",
    "'restore-provider'",
    "'failover-region'",
    "'restore-region'",
  ]) {
    assert.ok(eventCore.includes(operation), `${operation} must be part of SubmitRuntimeControlCommandSchema`);
  }
});
