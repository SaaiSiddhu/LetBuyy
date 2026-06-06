# LetBuyy Apps Marketplace V2 — Target Design (Phase 16)

The marketplace LetBuyy should build, given the platform it already has. Benchmarks: Shopify App Store (depth), Atlassian Marketplace (developer monetization/versioning), Stripe Apps (OAuth/permission clarity), Cloudflare (performance/edge catalog). Parent: [Master Audit](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md).

## Design principle

**Wire the product to the platform that already exists, make trust earned, and make economics truthful.** Most of V2 is exposing/correcting existing backend capability, not building new infrastructure.

## 1. Navigation

- Persistent top nav + **mobile menu/bottom nav** (fix the <768px nav loss): Home, Categories, Collections, Search, My Apps, Build.
- Search reachable at every breakpoint; global command-style search with suggestions.
- Breadcrumbs on category/detail; "My Apps" and "Partner Console" always one tap away.

## 2. Discovery

- **Data-driven categories** from `GET /categories` with live app counts; hide empty categories; support **multi-tag** apps.
- **Real collections**: a `collections` + `collection_members` model with an editorial/curation UI; "Staff Picks" actually curated.
- **Trending** = install velocity over a rolling window (not all-time `install_count`); **"Made in India"** filtered by developer country.
- **Recommendations**: "similar apps," "merchants also installed," "category leaders," personalized by store type.
- **Search**: ranked full-text (use the shipped trigram indexes) over name/tagline/description/keywords/developer; synonyms; **sanitized input** (no raw `.or()` interpolation); working **pricing/rating/site-type facets** bound to query params.
- **Featured/sponsored** rails with clear labeling.

## 3. App listings (cards)

- Signals: rating + **review count + distribution**, install count (active-only, anti-gamed), price/plan summary, **earned** badges only, recency ("Updated 3d ago" — never 1970), category tags, "works with."
- Remove the unconditional "Built for LetBuyy" badge; show it **only when earned**.

## 4. App detail

- Working screenshots/video (wired to media-service uploads), **pricing plan selector** (monthly/annual/usage/trial), **review section with histogram + developer replies + helpfulness + moderation**, **data-handling/privacy disclosure**, scope list **with rationale**, changelog/release notes, support info + SLA, compatibility, developer profile link.
- Install CTA that opens the **combined consent** (scopes + billing terms + privacy in one approval).

## 5. Merchant experience

- **OAuth-based install** with granular/optional scopes and **re-consent on scope changes**.
- **Post-install onboarding**: setup checklist, required config capture, deep link into admin, App-Bridge embedded session (use `embed-session`/`bridge/fetch`).
- **Billing surface**: view/approve charges, start trials, change/cancel plans, see usage, refunds; charges visible on the merchant bill.
- **App activity log** (what each app did), notifications, and a strong uninstall flow (keep current confirm-dialog; add reason capture).
- Compare-apps tray; alternatives.

## 6. Developer experience

- **Full lifecycle in-product**: register → create → configure (scopes, webhooks, extensions, OAuth redirect URIs, **media upload**) → **manifest validation** → submit → **edit** → **version/update with re-review** → manage → delist.
- **API-key management** (reveal-once secret, rotation) — endpoint already exists.
- **Dev-store provisioning** + collaborator request/redeem (collaborator code exists; build the flow).
- **Docs, SDK, CLI** links; published **review rubric + SLA**.

## 7. Developer dashboard & analytics

- Per-app: **installs over time, install funnel, churn, active vs uninstalled, revenue, payouts, GST**, ratings trend.
- **App health**: API request volume, error rate, **p95 latency** (enable a Built-for-LetBuyy-style performance gate), webhook delivery success.
- Payout **statements + GST invoices + CSV export**.

## 8. OAuth & permissions

- Route all installs through `/oauth/authorize` → `/oauth/token` (already implemented).
- **Optional + incremental scopes**; least-privilege prompts with per-scope rationale; **re-consent** when an update widens scopes.

## 9. Billing & revenue model

- Adopt **managed pricing** (LetBuyy-hosted plan page) covering free/freemium/recurring/annual/**usage (fixed/graduated/volume)**/one-time, trials, proration, test charges. Fix the `pricing_model` enum to match the UI.
- **Truthful, published economics**: one commission rate everywhere. Recommended: a Shopify-style **0% on first ₹X lifetime, then 15%** to bootstrap supply — and fix the `revenue_share_bps` default to match whatever is promised.
- Refunds, disputes, and India payout rails (UPI/bank) + GST invoicing already partly modeled — finish them.

## 10. Review & quality process

- **Automated gates that actually run**: manifest lint, scope-justification, `app_url`/`privacy_url` reachability + TLS, static/dependency scan, and **verify the GDPR webhooks respond** before `in_review`.
- Human review with a **published rubric + SLA**; **re-review on version/scope change**; suspension + appeal UX; **annual re-review** for earned badges.
- Record automated-check results **truthfully** (pass only when executed).

## 11. Trust & safety

- **Earned "Built for LetBuyy"** with quantitative criteria (installs, reviews, rating, performance, design, latest API).
- Developer **KYC/GSTIN verification** before payouts; verified-developer signal that's gated.
- Data-handling disclosures; security posture surfaced; tightened embed sandbox (cross-origin only).

## 12. Scale & performance

- Cache/CDN the public catalog; read replicas for catalog/search at scale.
- Tiered/automated review pipeline for 1,000+ apps; recommendation + ranking infrastructure; multi-currency/locale for non-India growth.

## Phased roadmap

| Phase | Theme | Ships |
|---|---|---|
| **0 — Truth & content (weeks)** | Make it real | Seed curated catalog + categories; fix 15%/20% economics; fix icon bug, dead filters, fake collections, badge; remove `usage_based` until supported |
| **1 — Developer lifecycle** | Let apps live | Edit + **version/update with re-review**, media upload, scopes/webhooks/extension config, API-key UI, manifest validator, dev stores |
| **2 — Trust & install** | Earn trust | OAuth-based install + granular consent + billing-at-install; earned badge program; review write UI + histogram + replies; data disclosures |
| **3 — Discovery & billing** | Make it findable & monetizable | Data-driven categories, real collections/trending, ranked search, recommendations; managed pricing (trials/usage/refunds), statements/invoices |
| **4 — Analytics & governance** | Make it durable | Per-app analytics + app-health/perf gates; automated review gates; moderation/anti-abuse; caching/CDN; localization |

**Net:** V2 is mostly *exposing and correcting* what the gateway already does, plus four genuine platform additions (versioning, real review gates, per-app analytics, app-health monitoring). The foundation is good enough that this is a finishing job, not a rebuild.
