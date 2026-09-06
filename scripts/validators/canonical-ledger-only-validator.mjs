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

// F-LEDGER-1 -- the stored-value ledgers migrations 231 and 232 added. These are NOT part of the
// list above, and the difference is deliberate. A table in `moneyMutationTables` may legitimately be
// written from TypeScript when the same file also posts to the canonical ledger, which is why that
// arm has a file-level evidence escape hatch. These four have no such case at all: every writer is a
// SECURITY DEFINER RPC (award_loyalty_points, redeem_loyalty_points, record_ad_credit_purchase,
// allocate_ad_campaign_budget), and migration 236 removes the privilege that made a direct write
// possible. So this arm has NO escape hatch -- any `.from(<table>).insert/update/upsert/delete` is an
// offender, full stop.
//
// The database fence in 236 is the real control; this is the tripwire that keeps a call site from
// being written in the first place, where the failure is a red gate rather than a runtime 42501.
const storedValueLedgerTables = [
  "loyalty_accounts",
  "loyalty_ledger_entries",
  "ad_credit_accounts",
  "ad_credit_ledger_entries",
];

// The window is TEMPERED -- `(?:(?!\.from\()[\s\S])` -- so it can never run past the next
// `.from(` into a different query. A plain `[\s\S]{0,1400}` reads whatever follows, so an innocent
// `.from('loyalty_ledger_entries').select(...)` sitting above an unrelated `.insert(` would be
// reported as a money mutation. That is the window-too-WIDE half of the extraction defect this
// repository has now hit repeatedly, and the fix is to bound the window at the construct boundary
// rather than at a character count.
const storedValueMutationPattern = new RegExp(
  `\\.from\\(\\s*['"\`](${storedValueLedgerTables.join("|")})['"\`]\\s*\\)`
  + `(?:(?!\\.from\\()[\\s\\S]){0,1400}?\\.(insert|update|upsert|delete)\\b`,
  "g",
);

// The forward ratchet on 236. 231 and 232 contain the very grants 236 revokes, so re-reading them
// would flag history rather than drift; what must not happen is a LATER migration handing the write
// back -- the realistic accident being someone copying 232's grant block into a new migration. A
// bare INSERT/UPDATE on ad_campaigns is likewise forbidden, while a column-scoped
// `GRANT UPDATE (name, ...)` is exactly what 236 itself issues and stays allowed.
//
// Limits, stated rather than implied: this reads plain GRANT statements. A future migration could
// still hand the privilege back through dynamic SQL or an ownership change, and neither is caught
// here. The privilege state itself is asserted by 236's own verification block and by
// tests/executable/stored-value-write-fence-postgres.test.mjs, which execute against a real database.
const STORED_VALUE_FENCE_MIGRATION = 236;
const fenceRegrantPattern = new RegExp(
  `GRANT\\b[^;]*\\b(?:INSERT|UPDATE|DELETE|ALL)\\b[^;]*\\bON\\b[^;]*\\b(?:${storedValueLedgerTables.join("|")})\\b[^;]*`,
  "gi",
);
const adCampaignsRegrantPattern =
  /GRANT\b[^;]*\b(?:INSERT|UPDATE|ALL)\b(?!\s*\()[^;]*\bON\b[^;]*\bad_campaigns\b[^;]*/gi;

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

// Scanned over apps as well as services and packages, unlike the arm above. An app route writing a
// stored-value ledger directly is doubly wrong -- it is also a local database write from an app,
// which the gateway-proxy route-ownership rule forbids -- and there is nothing to grandfather:
// measured at the time this was written, no file under apps/ mentions any of the four tables.
for (const entry of phaseBEntries(["apps", "services", "packages"])) {
  for (const match of entry.text.matchAll(storedValueMutationPattern)) {
    offenders.push(
      `${entry.path}:1 ${match[1]} is stored value -- every write goes through its SECURITY DEFINER RPC`,
    );
  }
}

for (const entry of phaseBEntries(["database/supabase/migrations"], {
  includeTests: true,
  filePattern: /\.sql$/,
})) {
  if (migrationRank(entry.path) <= STORED_VALUE_FENCE_MIGRATION) continue;
  for (const match of entry.text.matchAll(fenceRegrantPattern)) {
    offenders.push(
      `${entry.path}:1 re-grants a write on a stored-value ledger table that migration ${STORED_VALUE_FENCE_MIGRATION} revoked: ${match[0].trim().slice(0, 120)}`,
    );
  }
  for (const match of entry.text.matchAll(adCampaignsRegrantPattern)) {
    offenders.push(
      `${entry.path}:1 grants an unscoped write on ad_campaigns -- allocated_minor must stay withheld; use a column list: ${match[0].trim().slice(0, 120)}`,
    );
  }
}

assertNoOffenders(reporter, offenders, "Money mutations must route through canonical ledger evidence");
reporter.finish("canonical money mutation ratchet checked");
