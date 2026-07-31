/**
 * @letbuyy/lcis-adapters — READ-ONLY live adapters over external sources of truth
 * + the shared adapter platform (LCAS — Live Connectivity & Adapter System, Phase 9).
 *
 * 18 adapters: Supabase / GitHub / Cloudflare / Vercel (Phase 3) + GitHub Actions /
 * PostgreSQL / Redis / Docker / Kubernetes / Stripe / Razorpay / Analytics Engine /
 * Email / Object Storage / Workers / Queues / Cron / Realtime (Phase 9).
 *
 * LCIS observes, normalises, correlates, explains, and verifies. It is never the source
 * of truth and never mutates. Every adapter is GET-only through the host-allowlisted
 * ReadOnlyHttpClient; absent credentials → honest NOT_CONNECTED + the exact env vars.
 */
export * from './shared/index';
export * from './supabase/index';
export * from './github/index';
export * from './cloudflare/index';
export * from './vercel/index';
export * from './github-actions/index';
export * from './postgres/index';
export * from './redis/index';
export * from './docker/index';
export * from './kubernetes/index';
export * from './stripe/index';
export * from './razorpay/index';
export * from './analytics-engine/index';
export * from './email/index';
export * from './storage/index';
export * from './workers/index';
export * from './queues/index';
export * from './cron/index';
export * from './realtime/index';
export * from './catalog';
