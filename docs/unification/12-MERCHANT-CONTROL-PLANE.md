# 12 — Merchant Control Plane

One merchant account, one control plane (`merchant_web` on desktop, `merchant_app` on mobile), modules switched on by channel enrolment and entitlements. Store Ops and POS are **modes** of the same apps gated by location memberships (founder direction 2026-09-19). Riders and platform operators are not merchants and are not in this plane.

## 1. What exists today (S1) and what is missing

| Area | merchant_web | merchant_app | Backend | Gap for the unified plane |
|---|---|---|---|---|
| Dashboard, analytics | `/dashboard`, `/analytics` | `dashboard/home`, `analytics` | `/analytics/*`, `/commerce-analytics/*`, `mobile-bff` | channel breakdown |
| Products, collections, import | yes | yes | `/products`, `/smart-collections`, import | brand, SKU uniqueness, per-channel publish panel, node offers |
| Inventory: levels, locations, transfers, purchase orders, suppliers, reservations, receipts, history, operations dashboard | yes | yes | `/inventory/*` | node kinds, custody, in-transit, partner acceptance |
| Orders, returns, refunds, labels, packing slips | yes | yes | `/orders/*`, `/returns`, `/shipping/labels` | Quick order queue and Store Ops transitions |
| Customers, segments, notes | yes | yes | `/customers/*` | buyer-linked view (still per-store data only) |
| Online store: themes, pages, navigation, domains, policies | yes | yes (theme, editor, preview, pages, posts, media) | `/themes/*`, `/custom`, `/pages` | none |
| Marketing: coupons, campaigns, ads, reviews, leads, WhatsApp | yes | yes | `/coupons`, `/marketing`, `/ads`, `/whatsapp` | channel-scoped promotions with funder |
| Money: payouts, payment config, billing, plan | yes | `money`, `subscription/*` | `/payouts`, `/payments/*`, `/billing` | per-channel plans, commission statements |
| Settings: business, shipping, taxes, staff, security, localization, notifications | yes | yes | respective routes | location-scoped staff roles |
| KYC | (via settings) | `kyc/kyc_screen` | `/kyc` | vendor adapter |
| Sales Channels | **absent** | **absent** | **absent** | new domain |
| Store Ops mode | absent | absent | absent | new |
| POS mode | absent | absent | absent | new |

## 2. Target information architecture

Derived from the current page set plus the founder's list; grouping is what changes, not the existing screens.

```text
Dashboard                 (totals with Storefront / Marketplace / Quick breakdown)
Orders                    (all channels; filters by channel; Quick queue with SLA timers)
Products                  (master catalogue · variants · collections · import)
  └── Publish             (per product: Storefront ✓ ₹65 · Marketplace ✓ ₹67 · Quick ✓ ₹69 · stock by node)
Inventory                 (nodes · levels · transfers incl. to partner/dark stores · purchase orders · counts)
Customers
Sales Channels            (NEW: Online Store · LetBuyy Marketplace · LetBuyy Quick — status, enable, configure)
Online Store              (themes, pages, navigation, domains, preferences)
Marketplace               (listing moderation status, categories, sponsored placements)
LetBuyy Quick             (nodes enrolled, zones served, hours, capacity, SLA performance)
Marketing                 (discounts, campaigns, ads credits, reviews, leads)
Analytics
Payments & Settlements    (statements per channel, commission and fee lines, payouts)
Delivery                  (parcel: labels, carriers · Quick: handover metrics)
Staff                     (site roles + location memberships: cashier, picker, custodian)
Settings · Integrations · Plans & Billing
Modes (entered from the shell, gated by membership):
  Store Ops mode          (task queue: accept → pick → pack → ready → handover; counts; damage)
  POS mode                (terminal, cashier session, counter sale, suspended baskets, receipts, shift)
```

## 3. Sales Channels domain (new)

Per site, per channel, one row with a lifecycle instead of flags:

```text
site_channel_enrolments(site_id, channel, status, eligibility jsonb, configuration jsonb, activated_at, suspended_reason)
status ∈ available · selected · configuration_required · verification_required · pending_review · active · suspended · disabled
```

- **Available** is computed: plan entitlement (`STOREFRONT_CHANNEL`, `MARKETPLACE_CHANNEL`, `QUICK_CHANNEL`) × operational eligibility (Quick only where the merchant's nodes fall inside served zones, and category is allowed) × merchant status (KYC, suspension).
- **Configuration required** lists the channel's setup steps: storefront = theme + domain; marketplace = categories + listing policy acceptance; quick = at least one node with zone coverage, hours, capacity, and either merchant fulfilment or a custody agreement with a dark/partner store.
- **Verification required / pending review** covers KYC and marketplace moderation.
- Enabling and disabling are idempotent commands with audit rows; disabling a channel unpublishes its listings (soft) without deleting them.

Onboarding order becomes: account → business details → KYC → **select channels** → select plan → configure selected channels → add/import products → publish. The existing `/onboarding` attempt model gains the channel step; nothing else changes.

## 4. Channel publishing per product

A "Publish" panel on the product page, backed by `channel_listings` (exists) with prices (new columns) and `node_offers` (new):

| Column | Storefront | Marketplace | Quick |
|---|---|---|---|
| status | published / draft | draft → pending_review → approved / rejected (moderation exists) | published per node |
| price | channel price or product price | channel price (moderated) | node offer price |
| visibility | public / hidden | public / hidden | per node |
| stock shown | merchant location(s) | merchant location(s) | node level |
| commission rule | per founder decision | per founder decision | per founder decision |

Rules: unpublished = no listing row for that channel; a node offer without stock is visible as unavailable, never orderable; price resolution node → channel → product with the winning offer snapshotted into `order_items`.

## 5. Plans and entitlements

Keep `billing_*`, `site_entitlement_overrides` and `site_usage_meters`; add `plan_features(plan_code, feature_key, limit)` and a single `hasEntitlement(site, key)` service used by the channels domain and by route guards. Feature keys: `STOREFRONT_CHANNEL`, `MARKETPLACE_CHANNEL`, `QUICK_CHANNEL`, `CUSTOM_DOMAIN`, `STAFF_SEATS`, `LOCATIONS`, `ADVANCED_ANALYTICS`, `POS_TERMINALS`. Commercial prices are not hard-coded; D-6 grandfathering applies to existing subscribers.

## 6. Store Ops mode

For merchant-run nodes: a task queue view inside the merchant apps showing Quick orders by promise time; transitions accept/decline (within policy), pick (scan-confirm), pack (package count), ready (staging slot), handover (rider verification). Every transition is a gateway command that checks the caller's location membership and the order's current state; an empty update is never shown as success. For partner-run nodes (staff who are not merchant members), the same task API is served by the standalone Store Ops app derived from `apps/phase_2/store_ops_app`, whose users hold only a location membership.

## 7. POS mode (later phase)

Terminal registration bound to a node; cashier session under a location membership; catalogue and prices from node offers; counter sale as a single RPC that consumes stock at completion and posts to the ledger; suspended baskets with no stock effect; receipts with safe reprint by stable reference; shift open/close with cash reconciliation; returns/voids with manager approval; online finalisation, offline drafts only. Running POS inside the merchant apps (browser on a laptop or tablet, Flutter on a tablet) supersedes the earlier native-desktop direction; peripheral support then depends on browser/Flutter plugins and must be validated per device. First domain recommended: clothing; the founder decides.

## 8. Staff and memberships

`employees` with permission keys stays for site-level roles; add `location_memberships(principal, node, capabilities)` for cashier, picker, custodian roles; switch `MERCHANT_STAFF_RBAC_MODE` to `enforce` and make missing-context and lookup failures fail closed (today they return `block:false`). One person may hold memberships at several nodes without gaining site-wide or platform authority.

## 9. Operator console placement

Two options, one console either way:

| Option | Pros | Cons |
|---|---|---|
| Keep `admin_web` (D-4) with a real operator login | separate origin and deploy; smallest change | one more app to run (22 pages already exist) |
| Operator mode inside `merchant_web` under an operator realm | matches the founder's "no separate admin apps" | operator routes must be unreachable to merchant sessions; needs a Constitution amendment to retire `admin_web` and D-4 update |

Recommendation: fix the login first in `admin_web` (fastest unblock for marketplace moderation), decide placement afterwards.
