import fs from "node:fs";
import path from "node:path";
import {
  createReporter,
  exists,
  readFile,
  root,
} from "./governance-common.mjs";

const reporter = createReporter("Tooling governance validator");

const requiredScriptDirectories = [
  "scripts/cloudflare",
  "scripts/dev",
  "scripts/github",
  "scripts/supabase",
  "scripts/staging",
  "scripts/validators",
  "scripts/governance",
  "scripts/generators",
  "scripts/git-hooks",
  "scripts/migration",
  "scripts/utilities",
  "scripts/money-certification",
  "scripts/liquid-parity",
  // T8/W0 — added deliberately for scripts/search/backfill-search-documents.sql (T6/W4,
  // commit d3921eab): a one-time, idempotent local data backfill for search_documents, the same
  // class of thing scripts/liquid-parity's bundle-attach scripts already are — not a migration,
  // not a generator, not a validator. A real, nameable category, not a workaround for one file.
  "scripts/search",
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
  reporter.assert(
    entry.name.endsWith(".mjs") || entry.name === "README.md" || entry.name === "design-system-baseline.json",
    `Validator must be an .mjs module: scripts/validators/${entry.name}`,
  );
}

const governanceGate = readFile("scripts/validate-governance.mjs");
const wiredValidators = new Set([...governanceGate.matchAll(/"([^"]+\.mjs)"/g)].map((match) => match[1]));
const nonValidatorModules = new Set([
  "governance-common.mjs",
  "phase-b-common.mjs",
]);
const hookOnlyValidators = new Set([
  "frozen-path-override-gate.mjs",
]);

for (const entry of fs.readdirSync(path.join(root, "scripts/validators"), { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".mjs")) continue;
  if (nonValidatorModules.has(entry.name) || hookOnlyValidators.has(entry.name)) continue;

  reporter.assert(
    wiredValidators.has(entry.name),
    `Validator module must be wired into scripts/validate-governance.mjs gate lane: scripts/validators/${entry.name}`,
  );
}

for (const hookPath of ["scripts/git-hooks/pre-commit", "scripts/git-hooks/commit-msg"]) {
  reporter.assert(
    readFile(hookPath).includes("frozen-path-override-gate.mjs"),
    `Git hook must run frozen-path override gate: ${hookPath}`,
  );
}

reporter.finish(`${requiredScriptDirectories.length} canonical tooling directories checked`);
