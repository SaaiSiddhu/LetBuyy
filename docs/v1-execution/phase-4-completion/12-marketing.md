# 12 — Marketing

**Readiness: ~67%.** Reviews + SEO are real; email campaign backend is complete but UI-less.

## Real
- **Reviews:** full CRUD + approve/reject/delete + merchant reply + verified-purchase badge (`reviews.ts`, `reviews/page.tsx`). Production-ready.
- **SEO:** dynamic store-aware sitemap (products/pages/blog) + robots.txt with noindex-when-unpublished (`storefront-runtime/src/app/sitemap.ts`, `robots.ts`).
- **Email campaigns (backend):** full CRUD, audience resolver (all/segment/manual), preview, Resend live send, sandbox fallback, idempotency, per-recipient tracking (`marketing.ts`).
- **Transactional emails:** order confirm/shipment + **`order_cancelled`/`order_refunded` (LB-10 — confirmed CLOSED)** + `cart_abandoned` template.

## Gaps (documented)
- **No marketing campaign UI** (`[store]/marketing` absent) — backend 100% ready. HIGH (UI; V1.1).
- **H6 deploy seam:** `RESEND_API_KEY` + `LETBUYY_EMAIL_MODE=live` + SPF/DKIM/DMARC not provisioned → all email is sandbox until then. HIGH (deploy, not code).
- `cart_abandoned` template exists but **no detection worker** triggers it. MEDIUM.
- WhatsApp (WABA) delivery blocked on Meta onboarding. MEDIUM.
- No SEO management UI (meta editor/redirects); JSON-LD + OG completeness unverified. MEDIUM/LOW.

**Verdict:** reviews ship now; SEO is structurally sound; transactional email is code-complete (LB-10 closed) pending H6; campaign UI + abandoned-cart worker are V1.1.
