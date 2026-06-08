import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Storefront SEO access validator");

const proxy = readFile("apps/storefront-runtime/src/proxy.ts");
const seo = readFile("apps/storefront-runtime/src/lib/seo.ts");
const robots = readFile("apps/storefront-runtime/src/app/robots.ts");
const sitemap = readFile("apps/storefront-runtime/src/app/sitemap.ts");
const layout = readFile("apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx");

reporter.assert(seo.includes("isStorefrontIndexable"), "SEO helper must expose a single storefront indexability predicate");
reporter.assert(
  seo.includes("accessMode") && seo.includes("published !== false") && seo.includes("customDomainStatus === 'active'"),
  "SEO helper must account for access mode, published flag, and active custom domains",
);
reporter.assert(
  robots.includes("resolveStorefrontAccessContext") && robots.includes("isStorefrontIndexable") && robots.includes("'/preview/'"),
  "robots.ts must resolve host access context, noindex gated stores, and disallow preview paths",
);
reporter.assert(
  sitemap.includes("resolveStorefrontAccessContext") && sitemap.includes("isStorefrontIndexable"),
  "sitemap.ts must suppress gated or unpublished storefronts",
);
reporter.assert(
  layout.includes("robots: { index: false, follow: false }") && layout.includes("isStorefrontIndexable"),
  "store layout metadata must noindex coming-soon and gated storefronts",
);
reporter.assert(
  proxy.includes("NextResponse.redirect") && proxy.includes("site.custom_domain_status === 'active'") && proxy.includes("301"),
  "proxy must 301 live .store subdomains to an active custom domain",
);
reporter.assert(
  proxy.includes("x-letbuyy-preview-checkout-mode") && proxy.includes("noIndex(response)"),
  "preview traffic must remain noindex and test-mode only",
);

reporter.finish("storefront robots, sitemap, metadata, and redirects honor access state");
