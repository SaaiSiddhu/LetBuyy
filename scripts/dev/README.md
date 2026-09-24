# scripts/dev — local development tooling

Canonical home for **local-only** developer tooling that boots the LetBuyy
workspace on a single machine. Nothing here changes deployment behaviour;
staging and production remain the only supported runtime targets
(see `config/env/README.md`). It complements `scripts/utilities/local-stack-*`.

## Contents

- `ports.mjs` — single source of truth for the local port map (9000+).
- `setup-local-env.mjs` — generates per-app `.env.local` and per-worker
  `.dev.vars` from the committed `config/env/templates/*` key sets, overlaying
  localhost/dev-safe values. Output files are **untracked** by design.
- `apply-dev-scripts.mjs` — idempotently installs the `dev` scripts across the
  workspace + the root `pnpm dev` orchestrator.

## Port map

| Runtime                         | URL                     |
| ------------------------------- | ----------------------- |
| apps/commerce/web (storefront)  | http://localhost:9000   |
| apps/merchant/web (admin)       | http://localhost:9001   |
| apps/platform/identity          | http://localhost:9002   |
| apps/frozen/app-store           | http://localhost:9003   |
| apps/frozen/developer-portal    | http://localhost:9004   |
| apps/frozen/theme-store         | http://localhost:9005   |
| apps/marketing/web              | http://localhost:9006   |
| apps/internal/console           | http://localhost:9007   |
| apps/frozen/operations-portal   | http://localhost:9008   |
| @letbuyy/ui (Storybook)         | http://localhost:9009   |
| api-gateway (worker)            | http://localhost:9010   |
| mobile-bff (worker)             | http://localhost:9011   |
| webhook-service (worker)        | http://localhost:9012   |
| queue-workers (worker)          | http://localhost:9013   |

Workers also bind distinct inspector ports (9110–9113) to avoid the wrangler
9229 debugger clash.

## Usage

```bash
pnpm install      # once (or after dependency changes)
pnpm dev          # the 5 maintained Next apps + Storybook + the API gateway (the default)
pnpm dev:all      # the same plus all 4 Cloudflare Workers; never a frozen app
pnpm dev:apps     # just the 5 maintained Next apps
pnpm dev:frozen   # the 4 frozen Next apps, only when you need one
pnpm dev:services # the Workers under services/ (also the LCIS tooling API)
pnpm dev:setup    # regenerate local env files (--force)
```

See `docs/LOCAL_DEV.md` for the full guide.
