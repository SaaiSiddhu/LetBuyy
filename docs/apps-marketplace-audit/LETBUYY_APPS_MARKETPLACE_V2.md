# LetBuyy Apps Marketplace V2 — Target Design (Phase 16)

**Parent:** [`../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md`](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md) · **Date:** 2026-06-07
**Benchmarks:** Shopify App Store, Atlassian Marketplace (Forge), Stripe Apps/Partner Ecosystem, Cloudflare developer platform.

This is the target the audit recommends building toward. It assumes the existing platform primitives (OAuth/PKCE, scope enforcement, extension/function model, GDPR webhooks) are kept and built upon — V2 is mostly **finishing and operationalizing**, not rewriting.

## 0. Design principles

1. **Honesty by hiding, not narrating.** If a feature isn't ready, it isn't in the UI — never print flag names, "contract-gated," or "SKIPPED (HUMAN-APPROVAL)" to users.
2. **Earn every surface.** Don't render categories/collections/rails over an empty catalog; gate discovery on real depth.
3. **One source of truth for economics.** A single revenue-share number in code, docs, and UI.
4. **The lifecycle is the product.** Submit → automated checks → review → publish → **update/version** → settle payouts. Close the loop.
5. **Wire what exists before building new.** 10/26 SDK methods are unused; that's the cheapest roadmap.

## 1. Information architecture & navigation

```
Home (curated rails, gated on depth)
├── Browse → all apps (search + facets + pagination)
├── Categories (DB-backed taxonomy) → category landing (SEO copy + ranked apps)
├── Collections (real curation) → /collections index → collection detail
├── App detail (media, pricing plans, permissions, reviews, changelog, trust)
├── Compare (tray; up to 3 apps side-by-side)
└── Partners → partner directory → public developer profile

Merchant account
├── My Apps (installed; configure, manage plan, view scopes, usage, uninstall)
└── Billing (app charges, approvals, invoices, spend controls)

Developer (Partner Console)
├── Apps (list; edit; submit new version; review status timeline)
├── Submit app (with working media upload + scope picker + manifest)
├── Analytics (installs, revenue, usage, API metrics — time series)
├── Payouts (ledger + settlement status + statements + GST)
├── Webhooks (register/list/update/delete)
├── Team/Collaborators (functional agency seats)
└── Docs / Review policy / Economics (real pages)
```

Fix: "Collections" points at an index; remove orphan routes or link them; migrate all hosts to `letbuyy.com`.

## 2. Discovery (V2)

- **Search:** server-side relevance ranking, **all** categories selectable, **server-side rating/price filters**, pagination/infinite scroll, zero-result suggestions, and discovery analytics (terms, CTR, zero-results) wired to the analytics pipeline.
- **Taxonomy:** categories live in the DB, admin-governed, with counts; category landing pages carry SEO copy.
- **Curation:** a real `app_collections` table (editorial picks, themed sets) with a `/collections` index; "Trending" from a rolling install/usage window; "Made in India" actually filters by developer country.
- **Recommendations:** "works with" (compatibility metadata), "alternatives," "merchants also installed," and a featured/sponsored inventory model with disclosure.

## 3. App listing & detail (V2)

- **Required media** at submit (≥1 screenshot, icon) via working upload → media-service/CDN.
- **Pricing plans/tiers** (named plans, feature gating, monthly/annual/one-time, trials, usage meters) — sourced from a real `app_pricing_plans` table, not a flat price.
- **Permissions:** keep the excellent consent model; add per-scope rationale and post-install scope review/revocation.
- **Reviews:** keep verified-install reviews + histogram; add **developer replies** and **abuse reporting** (the disabled buttons become real).
- **Changelog/versions:** populated from `app_versions`; "Updated <date>" reflects real releases.
- **Trust block:** real "Built for LetBuyy" badge (see §8), data-handling disclosure, support SLA, status page.

## 4. Merchant app management (V2)

`My Apps` becomes a real control plane: configure extensions/functions (wire `extensionRegistry`/`update*Registration`), **launch embedded** via `embedSession` (not a hardcoded-null `embedUrl`), **manage plan** (upgrade/downgrade/cancel distinct from uninstall), **approve charges** (wire `createCharge`/`approveCharge`), **review granted scopes**, **see usage**, and keep the strong data-loss-aware uninstall.

## 5. Billing & developer economics (V2)

- **One revenue-share rate**, published. Recommended: adopt the market-standard **0% up to a lifetime threshold, then 15%** (matching Shopify/Atlassian Forge) — and reconcile the code default (currently 8000 bps = 20%) to it. Decide and set it in `billing-core`, the docs, and the UI together.
- **Billing models:** recurring + usage (metered via an events endpoint) + one-time + trials; merchant-approval semantics retained; pricing plans/tiers.
- **Payout settlement:** a ledger **state machine** (`pending → processing → released/failed`) with **actual transfer execution** (RazorpayX/Route), statements, GST evidence, and FK integrity on `charge_id`/`source_event_id`.
- **Merchant spend controls:** budgets/caps/alerts.

## 6. OAuth, permissions, app APIs (V2)

- **One install path:** OAuth (PKCE S256) as the canonical flow; retire or internalize the direct-token path; implement the OAuth BFF route and remove the throw.
- **Scopes:** keep enforcement; add a **scope picker** at submit, a merchant-facing granted-scope view, and per-scope revocation; retire dead scopes (`app_collaboration`, `write_themes`) or enforce them.
- **App data API:** expand beyond products/orders (customers, inventory, fulfillment) as demand warrants; keep secret-key rejection.
- **Hardening:** dedicated brute-force rate limits on `/oauth/token`,`/authorize`,`/bridge/fetch`; per-app/install quota accounting; **real RLS predicates** on the 7 core tables; unify `site_id`/`store_id`.

## 7. Webhooks & events (V2)

- **Developer webhook management:** CRUD for app webhook endpoints (give `app_webhooks` a writer or replace it); topic catalog; signed delivery with retries + DLQ (on the reserved event-bus/notification-service).
- **GDPR:** wire `customers/redact`/`data-request` to the **real** customer-record lifecycle, not just merchant-triggered fan-out.

## 8. Review process & quality program (V2)

- **Real automated checks** that gate the human queue: manifest/scope sanity, HTTPS redirect validation, mandatory-webhook presence, broken-link + basic static/security scan. Replace the hardcoded `passed`.
- **Self-serve developer approval** (`pending → approved`) with an ops UI and an applicant status page.
- **Published review policy, rubric, and SLA** (replace the placeholder); a developer-facing review-status timeline.
- **"Built for LetBuyy" program:** measurable perf/design/integration bars (e.g. p95 latency, no storefront slowdown beyond a threshold, design conformance), a backing DB column, and periodic re-review — modeled on Built for Shopify.
- **Update review + staged rollout** once versioning exists.

## 9. Developer analytics (V2)

Time-series installs/uninstalls, revenue and payout status, usage/metering, per-app API request/error/latency, funnel (listing views → installs), and churn reasons — self-serve in the Partner Console with charts, replacing today's single snapshot.

## 10. Data model additions

`app_versions` (release history/changelog); `app_pricing_plans`/tiers; `app_install_events`/`app_usage_events` (analytics + metering); `app_api_quota`/rate-limit accounting; `app_collections` (curation); `app_support_tickets` (or an integration); persisted OAuth codes/tokens if needed; collaborator/seat tables. Add FKs to the payout ledger; add real RLS to the legacy 7 tables; unify the tenant column.

## 11. Phased roadmap

**Phase A — Make it real (launch-blocking).** Seed catalog + launch partners; one revenue rate; payout settlement; **app update/versioning**; self-serve approval; real submission checks; working media upload; fix registration data loss; remove all leaked-flag/governance copy; domain migration.

**Phase B — Wire what exists.** Charge-approval UI; extension/function management; OAuth install + embed session; public developer profiles; bridge — all backend already present.

**Phase C — Earn discovery & trust.** DB taxonomy + all categories; real collections + index; recommendations/compare; "Built for LetBuyy" program; reviews replies + abuse reporting; real docs/economics/review-policy pages.

**Phase D — Scale platform.** Search-service (ranking/pagination); analytics-pipeline (self-serve analytics + metering); event-bus/notification-service (reliable webhooks); media-service/CDN; quotas + OAuth rate limits + real RLS; multi-region.

## 12. Success criteria

- A merchant can discover, compare, install, **pay for**, configure, and manage an app — and trust the badges.
- A developer can register, get approved self-serve, read real docs, submit with media, **know the revenue share**, ship updates, see real analytics, and **get paid**.
- No user-facing copy references flags, contracts, or governance state.
- Discovery surfaces reflect real catalog depth; every badge is backed by data.

V2 is within reach because the hard primitives already exist. The work is **finishing the lifecycle, operationalizing the economics, and removing the theater** — then filling the catalog.
