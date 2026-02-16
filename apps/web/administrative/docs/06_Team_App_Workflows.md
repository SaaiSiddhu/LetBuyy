# LetBuyy Administrative Apps — Team App & Employee Portal

> **Part 6 of 8** | Team Dashboard, Employee Management, Internal Workflows, Marketing Tools
>
> **Version:** 1.0 | **Date:** February 16, 2026
>
> **Scope:** This document focuses on the Team app (`team.letbuyy.store`) — its unique features, employee management, day-to-day operational workflows, marketing tools, and how it differs from the Console app.

---

## Table of Contents

1. [Team App Overview](#1-team-app-overview)
2. [Employee Management](#2-employee-management)
3. [Operations Dashboard](#3-operations-dashboard)
4. [Marketing Tools](#4-marketing-tools)
5. [Store Assignment Model](#5-store-assignment-model)
6. [Internal Communication](#6-internal-communication)
7. [Document History](#7-document-history)

---

## 1. Team App Overview

### 1.1 Console vs Team — Key Differences

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   CONSOLE vs TEAM COMPARISON                            │
│                                                                         │
│  CONSOLE (console.letbuyy.store)     TEAM (team.letbuyy.store)         │
│  ─────────────────────────────       ─────────────────────────         │
│  • Super Admins + Platform Owner     • Support leads, moderators,      │
│  • Full platform control               marketing staff                 │
│  • Revenue & billing authority       • Scoped to assigned stores       │
│  • Infrastructure monitoring         • Day-to-day operations           │
│  • Policy & commission management    • Cannot modify billing/plans     │
│  • Developer/designer management     • Cannot access infra settings    │
│  • System-wide configuration         • Cannot manage other employees   │
│                                                                         │
│  WHO USES EACH:                                                         │
│  Console → CTO, CEO, Platform Lead   Team → Support agents, Content    │
│                                        moderators, Marketing team,     │
│                                        Operations staff                │
│                                                                         │
│  ACCESS PATHS:                                                          │
│  Console:                             Team:                             │
│  /login → MFA required               /login → password only           │
│  /dashboard → full platform view     /dashboard → assigned scope      │
│  /analytics → revenue breakdowns     /marketing → campaigns           │
│  /audit-logs → security audit        /operations → daily tasks        │
│  /employees → manage team            /support → ticket queue          │
│  /settings → system config           /stores → assigned stores        │
│  /stores → all stores                /users → customer lookup         │
│  /subscriptions → plan management                                      │
│  /users → all user management                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Team App Routes (from code)

```
team.letbuyy.store/
├── (auth)/
│   ├── login/        ← Team member login (invite-only)
│   └── invite/       ← Accept invite & set password
├── (dashboard)/
│   ├── page.tsx       ← Team dashboard (task overview)
│   ├── layout.tsx     ← Sidebar + header layout
│   ├── marketing/     ← Email campaigns, promotions
│   ├── operations/    ← Operational tasks, checklists
│   ├── stores/        ← View assigned stores
│   ├── support/       ← Support ticket queue
│   └── users/         ← Customer lookup (read-only)
├── globals.css
├── layout.tsx
└── page.tsx            ← Redirect to login or dashboard
```

---

## 2. Employee Management

### 2.1 Employee Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EMPLOYEE LIFECYCLE                                    │
│                                                                         │
│  INVITE                                                                 │
│  ├── Console: Super Admin sends invite email                           │
│  ├── Includes: name, email, role, assigned stores                     │
│  ├── Invite link expires: 7 days                                      │
│  └── Route: team.letbuyy.store/invite?token=xxx                       │
│                                                                         │
│  ONBOARD                                                                │
│  ├── Employee clicks invite link                                       │
│  ├── Sets password (min 12 chars, no MFA for team)                    │
│  ├── Account created in `platform_employees` table                    │
│  ├── Assigned permissions applied                                      │
│  └── Welcome email with login instructions                            │
│                                                                         │
│  ACTIVE                                                                 │
│  ├── Employee logs in to team.letbuyy.store                           │
│  ├── Sees only assigned stores and permitted sections                 │
│  ├── Activity logged to `team_audit_log` table                        │
│  └── Regular access review (quarterly)                                 │
│                                                                         │
│  ROLE CHANGE                                                            │
│  ├── Console: Super Admin modifies role/permissions                   │
│  ├── Changes take effect immediately (session refreshed)              │
│  └── Audit log entry created                                          │
│                                                                         │
│  OFFBOARD                                                               │
│  ├── Console: Super Admin deactivates account                         │
│  ├── All active sessions invalidated                                  │
│  ├── Access revoked immediately                                        │
│  ├── Account marked 'deactivated' (not deleted for audit trail)      │
│  └── Reassign open tickets/tasks                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Employee List (Console View)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Employees                              Active: 8 │ Inactive: 2        │
│                                                                          │
│  [🔍 Search...          ]  [Role ▾]  [Status ▾]  [+ Invite Employee]  │
│                                                                          │
│  ┌────┬────────────────┬──────────────┬──────────┬──────────┬──────────┐│
│  │    │ Name           │ Role         │ Stores   │ Last     │ Status   ││
│  │    │                │              │ Assigned │ Active   │          ││
│  ├────┼────────────────┼──────────────┼──────────┼──────────┼──────────┤│
│  │ 🟢 │ Sarah L.       │ Support Lead │ All      │ 5m ago   │ Active   ││
│  │ 🟢 │ Amit K.        │ Support Agent│ 15       │ 20m ago  │ Active   ││
│  │ 🟢 │ Priya M.       │ Moderator    │ All      │ 1h ago   │ Active   ││
│  │ 🟢 │ Rahul S.       │ Marketing    │ 8        │ 30m ago  │ Active   ││
│  │ 🟢 │ Neha R.        │ Support Agent│ 12       │ 2h ago   │ Active   ││
│  │ 🟡 │ Dev P.         │ Support Agent│ 10       │ 3d ago   │ Invited  ││
│  │ 🔴 │ Ex-Employee    │ Moderator    │ —        │ 30d ago  │ Inactive ││
│  └────┴────────────────┴──────────────┴──────────┴──────────┴──────────┘│
│                                                                          │
│  Roles: Support Lead (1), Support Agent (4), Moderator (2), Marketing (1)│
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Team Roles & Permissions

| Role | Stores | Support | Moderation | Marketing | Analytics | Users |
|---|---|---|---|---|---|---|
| **Support Lead** | View all | Full access + escalate | Read | — | Summary | Read |
| **Support Agent** | View assigned | Reply + resolve | — | — | — | Read |
| **Content Moderator** | View all | — | Full access | — | Mod stats | — |
| **Marketing Staff** | View assigned | — | — | Full access | Campaigns | — |
| **Operations Manager** | View all | Escalation | Review | — | Full | Read |

---

## 3. Operations Dashboard

### 3.1 Daily Operations View (Team App Home)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🏠 Team Dashboard                        Good morning, Sarah! 👋      │
│                                                                          │
│  YOUR TASKS TODAY                                                       │
│  ┌─────────────────────────────────────────────────┬──────────────────┐ │
│  │ 🎫 Open support tickets assigned to you         │ 8 tickets        │ │
│  │ 🔴 Critical tickets (SLA at risk)               │ 1 ticket         │ │
│  │ 📧 Unread merchant messages                     │ 3 messages       │ │
│  │ 📝 Moderation items (queued for review)         │ 5 items          │ │
│  │ ✅ Tickets resolved today                        │ 12 tickets       │ │
│  └─────────────────────────────────────────────────┴──────────────────┘ │
│                                                                          │
│  TEAM ACTIVITY (Live)                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 👩‍💻 Sarah L. resolved #1042 (How to set up custom domain) — 5m   │ │
│  │ 👨‍💻 Amit K. replied to #1038 (Product images not loading) — 12m   │ │
│  │ 👩‍💼 Priya M. approved product "Bamboo Plant Set" — 18m            │ │
│  │ 📧 Rahul S. sent campaign "Valentine's Day Sale" — 25m            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  QUICK ACTIONS                                                          │
│  [🎫 View Tickets] [📝 Moderation Queue] [🏪 My Stores] [📊 Stats]   │
│                                                                          │
│  PERFORMANCE (This Week)                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│  │ Tickets  │ │ Avg Resp │ │ CSAT     │ │ Modera-  │                  │
│  │ Resolved │ │ Time     │ │ Score    │ │ tion     │                  │
│  │ 45       │ │ 1.2 hrs  │ │ 4.5/5   │ │ 28 items │                  │
│  │ ↑12%     │ │ ↓15 min  │ │ ↑0.2     │ │ SLA: ✅  │                  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Operations Task Types

| Task Type | Source | Assignee | SLA | Completion |
|---|---|---|---|---|
| Support tickets | Merchants, auto-generated | Support agents | Priority-based | Reply + resolve |
| Content moderation | AI pipeline (flagged items) | Content moderators | 4 hours | Approve/reject |
| App review | Developer submissions | Senior moderator | 3 business days | Approve/reject/revisions |
| Store escalation | Console auto-escalation | Support lead | 24 hours | Investigate + report |
| Campaign review | Marketing team | Marketing manager | Same day | Approve + send |

---

## 4. Marketing Tools

### 4.1 Campaign Management

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Marketing / Email Campaigns                                            │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│  │ Active   │ │ Sent     │ │ Open     │ │ Click    │                  │
│  │ Campaigns│ │ This Mo. │ │ Rate     │ │ Rate     │                  │
│  │ 3        │ │ 12       │ │ 32%      │ │ 8%       │                  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                  │
│                                                                          │
│  CAMPAIGNS                                                              │
│  ┌────────────────────┬──────────┬──────────┬──────────┬───────────────┐│
│  │ Campaign           │ Status   │ Sent To  │ Opens    │ CTR           ││
│  ├────────────────────┼──────────┼──────────┼──────────┼───────────────┤│
│  │ Valentine's Sale   │ ✅ Sent  │ 1,200    │ 38%      │ 12%           ││
│  │ Feature Launch     │ ✅ Sent  │ 850      │ 42%      │ 15%           ││
│  │ Monthly Newsletter │ 📋 Draft │ —        │ —        │ —             ││
│  └────────────────────┴──────────┴──────────┴──────────┴───────────────┘│
│                                                                          │
│  [➕ New Campaign]  [📧 Templates]  [📊 Full Analytics]                │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Campaign Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EMAIL CAMPAIGN CREATION                               │
│                                                                         │
│  STEP 1: AUDIENCE                                                       │
│  ├── All merchants                                                     │
│  ├── By plan tier (Free / Growth / Business / Enterprise)              │
│  ├── By site type (Store / Portfolio / Resume / Blog / Landing)        │
│  ├── By activity (active last 30d / churned / trial)                  │
│  └── Custom segment (SQL-based, Console only)                          │
│                                                                         │
│  STEP 2: CONTENT                                                        │
│  ├── Subject line (AI-generated suggestions available)                 │
│  ├── Body content (template-based or custom HTML)                      │
│  ├── Personalization tokens: {name}, {store_name}, {plan}             │
│  └── AI content review (auto-check for spam triggers)                  │
│                                                                         │
│  STEP 3: SCHEDULE                                                       │
│  ├── Send immediately                                                   │
│  ├── Schedule for future date/time                                     │
│  └── Timezone-aware (IST default, auto-detect for intl merchants)     │
│                                                                         │
│  STEP 4: REVIEW & SEND                                                  │
│  ├── Preview (desktop + mobile)                                        │
│  ├── Send test email                                                    │
│  ├── Final audience count confirmation                                 │
│  └── Send (via Resend API)                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Store Assignment Model

### 5.1 How Stores Are Assigned to Team Members

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STORE ASSIGNMENT MODEL                                │
│                                                                         │
│  ASSIGNMENT SCOPES:                                                     │
│  ├── "All stores" → team member sees every store (moderators, leads)  │
│  ├── "Store set" → explicit list of stores assigned by Console admin  │
│  └── "None" → team member has no direct store access (marketing)      │
│                                                                         │
│  HOW IT AFFECTS THE UI:                                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │  Support Agent (assigned: 15 stores)                             │ │
│  │  ├── /stores → sees only 15 stores                               │ │
│  │  ├── /support → sees tickets only from 15 stores                │ │
│  │  └── /users → search limited to customers of 15 stores          │ │
│  │                                                                   │ │
│  │  Content Moderator (assigned: all stores)                        │ │
│  │  ├── /stores → sees all stores                                   │ │
│  │  ├── /moderation → sees all flagged content                     │ │
│  │  └── /users → no access                                         │ │
│  │                                                                   │ │
│  │  Marketing Staff (assigned: 8 stores)                            │ │
│  │  ├── /marketing → campaigns for 8 store audiences              │ │
│  │  └── /stores → read-only view of 8 stores                      │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ASSIGNMENT MANAGEMENT (Console → /employees/{id}/edit):               │
│  ├── Drag-and-drop store assignment                                    │
│  ├── Bulk assign/unassign                                              │
│  └── Template-based (e.g., "all high-value stores")                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Internal Communication

### 6.1 Internal Notes & Mentions

| Feature | Description | Where |
|---|---|---|
| **Internal notes on tickets** | Private notes visible only to team members | Ticket detail view |
| **@mentions** | Tag team members in ticket notes | Ticket detail view |
| **Shift handoff notes** | End-of-shift summary for next shift | Dashboard |
| **Escalation comments** | Notes attached when escalating to Console | Ticket detail view |
| **Team announcements** | Platform-wide updates from Console | Dashboard banner |

---

## 7. Document History

| Version | Date | Changes |
|---|---|---|
| 1.0 | Feb 16, 2026 | Initial version — 6 sections covering Team app overview (Console vs Team comparison, route structure), employee management (lifecycle, list view, 5 roles with permission matrix), operations dashboard (daily task view, 5 task types), marketing tools (campaign management, 4-step creation flow), store assignment model (3 scopes, UI impact), internal communication |

---

> **Next:** [Part 7 — Security, Audit Logs & Compliance](./07_Security_Audit_Compliance.md)

---

*[← Back to Index](./README.md)*
