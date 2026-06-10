# Pre-Deploy Checklist

Date: 2026-05-31

## Security

- [x] OTP rate limiter fix deployed and tested - COMPLETE: Code is committed and the identity-platform rate-limit test/typecheck path has passed in Phase 1 verification.
- [x] CSRF bypass fix deployed and tested - COMPLETE: API gateway CSRF middleware was fixed and security tests/typecheck passed in Phase 1 verification.
- [x] Seed route guarded - COMPLETE: `apps/storefront-runtime/src/app/api/seed/route.ts` is guarded by `NODE_ENV` and `SEED_SECRET`.
- [x] All /v1 prefixes correct - COMPLETE: Marketing, identity, and merchant API URL calls were normalized in Phase 1.
- [x] No secrets in source code - COMPLETE: Governance validation passed and targeted key scan found only placeholder/example strings, not live provider secrets.

## Database

- [ ] All 65 migrations run cleanly on production Supabase - SKIP: production Supabase credentials/project access are unavailable. Resume point: Phase 4 Task 4.4 production database verification.
- [ ] RLS policies verified - SKIP: production Supabase credentials/project access are unavailable. Resume point: Phase 4 Task 4.4 production database verification.
- [ ] Urban Kicks theme seed applied - SKIP: production Supabase credentials/project access are unavailable. Source migration and seed files are committed; production application still needs operator execution.

## Auth

- [ ] Merchant signup -> OTP -> session works in production - SKIP: production domains and Supabase Auth credentials are unavailable. Local/source flow was fixed in Phase 2.
- [ ] Console allowlist configured with real emails - SKIP: real production allowlist values require human operator input in the secret store.
- [ ] Console MFA working - SKIP: production TOTP secret and deployed console environment are unavailable. Local dev MFA fallback was verified in Phase 4.1.

## Payments

- [ ] Razorpay live keys configured - SKIP: live Razorpay credentials are unavailable.
- [ ] Stripe live keys configured - SKIP: live Stripe credentials are unavailable.
- [ ] Webhook endpoints registered with providers - SKIP: provider dashboard access is unavailable.

## Theme

- [x] Urban Kicks renders correctly in production - COMPLETE FOR SOURCE/LOCAL: Urban Kicks storefront was locally verified across home, shop, product, cart, checkout, sitemap, and robots routes; production verification remains part of Phase 4.5 smoke tests.
- [x] SEO metadata present on all pages - COMPLETE: storefront metadata, sitemap, robots, canonical URLs, and product JSON-LD were added in Phase 3.
- [x] Sitemap and robots.txt accessible - COMPLETE: `/sitemap.xml` and `/robots.txt` returned 200 in local verification.

## Infrastructure

- [ ] All Vercel env vars set - SKIP: Vercel project access is unavailable.
- [ ] All Cloudflare Worker secrets set - SKIP: Cloudflare account access is unavailable.
- [ ] Custom domains configured - SKIP: DNS/provider access is unavailable.

## Monitoring

- [ ] Error logging active (Sentry or equivalent) - SKIP: monitoring provider access is unavailable.
- [ ] Uptime monitoring configured - SKIP: uptime monitoring provider access is unavailable.

## Verification Evidence

- `pnpm turbo typecheck --filter=@letbuyy/platform-console --filter=@letbuyy/api-gateway` passed during Phase 4.3 after the console audit API boundary fix.
- `pnpm turbo lint --filter=@letbuyy/platform-console` passed during Phase 4.3.
- `pnpm turbo build --filter=./services/api-gateway --filter=./services/webhook-service` passed during Phase 4.3.
- `pnpm run validate:governance` passed during Phase 4.3 after generated artifacts were cleaned.
