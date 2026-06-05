import {
  createReporter,
  exists,
  listWorkspaceFiles,
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
    requiredExports: ["SiteTypeSchema", "SubdomainSchema", "CreateStoreSchema", "RuntimeTenantContext", "StoreModel", "TenantContext", "validateSubdomainFormat"],
  },
  "packages/app-engine": {
    packageName: "@letbuyy/app-engine",
    requiredExports: ["GenerateContentSchema", "GenerateImageSchema", "AiChatSchema", "CheckCreditsSchema"],
  },
  "packages/commerce-core": {
    packageName: "@letbuyy/commerce-core",
    requiredExports: ["CreateProductSchema", "UpdateProductSchema", "CreateCategorySchema", "CreateLocationSchema", "CreateCustomerSchema", "Product", "ProductModel"],
  },
  "packages/checkout-core": {
    packageName: "@letbuyy/checkout-core",
    requiredExports: ["CreateOrderSchema", "StorefrontCreateOrderSchema", "VALID_TRANSITIONS", "Order", "CartItem"],
  },
  "packages/payments": {
    packageName: "@letbuyy/payments",
    requiredExports: ["PaymentProvider", "PaymentCreateIntentInput", "PaymentIntentResult", "PaymentWebhookVerificationResult", "toInrMinorUnits", "normalizeIdempotencyKey"],
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
    requiredExports: ["BillingPlanSchema", "CreateSubscriptionSchema", "CreateSubscriptionOrderSchema", "SubscriptionContract", "InvoiceDto"],
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
  "services/api-gateway/src/schemas/onboarding.schema.ts": "@letbuyy/tenant-core",
  "services/api-gateway/src/schemas/auth.schema.ts": "@letbuyy/auth-core",
  "services/api-gateway/src/schemas/page.schema.ts": "@letbuyy/cms-core",
  "services/api-gateway/src/schemas/blog.schema.ts": "@letbuyy/cms-core",
  "services/api-gateway/src/schemas/form-submission.schema.ts": "@letbuyy/cms-core",
  "services/api-gateway/src/schemas/media.schema.ts": "@letbuyy/cms-core",
  "services/api-gateway/src/schemas/review.schema.ts": "@letbuyy/commerce-core",
  "services/api-gateway/src/schemas/ai.schema.ts": "@letbuyy/app-engine",
  "services/api-gateway/src/schemas/theme.schema.ts": "@letbuyy/theme-engine",
  "services/api-gateway/src/schemas/operations.schema.ts": "@letbuyy/event-core",
};

for (const [file, packageName] of Object.entries(extractedSchemaFacades)) {
  const content = readFile(file);
  reporter.assert(content.includes(`from '${packageName}'`) || content.includes(`from "${packageName}"`), `Extracted schema facade must re-export from ${packageName}: ${file}`);
  reporter.assert(!/\bz\.object\b|\bz\.enum\b|\binterface\s+\w+|\btype\s+\w+\s*=/.test(content), `Extracted schema facade must not define domain contracts locally: ${file}`);
  reporter.assert(!content.includes("./common.schema"), `Extracted schema facade must not rebuild contracts from service-local common schema: ${file}`);
}

reporter.assert(!exists("apps/storefront-runtime/src/types/store.ts"), "Storefront runtime must not keep a local domain type facade");
const storefrontSourceFiles = listWorkspaceFiles(["apps/storefront-runtime/src"]).filter((file) => /\.(ts|tsx)$/.test(file));
for (const file of storefrontSourceFiles) {
  reporter.assert(!readFile(file).includes("@/types/store"), `Storefront source must import domain contracts directly, not through @/types/store: ${file}`);
}
reporter.assert(
  readFile("apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts").includes("@letbuyy/theme-engine") &&
    readFile("apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts").includes("@letbuyy/commerce-core") &&
    readFile("apps/storefront-runtime/src/lib/store-service.ts").includes("@letbuyy/tenant-core"),
  "Storefront runtime must consume extracted domain contracts directly from owning packages",
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

const runtimeRouteSchemaAuthorities = [
  "services/api-gateway/src/routes/categories.ts",
  "services/api-gateway/src/routes/inventory.ts",
  "services/api-gateway/src/routes/payments.ts",
  "services/api-gateway/src/routes/products.ts",
];

for (const file of runtimeRouteSchemaAuthorities) {
  const content = readFile(file);
  reporter.assert(
    !/\b(?:const|let|var)\s+\w+Schema\s*=\s*z(?:od)?\.(?:object|enum)\b/.test(content),
    `Runtime route must not define reusable domain schemas locally: ${file}`,
  );
}

const productService = readFile("services/api-gateway/src/execution/product-execution.adapter.ts");
reporter.assert(productService.includes("@letbuyy/commerce-core"), "Product service command contracts must come from @letbuyy/commerce-core");
reporter.assert(!/\binterface\s+CreateProductInput\b|\binterface\s+ProductVariantInput\b|\binterface\s+ProductOptionInput\b/.test(productService), "Product service must not own commerce command interfaces locally");

const orderService = readFile("services/api-gateway/src/execution/order-execution.adapter.ts");
reporter.assert(orderService.includes("@letbuyy/checkout-core"), "Order service command contracts must come from @letbuyy/checkout-core");
reporter.assert(!/\binterface\s+(CreateOrderInput|FulfillOrderInput|RefundOrderInput|CompleteRefundInput|OrderItem|RefundLine|FulfillmentLine)\b/.test(orderService), "Order service must not own checkout command interfaces locally");

const tenantContext = readFile("services/api-gateway/src/lib/tenant-context.ts");
reporter.assert(tenantContext.includes("@letbuyy/tenant-core"), "Tenant runtime context contract must come from @letbuyy/tenant-core");
reporter.assert(!/\bexport\s+interface\s+TenantContext\b/.test(tenantContext), "API gateway must not redefine the runtime tenant context contract");

const authRoute = readFile("services/api-gateway/src/routes/auth.ts");
reporter.assert(authRoute.includes("@letbuyy/tenant-core"), "Auth route must consume tenant-core subdomain governance");
reporter.assert(!/\bRESERVED_SUBDOMAINS\b|\bSUBDOMAIN_REGEX\b|\bfunction\s+validateSubdomainFormat\b/.test(authRoute), "Auth route must not redefine tenant subdomain validation");

reporter.assert(!exists("apps/theme-marketplace/src/types/index.ts"), "Theme marketplace must not own a local theme type facade");

const themeMarketplaceCard = readFile("apps/theme-marketplace/src/components/theme-card.tsx");
reporter.assert(themeMarketplaceCard.includes("@letbuyy/theme-engine"), "Theme marketplace presentation must consume theme-engine contracts directly");
reporter.assert(!themeMarketplaceCard.includes("@/types"), "Theme marketplace presentation must not consume app-local theme DTOs");

const themeMarketplaceService = readFile("apps/theme-marketplace/src/lib/theme-service.ts");
reporter.assert(themeMarketplaceService.includes("@letbuyy/theme-engine"), "Theme marketplace service query contracts must consume theme-engine contracts");
reporter.assert(!/\bexport\s+interface\s+Theme(SearchResult|Filters)\b/.test(themeMarketplaceService), "Theme marketplace service must not define reusable theme query DTOs locally");

const appApiOwnershipDoc = readFile("docs/governance/app-api-route-ownership.md");
reporter.assert(appApiOwnershipDoc.includes("P4-4 API Ownership Consolidation"), "App API route ownership governance doc must declare P4-4 authority");
reporter.assert(appApiOwnershipDoc.includes("gateway-proxy"), "App API route ownership governance doc must classify gateway-proxy routes");
reporter.assert(appApiOwnershipDoc.includes("app-local-session"), "App API route ownership governance doc must classify app-local session routes");
reporter.assert(appApiOwnershipDoc.includes("blocked-local-safety"), "App API route ownership governance doc must classify blocked local safety routes");

const appApiRoutes = listWorkspaceFiles(["apps"])
  .filter((file) => /^apps\/[^/]+\/src\/app\/api\/.+\/route\.ts$/.test(file))
  .sort();

function classifyAppApiRoute(file) {
  if (file.startsWith("apps/identity-platform/src/app/api/auth/")) return "app-local-auth";
  if (file.startsWith("apps/identity-platform/src/app/api/email/")) return "identity-gateway-proxy";
  if (file.startsWith("apps/platform-console/src/app/api/console-auth/")) return "app-local-operator-auth";
  if (file === "apps/merchant-control-plane/src/app/api/auth/logout/route.ts") return "app-local-session";
  if (file.startsWith("apps/merchant-control-plane/src/app/api/")) return "gateway-proxy";
  if (file.startsWith("apps/app-marketplace/src/app/api/")) return "gateway-proxy";
  if (file.startsWith("apps/theme-marketplace/src/app/api/")) return "gateway-proxy";
  if (file === "apps/storefront-runtime/src/app/api/customer/session/route.ts") return "app-local-session";
  if (file === "apps/storefront-runtime/src/app/api/customer/logout/route.ts") return "app-local-session";
  if (file === "apps/storefront-runtime/src/app/api/seed/route.ts") return "blocked-local-safety";
  if (file === "apps/storefront-runtime/src/app/api/themes/install/route.ts") return "blocked-local-safety";
  if (file.startsWith("apps/storefront-runtime/src/app/api/")) return "gateway-proxy";
  return null;
}

const routeOwnershipCounts = new Map();
for (const file of appApiRoutes) {
  const classification = classifyAppApiRoute(file);
  reporter.assert(Boolean(classification), `App-local API route lacks ownership classification: ${file}`);
  routeOwnershipCounts.set(classification, (routeOwnershipCounts.get(classification) || 0) + 1);
}

reporter.assert(appApiRoutes.length === 115, `App-local API route inventory changed without updating P4-4 classification: expected 115, found ${appApiRoutes.length}`);

function appLocalOwnershipForFile(file) {
  if (/^apps\/[^/]+\/src\/app\/api\/.+\/route\.ts$/.test(file)) {
    return classifyAppApiRoute(file);
  }
  if (file.startsWith("apps/identity-platform/src/lib/")) return "app-local-auth";
  if (file === "apps/platform-console/src/lib/console-auth-server.ts") return "app-local-operator-auth";
  return null;
}

function isAuthOwnedLocalFile(file) {
  const ownership = appLocalOwnershipForFile(file);
  return ownership === "app-local-auth" || ownership === "app-local-operator-auth";
}

const appApiAndLibFiles = listWorkspaceFiles(["apps"])
  .filter((file) => /^apps\/[^/]+\/src\/(?:app\/api|lib)\//.test(file) && /\.(ts|tsx)$/.test(file))
  .sort();

const directDbOrProviderMutationPattern =
  /from\s+['"]@supabase\/|from\s+['"][^'"]*\/supabase(?:['"]|\/)|\bSUPABASE_SERVICE_ROLE\b|\bservice_role\b|\bcreateServerClient\b|\bcreateClient\s*\(|\.from\s*\(\s*['"`]|\bprisma\.|\bdrizzle\b|\bsql`/;
const appLocalCommerceLogicPattern =
  /\borderTotal\b|\border_total\b|\bupdateCustomerStats\b|\binventory.*(?:decrement|increment)\b/i;
const appLocalCredentialStoragePattern = /\bpassword_hash\b/i;
const appLocalProviderSignaturePattern = /\brazorpay_signature\b|\bstripe\.webhooks\b|\bcreateHmac\b|\btimingSafeEqual\b/i;

for (const file of appApiAndLibFiles) {
  const content = readFile(file);
  reporter.assert(!directDbOrProviderMutationPattern.test(content), `App-local API/lib file must not access databases or provider mutation SDKs directly: ${file}`);
  reporter.assert(!appLocalCommerceLogicPattern.test(content), `App-local API/lib file must not own commerce/payment/customer mutation logic: ${file}`);
  reporter.assert(!appLocalCredentialStoragePattern.test(content), `App-local API/lib file must not handle password hashes in app-local API/lib files: ${file}`);
  reporter.assert(!appLocalProviderSignaturePattern.test(content) || isAuthOwnedLocalFile(file), `App-local API/lib file must not verify provider signatures outside auth-owned routes: ${file}`);
}

const storefrontRoutesUsingCustomerService = appApiRoutes.filter((file) => readFile(file).includes("@/lib/customer-service"));
reporter.assert(
  storefrontRoutesUsingCustomerService.length === 0,
  `Storefront app API routes must call the typed gateway client directly, not customer-service helpers: ${storefrontRoutesUsingCustomerService.join(", ")}`,
);

const allowedOrderPresentationAdapters = new Set([
  "apps/storefront-runtime/src/app/api/orders/check/route.ts",
  "apps/storefront-runtime/src/app/api/orders/login/route.ts",
  "apps/storefront-runtime/src/app/api/orders/set-password/route.ts",
]);
const appRoutesUsingOrderService = appApiRoutes.filter((file) => readFile(file).includes("@/lib/order-service"));
for (const file of appRoutesUsingOrderService) {
  reporter.assert(
    allowedOrderPresentationAdapters.has(file),
    `Only the classified storefront order lookup adapter may import order-service; use the typed gateway client instead: ${file}`,
  );
}
reporter.assert(appRoutesUsingOrderService.length === allowedOrderPresentationAdapters.size, "Classified storefront order lookup adapter inventory changed; update P4-4 ownership governance");

const mobileMerchantModelFacades = [
  "apps/mobile/merchant-app/lib/models/order_model.dart",
  "apps/mobile/merchant-app/lib/models/store_auth_request_model.dart",
  "apps/mobile/merchant-app/lib/models/store_model.dart",
  "apps/mobile/merchant-app/lib/models/store_theme_model.dart",
  "apps/mobile/merchant-app/lib/models/theme_editor_models.dart",
];

for (const file of mobileMerchantModelFacades) {
  const content = readFile(file);
  reporter.assert(content.includes("package:letbuyy_models/merchant_contracts.dart"), `Mobile merchant model file must be a shared package facade: ${file}`);
  reporter.assert(!/\b(class|enum)\s+\w+/.test(content), `Mobile merchant app must not define shared model classes locally: ${file}`);
}

reporter.finish(`${Object.keys(domainPackages).length} domain packages, ${Object.keys(extractedSchemaFacades).length} schema facades, and ${appApiRoutes.length} app API route ownership records checked`);
