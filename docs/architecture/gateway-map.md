# API Gateway Map

`services/api-gateway` — Hono app mounted at `/v1`. Every app proxies here via `@letbuyy/api-client`.

## Route groups (`src/routes/`)
- `orders.ts` — order CRUD + `PATCH /:id` status machine (cancel/refund → lifecycle email + gift-card restore), refund completion.
- `storefront/checkout-payment-routes.ts` — checkout, COD/Razorpay, signature verify, signed handoff.
- `products.ts` + `gift-cards.ts` — products, collections, gift-card issue/list/balance/transactions/status (RPC-only).
- `storefront/customer-engagement-routes.ts` + `customer-registration.ts` — customer login/register (HS256).
- `payments.ts`, `coupons.ts`, `themes.ts`, `stores.ts`, `security.ts`, `internal-console.ts`, marketing/whatsapp/media.
- `graphql/` — admin/storefront GraphQL + REST shim.

## Cross-cutting
- **Auth/tenancy** — `resolveTenantContextForOrder`, `verifySiteOwnership`, `getSupabaseAdmin` (service role behind ownership checks).
- **Money** — all mutations via `db.rpc(...)` to `SECURITY DEFINER` functions; idempotency adapter.
- **Observability** — `middleware/observability.ts` (skips internal GraphQL shim subrequests).
- **Governance** — 129 app routes classified (`domain-boundary` + `route-ownership`); route files ≤ 1500 lines.

## Env/bindings
`SUPABASE_*`, `CUSTOMER_SESSION_SECRET`, `CHECKOUT_SIGNING_SECRET`, `STEP_UP_SIGNING_SECRET`, `RAZORPAY_*`, `RESEND_*`, `TURNSTILE_SECRET_KEY`, `QUEUE_TENANT_ENVELOPE_SECRET`, `NOTIFICATION_QUEUE`, `LETBUYY_IDENTITY_PUBLIC_JWKS`.
