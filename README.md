# LetBuyy Store

LetBuyy is a governed multi-tenant commerce and site-builder SaaS. Runtime boundaries, tenant rules, and production constraints are defined in `AGENTS.md`.

## Local Development Setup

1. `pnpm install`
2. `pnpm run setup:env`
3. Fill in real provider credentials in `.env.local` files where needed
4. `cd infrastructure/local && docker-compose up -d`
5. `pnpm turbo dev`

## Local Storefront Routing

The storefront runtime supports both path routing and local wildcard-style hosts:

- Path route: `http://localhost:3003/store/teststore`
- Host route: `http://teststore.localhost:3003`

Most modern browsers resolve `*.localhost` to loopback automatically. If your OS or browser does not, add `127.0.0.1 teststore.localhost` to `/etc/hosts` for the store handle you are testing.
