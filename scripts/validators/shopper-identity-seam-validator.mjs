import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Shopper identity seam validator");

const auth = readFile("packages/auth-core/src/index.ts");
const session = readFile("apps/storefront-runtime/src/lib/session.ts");
const dns = readFile("infrastructure/dns/dns.tf");

for (const fragment of [
  "ShopperIdentityProvider",
  "createHostOnlyShopperIdentityProvider",
  "storefront-host-only",
  "platformSessionReachable: false",
  "hostOnly: true",
  "reservedFutureIssuerHost",
]) {
  reporter.assert(auth.includes(fragment), `auth-core shopper seam missing ${fragment}`);
}

for (const fragment of [
  "createHostOnlyShopperIdentityProvider",
  "ShopperIdentityProvider",
  "provider.cookie.ttlSeconds",
  "provider.verifySessionToken",
]) {
  reporter.assert(session.includes(fragment), `storefront session must consume shopper identity provider fragment ${fragment}`);
}

reporter.assert(dns.includes("shopper_identity_id"), "dns.tf must reserve the future shopper identity host");
reporter.assert(!/Domain=\.letbuyy\.com|Domain=\.letbuyy\.store/.test(session), "storefront shopper cookies must remain host-only");

reporter.finish("shopper identity is behind a host-only auth-core seam");
