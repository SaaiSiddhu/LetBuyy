#!/usr/bin/env node
// Idempotently install local `dev` scripts across the workspace + the root
// orchestrator, using the canonical port map in ./ports.mjs.
//
//   node scripts/dev/apply-dev-scripts.mjs
//
// Safe to re-run: it only sets the `dev*` script keys, preserving every other
// script and field. These script edits ARE tracked (they are what makes
// `pnpm dev` work); the env files they rely on stay untracked.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { APP_PORTS, SERVICE_PORTS, STORYBOOK_PORT } from "./ports.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Preserve each file's existing indentation so the diff stays minimal.
function detectIndent(raw) {
  const m = /\n(\t| +)"/.exec(raw);
  return m ? m[1] : "  ";
}

function patch(relPkg, mutate) {
  const abs = path.join(repoRoot, relPkg);
  const raw = readFileSync(abs, "utf8");
  const indent = detectIndent(raw);
  const trailingNewline = raw.endsWith("\n");
  const pkg = JSON.parse(raw);
  pkg.scripts = pkg.scripts || {};
  mutate(pkg);
  writeFileSync(abs, JSON.stringify(pkg, null, indent) + (trailingNewline ? "\n" : ""));
  console.log(`  patched ${relPkg}`);
}

// Put a key first while preserving the order of the remaining keys.
function withFirst(scripts, key, value) {
  const { [key]: _drop, ...rest } = scripts;
  return { [key]: value, ...rest };
}

console.log("Installing dev scripts:");

// Next apps
for (const [app, port] of Object.entries(APP_PORTS)) {
  patch(`apps/${app}/package.json`, (pkg) => {
    pkg.scripts = withFirst(pkg.scripts, "dev", `next dev -p ${port}`);
  });
}

// Shared UI library -> Storybook
patch(`packages/typescript/ui/package.json`, (pkg) => {
  pkg.scripts = withFirst(pkg.scripts, "dev", `storybook dev --port ${STORYBOOK_PORT} --no-open`);
});

// Cloudflare Workers
for (const [svc, { http, inspector }] of Object.entries(SERVICE_PORTS)) {
  patch(`services/${svc}/package.json`, (pkg) => {
    pkg.scripts = withFirst(
      pkg.scripts,
      "dev",
      `wrangler dev --port ${http} --inspector-port ${inspector}`,
    );
  });
}

// Root orchestrator
const CONCURRENCY = 25; // >= total persistent dev tasks (9 apps + storybook + 4 workers)
patch(`package.json`, (pkg) => {
  const setup = "node scripts/dev/setup-local-env.mjs";
  const run = `turbo run dev --concurrency=${CONCURRENCY}`;
  // `dev` = apps + Storybook only (fast, low-CPU): no Cloudflare Workers, so the
  // 4 `tsc --noEmit` custom builds don't fight the Next cold-compiles for CPU.
  // `dev:all` boots everything including the workers.
  const devScripts = {
    dev: `${setup} && ${run} --filter=./apps/* --filter=@letbuyy/ui`,
    "dev:all": `${setup} && ${run}`,
    "dev:apps": `${setup} && ${run} --filter=./apps/*`,
    "dev:services": `${setup} && ${run} --filter=./services/*`,
    "dev:storybook": `turbo run dev --filter=@letbuyy/ui`,
    "dev:setup": `${setup} --force`,
  };
  // Remove any prior dev* keys, then place the fresh block first.
  const rest = Object.fromEntries(
    Object.entries(pkg.scripts).filter(([k]) => !k.startsWith("dev")),
  );
  pkg.scripts = { ...devScripts, ...rest };
});

console.log("\nDone. Run `pnpm dev` to boot everything, or `pnpm dev:web` for just the UIs.");
