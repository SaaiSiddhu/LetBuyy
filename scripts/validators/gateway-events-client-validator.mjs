import {
  createReporter,
  exists,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Gateway events client validator");

reporter.assert(
  exists("packages/infrastructure/gateway-events-adapter/index.ts"),
  "Shared gateway events adapter must live in packages/infrastructure",
);
reporter.assert(
  !exists("services/webhook-service/src/gateway-events.ts"),
  "webhook-service must not keep a local gateway-events client copy",
);
reporter.assert(
  !exists("services/queue-workers/src/gateway-events.ts"),
  "queue-workers must not keep a local gateway-events client copy",
);

const webhookSource = readFile("services/webhook-service/src/index.ts");
const queueSource = readFile("services/queue-workers/src/platform-queue-consumer.ts");

for (const [name, source] of [["webhook-service", webhookSource], ["queue-workers", queueSource]]) {
  reporter.assert(
    source.includes("@letbuyy/infrastructure/gateway-events-adapter"),
    `${name} must consume the shared gateway events adapter`,
  );
}

reporter.finish("shared gateway events adapter checked");
