export type RouteGroup = {
  title: string;
  source: string;
  status: "Live" | "Partial" | "Planned";
  summary: string;
  routes: string[];
};

export type GuideCard = {
  title: string;
  status: "Live contract" | "Partial" | "SKIP - NEEDS BACKEND" | "SKIP - NEEDS SDK/CLI";
  body: string;
  bullets: string[];
};

export const sourceFiles = [
  "services/api-gateway/src/index.ts",
  "services/api-gateway/src/routes/app-store.ts",
  "services/api-gateway/src/extensions/app-functions-runtime.ts",
  "services/api-gateway/src/routes/themes.ts",
  "services/api-gateway/src/middleware/rateLimit.ts",
  "services/webhook-service/src/app-lifecycle-dispatch.ts",
  "packages/auth-core/src/index.ts",
  "packages/app-engine/src/index.ts",
  "packages/extension-host/src/index.ts",
  "packages/theme-engine/src/theme-bundle.ts",
];

export const apiRouteGroups: RouteGroup[] = [
  {
    title: "Gateway Mounts",
    source: "services/api-gateway/src/index.ts",
    status: "Live",
    summary: "The Hono worker mounts its public and protected surface under `/v1`, with `/health` outside the API version.",
    routes: [
      "GET /health",
      "/v1/auth",
      "/v1/storefront",
      "/v1/stores",
      "/v1/products",
      "/v1/orders",
      "/v1/payments",
      "/v1/themes",
      "/v1/app-store",
      "/v1/operations",
    ],
  },
  {
    title: "Auth and Sessions",
    source: "services/api-gateway/src/routes/auth.ts",
    status: "Live",
    summary: "Merchant identity endpoints include signup, signin, OTP, password reset/update, custom session validation, and identity-platform helpers.",
    routes: [
      "POST /v1/auth/signup",
      "POST /v1/auth/signin",
      "POST /v1/auth/signin/otp",
      "POST /v1/auth/signin/otp/verify",
      "POST /v1/auth/signout",
      "POST /v1/auth/password/reset",
      "POST /v1/auth/password/update",
      "GET /v1/auth/custom/session",
    ],
  },
  {
    title: "Commerce Admin",
    source: "services/api-gateway/src/routes/products.ts, orders.ts, customers.ts",
    status: "Live",
    summary: "Store-scoped merchant APIs cover products, collections, gift cards, orders, refunds, fulfillment, customers, addresses, reviews, coupons, inventory, media, and forms.",
    routes: [
      "GET|POST /v1/products",
      "GET|POST /v1/products/collections",
      "GET|POST /v1/products/gift-cards",
      "GET|POST /v1/orders",
      "POST /v1/orders/:id/fulfill",
      "POST /v1/orders/:id/refund",
      "GET /v1/customers",
      "GET|POST /v1/inventory/locations",
      "GET /v1/form-submissions",
    ],
  },
  {
    title: "Storefront Runtime",
    source: "services/api-gateway/src/routes/storefront.ts",
    status: "Live",
    summary: "Public storefront APIs resolve stores, products, categories, navigation, policies, persisted carts, checkout order creation, provider payment operations, customer accounts, wishlist, addresses, and reviews.",
    routes: [
      "GET /v1/storefront/lookup",
      "GET /v1/storefront/:subdomain",
      "GET /v1/storefront/:subdomain/products",
      "GET|POST|PATCH|DELETE /v1/storefront/:subdomain/cart",
      "POST /v1/storefront/:subdomain/orders",
      "POST /v1/storefront/:subdomain/payments/razorpay/order",
      "POST /v1/storefront/customer/login",
      "GET|POST|PATCH|DELETE /v1/storefront/customer/addresses",
    ],
  },
  {
    title: "GraphQL APIs",
    source: "services/api-gateway/src/graphql/schema.ts, storefront.ts, admin.ts",
    status: "Partial",
    summary: "Admin and Storefront GraphQL endpoints are mounted behind the gateway with query-cost limiting. Storefront cart reads delegate to the persisted cart-token REST contract; writes remain on REST.",
    routes: [
      "GET|POST /v1/admin/graphql",
      "GET|POST /v1/graphql/admin",
      "GET|POST /v1/storefront/graphql",
      "GET|POST /v1/graphql/storefront",
      "StorefrontQuery.cart -> persisted cart token",
      "Admin bulk operations -> Cloudflare R2 JSONL",
    ],
  },
  {
    title: "Theme Platform",
    source: "services/api-gateway/src/routes/themes.ts",
    status: "Live",
    summary: "Theme APIs cover marketplace catalog, JSON-contract package upload, Liquid/JSON rendering assets, install, multi-template editor state, draft save/delete, preview tokens, release history, rollback, purchase, and payment verification.",
    routes: [
      "GET /v1/themes",
      "GET /v1/themes/:slug/schema",
      "GET /v1/themes/:slug/editor",
      "PUT /v1/themes/:slug/editor/draft",
      "POST /v1/themes/:slug/preview-session",
      "POST /v1/themes/packages/upload",
      "POST /v1/themes/:slug/install",
      "POST /v1/themes/:slug/purchase/verify",
    ],
  },
  {
    title: "App Platform",
    source: "services/api-gateway/src/routes/app-store.ts",
    status: "Live",
    summary: "App marketplace APIs include catalog, reviews, installation, extension/function lifecycle registry, app bridge fetch, OAuth authorization code, token exchange, developer profile, developer app submissions, and partner dashboard aggregates.",
    routes: [
      "GET /v1/app-store/apps",
      "POST /v1/app-store/apps/:id/install",
      "GET /v1/app-store/installations/:id/extensions",
      "PATCH /v1/app-store/installations/:id/extensions/:registrationId",
      "PATCH /v1/app-store/installations/:id/functions/:registrationId",
      "POST /v1/app-store/apps/:id/oauth/authorize",
      "POST /v1/app-store/oauth/token",
      "POST /v1/app-store/oauth/token-exchange",
      "POST /v1/app-store/bridge/fetch",
      "GET|POST /v1/app-store/developers/register",
      "GET /v1/app-store/partners/dashboard",
    ],
  },
  {
    title: "Operations and Webhook Admin",
    source: "services/api-gateway/src/routes/operations.ts",
    status: "Live",
    summary: "Operational APIs expose outbox, webhook deliveries/subscriptions, runtime queues, replays, incidents, failover drills, load tests, certification reports, and SRE evidence.",
    routes: [
      "GET /v1/operations/webhook-deliveries",
      "GET|POST /v1/operations/webhook-subscriptions",
      "GET /v1/operations/runtime/overview",
      "GET|POST /v1/operations/runtime/replays",
      "GET|POST /v1/operations/runtime/incidents",
      "POST /v1/operations/runtime/failover-drills",
    ],
  },
];

export const rateLimitFacts = [
  "Query-cost limiting is skipped in local/development runtimes.",
  "Default query-cost bucket: capacity 200, leak rate 20 points per second.",
  "GET and HEAD start at cost 1; POST, PUT, and PATCH start at cost 5; DELETE starts at cost 8.",
  "limit/page_size/first values above 50 add cost; each include or expand item adds 2.",
  "Analytics/export add 15, operations add 10, AI adds 20, and internal routes add 10.",
  "Responses include X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Cost, and X-RateLimit-Policy.",
];

export const oauthGuide: GuideCard[] = [
  {
    title: "Authorization code",
    status: "Live contract",
    body: "A merchant authorizes a published app through `/v1/app-store/apps/:id/oauth/authorize`. The gateway verifies store ownership, requested scopes, redirect URI, and PKCE S256 challenge before upserting an active installation.",
    bullets: [
      "Grant type is `authorization_code`.",
      "Authorization codes are short lived and expire after 15 minutes.",
      "The app must keep the original `code_verifier`; token exchange rejects missing or mismatched PKCE proof.",
      "The response includes `redirect_to`, `code`, `state`, granted scopes, app id, installation id, and store id.",
    ],
  },
  {
    title: "Access token exchange",
    status: "Live contract",
    body: "`POST /v1/app-store/oauth/token` exchanges the authorization code for a scoped app access token after checking client id, redirect URI, PKCE verifier, active installation, and one-time code redemption. The same endpoint supports `grant_type=refresh_token` and rotates the stored refresh-token hash.",
    bullets: [
      "Authorization-code and refresh-token responses include `access_token`, `refresh_token`, `token_type`, `expires_at`, `refresh_expires_at`, `scope`, and `scopes`.",
      "Auth-core signs app access tokens as JWTs with normalized scopes.",
      "The installation config stores token hashes, not raw returned access or refresh tokens.",
    ],
  },
  {
    title: "Embedded token exchange",
    status: "Live contract",
    body: "`POST /v1/app-store/oauth/token-exchange` exchanges an authenticated merchant session for an embedded app token tied to an installation and store.",
    bullets: [
      "Requires protected merchant auth middleware.",
      "Validates active installation and store ownership.",
      "Used by embedded app surfaces and the app bridge fetch contract.",
    ],
  },
];

export const webhookGuide: GuideCard[] = [
  {
    title: "HMAC signing",
    status: "Live contract",
    body: "App lifecycle webhooks are sent by `services/webhook-service` and signed with the `X-LetBuyy-Hmac-SHA256` header.",
    bullets: [
      "Signature payload is `X-LetBuyy-Timestamp + '.' + rawBody`.",
      "Header value is versioned as `v1=<hex-hmac>`.",
      "The legacy `X-LetBuyy-Signature` header is also sent for compatibility.",
    ],
  },
  {
    title: "Delivery headers",
    status: "Live contract",
    body: "Webhook deliveries include event, request, trace, and timestamp metadata so receivers can verify, deduplicate, and correlate processing.",
    bullets: [
      "Headers include event id, event type, request id, trace id, timestamp, and HMAC signature.",
      "Webhook targets must be HTTPS in staging and production.",
      "The service records response status, a response preview, and request errors.",
    ],
  },
  {
    title: "Compliance topics",
    status: "Live contract",
    body: "App-engine always includes mandatory compliance topics when planning app webhook subscriptions, and the app-store gateway emits those topics from compliance producer routes.",
    bullets: [
      "`POST /v1/app-store/compliance/customers/data-request` emits `customers/data_request`.",
      "`POST /v1/app-store/compliance/customers/redact` emits `customers/redact`.",
      "`POST /v1/app-store/compliance/shop/redact` and app uninstall emit `shop/redact`.",
    ],
  },
  {
    title: "Retry operations",
    status: "Live contract",
    body: "Operational retry and dispatch controls are exposed through `/v1/operations` webhook-delivery and outbox endpoints.",
    bullets: [
      "`POST /v1/operations/webhook-deliveries/dispatch` dispatches pending deliveries.",
      "Outbox dispatch and dead-letter replay endpoints exist for operations users.",
      "Developer self-serve retry APIs are not exposed yet.",
    ],
  },
];

export const sdkGuides: GuideCard[] = [
  {
    title: "Theme bundle contract",
    status: "Live contract",
    body: "Theme packages use the JSON-contract bundle from `packages/theme-engine/src/theme-bundle.ts` and upload through `/v1/themes/packages/upload`. Liquid sections and blocks render through the LiquidJS-backed renderer in `packages/theme-engine/src/theme-renderer.ts`.",
    bullets: [
      "`config/settings_schema.json` defines grouped editable settings.",
      "`config/settings_data.json` stores current and preset values.",
      "`templates/*.json` references section and block instances across home, product, collection, page, cart, and blog templates.",
      "`sections/manifest.json` and `blocks/definitions.json` define reusable section/block schemas.",
      "`renderer.engine = liquid` is supported for Liquid templates; JSON-contract sections remain the portable configuration layer.",
      "Merchant editor drafts are scoped by `template_key`, so editing Product does not overwrite Home.",
      "`locales/*.json` stores translation dictionaries.",
    ],
  },
  {
    title: "App manifest and extensions",
    status: "Live contract",
    body: "App-engine publishes manifest schema `2026-06-05.ws13`, the extension registry, and lifecycle contract `2026-06-05.ws13.lifecycle` for Admin UI, Checkout UI, theme app blocks, and Wasm Functions.",
    bullets: [
      "`POST /v1/app-store/developers/apps/manifest/validate` validates and normalizes manifests without creating an app.",
      "Admin UI and Checkout UI extensions render through `@letbuyy/extension-host` sandbox policies.",
      "Theme app blocks install as WS11 portable Liquid app blocks and require no storefront source changes.",
      "Checkout Functions are advisory only: they can apply discount codes, select shipping methods, restrict payment methods, and return validation errors; they cannot set arbitrary totals, taxes, line prices, or payment amounts.",
      "Wasm Functions use HTTPS module URLs, SHA-256 verification, no imports, typed JSON I/O, and 1-5ms budgets.",
      "Per-store registry rows expose `enabled`, `disabled`, and `revoked` lifecycle state.",
    ],
  },
  {
    title: "Extension lifecycle and observability",
    status: "Live contract",
    body: "`GET /v1/app-store/installations/:id/extensions` returns extension/function rows plus a lifecycle snapshot, developer handoff, and app review checklist. Runtime metrics are optional-table safe and keyed by store, installation, app, registration, hook, and status.",
    bullets: [
      "`app_extension.lifecycle.status_changed` records merchant enable/disable state changes.",
      "`app_function.execution.count`, `app_function.execution.duration_ms`, and `app_function.execution.failed_securely` record Function execution outcomes.",
      "Uninstall revokes extension and Function registry rows, sets `revoked_at`, and removes them from public storefront/runtime resolution.",
      "Marketplace app review packets include the same lifecycle checklist for platform operations.",
    ],
  },
  {
    title: "Minimal App SDK wrapper",
    status: "Live contract",
    body: "`@letbuyy/api-client` exports `createLetbuyyAppSdk`, a small scoped-app wrapper over the versioned app API for installed app bearer tokens.",
    bullets: [
      "`sdk.products()` calls `/v1/app/products` with `read_products` scope.",
      "`sdk.orders()` calls `/v1/app/orders` with `read_orders` scope.",
      "`sdk.updateInstallationMetadata()` calls `/v1/app/installation/metadata` with `write_app_metadata` scope.",
    ],
  },
  {
    title: "LetBuyy CLI",
    status: "SKIP - NEEDS SDK/CLI",
    body: "No tracked `@letbuyy/cli`, theme CLI, app CLI, or `create-letbuyy` package exists in the active workspace.",
    bullets: [
      "Use the JSON-contract schema and gateway upload endpoint for now.",
      "Local dev scaffolding remains a planned SDK/CLI artifact.",
      "Do not publish CLI commands in docs as available until the package exists.",
    ],
  },
  {
    title: "Partner API keys",
    status: "Live contract",
    body: "The gateway issues show-once app developer credentials during app submission and can rotate a show-once app API key for an owned app. Plaintext keys are never documented as persisted; the backend stores hash-only credential metadata.",
    bullets: [
      "`POST /v1/app-store/developers/apps` returns `credentials` with `oauth_client_id`, show-once `client_secret`, and show-once `api_key`.",
      "`POST /v1/app-store/developers/apps/:id/api-key` rotates the show-once API key for an app owned by the current developer profile.",
      "Credential metadata is stored hash-only in gateway-owned app records; plaintext keys must be copied by the developer at creation time.",
    ],
  },
];

export const dashboardShell: GuideCard[] = [
  {
    title: "Apps and submissions",
    status: "Live contract",
    body: "Current developer apps and review records can be listed through `/v1/app-store/developers/apps` after a developer profile exists.",
    bullets: [
      "Developer registration is available at `/v1/app-store/developers/register`.",
      "Partner dashboard aggregates are available at `/v1/app-store/partners/dashboard` for partner roles.",
      "Marketplace app submissions are accepted at `/v1/app-store/developers/apps`.",
    ],
  },
  {
    title: "Themes",
    status: "Partial",
    body: "Theme packages can be uploaded and reviewed, but a partner-owned theme dashboard endpoint distinct from marketplace operations is not present.",
    bullets: [
      "`POST /v1/themes/packages/upload` validates and persists JSON-contract bundles.",
      "Operations review endpoints handle marketplace review decisions.",
      "Self-serve theme listing metrics remain a planned partner API.",
    ],
  },
  {
    title: "API keys",
    status: "Partial",
    body: "Gateway-backed app credential issuance and key rotation exist, but a full dashboard inventory/revoke UI is still planned.",
    bullets: [
      "`POST /v1/app-store/developers/apps` returns show-once credentials for the submitted app.",
      "`POST /v1/app-store/developers/apps/:id/api-key` rotates a show-once API key.",
      "List/revoke UI and CLI commands remain planned SDK/portal work.",
    ],
  },
  {
    title: "Analytics and earnings",
    status: "SKIP - NEEDS BACKEND",
    body: "Partner dashboard aggregates exist, but itemized app/theme earnings, payout exports, API call analytics, and install funnel analytics are not yet separate developer endpoints.",
    bullets: [
      "Render zero-state shell only.",
      "Do not fabricate earnings, payouts, or API traffic.",
      "Future data must come from `/v1/app-store/partners/dashboard` or a new partner API.",
    ],
  },
];

export const themeBundleExample = `{
  "schema_version": "2026-05-json-contract",
  "package": {
    "slug": "starter-commerce",
    "name": "Starter Commerce",
    "author_name": "Example Studio",
    "site_types": ["store"],
    "pricing_type": "free",
    "currency": "INR",
    "version": "1.0.0"
  },
  "config": {
    "settings_schema": {
      "settings": {
        "brand": {
          "label": "Brand",
          "fields": {
            "accent": { "type": "color", "label": "Accent", "default": "#0f766e" }
          }
        }
      }
    },
    "settings_data": { "current": {}, "presets": {} }
  },
  "templates": {
    "index": {
      "sections": {
        "hero": { "type": "hero", "settings": {}, "blocks": {}, "block_order": [] }
      },
      "order": ["hero"]
    }
  },
  "sections": {
    "hero": {
      "type": "hero",
      "name": "Hero",
      "liquid_template": "<section>{{ section.settings.heading }}</section>",
      "renderer_key": "hero",
      "settings_schema": {},
      "block_types": []
    }
  },
  "blocks": {},
  "locales": { "en": {} }
}`;

export const appInstallExample = `POST /v1/app-store/apps/:id/oauth/authorize
{
  "store_id": "site_uuid",
  "redirect_uri": "https://partner.example/oauth/callback",
  "code_challenge": "base64url_sha256_of_pkce_verifier",
  "code_challenge_method": "S256",
  "scopes": ["read_products"],
  "state": "opaque-csrf-state",
  "webhook_url": "https://partner.example/webhooks/letbuyy"
}`;
