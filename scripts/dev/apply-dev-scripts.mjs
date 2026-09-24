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
import { APP_PORTS, DEFAULT_DEV_APPS, SERVICE_PORTS, STORYBOOK_PORT } from "./ports.mjs";

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
  const before = JSON.stringify(pkg.scripts);
  mutate(pkg);
  // Re-serialising a manifest whose scripts did not change only reformats it, so leave it untouched.
  if (JSON.stringify(pkg.scripts) === before) {
    console.log(`  unchanged ${relPkg}`);
    return;
  }
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
    pkg.scripts = withFirst(pkg.scripts, "dev", `next dev --webpack -p ${port}`);
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
const CONCURRENCY = 25; // >= the largest persistent set: dev:all (5 maintained apps + storybook + 4 workers)
patch(`package.json`, (pkg) => {
  const setup = "node scripts/dev/setup-local-env.mjs";
  const run = `turbo run dev --concurrency=${CONCURRENCY}`;
  // `dev` = apps + Storybook only (fast, low-CPU): no Cloudflare Workers, so the
  // 4 `tsc --noEmit` custom builds don't fight the Next cold-compiles for CPU.
  // `dev:all` adds all four workers. It never boots a frozen app: an unfiltered `turbo run dev` did, which
  // is why frozen apps have their own `dev:frozen` (APPID-P2, 2026-09-24).
  // D-APP-LAYOUT: the default boots the MAINTAINED apps by package name, never a path glob -- apps/ now
  // nests containers, and a glob would start the frozen applications (and anything added later) by accident.
  const maintained = DEFAULT_DEV_APPS
    .map((app) => JSON.parse(readFileSync(path.join(repoRoot, "apps", app, "package.json"), "utf8")).name)
    .map((name) => `--filter=${name}`)
    .join(" ");
  const frozen = Object.keys(APP_PORTS)
    .filter((app) => app.startsWith("frozen/"))
    .map((app) => JSON.parse(readFileSync(path.join(repoRoot, "apps", app, "package.json"), "utf8")).name)
    .map((name) => `--filter=${name}`)
    .join(" ");
  // The four canonical Workers by package name: ./services/* would also start services/lcis-api (TOOLING).
  const workers = Object.keys(SERVICE_PORTS)
    .map((svc) => JSON.parse(readFileSync(path.join(repoRoot, "services", svc, "package.json"), "utf8")).name)
    .map((name) => `--filter=${name}`)
    .join(" ");
  const devScripts = {
    dev: `${setup} && ${run} ${maintained} --filter=@letbuyy/ui`,
    "dev:all": `${setup} && ${run} ${maintained} --filter=@letbuyy/ui ${workers}`,
    "dev:apps": `${setup} && ${run} ${maintained}`,
    "dev:frozen": `${setup} && ${run} ${frozen}`,
    "dev:services": `${setup} && ${run} --filter=./services/*`,
    "dev:storybook": `turbo run dev --filter=@letbuyy/ui`,
    "dev:setup": `${setup} --force`,
  };
  // Add a missing dev* script; never rewrite or delete one that is there. The committed root scripts are
  // the source of truth (`dev` also boots @letbuyy/api-gateway, and `dev:store` exists), and re-running
  // this file after a port change must not silently revert them. Root scripts carry no ports.
  for (const [key, value] of Object.entries(devScripts)) {
    if (!(key in pkg.scripts)) pkg.scripts[key] = value;
  }
});

console.log("\nDone. Run `pnpm dev` for the maintained apps, `pnpm dev:all` to add every worker, or `pnpm dev:frozen` for the frozen apps.");
