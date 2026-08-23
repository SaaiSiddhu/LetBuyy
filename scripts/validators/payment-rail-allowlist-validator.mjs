import {
  assertNoOffenders,
  lineNumberForIndex,
  phaseBEntries,
} from "./phase-b-common.mjs";
import { createReporter } from "./governance-common.mjs";

const reporter = createReporter("Payment rail allowlist validator");
const offenders = [];

// DOC 03 (LETBUYY_CANONICAL_SYSTEMS.md) row 11 "Payments": single capture
// adapter -> posts canonical ledger; money-in is MoR-on-own-Razorpay only.
// COD is the only non-provider settlement path. Phase M1 retired the
// Stripe/PayPal/Cashfree live capture routes and enums; this validator keeps
// them retired.
const CANONICAL_PAYMENT_RAILS = ["razorpay", "cod"];
const FORBIDDEN_PAYMENT_RAIL_PROVIDERS = ["stripe", "paypal", "cashfree", "adyen", "square", "braintree"];

// ART-16: the App-Functions/checkout-extensions Wasm seam
// (packages/shared-types/src/app-platform.ts) is frozen and already removed
// from the live order/storefront path. Retiring its schema is a separate,
// frozen-seam decision -- out of scope for Phase M1 (DOC 03 row 11) -- so it
// is intentionally excluded from this scan rather than left to fail here.
const FROZEN_SEAM_EXCLUSIONS = new Set([
  "packages/shared-types/src/app-platform.ts",
]);

// DOC 03 draws "Payments" (row 11, customer money-in -- this validator's
// scope) and "Billing" as two separate winners. Billing's winner is
// subscription billing as LetBuyy's own monetization spine and does not
// retire Stripe there -- it is LetBuyy invoicing MERCHANTS for platform
// subscriptions, not a customer checkout rail. These files implement that
// separate, still-live Billing flow, so a non-canonical-looking provider
// literal here is out of scope for this validator (a future Billing-specific
// gate, not this one).
const BILLING_DOMAIN_EXCLUSIONS = new Set([
  "services/api-gateway/src/execution/subscription-execution.adapter.ts",
  "services/api-gateway/src/routes/internal-billing.ts",
]);

const forbiddenProviderAlternation = FORBIDDEN_PAYMENT_RAIL_PROVIDERS.join("|");

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
}

// (a) No route registration under services/api-gateway/src/routes/** or
// services/webhook-service/src/** (the two canonical runtimes that mount
// their own HTTP routes on the payment-capture/webhook-ingress path) may
// mount a non-allowlisted provider as a path segment (e.g. '/stripe/checkout',
// '/webhooks/paypal'). The trailing (?![\w-]) keeps this from matching a
// longer identifier such as 'stripeAdapter' or 'stripe_v2'.
const routeRegistrationPattern = new RegExp(
  `\\.(?:get|post|put|patch|delete|all|route)\\(\\s*['"\`]\\/?(?:[\\w-]+\\/)*(?:${forbiddenProviderAlternation})(?![\\w-])(?:\\/[\\w-]*)*['"\`]`,
  "gi",
);

for (const entry of phaseBEntries(
  ["services/api-gateway/src/routes", "services/webhook-service/src"],
  { filePattern: /\.ts$/ },
)) {
  if (entry.path.endsWith(".d.ts")) continue;

  for (const match of entry.text.matchAll(routeRegistrationPattern)) {
    offenders.push(
      `${entry.path}:${lineNumberForIndex(entry.text, match.index || 0)} route registration mounts a non-canonical payment provider ("${match[0].trim()}"); only ${CANONICAL_PAYMENT_RAILS.join("/")} may be reachable from the live payment-capture path (DOC 03 row 11)`,
    );
  }
}

// (b) No payment-method/provider enum in packages/checkout-core/**,
// packages/shared-types/**, or services/api-gateway/src/schemas/** (where the
// V1 payment-session provider schema lives) may admit a non-allowlisted rail
// as a literal value. This looks inside every `.enum([...])` call for a
// forbidden provider string literal.
const enumCallPattern = /\.enum\(\s*\[([^\]]*)\]\s*\)/g;
const forbiddenRailLiteralPattern = new RegExp(`['"](${forbiddenProviderAlternation})['"]`, "g");

for (const entry of phaseBEntries(
  ["packages/checkout-core", "packages/shared-types", "services/api-gateway/src/schemas"],
  { filePattern: /\.ts$/ },
)) {
  if (entry.path.endsWith(".d.ts")) continue;
  if (FROZEN_SEAM_EXCLUSIONS.has(entry.path)) continue;

  for (const enumMatch of entry.text.matchAll(enumCallPattern)) {
    const body = enumMatch[1];
    for (const forbiddenMatch of body.matchAll(forbiddenRailLiteralPattern)) {
      const absoluteIndex = (enumMatch.index || 0) + (forbiddenMatch.index || 0);
      offenders.push(
        `${entry.path}:${lineNumberForIndex(entry.text, absoluteIndex)} payment-method/provider enum admits non-canonical rail '${forbiddenMatch[1]}'; only ${CANONICAL_PAYMENT_RAILS.join("/")} (plus 'upi' as a Razorpay instrument, where applicable) are canonical (DOC 03 row 11)`,
      );
    }
  }
}

// (c) Outside zod, the same "accepted provider" concept is expressed as a
// hand-written TypeScript construct: a string-literal union (a `type X =
// 'razorpay' | 'stripe' | ...` alias, an inline parameter annotation, or a
// `value is '...'` type-guard predicate) or a `===`/`==` equality check
// against a forbidden literal (a hand-written normalizer/type-guard body).
// Check (b)'s `.enum([...])` pattern never sees this form, and it lives
// outside check (b)'s scan roots -- services/api-gateway's checkout/payment
// execution, route, and lib layers -- so it needs its own scan. A forbidden
// literal only counts if a `|` (union) or a non-negated `===`/`==`
// (equality, not `!==`/`!=`) sits immediately next to it; an unrelated
// string like a migration filename ("..._cashfree_payment_provider.sql")
// never satisfies that adjacency and is left alone.
const forbiddenLiteralPattern = new RegExp(`(['"])(${forbiddenProviderAlternation})\\1`, "gi");

function isProviderAdmission(text, match) {
  const before = text.slice(Math.max(0, match.index - 24), match.index);
  const after = text.slice(match.index + match[0].length, match.index + match[0].length + 24);
  if (/\|\s*$/.test(before) || /^\s*\|/.test(after)) return true;
  if (/(?<!!)={2,3}\s*$/.test(before)) return true;
  return false;
}

for (const entry of phaseBEntries(
  [
    "services/api-gateway/src/execution",
    "services/api-gateway/src/routes",
    "services/api-gateway/src/lib",
  ],
  { filePattern: /\.ts$/ },
)) {
  if (entry.path.endsWith(".d.ts")) continue;
  if (BILLING_DOMAIN_EXCLUSIONS.has(entry.path)) continue;

  const text = stripComments(entry.text);

  for (const match of text.matchAll(forbiddenLiteralPattern)) {
    if (!isProviderAdmission(text, match)) continue;
    offenders.push(
      `${entry.path}:${lineNumberForIndex(text, match.index || 0)} provider typing/comparison admits non-canonical rail '${match[2].toLowerCase()}'; only ${CANONICAL_PAYMENT_RAILS.join("/")} (plus 'upi' as a Razorpay instrument, where applicable) are canonical (DOC 03 row 11)`,
    );
  }
}

assertNoOffenders(
  reporter,
  offenders,
  "Non-canonical payment rails (Stripe/PayPal/Cashfree/Adyen/Square/Braintree) must not be reachable from routes, admitted by a schema enum, or admitted by hand-written provider typing/comparisons",
);

reporter.finish("no non-canonical payment rail is reachable from routes, schema enums, or hand-written provider typing/comparisons");
