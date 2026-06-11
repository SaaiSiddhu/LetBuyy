import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const environmentLifecycle = JSON.parse(fs.readFileSync("config/runtime/environment-lifecycle.json", "utf8"));
const rolloutLifecycle = JSON.parse(fs.readFileSync("config/runtime/rollout-lifecycle.json", "utf8"));

test("environment lifecycle preserves promotion order and isolation", () => {
  assert.deepEqual(environmentLifecycle.promotionOrder, ["staging", "production"]);
  assert.ok(environmentLifecycle.isolationRules.mustSeparate.includes("secrets"));
  assert.ok(environmentLifecycle.isolationRules.mustSeparate.includes("queues"));
  assert.ok(environmentLifecycle.isolationRules.mustSeparate.includes("telemetry backends"));
  assert.ok(environmentLifecycle.isolationRules.forbidden.includes("marking live certification without fresh credential-gated production evidence"));
});

test("production lifecycle requires live evidence and execute-mode provider isolation", () => {
  const production = environmentLifecycle.environments.find((environment) => environment.name === "production");
  assert.equal(production.evidence.certifiableAsLive, true);
  assert.equal(production.evidence.mode, "fresh-live-execution-evidence");
  assert.ok(production.evidence.requiredRecords.includes("operational_certification_reports"));
  assert.equal(production.providers.sideEffectPolicy, "governed-live-only-after-execute-mode");
});

test("rollout lifecycle defines canary, blue-green, shadow traffic, and kill switch controls", () => {
  assert.deepEqual(rolloutLifecycle.canary.steps, [1, 5, 25, 50, 100]);
  assert.equal(rolloutLifecycle.canary.automaticRollback, true);
  assert.ok(rolloutLifecycle.blueGreen.requiredChecks.includes("rollback-switchback"));
  assert.equal(rolloutLifecycle.featureFlags.instantDisablement, "kill_switch overrides all rollout rules");
  assert.equal(rolloutLifecycle.shadowTraffic.sideEffectPolicy.includes("non-mutating"), true);
});

test("runtime lifecycle uses sandbox provider terminology outside production execute mode", () => {
  const staging = environmentLifecycle.environments.find((environment) => environment.name === "staging");
  assert.ok(staging.providers.payments.includes("Stripe sandbox mode"));
  assert.ok(staging.providers.payments.includes("Razorpay sandbox mode"));
  assert.equal(rolloutLifecycle.sandboxProviders.stripe.includes("sandbox mode"), true);
  assert.equal(rolloutLifecycle.sandboxProviders.razorpay.includes("sandbox mode"), true);
  assert.equal(JSON.stringify(environmentLifecycle).includes("test mode"), false);
  assert.equal(JSON.stringify(rolloutLifecycle).includes("test mode"), false);
});
