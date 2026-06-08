# Developer Trust Scorecard (Phase 14)

**Parent:** [`../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md`](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md) · **Date:** 2026-06-07

**Question:** *Would a professional SaaS company invest in building for LetBuyy today?* **Overall: 3.4 / 10 — "no, not yet."** The API quality would attract a developer; the **business model and lifecycle would repel them** — they can't get approved self-serve, can't ship v2, can't get paid, and can't even learn the revenue share.

## Scorecard

| Decision factor | Score | Why | Evidence |
|---|---|---|---|
| **API quality / DX** | 7/10 | Real OAuth (PKCE), enforced scopes, manifest validation round-trip, extension/function model, scoped data API | `billing-oauth-routes.ts`; `app-api.ts`; `developer-routes.ts:285` |
| **Documentation** | 1/10 | Footer links to `docs.letbuyy.store/apps` & `/api` (external, likely unpublished); review-requirements is a placeholder | `Footer.tsx:28-29`; `review-requirements:35` |
| **Onboarding** | 3/10 | 3-step register exists but **drops GSTIN + consent**; **approval not self-serve** (no `pending→approved`); India-only | `register:46-52`; `rbac.ts:55` |
| **Revenue opportunity** | 1/10 | Empty marketplace = no merchants to sell to | `page.tsx:274` |
| **Monetization clarity** | 1/10 | Revenue share **contradictory** (code 20% / docs 15% / UI "pending"); no plans/tiers; no one-time/trial | `billing-core:269`; `apps/new:307` |
| **Getting paid** | 0/10 | Payout ledger only ever `pending`; **no settlement, no transfer execution** | `queue-execution.adapter.ts:474` |
| **App lifecycle (ship v2)** | 0/10 | **No update/version endpoint**; dashboard says editing is "gated on the app-update contract" | `dashboard:309` |
| **Analytics / insight** | 3/10 | Partner Console shows real installs/earnings/GST/ratings — but snapshot only, "Released"=0, no time-series, no per-app/API metrics | `dashboard:107-141`; `developer-routes.ts:517` |
| **Submission/review fairness** | 3/10 | Real human review w/ RBAC, but "automated checks" are hardcoded passed and the rubric/SLA is a placeholder | `developer-routes.ts:683`; `review-requirements:18` |
| **Media & listing control** | 2/10 | Manifest validator real, but icon/screenshot upload is **dead UI**; no post-publish edit | `apps/new:233-246` |
| **Webhooks / events** | 2/10 | Mandatory GDPR webhooks auto-subscribed, but **no developer webhook management** (`app_webhooks` read-only) | schema; `app-engine:1438` |
| **Collaboration / agencies** | 1/10 | Collaborator code is a **dead string** (no persist/redeem) | `shared.ts:242` |
| **Platform stability/credibility** | 4/10 | Solid primitives, but visible placeholder/"contract-gated" copy signals immaturity | `apps/new:358` |

**Weighted overall: ~3.4 / 10.**

## The developer's-eye view

A developer evaluating LetBuyy would **like the API** — OAuth/PKCE, enforced scopes, a real extension/function model, and a manifest validator are the things that make integration pleasant. Then they'd hit the wall: *"How much do you take?"* → unanswered (20% in code, 15% in docs, "pending" in UI). *"How do I get paid?"* → you don't (ledger never settles). *"How do I ship an update?"* → you can't. *"How do I get approved?"* → a human edits the database. *"Where are the docs?"* → a dead link. *"How big is the audience?"* → zero. Any one of these is a yellow flag; together they are disqualifying for a company deciding where to spend engineering quarters.

## What would attract a serious developer (the bar to clear)

1. **One published revenue-share number** + a real **payout schedule that actually pays** (Master #3, #4).
2. **Self-serve onboarding** that keeps GSTIN/consent and approves without manual DB edits (#5, #6).
3. **An app update/versioning lifecycle** with re-review and staged rollout (#2).
4. **Real documentation** (API reference, manifest spec, getting-started, review policy/SLA) (#20, #75).
5. **Working media upload + post-publish editing** (#21, #2).
6. **Real analytics** (time-series installs/revenue/usage, per-app API metrics) (#24, #58).
7. **Developer webhook management** and a **functional collaborator/agency model** (#25, #13).
8. **An audience** — seeded catalog + merchant demand (#1).

## Verdict

The platform is **good enough to build on technically** but **not safe to build a business on**. The fix is not more API surface — it's **operationalizing the business**: pick the economics, pay developers, let them ship updates, document the platform, and bring merchants. Until then, a rational SaaS company will wait. See [`APPS_FEATURE_GAP_ANALYSIS.md`](APPS_FEATURE_GAP_ANALYSIS.md) and [`ECOSYSTEM_SCALABILITY_REPORT.md`](ECOSYSTEM_SCALABILITY_REPORT.md).
