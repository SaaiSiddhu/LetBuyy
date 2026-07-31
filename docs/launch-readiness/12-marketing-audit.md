# Marketing Audit

**Date:** 2026-06-19  
**LCIS Domains:** `discounts` (marketing campaigns), `notifications` (email/WhatsApp), `storefront` (reviews, blog, contacts)  
**Evidence:** `services/api-gateway/src/routes/reviews.ts` (318 lines), `services/api-gateway/src/routes/marketing.ts`, `services/api-gateway/src/routes/notifications.ts`, `CAPABILITY_BACKLOG.md` CAP-C18

---

## Completion Score: **62%**

*SEO and reviews are strong. Email and WhatsApp are infrastructure-complete but live delivery blocked.*

---

## Sub-System Audit

### SEO
**Score: 82%**

**What exists:**
- Storefront `sitemap.ts`: `apps/storefront-runtime/src/app/sitemap.ts`
- `robots.ts`: `apps/storefront-runtime/src/app/robots.ts`
- Next.js server-side rendering for all product/collection/blog pages
- `storefront_page_revisions` + `storefront_pages` for custom page SEO
- `blog_posts` + `blog_post_tags` for content SEO
- `store_metafield_definitions` for custom SEO metadata
- URL handle management for products, collections, pages
- `storefront_slug_redirects` table for 301/302 redirects

**What is missing:**
- Structured data / JSON-LD schema markup (Product, BreadcrumbList, Organization) — unverified
- Open Graph meta tags for social sharing (likely in Next.js `generateMetadata`, unverified completeness)
- SEO page audit tool in merchant admin

**Evidence:** `sitemap.ts`, `robots.ts`, `storefront_slug_redirects` table, SSR pages

---

### Reviews
**Score: 88%**

**What exists:**
- `product_reviews` table in products domain
- Reviews API: `services/api-gateway/src/routes/reviews.ts` (318 lines)
- Review submission from storefront: `apps/storefront-runtime/src/app/api/reviews/route.ts`
- Review page in merchant admin: `apps/merchant-control-plane/src/app/[store]/reviews/page.tsx`
- `sync_product_review_moderation_status` RPC — moderation workflow
- `review_check_runs` table for review validation
- Review display in storefront (product pages)
- Star rating + text review

**What is missing:**
- Verified purchase badge on reviews
- Review response from merchant (public reply)

**Evidence:** `reviews.ts:318 lines`, `product_reviews` table, `reviews/page.tsx`, `review_check_runs` table

---

### Email
**Score: 52%** ← **Blocked by LB-10 + H6**

**What exists:**
- Email infrastructure: `services/api-gateway/src/routes/email.ts`
- `notification-core` package: `packages/notification-core/src/index.ts`
- Order confirmation email template: working
- `order_shipped` template: exists (`notification-core/src/index.ts:329`)
- `order.fulfilled → order_shipped` mapping: exists (`notification-core/src/index.ts:392`)
- Email logs: `email_logs` table
- Resend adapter: configured to use Resend when `RESEND_API_KEY` present
- Transactional email routing: notification queue worker
- CAP-C18: "repository-side Resend dispatch now runs when a real RESEND_API_KEY is configured"

**What is broken/missing:**
- LB-10: No `order_cancelled` or `order_refunded` email templates — the events exist but no email type
- H6: `RESEND_API_KEY` not provisioned + SPF/DKIM/DMARC not configured → emails no-op in production
- `LETBUYY_EMAIL_MODE=live` not set → email silently no-ops
- Marketing campaign sending UI (in merchant admin, not confirmed fully built)

**Evidence:** `ACTUAL_STATE.md` — "LB-10 partial: order_shipped exists; no order_cancelled/order_refunded templates"; `CAPABILITY_BACKLOG.md` CAP-C18

---

### WhatsApp
**Score: 45%**

**What exists:**
- `whatsapp.ts` route: implied by notifications domain with `wa_templates`, `wa_optins`, `whatsapp_messages` tables
- `wa_sessions` in authentication tables
- WhatsApp route in gateway: `notifications.ts` covers WhatsApp
- Template management: `wa_templates` table

**What is missing:**
- WhatsApp Business API provider credentials — not provisioned
- WhatsApp opt-in UI at checkout
- Automated WhatsApp notifications for orders (provider-dependent)
- Live WhatsApp Business Account approval (Meta process)

**Evidence:** LCIS notifications domain — `wa_templates`, `wa_optins`, `whatsapp_messages` tables

---

### Abandoned Cart
**Score: 25%**

**What exists:**
- `carts` table captures abandoned cart state
- Cart persistence across sessions
- Event infrastructure: cart abandonment can be detected via no-checkout after cart creation

**What is missing:**
- Abandoned cart detection worker (no dedicated queue consumer found for this)
- Abandoned cart email trigger (not in notification-core templates)
- Abandoned cart analytics
- Countdown / urgency triggers

**Evidence:** Absence of abandoned cart email template in `notification-core`, no dedicated queue consumer

---

## Blockers

| # | Blocker | Severity | Impact |
|---|---|---|---|
| LB-10 | Missing cancelled/refunded lifecycle emails | 🟠 High | Customers not notified on key events |
| H6 | Resend live (SPF/DKIM/DMARC + live mode) | Human seam | All email no-ops until provisioned |

---

## Launch Readiness

**Marketing is 62% ready.** SEO and reviews are launch-ready. Email transactional is partially complete (LB-10 + H6 blocks). WhatsApp and abandoned cart are V1.1 scope.

The most important V1 marketing capability — order confirmation emails — works once H6 (Resend) is provisioned. The gap is cancelled/refunded lifecycle emails (LB-10, ~2 dev-days).

**Recommended V1.0.0 scope:** SEO (sitemap/robots/SSR) + reviews + order confirmation email + order shipped email (after H6).

**Delay to V1.1:** WhatsApp notifications, abandoned cart recovery, marketing email campaigns, review response from merchant.

**Delay to V2:** SMS notifications, loyalty email sequences, A/B testing, influencer codes.
