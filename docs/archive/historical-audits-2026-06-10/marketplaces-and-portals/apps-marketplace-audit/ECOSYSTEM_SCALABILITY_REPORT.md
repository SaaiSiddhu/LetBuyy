# Ecosystem Scalability Report (Phase 15)

**Parent:** [`../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md`](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md) · **Date:** 2026-06-07

**Question:** *Can LetBuyy realistically support 10 / 100 / 1,000 / 10,000 apps? What breaks first?* The constraints are **not primarily technical** (the Postgres/Hono/Next stack scales fine to mid-size); they are **operational and lifecycle** — the things that break first are the manual approval, the missing update path, and the unsettled payouts. Discovery and analytics break next; raw infrastructure breaks last.

## Stage analysis

### 10 apps — *achievable now, with manual effort*
- **Works:** catalog, search, install/uninstall, reviews, the consent flow. Denormalized counts via triggers are fine at this scale.
- **Breaks first:** **manual developer approval** (no `pending→approved` endpoint, `rbac.ts:55`) and **manual review** (ops portal) are tolerable at 10 apps but already annoying. **No catalog seed** means even reaching 10 requires hand-onboarding.
- **Verdict:** ✅ feasible as a curated, hand-run launch.

### 100 apps — *operations start to hurt*
- **Breaks:** (1) **No app update/versioning** — with 100 apps, the inability to ship v2 becomes a developer-retention crisis. (2) **Manual approval/review** doesn't scale — needs a self-serve queue + real automated checks (currently hardcoded passed, `developer-routes.ts:683`). (3) **Discovery is hardcoded** — 29 categories, 3 fake collections, 14 hidden in search, no recommendations; 100 apps need real curation/ranking. (4) **Payouts never settle** — at 100 paying apps this is a legal/financial liability, not a bug (`queue-execution.adapter.ts:474`).
- **Verdict:** ⚠️ reachable only after the lifecycle + economics are built.

### 1,000 apps — *platform + data gaps bind*
- **Breaks:** (1) **Search/ranking** — no relevance ranking, no pagination on search (limit 20, `search/page.tsx:69`), client-only rating filter; 1,000 apps need real search infra (the reserved `services/search-service` is unimplemented). (2) **Analytics** — only a snapshot in `partnerDashboard`; 1,000 developers need self-serve time-series (`developer-routes.ts:517`). (3) **Rate limiting/quotas** — no per-app accounting; the coarse IP bucket and missing OAuth brute-force limits won't hold (`index.ts:543`). (4) **RLS** — 7 core tables rely on service-role-only isolation; at 1,000 apps × many stores, defense-in-depth matters (`000_baseline.sql:24311+`). (5) **Webhook delivery** — fire-and-forget dispatch (`shared.ts:553`) needs retries/DLQ at volume (reserved `services/notification-service`/`event-bus` unimplemented).
- **Verdict:** ⚠️ needs the reserved services (search, analytics-pipeline, event-bus) actually built.

### 10,000 apps — *needs the full reserved architecture*
- **Breaks:** everything above plus media/CDN for thousands of listings (reserved `services/media-service` unimplemented; upload is dead UI today), abuse/fraud at scale (reviews have only one-per-user + disabled reporting), a real featured/sponsored inventory model, partner tiers, and multi-region data placement. The denormalized `install_count`/`rating_avg` triggers (`000_baseline.sql:7812`) are fine, but hot-app contention and analytics fan-out need the event-bus/analytics-pipeline that are manifest-only placeholders.
- **Verdict:** ❌ not supportable without building the reserved services and the lifecycle/economics layers.

## What breaks first — ranked

1. **Catalog seeding & manual onboarding** (breaks at 10) — can't fill the store.
2. **App update/versioning** (breaks at ~50–100) — developers can't maintain apps. *Hard blocker.*
3. **Payout settlement & one revenue rate** (breaks at first paid app) — can't run an economy. *Hard blocker.*
4. **Self-serve approval + real automated review** (breaks at ~100) — ops can't keep up / safety gap.
5. **Discovery substance** (breaks at ~100–500) — merchants can't find apps.
6. **Search/ranking + pagination** (breaks at ~1,000).
7. **Self-serve analytics** (breaks at ~1,000).
8. **Rate-limit/quota accounting + OAuth limits + real RLS** (breaks at ~1,000).
9. **Webhook delivery reliability (retries/DLQ)** (breaks at ~1,000).
10. **Media/CDN, abuse/fraud, featured inventory, multi-region** (breaks at ~10,000).

## What prevents developer adoption (independent of scale)

Even at 10 apps, three things suppress adoption regardless of infrastructure: **no way to ship updates, no way to get paid, and no published economics/docs.** These are gating, not gradual — fixing infra without fixing these yields an empty, scalable shell.

## Infrastructure reality check

The repo's `CLAUDE.md` lists `services/search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline` as **reserved, not implemented**. The marketplace's 1k/10k-scale needs map almost exactly onto these unbuilt services. So scaling is gated on **(a)** building the lifecycle/economics (update, payout, approval, review) and **(b)** standing up the reserved platform services for search, media, events, and analytics.

## Recommendation

Treat scale in two tracks: **operational readiness** (update lifecycle, payout settlement, self-serve approval, real review checks, published economics — needed by 100 apps) and **platform readiness** (search, analytics, event-bus, media, quotas, RLS — needed by 1,000+). Do operational readiness first; it's the actual ceiling today. The target architecture is in [`LETBUYY_APPS_MARKETPLACE_V2.md`](LETBUYY_APPS_MARKETPLACE_V2.md).
