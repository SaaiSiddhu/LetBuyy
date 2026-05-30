#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, [
  "infrastructure/scripts/cloudflare/bootstrap-environment.mjs",
  "--environment=staging",
  ...process.argv.slice(2),
], { stdio: "inherit" });

process.exit(result.status ?? 1);
