# LetBuyy Merchant OS — Executive One-Pager

**Date:** 2026-06-08 · **Full audit:** `LETBUYY_MERCHANT_OS_MASTER_AUDIT.md` · **Question:** *Can a merchant run 100% of their business from mobile?*

---

## The verdict — **No (today, 0%; with config fixes, ~50–55%).**

LetBuyy has built an **impressive merchant control surface on top of hollow execution rails.** The phone can *describe* a business with surprising depth (products, orders, inventory, themes, staff, domains) — but it cannot yet *run* one, because the rails that move money to the merchant and goods to the customer are **scaffolds that return `success` without doing anything**, and on a stock production build **a merchant cannot even log in.**

**Overall readiness: 2.4 / 5** — *"the hard, correct parts are built; the parts that make it a business are not."*

---

## The two-altitude answer

- **Stock prod build → 0% usable.** Login is bricked: shipped `dart-defines/production.json` carries placeholder Cloudflare Turnstile keys (`SKIP_NEEDS_HUMAN_*`); the challenge screen errors before it renders.
- **With a real Turnstile key + secrets → ~50–55% of daily tasks.** Strong on catalog/orders/inventory/CRM/themes/staff. Cannot do money-out, real fulfillment, marketing, or resellers.

---

## What's genuinely good (protect these)

- **Mobile visual theme + section editor with live preview — better than Shopify's mobile app.**
- **Discount & gift-card *creation* on the phone** (Shopify forces desktop).
- **Full staff management on mobile** (Shopify only enforces perms).
- **Inventory depth** (POs, suppliers, transfers, barcode) ahead of its own web admin.
- A **real, mature multi-tenant backend** (`api-gateway`, ~42K LOC, Supabase + queues + RBAC) and a clean fail-closed mobile BFF.

---

## Top 10 gaps (severity)

| # | Gap | Sev | Reality |
|---|---|---|---|
| 1 | **Mobile login bricked** (placeholder Turnstile) | S0 | 0% usable on prod build |
| 2 | **Payouts don't disburse** (`payout-transfer-adapter` → `sandbox_<rail>`, no HTTP) | S0 | Merchants can't get paid |
| 3 | **Shipping labels fabricated** (`createScaffoldLogisticsProvider`, fake `.test.letbuyy.store` PDFs) | S0 | Merchants can't fulfill |
| 4 | **Payment forgery + cross-tenant RLS** (fixes committed — confirm *deployed*) | S0 | Free goods / account takeover |
| 5 | **Stubbed rails report `success`** | S0 | Product lies to merchant |
| 6 | **KYC stubbed** (`kyc_sandbox_*`) | S1 | Onboarding verifies nothing |
| 7 | **No marketing/campaigns** (only notifications + coupons) | S1 | No growth loop |
| 8 | **WhatsApp is 45%** — 1:1 pipe only, no lifecycle/broadcast/inbox | S1 | The India wedge is unbuilt |
| 9 | **Resellers = 0%** (zero code) | S1 | Social-commerce absent |
| 10 | **Governance theater** — ~167–173 validators green, ~8 real; ~90 import cycles reported as 0 | S2 | Green CI ≠ production-ready |

---

## 3-year roadmap (one line per tier)

- **P0 (8 wks) — "make it exist":** fix login · deploy security fixes · **real payouts via rented PA-split (never self-custody — licensing)** · double-entry settlement ledger · provider-mode honesty badge · real KYC · one real carrier (Shiprocket) · finish domain migration.
- **P1 (≈4 mo) — "operate & grow":** WhatsApp order-lifecycle messages (the cheapest durable wedge) · triggered transactional marketing · abandoned-cart + server cart · push wired · COD/RTO risk · NDR/COD reconciliation · CRM LTV/RFM · fine-grained RBAC · GST invoices.
- **P2 (≈6 mo) — "differentiate":** WhatsApp broadcast/inbox · campaigns · AI product+theme copilots · reseller *links* (not a network) · checkout settings/analytics in app.
- **P3 (Yr 2):** reseller payouts · loyalty · WA catalog/checkout · unified inbox · internal risk/T&S.
- **P4 (defer — do NOT build):** Wasm extensibility runtime · cross-merchant wallet · self-custodied payout engine · 13 microservices · multi-region. *Per CTO review: ~half the imagined roadmap should not be built in 3 years.*

---

## The strategic read

The bottleneck is **the backend rails and config, not the phone.** The defensible wedge is real and under-served: **the Indian micro-seller who wants their own branded store, their own payout settled T+1, with WhatsApp order updates by default, on their phone, at 0% transaction fee.** Shopify can't serve them (steerage tax); Meesho only offers a marketplace stall; Dukaan vacated the floor. **The real threats are Razorpay (money) and Shiprocket (logistics) moving sideways** — so own the money + WhatsApp loop, kill the 2.5%-GMV rake, and **make four rails real before adding any new surface.**

---

## The one number that matters

**Until P0 ships, effective product value = ₹0** (can't log in, can't get paid, can't ship). P0 is not improvement — it is existence. Everything else is upside built on top of it.
