import {
  assertNoOffenders,
  phaseBEntries,
} from "./phase-b-common.mjs";
import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Canonical ledger only validator");

const moneyMutationTables = [
  "payment_transactions",
  "payments",
  "payout_statements",
  "payouts",
  "refund_transactions",
  "refunds",
  "cod_reconciliation_entries",
  "settlements",
  "wallet_ledger_entries",
  "partner_payout_ledger_entries",
  "gift_card_accounts",
  "gift_card_ledger_entries",
  "ai_credits",
];

const partnerPayoutBoundaryId = "SKIP-B3-PARTNER-PAYOUT-LEDGER-BOUNDARY";
const partnerPayoutBoundaryFiles = new Set([
  "services/api-gateway/src/execution/queue-execution.adapter.ts",
  "services/queue-workers/src/platform-queue-consumer.ts",
  "services/queue-workers/src/executive-analytics.ts",
  "services/api-gateway/src/routes/app-store/billing-oauth-routes.ts",
  "services/api-gateway/src/routes/app-store/developer-routes.ts",
  "services/api-gateway/src/routes/app-store/developer-tooling-routes.ts",
  "services/api-gateway/src/routes/app-store/shared.ts",
  "services/api-gateway/src/lib/internal-developer-ops.ts",
  "services/api-gateway/src/routes/operations/developers.ts",
]);

const legacyAllowedUntilD5 = new Set([
  "services/api-gateway/src/lib/theme-marketplace-auxiliary-routes.ts",
]);

const mutationPattern = new RegExp(
  `\\.from\\(\\s*['"\`](${moneyMutationTables.join("|")})['"\`]\\s*\\)[\\s\\S]{0,1400}\\.(insert|update|upsert|delete)\\b`,
  "g",
);

const canonicalLedgerEvidence =
  /\b(ledger_transactions|ledger_entries|post_settlement_ledger_transaction|postPaymentLedger|buildPaymentCaptureLedgerPosting|buildPaymentRefundLedgerPosting|postCanonicalPayoutLedger|planPayoutReleaseLedgerPosting|capture_ledger_transaction_id|refund_ledger_transaction_id|release_ledger_transaction_id|canonical_ledger_transaction_id)\b/;

const mutableBalanceReadPattern = /\.select\(\s*['"`][^'"`]*(?:wallet_balance_minor|mutable_balance_minor|balance_minor)[^'"`]*['"`]\s*\)/g;

function migrationRank(filePath) {
  const basename = filePath.split("/").pop() || filePath;
  const match = basename.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

function latestMigrationFunction(functionName) {
  const migrationEntries = phaseBEntries(["database/supabase/migrations"], {
    includeTests: true,
    filePattern: /\.sql$/,
  })
    .filter((entry) => entry.extra || entry.path.startsWith("database/supabase/migrations/"))
    .sort((a, b) => {
      const rankDelta = migrationRank(a.path) - migrationRank(b.path);
      return rankDelta || a.path.localeCompare(b.path);
    });

  const pattern = new RegExp(
    `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${functionName}\\b[\\s\\S]*?AS\\s+\\$\\$([\\s\\S]*?)\\$\\$;`,
    "gi",
  );
  let latest = null;
  for (const entry of migrationEntries) {
    pattern.lastIndex = 0;
    for (const match of entry.text.matchAll(pattern)) {
      latest = {
        path: entry.path,
        body: match[1],
      };
    }
  }
  return latest;
}

function assertLatestFunctionContains(functionName, fragments) {
  const latest = latestMigrationFunction(functionName);
  reporter.assert(latest, `${functionName} must be defined by a tracked migration`);
  if (!latest) return;

  for (const fragment of fragments) {
    reporter.assert(
      latest.body.includes(fragment),
      `${latest.path} latest ${functionName} body must contain call-adjacent canonical ledger evidence: ${fragment}`,
    );
  }
}

function assertLatestFunctionExcludes(functionName, fragments) {
  const latest = latestMigrationFunction(functionName);
  reporter.assert(latest, `${functionName} must be defined by a tracked migration`);
  if (!latest) return;

  for (const fragment of fragments) {
    reporter.assert(
      !latest.body.includes(fragment),
      `${latest.path} latest ${functionName} body must not contain mutable balance write: ${fragment}`,
    );
  }
}

const offenders = [];
const skippedHuman = readFile("SKIPPED_HUMAN_DECISIONS.md");
reporter.assert(
  skippedHuman.includes(partnerPayoutBoundaryId),
  `${partnerPayoutBoundaryId} must record the explicit partner payout ledger boundary before allowing partner_payout_ledger_entries writes`,
);

for (const entry of phaseBEntries(["services", "packages"])) {
  if (legacyAllowedUntilD5.has(entry.path) && !entry.extra) continue;

  const mutationMatches = [...entry.text.matchAll(mutationPattern)];
  if (
    mutationMatches.some((match) => match[1] === "partner_payout_ledger_entries")
    && !partnerPayoutBoundaryFiles.has(entry.path)
    && !entry.extra
  ) {
    offenders.push(`${entry.path}:1 partner_payout_ledger_entries is ring-fenced to the explicit B3 boundary`);
  }
  if (mutationMatches.length > 0 && !canonicalLedgerEvidence.test(entry.text) && !partnerPayoutBoundaryFiles.has(entry.path)) {
    for (const match of mutationMatches) {
      offenders.push(`${entry.path}:1 money mutation on ${match[1]} lacks canonical ledger posting evidence`);
    }
  }

  for (const match of entry.text.matchAll(mutableBalanceReadPattern)) {
    if (!/ledger_account_balance_minor|derived/i.test(entry.text)) {
      offenders.push(`${entry.path}:1 mutable balance read must use derived canonical ledger balance`);
    }
  }
}

assertLatestFunctionContains("confirm_order_payment_with_ledger", [
  "public.post_settlement_ledger_transaction(",
  "payment_capture",
  "pa_clearing",
  "merchant_payable",
  "canonical_ledger_transaction_id",
  "payment_transaction_id",
]);

assertLatestFunctionContains("complete_order_refund", [
  "public.post_settlement_ledger_transaction(",
  "refund",
  "merchant_payable",
  "refund_clearing",
  "canonical_ledger_transaction_id",
  "payment_transaction_id",
]);

assertLatestFunctionContains("record_order_payment_failure_with_ledger", [
  "p_payment_status = 'refunded'",
  "public.post_settlement_ledger_transaction(",
  "refund",
  "merchant_payable",
  "refund_clearing",
  "canonical_ledger_transaction_id",
  "payment_transaction_id",
]);

assertLatestFunctionContains("resolve_money_ledger_source_site_id", [
  "payment_transactions",
  "payment_transaction_id",
  "provider_payment_id",
]);

assertLatestFunctionContains("create_checkout_order", [
  "v_gift_card_balance",
  "gift_card_ledger_entries",
  "balance_after",
]);
assertLatestFunctionExcludes("create_checkout_order", [
  "UPDATE gift_card_accounts",
  "SET balance = balance - v_gift_card_amount",
]);

assertNoOffenders(reporter, offenders, "Money mutations must route through canonical ledger evidence");
reporter.finish("canonical money mutation ratchet checked");
