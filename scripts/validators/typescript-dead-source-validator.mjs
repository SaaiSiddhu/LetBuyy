import {
  createReporter,
  exists,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("TypeScript dead source validator");
const trackedFiles = getTrackedFiles();

const archivedFiles = [
  [
    "apps/storefront-runtime/src/app/store/[subdomain]/product/[productId]/add-to-cart-button.tsx",
    "docs/archive/dead-code/storefront-runtime/app/product/add-to-cart-button.tsx",
  ],
  [
    "apps/storefront-runtime/src/components/ui/reveal.tsx",
    "docs/archive/dead-code/storefront-runtime/components/ui/reveal.tsx",
  ],
  [
    "apps/storefront-runtime/src/components/ui/badge.tsx",
    "docs/archive/dead-code/storefront-runtime/components/ui/badge.tsx",
  ],
  [
    "apps/storefront-runtime/src/components/policy-page.tsx",
    "docs/archive/dead-code/storefront-runtime/components/policy-page.tsx",
  ],
  [
    "apps/storefront-runtime/src/components/layout/floating-header.tsx",
    "docs/archive/dead-code/storefront-runtime/components/layout/floating-header.tsx",
  ],
  [
    "apps/storefront-runtime/src/components/cart-icon.tsx",
    "docs/archive/dead-code/storefront-runtime/components/cart-icon.tsx",
  ],
  [
    "apps/storefront-runtime/src/components/wishlist/wishlist-button.tsx",
    "docs/archive/dead-code/storefront-runtime/components/wishlist/wishlist-button.tsx",
  ],
  [
    "apps/storefront-runtime/src/components/coming-soon/components/shared/email-signup.tsx",
    "docs/archive/dead-code/storefront-runtime/components/coming-soon/shared/email-signup.tsx",
  ],
  [
    "apps/storefront-runtime/src/components/coming-soon/components/shared/powered-by.tsx",
    "docs/archive/dead-code/storefront-runtime/components/coming-soon/shared/powered-by.tsx",
  ],
  [
    "apps/storefront-runtime/src/components/coming-soon/components/shared/animated-background.tsx",
    "docs/archive/dead-code/storefront-runtime/components/coming-soon/shared/animated-background.tsx",
  ],
  [
    "apps/storefront-runtime/src/components/coming-soon/components/shared/countdown-timer.tsx",
    "docs/archive/dead-code/storefront-runtime/components/coming-soon/shared/countdown-timer.tsx",
  ],
  [
    "apps/merchant-control-plane/src/components/plans/PlanBillingTimeline.tsx",
    "docs/archive/dead-code/merchant-control-plane/components/plans/PlanBillingTimeline.tsx",
  ],
  [
    "apps/merchant-control-plane/src/components/plans/PlanCard.tsx",
    "docs/archive/dead-code/merchant-control-plane/components/plans/PlanCard.tsx",
  ],
  [
    "apps/merchant-control-plane/src/components/plans/ComparePlans.tsx",
    "docs/archive/dead-code/merchant-control-plane/components/plans/ComparePlans.tsx",
  ],
  [
    "apps/merchant-control-plane/src/components/WelcomeScreen.tsx",
    "docs/archive/dead-code/merchant-control-plane/components/WelcomeScreen.tsx",
  ],
  [
    "apps/merchant-control-plane/src/components/SettingsSidebar.tsx",
    "docs/archive/dead-code/merchant-control-plane/components/SettingsSidebar.tsx",
  ],
  [
    "apps/app-marketplace/src/components/HeroSection.tsx",
    "docs/archive/dead-code/app-marketplace/components/HeroSection.tsx",
  ],
  [
    "services/api-gateway/src/schemas/product.schema.ts",
    "docs/archive/dead-code/api-gateway/schemas/product.schema.ts",
  ],
  [
    "services/api-gateway/src/schemas/common.schema.ts",
    "docs/archive/dead-code/api-gateway/schemas/common.schema.ts",
  ],
  [
    "services/api-gateway/src/schemas/shipping.schema.ts",
    "docs/archive/dead-code/api-gateway/schemas/shipping.schema.ts",
  ],
];

for (const [activePath, archivePath] of archivedFiles) {
  reporter.assert(!exists(activePath), `${activePath} must stay out of active source`);
  reporter.assert(exists(archivePath), `${archivePath} must preserve the archived source file`);
}

const forbiddenSpecifiers = [
  "./add-to-cart-button",
  "@/components/ui/reveal",
  "@/components/ui/badge",
  "@/components/policy-page",
  "@/components/layout/floating-header",
  "@/components/cart-icon",
  "@/components/wishlist/wishlist-button",
  "./shared/email-signup",
  "./shared/powered-by",
  "./shared/animated-background",
  "./shared/countdown-timer",
  "@/components/plans/PlanBillingTimeline",
  "@/components/plans/PlanCard",
  "@/components/plans/ComparePlans",
  "@/components/WelcomeScreen",
  "@/components/SettingsSidebar",
  "@/components/HeroSection",
  "../schemas/product.schema",
  "../schemas/common.schema",
  "../schemas/shipping.schema",
  "./product.schema",
  "./common.schema",
  "./shipping.schema",
];

const activeRefs = trackedFiles.filter((file) => {
  if (!/^(apps|services)\//.test(file)) return false;
  if (!/\.(?:ts|tsx)$/.test(file)) return false;
  const source = readFile(file);
  return forbiddenSpecifiers.some((specifier) => source.includes(specifier));
});

reporter.assert(
  activeRefs.length === 0,
  `active source must not import archived TypeScript dead-source files: ${activeRefs.join(", ")}`,
);

reporter.assert(
  exists("apps/merchant-control-plane/src/components/settings/SettingsShell.tsx"),
  "live merchant settings shell must remain active after archiving old SettingsSidebar",
);
reporter.assert(
  exists("apps/storefront-runtime/src/app/store/[subdomain]/product/[productId]/product-details-client.tsx"),
  "live storefront product details client must remain active after archiving old add-to-cart button",
);
reporter.assert(
  exists("services/api-gateway/src/routes/products.ts"),
  "api-gateway product route must remain active after archiving unused schema facade",
);

reporter.finish("verified TypeScript dead-source files are archived outside active source");
