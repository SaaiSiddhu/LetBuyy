// The app-local API route inventory: the one place the ratchet count, the class list and the
// classification rules live. domain-boundary-validator.mjs enforces it against the tree, and the tests
// that used to mirror the count (five of them, each hardcoding a number that went stale as the count
// grew) call into this module instead, so there is no second copy to drift.
//
// The count is a ratchet: a route added or removed without a matching, reviewed edit here is a
// violation. Bumping it is the deliberate maintenance action the check expects -- and the route is
// also added to config/eslint/boundary-baseline.json when it is an app-local-* class, and to the change
// log in docs/governance/app-api-route-ownership.md.
//
// A count alone can hide a swap (one route removed, another added), so the checks that matter are the
// per-route ones: every route on disk has a classification, the class is a known one, and no route is
// listed twice.

import { listWorkspaceFiles, rootSegment } from "./governance-common.mjs";

export const APP_API_ROUTE_CLASSES = [
  "app-local-auth",
  "app-local-buyer-auth",
  "app-local-operator-auth",
  "app-local-session",
  "blocked-local-safety",
  "gateway-proxy",
];

// D-APP-LAYOUT: application roots sit under grouping containers, so the owning root comes from the
// governed lists (rootSegment), never from counting path segments.
export function isAppApiRouteFile(file) {
  return file.startsWith(`${rootSegment(file)}/src/app/api/`) && file.endsWith("/route.ts");
}

export function listAppApiRoutes(files = listWorkspaceFiles(["apps"])) {
  return files.filter(isAppApiRouteFile).sort();
}

export function classifyAppApiRoute(file) {
  if (file.startsWith("apps/platform/identity/src/app/api/auth/")) return "app-local-auth";
  // D-8 (2026-09-05): the marketplace buyer realm. A SEPARATE class from app-local-auth, not a
  // widening of it -- buyer auth must never grant merchant rights (ART-05, SEC-R7), and keeping the
  // two trees distinct is what makes a buyer route landing in the merchant tree visible in a diff.
  //
  // Why an app-local route at all, when the boundary rule says backend behavior belongs in
  // services/api-gateway: token ISSUANCE cannot move there. ART-05 makes identity-platform the sole
  // asymmetric issuer, and a previous phase closed a second live issuer as an S0. The gateway owns
  // the buyer_accounts rows (BUYER-3); these routes only mint. That is the one thing the gateway
  // must not do, so this is a constitutional exception, not a convenience.
  if (file.startsWith("apps/platform/identity/src/app/api/buyer/")) return "app-local-buyer-auth";
  if (file.startsWith("apps/internal/console/src/app/api/console-auth/")) return "app-local-operator-auth";
  if (file.startsWith("apps/internal/console/src/app/api/")) return "gateway-proxy";
  if (file.startsWith("apps/frozen/operations-portal/src/app/api/")) return "gateway-proxy";
  if (file.startsWith("apps/frozen/developer-portal/src/app/api/")) return "gateway-proxy";
  if (file.startsWith("apps/marketing/web/src/app/api/")) return "gateway-proxy";
  if (file === "apps/merchant/web/src/app/api/auth/logout/route.ts") return "app-local-session";
  if (file.startsWith("apps/merchant/web/src/app/api/")) return "gateway-proxy";
  if (file.startsWith("apps/frozen/app-store/src/app/api/")) return "gateway-proxy";
  if (file.startsWith("apps/frozen/theme-store/src/app/api/")) return "gateway-proxy";
  // APPID-P4c: the storefront's end of buyer sign-in. It holds the store-host __Host- cookies and asks
  // identity-platform for the token; every database decision stays in the gateway.
  if (file.startsWith("apps/commerce/web/src/app/api/buyer-auth/")) return "app-local-buyer-auth";
  if (file === "apps/commerce/web/src/app/api/customer/session/route.ts") return "app-local-session";
  if (file === "apps/commerce/web/src/app/api/customer/logout/route.ts") return "app-local-session";
  if (file === "apps/commerce/web/src/app/api/seed/route.ts") return "blocked-local-safety";
  if (file === "apps/commerce/web/src/app/api/themes/install/route.ts") return "blocked-local-safety";
  if (file.startsWith("apps/commerce/web/src/app/api/")) return "gateway-proxy";
  return null;
}


// T8/W0 — 189 as of apps/commerce/web/src/app/api/store/[subdomain]/search-suggest/
// BUYER-4 (2026-09-05) — 191: + apps/platform/identity/src/app/api/buyer/{login,register}, class
// app-local-buyer-auth. Bumping this count is the deliberate maintenance action the classification
// check expects; the two routes are also added to config/eslint/boundary-baseline.json, which is the
// matching allowlist for letbuyy-boundaries/no-new-next-api-route.
// route.ts (T5, commit 68ed4b29): a thin gateway-proxy read route, already correctly classified
// by the existing `apps/commerce/web/src/app/api/` catch-all above — this bump is the
// deliberate maintenance action the classification check above expects, not a workaround.
// APPID-P4a (2026-09-24) — 197: + apps/platform/identity/src/app/api/buyer/{logout,
// sign-out-everywhere,verify-email/send,verify-email/confirm,recover/send,recover/confirm}, class
// app-local-buyer-auth like BUYER-4's two. They hold the one thing the gateway cannot, the
// identity-platform host-only buyer cookie and the token minted from it; every database decision
// stays in the gateway. Added to config/eslint/boundary-baseline.json in the same commit.
// APPID-SEC2 (2026-09-24) — 195: - apps/platform/identity/src/app/api/email/store-creation-{success,failure},
// which sent LetBuyy-branded email for anonymous callers. Their class, identity-gateway-proxy, had no
// other member and goes with them; the two lines leave config/eslint/boundary-baseline.json too.
// APPID-P4b (2026-09-24) — 197: + apps/platform/identity/src/app/api/buyer/oauth/{authorize,token}, class
// app-local-buyer-auth: the step that asks the gateway for a code after the buyer chose to continue, and
// the exchange that mints the storefront session. Both only call the gateway and sign; neither touches
// a database. Added to config/eslint/boundary-baseline.json in the same commit.
// APPID-P4c (2026-09-24) — 201: + apps/commerce/web/src/app/api/buyer-auth/{start,callback,session,logout},
// class app-local-buyer-auth. Added to config/eslint/boundary-baseline.json in the same commit.
// SUSTAINED-K (D1/D2, 2026-09-25) — 204: + apps/commerce/web/src/app/api/buyer/{profile,addresses,
// addresses/[id]}, class gateway-proxy (the existing fallback rule for apps/commerce/web/src/app/api/,
// no new classifyAppApiRoute branch needed): each is a thin HTTP proxy to GET/PATCH /storefront/
// buyer/profile and GET/POST/PATCH/DELETE /storefront/buyer/addresses[/:id], forwarding only the
// buyer's own session token -- no database access, no commerce logic, nothing config/eslint/
// boundary-baseline.json needs to know about (that allowlist is for app-local-* classes only).
export const APP_API_ROUTE_RATCHET = 204;

export function ownershipCounts(routes) {
  const counts = new Map();
  for (const file of routes) {
    const classification = classifyAppApiRoute(file);
    counts.set(classification, (counts.get(classification) || 0) + 1);
  }
  return counts;
}

export function inventoryViolations(routes, ratchet = APP_API_ROUTE_RATCHET) {
  const violations = [];
  const seen = new Set();
  for (const file of routes) {
    if (seen.has(file)) violations.push(`App-local API route is listed twice: ${file}`);
    seen.add(file);
    const classification = classifyAppApiRoute(file);
    if (!classification) violations.push(`App-local API route lacks ownership classification: ${file}`);
    else if (!APP_API_ROUTE_CLASSES.includes(classification)) violations.push(`App-local API route has an unknown ownership class "${classification}": ${file}`);
  }
  if (routes.length !== ratchet) {
    violations.push(`App-local API route inventory changed without updating P4-4 classification: expected ${ratchet}, found ${routes.length}`);
  }
  return violations;
}
