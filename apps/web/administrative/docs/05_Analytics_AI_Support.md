# LetBuyy Administrative Apps — Analytics, AI & Support

> **Part 5 of 8** | Platform Analytics, AI Usage Monitoring, Content Moderation AI, Support System
>
> **Version:** 1.0 | **Date:** February 16, 2026
>
> **Scope:** This document covers the analytics dashboards, AI model orchestration and cost monitoring, AI-powered content moderation, and the support ticket system managed through Console and Team apps.

---

## Table of Contents

1. [Platform Analytics](#1-platform-analytics)
2. [AI Usage Monitoring](#2-ai-usage-monitoring)
3. [AI Content Moderation Pipeline](#3-ai-content-moderation-pipeline)
4. [Support Ticket System](#4-support-ticket-system)
5. [Knowledge Base Management](#5-knowledge-base-management)
6. [Notification System](#6-notification-system)
7. [Document History](#7-document-history)

---

## 1. Platform Analytics

### 1.1 Analytics Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Platform Analytics                         [Last 30 Days ▾] [Export ▾]│
│                                                                          │
│  GROWTH METRICS                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ New      │ │ Active   │ │ MRR      │ │Platform  │ │ Churn    │    │
│  │ Signups  │ │ Users    │ │          │ │ GMV      │ │ Rate     │    │
│  │ 342      │ │ 2,180    │ │ ₹8.2L    │ │ ₹45L     │ │ 3.2%     │    │
│  │ ↑15% MoM│ │ ↑8% MoM  │ │ ↑18% MoM│ │ ↑22% MoM│ │ ↓0.5pp   │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                                          │
│  USER GROWTH (6-month trend)                                           │
│  3,000 ┤                                                 ╭────          │
│  2,500 ┤                                       ╭─────────╯             │
│  2,000 ┤                              ╭────────╯                       │
│  1,500 ┤                    ╭─────────╯                                │
│  1,000 ┤         ╭─────────╯                                           │
│    500 ┤─────────╯                                                      │
│        └─────┬──────┬──────┬──────┬──────┬──────┤                      │
│          Sep    Oct    Nov    Dec    Jan    Feb                         │
│                                                                          │
│  REVENUE BREAKDOWN                                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Subscriptions  ████████████████████████████████  ₹8.2L (64%)    │ │
│  │  Transaction    ██████████████  ₹2.1L (16%)                       │ │
│  │  AI Credits     █████████  ₹1.2L (9%)                             │ │
│  │  App Store      ███████  ₹0.8L (6%)                               │ │
│  │  Themes         ███  ₹0.3L (2%)                                   │ │
│  │  Domains        ██  ₹0.2L (2%)                                    │ │
│  │  Enterprise     █  ₹0.1L (1%)                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SITE TYPE DISTRIBUTION                                                 │
│  ┌────────────┬───────┬──────────┬──────────┬──────────────────────┐   │
│  │ Site Type  │ Count │ Active % │ Avg MRR  │ Trial→Paid Conv.    │   │
│  ├────────────┼───────┼──────────┼──────────┼──────────────────────┤   │
│  │ Store      │ 620   │ 78%      │ ₹1,420   │ 28%                  │   │
│  │ Portfolio  │ 280   │ 65%      │ ₹680     │ 18%                  │   │
│  │ Blog       │ 180   │ 72%      │ ₹520     │ 22%                  │   │
│  │ Resume     │ 120   │ 55%      │ ₹450     │ 15%                  │   │
│  │ Landing    │ 47    │ 82%      │ ₹1,200   │ 35%                  │   │
│  └────────────┴───────┴──────────┴──────────┴──────────────────────┘   │
│                                                                          │
│  [📊 Detailed Reports] [📥 Export CSV] [📧 Schedule Report]            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Analytics Categories

| Category | Console | Team | Metrics Included |
|---|---|---|---|
| **Growth** | ✅ Full | 🔍 Summary | Signups, active users, churn, retention |
| **Revenue** | ✅ Full | ❌ | MRR, ARR, LTV, ARPU, revenue by stream |
| **Engagement** | ✅ Full | 🔍 Summary | DAU/MAU, sessions, feature adoption |
| **E-commerce** | ✅ Full | 🔍 Summary | GMV, orders, AOV, conversion rate |
| **AI usage** | ✅ Full | 🔍 Summary | Credits consumed, model distribution |
| **Infrastructure** | ✅ Full | ❌ | Uptime, latency (p50/p95/p99), errors |
| **Marketplace** | ✅ Full | 🔍 Summary | App installs, theme sales, dev payouts |

### 1.3 System Health Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  System Health                                          Real-time 🟢    │
│                                                                          │
│  SERVICE STATUS                                                         │
│  ┌───────────────────────┬────────┬──────────┬──────────┬─────────────┐│
│  │ Service               │ Status │ Uptime   │ P95 Lat. │ Errors (1h) ││
│  ├───────────────────────┼────────┼──────────┼──────────┼─────────────┤│
│  │ API (Cloudflare)      │ 🟢     │ 99.99%   │ 42ms     │ 0           ││
│  │ Database (Supabase)   │ 🟢     │ 99.97%   │ 18ms     │ 2           ││
│  │ Cache (Upstash Redis) │ 🟢     │ 99.99%   │ 3ms      │ 0           ││
│  │ CDN (Cloudflare)      │ 🟢     │ 100%     │ 12ms     │ 0           ││
│  │ Storage (R2)          │ 🟢     │ 99.99%   │ 85ms     │ 0           ││
│  │ Email (Resend)        │ 🟡     │ 99.95%   │ 890ms    │ 3           ││
│  │ Payments (Razorpay)   │ 🟢     │ 99.98%   │ 145ms    │ 0           ││
│  └───────────────────────┴────────┴──────────┴──────────┴─────────────┘│
│                                                                          │
│  ⚠️ Email latency elevated — Resend API intermittent delays (monitor)  │
│                                                                          │
│  API REQUEST VOLUME (last 24h)                                         │
│  12K ┤        ╭──╮                         ╭──╮                        │
│  10K ┤     ╭──╯  ╰──╮                   ╭──╯  ╰──╮                    │
│   8K ┤  ╭──╯        ╰──╮             ╭──╯        ╰──╮                  │
│   6K ┤──╯              ╰──╮       ╭──╯              ╰──╮              │
│   4K ┤                     ╰──────╯                     ╰──            │
│      └──┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┤            │
│        12AM  3AM  6AM  9AM  12PM 3PM  6PM  9PM  12AM                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. AI Usage Monitoring

### 2.1 AI Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  AI Operations                                  Period: [This Month ▾]  │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Total AI │ │ Credits  │ │ Platform │ │ Cache    │ │ Avg Cost │    │
│  │ Requests │ │ Consumed │ │ AI Cost  │ │ Hit Rate │ │ Per Req  │    │
│  │ 45,200   │ │ 89,400   │ │ ₹18,500  │ │ 42%      │ │ ₹0.41    │    │
│  │ ↑25% MoM│ │ ↑22%     │ │ ↑15%     │ │ ↑5pp     │ │ ↓8%      │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                                          │
│  AI MODEL USAGE BREAKDOWN                                               │
│  ┌────────────────────┬──────────┬──────────┬───────────┬─────────────┐│
│  │ Model              │ Requests │ Credits  │ Cost/Req  │ Use Case    ││
│  ├────────────────────┼──────────┼──────────┼───────────┼─────────────┤│
│  │ Gemini 2.5 Flash   │ 28,500   │ 28,500   │ ₹0.12     │ Quick tasks ││
│  │ Gemini 3 Pro       │ 12,200   │ 36,600   │ ₹0.45     │ Complex gen ││
│  │ Claude Sonnet 4.5  │ 3,800    │ 15,200   │ ₹0.85     │ Long-form   ││
│  │ Claude Opus 4.6    │ 700      │ 9,100    │ ₹2.10     │ Advanced    ││
│  └────────────────────┴──────────┴──────────┴───────────┴─────────────┘│
│                                                                          │
│  AI FEATURE USAGE                                                       │
│  ┌───────────────────────────┬──────────┬─────────────────────────────┐│
│  │ Feature                   │ Requests │ Trend                       ││
│  ├───────────────────────────┼──────────┼─────────────────────────────┤│
│  │ Product descriptions      │ 15,200   │ ████████████████ ↑18%      ││
│  │ Content generation (blog) │ 8,500    │ █████████ ↑25%             ││
│  │ Image alt text             │ 6,800    │ ███████ ↑12%              ││
│  │ SEO optimization          │ 5,200    │ █████ ↑30%                 ││
│  │ Chat/support AI           │ 4,500    │ ████ ↑40%                  ││
│  │ Content moderation (auto) │ 3,800    │ ████ ↑15%                  ││
│  │ Resume optimization       │ 1,200    │ █ ↑8%                      ││
│  └───────────────────────────┴──────────┴─────────────────────────────┘│
│                                                                          │
│  COST PROTECTION LAYERS (5-Layer System)                                │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Layer 1: Smart Model Selection .............. 🟢 Active (saving 35%)│ │
│  │ Layer 2: Response Caching ................... 🟢 42% hit rate       │ │
│  │ Layer 3: Rate Limiting (per user/store) ..... 🟢 12 throttled today│ │
│  │ Layer 4: Credit System (pre-paid) ........... 🟢 zero overspend    │ │
│  │ Layer 5: Monthly Cost Ceiling ............... 🟢 67% of ceiling    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [⚙️ Adjust Cost Ceilings] [📊 Per-Store Usage] [📥 Export Report]     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 AI Cost Protection Configuration

| Protection Layer | Config Location | Default | Admin Override |
|---|---|---|---|
| **Model selection rules** | Feature flags (`ai_model_routing`) | Auto (cheapest capable) | Console: force specific model |
| **Cache TTL** | Redis config | 24h for identical prompts | Console: adjust per feature |
| **Rate limits (user)** | Upstash Redis | 30 req/hour (Free), 200 req/hour (Business) | Console: per-user override |
| **Credit pricing** | Database `plan_configs` | 1 credit = 1 Flash req, 3 = Pro, etc. | Console: adjust multipliers |
| **Monthly cost ceiling** | Environment config | ₹50,000 platform-wide | Console: adjust ceiling |

### 2.3 Per-Store AI Usage

```
┌──────────────────────────────────────────────────────────────────────────┐
│  AI Usage by Store                                  [Sort: Usage ▾]    │
│                                                                          │
│  ┌────────────────┬──────────┬──────────┬──────────┬──────────────────┐│
│  │ Store          │ Credits  │ % of Plan│ Top Model│ Top Feature      ││
│  │                │ Used/Max │          │          │                  ││
│  ├────────────────┼──────────┼──────────┼──────────┼──────────────────┤│
│  │ Fashion Hub    │ 1,450/2K │ 72%      │ Flash    │ Product desc     ││
│  │ Tech Reviews   │ 420/500  │ 84% ⚠️   │ Pro      │ Blog content     ││
│  │ Style Blog     │ 380/500  │ 76%      │ Flash    │ Blog content     ││
│  │ Portfolio Pro   │ 45/500   │ 9%       │ Flash    │ Bio optimization ││
│  │ Quick Store    │ 50/50    │ 100% 🔴  │ Flash    │ Product desc     ││
│  └────────────────┴──────────┴──────────┴──────────┴──────────────────┘│
│                                                                          │
│  ⚠️ Quick Store has exhausted monthly AI credits                        │
│  🔴 Tech Reviews at 84% — approaching limit                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. AI Content Moderation Pipeline

### 3.1 Moderation System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 AI CONTENT MODERATION PIPELINE                          │
│                                                                         │
│  TRIGGER EVENTS:                                                        │
│  ├── Product created/updated (title, description, images)              │
│  ├── Review submitted (text, rating)                                   │
│  ├── Blog post published (title, content, images)                      │
│  ├── Store page updated (about, contact, custom pages)                 │
│  ├── Profile updated (bio, portfolio description)                      │
│  └── User-generated content (comments, forum posts)                    │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐         │
│  │  TIER 1: KEYWORD FILTER (instant, no AI cost)            │         │
│  │  ├── Blocklist: 500+ prohibited terms                    │         │
│  │  ├── Regex patterns: phone numbers, external URLs        │         │
│  │  ├── Language: supports Hindi + English                   │         │
│  │  └── Result: PASS → Tier 2 | BLOCK → auto-reject        │         │
│  └───────────────────────────────────────────────────────────┘         │
│                          │                                              │
│  ┌───────────────────────▼───────────────────────────────────┐         │
│  │  TIER 2: AI TEXT ANALYSIS (Gemini 2.5 Flash, 1 credit)   │         │
│  │  ├── Toxicity score (0-1)                                 │         │
│  │  ├── Spam probability (0-1)                               │         │
│  │  ├── Policy compliance check                              │         │
│  │  ├── Misleading claims detection                          │         │
│  │  └── Result: score < 0.3 → PASS | 0.3-0.7 → REVIEW      │         │
│  │            | > 0.7 → auto-reject                          │         │
│  └───────────────────────────────────────────────────────────┘         │
│                          │                                              │
│  ┌───────────────────────▼───────────────────────────────────┐         │
│  │  TIER 3: AI IMAGE ANALYSIS (Gemini Pro Vision, 3 credits)│         │
│  │  ├── NSFW detection                                       │         │
│  │  ├── Violence/gore detection                              │         │
│  │  ├── Brand/watermark detection                            │         │
│  │  ├── Image quality assessment                             │         │
│  │  └── Result: same scoring as Tier 2                       │         │
│  └───────────────────────────────────────────────────────────┘         │
│                          │                                              │
│  ┌───────────────────────▼───────────────────────────────────┐         │
│  │  TIER 4: HUMAN REVIEW (Team/Console moderation queue)     │         │
│  │  ├── Items scoring 0.3-0.7 enter human review queue      │         │
│  │  ├── Items auto-rejected can be appealed → human review  │         │
│  │  ├── SLA: 4 hours for standard, 1 hour for critical      │         │
│  │  └── See Part 3, Section 2 for moderation queue UI       │         │
│  └───────────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Moderation Stats Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Content Moderation                             Period: [This Week ▾]   │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Items    │ │ Auto-    │ │ Human    │ │ Auto-    │ │ Avg      │    │
│  │ Scanned  │ │ Approved │ │ Reviewed │ │ Rejected │ │ SLA      │    │
│  │ 2,450    │ │ 2,100    │ │ 280      │ │ 70       │ │ 2.1 hrs  │    │
│  │          │ │ (85.7%)  │ │ (11.4%)  │ │ (2.9%)   │ │ ✅ in SLA│    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                                          │
│  MODERATION BY CONTENT TYPE                                             │
│  ┌─────────────────┬──────────┬──────────┬──────────┬──────────────┐   │
│  │ Content Type    │ Scanned  │ Flagged  │ Rejected │ False Pos.   │   │
│  ├─────────────────┼──────────┼──────────┼──────────┼──────────────┤   │
│  │ Products        │ 1,200    │ 85 (7%)  │ 35       │ 12 (14%)     │   │
│  │ Reviews         │ 800      │ 120 (15%)│ 25       │ 8 (6.7%)     │   │
│  │ Blog posts      │ 250      │ 30 (12%) │ 5        │ 3 (10%)      │   │
│  │ Images          │ 180      │ 40 (22%) │ 5        │ 6 (15%)      │   │
│  │ Profiles        │ 20       │ 5 (25%)  │ 0        │ 2 (40%)      │   │
│  └─────────────────┴──────────┴──────────┴──────────┴──────────────┘   │
│                                                                          │
│  ℹ️ Current false positive rate: 11.4% (target: <10%)                   │
│  [⚙️ Adjust Thresholds] [📊 Detailed Report] [🧪 A/B Test Settings]   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Support Ticket System

### 4.1 Support Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SUPPORT SYSTEM FLOW                                │
│                                                                         │
│  TICKET CREATION                                                        │
│  ├── Merchant creates ticket from admin.letbuyy.store/settings/         │
│  │   support                                                            │
│  ├── Auto-ticket: system creates tickets for critical events            │
│  │   (payment failure, store errors, security alerts)                  │
│  └── Email: support@letbuyy.store → auto-creates ticket               │
│                                                                         │
│  AI TRIAGE (instant, Gemini 2.5 Flash)                                 │
│  ├── Categorize: billing, technical, account, content, other           │
│  ├── Priority: critical (1h SLA), high (4h), medium (8h), low (24h)  │
│  ├── Suggest KB article match (if >80% confidence → auto-reply)       │
│  ├── Assign to team member based on category + availability           │
│  └── Extract key entities: store name, order ID, error codes          │
│                                                                         │
│  TEAM HANDLING (team.letbuyy.store/support)                            │
│  ├── Support agent views assigned tickets                              │
│  ├── Responds with templates or custom replies                        │
│  ├── Can escalate to Console (super admin)                            │
│  └── Marks resolved or pending customer response                      │
│                                                                         │
│  ESCALATION (console.letbuyy.store)                                    │
│  ├── Critical tickets auto-escalate after SLA breach                  │
│  ├── Manual escalation by support lead                                 │
│  └── Super admin has override authority                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Support Ticket Queue (Team App)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Support Tickets                           🎫 Open: 28 │ Unassigned: 5│
│                                                                          │
│  [All ▾] [My Tickets] [Unassigned] [Escalated]   [Priority ▾] [SLA ▾]│
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🔴 #1045 — "Payments not processing since yesterday"             │ │
│  │ Store: Fashion Hub │ Priority: Critical │ SLA: ⏰ 45m remaining  │ │
│  │ Assigned to: Sarah L. │ Category: Billing                        │ │
│  │ AI Suggestion: Check Razorpay webhook status                     │ │
│  │ [💬 Reply] [📋 View Details] [⬆️ Escalate] [✅ Resolve]           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🟡 #1042 — "How to set up custom domain?"                        │ │
│  │ Store: Tech Reviews │ Priority: Medium │ SLA: ✅ 5h remaining    │ │
│  │ Assigned to: Amit K. │ Category: Technical                       │ │
│  │ AI Suggestion: KB #34 "Custom Domain Setup Guide" (95% match)   │ │
│  │ [💬 Reply] [📋 View Details] [📚 Send KB Article] [✅ Resolve]    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🟢 #1038 — "Product images not loading"                          │ │
│  │ Store: Art Gallery │ Priority: Low │ SLA: ✅ 18h remaining       │ │
│  │ Unassigned │ Category: Technical                                  │ │
│  │ AI Suggestion: Check R2 storage quota (store at 95%)             │ │
│  │ [🙋 Claim] [💬 Reply] [📋 View Details]                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  PAGE STATS: Avg response time: 1.2h │ Resolution rate: 92% │ CSAT: 4.3│
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.3 SLA Configuration

| Priority | Response SLA | Resolution SLA | Escalation | Examples |
|---|---|---|---|---|
| **Critical** | 1 hour | 4 hours | Auto @ breach | Payments down, store inaccessible |
| **High** | 4 hours | 12 hours | Auto @ breach | Order issues, checkout broken |
| **Medium** | 8 hours | 24 hours | Manual | Feature questions, domain setup |
| **Low** | 24 hours | 72 hours | None | Feature requests, general questions |

### 4.4 Ticket Detail View

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Support / #1045 — Payments not processing                           │
│                                                                          │
│  ┌──────────────────────────────────┬────────────────────────────────┐  │
│  │  TICKET INFO                      │  ACTIONS                       │  │
│  │                                    │                                │  │
│  │  Status: 🔴 Open                  │  [💬 Reply]                    │  │
│  │  Priority: Critical              │  [📝 Add Internal Note]       │  │
│  │  Created: Feb 14, 10:30 AM       │  [🔄 Change Priority]         │  │
│  │  SLA deadline: Feb 14, 11:30 AM  │  [👤 Reassign]                │  │
│  │  Assigned to: Sarah L.           │  [⬆️ Escalate to Console]      │  │
│  │  Category: Billing               │  [✅ Mark Resolved]            │  │
│  │  Store: Fashion Hub              │  [🏪 View Store]               │  │
│  │  User: Priya Sharma              │  [👤 View User]                │  │
│  └──────────────────────────────────┴────────────────────────────────┘  │
│                                                                          │
│  CONVERSATION                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  👤 Priya Sharma — Feb 14, 10:30 AM                               │ │
│  │  "Hi, my customers have been unable to make payments since        │ │
│  │   yesterday evening. They get a 'payment gateway error' message.  │ │
│  │   I've tried checking my Razorpay settings but everything looks   │ │
│  │   fine on my end. Please help urgently — I'm losing sales!"       │ │
│  │                                                                    │ │
│  │  🤖 AI Triage Note (internal):                                    │ │
│  │  "Likely Razorpay API issue. Check webhook endpoint health.       │ │
│  │   Store has 0 successful payments in last 18 hours vs avg 15/day. │ │
│  │   Similar reports from 2 other stores in last 3 hours."           │ │
│  │                                                                    │ │
│  │  👩‍💻 Sarah L. (Support Agent) — Feb 14, 10:45 AM                  │ │
│  │  "Hi Priya, I'm looking into this urgently. I can see the         │ │
│  │   payment gateway is returning timeout errors. This appears to    │ │
│  │   be affecting multiple stores. Our team is investigating.        │ │
│  │   I'll update you within 30 minutes."                             │ │
│  │                                                                    │ │
│  │  📝 Internal Note — Sarah L., 10:50 AM                            │ │
│  │  "Confirmed: Razorpay webhook endpoint timeout. Escalating to    │ │
│  │   Console for infrastructure check. 3 stores affected."          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [Type reply...                                              ] [Send]  │
│  [📎 Attach] [📄 Template ▾] [📚 KB Search] [🤖 AI Suggest Reply]     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Knowledge Base Management

### 5.1 KB Overview

The Team app manages internal and external knowledge base articles:

| KB Type | Audience | Purpose | Count |
|---|---|---|---|
| **Public KB** | Merchants | Self-serve help articles | ~80 articles |
| **Internal KB** | Team members | Troubleshooting procedures, playbooks | ~40 articles |

### 5.2 KB Article Management

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Knowledge Base                              Total: 120 articles        │
│                                                                          │
│  [🔍 Search articles...        ]  [Type ▾] [Category ▾] [Status ▾]    │
│                                                                          │
│  ┌────────────────────────────────────┬──────────┬──────────┬──────────┐│
│  │ Article                            │ Type     │ Views    │ Helpful  ││
│  ├────────────────────────────────────┼──────────┼──────────┼──────────┤│
│  │ How to Set Up Custom Domain       │ Public   │ 1,245    │ 92%      ││
│  │ Troubleshooting Payment Failures  │ Public   │ 890      │ 88%      ││
│  │ Getting Started with Products     │ Public   │ 780      │ 95%      ││
│  │ [INT] Razorpay Webhook Recovery   │ Internal │ 120      │ —        ││
│  │ [INT] Store Suspension Procedure  │ Internal │ 85       │ —        ││
│  └────────────────────────────────────┴──────────┴──────────┴──────────┘│
│                                                                          │
│  [➕ New Article]  [📥 Import from Docs]  [📊 Analytics]                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Notification System

### 6.1 Notification Channels

| Channel | Target Audience | Alert Types | Configuration |
|---|---|---|---|
| **In-app bell** | Console + Team users | All alerts | Always on |
| **Email** | Super admins | Critical alerts, daily digest | Configurable frequency |
| **Slack** | #ops channel | System health, deployments | Webhook integration |
| **Discord** | #dev-alerts | Build failures, API errors | Webhook integration |
| **SMS** | Platform owner | Downtime, security breach | Emergency only |

### 6.2 Alert Priority Matrix

| Alert Type | In-App | Email | Slack | SMS |
|---|---|---|---|---|
| Store created | 🔔 | — | — | — |
| Payment failure (single) | 🔔 | — | — | — |
| Payment failure (pattern) | 🔔 | 📧 | 💬 | — |
| Security breach | 🔔 | 📧 | 💬 | 📱 |
| SLA breach (support) | 🔔 | 📧 | 💬 | — |
| System downtime | 🔔 | 📧 | 💬 | 📱 |
| New team member | 🔔 | 📧 | 💬 | — |
| GDPR request | 🔔 | 📧 | — | — |
| AI cost ceiling 80% | 🔔 | 📧 | 💬 | — |
| App Store submission | 🔔 | — | — | — |

---

## 7. Document History

| Version | Date | Changes |
|---|---|---|
| 1.0 | Feb 16, 2026 | Initial version — 6 sections covering platform analytics (growth/revenue/engagement dashboards, system health monitoring, 7 analytics categories), AI usage monitoring (4-model breakdown, 5-layer cost protection, per-store usage), AI content moderation (4-tier pipeline, moderation stats), support ticket system (AI triage, ticket queue, SLA config, ticket detail view), knowledge base management, notification system (5 channels, 10 alert types) |

---

> **Next:** [Part 6 — Team App, Employee Portal & Workflows](./06_Team_App_Workflows.md)

---

*[← Back to Index](./README.md)*
