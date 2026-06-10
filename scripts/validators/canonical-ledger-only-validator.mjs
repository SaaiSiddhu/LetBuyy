import {
  assertNoOffenders,
  phaseBEntries,
} from "./phase-b-common.mjs";
import { createReporter } from "./governance-common.mjs";

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
];

const legacyAllowedUntilD5 = new Set([
  "services/api-gateway/src/execution/queue-execution.adapter.ts",
  "services/queue-workers/src/platform-queue-consumer.ts",
  "services/api-gateway/src/routes/app-store/billing-oauth-routes.ts",
  "services/api-gateway/src/routes/app-store/developer-routes.ts",
  "services/api-gateway/src/routes/app-store/developer-tooling-routes.ts",
  "services/api-gateway/src/routes/app-store/shared.ts",
  "services/api-gateway/src/lib/internal-developer-ops.ts",
  "services/api-gateway/src/lib/theme-marketplace-auxiliary-routes.ts",
  "services/api-gateway/src/routes/operations/developers.ts",
]);

const mutationPattern = new RegExp(
  `\\.from\\(\\s*['"\`](${moneyMutationTables.join("|")})['"\`]\\s*\\)[\\s\\S]{0,1400}\\.(insert|update|upsert|delete)\\b`,
  "g",
);

const canonicalLedgerEvidence =
  /\b(ledger_transactions|ledger_entries|post_settlement_ledger_transaction|postPaymentLedger|buildPaymentCaptureLedgerPosting|buildPaymentRefundLedgerPosting|postCanonicalPayoutLedger|planPayoutReleaseLedgerPosting|capture_ledger_transaction_id|refund_ledger_transaction_id|release_ledger_transaction_id|canonical_ledger_transaction_id)\b/;

const mutableBalanceReadPattern = /\.select\(\s*['"`][^'"`]*(?:wallet_balance_minor|mutable_balance_minor|balance_minor)[^'"`]*['"`]\s*\)/g;

const offenders = [];
for (const entry of phaseBEntries(["services", "packages"])) {
  if (legacyAllowedUntilD5.has(entry.path) && !entry.extra) continue;

  const mutationMatches = [...entry.text.matchAll(mutationPattern)];
  if (mutationMatches.length > 0 && !canonicalLedgerEvidence.test(entry.text)) {
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

assertNoOffenders(reporter, offenders, "Money mutations must route through canonical ledger evidence");
reporter.finish("canonical money mutation ratchet checked");
