# LetBuyy Environment Variable Master List

Generated during environment setup Phase 0 from `config/env/templates/*`.

| Variable | Category | Used In | Staging Value Source | Production Value Source |
|----------|----------|---------|----------------------|-------------------------|
| `NEXT_PUBLIC_API_URL` | PUBLIC | Next apps | Vercel staging env -> `https://api-staging.letbuyy.store/v1` | Vercel production env -> `https://api.letbuyy.store/v1` |
| `NEXT_PUBLIC_API_BASE_URL` | PUBLIC | Next apps | Vercel staging env -> `https://api-staging.letbuyy.store/v1` | Vercel production env -> `https://api.letbuyy.store/v1` |
| `NEXT_PUBLIC_ACCOUNTS_URL` | PUBLIC | Next apps | Vercel staging env -> `https://accounts-staging.letbuyy.store` | Vercel production env -> `https://accounts.letbuyy.store` |
| `NEXT_PUBLIC_ADMIN_URL` | PUBLIC | Next apps | Vercel staging env -> `https://admin-staging.letbuyy.store` | Vercel production env -> `https://admin.letbuyy.store` |
| `NEXT_PUBLIC_STOREFRONT_URL` | PUBLIC | Next apps | Vercel staging env -> `https://store-staging.letbuyy.store` | Vercel production env -> `https://store.letbuyy.store` |
| `NEXT_PUBLIC_STOREFRONT_LOCAL_URL` | PUBLIC | Local Next app previews | Local-only value, not required for staging | Local-only value, not required for production |
| `NEXT_PUBLIC_SUPABASE_URL` | PUBLIC | Browser Supabase clients | Supabase staging project API URL | Supabase production project API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PUBLIC | Browser Supabase clients | Supabase staging anon key in Vercel | Supabase production anon key in Vercel |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | PUBLIC | Identity/browser anti-abuse UI | Cloudflare Turnstile staging site key in Vercel | Cloudflare Turnstile production site key in Vercel |
| `LETBUYY_API_URL` | INFRA | Next server worker clients | Vercel staging env -> `https://api-staging.letbuyy.store/v1` | Vercel production env -> `https://api.letbuyy.store/v1` |
| `LETBUYY_API_BASE_URL` | INFRA | Local/worker clients | Vercel/worker staging config | Vercel/worker production config |
| `API_URL` | INFRA | Next server worker clients | Vercel staging env -> `https://api-staging.letbuyy.store/v1` | Vercel production env -> `https://api.letbuyy.store/v1` |
| `INTERNAL_API_SECRET` | SECRET | Next apps and Workers | GitHub/Vercel/Cloudflare staging secret | GitHub/Vercel/Cloudflare production secret |
| `LETBUYY_INTERNAL_API_SECRET` | SECRET | Workers/internal HMAC | Cloudflare staging secret | Cloudflare production secret |
| `AUTH_SECRET` | SECRET | Identity, console, Workers | GitHub/Vercel/Cloudflare staging secret | GitHub/Vercel/Cloudflare production secret |
| `CUSTOMER_SESSION_SECRET` | SECRET | Storefront customer sessions | Vercel staging secret | Vercel production secret |
| `PLATFORM_CONSOLE_ALLOWED_EMAILS` | SECRET | Platform console auth policy | Vercel staging secret/config | Vercel production secret/config |
| `PLATFORM_CONSOLE_SESSION_SECRET` | SECRET | Platform console session cookies | Vercel staging secret | Vercel production secret |
| `PLATFORM_CONSOLE_TOTP_SECRET` | SECRET | Platform console TOTP fallback | Vercel staging secret | Vercel production secret |
| `PLATFORM_CONSOLE_DEV_MFA_CODE` | SECRET | Local/staging console fallback only | Optional Vercel staging secret; omit in production where possible | Do not configure unless explicitly approved |
| `PLATFORM_CONSOLE_API_TOKEN` | SECRET | Console-to-worker internal API | Vercel + Cloudflare staging secret | Vercel + Cloudflare production secret |
| `PLATFORM_CONSOLE_API_BASE_URL` | INFRA | Platform console | Vercel staging env -> `https://api-staging.letbuyy.store/v1` | Vercel production env -> `https://api.letbuyy.store/v1` |
| `RESEND_API_KEY` | SECRET | Email adapter | Resend staging/test API key in secrets manager | Resend production API key in secrets manager |
| `RESEND_FROM_EMAIL` | INFRA | Email adapter | Verified staging sender/domain | Verified production sender/domain |
| `UPSTASH_REDIS_REST_URL` | INFRA | Rate limit/cache | Staging Upstash REST URL | Production Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | SECRET | Rate limit/cache | Staging Upstash secret | Production Upstash secret |
| `TURNSTILE_SECRET_KEY` | SECRET | Server-side Turnstile verification | Cloudflare Turnstile staging secret | Cloudflare Turnstile production secret |
| `STRIPE_SECRET_KEY` | SECRET | Stripe payments | Stripe test/staging secret | Stripe live production secret |
| `STRIPE_WEBHOOK_SECRET` | SECRET | Stripe webhook verification | Stripe staging webhook secret | Stripe production webhook secret |
| `PAYPAL_CLIENT_ID` | SECRET | PayPal server adapter | PayPal sandbox client ID in secrets manager | PayPal live client ID in secrets manager |
| `PAYPAL_CLIENT_SECRET` | SECRET | PayPal server adapter | PayPal sandbox secret | PayPal live secret |
| `PAYPAL_WEBHOOK_ID` | SECRET | PayPal webhook verification | PayPal sandbox webhook ID | PayPal live webhook ID |
| `PAYPAL_MODE` | INFRA | PayPal adapter | `sandbox` | `live` |
| `SEED_SECRET` | SECRET | Storefront `/api/seed` dev guard | Optional dev/staging-only Vercel secret | Do not configure for production seeding |
| `SUPABASE_URL` | INFRA | Workers, mobile, server clients | Supabase staging project URL | Supabase production project URL |
| `SUPABASE_ANON_KEY` | PUBLIC | Workers/mobile public Supabase client | Supabase staging anon key | Supabase production anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | SECRET | Workers/server-only Supabase admin access | Cloudflare staging secret | Cloudflare production secret |
| `CSRF_SECRET` | SECRET | Worker CSRF/session security | Cloudflare staging secret | Cloudflare production secret |
| `ENVIRONMENT` | INFRA | Workers/mobile/runtime config | `staging` | `production` |
| `APP_ENV` | INFRA | Workers/runtime config | `staging` | `production` |
| `NODE_ENV` | INFRA | Workers/apps build/runtime | `production` | `production` |
| `DEPLOYMENT_ENV` | INFRA | Workers/runtime config | `staging` | `production` |
| `TELEMETRY_ENV` | INFRA | Workers/runtime telemetry | `staging` | `production` |
| `RUNTIME_NAME` | INFRA | Workers/runtime telemetry | Worker-specific staging value | Worker-specific production value |
| `PRIMARY_REGION` | INFRA | Runtime operations | `ap-south-1` | `ap-south-1` |
| `FAILOVER_REGION` | INFRA | Runtime operations | `ap-southeast-1` | `ap-southeast-1` |
| `EVENT_QUEUE_NAME` | INFRA | Workers queue routing | `letbuyy-events-staging` | `letbuyy-events-production` |
| `ANALYTICS_QUEUE_NAME` | INFRA | Workers queue routing | `letbuyy-analytics-queue-staging` | `letbuyy-analytics-queue-production` |
| `SEARCH_QUEUE_NAME` | INFRA | Workers queue routing | `letbuyy-search-queue-staging` | `letbuyy-search-queue-production` |
| `NOTIFICATION_QUEUE_NAME` | INFRA | Workers queue routing | `letbuyy-notifications-queue-staging` | `letbuyy-notifications-queue-production` |
| `RAZORPAY_KEY_ID` | PUBLIC | Worker/mobile payment config | Razorpay test public key ID in secret/config store | Razorpay live public key ID in secret/config store |
| `RAZORPAY_KEY_SECRET` | SECRET | Razorpay server calls | Razorpay test secret | Razorpay live secret |
| `RAZORPAY_WEBHOOK_SECRET` | SECRET | Razorpay webhook verification | Razorpay test webhook secret | Razorpay live webhook secret |
| `PAYMENT_CONFIG_ENCRYPTION_KEY` | SECRET | Worker payment config encryption | Cloudflare staging secret | Cloudflare production secret |
| `R2_BUCKET` | INFRA | Worker binding/local template | Wrangler binding to `letbuyy-media-staging` | Wrangler binding to `letbuyy-media-production` |
| `LETBUYY_ENVIRONMENT` | INFRA | Local stack scripts | Local-only | Local-only |
| `DATABASE_URL` | SECRET | Local DB/scripts | Local or Supabase staging connection secret | Supabase production connection secret |
| `REDIS_URL` | SECRET | Local Redis/scripts | Local or staging Redis secret | Production Redis secret |
| `QUEUE_EMULATOR_URL` | INFRA | Local queue emulator | Local-only | Local-only |
| `EVENT_STORE_URL` | SECRET | Local event store | Local-only | Production event store secret if used |
| `REPLAY_RUNTIME_URL` | INFRA | Local replay runtime | Local-only | Production replay endpoint if used |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | INFRA | Observability | Staging OTLP endpoint | Production OTLP endpoint |
| `PROMETHEUS_URL` | INFRA | Monitoring | Staging Prometheus URL | Production Prometheus URL |
| `GRAFANA_URL` | INFRA | Monitoring | Staging Grafana URL | Production Grafana URL |
| `LOKI_URL` | INFRA | Logging | Staging Loki URL | Production Loki URL |
| `TEMPO_URL` | INFRA | Tracing | Staging Tempo URL | Production Tempo URL |
| `FEATURE_FLAG_API_URL` | INFRA | Feature flags | Staging feature flag API URL | Production feature flag API URL |
| `FEATURE_FLAG_EXPOSURE_MODE` | INFRA | Feature flags | `staging` or local policy | Production policy |
| `MAILPIT_SMTP_URL` | INFRA | Local email sandbox | Local-only | Not used |
| `MAILPIT_UI_URL` | INFRA | Local email sandbox | Local-only | Not used |
| `SMS_SANDBOX_URL` | INFRA | Local SMS sandbox | Local-only | Not used |
| `PROVIDER_SANDBOX_URL` | INFRA | Local provider sandbox | Local-only | Not used |
| `STRIPE_SANDBOX_MODE` | INFRA | Local payment sandbox | `true` | `false` |
| `RAZORPAY_SANDBOX_MODE` | INFRA | Local payment sandbox | `true` | `false` |
| `PAYPAL_SANDBOX_MODE` | INFRA | Local payment sandbox | `true` | `false` |
| `PAYMENT_PROVIDER_SIDE_EFFECTS` | INFRA | Local payment sandbox policy | `sandbox-only` | Production provider side effects |
| `API_BASE_URL` | PUBLIC | Mobile app dart defines | `https://api-staging.letbuyy.store/v1` | `https://api.letbuyy.store/v1` |
