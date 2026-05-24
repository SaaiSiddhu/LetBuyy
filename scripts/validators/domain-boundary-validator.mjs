import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Domain boundary validator");

const domainPackages = {
  "packages/shared-types": {
    packageName: "@letbuyy/shared-types",
    requiredExports: ["UuidSchema", "PaginationQuery", "AddressSchema", "ApiResponse", "PaginatedResponse"],
  },
  "packages/tenant-core": {
    packageName: "@letbuyy/tenant-core",
    requiredExports: ["SiteTypeSchema", "SubdomainSchema", "CreateStoreSchema", "StoreModel", "TenantContext"],
  },
  "packages/commerce-core": {
    packageName: "@letbuyy/commerce-core",
    requiredExports: ["CreateProductSchema", "UpdateProductSchema", "CreateCustomerSchema", "Product", "ProductModel"],
  },
  "packages/checkout-core": {
    packageName: "@letbuyy/checkout-core",
    requiredExports: ["CreateOrderSchema", "StorefrontCreateOrderSchema", "VALID_TRANSITIONS", "Order", "CartItem"],
  },
  "packages/auth-core": {
    packageName: "@letbuyy/auth-core",
    requiredExports: ["SignUpSchema", "SignInSchema", "ActorIdentity", "SessionContract", "UserProfile"],
  },
  "packages/theme-engine": {
    packageName: "@letbuyy/theme-engine",
    requiredExports: ["StoreTemplateConfig", "SectionModel", "ThemeRelease", "ThemeEngineRenderContext", "getDefaultStorefrontThemeTemplate"],
  },
  "packages/cms-core": {
    packageName: "@letbuyy/cms-core",
    requiredExports: ["CreatePageSchema", "ReplaceNavigationSchema", "PortfolioProject", "ServiceItem"],
  },
  "packages/event-core": {
    packageName: "@letbuyy/event-core",
    requiredExports: ["DispatchOutboxSchema", "CreateWebhookSubscriptionSchema", "DomainOutboxEvent", "RuntimeEventEnvelope"],
  },
  "packages/notification-core": {
    packageName: "@letbuyy/notification-core",
    requiredExports: ["NotificationDispatchSchema", "NotificationTemplate", "EventNotificationMapping"],
  },
  "packages/search-core": {
    packageName: "@letbuyy/search-core",
    requiredExports: ["SearchQuerySchema", "SearchDocument", "SearchIndexingJob", "RankingPolicy"],
  },
  "packages/billing-core": {
    packageName: "@letbuyy/billing-core",
    requiredExports: ["BillingPlanSchema", "CreateSubscriptionSchema", "SubscriptionContract", "InvoiceDto"],
  },
};

for (const [root, contract] of Object.entries(domainPackages)) {
  const packageJson = readJson(`${root}/package.json`);
  const indexPath = `${root}/src/index.ts`;
  const index = readFile(indexPath);
  const packageSurface = `${index}\n${readFile(`${root}/src/theme-registry.ts`)}`;

  reporter.assert(Boolean(packageJson), `Domain package lacks package manifest: ${root}/package.json`);
  reporter.assert(packageJson?.name === contract.packageName, `Domain package manifest name mismatch: ${root}/package.json`);
  reporter.assert(exists(indexPath), `Domain package lacks public contract export boundary: ${indexPath}`);
  reporter.assert(Boolean(packageJson?.scripts?.typecheck), `Domain package lacks typecheck script: ${root}/package.json`);

  for (const exportName of contract.requiredExports) {
    const exportPattern = new RegExp(`\\b${exportName}\\b`);
    reporter.assert(exportPattern.test(packageSurface), `Domain package missing required public contract ${exportName}: ${indexPath}`);
  }
}

const extractedSchemaFacades = {
  "services/api-gateway/src/schemas/common.schema.ts": "@letbuyy/shared-types",
  "services/api-gateway/src/schemas/product.schema.ts": "@letbuyy/commerce-core",
  "services/api-gateway/src/schemas/customer.schema.ts": "@letbuyy/commerce-core",
  "services/api-gateway/src/schemas/order.schema.ts": "@letbuyy/checkout-core",
  "services/api-gateway/src/schemas/shipping.schema.ts": "@letbuyy/checkout-core",
  "services/api-gateway/src/schemas/coupon.schema.ts": "@letbuyy/checkout-core",
  "services/api-gateway/src/schemas/store.schema.ts": "@letbuyy/tenant-core",
  "services/api-gateway/src/schemas/auth.schema.ts": "@letbuyy/auth-core",
  "services/api-gateway/src/schemas/page.schema.ts": "@letbuyy/cms-core",
  "services/api-gateway/src/schemas/theme.schema.ts": "@letbuyy/theme-engine",
  "services/api-gateway/src/schemas/operations.schema.ts": "@letbuyy/event-core",
};

for (const [file, packageName] of Object.entries(extractedSchemaFacades)) {
  const content = readFile(file);
  reporter.assert(content.includes(`from '${packageName}'`) || content.includes(`from "${packageName}"`), `Extracted schema facade must re-export from ${packageName}: ${file}`);
  reporter.assert(!/\bz\.object\b|\bz\.enum\b|\binterface\s+\w+|\btype\s+\w+\s*=/.test(content), `Extracted schema facade must not define domain contracts locally: ${file}`);
  reporter.assert(!content.includes("./common.schema"), `Extracted schema facade must not rebuild contracts from service-local common schema: ${file}`);
}

const storefrontTypes = readFile("apps/storefront-runtime/src/types/store.ts");
reporter.assert(storefrontTypes.includes("@letbuyy/theme-engine"), "Storefront runtime type facade must consume theme-engine contracts");
reporter.assert(storefrontTypes.includes("@letbuyy/commerce-core"), "Storefront runtime type facade must consume commerce-core contracts");
reporter.assert(storefrontTypes.includes("@letbuyy/checkout-core"), "Storefront runtime type facade must consume checkout-core contracts");
reporter.assert(
  !/\bexport\s+(interface|type)\s+\w+|\bexport\s+const\s+(DEFAULT_THEME_SETTINGS|DEFAULT_NAV_PAGES)\b/.test(storefrontTypes),
  "Storefront runtime must not redefine extracted domain contracts in apps/storefront-runtime/src/types/store.ts",
);

const apiTypesIndex = readFile("packages/typescript/api-types/src/index.ts");
for (const packageName of Object.values(domainPackages).map((contract) => contract.packageName)) {
  reporter.assert(apiTypesIndex.includes(packageName), `API types aggregate must re-export ${packageName}`);
}
reporter.assert(
  !/\bexport\s+(interface|type)\s+\w+|\bexport\s+const\s+\w+Schema\b|\bz\.object\b/.test(apiTypesIndex),
  "packages/typescript/api-types/src/index.ts must stay an aggregate facade, not a domain authority",
);

const apiThemeRegistryFacade = readFile("packages/typescript/api-types/src/theme-registry.ts");
reporter.assert(apiThemeRegistryFacade.includes("@letbuyy/theme-engine"), "API theme registry facade must point to @letbuyy/theme-engine");
reporter.assert(!apiThemeRegistryFacade.includes("SECTION_SCHEMAS:") && !apiThemeRegistryFacade.includes("const heroBanner"), "API theme registry facade must not duplicate theme registry data");

reporter.finish(`${Object.keys(domainPackages).length} domain packages and ${Object.keys(extractedSchemaFacades).length} schema facades checked`);
