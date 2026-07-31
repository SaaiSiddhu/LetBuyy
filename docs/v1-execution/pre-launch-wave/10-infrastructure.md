# 10 — Production Infrastructure (Stream J)

**Readiness: ~15% code-certifiable, ~85% human-gated.** This is the dominant launch gate.

The `production-topology.json` itself is labelled `"mode": "governance-contract-not-live-evidence"` — it encodes intent, not live operational evidence.

## Code-present (verifiable)
- 4 Cloudflare Workers with staging+production `wrangler.toml` (api-gateway, queue-workers, webhook-service, mobile-bff).
- 5-queue fanout + dead-letter queues + per-queue retry; cron `17 */6 * * *`.
- 186 migrations + 156 RPCs + 651 policies (migration-gated, not provisioned).
- Vercel deploy targets + topology/lifecycle JSON configs (schema-validated).

## The H-seam wall (NOT certifiable from the repo)
| Seam | What | Tier |
|---|---|---|
| H1 | Push to origin + branch protection | Day 1 |
| H2 | ~41 production secrets provisioned | Launch-blocking |
| H3 | DNS wildcard `*.letbuyy.com` + SSL | Launch-blocking |
| H4 | Supabase production project + 186 migrations applied | Launch-blocking |
| H5 | `INTERNAL_AUTH_LEGACY_ACCEPT=false` after rotation | Week 2 |
| H6 | Resend live keys + SPF/DKIM/DMARC (platform-console login is hard-broken without it) | Launch-blocking |
| H7 | Turnstile live keys | Days |
| H8 | Razorpay Route PA onboarding (regulatory) | Launch-blocking, **weeks** |
| H9 | Legal ToS / Privacy / DPDP | Founder + legal |

Plus 11 `SKIP_NEEDS_HUMAN_` placeholders (FCM/APNS/Twilio/AI-credit) — not on the V1 core-commerce critical path.

**Verdict:** infrastructure cannot be certified from this engineering environment. It is gated by the H2–H9 human/business/regulatory seams — the primary reason a fully-certified GO cannot be issued here.
