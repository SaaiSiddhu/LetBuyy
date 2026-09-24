# Environment Governance

## Source Of Truth

Environment rules live in `config/env/`. The docs in this file summarize the repository-level policy; templates and schemas in `config/env/templates` and `config/env/schemas` are the operational contracts. The staging/production secret matrix lives at `config/env/staging-production-secret-matrix.json`. Ownership mappings live in `config/env/ownership/`, and operational process notes live in `config/env/governance/`.

## Repository Rules

- Do not track `.env`, `.env.local`, `.dev.vars`, `all.env`, or runtime-specific secret dumps.
- Do not print or copy real secret values into docs, generated intelligence, task files, AGENTS files, or validation logs.
- `NEXT_PUBLIC_*` is browser-public. Never place Supabase service-role keys, internal API secrets, provider secrets, webhook secrets, Redis tokens, or payment secrets behind that prefix.
- Next apps receive env through Vercel project settings.
- Workers receive env through Cloudflare bindings and secrets.
- Mobile apps receive public build-time values through `--dart-define` or release pipeline configuration.
- CI receives automation credentials from GitHub Actions secrets or provider OIDC. CI must not materialize full env dumps into tracked files.
- Runtime manifests must reference the correct environment schema for their runtime class.
- Staging and production are the only release deployment targets. Local and development runs may use the same variable names and API topology, but must use sandbox resources only.
- Production-facing app source must not silently default to staging hosts or retired `.com` LetBuyy domains. Public navigation may use the canonical `.store` production host as a safe default; server/API/provider-backed paths must be configured by env or fail loudly outside production.
- Staging origins, storefront frame ancestors, and CDN/public asset hosts must be explicit environment values. They must not be hardcoded into production source defaults.

## Runtime Boundaries

| Boundary | Public values | Server-only values |
|---|---|---|
| `apps/platform/identity` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ACCOUNTS_URL`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `AUTH_SECRET`, `INTERNAL_API_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_TOKEN` |
| `apps/marketing/web` | `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ACCOUNTS_URL` | None by default |
| `apps/merchant/web` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ACCOUNTS_URL`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_STOREFRONT_URL`, `NEXT_PUBLIC_THEME_MARKETPLACE_URL` | `AUTH_SECRET`, `INTERNAL_API_SECRET` |
| `apps/commerce/web` | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_STOREFRONT_URL` | `CUSTOMER_SESSION_SECRET`, `STOREFRONT_FRAME_ANCESTORS`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` |
| `apps/frozen/app-store` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ACCOUNTS_URL` | `AUTH_SECRET`, `INTERNAL_API_SECRET` |
| `apps/frozen/developer-portal` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ACCOUNTS_URL` | `AUTH_SECRET`, `INTERNAL_API_SECRET` |
| `apps/frozen/theme-store` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ACCOUNTS_URL` | `AUTH_SECRET`, `INTERNAL_API_SECRET` |
| `apps/internal/console` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ACCOUNTS_URL` | `PLATFORM_CONSOLE_SESSION_SECRET`, `PLATFORM_CONSOLE_TOTP_SECRET`, `PLATFORM_CONSOLE_API_TOKEN` |
| `apps/frozen/operations-portal` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ACCOUNTS_URL` | `AUTH_SECRET`, `INTERNAL_API_SECRET` |
| `services/api-gateway` | None by default | `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `PAYMENT_CONFIG_ENCRYPTION_KEY` |
| `services/webhook-service` | None by default | `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`, provider reconciliation secrets |
| `apps/mobile/*` | API URLs, Supabase anon values, public feature flags, mobile build-time provider keys such as `GEMINI_API_KEY` when provider-side restricted | No service-role values, no private signing keys, no unrestricted provider secrets |

## Validation

`scripts/validators/environment-validator.mjs` fails if runtime env files are tracked, required env governance files are missing, `.gitignore` no longer blocks known local secret file patterns, or tracked source/config files contain secret-like values. The validator reports file paths only and must not print secret contents.

`scripts/validators/environment-honesty-validator.mjs` fails if active app/package/service source hardcodes staging LetBuyy hosts, retired `.com` LetBuyy hosts/emails, or staging CDN defaults; if server/API clients stop failing loudly without required non-production API env; if staging CORS/frame/CDN values move back into source; or if consumed public env values such as `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_THEME_MARKETPLACE_URL`, `STOREFRONT_FRAME_ANCESTORS`, and mobile Gemini build defines fall out of templates/schemas.
