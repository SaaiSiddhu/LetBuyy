import {
  createReporter,
  exists,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Environment validator");
const trackedFiles = getTrackedFiles();

const requiredFiles = [
  "config/env/README.md",
  "config/env/environment-governance.md",
  "config/env/governance/README.md",
  "config/env/ownership/runtime-env-ownership.json",
  "config/env/templates/next-app.env.example",
  "config/env/templates/worker.env.example",
  "config/env/templates/mobile.dart-defines.example",
  "config/env/schemas/next-app.schema.json",
  "config/env/schemas/worker.schema.json",
  "config/env/schemas/mobile.schema.json",
  "config/env/schemas/runtime-env-ownership.schema.json",
  "docs/governance/environment-governance.md",
];

for (const file of requiredFiles) {
  reporter.assert(exists(file), `Missing environment governance file: ${file}`);
}

const trackedEnvFiles = trackedFiles.filter((file) => {
  const name = file.split("/").at(-1) ?? file;
  const isEnv = name === ".env" || name.startsWith(".env.") || name.endsWith(".env") || name.endsWith(".env.local") || name === "all.env";
  const isAllowedTemplate = file.startsWith("config/env/templates/") && file.endsWith(".example");
  return isEnv && !isAllowedTemplate;
});

reporter.assert(
  trackedEnvFiles.length === 0,
  `Runtime env files must not be tracked: ${trackedEnvFiles.slice(0, 20).join(", ")}`,
);

const gitignore = readFile(".gitignore");
for (const expectedRule of [".env", ".env.*", "*.env", "all.env", ".dev.vars", "**/.dev.vars"]) {
  reporter.assert(gitignore.includes(expectedRule), `.gitignore must block ${expectedRule}`);
}

const secretPatterns = [
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9_=-]{20,}/,
  /\bwhsec_[A-Za-z0-9_=-]{20,}/,
  /\brzp_(?:live|test)_[A-Za-z0-9_=-]{8,}/,
  /\bAIza[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
];

const allowedSecretScanPrefixes = [
  "config/env/templates/",
  "docs/archive/",
  "docs/governance/",
  "AGENTS.md",
];

const secretOffenders = [];
function hasHardcodedSecretAssignment(content) {
  const assignmentPattern =
    /(?:secret|token|password|private[_-]?key|service[_-]?role)[A-Za-z0-9_ .:-]*[=:]\s*["']([^"'\n]{16,})["']/gi;

  for (const match of content.matchAll(assignmentPattern)) {
    const value = match[1].trim();
    const lowerValue = value.toLowerCase();

    if (/^[A-Z0-9_]+$/.test(value)) continue;
    if (lowerValue.includes("process.env") || lowerValue.includes("env.")) continue;
    if (lowerValue.includes("replace") || lowerValue.includes("example") || lowerValue.includes("placeholder")) continue;
    if (lowerValue.includes("redacted") || lowerValue.includes("dummy") || lowerValue.includes("test_")) continue;
    if (value.startsWith("$") || value.startsWith("{")) continue;
    if (/\s/.test(value)) continue;
    if (/^[a-z0-9_./-]+$/.test(value)) continue;

    const characterClassCount = [
      /[a-z]/.test(value),
      /[A-Z]/.test(value),
      /[0-9]/.test(value),
      /[+/=_-]/.test(value),
    ].filter(Boolean).length;
    if (characterClassCount < 3) continue;

    return true;
  }

  return false;
}

for (const file of trackedFiles) {
  if (allowedSecretScanPrefixes.some((prefix) => file === prefix || file.startsWith(prefix))) continue;

  const content = readFile(file);
  if (!content) continue;

  if (secretPatterns.some((pattern) => pattern.test(content)) || hasHardcodedSecretAssignment(content)) {
    secretOffenders.push(file);
  }
}

reporter.assert(
  secretOffenders.length === 0,
  `Tracked files contain secret-like values and must be redacted or moved to the secret store: ${secretOffenders.slice(0, 20).join(", ")}`,
);

reporter.finish(`${trackedFiles.length} tracked files scanned`);
