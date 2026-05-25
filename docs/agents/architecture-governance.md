# Architecture Governance

## Real Current Architecture

LetBuyy is a modular monorepo with multiple Next apps, Cloudflare Workers, Supabase Postgres/Auth/Storage, Terraform DNS, Vercel web deployment, and Flutter mobile/admin clients. The API worker is the intended backend gateway, but several Next route handlers still act as app-boundary proxies and partial service owners.

Current runtime center:

- `apps/web/consumer/accounts`: merchant authentication, onboarding, custom sessions, store selection.
- `apps/web/consumer/admin`: merchant dashboard, CMS, products, orders, analytics, settings, themes.
- `apps/web/consumer/storefront`: wildcard tenant storefront, public catalog, cart, checkout, customer accounts, pages, policies, theme preview.
- `apps/web/consumer/app-store`: extension marketplace and developer app submission.
- `apps/web/consumer/theme-marketplace`: theme catalog and purchase/install workflows.
- `backend/workers/api`: Hono `/v1` gateway, middleware, tenant context, routes, services, outbox dispatch.
- `backend/workers/webhooks`: payment provider webhooks and reconciliation.
- `backend/supabase/migrations`: system-of-record schema and RLS policies.
- `packages/typescript/api-types`: shared contracts, especially theme schemas.
- `packages/dart/*`: Flutter shared core, models, services, and UI kit.

## Intended Architecture

The intended platform is a Shopify-grade commerce operating system:

- Worker-first API contracts with thin app-boundary proxies.
- Tenant-safe service-layer commerce core.
- Schema-governed theme engine with approved renderers and immutable releases.
- Event-driven outbox and queue processing for side effects, projections, search, analytics, and webhooks.
- Enterprise admin, console, team, and mobile clients consuming the same contracts.
- Strong test, observability, rate limit, idempotency, and security controls.

## Gap Analysis

- Next route handlers still contain inconsistent proxy patterns, raw JSON parsing, and uneven CSRF/rate limit protection.
- Worker route validation is uneven; some routes use Zod/service methods, while routes such as app-store still contain direct `c.req.json()` usage.
- Console and team apps are scaffold-level and must not be treated as production operations tools.
- Root CI/CD is under-specified; `.github/workflows` was not present in the current scan.
- Typecheck and lint validation have known historical blockers in worker upload types and app lint config circular serialization.
- Testing is not adequate for commerce workflows, auth, tenant isolation, payments, webhooks, or theme publishing.
- RLS and policy coverage is strong overall but not complete by static scan, with `employee_permissions` and several operational tables requiring review.

## Scalability Risks

- Large route modules, especially storefront and payments, concentrate too many workflows in handlers.
- Queue consumers currently cover only analytics and search projections, while outbox categories imply broader asynchronous needs.
- Serverless worker limits require strict payload, query, and fanout controls.
- Theme rendering and storefront composition require cache discipline by store, template, product, and theme release.

## Security Risks

- Historical committed secret risk is documented in memory and requires rotation discipline.
- Service role usage must remain server/worker only.
- Storefront internal endpoints currently rely on static internal secret checks in places; signed request patterns should be preferred for new privileged app-to-worker calls.
- CSRF, auth rate limits, webhook verification, and payment idempotency are not uniformly proven across all app-local routes.

## Tenant Isolation Risks

- Any table without direct tenant key must have a documented ownership path or be classified as global catalog/reference state.
- Storefront customer identity must stay separate from merchant/admin identity.
- Search, analytics, webhook delivery, queue jobs, media, and exports must retain tenant context in both input and stored output.

## Performance Risks

- Storefront public data, theme composition, and product catalog reads need cache tags and bounded queries.
- Admin tables require pagination, search indexes, filters, and bulk operation constraints.
- Inline styles, client component overuse, and design drift can inflate frontend bundles and reduce UI consistency.

## Governance Standard

Every future architecture change must identify the owning domain, tenant path, API contract, validation schema, persistence model, test plan, migration impact, observability behavior, and rollback strategy.
