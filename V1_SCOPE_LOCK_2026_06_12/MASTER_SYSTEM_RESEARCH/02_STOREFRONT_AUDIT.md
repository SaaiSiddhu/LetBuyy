# 02 — STOREFRONT AUDIT (apps/storefront-runtime)

**HEAD `cd5905be` · code-verified. Status: implemented / partial / missing / broken.**

| Capability | Status | Evidence |
|---|---|---|
| Routing / subdomains | **implemented** | `middleware.ts` re-exports `proxy`; host-based rewrite to `/store/[subdomain]` |
| Custom domains | **implemented** | `proxy.ts` + `storefront-access.ts` + gateway `public-routes.ts` (claim/verify/Vercel-attach) — needs wildcard DNS (human seam) to be live |
| Collections | **implemented** | `collections/[slug]/page.tsx` → composition engine |
| Products + variants | **implemented** | `product/[productId]` + variant picker → cart `variant_id` |
| Search | **partial** | client-side filter on the page; trigram indexes (mig 084) + `SEARCH_QUEUE` exist but the storefront search UX is thin; `?search=` wiring incomplete |
| Cart | **implemented** | server cart `cart-routes.ts` (CRUD + re-pricing + signed checkout-url); React page + `lb-cart-drawer` island share `lb_cart` state |
| Checkout | **implemented** (separate origin) | React checkout-client → `/api/orders` + Razorpay/COD; signed handoff to `checkout.letbuyy.com` |
| Customer account | **implemented** | `account/{orders,addresses,settings,wishlist}` over `/api/customer/*` |
| Login | **implemented** | `/api/customer/login` (bcrypt, Turnstile, HS256 session) |
| Register | **partial (new)** | a `api/customer/register/route.ts` now exists (LB-12) — verify the not-exists precondition + session mint end-to-end |
| Orders / tracking | **implemented** | account orders + guest lookup; 4-step status timeline + tracking number |
| Gift cards (buyer) | **broken/absent** | no storefront redemption UI; issued codes unredeemable (split-table) |
| Appearance | **partial (new)** | storefront now references `site_settings` (2 hits in `storefront.ts`) — LB-9 bridge started; verify it reaches `:root` vars + custom_css sanitization |
| Announcement bar | **broken** | no `announcementBar` in `renderer-registry.tsx` → renders the "unavailable section" fallback on every store (LB-8 open) |
| Settings (storefront-side) | **implemented** | SEO (robots/sitemap/JSON-LD), access gating, policy pages (ContentService) |
| Liquid rendering | **dormant** | default OFF; React is the live renderer |

**Verdict:** the buyer journey browse→cart→checkout→account→track is implemented and committed. **Two visible defects remain: the broken announcement bar (LB-8) and the unredeemable gift-card surface (LB-11).** Appearance (LB-9) and register (LB-12) are freshly implemented — verify. Live behavior is gated on DNS + secrets (human seams).
