import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Contracted domain event ingress validator");

const eventCore = readFile("packages/event-core/src/index.ts");
const eventAdapter = readFile("services/api-gateway/src/execution/event-execution.adapter.ts");
const webhookService = readFile("services/webhook-service/src/index.ts");

for (const eventType of ["payment.captured", "payment.failed", "refund.created", "payment.subscription.activated"]) {
  reporter.assert(eventCore.includes(`'${eventType}'`), `Missing domain event contract for ${eventType}`);
}

reporter.assert(
  /if \(!contract\) {\s*throw new Error\(`Uncontracted domain event type:/.test(eventAdapter),
  "Gateway event adapter must reject uncontracted domain event types",
);
reporter.assert(
  !/:\s*input\.payload \|\| \{\}/.test(eventAdapter),
  "Gateway event adapter must not pass through raw payloads for uncontracted events",
);
reporter.assert(
  webhookService.includes("normalizePaymentDomainEventType"),
  "Webhook service must normalize provider payment event names before gateway ingress",
);
reporter.assert(
  /eventType:\s*domainEventType/.test(webhookService),
  "Webhook service must emit the normalized domain event type",
);

reporter.finish("contracted internal event ingress checked");
