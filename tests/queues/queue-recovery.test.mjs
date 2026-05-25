import test from "node:test";
import assert from "node:assert/strict";

function queueRetryDelayMs(attempt, policy) {
  const boundedAttempt = Math.max(1, attempt);
  const multiplier =
    policy.backoff === "exponential"
      ? 2 ** Math.min(boundedAttempt - 1, 10)
      : policy.backoff === "linear"
        ? boundedAttempt
        : 1;
  return Math.min(policy.initialDelayMs * multiplier, policy.maxDelayMs);
}

function queueRetryAvailableAt(attempt, policy, now) {
  return new Date(now + queueRetryDelayMs(attempt, policy)).toISOString();
}

function planQueueRecovery(message, policy, now) {
  if (["completed", "cancelled", "dead-lettered"].includes(message.status)) {
    return { queueName: message.queueName, messageId: message.messageId, action: "ignore", reason: `queue message is already ${message.status}` };
  }

  if (message.attempts >= policy.retry.maxAttempts) {
    return { queueName: message.queueName, messageId: message.messageId, action: "dead-letter", reason: "queue retry attempts exhausted" };
  }

  return {
    queueName: message.queueName,
    messageId: message.messageId,
    action: message.status === "leased" ? "release-expired-lease" : "retry",
    availableAt: queueRetryAvailableAt(message.attempts + 1, policy.retry, now.getTime()),
    reason: message.status === "leased" ? "queue lease expired before completion" : "queue message requires retry",
  };
}

const policy = {
  retry: {
    maxAttempts: 3,
    backoff: "exponential",
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  },
};

test("queue recovery releases expired leases with deterministic retry time", () => {
  const plan = planQueueRecovery(
    { queueName: "letbuyy-events", messageId: "msg_1", status: "leased", attempts: 1 },
    policy,
    new Date("2026-05-25T00:00:00.000Z"),
  );

  assert.equal(plan.action, "release-expired-lease");
  assert.equal(plan.availableAt, "2026-05-25T00:00:02.000Z");
});

test("queue recovery dead-letters exhausted messages", () => {
  const plan = planQueueRecovery(
    { queueName: "letbuyy-events", messageId: "msg_2", status: "retrying", attempts: 3 },
    policy,
    new Date("2026-05-25T00:00:00.000Z"),
  );

  assert.equal(plan.action, "dead-letter");
});
