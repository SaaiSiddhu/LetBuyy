import path from "node:path";
import {
  createReporter,
  listWorkspaceFiles,
  readFile,
  sourceExtensions,
} from "./governance-common.mjs";

const reporter = createReporter("Single-writer ownership validator");

const webhookSourceFiles = listWorkspaceFiles(["services/webhook-service/src"])
  .filter((file) => sourceExtensions.has(path.extname(file)) && !file.endsWith(".d.ts"));

const forbiddenOwnedTables = ["orders", "products"];
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

for (const file of webhookSourceFiles) {
  const source = readFile(file);

  for (const helper of forbiddenWriteHelpers) {
    for (const table of forbiddenOwnedTables) {
      const pattern = new RegExp(`${helper}\\s*(?:<[^>]+>)?\\(\\s*[^,]+,\\s*["']${table}["']`, "g");
      for (const match of source.matchAll(pattern)) {
        reporter.assert(
          false,
          `${file}:${lineNumberFor(source, match.index ?? 0)} writes gateway-owned table ${table} through ${helper}; route mutations through services/api-gateway`,
        );
      }
    }
  }

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

reporter.finish(`${webhookSourceFiles.length} webhook-service source files checked for gateway-owned order/product writes`);
