# Environment Governance

## Source Of Truth

Environment rules live in `config/env/`. The docs in this file summarize the repository-level policy; templates and schemas in `config/env/templates` and `config/env/schemas` are the operational contracts. Ownership mappings live in `config/env/ownership/`, and operational process notes live in `config/env/governance/`.

## Repository Rules

- Do not track `.env`, `.env.local`, `.dev.vars`, `all.env`, or runtime-specific secret dumps.
- Do not print or copy real secret values into docs, generated intelligence, task files, AGENTS files, or validation logs.
- `NEXT_PUBLIC_*` is browser-public. Never place Supabase service-role keys, internal API secrets, provider secrets, webhook secrets, Redis tokens, or payment secrets behind that prefix.
- Next apps receive env through Vercel project settings.
- Workers receive env through Cloudflare bindings and secrets.
- Mobile apps receive public build-time values through `--dart-define` or release pipeline configuration.
- CI receives automation credentials from GitHub Actions secrets or provider OIDC. CI must not materialize full env dumps into tracked files.
- Runtime manifests must reference the correct environment schema for their runtime class.

## Runtime Boundaries

| Boundary | Public values | Server-only values |
|---|---|---|
| `apps/identity-platform` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ACCOUNTS_URL`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `AUTH_SECRET`, `INTERNAL_API_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_TOKEN` |
| `apps/merchant-control-plane` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ACCOUNTS_URL`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_STOREFRONT_URL` | `AUTH_SECRET`, `INTERNAL_API_SECRET` |
| `apps/storefront-runtime` | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_STOREFRONT_URL` | `CUSTOMER_SESSION_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` |
| `services/api-gateway` | None by default | `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `PAYMENT_CONFIG_ENCRYPTION_KEY` |
| `services/webhook-service` | None by default | `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`, provider reconciliation secrets |
| `apps/mobile/*` | API URLs, Supabase anon values, public feature flags | No provider secrets, no service-role values, no private signing keys |

## Validation

`scripts/validators/environment-validator.mjs` fails if runtime env files are tracked, required env governance files are missing, `.gitignore` no longer blocks known local secret file patterns, or tracked source/config files contain secret-like values. The validator reports file paths only and must not print secret contents.
