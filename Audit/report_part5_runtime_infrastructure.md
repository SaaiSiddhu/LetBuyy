# 🏪 LetBuyy Store — Comprehensive Codebase Report
## Part 5: Runtime Packages, Dart Packages, Services & Infrastructure

---

## 1. Runtime & Orchestration Packages

### 1.1 `@letbuyy/application-services` — 14 files

> **Purpose:** Workflow orchestration, use-case contracts, execution policy inputs, transaction boundaries, and cross-domain coordination.

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | Barrel | Re-exports all contracts |
| `analytics-workflow.ts` | ~120 | Analytics data aggregation workflows |
| `auth-workflow.ts` | ~110 | Auth flow coordination (signup → onboard → session) |
| `billing-workflow.ts` | ~100 | Subscription, invoice, entitlement workflows |
| `checkout-workflow.ts` | ~200 | Order creation → payment → fulfillment orchestration |
| `cms-workflow.ts` | ~100 | Page/blog/media publication workflows |
| `commerce-workflow.ts` | ~180 | Product lifecycle, inventory, catalog workflows |
| `notification-workflow.ts` | ~80 | Notification dispatch orchestration |
| `onboarding-workflow.ts` | ~120 | Store creation and onboarding |
| `operations-workflow.ts` | ~150 | Platform operations, incidents, deployments |
| `search-workflow.ts` | ~90 | Search indexing orchestration |
| `storefront-workflow.ts` | ~120 | Storefront rendering, customer, cart workflows |
| `theme-workflow.ts` | ~130 | Theme install → edit → publish → rollback workflows |

### 1.2 `@letbuyy/distributed-runtime` — 32 files

> **Purpose:** Durable event persistence, distributed queues, CQRS, checkpoints, replay, worker coordination, resilience, telemetry, cache, tenant scaling, and regional execution contracts.

| File Category | Files | Purpose |
|---------------|-------|---------|
| **Queue Runtime** | `queue-runtime.ts`, `queue-operations-runtime.ts` | Queue management, dead-letter, consumption |
| **Checkpoint** | `checkpoint-runtime.ts`, `checkpoint-coordination-runtime.ts` | State checkpointing, coordination |
| **Replay** | `replay-storage-runtime.ts`, `replay-operations-runtime.ts`, `replay-recovery-runtime.ts`, `replay-simulation-runtime.ts` | Event replay system |
| **Resilience** | `resilience-runtime.ts`, `circuit-breaker-governance-runtime.ts` | Circuit breakers, fallback policies |
| **Cache** | `cache-operations-runtime.ts`, `distributed-cache-coherence-runtime.ts` | Distributed cache management |
| **Telemetry** | `telemetry-runtime.ts`, `telemetry-operations-runtime.ts` | Metrics, tracing, observability |
| **Tenant** | `tenant-operations-runtime.ts`, `tenant-scalability-runtime.ts` | Tenant isolation, scaling |
| **WAL** | `wal-lifecycle-runtime.ts` | Write-ahead log lifecycle |
| **Recovery** | `saga-recovery-runtime.ts`, `rollback-orchestration-runtime.ts`, `rollback-intelligence-runtime.ts` | Saga compensation, rollback |
| **State** | `runtime-state-machine-runtime.ts`, `runtime-causality-graph-runtime.ts`, `runtime-memory-model-runtime.ts` | State machine execution |
| **Governance** | `saturation-governance-runtime.ts`, `observability-governance-runtime.ts` | Governance enforcement |
| **DAG** | `resumable-dag-execution-runtime.ts` | Directed acyclic graph execution |
| **Coordination** | `runtime-reconciliation-runtime.ts`, `runtime-transition-lineage-runtime.ts` | Runtime coordination |
| **Security** | `security-runtime.ts` | Security enforcement |
| **Regional** | `regional-execution-runtime.ts` | Multi-region execution |

### 1.3 `@letbuyy/orchestration` — 15 files

> **Purpose:** Workflow, event, outbox, replay, async execution, recovery, checkpoint, saga, retry, and orchestration coordination.

| File | Purpose |
|------|---------|
| `workflow-operations-runtime.ts` | Workflow lifecycle management |
| `workflow-checkpoint-runtime.ts` | Workflow state checkpointing |
| `workflow-continuation-runtime.ts` | Workflow continuation tokens |
| `workflow-durability-runtime.ts` | Durable workflow persistence |
| `workflow-recovery-runtime.ts` | Workflow failure recovery |
| `event-runtime.ts` | Event routing and dispatching |
| `outbox-runtime.ts` | Transactional outbox pattern |
| `replay-runtime.ts` | Event replay execution |
| `async-execution-runtime.ts` | Async task execution |
| `execution-coordination-runtime.ts` | Multi-step execution coordination |
| `reliability-runtime.ts` | Retry, circuit breaker, timeout policies |
| `observability-runtime.ts` | Orchestration observability |

### 1.4 `@letbuyy/projection-runtime` — 15 files

> **Purpose:** Read model persistence, aggregation stores, cache-aware projections, rebuild/replay, snapshots, hydration, invalidation.

| File | Purpose |
|------|---------|
| `projection-store.ts` | Projection data storage |
| `aggregation-store.ts` | Aggregated read model storage |
| `projection-cache-runtime.ts` | Cache-aware projections |
| `projection-checkpoint-runtime.ts` | Projection checkpointing |
| `projection-consistency-runtime.ts` | Consistency guarantees |
| `projection-invalidation-runtime.ts` | Cache invalidation |
| `projection-lifecycle-runtime.ts` | Projection lifecycle management |
| `projection-operations-runtime.ts` | Operational management |
| `projection-rebuild-runtime.ts` | Full projection rebuild |
| `projection-rebuild-planner-runtime.ts` | Rebuild planning |
| `projection-reconciliation-runtime.ts` | Data reconciliation |
| `projection-replay-runtime.ts` | Replay-based rebuild |
| `query-snapshot-runtime.ts` | Point-in-time query snapshots |
| `read-model-hydration-runtime.ts` | Read model hydration |

### 1.5 `@letbuyy/runtime-composition` — 14 files

> **Purpose:** Read orchestration, query aggregation, projection assembly, cache policy, hydration, and runtime response shaping.

**Core files:**
- `composition-runtime.ts` — Response composition engine
- `query-runtime.ts` — Query execution layer
- `projection.ts` — Projection assembly
- `projection-execution-runtime.ts` — Projection execution
- `search-projection-runtime.ts` — Search-specific projections

**Query Layers (5 adapter files):**
| Adapter | Purpose |
|---------|---------|
| `analytics-query-layer/` | Analytics data aggregation |
| `checkout-runtime-adapter/` | Checkout query composition |
| `identity-runtime-adapter/` | Identity/auth query composition |
| `merchant-query-layer/` | Merchant dashboard data |
| `mobile-query-layer/` | Mobile-optimized queries |
| `storefront-query-layer/` | Storefront public queries |

---

## 2. `@letbuyy/infrastructure` — 12 Provider Adapters

> **Purpose:** Provider SDKs, external APIs, storage, queue, cache, analytics, search, payment, provider resilience, retries, and adapter normalization.

| Adapter | File | Purpose |
|---------|------|---------|
| `analytics-adapter/` | Analytics provider abstraction | PostHog, Plausible, custom |
| `cache-adapter/` | Cache provider abstraction | Upstash Redis, KV |
| `cloudflare-adapter/` | Cloudflare Workers bindings | KV, R2, D1, Queues |
| `paypal-adapter/` | PayPal REST SDK adapter | Orders, captures, refunds |
| `provider-resilience-adapter/` | Cross-provider resilience | Circuit breakers, retries, fallback |
| `queue-adapter/` | Queue provider abstraction | Cloudflare Queues, BullMQ |
| `razorpay-adapter/` | Razorpay SDK adapter | Orders, payments, verification |
| `resend-adapter/` | Resend email SDK adapter | Transactional email |
| `search-provider-adapter/` | Search provider abstraction | Typesense, Meilisearch, PG FTS |
| `storage-adapter/` | Storage provider abstraction | Cloudflare R2, S3 |
| `stripe-adapter/` | Stripe SDK adapter | Checkout, payments, webhooks |
| `supabase-adapter/` | Supabase client adapter | Auth, DB, Storage, Realtime |

---

## 3. Shared TypeScript Packages

### 3.1 `@letbuyy/ui` — 3 Components

| Component | File | Lines | Props |
|-----------|------|-------|-------|
| `Button` | `button.tsx` | ~50 | variant, size, asChild, disabled, className |
| `Input` | `input.tsx` | ~30 | Standard HTML input props |
| `DataTable` | `data-table.tsx` | ~80 | columns, data, pagination |

> [!WARNING]
> **Lesson 19:** Only 3 shared components exist. Each app re-implements common UI independently. Needs extraction.

### 3.2 `@letbuyy/utils` — 3 Utility Modules

| Module | Purpose |
|--------|---------|
| `supabase.ts` | `createClient()` — Server/client Supabase client factory |
| `auth.ts` | Auth utility functions — session extraction, token validation |
| `api.ts` | API client helpers — fetch wrappers, error handling |

### 3.3 `@letbuyy/api-types` — 2 Files

| File | Purpose |
|------|---------|
| `index.ts` | Re-exports domain package types for backward compat |
| `theme-registry.ts` | Theme registry type contracts |

---

## 4. Dart/Flutter Packages

### 4.1 `packages/dart/core/` — 30 files

> **Purpose:** Constants, configuration, responsive helpers, and platform utilities for all Flutter apps.

**Key modules:**
- `api_config.dart` — API base URL, endpoints configuration
- `razorpay_config.dart` — Razorpay key configuration
- `app_constants.dart` — App-wide constants
- `responsive_helper.dart` — Screen size breakpoints
- `platform_utils.dart` — Platform detection utilities
- `string_extensions.dart` — Dart string helpers
- `color_utils.dart` — Color manipulation utilities

### 4.2 `packages/dart/models/` — 60 files

> **Purpose:** All Dart data models for commerce, seller, order, cart, analytics, returns, and notifications.

| Model Category | Key Models |
|----------------|-----------|
| **Commerce** | `ProductModel`, `ProductVariant`, `ProductOption`, `CategoryModel`, `CollectionModel` |
| **Seller** | `SellerModel`, `SellerProfile`, `StoreModel`, `StoreSettings` |
| **Order** | `OrderModel`, `OrderItem`, `OrderStatus`, `OrderCustomer`, `ShippingAddress` |
| **Cart** | `CartItem`, `CartModel`, `CartPricing` |
| **Payment** | `PaymentModel`, `PaymentMethod`, `RazorpayOrder` |
| **Analytics** | `AnalyticsModel`, `RevenueData`, `SalesMetrics`, `VisitorStats` |
| **Customer** | `CustomerModel`, `CustomerAddress` |
| **Return** | `ReturnModel`, `ReturnItem`, `RefundModel` |
| **Notification** | `NotificationModel`, `NotificationTemplate` |
| **Theme** | `ThemeModel`, `ThemeSettings`, `SectionModel`, `BlockModel` |
| **Subscription** | `PlanModel`, `SubscriptionModel` |

### 4.3 `packages/dart/services/` — 53 files

> **Purpose:** All data services, payment handling, analytics, order, auth, storage, and notification services.

| Service Category | Key Services |
|------------------|-------------|
| **Auth** | `AuthService`, `SessionService`, `TokenService` |
| **Data** | `ApiClient`, `SupabaseService`, `StorageService` |
| **Commerce** | `ProductService`, `CategoryService`, `InventoryService` |
| **Order** | `OrderService`, `FulfillmentService` |
| **Payment** | `PaymentService`, `RazorpayService`, `CustomPaymentService` |
| **Analytics** | `AnalyticsService`, `DashboardService` |
| **Store** | `StoreService`, `ThemeService`, `DomainService` |
| **Customer** | `CustomerService`, `AddressService` |
| **Notification** | `NotificationService`, `PushService` |

### 4.4 `packages/dart/ui_kit/` — 25 files

> **Purpose:** Shared Flutter widgets, themes, empty/loading/error states, and app UI primitives.

| Category | Widgets |
|----------|---------|
| **Loading** | `SkeletonLoader`, `ShimmerWidget`, `LoadingOverlay` |
| **Empty States** | `EmptyStateWidget`, `NoDataWidget` |
| **Error** | `ErrorWidget`, `RetryWidget` |
| **Buttons** | `PrimaryButton`, `SecondaryButton`, `GhostButton` |
| **Cards** | `InfoCard`, `StatCard`, `ProductCard` |
| **Input** | `CustomTextField`, `SearchBar`, `DropdownField` |
| **Theme** | `AppTheme`, `ThemeColors`, `Typography` |
| **Layout** | `ResponsiveLayout`, `AdaptiveScaffold` |

---

## 5. Backend Services — Detailed Status

### 5.1 API Gateway (`services/api-gateway/`) — 🟢 **ACTIVE**

**Full directory structure:**
```
services/api-gateway/
├── src/
│   ├── index.ts                    ← Hono app entry point
│   ├── routes/                     ← 30 route modules
│   ├── schemas/                    ← 16 Zod validation schemas
│   ├── services/                   ← Business logic services
│   ├── middleware/                  ← 8 middleware modules
│   ├── execution-adapters/         ← 12 execution adapters
│   ├── lib/                        ← Shared utilities
│   └── durable/                    ← Durable Objects
├── wrangler.toml                   ← Cloudflare Worker config
├── package.json
├── tsconfig.json
├── AGENTS.md
└── runtime.manifest.json
```

### 5.2 Webhook Service (`services/webhook-service/`) — 🟡 **SCAFFOLD**
- `wrangler.toml` — Worker configuration
- `src/index.ts` — Entry point
- `runtime.manifest.json` — Manifest
- **Planned:** Payment provider webhook reception, signature verification, event dispatching

### 5.3-5.9 Planned Services — 🔴 **MANIFEST ONLY**

| Service | Directory | Manifest Present | Source Files |
|---------|-----------|-----------------|-------------|
| Analytics Pipeline | `services/analytics-pipeline/` | ✅ | ❌ |
| Checkout Runtime | `services/checkout-runtime/` | ✅ | ❌ |
| Event Bus | `services/event-bus/` | ✅ | ❌ |
| Media Service | `services/media-service/` | ✅ | ❌ |
| Notification Service | `services/notification-service/` | ✅ | ❌ |
| Queue Workers | `services/queue-workers/` | ✅ | Minimal |
| Search Service | `services/search-service/` | ✅ | ❌ |

---

## 6. Infrastructure Configuration

### 6.1 `infrastructure/` Directory
```
infrastructure/
├── cloudflare/
│   ├── workers/          ← Worker deployment configs
│   ├── dns/              ← DNS record templates
│   └── r2/               ← R2 bucket configs
├── deployment/
│   ├── vercel/           ← Vercel deployment configs
│   └── scripts/          ← Deployment scripts
├── monitoring/
│   ├── alerts/           ← Alert rule definitions
│   └── dashboards/       ← Monitoring dashboard configs
├── security/
│   ├── csp/              ← Content Security Policy
│   └── headers/          ← Security headers templates
└── dns/
    └── records/          ← DNS zone file templates
```

### 6.2 Environment Configuration (`config/env/`)
```
config/env/
├── templates/
│   ├── identity-platform.env.example
│   ├── merchant-control-plane.env.example
│   ├── storefront-runtime.env.example
│   ├── api-gateway.env.example
│   └── ...
├── schemas/
│   └── env-schema.ts     ← Zod-based env validation
├── ownership/
│   └── env-ownership.md   ← Which app owns which vars
└── governance/
    └── env-governance.md  ← Environment management rules
```

### 6.3 Root Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Root workspace scripts, validation pipelines |
| `pnpm-workspace.yaml` | 23 workspace members |
| `turbo.json` | Build orchestration (build, dev, lint, test, typecheck) |
| `tsconfig.json` | Root TypeScript config |
| `.npmrc` | pnpm strict mode config |
| `analysis_options.yaml` | Dart/Flutter linting rules |
| `.gitignore` | Standard ignores + env files |
| `vercel.json` | Vercel deployment config |

### 6.4 Scripts & Validators (132 files)

| Category | Directory | Count | Purpose |
|----------|-----------|-------|---------|
| **Validators** | `scripts/validators/` | 50+ | Architecture, import, dependency, runtime manifest, governance enforcement |
| **Generators** | `scripts/generators/` | 10+ | Repository intelligence, AGENTS.md, docs generation |
| **Governance** | `scripts/governance/` | 15+ | Governance enforcement automation |
| **Migration** | `scripts/migration/` | 10+ | Database and code migration utilities |
| **Utilities** | `scripts/utilities/` | 20+ | File scanning, counting, analysis tools |

### Key Validators
| Validator | Purpose |
|-----------|---------|
| `runtime-manifest-validator.mjs` | Validates all runtime manifests |
| `dependency-manifest-validator.mjs` | Validates dependency declarations |
| `undeclared-import-validator.mjs` | Detects undeclared imports |
| `package-export-validator.mjs` | Validates package public exports |
| `dependency-graph-validator.mjs` | Validates dependency direction |
| `circular-import-validator.mjs` | Detects circular imports |
| `survivability-governance-validator.mjs` | Production readiness checks |
