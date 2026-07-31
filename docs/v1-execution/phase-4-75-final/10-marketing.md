# 10 — Marketing

**Marketing: ~67% → ~75%.** A real campaigns UI landed this phase on top of the already-complete backend; reviews + SEO were already real.

## Done (verified)
- **Email campaigns UI** (NEW this phase) — `[store]/marketing/page.tsx` + 4 proxies (list/create, get, audience-preview, send). Consumes the real `marketing.emailCampaigns.{list,create,get,previewAudience,send}` (all already in api-client). Create campaign (name/subject/preview/body/audience), **live recipient-count preview**, user-triggered send with confirm dialog + idempotency key, honest **sandbox-vs-live** disclosure (depends on `RESEND_API_KEY`). Loading/empty/error states, token-clean. **Linked in nav** (Marketing → Campaigns).
- **Reviews** (prior) — full CRUD + approve/reject/reply + verified badge. Production-ready.
- **SEO** (prior) — dynamic store-aware sitemap + robots.

## Remaining (UI / deploy / worker)
- **Abandoned-cart UI + detection worker** — the `cart_abandoned` email template exists but no worker triggers it; no UI. Needs a real detection worker (backend) → not faked.
- **SEO management dashboard** (meta editor) + **redirect management UI** — gateway redirect support exists; no UI.
- **Campaign edit flow** — the api-client `update` exists but no edit UI was wired (create + send only this phase).
- **H6 deploy seam** — all email is sandbox until `RESEND_API_KEY` + `LETBUYY_EMAIL_MODE=live` + SPF/DKIM/DMARC are provisioned (deploy-time, not code).
- `marketing:write` RBAC currently guards coupons (Discounts); wiring it on the campaign send/create routes is the same one-line follow-up.

**Verdict:** campaigns now ship as real, nav-linked UI over a complete backend (sandbox until H6); reviews + SEO were already real; abandoned-cart + SEO/redirect dashboards remain (worker/UI).
