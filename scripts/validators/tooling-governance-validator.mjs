import fs from "node:fs";
import path from "node:path";
import {
  createReporter,
  exists,
  root,
} from "./governance-common.mjs";

const reporter = createReporter("Tooling governance validator");

const requiredScriptDirectories = [
  "scripts/validators",
  "scripts/governance",
  "scripts/generators",
  "scripts/migration",
  "scripts/utilities",
];

const allowedRootScriptFiles = new Set([
  "generate-repository-intelligence.mjs",
  "validate-architecture.mjs",
  "validate-governance.mjs",
]);

const allowedScriptDirectories = new Set(requiredScriptDirectories.map((dir) => path.posix.basename(dir)));

for (const dir of requiredScriptDirectories) {
  reporter.assert(exists(dir), `Missing canonical tooling directory: ${dir}`);
  reporter.assert(exists(`${dir}/README.md`), `Missing canonical tooling directory README: ${dir}/README.md`);
}

for (const entry of fs.readdirSync(path.join(root, "scripts"), { withFileTypes: true })) {
  if (entry.isDirectory()) {
    reporter.assert(allowedScriptDirectories.has(entry.name), `Unexpected scripts directory: scripts/${entry.name}`);
  } else if (entry.isFile()) {
    reporter.assert(allowedRootScriptFiles.has(entry.name), `Unexpected root script file: scripts/${entry.name}`);
  }
}

for (const entry of fs.readdirSync(path.join(root, "scripts/validators"), { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  reporter.assert(entry.name.endsWith(".mjs") || entry.name === "README.md", `Validator must be an .mjs module: scripts/validators/${entry.name}`);
}

reporter.finish(`${requiredScriptDirectories.length} canonical tooling directories checked`);
