# LetBuyy Next.js Apps Inventory

Generated during environment setup Phase 0 from `apps/*/package.json`, environment templates, and app worker-client usage.

| App | Purpose | Local Port | Environment Variables Needed | Worker/API Boundary |
|-----|---------|------------|------------------------------|---------------------|
| `apps/marketing-site` | Public marketing, pricing, and create-store conversion flow | `3000` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ACCOUNTS_URL`, analytics/public config as needed | Calls `api-gateway` `/v1` public store lookup endpoints |
| `apps/identity-platform` | Merchant auth, signup, OTP, session, onboarding, store creation | `3001` | `NEXT_PUBLIC_API_URL`, `LETBUYY_API_URL`, `API_URL`, `INTERNAL_API_SECRET`, `AUTH_SECRET`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, Turnstile vars | Calls `api-gateway` `/v1/auth`, `/v1/stores`, and onboarding endpoints through signed server calls |
| `apps/merchant-control-plane` | Merchant dashboard and per-store operations | `3002` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_API_BASE_URL`, `LETBUYY_API_URL`, `LETBUYY_API_BASE_URL`, `NEXT_PUBLIC_ACCOUNTS_URL`, `NEXT_PUBLIC_ADMIN_URL`, `INTERNAL_API_SECRET` | Calls `api-gateway` `/v1` merchant APIs through server worker client and route proxies |
| `apps/storefront-runtime` | Public tenant storefront, customer account, cart, checkout, SEO | `3003` | `NEXT_PUBLIC_API_BASE_URL`, `LETBUYY_API_BASE_URL`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_STOREFRONT_URL`, `CUSTOMER_SESSION_SECRET`, `SEED_SECRET`, payment provider public/server vars | Calls `api-gateway` `/v1/storefront`, commerce, cart, order, and payment APIs |
| `apps/app-marketplace` | App marketplace and developer submission surfaces | `3004` | `NEXT_PUBLIC_API_URL`, `LETBUYY_API_URL`, `API_URL`, `INTERNAL_API_SECRET`, auth/session vars | Calls `api-gateway` `/v1/app-store` APIs |
| `apps/theme-marketplace` | Theme marketplace, theme detail, checkout, purchases | `3005` | `NEXT_PUBLIC_API_URL`, `LETBUYY_API_URL`, `API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ACCOUNTS_URL`, auth/session vars | Calls `api-gateway` `/v1/themes` APIs |
| `apps/platform-console` | Super-admin console, auth/MFA, operations tables | `3010` | `PLATFORM_CONSOLE_ALLOWED_EMAILS`, `PLATFORM_CONSOLE_SESSION_SECRET`, `PLATFORM_CONSOLE_TOTP_SECRET`, `PLATFORM_CONSOLE_API_TOKEN`, `PLATFORM_CONSOLE_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AUTH_SECRET` | Calls `api-gateway` `/v1/internal/console/*` using `PLATFORM_CONSOLE_API_TOKEN` |
| `apps/platform-operations-portal` | Employee operations/support portal scaffold | `3011` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ACCOUNTS_URL`, `INTERNAL_API_SECRET`, auth/session vars | Expected to call `api-gateway` employee/operations APIs |

## Shared Next App Environment Template

All Next.js apps inherit from `config/env/templates/next-app.env.example`. Public browser-safe variables use `NEXT_PUBLIC_*`; server-only values such as `AUTH_SECRET`, `INTERNAL_API_SECRET`, provider secrets, and console tokens must be configured only in Vercel environment variables.
