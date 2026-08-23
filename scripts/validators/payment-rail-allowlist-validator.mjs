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

const forbiddenProviderAlternation = FORBIDDEN_PAYMENT_RAIL_PROVIDERS.join("|");

// (a) No route registration under services/api-gateway/src/routes/** may
// mount a non-allowlisted provider as a path segment (e.g. '/stripe/checkout',
// '/webhooks/paypal'). The trailing (?![\w-]) keeps this from matching a
// longer identifier such as 'stripeAdapter' or 'stripe_v2'.
const routeRegistrationPattern = new RegExp(
  `\\.(?:get|post|put|patch|delete|all|route)\\(\\s*['"\`]\\/?(?:[\\w-]+\\/)*(?:${forbiddenProviderAlternation})(?![\\w-])(?:\\/[\\w-]*)*['"\`]`,
  "gi",
);

for (const entry of phaseBEntries(["services/api-gateway/src/routes"], { filePattern: /\.ts$/ })) {
  if (entry.path.endsWith(".d.ts")) continue;

  for (const match of entry.text.matchAll(routeRegistrationPattern)) {
    offenders.push(
      `${entry.path}:${lineNumberForIndex(entry.text, match.index || 0)} route registration mounts a non-canonical payment provider ("${match[0].trim()}"); only ${CANONICAL_PAYMENT_RAILS.join("/")} may be reachable from the live payment-capture path (DOC 03 row 11)`,
    );
  }
}

// (b) No payment-method/provider enum in packages/checkout-core/** or
// packages/shared-types/** may admit a non-allowlisted rail as a literal
// value. This looks inside every `.enum([...])` call for a forbidden
// provider string literal.
const enumCallPattern = /\.enum\(\s*\[([^\]]*)\]\s*\)/g;
const forbiddenRailLiteralPattern = new RegExp(`['"](${forbiddenProviderAlternation})['"]`, "g");

for (const entry of phaseBEntries(["packages/checkout-core", "packages/shared-types"], { filePattern: /\.ts$/ })) {
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

assertNoOffenders(
  reporter,
  offenders,
  "Non-canonical payment rails (Stripe/PayPal/Cashfree/Adyen/Square/Braintree) must not be reachable from the live payment-capture path or admitted by a checkout enum",
);

reporter.finish("no non-canonical payment rail is reachable from routes or admitted by an enum");
