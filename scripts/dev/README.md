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
| storefront-runtime              | http://localhost:9000   |
| merchant-control-plane (admin)  | http://localhost:9001   |
| identity-platform (accounts)    | http://localhost:9002   |
| app-marketplace                 | http://localhost:9003   |
| developer-portal                | http://localhost:9004   |
| theme-marketplace               | http://localhost:9005   |
| marketing-site                  | http://localhost:9006   |
| platform-console                | http://localhost:9007   |
| platform-operations-portal      | http://localhost:9008   |
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
pnpm dev          # 9 Next apps + Storybook (fast, low-CPU default)
pnpm dev:all      # everything, including the 4 Cloudflare Workers
pnpm dev:apps     # just the 9 Next apps
pnpm dev:services # just the Cloudflare Workers
pnpm dev:setup    # regenerate local env files (--force)
```

See `docs/LOCAL_DEV.md` for the full guide.
