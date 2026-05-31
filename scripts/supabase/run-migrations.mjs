#!/usr/bin/env node
/**
 * Runs all Supabase migrations against staging or production.
 *
 * Usage:
 *   node scripts/supabase/run-migrations.mjs --env staging
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

const { values } = parseArgs({
  options: {
    env: { type: "string" },
  },
});

if (!values.env || !["staging", "production"].includes(values.env)) {
  throw new Error("--env is required and must be staging or production");
}

const config = JSON.parse(readFileSync(join(root, `config/supabase/${values.env}.json`), "utf8"));

if (config.project_ref.includes("PLACEHOLDER")) {
  throw new Error(`Supabase ${values.env} project_ref is still a placeholder. Run Phase 5 first.`);
}

console.log(`Running migrations on ${values.env} (${config.project_ref})...`);

const result = spawnSync("pnpm", ["exec", "supabase", "db", "push", "--project-ref", config.project_ref], {
  cwd: root,
  stdio: "inherit",
});

if (result.status !== 0) {
  throw new Error(`Migration failed on ${values.env}`);
}

console.log(`All migrations applied to ${values.env}`);
