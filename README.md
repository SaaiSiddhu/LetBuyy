# LetBuyy Store

LetBuyy is a governed multi-tenant commerce and site-builder SaaS. Runtime boundaries, tenant rules, and production constraints are defined in `AGENTS.md`.

## Local Development Setup

1. `pnpm install`
2. `pnpm run setup:env`
3. Fill in real provider credentials in `.env.local` files where needed
4. `cd infrastructure/local && docker-compose up -d`
5. `pnpm turbo dev`
