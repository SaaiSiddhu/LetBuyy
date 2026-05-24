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
  "config/env/templates/next-app.env.example",
  "config/env/templates/worker.env.example",
  "config/env/templates/mobile.dart-defines.example",
  "config/env/schemas/next-app.schema.json",
  "config/env/schemas/worker.schema.json",
  "config/env/schemas/mobile.schema.json",
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

reporter.finish(`${trackedFiles.length} tracked files scanned`);
