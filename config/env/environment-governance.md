# Environment Governance

## Runtime Ownership

| Runtime | Env authority | Storage location |
|---|---|---|
| Next apps under `apps/*` | App-specific public URLs and server-only adapter secrets | Vercel project environment variables |
| Cloudflare Workers under `services/*` | Worker bindings, provider secrets, internal service auth, R2/KV/queue bindings | Cloudflare dashboard, Wrangler secrets, or IaC-managed bindings |
| Flutter apps under `apps/mobile/*` | Public API URLs and build-time public provider identifiers | Build system `--dart-define` values or release pipeline configuration |
| Supabase scripts under `database/supabase/scripts` | Local operator credentials only | Shell session variables or CI secret store |
| CI/CD | Automation-only credentials | GitHub Actions secrets or provider OIDC where available |

## Secret Classification

- Public: values safe to expose in browser bundles or mobile builds, such as public URLs and anon/public keys.
- Server secret: values used only by server-side Next route handlers or Worker code.
- Provider secret: Stripe, Razorpay, PayPal, Resend, Redis, Turnstile, Supabase service-role, webhook, and internal API secrets.
- Infrastructure binding: Cloudflare R2/KV/queue/Durable Object names and bindings. Treat names as config and credentials as secrets.

## Naming Rules

- Browser-exposed web values must use `NEXT_PUBLIC_`.
- Server-only web and worker values must not use `NEXT_PUBLIC_`.
- Provider secrets must end with `_SECRET`, `_SECRET_KEY`, `_WEBHOOK_SECRET`, or `_TOKEN` as appropriate.
- Runtime aliases such as `LETBUYY_API_URL` and `NEXT_PUBLIC_API_URL` must resolve to the same `/v1` API surface.
- Database identity remains `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; only the service-role key is privileged.

## Promotion Rules

- Staging and production are the only deployment targets for release readiness. Local and development execution are developer/integration sandboxes only.
- Local execution must stay staging-shaped: same variable names, `/v1` API shape, worker binding names, and provider-mode semantics. It must not point at staging data, staging service-role keys, production secrets, or live provider accounts by default.
- Local, dev, staging, and production values are separate. Never reuse production secrets in local templates or the Cloudflare `env.dev` Worker environment.
- Promote variable names through code review; promote values through provider secret stores.
- Rotate secrets after accidental exposure and record the rotation task in `tasks/todo.md`.
- Historical `all.env` references are treated as incident memory. The file must remain ignored and must not be regenerated with real values.
