# WS12 API EVOLUTION LEDGER - started 2026-06-05T02:57:48Z

## BASELINE
- Active mission: `docs/Codex_waves/CODEX_API_GRAPHQL_MISSION.md`.
- Source audit: `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` Part 3 identifies the remaining API gap as REST-only `/v1`, no typed Admin/Storefront GraphQL APIs, no calculated GraphQL query-cost model, no async JSONL bulk operations, and no generated SDKs.
- Predecessor state: WS11 local unblocked work is complete. `CODEX_WS11_STATUS.md` keeps deployed staging Liquid proof human-gated because staging gateway/storefront credentials and seeded Liquid releases are not available locally.
- Scope: `services/api-gateway/**`, `packages/typescript/api-client/**`, `packages/dart/api_client/**`, and additive `packages/shared-types/**`. REST `/v1` must remain externally unchanged.

## PROGRESS LOG
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

## VALIDATOR LEDGER
- 2026-06-05T03:17:33Z G1 pre-commit gate: `wc -l CODEX_WS12_LEDGER.md CODEX_MASTER_EXECUTION_LEDGER.md` -> PASS (78 and 389 lines; 467 total); `pnpm turbo typecheck` -> PASS (58/58 tasks); `pnpm run lint` -> PASS (9/9 tasks, existing warnings only); `pnpm run test` -> PASS (310/310 tests); generated artifact cleanup scan -> no matches; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-05T03:15:11Z G1 schema contract: `node --test tests/api-graphql/schema-contract.test.mjs` -> PASS (5/5); `pnpm --filter @letbuyy/shared-types typecheck` -> PASS after escalated frozen dependency-link restoration; `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS.
- 2026-06-05T02:57:48Z G0 docs verification: `wc -l CODEX_WS12_LEDGER.md CODEX_MASTER_EXECUTION_LEDGER.md` -> PASS (67 and 387 lines; 454 total).
- 2026-06-05T02:57:48Z G0 governance: `pnpm run validate:governance` -> PASS (128/128 validators).
