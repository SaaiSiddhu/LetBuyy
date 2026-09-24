import { execFileSync } from "node:child_process";
import fs from "node:fs";

const args = process.argv.slice(2);
const commitMessageIndex = args.indexOf("--commit-message");
const commitMessagePath = commitMessageIndex === -1 ? null : args[commitMessageIndex + 1];
const allowPendingMessage = args.includes("--allow-pending-message");

const lockedPaths = [
  "database/supabase/migrations/139_executable_foundation_ledger_core.sql",
  "database/supabase/migrations/141_executable_inventory_reservations.sql",
  "database/supabase/migrations/147_executable_order_state_risk.sql",
  "packages/theme-engine/src/theme-registry.ts",
  "packages/typescript/ui/src/tokens.ts",
  "apps/platform/identity/src/lib/auth/cookies.ts",
  "apps/platform/identity/src/app/api/auth/switch/route.ts",
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const staged = git(["diff", "--cached", "--name-only", "-z"])
  .split("\0")
  .filter(Boolean);
const frozenStaged = staged.filter((file) => lockedPaths.includes(file));

if (frozenStaged.length === 0) {
  console.log("Frozen-path gate passed (no locked paths staged).");
  process.exit(0);
}

if (!commitMessagePath) {
  if (allowPendingMessage && process.env.LETBUYY_FROZEN_OVERRIDE_PENDING === "1") {
    console.log("Frozen-path gate deferred to commit-msg trailer check.");
    process.exit(0);
  }
  console.error("Frozen-path gate failed: locked paths are staged.");
  for (const file of frozenStaged) console.error(`- ${file}`);
  console.error("Set LETBUYY_FROZEN_OVERRIDE_PENDING=1 only when the commit message includes FROZEN-OVERRIDE: <human>.");
  process.exit(1);
}

const message = fs.readFileSync(commitMessagePath, "utf8");
if (!/^FROZEN-OVERRIDE:\s*\S+/m.test(message)) {
  console.error("Frozen-path gate failed: locked paths require a FROZEN-OVERRIDE: <human> commit trailer.");
  for (const file of frozenStaged) console.error(`- ${file}`);
  process.exit(1);
}

console.log("Frozen-path gate passed (override trailer present).");
