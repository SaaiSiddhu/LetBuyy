import test from "node:test";
import assert from "node:assert/strict";

function evaluateProviderState({ consecutiveFailures, openThreshold, nowMs, openedAtMs, cooldownMs }) {
  if (consecutiveFailures >= openThreshold) {
    return { state: "open", allowRequest: false };
  }

  if (openedAtMs && nowMs - openedAtMs < cooldownMs) {
    return { state: "half-open-cooldown", allowRequest: false };
  }

  return { state: "closed", allowRequest: true };
}

test("provider outage simulation fails closed during open circuit", () => {
  const state = evaluateProviderState({
    consecutiveFailures: 5,
    openThreshold: 3,
    nowMs: 10000,
    openedAtMs: 9000,
    cooldownMs: 60000,
  });

  assert.equal(state.state, "open");
  assert.equal(state.allowRequest, false);
});

test("degraded mode only reopens after cooldown", () => {
  const state = evaluateProviderState({
    consecutiveFailures: 0,
    openThreshold: 3,
    nowMs: 70000,
    openedAtMs: 1000,
    cooldownMs: 60000,
  });

  assert.equal(state.state, "closed");
  assert.equal(state.allowRequest, true);
});
