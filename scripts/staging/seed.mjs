#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const databaseUrl = process.env.STAGING_DATABASE_URL || process.env.SUPABASE_STAGING_DATABASE_URL;
const seedPath = resolve(process.cwd(), "database/supabase/seeds/001_seed.sql");

if (!databaseUrl) {
  console.error("[staging-seed] STAGING_DATABASE_URL or SUPABASE_STAGING_DATABASE_URL is required.");
  process.exit(1);
}

if (/localhost|127\.0\.0\.1|0\.0\.0\.0|::1/.test(databaseUrl)) {
  console.error("[staging-seed] refusing to seed a localhost database.");
  process.exit(1);
}

if (!existsSync(seedPath)) {
  console.error(`[staging-seed] missing seed file: ${seedPath}`);
  process.exit(1);
}

const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", seedPath], {
  stdio: "inherit",
});

if (result.error) {
  console.error(`[staging-seed] failed to start psql: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
