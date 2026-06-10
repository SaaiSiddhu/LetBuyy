# LetBuyy Store

LetBuyy is a governed multi-tenant commerce and site-builder SaaS. Runtime boundaries, tenant rules, and production constraints are defined in `AGENTS.md`.

## Staging-First Development

1. `pnpm install`
2. `pnpm turbo typecheck`
3. `pnpm lint`
4. `pnpm turbo build`
5. `pnpm run validate:governance`
6. Deploy the branch to staging or a PR preview, then run E2E against staging URLs.

## Staging Storefront Routing

The storefront runtime is tested through deployed staging routes:

- Path route: `https://storefront.staging.letbuyy.com/store/teststore`
- Host route: `https://teststore.staging.letbuyy.com`
