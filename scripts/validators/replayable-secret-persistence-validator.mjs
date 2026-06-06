import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Replayable secret persistence validator");

const idempotencyAdapter = readFile("services/api-gateway/src/execution/idempotency-execution.adapter.ts");
const redactionHelper = readFile("services/api-gateway/src/lib/replayable-secret-redaction.ts");

reporter.assert(
  idempotencyAdapter.includes("redactReplayableSecrets(params.responseBody)"),
  "Idempotency completion must redact replayable secrets before persistence",
);
reporter.assert(
  /response_body:\s*persistedResponseBody/.test(idempotencyAdapter),
  "Idempotency completion must persist the redacted response body",
);
reporter.assert(
  !/response_body:\s*params\.responseBody/.test(idempotencyAdapter),
  "Idempotency completion must not persist the original response body",
);

for (const key of ["access_token", "accessToken", "signing_secret", "signingSecret", "refresh_token", "refreshToken", "client_secret", "clientSecret"]) {
  reporter.assert(redactionHelper.includes(`'${key}'`), `Replayable secret redaction must cover ${key}`);
}

reporter.finish("idempotency secret redaction checked");
