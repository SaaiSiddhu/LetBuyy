# Mobile BFF Service Governance

Purpose: Cloudflare Hono worker that bridges mobile merchant `lb_session` cookies/tokens into gateway-accepted internal session headers.

Runtime boundary: `services/mobile-bff`.

Allowed dependencies:

- `@letbuyy/auth-core` for internal session header signing and session-token validation.
- Hono for worker routing.
- Cloudflare service bindings declared in `wrangler.toml`.

Forbidden dependencies:

- No imports from `apps/*`, `legacy/*`, or repository-level `infrastructure/*`.
- No direct database, Supabase, Firebase, payment-provider, or storage SDK access.
- No business workflow orchestration. The BFF is a transport trust boundary only.
- No committed real secrets. `INTERNAL_API_SECRET` must be provided by Cloudflare secrets for live environments.

Execution rules:

- Accept mobile merchant `lb_session` only from `Authorization: Bearer`, `X-LetBuyy-Session-Token`, or the `lb_session` cookie.
- Strip mobile Bearer/cookie credentials before proxying to `services/api-gateway`.
- Inject only `X-LetBuyy-Internal-Session-Token`, `X-LetBuyy-Internal-Timestamp`, and `X-LetBuyy-Internal-Signature` created by `@letbuyy/auth-core`.
- Keep route authorization and tenant checks in the gateway.
