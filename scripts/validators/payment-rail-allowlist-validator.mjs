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
  // Phase M5: activateGatewayStoreSubscription itself -- the Billing-domain
  // subscription-activation RPC wrapper -- lives here, called from
  // services/webhook-service/src/index.ts's activateStoreSubscription
  // (a thin pass-through, marked with BILLING_DOMAIN_MARKER below since it
  // shares a file with genuinely Payments-domain code).
  "services/webhook-service/src/gateway-billing-transitions.ts",
]);

// A narrower, surgical alternative to a whole-file BILLING_DOMAIN_EXCLUSIONS
// entry: for a construct inside a file that ALSO contains genuinely
// Payments-domain code (so a whole-file exclusion would blind the scan to
// real violations there), e.g. services/webhook-service/src/index.ts, which
// has both the Payments-domain PaymentProvider type and the Billing-domain
// activateStoreSubscription. Uses the same nearby-marker mechanism as
// HISTORICAL_READ_PATH_MARKER, deliberately under its own name -- "billing
// domain, not a customer checkout rail" is a different reason than
// "historical data", and conflating them would misdescribe why a future
// reader finds this exemption here.
const BILLING_DOMAIN_MARKER = "PAYMENT-RAIL-VALIDATOR: BILLING-DOMAIN-EXEMPT";

function hasNearbyBillingDomainMarker(text, matchIndex) {
  const upToMatch = text.slice(0, matchIndex);
  const lines = upToMatch.split("\n");
  const window = lines.slice(Math.max(0, lines.length - 9)).join("\n");
  return window.includes(BILLING_DOMAIN_MARKER);
}

// Phase M2: apps/customer_web/src/lib/order-service.ts only MAPS DB
// rows for display -- a read path, not a write path. create_checkout_order
// accepted 'stripe'/'paypal' through migration 170 and 'cashfree' between
// migrations 075 and 170 (database/supabase/migrations/
// 075_cashfree_payment_provider.sql, 170_v1_shipping_rates_gst.sql), so
// historical order rows can genuinely carry these values; narrowing the
// read-side type would misrepresent real data, not fix anything. A
// whole-file exclusion is safe here because this file (~220 lines) does
// nothing but map/read order rows -- it registers no route, defines no
// schema, and calls no payment provider. See the matching
// PAYMENT-RAIL-VALIDATOR marker comment at its OrderPayment construction
// site for the human-readable version of this same justification.
const HISTORICAL_READ_PATH_FILE_EXCLUSIONS = new Set([
  "apps/customer_web/src/lib/order-service.ts",
]);

// A narrower, surgical alternative to a whole-file exclusion: an inline
// comment marker for a SPECIFIC construct inside an otherwise-scanned file
// that is too large/multi-purpose for a whole-file exclusion (e.g.
// packages/checkout-core/src/index.ts). The marker must appear within the
// ~8 lines immediately before (or on the same line as) the flagged
// construct -- see hasNearbyHistoricalReadPathMarker.
const HISTORICAL_READ_PATH_MARKER = "PAYMENT-RAIL-VALIDATOR: HISTORICAL-READ-PATH-EXEMPT";

function hasNearbyHistoricalReadPathMarker(text, matchIndex) {
  const upToMatch = text.slice(0, matchIndex);
  const lines = upToMatch.split("\n");
  const window = lines.slice(Math.max(0, lines.length - 9)).join("\n");
  return window.includes(HISTORICAL_READ_PATH_MARKER);
}

const forbiddenProviderAlternation = FORBIDDEN_PAYMENT_RAIL_PROVIDERS.join("|");

// Length-preserving: comments are blanked to spaces (newlines kept), not
// deleted, so a match index computed against the returned string is the
// SAME index into the original `text` -- required for
// hasNearbyHistoricalReadPathMarker (which reads the marker from the
// original, comment-bearing text) and lineNumberForIndex to both stay
// correct against the same offsets.
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/\/\/.*/g, (comment) => comment.replace(/[^\n]/g, " "));
}

// Extends the old /\.ts$/-only scan to also cover .tsx -- apps/ is largely
// .tsx, and a provider literal admitted there (a hand-written union, a
// hardcoded request body, a client-side comparison) is just as real a
// live-path violation as one in a .ts route file. .d.ts is excluded below.
const SOURCE_FILE_PATTERN = /\.tsx?$/;

// (a) No route registration under services/api-gateway/src/routes/**,
// services/webhook-service/src/**, services/queue-workers/src/**,
// services/mobile-bff/src/**, or apps/** (every canonical runtime that
// mounts its own HTTP routes, or a Next.js app route, on the payment-
// capture/webhook-ingress/BFF-fanout path) may mount a non-allowlisted
// provider as a path segment (e.g. '/stripe/checkout', '/webhooks/paypal').
// The trailing (?![\w-]) keeps this from matching a longer identifier such
// as 'stripeAdapter' or 'stripe_v2'.
const routeRegistrationPattern = new RegExp(
  `\\.(?:get|post|put|patch|delete|all|route)\\(\\s*['"\`]\\/?(?:[\\w-]+\\/)*(?:${forbiddenProviderAlternation})(?![\\w-])(?:\\/[\\w-]*)*['"\`]`,
  "gi",
);

for (const entry of phaseBEntries(
  [
    "apps",
    "services/api-gateway/src/routes",
    "services/webhook-service/src",
    "services/queue-workers/src",
    "services/mobile-bff/src",
  ],
  { filePattern: SOURCE_FILE_PATTERN },
)) {
  if (entry.path.endsWith(".d.ts")) continue;

  for (const match of entry.text.matchAll(routeRegistrationPattern)) {
    offenders.push(
      `${entry.path}:${lineNumberForIndex(entry.text, match.index || 0)} route registration mounts a non-canonical payment provider ("${match[0].trim()}"); only ${CANONICAL_PAYMENT_RAILS.join("/")} may be reachable from the live payment-capture path (DOC 03 row 11)`,
    );
  }
}

// (b) No payment-method/provider enum in packages/checkout-core/**,
// packages/shared-types/**, services/api-gateway/src/schemas/** (where the
// V1 payment-session provider schema lives), or apps/** may admit a
// non-allowlisted rail as a literal value. This looks inside every
// `.enum([...])` call for a forbidden provider string literal.
const enumCallPattern = /\.enum\(\s*\[([^\]]*)\]\s*\)/g;
const forbiddenRailLiteralPattern = new RegExp(`['"](${forbiddenProviderAlternation})['"]`, "g");

for (const entry of phaseBEntries(
  ["packages/checkout-core", "packages/shared-types", "services/api-gateway/src/schemas", "apps"],
  { filePattern: SOURCE_FILE_PATTERN },
)) {
  if (entry.path.endsWith(".d.ts")) continue;
  if (FROZEN_SEAM_EXCLUSIONS.has(entry.path)) continue;

  for (const enumMatch of entry.text.matchAll(enumCallPattern)) {
    const body = enumMatch[1];
    const forbidden = [...body.matchAll(forbiddenRailLiteralPattern)];
    if (forbidden.length === 0) continue;

    // This clause is about PAYMENT-METHOD/PROVIDER enums, as its own name says, but it used to
    // inspect every `.enum([...])` in these directories. Some rail names are also ordinary words —
    // 'square' is an image aspect ratio, 'stripe' is a border style — so an unrelated vocabulary
    // was reported as admitting a payment rail, and the only ways out were to corrupt the domain
    // vocabulary or to add a blanket file exemption. Both are worse than making the check say what
    // it means.
    //
    // Two independent ways to qualify, so narrowing the first cannot open a hole:
    //   1. the enum is DECLARED in a payment context — every real one in the repository is
    //      (payment_method · paymentMethod · provider · V1PaymentProviderSchema ·
    //      AppFunctionCheckoutPaymentMethodSchema · MerchantPayoutRailSchema ·
    //      AppBillingIndiaPayoutRailSchema · checkout_mode); or
    //   2. it lists TWO OR MORE distinct rails, which is a provider list whatever it is called.
    const declaration = entry.text.slice(Math.max(0, (enumMatch.index || 0) - 160), enumMatch.index || 0);
    const declaredAsPayment = /payment|provider|rail|gateway|psp|checkout|payout|billing|method|tender|processor/i.test(
      declaration.split("\n").pop() || declaration,
    );
    const distinctRails = new Set(forbidden.map((m) => m[1].toLowerCase()));
    if (!declaredAsPayment && distinctRails.size < 2) continue;

    for (const forbiddenMatch of forbidden) {
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
// Check (b)'s `.enum([...])` pattern never sees this form. Scans the same
// roots as check (a) -- services/api-gateway's execution/route/lib layers,
// services/webhook-service/src, services/queue-workers/src,
// services/mobile-bff/src, apps/** -- plus packages/checkout-core and
// packages/shared-types (the same hand-written-union shape can appear on a
// domain model, e.g. OrderPayment, which check (a) has no reason to scan).
// A forbidden literal only counts if a `|` (union) or a non-negated
// `===`/`==` (equality, not `!==`/`!=`) sits immediately next to it; an
// unrelated string like a migration filename
// ("..._cashfree_payment_provider.sql") never satisfies that adjacency and is
// left alone. A file/construct that genuinely needs to stay wide is
// exempted, not silently unscanned, via one of two citation-bearing
// mechanisms: HISTORICAL_READ_PATH_FILE_EXCLUSIONS/_MARKER (reads
// historical, no-longer-writable data) or BILLING_DOMAIN_EXCLUSIONS/_MARKER
// (DOC 03's separate Billing winner, which legitimately keeps Stripe for
// merchant platform subscriptions -- not a customer checkout rail).
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
    "services/webhook-service/src",
    "services/queue-workers/src",
    "services/mobile-bff/src",
    "packages/checkout-core",
    "packages/shared-types",
    "apps",
  ],
  { filePattern: SOURCE_FILE_PATTERN },
)) {
  if (entry.path.endsWith(".d.ts")) continue;
  if (BILLING_DOMAIN_EXCLUSIONS.has(entry.path)) continue;
  if (FROZEN_SEAM_EXCLUSIONS.has(entry.path)) continue;
  if (HISTORICAL_READ_PATH_FILE_EXCLUSIONS.has(entry.path)) continue;

  // stripComments is length-preserving (blanks comment characters to spaces
  // rather than deleting them), so `match.index` below is a valid offset
  // into BOTH the comment-blanked `text` and the original `entry.text`.
  // isProviderAdmission is comment-agnostic by construction, so running it
  // against the blanked `text` is safe -- a comment cannot forge a `|`/`===`
  // adjacency once blanked. hasNearbyHistoricalReadPathMarker deliberately
  // reads the marker from `entry.text` (the ORIGINAL, comment-bearing text),
  // since the marker itself lives inside a comment.
  const text = stripComments(entry.text);

  for (const match of text.matchAll(forbiddenLiteralPattern)) {
    if (!isProviderAdmission(text, match)) continue;
    if (hasNearbyHistoricalReadPathMarker(entry.text, match.index || 0)) continue;
    if (hasNearbyBillingDomainMarker(entry.text, match.index || 0)) continue;
    offenders.push(
      `${entry.path}:${lineNumberForIndex(text, match.index || 0)} provider typing/comparison admits non-canonical rail '${match[2].toLowerCase()}'; only ${CANONICAL_PAYMENT_RAILS.join("/")} (plus 'upi' as a Razorpay instrument, where applicable) are canonical (DOC 03 row 11)`,
    );
  }
}

assertNoOffenders(
  reporter,
  offenders,
  "Non-canonical payment rails (Stripe/PayPal/Cashfree/Adyen/Square/Braintree) must not be reachable from routes (apps, api-gateway, webhook-service, queue-workers, mobile-bff), admitted by a schema enum (apps, checkout-core, shared-types, api-gateway schemas), or admitted by hand-written provider typing/comparisons (apps, api-gateway execution/routes/lib, webhook-service, queue-workers, mobile-bff, checkout-core, shared-types) -- excluding the documented ART-16 frozen seam, Billing-domain files/constructs, and marked historical-read-path exemptions",
);

// Checks (a) and (c) now scan identical roots (apps, api-gateway routes/
// execution/lib, webhook-service, queue-workers, mobile-bff); check (b)
// additionally covers checkout-core/shared-types/api-gateway schemas, where
// zod enums live but hand-written unions don't. This message names exactly
// that -- it does not claim blanket "across apps/services/packages"
// coverage, because it isn't literally true for all three checks (queue-
// workers and mobile-bff, for instance, have no zod schemas of their own to
// scan in check (b)).
reporter.finish("no non-canonical payment rail is reachable from routes (apps, api-gateway, webhook-service, queue-workers, mobile-bff), schema enums (apps, checkout-core, shared-types, api-gateway schemas), or hand-written provider typing/comparisons (apps, api-gateway execution/routes/lib, webhook-service, queue-workers, mobile-bff, checkout-core, shared-types) -- excluding the documented ART-16 frozen seam, Billing-domain files/constructs, and historical-read-path exemptions");
