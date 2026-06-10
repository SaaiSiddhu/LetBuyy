# Duplication Report

Overall duplication is **low for a monorepo of this size** — one client factory, one types source, one UI package. The notable duplication is conceptual (schemas and theme definitions existing in three layers) rather than copy-paste.

## Confirmed duplications

| # | What | Where | Assessment |
|---|------|-------|------------|
| D-1 | **Section schema definitions** (the platform's most important contract) exist 3× | `packages/theme-engine/src/theme-registry.ts` (`SECTION_SCHEMAS`) • `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` (`RUNTIME_SECTION_SCHEMAS`, independent `defineSectionSchema` calls) • `apps/merchant-control-plane/src/lib/theme-schemas.ts` (re-export only — benign) | Storefront copy is real drift risk: editor settings and renderable settings can diverge silently |
| D-2 | Urban Kicks theme exists 2× | DB seed `database/supabase/seeds/urban-kicks-theme.sql` vs hardcoded fixture `apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts` | Two divergent sources for the flagship demo |
| D-3 | `formatPrice` implemented 2× locally | `apps/theme-marketplace/src/lib/utils.ts:10-18` (Intl.NumberFormat) • `apps/storefront-runtime/src/components/cart/cart-drawer.tsx:17-22` (`en-IN`) | Minor; no shared money-formatting util exists despite a `Money` type in shared-types |
| D-4 | Header/Footer components 2× | `apps/app-marketplace/src/components/{Header,Footer}.tsx` vs `apps/marketing-site/src/components/{Header,Footer}.tsx` | Different feature sets/navs — justified, but brand drift surface |
| D-5 | TS ↔ Dart model mirror | `packages/shared-types` vs `packages/dart/models` (hand-written `merchant_contracts.dart` etc.) | Structural duplication with no codegen; drift enforced only by discipline |
| D-6 | Theme editor 2× (web + mobile) | `apps/merchant-control-plane/src/components/theme-editor/` (9 files) vs `apps/mobile/merchant-app/lib/widgets/theme/` (4 files) | Shared contracts, separate UX implementations — acceptable platform duplication, double maintenance cost |
| D-7 | Boundary validation 2× | gateway `src/schemas/*.ts` re-validate what packages' Zod schemas already define (e.g. `theme.schema.ts` facade) | Defense-in-depth pattern; counted as intentional |
| D-8 | Deployment duplication | 10 GitHub workflows including overlapping `staging-deploy.yml` / `deploy-staging.yml` / `deploy-production.yml` / `production-deploy.yml` variants | At least one pair is redundant naming |
| D-9 | Audit/architecture documents | Root ledgers vs `Audit/` 6-part report vs `docs/audit/` vs `LETBUYY_ENTERPRISE_ARCHITECTURE_AUDIT.md` — four generations of overlapping self-audits | Documentation duplication; some mutually contradictory (see Dead Code §4) |

## Verified non-duplications (clean)

- **API clients**: 6 web wrappers (`createMerchantApiClient`, `createAppMarketplaceApiClient`, `fetchConsoleApi`, `createPlatformOperationsApiClient`, storefront, theme-marketplace) all delegate to single `createLetbuyyApiClient()` — only auth-header assembly differs.
- **Entity types**: Product/Order/Store defined once in `shared-types` (Product at index.ts:331-363), extended (not redefined) by `commerce-core` operation schemas, consumed by `api-types`.
- **UI primitives**: no duplicate Button/Input/Card/Modal across apps; `@letbuyy/ui` imported by 10 consumers.
- **Customer/session logic**: storefront customer sessions vs merchant sessions are distinct domains, both built on `auth-core` primitives — no copy-paste between identity-platform and storefront beyond shared package use.
- **Event/runtime packages**: `event-core` (contracts) / `distributed-runtime` (persistence+queues) / `orchestration` (workflows) / `projection-runtime` (read models) — layered, not overlapping (verified by reading core modules of each).
- **Database**: no duplicate table structures found between Supabase and D1 (D1 is lineage-only).
