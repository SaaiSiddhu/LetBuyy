import {
  createReporter,
  listWorkspaceFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Raw error message validator");

const sanitizerPath = "services/api-gateway/src/lib/public-errors.ts";
const middlewarePath = "services/api-gateway/src/middleware/security.ts";
const sanitizerSource = readFile(sanitizerPath);
const middlewareSource = readFile(middlewarePath);

for (const code of [
  "APP_BILLING_PROVIDER_ERROR",
  "AUTH_ERROR",
  "DB_ERROR",
  "DOMAIN_EVENT_EMIT_FAILED",
  "EMAIL_PROVIDER_ERROR",
  "INTERNAL_ERROR",
  "PAYMENT_ERROR",
  "PAYMENT_PROVIDER_ERROR",
  "RATE_LIMIT_UNAVAILABLE",
  "SERVER_MISCONFIGURED",
]) {
  reporter.assert(
    sanitizerSource.includes(`${code}:`) || sanitizerSource.includes(`'${code}'`) || sanitizerSource.includes(`"${code}"`),
    `public error sanitizer must define a fixed public message for ${code}`,
  );
}

reporter.assert(
  middlewareSource.includes("sanitizePublicErrorPayload"),
  "error response middleware must route error payloads through sanitizePublicErrorPayload",
);
reporter.assert(
  !middlewareSource.includes("const SANITIZED_ERROR_MESSAGES"),
  "error response middleware must not keep a local raw-error denylist",
);

const responseSourceFiles = listWorkspaceFiles(["services/api-gateway/src"])
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => !file.endsWith("/lib/public-errors.ts"))
  .filter((file) => !file.endsWith("/middleware/security.ts"));

const responseExpressionPattern = /c\.json\(([\s\S]{0,1200}?)\);/g;
const rawMessagePattern = /message:\s*[^,\n}]*(?:\berror\b|\berr\b|[A-Za-z0-9_]*Error)\??\s*\.\s*message/i;
const codePattern = /code:\s*['"`]([A-Z0-9_:-]+)['"`]/;
const sanitizedCodes = new Set();
for (const match of sanitizerSource.matchAll(/^\s*([A-Z0-9_]+):\s*'/gm)) {
  sanitizedCodes.add(match[1]);
}
for (const match of sanitizerSource.matchAll(/^\s*'([A-Z0-9_]+)'/gm)) {
  sanitizedCodes.add(match[1]);
}

let checkedFiles = 0;
for (const file of responseSourceFiles) {
  const source = readFile(file);
  let match;
  let fileMatched = false;
  while ((match = responseExpressionPattern.exec(source)) !== null) {
    const expression = match[1];
    if (!rawMessagePattern.test(expression)) continue;
    fileMatched = true;
    const code = codePattern.exec(expression)?.[1];
    reporter.assert(
      Boolean(code),
      `${file} returns raw error.message without an error code; add a public error code or remove the raw message`,
    );
    if (!code) continue;
    reporter.assert(
      sanitizedCodes.has(code),
      `${file} returns raw error.message for ${code}; add the code to sanitizePublicErrorPayload or remove the raw message`,
    );
  }
  if (fileMatched) checkedFiles += 1;
}

reporter.finish(`${checkedFiles} files with raw error.message responses checked`);
