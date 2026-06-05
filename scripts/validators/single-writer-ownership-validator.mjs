import path from "node:path";
import {
  createReporter,
  listWorkspaceFiles,
  readFile,
  sourceExtensions,
} from "./governance-common.mjs";

const reporter = createReporter("Single-writer ownership validator");

const sourceFilesByRoot = new Map();
function sourceFiles(root) {
  if (!sourceFilesByRoot.has(root)) {
    sourceFilesByRoot.set(
      root,
      listWorkspaceFiles([root]).filter((file) => sourceExtensions.has(path.extname(file)) && !file.endsWith(".d.ts")),
    );
  }
  return sourceFilesByRoot.get(root);
}

const ownershipRules = [
  {
    root: "services/webhook-service/src",
    owner: "services/api-gateway",
    tables: ["orders", "products", "subscriptions", "sites", "billing_history", "outbox_events"],
  },
  {
    root: "services/queue-workers/src",
    owner: "services/api-gateway",
    tables: ["outbox_events"],
  },
  {
    root: "services/api-gateway/src",
    owner: "services/webhook-service",
    tables: ["payment_webhook_events"],
  },
  {
    root: "services/queue-workers/src",
    owner: "services/webhook-service",
    tables: ["payment_webhook_events"],
  },
];

const forbiddenWriteHelpers = [
  "patchRows",
  "patchSupabaseRows",
  "insertRows",
  "insertSupabaseRows",
  "upsertRows",
  "upsertSupabaseRows",
];
const forbiddenGatewayOwnedOrderRpcs = [
  "attach_order_payment_reference",
  "attach_order_payment_reference_with_ledger",
  "confirm_order_payment",
  "confirm_order_payment_with_ledger",
  "record_order_payment_failure",
  "record_order_payment_failure_with_ledger",
  "release_order_inventory",
  "release_order_inventory_with_ledger",
];

function lineNumberFor(source, index) {
  return source.slice(0, index).split("\n").length;
}

function assertNoWrites(file, source, table, owner) {
  for (const helper of forbiddenWriteHelpers) {
    const pattern = new RegExp(`${helper}\\s*(?:<[^>]+>)?\\(\\s*[^,]+,\\s*["']${table}["']`, "g");
    for (const match of source.matchAll(pattern)) {
      reporter.assert(
        false,
        `${file}:${lineNumberFor(source, match.index ?? 0)} writes ${owner}-owned table ${table} through ${helper}; route mutations through ${owner}`,
      );
    }
  }

  const fromPattern = new RegExp(`\\.from\\(\\s*["']${table}["']\\s*\\)[\\s\\S]{0,400}?\\.(?:insert|update|upsert|delete)\\s*\\(`, "g");
  for (const match of source.matchAll(fromPattern)) {
    reporter.assert(
      false,
      `${file}:${lineNumberFor(source, match.index ?? 0)} writes ${owner}-owned table ${table} through Supabase query builder; route mutations through ${owner}`,
    );
  }
}

for (const rule of ownershipRules) {
  for (const file of sourceFiles(rule.root)) {
    const source = readFile(file);
    for (const table of rule.tables) {
      assertNoWrites(file, source, table, rule.owner);
    }
  }
}

for (const file of sourceFiles("services/webhook-service/src")) {
  const source = readFile(file);

  for (const rpc of forbiddenGatewayOwnedOrderRpcs) {
    const pattern = new RegExp(`callSupabaseRpc\\s*(?:<[^>]+>)?\\(\\s*[^,]+,\\s*["']${rpc}["']`, "g");
    for (const match of source.matchAll(pattern)) {
      reporter.assert(
        false,
        `${file}:${lineNumberFor(source, match.index ?? 0)} calls gateway-owned order RPC ${rpc}; route mutations through services/api-gateway`,
      );
    }
  }
}

const checkedFiles = Array.from(sourceFilesByRoot.values()).reduce((sum, files) => sum + files.length, 0);
reporter.finish(`${checkedFiles} source files checked for Single-Writer table ownership`);
