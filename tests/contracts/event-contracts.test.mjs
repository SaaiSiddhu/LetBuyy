import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const eventCore = fs.readFileSync("packages/event-core/src/index.ts", "utf8");

test("event contracts expose operational queue, deployment, incident, and security schemas", () => {
  for (const schema of [
    "RuntimeQueueRecoverySchema",
    "RuntimeDeadLetterRedriveSchema",
    "RecordDeploymentPromotionSchema",
    "RecordDeploymentHealthGateSchema",
    "RecordProductionIncidentSchema",
    "RecordSecurityEnforcementEventSchema",
    "RecordOperationalCertificationReportSchema",
  ]) {
    assert.match(eventCore, new RegExp(`export const ${schema}`), `${schema} must be exported by event-core`);
  }
});

test("control-plane command contracts include queue, rollback, and provider controls", () => {
  for (const operation of [
    "'rollback-deployment'",
    "'redrive-dead-letter'",
    "'pause-queue'",
    "'resume-queue'",
    "'pause-provider'",
    "'restore-provider'",
  ]) {
    assert.ok(eventCore.includes(operation), `${operation} must be part of SubmitRuntimeControlCommandSchema`);
  }
});
