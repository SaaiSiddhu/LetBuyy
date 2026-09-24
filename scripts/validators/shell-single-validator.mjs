import {
  assertNoOffenders,
  phaseBEntries,
} from "./phase-b-common.mjs";
import { createReporter } from "./governance-common.mjs";
import { existsSync, readFileSync } from "node:fs";

const reporter = createReporter("Shell single validator");

const allowedShellAuthorities = new Set([
  "packages/typescript/ui/src/app-shell.tsx",
  "packages/typescript/ui/src/navigation/app-navigation.tsx",
  "packages/typescript/ui/src/navigation/index.ts",
]);

const shellDefinitionPattern = /\b(export\s+default\s+function|export\s+function|function|const)\s+(AdminShell|Sidebar|HeaderBar)\b/;
const offenders = [];
if (existsSync("apps/merchant/web/src/components/Sidebar.tsx")) {
  offenders.push("apps/merchant/web/src/components/Sidebar.tsx: local merchant sidebar must stay deleted; use @letbuyy/ui AppNavigation");
}

const merchantShell = readFileSync("apps/merchant/web/src/components/AdminShell.tsx", "utf8");
if (!merchantShell.includes("<AppNavigation")) {
  offenders.push("apps/merchant/web/src/components/AdminShell.tsx: merchant shell must compose @letbuyy/ui AppNavigation");
}

const merchantNavigation = readFileSync("apps/merchant/web/src/components/merchantNavigation.ts", "utf8");
if (!merchantNavigation.includes("label: 'Money'") || !merchantNavigation.includes("path: 'settings/billing'")) {
  offenders.push("apps/merchant/web/src/components/merchantNavigation.ts: merchant IA must expose first-class Money navigation to settings/billing");
}

for (const entry of phaseBEntries(["apps", "packages"])) {
  if (allowedShellAuthorities.has(entry.path) && !entry.extra) continue;
  if (shellDefinitionPattern.test(entry.text)) {
    offenders.push(`${entry.path}: new shell/navigation primitives are forbidden; use @letbuyy/ui AppNavigation`);
  }
}

assertNoOffenders(reporter, offenders, "Application shell must stay single-source");
reporter.finish("shell authority ratchet checked");
