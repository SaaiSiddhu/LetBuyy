# WS12 API EVOLUTION LEDGER - started 2026-06-05T02:57:48Z

## BASELINE
- Active mission: `docs/Codex_waves/CODEX_API_GRAPHQL_MISSION.md`.
- Source audit: `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` Part 3 identifies the remaining API gap as REST-only `/v1`, no typed Admin/Storefront GraphQL APIs, no calculated GraphQL query-cost model, no async JSONL bulk operations, and no generated SDKs.
- Predecessor state: WS11 local unblocked work is complete. `CODEX_WS11_STATUS.md` keeps deployed staging Liquid proof human-gated because staging gateway/storefront credentials and seeded Liquid releases are not available locally.
- Scope: `services/api-gateway/**`, `packages/typescript/api-client/**`, `packages/dart/api_client/**`, and additive `packages/shared-types/**`. REST `/v1` must remain externally unchanged.

## PROGRESS LOG
- 2026-06-05T03:42:59Z [G3 pre-commit gate] Full local gate - PASS. Evidence: `wc -l CODEX_WS12_LEDGER.md CODEX_MASTER_EXECUTION_LEDGER.md` -> PASS (106 and 398 lines; 504 total); `pnpm turbo typecheck` -> PASS (58/58 tasks); `pnpm run lint` -> PASS (9/9 tasks, existing warnings only); `pnpm run test` -> PASS (315/315 tests); generated artifact cleanup scan after removing app/service/package generated directories -> no matches; `pnpm run validate:governance` -> PASS (128/128 validators, second ledger-only rerun also PASS).
- 2026-06-05T03:40:54Z [G3] Storefront GraphQL mount and read execution - DONE locally. Evidence: `services/api-gateway/src/graphql/storefront.ts` adds a public GET/POST Storefront GraphQL router with request validation, calculated document-cost enforcement through `checkQueryCostRateLimitKey`, `rl:graphql-storefront` rate-limit keys, cost extensions/rate-limit headers, anonymous public cache headers, customer/private no-store headers, Relay connection adaptation, and internal delegation back through existing storefront REST handlers via `StorefrontGraphQLRestDelegate`; `services/api-gateway/src/index.ts` mounts `/v1/storefront/graphql` and `/v1/graphql/storefront` before the generic `/v1/storefront` router and before merchant `authMiddleware`; `tests/api-graphql/schema-contract.test.mjs` enforces G3 mount order, public/cache behavior, REST delegation, and the explicit server-cart read skip. Covered read families in this slice: store, products, product detail, collections via existing categories, pages, policies, navigation, blog posts, reviews, customer-by-email, and customer order lookup. Checks: `node --test tests/api-graphql/schema-contract.test.mjs` -> PASS (10/10); initial `pnpm --filter @letbuyy/api-gateway typecheck` failed only because generated-artifact cleanup had removed workspace dependency links; sandbox `CI=true pnpm install --frozen-lockfile --force` failed on registry DNS after restoring the clean lockfile; escalated rerun -> PASS with lockfile unchanged; rerun `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS; `npx tsx -e '<calculateGraphQLQueryCost storefront smoke>'` -> PASS with `{"cost":8}`.
- 2026-06-05T03:29:05Z [G2 pre-commit gate] Full local gate - PASS. Evidence: `wc -l CODEX_WS12_LEDGER.md CODEX_MASTER_EXECUTION_LEDGER.md` -> PASS (89 and 393 lines; 482 total); `pnpm turbo typecheck` -> PASS (58/58 tasks); `pnpm run lint` -> PASS (9/9 tasks, existing warnings only); `pnpm run test` -> PASS (313/313 tests); generated artifact cleanup scan after removing app/service/package generated directories -> no matches; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-05T03:27:00Z [G2] Admin GraphQL mount and read execution - DONE locally. Evidence: `services/api-gateway/src/graphql/cost.ts` calculates document cost for Admin/Storefront queries; `services/api-gateway/src/graphql/admin.ts` adds a GET/POST Admin GraphQL router with payload validation, leaky-bucket query-cost enforcement through `checkQueryCostRateLimitKey`, cost extensions/rate-limit headers, Relay connection adaptation, and internal delegation back through existing REST route handlers via `AdminGraphQLRestDelegate`; `services/api-gateway/src/index.ts` mounts the router after auth/CSRF/rate limit at `/v1/admin/graphql` and `/v1/graphql/admin`; `services/api-gateway/src/graphql/schema.ts` now records primary Admin/Storefront endpoint paths plus compatibility aliases; `tests/api-graphql/schema-contract.test.mjs` enforces G2 mount order, REST delegation, and cost enforcement. Checks: `node --test tests/api-graphql/schema-contract.test.mjs` -> PASS (8/8) after assertion tightening; `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS after wrapping the internal `app.fetch` delegate in `async`; `npx tsx -e '<calculateGraphQLQueryCost multi-connection smoke>'` -> PASS with `{"cost":10}`.
- 2026-06-05T03:17:33Z [G1 pre-commit gate] Full local gate - PASS. Evidence: `wc -l CODEX_WS12_LEDGER.md CODEX_MASTER_EXECUTION_LEDGER.md` -> PASS (78 and 389 lines; 467 total); `pnpm turbo typecheck` -> PASS (58/58 tasks); `pnpm run lint` -> PASS (9/9 tasks, existing warnings only); `pnpm run test` -> PASS (310/310 tests); generated artifact cleanup scan after removing app/service/package `.next`, `.turbo`, `.vercel`, nested `node_modules`, `.wrangler`, `dist`, `build`, and `.dart_tool` directories -> no matches; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-05T03:15:11Z [G1] GraphQL schema contract - DONE locally. Evidence: `packages/shared-types/src/index.ts` now exports GraphQL page info, query-cost, API-surface, bulk-operation, and generic connection contracts; `services/api-gateway/src/graphql/schema.ts` now exports `LETBUYY_GRAPHQL_SCHEMA_SDL`, `ADMIN_GRAPHQL_SCHEMA_ROOTS`, `STOREFRONT_GRAPHQL_SCHEMA_ROOTS`, `GRAPHQL_BULK_OPERATION_CONTRACT`, and `GRAPHQL_SHARED_TYPE_ALIGNMENT`; `tests/api-graphql/schema-contract.test.mjs` enforces root separation, domain coverage, Relay-style connections, query cost metadata, JSONL bulk operations, and shared-type alignment. Checks: `node --test tests/api-graphql/schema-contract.test.mjs` -> PASS (5/5); initial `pnpm --filter @letbuyy/shared-types typecheck` failed only on missing package-local dependency links after cleanup (`zod` not resolved); sandbox `CI=true pnpm install --frozen-lockfile --force` failed on registry DNS; escalated rerun -> PASS with lockfile unchanged; `pnpm --filter @letbuyy/shared-types typecheck` -> PASS; `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS.
- 2026-06-05T02:57:48Z [G0] REST and schema baseline inventory - DONE. Evidence: read WS12 mission, local API gateway/client AGENTS, current gateway entrypoint, routes, schemas, query-cost middleware, Dart API client package, and Part 3 blocker notes. Inventory command via Node REPL over `services/api-gateway/src/routes` and `src/schemas` detected 31 route modules, 353 Hono endpoints, and 17 schema facades. G1 schema backlog is grouped below. Checks: `wc -l CODEX_WS12_LEDGER.md CODEX_MASTER_EXECUTION_LEDGER.md` -> PASS (67 and 387 lines; 454 total); `pnpm run validate:governance` -> PASS (128/128 validators).

## G1 GRAPHQL SCHEMA CONTRACT
- Schema module: `services/api-gateway/src/graphql/schema.ts`.
- Version: `2026-06-05.g1`.
- Admin root: `/v1/graphql/admin`, query type `AdminQuery`, mutation type `AdminMutation`, merchant-session auth, query-cost budget 20 points/second with 200 point capacity and 250 max single-operation cost.
- Storefront root: `/v1/graphql/storefront`, query type `StorefrontQuery`, mutation type `StorefrontMutation`, storefront public/customer-token auth, same query-cost budget.
- Shared type alignment: the gateway SDL maps core objects back to `@letbuyy/shared-types` contracts for Store, Product, ProductVariant, Collection, InventoryLevel, Customer, Cart, Order, Payment, Page, Policy, BlogPost, Theme/ThemeBundle/ThemeSection/ThemeBlock/ThemeRelease, MarketplaceApp, InstalledApp, analytics, shipping/tax, and GraphQL bulk/cost/pagination primitives.
- Bulk operation contract: `bulkOperationRunQuery`, `bulkOperationRunMutation`, and `bulkOperationCancel`; output is JSONL stored through the API-gateway-owned Cloudflare R2/queue path; mutation work requires `X-Idempotency-Key`.
- Resolver/runtime status: G1 is contract-only and does not mount GraphQL execution into `services/api-gateway/src/index.ts`; REST `/v1` remains unchanged. G2 will add parser/execution wiring behind the two roots.

## G2 ADMIN GRAPHQL CONTRACT
- Primary path: `/v1/admin/graphql`; compatibility alias: `/v1/graphql/admin`.
- Middleware position: mounted after `apiVersioning`, REST query-cost middleware, `authMiddleware`, `csrfProtection`, and request rate limit. Admin GraphQL reuses existing gateway auth/RBAC context and does not create app-local auth.
- Execution shape: the first Admin GraphQL read resolvers delegate to existing REST route handlers through internal subrequests so current REST business logic and tenant ownership checks remain the source of truth. G6 will invert this relationship when REST becomes the thin shim.
- Covered read families in this slice: stores, store payment config, subscription, products, collections, inventory levels, customers, orders, pages, policies, navigation, themes, marketplace apps, installed apps, analytics dashboard, form submissions, shipping rates, and tax rates.
- Cost shape: `calculateGraphQLQueryCost()` estimates document cost from operation type, connection fields, requested page sizes, bulk-operation fields, and heavy admin fields. The router enforces the existing leaky bucket with `rl:graphql-admin`, returns `extensions.cost`, and sets `X-RateLimit-*`/`X-RateLimit-Cost`/`X-RateLimit-Policy` headers.

## G3 STOREFRONT GRAPHQL CONTRACT
- Primary path: `/v1/storefront/graphql`; compatibility alias: `/v1/graphql/storefront`.
- Middleware position: mounted after API versioning and the existing global query-cost middleware, but before the generic storefront REST router and before merchant `authMiddleware`, `csrfProtection`, and protected route rate limits. Storefront GraphQL remains public with optional customer/session headers delegated to existing storefront handlers.
- Execution shape: read resolvers delegate through current storefront REST handlers by internal subrequest. This keeps published-store checks, product/category/content scoping, customer lookup rules, review validation, and customer order lookup behavior owned by the existing gateway surface until G6 flips REST into a shim.
- Covered read families in this slice: store by subdomain/store id, product list/detail, collection list/detail through the existing category endpoint, page list/detail, policy list/detail, navigation menu, blog list/detail, product reviews, customer by email, and customer order lookup by id from the existing customer orders endpoint.
- Cache shape: anonymous non-customer reads set `Cache-Control: public, max-age=30, stale-while-revalidate=120`; customer/cart/order/authenticated reads set `Cache-Control: private, no-store`.
- Cost shape: `calculateGraphQLQueryCost()` is reused with the `storefront` surface and enforced with `rl:graphql-storefront`, returning `extensions.cost` plus `X-RateLimit-*`/`X-RateLimit-Cost`/`X-RateLimit-Policy` headers.

## REST /V1 SURFACE INVENTORY
- Gateway entrypoint: `services/api-gateway/src/index.ts`.
- Public `/v1` mounts before global auth: `auth`, `contacts`, `storefront`, `themes`, `app-store`, `internal/console`.
- Protected `/v1` mounts after `authMiddleware`, `csrfProtection`, and request rate limit: `stores`, `products`, `orders`, `payments`, `upload`, `portfolio`, `resume`, `employees`, `admin`, `blog`, `customers`, `notifications`, `media`, `ai`, `export`, `shipping-tax`, `onboarding`, `inventory`, `coupons`, `categories`, `analytics`, `reviews`, `form-submissions`, `pages`, `operations`.
- Query-cost baseline: REST already applies `queryCostRateLimit({ pointsPerSecond: 20, capacity: 200 })` and exports `calculateQueryCost()` from `services/api-gateway/src/middleware/rateLimit.ts`.

## ROUTE MODULE COUNTS
| Module | Routes | Methods | G1 GraphQL Domain |
|---|---:|---|---|
| `admin.ts` | 12 | GET/PATCH/POST/DELETE | Admin platform operations |
| `ai.ts` | 5 | GET/POST | AI usage/credits |
| `analytics.ts` | 4 | GET | Admin analytics |
| `app-store.ts` | 22 | GET/POST/DELETE | Apps, installs, OAuth, partners |
| `auth.ts` | 23 | GET/POST | Identity/session compatibility, not primary GraphQL |
| `blog.ts` | 13 | GET/POST/PATCH/DELETE | CMS blog |
| `categories.ts` | 5 | GET/POST/PATCH/DELETE | Catalog categories |
| `contacts.ts` | 2 | GET/POST | Contact capture |
| `coupons.ts` | 6 | GET/POST/PATCH/DELETE | Discounts/coupons |
| `customers.ts` | 6 | GET/POST/PATCH/DELETE | Customers/addresses |
| `employee.ts` | 10 | GET/POST/PATCH/DELETE | Employee/operations auth |
| `export.ts` | 3 | GET/POST | Current import/export compatibility; G4 bulk source |
| `form-submissions.ts` | 3 | GET/PATCH/DELETE | Forms |
| `internal-console.ts` | 9 | GET/POST | Internal console |
| `inventory.ts` | 15 | GET/POST | Inventory, suppliers, transfers, purchase orders |
| `media.ts` | 4 | GET/POST/PATCH/DELETE | Media |
| `notifications.ts` | 9 | GET/POST/PATCH/PUT/DELETE | Notifications/preferences |
| `onboarding.ts` | 6 | GET/POST/PUT | Onboarding |
| `operations.ts` | 44 | GET/POST/PATCH | Runtime operations, queues, reviews, evidence |
| `orders.ts` | 7 | GET/POST/PATCH | Orders, fulfillment, refunds |
| `pages.ts` | 10 | GET/POST/PATCH/PUT/DELETE | Pages, policies, navigation |
| `payments.ts` | 9 | GET/POST | Billing/payments/subscriptions |
| `portfolio.ts` | 4 | GET/POST/PATCH/DELETE | Portfolio CMS |
| `products.ts` | 10 | GET/POST/PATCH/DELETE | Products, collections, gift cards, bulk action |
| `resume.ts` | 10 | GET/POST/PATCH/DELETE | Resume CMS |
| `reviews.ts` | 3 | GET/PATCH/DELETE | Review moderation |
| `shipping-tax.ts` | 12 | GET/POST/PATCH/DELETE | Shipping zones/rates and taxes |
| `storefront.ts` | 57 | GET/POST/PATCH/DELETE | Storefront API, public catalog, checkout/customer |
| `stores.ts` | 10 | GET/POST/PATCH/DELETE | Stores/sites and payment config |
| `themes.ts` | 18 | GET/POST/PUT/DELETE | Themes, editor, releases, package lifecycle |
| `upload.ts` | 2 | POST/DELETE | Media upload/R2 |

## SCHEMA FACADE INVENTORY
- 17 schema facades exist under `services/api-gateway/src/schemas`: `ai`, `auth`, `blog`, `common`, `coupon`, `customer`, `form-submission`, `media`, `onboarding`, `operations`, `order`, `page`, `product`, `review`, `shipping`, `store`, and `theme`.
- High-volume GraphQL contract inputs already have Zod source facades: product (12 schema names), order/payment/cart (28), theme (20), operations (29), page/navigation/policy (13), store (10), customer/address (7), auth/session (6), blog (5), coupon (4), media (3), review (3), shipping/tax (3), and form submissions (2).
- G1 must align GraphQL object/input names to `@letbuyy/shared-types` and the owning domain packages first, using gateway `src/schemas/*` only as worker import facades.

## DOMAIN PACKAGE ALIGNMENT
- GraphQL Admin initial coverage target: `commerce-core` products/collections/customers/inventory, `checkout-core` orders/cart/payment, `tenant-core` stores/sites, `cms-core` pages/blog/policies/navigation/portfolio/resume, `theme-engine` themes/releases/bundles, `app-engine` app marketplace/install/OAuth, `billing-core` subscriptions/charges, and `event-core`/`orchestration` bulk operation events.
- GraphQL Storefront initial coverage target: public store lookup, storefront product/category/page/policy/blog reads, customer-safe account/order/address/wishlist reads, review create/list, and checkout/payment creation surfaces. Storefront tokens must remain separate from merchant/admin auth.

## SKIPPED - NEEDS HUMAN
- [SKIP - NEEDS HUMAN] WS12 deployed staging GraphQL/bulk proof - requires staging gateway deployment credentials, seeded staging merchant/store/catalog/order/theme/app data, and R2/queue bindings for bulk JSONL result proof. Local source inventory is complete; staging proof resumes when credentials are available.

## SKIPPED - NEEDS BACKEND
- [SKIP - NEEDS BACKEND] WS12 G3 persisted Storefront GraphQL cart read - the current gateway has checkout/order creation endpoints but no server-side persisted cart read endpoint to delegate `StorefrontQuery.cart(id:)` to. G3 returns `cart: null` rather than fabricating state; G4/G6 must add a governed cart persistence/read contract before live cart GraphQL proof can be marked complete.

## VALIDATOR LEDGER
- 2026-06-05T03:42:59Z G3 pre-commit gate: `wc -l CODEX_WS12_LEDGER.md CODEX_MASTER_EXECUTION_LEDGER.md` -> PASS (106 and 398 lines; 504 total); `pnpm turbo typecheck` -> PASS (58/58 tasks); `pnpm run lint` -> PASS (9/9 tasks, existing warnings only); `pnpm run test` -> PASS (315/315 tests); generated artifact cleanup scan -> no matches; `pnpm run validate:governance` -> PASS (128/128 validators, second ledger-only rerun also PASS).
- 2026-06-05T03:40:54Z G3 focused checks: `node --test tests/api-graphql/schema-contract.test.mjs` -> PASS (10/10); `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS after escalated frozen dependency-link restoration with lockfile unchanged; `npx tsx -e '<calculateGraphQLQueryCost storefront smoke>'` -> PASS with `{"cost":8}`.
- 2026-06-05T03:29:05Z G2 pre-commit gate: `wc -l CODEX_WS12_LEDGER.md CODEX_MASTER_EXECUTION_LEDGER.md` -> PASS (89 and 393 lines; 482 total); `pnpm turbo typecheck` -> PASS (58/58 tasks); `pnpm run lint` -> PASS (9/9 tasks, existing warnings only); `pnpm run test` -> PASS (313/313 tests); generated artifact cleanup scan -> no matches; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-05T03:27:00Z G2 focused checks: `node --test tests/api-graphql/schema-contract.test.mjs` -> PASS (8/8); `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS; `npx tsx -e '<calculateGraphQLQueryCost multi-connection smoke>'` -> PASS with `{"cost":10}`.
- 2026-06-05T03:17:33Z G1 pre-commit gate: `wc -l CODEX_WS12_LEDGER.md CODEX_MASTER_EXECUTION_LEDGER.md` -> PASS (78 and 389 lines; 467 total); `pnpm turbo typecheck` -> PASS (58/58 tasks); `pnpm run lint` -> PASS (9/9 tasks, existing warnings only); `pnpm run test` -> PASS (310/310 tests); generated artifact cleanup scan -> no matches; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-05T03:15:11Z G1 schema contract: `node --test tests/api-graphql/schema-contract.test.mjs` -> PASS (5/5); `pnpm --filter @letbuyy/shared-types typecheck` -> PASS after escalated frozen dependency-link restoration; `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS.
- 2026-06-05T02:57:48Z G0 docs verification: `wc -l CODEX_WS12_LEDGER.md CODEX_MASTER_EXECUTION_LEDGER.md` -> PASS (67 and 387 lines; 454 total).
- 2026-06-05T02:57:48Z G0 governance: `pnpm run validate:governance` -> PASS (128/128 validators).
