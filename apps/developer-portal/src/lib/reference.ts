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
  "services/api-gateway/src/routes/themes.ts",
  "services/api-gateway/src/middleware/rateLimit.ts",
  "services/webhook-service/src/app-lifecycle-dispatch.ts",
  "packages/auth-core/src/index.ts",
  "packages/app-engine/src/index.ts",
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
    summary: "Public storefront APIs resolve stores, products, categories, navigation, policies, checkout order creation, provider payment operations, customer accounts, wishlist, addresses, and reviews.",
    routes: [
      "GET /v1/storefront/lookup",
      "GET /v1/storefront/:subdomain",
      "GET /v1/storefront/:subdomain/products",
      "POST /v1/storefront/:subdomain/orders",
      "POST /v1/storefront/:subdomain/payments/razorpay/order",
      "POST /v1/storefront/customer/login",
      "GET|POST|PATCH|DELETE /v1/storefront/customer/addresses",
    ],
  },
  {
    title: "Theme Platform",
    source: "services/api-gateway/src/routes/themes.ts",
    status: "Live",
    summary: "Theme APIs cover marketplace catalog, package upload, install, editor state, draft save/delete, preview tokens, release history, rollback, purchase, and payment verification.",
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
    summary: "App marketplace APIs include catalog, reviews, installation, app bridge fetch, OAuth authorization code, token exchange, developer profile, developer app submissions, and partner dashboard aggregates.",
    routes: [
      "GET /v1/app-store/apps",
      "POST /v1/app-store/apps/:id/install",
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
    body: "A merchant authorizes a published app through `/v1/app-store/apps/:id/oauth/authorize`. The gateway verifies store ownership, requested scopes, and redirect URI before upserting an active installation.",
    bullets: [
      "Grant type is `authorization_code`.",
      "Authorization codes are short lived and expire after 15 minutes.",
      "The response includes `redirect_to`, `code`, `state`, granted scopes, app id, installation id, and store id.",
    ],
  },
  {
    title: "Access token exchange",
    status: "Live contract",
    body: "`POST /v1/app-store/oauth/token` exchanges the authorization code for a scoped app access token after checking client id, redirect URI, active installation, and one-time code redemption.",
    bullets: [
      "Token response includes `access_token`, `token_type`, `expires_in`, `expires_at`, `scope`, and `scopes`.",
      "Auth-core signs app access tokens as JWTs with normalized scopes.",
      "The installation config stores token hashes, not raw returned tokens.",
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
    body: "App-engine always includes mandatory compliance topics when planning app webhook subscriptions.",
    bullets: [
      "`customers/data_request`",
      "`customers/redact`",
      "`shop/redact`",
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
    body: "Theme packages use the JSON-contract bundle from `packages/theme-engine/src/theme-bundle.ts` and upload through `/v1/themes/packages/upload`.",
    bullets: [
      "`config/settings_schema.json` defines grouped editable settings.",
      "`config/settings_data.json` stores current and preset values.",
      "`templates/*.json` references section and block instances.",
      "`sections/manifest.json` and `blocks/definitions.json` define reusable section/block schemas.",
      "`locales/*.json` stores translation dictionaries.",
    ],
  },
  {
    title: "App manifest and extensions",
    status: "Live contract",
    body: "App-engine supports developer registration, marketplace app submissions, admin embed extensions, app blocks, OAuth scopes, and lifecycle webhook planning.",
    bullets: [
      "Admin embed extensions resolve URL, label, target, and bridge capabilities from app extension config.",
      "Storefront app blocks carry app id, extension id, slot, render mode, settings, and optional iframe URL.",
      "Scopes are validated against `marketplace_apps.api_scopes` during install authorization.",
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
    status: "SKIP - NEEDS BACKEND",
    body: "The gateway exposes OAuth tokens and bridge tokens for installed apps, but a self-serve API key inventory/rotation endpoint is not present.",
    bullets: [
      "Dashboard shell renders this as a planned capability.",
      "Do not claim key creation, key reveal, or rotation until backend endpoints exist.",
      "Future data must remain behind versioned `/v1` contracts.",
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
    status: "SKIP - NEEDS BACKEND",
    body: "No partner API key inventory, create, revoke, or rotate endpoint is present in the gateway.",
    bullets: [
      "OAuth access tokens exist for app installs.",
      "Embedded bridge tokens exist for installed embedded apps.",
      "Long-lived partner key management needs a governed backend contract.",
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
  "scopes": ["read_products"],
  "state": "opaque-csrf-state",
  "webhook_url": "https://partner.example/webhooks/letbuyy"
}`;
