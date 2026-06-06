export type CapabilityStatus = "available" | "partial" | "planned" | "skip";

export interface EvidenceSource {
  label: string;
  path: string;
}

export interface EndpointDoc {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  auth: "public" | "merchant session" | `app bearer${string}` | "internal" | "HMAC signature";
  status: CapabilityStatus;
  summary: string;
  source: string;
}

export interface GuideStep {
  title: string;
  body: string;
  source: string;
}

export interface SkipItem {
  title: string;
  reason: string;
}

export interface ContractCard {
  title: string;
  status: CapabilityStatus;
  source: string;
  points: string[];
}

export interface GatewayRouteGroup {
  surface: string;
  mount: string;
  access: string;
  routeCount: number;
  scope: string;
  source: string;
}

export interface SchemaFacade {
  module: string;
  routeSurface: string;
  canonicalSource: string;
  currentExports: string;
  developerMeaning: string;
  source: string;
}

export interface GatewayResponseContract {
  responseCase: string;
  currentShape: string;
  developerHandling: string;
  source: string;
}

export interface PaymentSafetyDoc {
  surface: string;
  currentContract: string;
  developerHandling: string;
  source: string;
}

export interface AppQualityGateDoc {
  check: string;
  currentRule: string;
  evidenceFields: string;
  source: string;
}

export interface WebhookTopicDoc {
  topic: string;
  category: "lifecycle" | "mandatory compliance";
  deliveryRule: string;
  partnerAction: string;
  source: string;
}

export interface WebhookDeliveryRuleDoc {
  rule: string;
  currentBehavior: string;
  developerAction: string;
  source: string;
}

export interface OAuthScopeDoc {
  scope: string;
  currentUse: string;
  bridgeAccess: string;
  notes: string;
  source: string;
}

export interface OAuthTokenLifecycleDoc {
  surface: string;
  currentContract: string;
  developerAction: string;
  source: string;
}

export interface AppBridgeFetchRuleDoc {
  rule: string;
  currentContract: string;
  developerAction: string;
  source: string;
}

export interface DashboardSurfaceDoc {
  label: string;
  route: string;
  auth: string;
  status: CapabilityStatus;
  currentPayload: string;
  source: string;
}

export interface SdkContractRow {
  item: string;
  currentContract: string;
  notes: string;
  source: string;
}

export interface ToolingGapDoc {
  capability: string;
  currentStatus: string;
  blockedUntil: string;
  source: string;
}

export interface DocumentationExample {
  title: string;
  description: string;
  source: string;
  code: string;
}

export const evidenceSources: EvidenceSource[] = [
  {
    label: "Gateway middleware and /v1 routing",
    path: "services/api-gateway/src/index.ts"
  },
  {
    label: "App marketplace, OAuth, app bridge, developer routes",
    path: "services/api-gateway/src/routes/app-store.ts"
  },
  {
    label: "App scopes, embed surface, app blocks, webhook topics",
    path: "packages/app-engine/src/index.ts"
  },
  {
    label: "Theme package JSON-contract schema",
    path: "packages/theme-engine/src/theme-bundle.ts"
  },
  {
    label: "Theme catalog, editor, package upload routes",
    path: "services/api-gateway/src/routes/themes.ts"
  },
  {
    label: "LetBuyy webhook HMAC delivery",
    path: "services/webhook-service/src/app-lifecycle-dispatch.ts"
  },
  {
    label: "Webhook retry dispatcher and provider handlers",
    path: "services/webhook-service/src/index.ts"
  }
];

export const gatewayFacts = [
  "The public gateway mounts API routes under /v1 and exposes /health plus /v1/health.",
  "Global middleware sets security headers, request IDs, input validation, sanitized errors, observability, CORS, API versioning, query-cost rate limits, auth middleware, CSRF protection, and standard rate limits.",
  "Public /v1 routes currently include auth, contacts, storefront, themes, app-store, and internal console. Most commerce mutations remain protected by merchant auth and CSRF.",
  "CORS exposes X-Request-ID, X-Trace-ID, X-RateLimit-* headers, X-LetBuyy-API-Version, and X-Response-Time."
];

export const gatewayResponseContracts: GatewayResponseContract[] = [
  {
    responseCase: "Standard success envelope",
    currentShape: "{ success: true, data, ...meta }",
    developerHandling: "Use data as the payload. Extra top-level metadata can appear when a route passes helper metadata.",
    source: "services/api-gateway/src/lib/supabase.ts:32"
  },
  {
    responseCase: "Paginated success envelope",
    currentShape: "{ success: true, data, meta: { page, per_page, total, total_pages, has_next, has_prev } }",
    developerHandling: "Read list navigation from meta; page and limit come from route query validation where present.",
    source: "services/api-gateway/src/lib/supabase.ts:39"
  },
  {
    responseCase: "Helper error envelope",
    currentShape: "{ success: false, error: { code, message, status } }",
    developerHandling: "Use HTTP status as authority and read error.code for programmatic branching.",
    source: "services/api-gateway/src/lib/supabase.ts:58"
  },
  {
    responseCase: "Compatibility error bodies",
    currentShape: "{ error: { code, message } } or { success: false, error: { code, message } }",
    developerHandling: "Some helpers omit success, so clients should branch on the error object and status instead of relying only on success=false.",
    source: "services/api-gateway/src/lib/supabase.ts:70"
  },
  {
    responseCase: "Typed application errors",
    currentShape: "{ error: { code, message, details? } } with the AppError status code",
    developerHandling: "Known validation, not-found, forbidden, conflict, and stock errors are sanitized by the global handler.",
    source: "services/api-gateway/src/lib/errors.ts:66 + services/api-gateway/src/index.ts:233"
  },
  {
    responseCase: "Unexpected internal errors",
    currentShape: "{ error: { code: \"INTERNAL_ERROR\", message: \"An internal error occurred\", request_id } }",
    developerHandling: "Full details stay server-side; use request_id for support and trace correlation.",
    source: "services/api-gateway/src/index.ts:238"
  },
  {
    responseCase: "Request correlation headers",
    currentShape: "X-Request-ID, X-Trace-ID, X-RateLimit-*, X-LetBuyy-API-Version, X-Response-Time",
    developerHandling: "Send X-Request-ID for deterministic tracing; the gateway creates one if absent and exposes it through CORS.",
    source: "services/api-gateway/src/index.ts:149 + services/api-gateway/src/middleware/security.ts:282"
  }
];

export const paymentSafetyContracts: PaymentSafetyDoc[] = [
  {
    surface: "Protected order mutations",
    currentContract: "PATCH /v1/orders/:id plus order create, fulfill, refund, and refund-complete routes begin an IdempotencyExecutionAdapter claim with idempotency_key and replay stored responses.",
    developerHandling: "Send a stable idempotency_key for each retryable mutation. Keys are validated at 8-200 characters by checkout-core schemas.",
    source: "services/api-gateway/src/routes/orders.ts:345 + packages/checkout-core/src/index.ts:26"
  },
  {
    surface: "Protected order creation price authority",
    currentContract: "POST /v1/orders accepts product/variant IDs, quantity, shipping, coupon, gift-card, and payment method fields; the route delegates creation to the order execution adapter instead of accepting client totals.",
    developerHandling: "Do not send totals as authority. The gateway/service path owns order pricing and emits order.created after creation.",
    source: "services/api-gateway/src/routes/orders.ts:387 + packages/checkout-core/src/index.ts:26"
  },
  {
    surface: "Protected Razorpay order start",
    currentContract: "POST /v1/payments/razorpay/order loads the payable order, computes minor units from order.total, rejects AMOUNT_MISMATCH when a client amount hint differs, and stores an idempotent payment order response.",
    developerHandling: "Treat amount and amount_minor_units as optional consistency hints only; refresh checkout on AMOUNT_MISMATCH.",
    source: "services/api-gateway/src/routes/payments.ts:673"
  },
  {
    surface: "Protected Razorpay verification",
    currentContract: "POST /v1/payments/razorpay/verify checks order ownership, blocks already-paid orders, validates the HMAC payload razorpay_order_id|razorpay_payment_id, and confirms payment with idempotency_key.",
    developerHandling: "Submit provider IDs, signature, order_id, and idempotency_key; handle CONFLICT when the payment is already verified or the reference mismatches.",
    source: "services/api-gateway/src/routes/payments.ts:773"
  },
  {
    surface: "Protected Stripe checkout",
    currentContract: "POST /v1/payments/stripe/checkout loads the payable order, derives the Stripe amount from order.total, passes idempotency_key to the Stripe adapter, and stores the payment reference.",
    developerHandling: "Use the returned session URL/ID and do not derive payable totals in the client.",
    source: "services/api-gateway/src/routes/payments.ts:842"
  },
  {
    surface: "Storefront provider starts",
    currentContract: "Storefront Razorpay, Cashfree, Stripe, and PayPal start routes load the published store order, require supported INR amounts, create provider intents, and complete idempotency claims.",
    developerHandling: "Pass idempotencyKey and orderId. Provider-specific response fields are real, but public SDK wrappers are still [SKIP — NEEDS BACKEND/SDK].",
    source: "services/api-gateway/src/routes/storefront.ts:1663 + :1901 + :2145 + :2250"
  },
  {
    surface: "Storefront amount mismatch",
    currentContract: "Storefront Razorpay and Cashfree starts accept optional amount hints and reject mismatches against the server-computed amount with AMOUNT_MISMATCH.",
    developerHandling: "Use amount hints for stale-checking only; rebuild the checkout from the latest order payload when the gateway rejects a mismatch.",
    source: "services/api-gateway/src/routes/storefront.ts:1697 + :1936"
  },
  {
    surface: "Storefront provider verification and capture",
    currentContract: "Storefront Razorpay verification, Cashfree verification, and PayPal capture use idempotencyKey, check provider references, confirm payment, emit order paid, and replay completed responses.",
    developerHandling: "Keep provider reference IDs bound to the order and retry verification/capture with the same idempotencyKey after transient provider failures.",
    source: "services/api-gateway/src/routes/storefront.ts:1816 + :2063 + :2394"
  },
  {
    surface: "Checkout schema key casing",
    currentContract: "Protected merchant order/payment schemas use idempotency_key; storefront schemas use idempotencyKey for order, provider start, verify, checkout, and capture flows.",
    developerHandling: "Match the exact route casing. The portal should not normalize casing for developers until an SDK layer exists.",
    source: "packages/checkout-core/src/index.ts:26 + :69 + :84 + :92 + :105"
  }
];

export const appQualityGateChecks: AppQualityGateDoc[] = [
  {
    check: "Submission contract",
    currentRule: "Required fields are name, tagline, description, category_id, app_url, and privacy_url or privacy_policy_url. slug is generated from slug or name.",
    evidenceFields: "name, tagline, description, category_id, app_url, privacy_url, privacy_policy_url, slug",
    source: "packages/app-engine/src/index.ts:753"
  },
  {
    check: "Evidence aliases",
    currentRule: "Built-for-LetBuyy evidence is parsed from quality_gate, built_for_letbuyy, or builtForLetBuyy. The gate runs only when evidence exists and save_as_draft is not true.",
    evidenceFields: "quality_gate, built_for_letbuyy, builtForLetBuyy, save_as_draft",
    source: "packages/app-engine/src/index.ts:779"
  },
  {
    check: "Performance",
    currentRule: "Lighthouse performance score must be at least 70 before listing.",
    evidenceFields: "performance_score, performanceScore, lighthouse_performance",
    source: "packages/app-engine/src/index.ts:666"
  },
  {
    check: "Reviews",
    currentRule: "At least one qualifying published review and rating average of 4.0 or higher are required for the badge gate.",
    evidenceFields: "review_count, reviews_count, rating_avg, average_rating, avg_rating",
    source: "packages/app-engine/src/index.ts:669 + services/api-gateway/src/routes/app-store.ts:623"
  },
  {
    check: "Installs",
    currentRule: "At least one successful install signal is required for the badge gate.",
    evidenceFields: "install_count, installs",
    source: "packages/app-engine/src/index.ts:671 + services/api-gateway/src/routes/app-store.ts:1617"
  },
  {
    check: "Storefront app block",
    currentRule: "At least one extension must be typed storefront_block, app-block, or app_block.",
    evidenceFields: "app_extensions, extensions, app_blocks",
    source: "packages/app-engine/src/index.ts:654"
  },
  {
    check: "Privacy and app URLs",
    currentRule: "App and privacy URLs must be HTTPS. localhost and 127.0.0.1 HTTP are accepted only for local testing.",
    evidenceFields: "privacy_policy_url, privacy_url, app_url, embedded_url, website_url",
    source: "packages/app-engine/src/index.ts:640 + :673"
  },
  {
    check: "Failure behavior",
    currentRule: "A non-draft submission with failed evidence returns a validation error naming the failed check keys. Draft submissions store as draft and skip the gate.",
    evidenceFields: "failed check keys, save_as_draft",
    source: "packages/app-engine/src/index.ts:789 + :808"
  },
  {
    check: "Review record",
    currentRule: "Non-draft submissions create a marketplace review record with schema_validation, developer_profile, and built_for_letbuyy_quality_gate automated checks, then emit app.submitted.",
    evidenceFields: "marketplace_review_records, automated_checks, app.submitted",
    source: "services/api-gateway/src/routes/app-store.ts:2130"
  }
];

export const gatewayRouteGroups: GatewayRouteGroup[] = [
  {
    surface: "Auth",
    mount: "/v1/auth",
    access: "Public mount with auth rate limit",
    routeCount: 23,
    scope: "Custom session, signup/signin, OTP, password, trusted device, and token helpers.",
    source: "services/api-gateway/src/index.ts:178 + routes/auth.ts"
  },
  {
    surface: "Contacts",
    mount: "/v1/contacts",
    access: "Public",
    routeCount: 2,
    scope: "Public contact submission and retrieval helpers.",
    source: "services/api-gateway/src/index.ts:179 + routes/contacts.ts"
  },
  {
    surface: "Storefront",
    mount: "/v1/storefront",
    access: "Public",
    routeCount: 57,
    scope: "Tenant lookup, public catalog, checkout payment starts/verifications, customer account, reviews, pages, policies, blog, and contact flows.",
    source: "services/api-gateway/src/index.ts:180 + routes/storefront.ts"
  },
  {
    surface: "Themes",
    mount: "/v1/themes",
    access: "Public mount with merchant flows",
    routeCount: 18,
    scope: "Catalog, theme schema, editor draft/publish, preview sessions, package upload, and install flows.",
    source: "services/api-gateway/src/index.ts:181 + routes/themes.ts"
  },
  {
    surface: "App marketplace",
    mount: "/v1/app-store",
    access: "Public mount with merchant/app token flows",
    routeCount: 22,
    scope: "Marketplace listing, OAuth, installs, bridge fetch, developer registration, submissions, charges, and partner dashboard surfaces.",
    source: "services/api-gateway/src/index.ts:182 + routes/app-store.ts"
  },
  {
    surface: "Internal console",
    mount: "/v1/internal/console",
    access: "Internal token",
    routeCount: 9,
    scope: "Internal console bootstrap and platform-console helper endpoints.",
    source: "services/api-gateway/src/index.ts:183 + routes/internal-console.ts"
  },
  {
    surface: "Stores",
    mount: "/v1/stores",
    access: "Protected merchant session + CSRF",
    routeCount: 10,
    scope: "Store listing, handle lookup, create/update/publish/delete, and payment config.",
    source: "services/api-gateway/src/index.ts:191 + routes/stores.ts"
  },
  {
    surface: "Products",
    mount: "/v1/products",
    access: "Protected merchant session + CSRF",
    routeCount: 10,
    scope: "Products, collections, gift cards, create/update/delete, and bulk product actions.",
    source: "services/api-gateway/src/index.ts:192 + routes/products.ts"
  },
  {
    surface: "Orders",
    mount: "/v1/orders",
    access: "Protected merchant session + CSRF",
    routeCount: 7,
    scope: "Order list/detail, status updates, creation, fulfillment, refund request, and refund completion.",
    source: "services/api-gateway/src/index.ts:193 + routes/orders.ts"
  },
  {
    surface: "Payments",
    mount: "/v1/payments",
    access: "Protected merchant session + CSRF",
    routeCount: 9,
    scope: "Plans, subscription state/history, subscription order/verify/cancel, Razorpay, and Stripe checkout.",
    source: "services/api-gateway/src/index.ts:194 + routes/payments.ts"
  },
  {
    surface: "Uploads",
    mount: "/v1/upload",
    access: "Protected merchant session + CSRF",
    routeCount: 2,
    scope: "Upload helpers for merchant runtime assets.",
    source: "services/api-gateway/src/index.ts:195 + routes/upload.ts"
  },
  {
    surface: "Portfolio",
    mount: "/v1/portfolio",
    access: "Protected merchant session + CSRF; legacy site types only",
    routeCount: 4,
    scope: "Legacy portfolio content for existing sites. New portfolio acquisition is gated by LETBUYY_ENABLE_LEGACY_SITE_TYPES.",
    source: "services/api-gateway/src/index.ts:196 + routes/portfolio.ts"
  },
  {
    surface: "Resume",
    mount: "/v1/resume",
    access: "Protected merchant session + CSRF; legacy site types only",
    routeCount: 10,
    scope: "Legacy resume profile, experience, education, skills, projects, and related page data for existing sites. New resume acquisition is gated by LETBUYY_ENABLE_LEGACY_SITE_TYPES.",
    source: "services/api-gateway/src/index.ts:197 + routes/resume.ts"
  },
  {
    surface: "Employees",
    mount: "/v1/employees",
    access: "Protected merchant session + CSRF",
    routeCount: 10,
    scope: "Employee records, invitations, permissions, and team management.",
    source: "services/api-gateway/src/index.ts:198 + routes/employee.ts"
  },
  {
    surface: "Admin",
    mount: "/v1/admin",
    access: "Protected merchant session + CSRF",
    routeCount: 12,
    scope: "Admin dashboard, metrics, and operational merchant helper endpoints.",
    source: "services/api-gateway/src/index.ts:199 + routes/admin.ts"
  },
  {
    surface: "Blog",
    mount: "/v1/blog",
    access: "Protected merchant session + CSRF",
    routeCount: 13,
    scope: "Blog posts, categories, tags, publishing, and content management.",
    source: "services/api-gateway/src/index.ts:200 + routes/blog.ts"
  },
  {
    surface: "Customers",
    mount: "/v1/customers",
    access: "Protected merchant session + CSRF",
    routeCount: 6,
    scope: "Customer list/detail and customer address CRUD by email.",
    source: "services/api-gateway/src/index.ts:201 + routes/customers.ts"
  },
  {
    surface: "Notifications",
    mount: "/v1/notifications",
    access: "Protected merchant session + CSRF",
    routeCount: 9,
    scope: "Notification preferences, templates, sending, and inbox-style state.",
    source: "services/api-gateway/src/index.ts:202 + routes/notifications.ts"
  },
  {
    surface: "Media",
    mount: "/v1/media",
    access: "Protected merchant session + CSRF",
    routeCount: 4,
    scope: "Media list, create, update, and delete operations.",
    source: "services/api-gateway/src/index.ts:203 + routes/media.ts"
  },
  {
    surface: "AI",
    mount: "/v1/ai",
    access: "Protected merchant session + CSRF",
    routeCount: 5,
    scope: "Merchant AI helper endpoints.",
    source: "services/api-gateway/src/index.ts:204 + routes/ai.ts"
  },
  {
    surface: "Export",
    mount: "/v1/export",
    access: "Protected merchant session + CSRF",
    routeCount: 3,
    scope: "Export job helpers.",
    source: "services/api-gateway/src/index.ts:205 + routes/export.ts"
  },
  {
    surface: "Shipping and tax",
    mount: "/v1/shipping-tax",
    access: "Protected merchant session + CSRF",
    routeCount: 12,
    scope: "Shipping zones, shipping rates, and tax rates.",
    source: "services/api-gateway/src/index.ts:206 + routes/shipping-tax.ts"
  },
  {
    surface: "Onboarding",
    mount: "/v1/onboarding",
    access: "Protected merchant session + CSRF",
    routeCount: 6,
    scope: "Merchant onboarding progress and setup steps.",
    source: "services/api-gateway/src/index.ts:207 + routes/onboarding.ts"
  },
  {
    surface: "Inventory",
    mount: "/v1/inventory",
    access: "Protected merchant session + CSRF",
    routeCount: 15,
    scope: "Locations, suppliers, purchase orders, transfers, levels, adjustments, bulk adjustments, and history.",
    source: "services/api-gateway/src/index.ts:208 + routes/inventory.ts"
  },
  {
    surface: "Coupons",
    mount: "/v1/coupons",
    access: "Protected merchant session + CSRF",
    routeCount: 6,
    scope: "Coupon list/create/detail/update/delete and validation.",
    source: "services/api-gateway/src/index.ts:209 + routes/coupons.ts"
  },
  {
    surface: "Categories",
    mount: "/v1/categories",
    access: "Protected merchant session + CSRF",
    routeCount: 5,
    scope: "Category list/create/detail/update/delete.",
    source: "services/api-gateway/src/index.ts:210 + routes/categories.ts"
  },
  {
    surface: "Analytics",
    mount: "/v1/analytics",
    access: "Protected merchant session + CSRF",
    routeCount: 4,
    scope: "Dashboard, revenue, top products, and order analytics.",
    source: "services/api-gateway/src/index.ts:211 + routes/analytics.ts"
  },
  {
    surface: "Reviews",
    mount: "/v1/reviews",
    access: "Protected merchant session + CSRF",
    routeCount: 3,
    scope: "Product review list, moderation update, and delete operations.",
    source: "services/api-gateway/src/index.ts:212 + routes/reviews.ts"
  },
  {
    surface: "Form submissions",
    mount: "/v1/form-submissions",
    access: "Protected merchant session + CSRF",
    routeCount: 3,
    scope: "Form submission list, status update, and delete operations.",
    source: "services/api-gateway/src/index.ts:213 + routes/form-submissions.ts"
  },
  {
    surface: "Pages",
    mount: "/v1/pages",
    access: "Protected merchant session + CSRF",
    routeCount: 10,
    scope: "Pages, policies, navigation replacement, page updates, and deletes.",
    source: "services/api-gateway/src/index.ts:214 + routes/pages.ts"
  },
  {
    surface: "Operations",
    mount: "/v1/operations",
    access: "Protected merchant session + CSRF",
    routeCount: 44,
    scope: "Platform operations workflows and support tooling.",
    source: "services/api-gateway/src/index.ts:215 + routes/operations.ts"
  }
];

export const schemaFacades: SchemaFacade[] = [
  {
    module: "auth.schema.ts",
    routeSurface: "/v1/auth",
    canonicalSource: "@letbuyy/auth-core",
    currentExports: "SignUp, SignIn, OTP request/verify, password reset/update, auth token helpers, and customer federation token helpers.",
    developerMeaning: "Auth request validation is centralized in auth-core and exposed through the gateway facade; the developer portal should not invent extra login/session fields.",
    source: "services/api-gateway/src/schemas/auth.schema.ts:1"
  },
  {
    module: "store.schema.ts",
    routeSurface: "/v1/stores",
    canonicalSource: "@letbuyy/shared-types + @letbuyy/tenant-core",
    currentExports: "Store contract, site type/status, reserved subdomains, subdomain validation, create/update store, and payment config schemas.",
    developerMeaning: "Store-facing docs should say store in UI but keep source truth tied to site ownership and tenant-core validation.",
    source: "services/api-gateway/src/schemas/store.schema.ts:1"
  },
  {
    module: "product.schema.ts",
    routeSurface: "/v1/products",
    canonicalSource: "@letbuyy/shared-types + @letbuyy/commerce-core",
    currentExports: "Product, collection, option, variant contracts plus create, update, list query, and bulk action schemas.",
    developerMeaning: "Product endpoint docs can cite real create/update/list/bulk validators, but field-level generated OpenAPI is not present.",
    source: "services/api-gateway/src/schemas/product.schema.ts:1"
  },
  {
    module: "customer.schema.ts",
    routeSurface: "/v1/customers",
    canonicalSource: "@letbuyy/shared-types + @letbuyy/commerce-core",
    currentExports: "Customer and address contracts plus create, update, create address, and list query schemas.",
    developerMeaning: "Customer docs should stay store-scoped and use the commerce-core customer/address request contracts.",
    source: "services/api-gateway/src/schemas/customer.schema.ts:1"
  },
  {
    module: "order.schema.ts",
    routeSurface: "/v1/orders, /v1/payments, /v1/storefront",
    canonicalSource: "@letbuyy/shared-types + @letbuyy/checkout-core",
    currentExports: "Cart, line item, order, payment contracts plus storefront checkout, provider payment, fulfillment, refund, order status, and list schemas.",
    developerMeaning: "Checkout and payment examples must reflect server-side order/payment schemas and provider verification contracts, not client-submitted totals.",
    source: "services/api-gateway/src/schemas/order.schema.ts:1"
  },
  {
    module: "coupon.schema.ts",
    routeSurface: "/v1/coupons and storefront coupon validation",
    canonicalSource: "@letbuyy/shared-types + @letbuyy/checkout-core",
    currentExports: "Coupon contract plus create, validate, and list query schemas.",
    developerMeaning: "Coupon docs can cover create/list/validate shape at a high level, while generated request examples remain skipped until tooling exists.",
    source: "services/api-gateway/src/schemas/coupon.schema.ts:1"
  },
  {
    module: "theme.schema.ts",
    routeSurface: "/v1/themes",
    canonicalSource: "@letbuyy/shared-types + @letbuyy/theme-engine",
    currentExports: "Theme, bundle, section, block, template contracts plus slug, store query, install, draft, publish, preview, rollback, upload, and purchase schemas.",
    developerMeaning: "Theme SDK docs should treat the JSON-contract bundle and upload route as real; npm SDK and CLI remain planned.",
    source: "services/api-gateway/src/schemas/theme.schema.ts:1"
  },
  {
    module: "operations.schema.ts",
    routeSurface: "/v1/operations",
    canonicalSource: "@letbuyy/event-core",
    currentExports: "Outbox, webhook delivery dispatch, queue jobs, review decisions, webhook subscriptions, usage, runtime replay/recovery, incident, readiness, and certification schemas.",
    developerMeaning: "Operational webhook subscription schemas exist, but public developer webhook management UI and sender tooling are still skipped.",
    source: "services/api-gateway/src/schemas/operations.schema.ts:1"
  }
];

export const contractCards: ContractCard[] = [
  {
    title: "Developer registration request",
    status: "available",
    source: "packages/app-engine/src/index.ts:721",
    points: [
      "Required body fields: company_name and support_email.",
      "Optional aliases/fields: contact_email, website_url or website, description or bio, and country.",
      "company_name is slugified; the route returns 409 if the account or company already has a developer profile.",
      "New developer profiles are created with status=pending, verified=false, and default country IN when country is absent."
    ]
  },
  {
    title: "Marketplace app submission request",
    status: "available",
    source: "packages/app-engine/src/index.ts:753",
    points: [
      "Required body fields: name, tagline, description, category_id, app_url, and privacy_url or privacy_policy_url.",
      "slug is optional; when absent it is generated from name. save_as_draft=true creates draft, otherwise status becomes in_review.",
      "pricing_model defaults to free. price_monthly is normalized into price_inr.",
      "The route checks slug conflicts before inserting marketplace_apps and creates a marketplace review record for non-draft submissions."
    ]
  },
  {
    title: "Built-for-LetBuyy quality gate",
    status: "available",
    source: "packages/app-engine/src/index.ts:666",
    points: [
      "Quality evidence may arrive as quality_gate, built_for_letbuyy, or builtForLetBuyy.",
      "Checks require performance score >= 70, at least one review with 4.0+ rating, at least one install, at least one storefront app block, and HTTPS app/privacy URLs.",
      "Localhost HTTP is allowed only for local testing URL validation.",
      "When quality evidence is present on a non-draft app and one or more checks fail, submission returns a validation error listing failed check keys."
    ]
  },
  {
    title: "OAuth and app token lifetimes",
    status: "available",
    source: "services/api-gateway/src/routes/app-store.ts:1225",
    points: [
      "Authorization codes expire after 15 minutes and are stored only as hashes in app_installations.config with the PKCE S256 code challenge.",
      "POST /v1/app-store/oauth/token requires code_verifier, blocks replay by marking authorization_code.redeemed_at, and stores only token hashes.",
      "POST /v1/app-store/oauth/token with grant_type=refresh_token rotates the stored refresh_token_hash and returns a new app Bearer token.",
      "POST /v1/app-store/oauth/token-exchange mints a 15-minute embedded app token from a merchant session and installation_id.",
      "Direct install currently returns a Bearer app token with a one-hour expires_at value."
    ]
  },
  {
    title: "App bridge fetch limits",
    status: "partial",
    source: "services/api-gateway/src/routes/app-store.ts:262",
    points: [
      "Only method=GET is accepted; mutation bridge calls are not implemented.",
      "Absolute URLs, parent path traversal, double slashes, and mismatched store_id values are rejected.",
      "Allowed first path segments are products, orders, customers, themes, and storefront.",
      "Required scopes map to read_products, read_orders, read_customers, read_themes, and read_storefront."
    ]
  },
  {
    title: "Scoped app API",
    status: "available",
    source: "services/api-gateway/src/routes/app-api.ts:1",
    points: [
      "App bearer tokens are accepted only on /v1/app routes and do not satisfy merchant dashboard auth middleware.",
      "GET /v1/app/products requires read_products and is pinned to the token installation store.",
      "GET /v1/app/orders requires read_orders and is pinned to the token installation store.",
      "PATCH /v1/app/installation/metadata requires write_app_metadata and can update non-secret app-owned metadata only."
    ]
  },
  {
    title: "Theme package upload body",
    status: "available",
    source: "packages/theme-engine/src/theme-bundle.ts:117",
    points: [
      "bundle.schema_version defaults to 2026-05-json-contract and package metadata requires slug, name, site_types, version, pricing fields, and release status.",
      "Bundle areas are config.settings_schema, config.settings_data, templates, sections, blocks, locales, and renderer.",
      "Section keys must match section.type, block keys must match block.type, and section block_types must reference existing block definitions.",
      "POST /v1/themes/packages/upload accepts submission_mode=marketplace by default; private_install returns without a review record."
    ]
  }
];

export const appStoreEndpoints: EndpointDoc[] = [
  {
    method: "GET",
    path: "/v1/app-store/categories",
    auth: "public",
    status: "available",
    summary: "Lists active app categories.",
    source: "services/api-gateway/src/routes/app-store.ts:460"
  },
  {
    method: "GET",
    path: "/v1/app-store/apps",
    auth: "public",
    status: "available",
    summary: "Lists published marketplace apps with category, search, pricing, site_type, sort, page, and limit filters.",
    source: "services/api-gateway/src/routes/app-store.ts:475"
  },
  {
    method: "GET",
    path: "/v1/app-store/apps/:id",
    auth: "public",
    status: "available",
    summary: "Gets a published app by UUID or slug with developer, category, and extension records.",
    source: "services/api-gateway/src/routes/app-store.ts:524"
  },
  {
    method: "POST",
    path: "/v1/app-store/apps/:id/oauth/authorize",
    auth: "merchant session",
    status: "available",
    summary: "Installs or authorizes a published app, validates requested scopes and redirect_uri, creates webhook subscriptions, emits app.installed, and returns a 15-minute authorization code.",
    source: "services/api-gateway/src/routes/app-store.ts:1140"
  },
  {
    method: "POST",
    path: "/v1/app-store/oauth/token",
    auth: "public",
    status: "available",
    summary: "Exchanges grant_type=authorization_code with PKCE code_verifier, or grant_type=refresh_token with a rotated refresh token, for a scoped Bearer token.",
    source: "services/api-gateway/src/routes/app-store.ts:1312"
  },
  {
    method: "POST",
    path: "/v1/app-store/oauth/token-exchange",
    auth: "merchant session",
    status: "available",
    summary: "Exchanges an authenticated merchant session and installation_id for a 15-minute embedded app token.",
    source: "services/api-gateway/src/routes/app-store.ts:1400"
  },
  {
    method: "POST",
    path: "/v1/app-store/installations/:id/embed-session",
    auth: "merchant session",
    status: "available",
    summary: "Mints a 15-minute app bridge session for an installed admin embed surface.",
    source: "services/api-gateway/src/routes/app-store.ts:682"
  },
  {
    method: "POST",
    path: "/v1/app-store/bridge/fetch",
    auth: "app bearer",
    status: "partial",
    summary: "Proxies scoped GET reads for embedded apps. Allowed first segments map to read_products, read_orders, read_customers, read_themes, and read_storefront.",
    source: "services/api-gateway/src/routes/app-store.ts:781"
  },
  {
    method: "GET",
    path: "/v1/app/products",
    auth: "app bearer: read_products",
    status: "available",
    summary: "Lists products for the installed app token's store. A mismatched store_id is rejected instead of broadening access.",
    source: "services/api-gateway/src/routes/app-api.ts:152"
  },
  {
    method: "GET",
    path: "/v1/app/orders",
    auth: "app bearer: read_orders",
    status: "available",
    summary: "Lists orders for the installed app token's store. A mismatched store_id is rejected instead of broadening access.",
    source: "services/api-gateway/src/routes/app-api.ts:209"
  },
  {
    method: "PATCH",
    path: "/v1/app/installation/metadata",
    auth: "app bearer: write_app_metadata",
    status: "available",
    summary: "Updates non-secret metadata owned by the active app installation without mutating merchant product, order, customer, or theme records.",
    source: "services/api-gateway/src/routes/app-api.ts:271"
  },
  {
    method: "POST",
    path: "/v1/app-store/apps/:id/install",
    auth: "merchant session",
    status: "available",
    summary: "Installs an app directly, mints an app token, subscribes webhooks, and dispatches app.installed.",
    source: "services/api-gateway/src/routes/app-store.ts:1477"
  },
  {
    method: "DELETE",
    path: "/v1/app-store/apps/:id/install",
    auth: "merchant session",
    status: "available",
    summary: "Uninstalls an app, revokes stored OAuth config, disables app webhook subscriptions, and dispatches app.uninstalled.",
    source: "services/api-gateway/src/routes/app-store.ts:1648"
  },
  {
    method: "GET",
    path: "/v1/app-store/developers/me",
    auth: "merchant session",
    status: "available",
    summary: "Returns the current user's developer profile if registered.",
    source: "services/api-gateway/src/routes/app-store.ts:1758"
  },
  {
    method: "POST",
    path: "/v1/app-store/developers/register",
    auth: "merchant session",
    status: "available",
    summary: "Registers the current user as an app developer with company_name and support_email.",
    source: "services/api-gateway/src/routes/app-store.ts:1781"
  },
  {
    method: "GET",
    path: "/v1/app-store/developers/apps",
    auth: "merchant session",
    status: "available",
    summary: "Lists current developer profile, submitted apps, and review records.",
    source: "services/api-gateway/src/routes/app-store.ts:1813"
  },
  {
    method: "POST",
    path: "/v1/app-store/developers/apps/manifest/validate",
    auth: "merchant session",
    status: "available",
    summary: "Validates a LetBuyy app manifest against app-engine, returning normalized extension and function registration plans without creating an app.",
    source: "services/api-gateway/src/routes/app-store/developer-routes.ts"
  },
  {
    method: "POST",
    path: "/v1/app-store/developers/apps",
    auth: "merchant session",
    status: "available",
    summary: "Submits a marketplace app for review after developer registration, optional Built-for-LetBuyy quality gate checks, optional manifest persistence, and show-once hash-only credential issuance.",
    source: "services/api-gateway/src/routes/app-store.ts:2085"
  },
  {
    method: "POST",
    path: "/v1/app-store/developers/apps/:id/api-key",
    auth: "merchant session",
    status: "available",
    summary: "Rotates a show-once developer API key for an app owned by the current developer profile; plaintext is returned once and only hashes are persisted.",
    source: "services/api-gateway/src/routes/app-store/developer-routes.ts"
  }
];

export const commerceEndpoints: EndpointDoc[] = [
  {
    method: "GET",
    path: "/v1/products",
    auth: "merchant session",
    status: "available",
    summary: "Lists products for owned stores with pagination, store_id, category, status, search, sort, and order filters.",
    source: "services/api-gateway/src/routes/products.ts:119"
  },
  {
    method: "POST",
    path: "/v1/products",
    auth: "merchant session",
    status: "available",
    summary: "Creates a product through ProductExecutionAdapter after resolving the merchant profile and owned store context.",
    source: "services/api-gateway/src/routes/products.ts:387"
  },
  {
    method: "PATCH",
    path: "/v1/products/:id",
    auth: "merchant session",
    status: "available",
    summary: "Updates an owned product and emits product.updated.",
    source: "services/api-gateway/src/routes/products.ts:411"
  },
  {
    method: "POST",
    path: "/v1/products/bulk",
    auth: "merchant session",
    status: "available",
    summary: "Runs bulk activate, deactivate, or delete actions for product IDs in an owned store.",
    source: "services/api-gateway/src/routes/products.ts:435"
  },
  {
    method: "GET",
    path: "/v1/orders",
    auth: "merchant session",
    status: "available",
    summary: "Lists orders for owned stores with pagination, status, payment_status, search, sort, and order filters.",
    source: "services/api-gateway/src/routes/orders.ts:230"
  },
  {
    method: "POST",
    path: "/v1/orders",
    auth: "merchant session",
    status: "available",
    summary: "Creates a merchant-side order with server-side price calculation and idempotency.",
    source: "services/api-gateway/src/routes/orders.ts:389"
  },
  {
    method: "PATCH",
    path: "/v1/orders/:id",
    auth: "merchant session",
    status: "available",
    summary: "Transitions order status through the order execution adapter with an idempotency claim.",
    source: "services/api-gateway/src/routes/orders.ts:340"
  },
  {
    method: "POST",
    path: "/v1/orders/:id/fulfill",
    auth: "merchant session",
    status: "available",
    summary: "Creates fulfillment records and emits order.fulfilled for an owned order.",
    source: "services/api-gateway/src/routes/orders.ts:449"
  },
  {
    method: "POST",
    path: "/v1/orders/:id/refund",
    auth: "merchant session",
    status: "available",
    summary: "Creates a return and refund intent instead of marking provider success directly.",
    source: "services/api-gateway/src/routes/orders.ts:540"
  },
  {
    method: "GET",
    path: "/v1/customers",
    auth: "merchant session",
    status: "available",
    summary: "Builds store-scoped customer summaries from store customer rows and order rows.",
    source: "services/api-gateway/src/routes/customers.ts:113"
  },
  {
    method: "POST",
    path: "/v1/customers/:email/addresses",
    auth: "merchant session",
    status: "available",
    summary: "Adds a saved customer address after verifying store ownership.",
    source: "services/api-gateway/src/routes/customers.ts:231"
  },
  {
    method: "GET",
    path: "/v1/inventory/levels",
    auth: "merchant session",
    status: "available",
    summary: "Lists inventory levels for owned stores with product_id, low_stock, page, and limit filters.",
    source: "services/api-gateway/src/routes/inventory.ts:557"
  },
  {
    method: "POST",
    path: "/v1/inventory/adjust",
    auth: "merchant session",
    status: "available",
    summary: "Adjusts inventory for an owned product through the inventory ledger RPC.",
    source: "services/api-gateway/src/routes/inventory.ts:645"
  },
  {
    method: "GET",
    path: "/v1/payments/plans",
    auth: "merchant session",
    status: "available",
    summary: "Returns active subscription plans filtered by site_type and optional slug.",
    source: "services/api-gateway/src/routes/payments.ts:263"
  },
  {
    method: "POST",
    path: "/v1/payments/razorpay/order",
    auth: "merchant session",
    status: "available",
    summary: "Creates a Razorpay order for an owned payable order after amount verification and idempotency.",
    source: "services/api-gateway/src/routes/payments.ts:651"
  },
  {
    method: "POST",
    path: "/v1/payments/razorpay/verify",
    auth: "merchant session",
    status: "available",
    summary: "Verifies Razorpay signature, prevents double-payment, confirms payment, and emits order paid state.",
    source: "services/api-gateway/src/routes/payments.ts:750"
  },
  {
    method: "POST",
    path: "/v1/payments/stripe/checkout",
    auth: "merchant session",
    status: "available",
    summary: "Creates a Stripe checkout session for an owned payable order and records the Stripe session reference.",
    source: "services/api-gateway/src/routes/payments.ts:843"
  }
];

export const storefrontEndpoints: EndpointDoc[] = [
  {
    method: "GET",
    path: "/v1/storefront/lookup",
    auth: "public",
    status: "available",
    summary: "Looks up a store by handle or subdomain for routing and search surfaces.",
    source: "services/api-gateway/src/routes/storefront.ts:1195"
  },
  {
    method: "GET",
    path: "/v1/storefront/directory",
    auth: "public",
    status: "available",
    summary: "Returns public discovery stores and aggregate counts for stores, themes, products, and orders.",
    source: "services/api-gateway/src/routes/storefront.ts:1256"
  },
  {
    method: "GET",
    path: "/v1/storefront/store/:storeId",
    auth: "public",
    status: "available",
    summary: "Loads published store data by immutable store ID and includes current theme release plus public app blocks.",
    source: "services/api-gateway/src/routes/storefront.ts:1299"
  },
  {
    method: "GET",
    path: "/v1/storefront/:subdomain",
    auth: "public",
    status: "available",
    summary: "Loads published store data by subdomain and includes current theme release plus public app blocks.",
    source: "services/api-gateway/src/routes/storefront.ts:1529"
  },
  {
    method: "GET",
    path: "/v1/storefront/:subdomain/status",
    auth: "public",
    status: "available",
    summary: "Returns limited status data for draft, published, suspended, or coming-soon routing.",
    source: "services/api-gateway/src/routes/storefront.ts:1545"
  },
  {
    method: "POST",
    path: "/v1/storefront/:subdomain/orders",
    auth: "public",
    status: "available",
    summary: "Creates a storefront checkout order after resolving tenant ownership by subdomain; client store IDs and totals are ignored.",
    source: "services/api-gateway/src/routes/storefront.ts:1566"
  },
  {
    method: "POST",
    path: "/v1/storefront/:subdomain/payments/razorpay/order",
    auth: "public",
    status: "available",
    summary: "Creates a Razorpay payment order for a storefront order after reloading the payable order amount.",
    source: "services/api-gateway/src/routes/storefront.ts:1664"
  },
  {
    method: "POST",
    path: "/v1/storefront/:subdomain/payments/razorpay/verify",
    auth: "public",
    status: "available",
    summary: "Verifies Razorpay storefront payment signature before confirming payment state.",
    source: "services/api-gateway/src/routes/storefront.ts:1784"
  },
  {
    method: "GET",
    path: "/v1/storefront/:subdomain/products",
    auth: "public",
    status: "available",
    summary: "Lists public products for a published store with page, limit, category, and search filters.",
    source: "services/api-gateway/src/routes/storefront.ts:2474"
  },
  {
    method: "GET",
    path: "/v1/storefront/:subdomain/products/:slug",
    auth: "public",
    status: "available",
    summary: "Loads a single active product by slug or UUID and records a storefront view.",
    source: "services/api-gateway/src/routes/storefront.ts:2510"
  },
  {
    method: "GET",
    path: "/v1/storefront/:subdomain/coupons/validate",
    auth: "public",
    status: "available",
    summary: "Validates an active coupon against a storefront subtotal and minimum-order rules.",
    source: "services/api-gateway/src/routes/storefront.ts:2531"
  },
  {
    method: "GET",
    path: "/v1/storefront/:subdomain/categories",
    auth: "public",
    status: "available",
    summary: "Lists visible product categories for a published store.",
    source: "services/api-gateway/src/routes/storefront.ts:2587"
  },
  {
    method: "GET",
    path: "/v1/storefront/:subdomain/navigation",
    auth: "public",
    status: "available",
    summary: "Loads a public navigation menu by normalized location token.",
    source: "services/api-gateway/src/routes/storefront.ts:2596"
  },
  {
    method: "GET",
    path: "/v1/storefront/:subdomain/pages",
    auth: "public",
    status: "available",
    summary: "Lists published storefront pages for the resolved store.",
    source: "services/api-gateway/src/routes/storefront.ts:2617"
  },
  {
    method: "GET",
    path: "/v1/storefront/:subdomain/policies",
    auth: "public",
    status: "available",
    summary: "Lists storefront policy pages for the resolved store.",
    source: "services/api-gateway/src/routes/storefront.ts:2633"
  },
  {
    method: "GET",
    path: "/v1/storefront/reviews",
    auth: "public",
    status: "available",
    summary: "Lists public approved product reviews through the storefront review query schema.",
    source: "services/api-gateway/src/routes/storefront.ts:1382"
  }
];

export const themeEndpoints: EndpointDoc[] = [
  {
    method: "GET",
    path: "/v1/themes",
    auth: "public",
    status: "available",
    summary: "Lists active themes with category, site_type, pricing, industry, search, sort, page, and limit filters.",
    source: "services/api-gateway/src/routes/themes.ts:119"
  },
  {
    method: "GET",
    path: "/v1/themes/:slug/schema",
    auth: "public",
    status: "available",
    summary: "Returns editable schemas for a theme.",
    source: "services/api-gateway/src/routes/themes.ts:330"
  },
  {
    method: "GET",
    path: "/v1/themes/:slug/editor",
    auth: "merchant session",
    status: "available",
    summary: "Loads store-scoped theme editor state using store_id.",
    source: "services/api-gateway/src/routes/themes.ts:338"
  },
  {
    method: "PUT",
    path: "/v1/themes/:slug/editor/draft",
    auth: "merchant session",
    status: "available",
    summary: "Saves a store-scoped theme draft with Zod validation from @letbuyy/theme-engine.",
    source: "services/api-gateway/src/routes/themes.ts:362"
  },
  {
    method: "POST",
    path: "/v1/themes/:slug/publish",
    auth: "merchant session",
    status: "available",
    summary: "Publishes a saved draft to the live store theme config.",
    source: "services/api-gateway/src/routes/themes.ts:400"
  },
  {
    method: "POST",
    path: "/v1/themes/:slug/preview-session",
    auth: "merchant session",
    status: "available",
    summary: "Creates a signed draft preview token.",
    source: "services/api-gateway/src/routes/themes.ts:414"
  },
  {
    method: "POST",
    path: "/v1/themes/packages/upload",
    auth: "merchant session",
    status: "available",
    summary: "Validates and persists a portable JSON-contract theme bundle, then creates a marketplace review record unless private_install is requested.",
    source: "services/api-gateway/src/routes/themes.ts:467"
  },
  {
    method: "POST",
    path: "/v1/themes/:slug/install",
    auth: "merchant session",
    status: "available",
    summary: "Installs or applies a theme to a store.",
    source: "services/api-gateway/src/routes/themes.ts:566"
  }
];

export const webhookEndpoints: EndpointDoc[] = [
  {
    method: "POST",
    path: "https://webhooks.letbuyy.store/app-lifecycle/dispatch",
    auth: "internal",
    status: "available",
    summary: "Internal gateway-to-webhook-service route that signs and dispatches app lifecycle callbacks.",
    source: "services/webhook-service/src/index.ts:748"
  },
  {
    method: "POST",
    path: "https://webhooks.letbuyy.store/webhook-deliveries/dispatch",
    auth: "internal",
    status: "available",
    summary: "Internal dispatcher for queued webhook delivery rows with retry scheduling.",
    source: "services/webhook-service/src/index.ts:842"
  },
  {
    method: "POST",
    path: "Partner HTTPS callback URL",
    auth: "HMAC signature",
    status: "available",
    summary: "LetBuyy sends app lifecycle and queued webhooks with X-LetBuyy-Hmac-SHA256, X-LetBuyy-Timestamp, event ID, event type, request ID, and trace ID headers.",
    source: "services/webhook-service/src/app-lifecycle-dispatch.ts:86"
  }
];

export const oauthSteps: GuideStep[] = [
  {
    title: "1. Merchant authorizes the app",
    body: "Call POST /v1/app-store/apps/:id/oauth/authorize with a merchant session and a PKCE S256 code_challenge. The gateway verifies store ownership, checks requested scopes against the app's api_scopes, validates redirect_uri, activates the installation, creates webhook subscriptions, and returns an authorization code.",
    source: "services/api-gateway/src/routes/app-store.ts:1140"
  },
  {
    title: "2. Authorization code is short-lived",
    body: "The code is stored as a hash with the PKCE challenge in app_installations.config.oauth.authorization_code and expires after 15 minutes.",
    source: "services/api-gateway/src/routes/app-store.ts:1225"
  },
  {
    title: "3. App exchanges the code",
    body: "Call POST /v1/app-store/oauth/token with grant_type=authorization_code, code, client_id, redirect_uri, and code_verifier. The gateway verifies the signed code, checks client and redirect match, verifies PKCE, blocks replay, and returns a scoped Bearer token plus refresh token.",
    source: "services/api-gateway/src/routes/app-store.ts:1312"
  },
  {
    title: "4. Refresh tokens rotate",
    body: "Call POST /v1/app-store/oauth/token with grant_type=refresh_token, refresh_token, and client_id to rotate the refresh token and receive a fresh scoped app token. The gateway stores only refresh_token_hash.",
    source: "services/api-gateway/src/routes/app-store.ts:1312"
  },
  {
    title: "5. Embedded apps can exchange a merchant session",
    body: "Call POST /v1/app-store/oauth/token-exchange with a merchant session and installation_id. The returned token lasts 15 minutes and is intended for embedded admin app surfaces.",
    source: "services/api-gateway/src/routes/app-store.ts:1400"
  },
  {
    title: "6. App bridge reads are scoped and GET-only",
    body: "POST /v1/app-store/bridge/fetch accepts a Bearer app token and only proxies GET reads to approved first segments. Mutating bridge calls are not implemented.",
    source: "services/api-gateway/src/routes/app-store.ts:781"
  },
  {
    title: "7. Server-to-server app API calls are scoped",
    body: "Call /v1/app/products or /v1/app/orders with the app Bearer token for direct scoped reads. Metadata writes are limited to PATCH /v1/app/installation/metadata and require write_app_metadata.",
    source: "services/api-gateway/src/routes/app-api.ts:152"
  }
];

export const oauthTokenLifecycle: OAuthTokenLifecycleDoc[] = [
  {
    surface: "Authorization code issuance",
    currentContract: "POST /v1/app-store/apps/:id/oauth/authorize validates merchant ownership, requested scopes, redirect_uri, and PKCE S256 code_challenge, then stores only a code hash plus challenge under config.oauth.authorization_code with a 15-minute expires_at.",
    developerAction: "Treat the returned code as one-time, short-lived material and keep the original PKCE code_verifier for token exchange.",
    source: "services/api-gateway/src/routes/app-store.ts:1139 + :1225 + :1244"
  },
  {
    surface: "Authorization code exchange",
    currentContract: "POST /v1/app-store/oauth/token accepts grant_type=authorization_code and requires code, client_id, redirect_uri, and code_verifier; the signed code payload must match client_id and redirect_uri, and the verifier must match the stored S256 challenge.",
    developerAction: "Send the exact redirect URI and PKCE verifier used during authorize, and handle INVALID_GRANT for expired, malformed, mismatched, or replayed codes.",
    source: "services/api-gateway/src/routes/app-store.ts:1311 + :1316 + :1322 + :1327"
  },
  {
    surface: "Authorization code replay",
    currentContract: "The exchange compares the stored code hash and rejects codes with redeemed_at set; successful exchange stores the app token hash and marks the authorization code redeemed.",
    developerAction: "Do not assume an authorization code can be replayed after a network retry; start a new authorize flow after INVALID_GRANT.",
    source: "services/api-gateway/src/routes/app-store.ts:1355 + :1360 + :1381"
  },
  {
    surface: "Scoped app token",
    currentContract: "mintAppOAuthAccessToken defaults to a 3600-second TTL, returns Bearer access_token, expires_at, scope, scopes, installation_id, app_id, and store_id, and stores only access_token_hash. Authorization-code and refresh-token flows also return a refresh_token while storing only refresh_token_hash.",
    developerAction: "Use the token as a one-hour scoped bearer token, store expiry separately in the partner app, and replace the refresh token after every refresh response.",
    source: "services/api-gateway/src/routes/app-store.ts:213 + :227 + :241"
  },
  {
    surface: "Merchant session token exchange",
    currentContract: "POST /v1/app-store/oauth/token-exchange requires merchant auth, an active installation_id, store ownership, and requested scopes within scopes_granted; the minted token lasts 15 minutes.",
    developerAction: "Use this path for embedded admin surfaces that already have a merchant session, and request only the subset of scopes needed.",
    source: "services/api-gateway/src/routes/app-store.ts:1400 + :1413 + :1433 + :1438 + :1452"
  },
  {
    surface: "Embed bridge session",
    currentContract: "POST /v1/app-store/installations/:id/embed-session mints a 15-minute bridge token, stores bridge_token_hash, issued/expires/scopes, and returns bridge version 2026-06-01 with api_base_url and capabilities.",
    developerAction: "Bootstrap embedded admin apps from this session response instead of persisting bridge tokens long term.",
    source: "services/api-gateway/src/routes/app-store.ts:681 + :728 + :750 + :766"
  },
  {
    surface: "Bridge fetch token verification",
    currentContract: "POST /v1/app-store/bridge/fetch verifies Bearer token scopes, token store_id, active installation state, and that the token hash matches bridge_token_hash or access_token_hash.",
    developerAction: "When the bridge says the token was revoked or replaced, mint a fresh embedded/session token before retrying.",
    source: "services/api-gateway/src/routes/app-store.ts:781 + :802 + :806 + :834"
  },
  {
    surface: "Direct install token",
    currentContract: "POST /v1/app-store/apps/:id/install creates an active install and returns an app bearer token with one-hour expires_at, storing only access_token_hash in installation config.",
    developerAction: "Distinguish direct install token responses from the authorization-code flow; both are real but have different request shapes.",
    source: "services/api-gateway/src/routes/app-store.ts:1482 + :1547 + :1580 + :1636"
  },
  {
    surface: "Refresh tokens and rotation",
    currentContract: "POST /v1/app-store/oauth/token accepts grant_type=refresh_token, looks up the hashed refresh token in active installation config, checks client_id and expiry, issues a fresh access token, and rotates refresh_token_hash.",
    developerAction: "Persist the newest refresh token returned by the gateway and discard the previous token immediately after a successful refresh.",
    source: "services/api-gateway/src/routes/app-store.ts:48 + :53 + :1316"
  }
];

export const oauthExamples: DocumentationExample[] = [
  {
    title: "Authorize App Request",
    description: "Merchant-session request body accepted by POST /v1/app-store/apps/:id/oauth/authorize.",
    source: "services/api-gateway/src/routes/app-store.ts:1140",
    code: `POST /v1/app-store/apps/:id/oauth/authorize
Content-Type: application/json

{
  "store_id": "site_id",
  "scopes": ["read_products", "read_orders"],
  "redirect_uri": "https://partner.example/oauth/callback",
  "code_challenge": "base64url_sha256_of_pkce_verifier",
  "code_challenge_method": "S256",
  "state": "partner_csrf_state",
  "webhook_secret": "partner_shared_signing_secret",
  "config": {
    "admin_embed": { "path": "/embed" }
  }
}`
  },
  {
    title: "Authorize App Response",
    description: "Success envelope returns installation data and a short-lived authorization code payload.",
    source: "services/api-gateway/src/routes/app-store.ts:1295",
    code: `{
  "data": {
    "installation": { "id": "installation_id", "status": "active" },
    "authorization": {
      "code": "app_authorization_code",
      "redirect_uri": "https://partner.example/oauth/callback",
      "redirect_to": "https://partner.example/oauth/callback?code=...",
      "state": "partner_csrf_state",
      "scopes": ["read_products", "read_orders"],
      "expires_at": "2026-06-03T04:15:00.000Z",
      "installation_id": "installation_id",
      "app_id": "app_id",
      "store_id": "site_id"
    }
  }
}`
  },
  {
    title: "Token Exchange Response",
    description: "Both auth-code exchange and embedded token exchange return the minted app token response envelope.",
    source: "services/api-gateway/src/routes/app-store.ts:1396 + 1473",
    code: `{
  "data": {
    "access_token": "letbuyy_app_token",
    "refresh_token": "lbapp_refresh_token",
    "token_type": "Bearer",
    "expires_at": "2026-06-03T04:15:00.000Z",
    "refresh_expires_at": "2026-07-03T04:00:00.000Z",
    "scopes": ["read_products", "read_orders"],
    "installation_id": "installation_id",
    "app_id": "app_id",
    "store_id": "site_id"
  }
}`
  },
  {
    title: "Merchant Session Token Exchange",
    description: "Embedded apps can request a 15-minute app token from a merchant session and active installation.",
    source: "services/api-gateway/src/routes/app-store.ts:1400",
    code: `POST /v1/app-store/oauth/token-exchange
Content-Type: application/json

{
  "installation_id": "installation_id",
  "store_id": "site_id",
  "scopes": ["read_products"]
}`
  },
  {
    title: "Bridge Fetch Response",
    description: "The bridge returns upstream status, response data, and a bridge error when the proxied read fails.",
    source: "services/api-gateway/src/routes/app-store.ts:872",
    code: `{
  "data": {
    "ok": true,
    "status": 200,
    "data": {
      "items": []
    },
    "error": null
  }
}`
  }
];

export const realScopes = [
  "read_products",
  "read_orders",
  "read_customers",
  "read_themes",
  "read_storefront",
  "write_themes",
  "app_collaboration"
];

export const oauthScopeMatrix: OAuthScopeDoc[] = [
  {
    scope: "read_products",
    currentUse: "Accepted install/OAuth scope and required for app bridge reads whose first path segment is products.",
    bridgeAccess: "GET /v1/products through POST /v1/app-store/bridge/fetch.",
    notes: "Requested scopes are checked against marketplace_apps.api_scopes; unsupported scopes are rejected.",
    source: "services/api-gateway/src/routes/app-store.ts:278 + packages/app-engine/src/index.ts:349"
  },
  {
    scope: "read_orders",
    currentUse: "Accepted install/OAuth scope and required for app bridge reads whose first path segment is orders.",
    bridgeAccess: "GET /v1/orders through POST /v1/app-store/bridge/fetch.",
    notes: "Also appears in partner collaborator access defaults.",
    source: "services/api-gateway/src/routes/app-store.ts:278 + :2022"
  },
  {
    scope: "read_customers",
    currentUse: "Accepted install/OAuth scope and required for app bridge reads whose first path segment is customers.",
    bridgeAccess: "GET /v1/customers through POST /v1/app-store/bridge/fetch.",
    notes: "Bridge requests are rejected when store_id does not match the app token payload.",
    source: "services/api-gateway/src/routes/app-store.ts:278 + :805"
  },
  {
    scope: "read_themes",
    currentUse: "Accepted install/OAuth scope and required for app bridge reads whose first path segment is themes.",
    bridgeAccess: "GET /v1/themes through POST /v1/app-store/bridge/fetch.",
    notes: "Theme write flows are not exposed through the current bridge/fetch route.",
    source: "services/api-gateway/src/routes/app-store.ts:278"
  },
  {
    scope: "read_storefront",
    currentUse: "Accepted install/OAuth scope and required for app bridge reads whose first path segment is storefront.",
    bridgeAccess: "GET /v1/storefront through POST /v1/app-store/bridge/fetch.",
    notes: "The bridge target injects the token store_id into the proxied request query string.",
    source: "services/api-gateway/src/routes/app-store.ts:278 + :296"
  },
  {
    scope: "write_themes",
    currentUse: "Observed in partner collaborator access defaults and partner collaborator-code responses.",
    bridgeAccess: "[SKIP — NEEDS BACKEND/SDK] The current bridge/fetch route only accepts GET.",
    notes: "Do not document write-capable app bridge calls until a real route lands.",
    source: "services/api-gateway/src/routes/app-store.ts:2022 + :2079"
  },
  {
    scope: "app_collaboration",
    currentUse: "Observed in partner collaborator access defaults and partner collaborator-code responses.",
    bridgeAccess: "[SKIP — NEEDS BACKEND/SDK] No bridge/fetch path maps to app_collaboration.",
    notes: "Treat this as partner collaboration scope evidence, not storefront or commerce API scope evidence.",
    source: "services/api-gateway/src/routes/app-store.ts:2022 + :2079"
  }
];

export const appBridgeFetchRules: AppBridgeFetchRuleDoc[] = [
  {
    rule: "Request normalization",
    currentContract: "bridge/fetch defaults method to GET, requires a path, rejects non-GET methods, absolute http(s) URLs, '..', and double-slash paths, and strips an optional /v1 prefix.",
    developerAction: "Send relative gateway paths such as /products or /v1/products, and keep bridge calls read-only.",
    source: "services/api-gateway/src/routes/app-store.ts:264"
  },
  {
    rule: "Products reads",
    currentContract: "First path segment products requires read_products.",
    developerAction: "Use GET /products through bridge/fetch only with a token carrying read_products.",
    source: "services/api-gateway/src/routes/app-store.ts:278"
  },
  {
    rule: "Orders reads",
    currentContract: "First path segment orders requires read_orders.",
    developerAction: "Use GET /orders through bridge/fetch only with a token carrying read_orders.",
    source: "services/api-gateway/src/routes/app-store.ts:284"
  },
  {
    rule: "Customers reads",
    currentContract: "First path segment customers requires read_customers.",
    developerAction: "Use GET /customers through bridge/fetch only with a token carrying read_customers.",
    source: "services/api-gateway/src/routes/app-store.ts:286"
  },
  {
    rule: "Themes reads",
    currentContract: "First path segment themes requires read_themes.",
    developerAction: "Use GET /themes through bridge/fetch only with a token carrying read_themes; theme writes are not bridged today.",
    source: "services/api-gateway/src/routes/app-store.ts:288"
  },
  {
    rule: "Storefront reads",
    currentContract: "First path segment storefront requires read_storefront.",
    developerAction: "Use GET /storefront through bridge/fetch only with a token carrying read_storefront.",
    source: "services/api-gateway/src/routes/app-store.ts:290"
  },
  {
    rule: "Store binding",
    currentContract: "The bridge target is /v1{path}; a mismatched requested store_id rejects the request, otherwise the token store_id is injected into the proxied query.",
    developerAction: "Do not try to switch stores inside bridge calls; mint a token for the target installation/store instead.",
    source: "services/api-gateway/src/routes/app-store.ts:296 + :806"
  },
  {
    rule: "Bearer token and active install",
    currentContract: "The route reads Authorization: Bearer, verifies required scopes, loads an active matching installation, and requires installed_by to match the token payload.",
    developerAction: "Refresh the embedded/session token when verification fails or the installation is no longer active.",
    source: "services/api-gateway/src/routes/app-store.ts:258 + :796 + :819"
  },
  {
    rule: "Token hash allowlist",
    currentContract: "A verified token is accepted only when its hash matches bridge_token_hash or access_token_hash in the installation OAuth config.",
    developerAction: "Treat `App bridge token has been revoked or replaced` as a hard re-mint signal.",
    source: "services/api-gateway/src/routes/app-store.ts:834"
  },
  {
    rule: "Proxy response shape",
    currentContract: "The gateway signs internal identity headers, forwards Accept: application/json, X-LetBuyy-App-Bridge, and X-Request-ID, then returns { ok, status, data, error }.",
    developerAction: "Handle upstream non-2xx as ok=false with `Bridge gateway request failed`; do not assume the bridge throws for app-level errors.",
    source: "services/api-gateway/src/routes/app-store.ts:850 + :865 + :873"
  }
];

export const webhookFacts = [
  "Outbound LetBuyy webhooks use User-Agent: LetBuyy-App-Webhooks/1.0.",
  "The signing payload is `${timestamp}.${rawBody}`.",
  "The HMAC header is X-LetBuyy-Hmac-SHA256 and the value is versioned as v1=<hex>.",
  "X-LetBuyy-Signature is sent as a legacy alias with the same versioned value.",
  "Mandatory compliance topics are always added to app webhook subscriptions: customers/data_request, customers/redact, and shop/redact.",
  "Merchant/customer compliance producers emit through POST /v1/app-store/compliance/customers/data-request, POST /v1/app-store/compliance/customers/redact, and POST /v1/app-store/compliance/shop/redact.",
  "App uninstall emits shop/redact before app webhook subscriptions are disabled, then emits app.uninstalled.",
  "Queued delivery retries use exponential backoff from 120 seconds and cap at one hour."
];

export const webhookTopics: WebhookTopicDoc[] = [
  {
    topic: "app.installed",
    category: "lifecycle",
    deliveryRule: "Created during OAuth authorize and direct install flows when webhook definitions exist.",
    partnerAction: "Initialize app-side store state, scopes, onboarding, and billing setup using the signed lifecycle payload.",
    source: "services/api-gateway/src/routes/app-store.ts:1230"
  },
  {
    topic: "app.uninstalled",
    category: "lifecycle",
    deliveryRule: "Created during uninstall after subscriptions are disabled and install state is revoked.",
    partnerAction: "Revoke tokens, stop background work, remove merchant-specific data that is no longer needed, and preserve required audit records.",
    source: "services/api-gateway/src/routes/app-store.ts:1736"
  },
  {
    topic: "customers/data_request",
    category: "mandatory compliance",
    deliveryRule: "App webhook subscriptions always include this topic in event_types; POST /v1/app-store/compliance/customers/data-request emits it to active app-platform subscriptions for the store.",
    partnerAction: "Respond to the merchant/customer data export request through the partner app's compliance workflow.",
    source: "services/api-gateway/src/routes/app-store/compliance-routes.ts:129 + packages/app-engine/src/index.ts:150"
  },
  {
    topic: "customers/redact",
    category: "mandatory compliance",
    deliveryRule: "App webhook subscriptions always include this topic in event_types; POST /v1/app-store/compliance/customers/redact emits it to active app-platform subscriptions for the store.",
    partnerAction: "Delete or anonymize customer personal data held by the partner app.",
    source: "services/api-gateway/src/routes/app-store/compliance-routes.ts:131 + packages/app-engine/src/index.ts:150"
  },
  {
    topic: "shop/redact",
    category: "mandatory compliance",
    deliveryRule: "App webhook subscriptions always include this topic in event_types; POST /v1/app-store/compliance/shop/redact emits it explicitly and app uninstall emits shop/redact before app webhook subscriptions are disabled.",
    partnerAction: "Delete or anonymize store-level data held by the partner app after store/app lifecycle cleanup.",
    source: "services/api-gateway/src/routes/app-store/compliance-routes.ts:133 + services/api-gateway/src/routes/app-store/install-lifecycle-routes.ts:335"
  }
];

export const webhookDeliveryRules: WebhookDeliveryRuleDoc[] = [
  {
    rule: "Target URL",
    currentBehavior: "Production webhook targets must be HTTPS. Localhost HTTP is accepted only when the webhook service is not running in production mode.",
    developerAction: "Use HTTPS callbacks for real app installs and reserve localhost HTTP for local test environments.",
    source: "services/webhook-service/src/app-lifecycle-dispatch.ts:35 + :79"
  },
  {
    rule: "Signing payload and headers",
    currentBehavior: "The service signs `${timestamp}.${rawBody}`, sends X-LetBuyy-Hmac-SHA256 as v1=<hex>, and also sends X-LetBuyy-Signature as a legacy alias.",
    developerAction: "Verify against the raw request body bytes and strip the optional v1= prefix before timing-safe comparison.",
    source: "services/webhook-service/src/app-lifecycle-dispatch.ts:52 + :57 + :90"
  },
  {
    rule: "Delivery body and correlation",
    currentBehavior: "The POST body is { id, event_type, created_at, payload }. Headers include event ID/type, request ID, trace ID, timestamp, user-agent, and both signature headers.",
    developerAction: "Persist X-LetBuyy-Event-ID for idempotency and keep X-LetBuyy-Request-ID or X-LetBuyy-Trace-ID with support logs.",
    source: "services/webhook-service/src/app-lifecycle-dispatch.ts:83 + :93"
  },
  {
    rule: "Endpoint response handling",
    currentBehavior: "Any 2xx response marks delivery successful. Non-2xx responses record a response preview and error `Webhook endpoint returned HTTP <status>`; fetch failures have null status.",
    developerAction: "Return 2xx only after the event is durably accepted. Treat duplicate event IDs as already processed.",
    source: "services/webhook-service/src/app-lifecycle-dispatch.ts:109 + :115 + :121"
  },
  {
    rule: "Retry schedule",
    currentBehavior: "Failed queued deliveries use exponential backoff from 120 seconds, bound attempts to 0-8, and cap retry delay at 3600 seconds.",
    developerAction: "Expect retries after transient failures and make callback processing idempotent by event ID.",
    source: "services/webhook-service/src/index.ts:246"
  },
  {
    rule: "Queue claim and finalization",
    currentBehavior: "The dispatcher claims work through claim_webhook_deliveries, calls complete_webhook_delivery on success, and fail_webhook_delivery with p_retry_seconds on failure.",
    developerAction: "Do not rely on immediate delivery ordering; use event IDs and timestamps for reconciliation.",
    source: "services/webhook-service/src/index.ts:788 + :810 + :818"
  },
  {
    rule: "Internal dispatch routes",
    currentBehavior: "POST /app-lifecycle/dispatch and POST /webhook-deliveries/dispatch require X-LetBuyy-Internal-Secret and are service/internal surfaces.",
    developerAction: "[SKIP — NEEDS BACKEND/SDK] Do not call these routes from partner apps; public webhook test sender tooling is not present yet.",
    source: "services/webhook-service/src/index.ts:748 + :842"
  },
  {
    rule: "Subscription event filter",
    currentBehavior: "Lifecycle and compliance dispatch sends only to subscriptions whose event_types include the current event. Planned app subscriptions append mandatory compliance topics to every configured webhook.",
    developerAction: "Register the lifecycle topics your app needs and implement the mandatory compliance topics emitted by the platform.",
    source: "services/api-gateway/src/routes/app-store/shared.ts:484 + packages/app-engine/src/index.ts:1430"
  },
  {
    rule: "Compliance producer routes",
    currentBehavior: "POST /v1/app-store/compliance/customers/data-request, /customers/redact, and /shop/redact require merchant auth, store ownership, an idempotency key, and app webhook delivery configuration when active app subscriptions exist.",
    developerAction: "Use these routes from merchant/customer compliance workflows and dedupe events by X-LetBuyy-Event-ID on the partner callback.",
    source: "services/api-gateway/src/routes/app-store/compliance-routes.ts:129"
  }
];

export const webhookExamples: DocumentationExample[] = [
  {
    title: "Outbound Headers",
    description: "Headers sent to partner HTTPS callbacks for app lifecycle and queued delivery.",
    source: "services/webhook-service/src/app-lifecycle-dispatch.ts:94",
    code: `POST https://partner.example/letbuyy/webhooks
Content-Type: application/json
User-Agent: LetBuyy-App-Webhooks/1.0
X-LetBuyy-Event-ID: event_id
X-LetBuyy-Event-Type: app.installed
X-LetBuyy-Request-ID: request_id
X-LetBuyy-Trace-ID: trace_id
X-LetBuyy-Timestamp: 1780440300
X-LetBuyy-Hmac-SHA256: v1=<hex_digest>
X-LetBuyy-Signature: v1=<hex_digest>`
  },
  {
    title: "Outbound Body",
    description: "The body signed by the HMAC helper is the exact JSON payload delivered to the callback.",
    source: "services/webhook-service/src/app-lifecycle-dispatch.ts:83",
    code: `{
  "id": "event_id",
  "event_type": "app.installed",
  "created_at": "2026-06-03T04:05:00.000Z",
  "payload": {
    "installation_id": "installation_id",
    "app_id": "app_id",
    "store_id": "site_id"
  }
}`
  },
  {
    title: "Signing Payload",
    description: "The HMAC input is timestamp, a dot, and the unmodified raw request body.",
    source: "services/webhook-service/src/app-lifecycle-dispatch.ts:57",
    code: `const signingPayload = \`\${timestamp}.\${rawBody}\`;
const expectedHex = hmacSha256Hex(signingSecret, signingPayload);
const receivedHex = hmacHeader.replace(/^v1=/, "");
const valid = timingSafeEqualHex(expectedHex, receivedHex);`
  }
];

export const themeSdkFacts = [
  "The current theme package contract is a portable JSON bundle, not a published CLI.",
  "Schema version: 2026-05-json-contract.",
  "Required bundle areas include package metadata, settings schema/data, templates, sections, blocks, locales, and renderer manifest.",
  "Upload uses POST /v1/themes/packages/upload with UploadThemePackageSchema from @letbuyy/theme-engine.",
  "Section definitions can declare accepts_app_blocks so installed app blocks can render inside storefront theme slots."
];

export const themeBundleAreas: SdkContractRow[] = [
  {
    item: "package",
    currentContract: "slug, name, site_types, status, pricing_type, price, currency, version, version_number, release_status, compatibility_range.",
    notes: "Slug is lowercase kebab-case and release_status defaults to published.",
    source: "packages/theme-engine/src/theme-bundle.ts:140"
  },
  {
    item: "config.settings_schema",
    currentContract: "schema_version plus grouped settings fields using text, textarea, richtext, color, image, select, toggle, range, number, url, or radio.",
    notes: "Each setting group has label, description, and field definitions.",
    source: "packages/theme-engine/src/theme-bundle.ts:36 + :57"
  },
  {
    item: "config.settings_data",
    currentContract: "current settings object and named preset setting objects.",
    notes: "settings_data defaults to empty current and presets objects.",
    source: "packages/theme-engine/src/theme-bundle.ts:62 + :172"
  },
  {
    item: "templates",
    currentContract: "Template sections, section order, template section blocks, block order, and disabled flags.",
    notes: "Template order and block_order must reference existing local IDs.",
    source: "packages/theme-engine/src/theme-bundle.ts:67 + :81"
  },
  {
    item: "sections",
    currentContract: "Section type, name, renderer_key, settings_schema, defaults, block_types, accepts_app_blocks, presets, and enabled_on templates.",
    notes: "Section map keys must match section.type; block_types must reference existing block definitions.",
    source: "packages/theme-engine/src/theme-bundle.ts:120 + :192"
  },
  {
    item: "blocks",
    currentContract: "Block type, name, description, settings_schema, and defaults.",
    notes: "Block map keys must match block.type.",
    source: "packages/theme-engine/src/theme-bundle.ts:112 + :212"
  },
  {
    item: "locales",
    currentContract: "Locale dictionaries are JSON records; translation keys can be resolved through theme bundle localization helpers.",
    notes: "Default locale is en and translation references use the t: prefix.",
    source: "packages/theme-engine/src/theme-bundle.ts:138 + :273"
  },
  {
    item: "renderer",
    currentContract: "engine=json-contract, renderer_version=1.0.0, liquid_ready flag, and typed asset manifest.",
    notes: "The upload route accepts submission_mode marketplace or private_install.",
    source: "packages/theme-engine/src/theme-bundle.ts:157 + :255"
  }
];

export const themeValidationRules: SdkContractRow[] = [
  {
    item: "Package metadata",
    currentContract: "slug must be lowercase kebab-case; site_types, status, pricing_type, currency, version, version_number, release_status, and compatibility_range are schema validated.",
    notes: "Defaults exist for author_name, site_types, status, pricing_type, price, currency, version_number, release_status, and compatibility_range.",
    source: "packages/theme-engine/src/theme-bundle.ts:140"
  },
  {
    item: "Template order references",
    currentContract: "Each template order entry must reference an existing section ID in that template.",
    notes: "Invalid entries produce a custom issue at template.order.",
    source: "packages/theme-engine/src/theme-bundle.ts:81"
  },
  {
    item: "Template block order references",
    currentContract: "Each section block_order entry must reference an existing block ID under that template section.",
    notes: "Invalid entries produce a custom issue at sections.<sectionId>.block_order.",
    source: "packages/theme-engine/src/theme-bundle.ts:98"
  },
  {
    item: "Section key/type match",
    currentContract: "Each section definition map key must match the section.type value.",
    notes: "A mismatched key/type pair is rejected during ThemePackageBundleSchema superRefine.",
    source: "packages/theme-engine/src/theme-bundle.ts:191"
  },
  {
    item: "Block key/type match",
    currentContract: "Each block definition map key must match the block.type value.",
    notes: "A mismatched block definition key/type pair is rejected during bundle validation.",
    source: "packages/theme-engine/src/theme-bundle.ts:212"
  },
  {
    item: "Section block type references",
    currentContract: "Every section.block_types entry must reference an existing block definition.",
    notes: "Missing block definitions are reported against sections.<sectionType>.block_types.",
    source: "packages/theme-engine/src/theme-bundle.ts:201"
  },
  {
    item: "Template section definitions",
    currentContract: "Every template section type must reference an existing section definition in the bundle.",
    notes: "Missing section definitions are reported against templates.<templateKey>.sections.<sectionId>.type.",
    source: "packages/theme-engine/src/theme-bundle.ts:222"
  },
  {
    item: "Template block definitions",
    currentContract: "Every template block type must reference an existing block definition in the bundle.",
    notes: "Missing block definitions are reported against templates.<templateKey>.sections.<sectionId>.blocks.<blockId>.type.",
    source: "packages/theme-engine/src/theme-bundle.ts:233"
  },
  {
    item: "Allowed blocks per section",
    currentContract: "When a section definition declares block_types, template blocks inside that section must use one of those types.",
    notes: "The constraint is skipped only when the section definition has an empty block_types list.",
    source: "packages/theme-engine/src/theme-bundle.ts:243"
  },
  {
    item: "Validation issue formatting",
    currentContract: "validateThemeBundle returns { ok, bundle?, issues } and formats Zod issues as path-prefixed strings.",
    notes: "This is the current machine-readable validation result shape; no CLI wrapper exists yet.",
    source: "packages/theme-engine/src/theme-bundle.ts:450"
  },
  {
    item: "Locale lookup",
    currentContract: "Locales normalize underscores to dashes, prefer exact normalized locale, lowercase variant, language, then en.",
    notes: "Translation strings use the t: prefix and resolve dotted dictionary paths.",
    source: "packages/theme-engine/src/theme-bundle.ts:282 + :339"
  }
];

export const themeUploadGatewayContracts: SdkContractRow[] = [
  {
    item: "Upload body schema",
    currentContract: "POST /v1/themes/packages/upload validates a strict body with bundle and submission_mode; submission_mode is marketplace or private_install and defaults to marketplace.",
    notes: "Invalid JSON-contract bundles are rejected by UploadThemePackageSchema before route persistence runs.",
    source: "services/api-gateway/src/routes/themes.ts:467 + packages/theme-engine/src/theme-bundle.ts:255"
  },
  {
    item: "Merchant auth boundary",
    currentContract: "The upload route is protected by authMiddleware and resolves the custom merchant user before persistence.",
    notes: "Theme package upload is not a public unauthenticated package registry endpoint.",
    source: "services/api-gateway/src/routes/themes.ts:40 + :467"
  },
  {
    item: "Persistence adapter",
    currentContract: "SchemaRegistryExecutionAdapter parses the theme bundle, builds persistence payloads, and writes theme package/version records through the schema registry path.",
    notes: "The portal documents this as gateway-backed upload, not a local CLI package flow.",
    source: "services/api-gateway/src/execution/schema-registry-execution.adapter.ts:230"
  },
  {
    item: "Marketplace submission mode",
    currentContract: "marketplace mode is the default; the adapter treats it as review-required, forcing package and version status to draft before review.",
    notes: "Marketplace upload does not immediately mean public/installable listing approval.",
    source: "services/api-gateway/src/routes/themes.ts:478 + services/api-gateway/src/execution/schema-registry-execution.adapter.ts:236"
  },
  {
    item: "Private install mode",
    currentContract: "private_install mode returns the persisted upload with review_record: null.",
    notes: "This is a real upload mode, but no public Theme CLI or private install SDK wrapper exists yet.",
    source: "services/api-gateway/src/routes/themes.ts:491"
  },
  {
    item: "Review record",
    currentContract: "Marketplace uploads create a marketplace review record with automated checks bundle_schema_validation and theme_package_persistence.",
    notes: "Review metadata includes schema_manifest_version and renderer_version from the upload result.",
    source: "services/api-gateway/src/routes/themes.ts:495 + :506"
  },
  {
    item: "Theme submitted event",
    currentContract: "Marketplace uploads emit theme.submitted with idempotencyKey theme.submitted:<theme_package_id>:<theme_version_id>.",
    notes: "The event payload carries package/version identifiers and the optional review record id.",
    source: "services/api-gateway/src/routes/themes.ts:85 + :527"
  },
  {
    item: "Upload response fields",
    currentContract: "The schema registry upload response includes theme, package, version, schema_manifest_version, renderer_version, and installable.",
    notes: "installable is derived from active package status plus published version status.",
    source: "services/api-gateway/src/execution/schema-registry-execution.adapter.ts:395"
  },
  {
    item: "Install route separation",
    currentContract: "Applying a theme still uses POST /v1/themes/:slug/install with InstallThemeSchema and ThemeExecutionAdapter.installTheme.",
    notes: "Do not document package upload as the same operation as applying a theme to a store.",
    source: "services/api-gateway/src/routes/themes.ts:565"
  }
];

export const themeSdkExamples: DocumentationExample[] = [
  {
    title: "Theme Package Upload Request",
    description: "The upload route accepts a strict object with bundle and submission_mode.",
    source: "packages/theme-engine/src/theme-bundle.ts:255",
    code: `POST /v1/themes/packages/upload
Content-Type: application/json

{
  "submission_mode": "marketplace",
  "bundle": {
    "schema_version": "2026-05-json-contract",
    "package": {
      "slug": "example-theme",
      "name": "Example Theme",
      "site_types": ["store"],
      "version": "1.0.0",
      "pricing_type": "free",
      "price": 0,
      "currency": "INR"
    },
    "config": {
      "settings_schema": {
        "schema_version": "2026-05-json-contract",
        "settings": {}
      },
      "settings_data": {
        "current": {},
        "presets": {}
      }
    },
    "templates": {},
    "sections": {},
    "blocks": {},
    "locales": {},
    "renderer": {
      "engine": "json-contract",
      "renderer_version": "1.0.0",
      "liquid_ready": false,
      "assets": {}
    }
  }
}`
  },
  {
    title: "Theme Upload Response",
    description: "Marketplace submissions create a review record; private_install returns review_record as null.",
    source: "services/api-gateway/src/routes/themes.ts:491",
    code: `{
  "data": {
    "theme": { "id": "theme_id" },
    "package": { "id": "theme_package_id", "slug": "example-theme" },
    "schema_manifest_version": "2026-05-json-contract",
    "renderer_version": "1.0.0",
    "review_record": {
      "submission_type": "theme",
      "resource_id": "theme_package_id"
    }
  }
}`
  },
  {
    title: "Section With App Blocks",
    description: "A theme section definition can explicitly accept storefront app blocks.",
    source: "packages/theme-engine/src/theme-bundle.ts:120",
    code: `{
  "sections": {
    "product-main": {
      "type": "product-main",
      "name": "Product main",
      "renderer_key": "product-main",
      "accepts_app_blocks": true,
      "block_types": []
    }
  }
}`
  }
];

export const appSdkFacts = [
  "Admin embed surfaces are normalized from app installation config, app extensions, and app_url.",
  "Default app bridge capabilities are api.fetch, toast, and resize.",
  "Optional navigation.redirect is accepted when configured.",
  "Storefront app blocks can render inline or iframe blocks with heading, body, CTA label, CTA href, and iframe_url fields.",
  "Built-for-LetBuyy quality gate checks exist for performance, reviews, installs, app blocks, and privacy URL readiness."
];

export const appBridgeCapabilities: SdkContractRow[] = [
  {
    item: "api.fetch",
    currentContract: "Default app bridge capability. The current route is POST /v1/app-store/bridge/fetch and only proxies scoped GET reads.",
    notes: "Write-capable bridge calls remain [SKIP — NEEDS BACKEND/SDK].",
    source: "packages/app-engine/src/index.ts:190 + services/api-gateway/src/routes/app-store.ts:781"
  },
  {
    item: "toast",
    currentContract: "Default app bridge capability listed by app-engine.",
    notes: "There is no published browser app SDK package in this branch.",
    source: "packages/app-engine/src/index.ts:190"
  },
  {
    item: "resize",
    currentContract: "Default app bridge capability listed by app-engine.",
    notes: "Runtime behavior for resize is not exposed as a standalone gateway route.",
    source: "packages/app-engine/src/index.ts:190"
  },
  {
    item: "navigation.redirect",
    currentContract: "Optional capability accepted by app bridge capability normalization when configured.",
    notes: "It is not part of the default capability list.",
    source: "packages/app-engine/src/index.ts:251"
  },
  {
    item: "admin embed surface",
    currentContract: "Embed URL is resolved from install config, extension config, extension target, or app_url; localhost is only allowed when configured for local development.",
    notes: "Capabilities can be supplied through admin embed config, extension config, or install bridge_capabilities.",
    source: "packages/app-engine/src/index.ts:270"
  }
];

export const appSdkExamples: DocumentationExample[] = [
  {
    title: "Bridge Fetch Request",
    description: "Current app bridge reads require an app bearer token and method=GET.",
    source: "services/api-gateway/src/routes/app-store.ts:781",
    code: `POST /v1/app-store/bridge/fetch
Authorization: Bearer <app_token>
Content-Type: application/json

{
  "method": "GET",
  "path": "/products",
  "store_id": "site_id"
}`
  },
  {
    title: "Bridge Fetch Envelope",
    description: "Successful bridge calls wrap upstream response metadata and data.",
    source: "services/api-gateway/src/routes/app-store.ts:872",
    code: `{
  "data": {
    "ok": true,
    "status": 200,
    "data": {},
    "error": null
  }
}`
  }
];

export const sdkToolingGaps: ToolingGapDoc[] = [
  {
    capability: "OpenAPI export",
    currentStatus: "[SKIP — NEEDS BACKEND/SDK] Gateway routes are mounted under /v1, but no generated OpenAPI document is checked in for this branch.",
    blockedUntil: "Gateway schema/export tooling lands and publishes an artifact the portal can consume network-free.",
    source: "services/api-gateway/src/index.ts:161 + apps/developer-portal/CODEX_WS10_LEDGER.md"
  },
  {
    capability: "Published App SDK package",
    currentStatus: "PARTIAL: @letbuyy/api-client exports createLetbuyyAppSdk for scoped app API reads and app-owned metadata writes; no dedicated @letbuyy/app-sdk browser bridge package exists yet.",
    blockedUntil: "A package-owned SDK exports bridge fetch, session, toast, resize, and navigation helpers.",
    source: "packages/typescript/api-client/src/index.ts"
  },
  {
    capability: "Theme CLI scaffolder",
    currentStatus: "[SKIP — NEEDS BACKEND/SDK] Theme bundle validation exists as JSON-contract schemas, but no CLI generator or packager is present.",
    blockedUntil: "Theme tooling can scaffold, validate, package, and upload a bundle from local source.",
    source: "packages/theme-engine/src/theme-bundle.ts:117 + apps/developer-portal/CODEX_WS10_LEDGER.md"
  },
  {
    capability: "Webhook test sender UI",
    currentStatus: "[SKIP — NEEDS BACKEND/SDK] Webhook dispatch exists behind service/internal flows; no public developer test-delivery endpoint or UI exists.",
    blockedUntil: "A developer-owned test sender can sign and dispatch sample events without touching production merchant data.",
    source: "services/webhook-service/src/index.ts + apps/developer-portal/CODEX_WS10_LEDGER.md"
  },
  {
    capability: "Credential rotation console",
    currentStatus: "PARTIAL: backend app submission and API-key rotation routes exist with show-once credentials and hash-only persistence; dashboard inventory/revoke UI is not present.",
    blockedUntil: "The dashboard shell receives an authenticated adapter for list/revoke and key history views.",
    source: "services/api-gateway/src/routes/app-store/developer-routes.ts"
  },
  {
    capability: "Write-capable app bridge",
    currentStatus: "[SKIP — NEEDS BACKEND/SDK] The current app bridge accepts method=GET only and maps reads to approved first path segments.",
    blockedUntil: "Bridge authorization, CSRF/idempotency, scopes, and mutation route policy are implemented for write paths.",
    source: "services/api-gateway/src/routes/app-store.ts:781"
  }
];

export const skipItems: SkipItem[] = [
  {
    title: "Published JavaScript App SDK package",
    reason: "[SKIP — NEEDS SDK/CLI] A minimal createLetbuyyAppSdk wrapper exists in @letbuyy/api-client, but no dedicated @letbuyy/app-sdk browser bridge package exists in this branch."
  },
  {
    title: "Theme CLI scaffolder",
    reason: "[SKIP — NEEDS BACKEND/SDK] The theme contract exists as Zod schemas, but no CLI generator or packager is present."
  },
  {
    title: "OpenAPI export",
    reason: "[SKIP — NEEDS BACKEND/SDK] Hono routes exist, but no generated OpenAPI document is checked in for the gateway."
  },
  {
    title: "Webhook test sender UI",
    reason: "[SKIP — NEEDS BACKEND/SDK] Dispatch routes are internal and there is no public test delivery endpoint."
  },
  {
    title: "Live dashboard data",
    reason: "[SKIP — NEEDS BACKEND/SDK] Developer profile, submitted apps, review records, installs, and charges have routes, but this D0 app has no authenticated API adapter yet."
  },
  {
    title: "Write-capable app bridge",
    reason: "[SKIP — NEEDS BACKEND/SDK] bridge/fetch only supports scoped GET requests today."
  }
];

export const dashboardShell = [
  {
    label: "Developer profile",
    status: "API ready",
    detail: "GET /v1/app-store/developers/me"
  },
  {
    label: "Submitted apps",
    status: "API ready",
    detail: "GET /v1/app-store/developers/apps"
  },
  {
    label: "Review records",
    status: "API ready",
    detail: "Returned with developer app listings"
  },
  {
    label: "Partner dashboard",
    status: "Role gated",
    detail: "GET /v1/app-store/partners/dashboard requires partner role"
  },
  {
    label: "Webhook deliveries",
    status: "Internal only",
    detail: "No public developer endpoint yet"
  },
  {
    label: "API credentials",
    status: "Planned",
    detail: "[SKIP — NEEDS BACKEND/SDK]"
  }
];

export const dashboardSurfaces: DashboardSurfaceDoc[] = [
  {
    label: "Developer profile",
    route: "GET /v1/app-store/developers/me",
    auth: "merchant session",
    status: "available",
    currentPayload: "Returns the current user's app developer profile when one exists.",
    source: "services/api-gateway/src/routes/app-store.ts:1758"
  },
  {
    label: "Developer app list",
    route: "GET /v1/app-store/developers/apps",
    auth: "merchant session",
    status: "available",
    currentPayload: "Returns developer profile, submitted marketplace apps, and marketplace review records.",
    source: "services/api-gateway/src/routes/app-store.ts:1813"
  },
  {
    label: "Partner dashboard aggregate",
    route: "GET /v1/app-store/partners/dashboard",
    auth: "partner role",
    status: "available",
    currentPayload: "Aggregates developer profile, apps, review records, charges, payouts, development stores, collaborator access, and analytics.",
    source: "services/api-gateway/src/routes/app-store.ts:1877"
  },
  {
    label: "Partner collaborator code",
    route: "POST /v1/app-store/partners/collaborator-code",
    auth: "partner role",
    status: "available",
    currentPayload: "Mints a 15-minute request_code with read_products, write_themes, read_orders, and app_collaboration scopes.",
    source: "services/api-gateway/src/routes/app-store.ts:2052"
  },
  {
    label: "App charge creation",
    route: "POST /v1/app-store/installations/:id/charges",
    auth: "merchant session",
    status: "available",
    currentPayload: "Creates a merchant-approved app charge with idempotency, INR currency, payout plan, and approval URL.",
    source: "services/api-gateway/src/routes/app-store/billing-oauth-routes.ts + packages/billing-core/src/index.ts"
  },
  {
    label: "App charge approval",
    route: "POST /v1/app-store/charges/:id/approve",
    auth: "merchant session",
    status: "available",
    currentPayload: "Approves pending app charges, creates or returns a Razorpay payment order when configured, and emits app.charge.activated only after provider proof verifies.",
    source: "services/api-gateway/src/routes/app-store/billing-oauth-routes.ts + packages/billing-core/src/index.ts"
  },
  {
    label: "Credential management UI",
    route: "Portal control",
    auth: "planned",
    status: "skip",
    currentPayload: "[SKIP — NEEDS UI] Backend show-once app credential issuance and API-key rotation exist, but no authenticated portal inventory/revoke UI exists in this branch.",
    source: "services/api-gateway/src/routes/app-store/developer-routes.ts"
  }
];
