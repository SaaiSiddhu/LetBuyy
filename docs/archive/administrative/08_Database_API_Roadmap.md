# LetBuyy Administrative Apps — Database, API & Roadmap

> **Part 8 of 8** | Admin Database Schema, Admin API Endpoints, Implementation Roadmap
>
> **Version:** 1.0 | **Date:** February 16, 2026
>
> **Scope:** This document covers the database tables specific to administrative operations, API endpoints for admin functionality, and the phased implementation roadmap for building the Console and Team apps.

---

## Table of Contents

1. [Admin Database Schema](#1-admin-database-schema)
2. [Admin API Endpoints](#2-admin-api-endpoints)
3. [Implementation Roadmap](#3-implementation-roadmap)
4. [Environment & Configuration](#4-environment--configuration)
5. [Cross-References](#5-cross-references)
6. [Document History](#6-document-history)

---

## 1. Admin Database Schema

### 1.1 Admin-Specific Tables

These tables exist specifically for the Console and Team apps and are separate from the consumer-facing tables documented in `09_API_and_Database.md`.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  ADMIN DATABASE TABLES (Supabase PostgreSQL)            │
│                                                                         │
│  IDENTITY & ACCESS                                                      │
│  ├── platform_admins ............. Super admin accounts (Console)       │
│  ├── platform_employees .......... Team member accounts (Team)         │
│  ├── admin_sessions .............. Active sessions (Console + Team)     │
│  ├── admin_mfa_tokens ............ MFA seed storage (Console only)     │
│  └── employee_store_assignments .. Store ↔ employee mapping            │
│                                                                         │
│  AUDIT & COMPLIANCE                                                     │
│  ├── admin_audit_log ............. All admin action events              │
│  ├── privacy_requests ............ GDPR/data subject requests          │
│  └── incident_records ............ Security incident tracking          │
│                                                                         │
│  SUPPORT                                                                │
│  ├── support_tickets ............. Merchant support tickets             │
│  ├── ticket_messages ............. Conversation thread per ticket       │
│  ├── ticket_internal_notes ....... Team-only private notes             │
│  └── kb_articles ................. Knowledge base articles              │
│                                                                         │
│  MARKETPLACE ADMIN                                                      │
│  ├── developer_applications ...... Developer verification requests     │
│  ├── app_review_queue ............ App submissions under review        │
│  ├── theme_review_queue .......... Theme submissions under review      │
│  ├── developer_payouts ........... Monthly payout records              │
│  └── marketplace_commissions ..... Commission transaction records     │
│                                                                         │
│  OPERATIONS                                                             │
│  ├── moderation_queue ............ Content flagged for review           │
│  ├── moderation_decisions ........ Approve/reject decision records     │
│  ├── email_campaigns ............ Marketing campaign records           │
│  ├── campaign_recipients ......... Campaign send log                   │
│  └── platform_notifications ..... In-app notifications                 │
│                                                                         │
│  TOTAL: 21 admin-specific tables                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Table Schemas

```sql
-- PLATFORM ADMINS (Console users)
CREATE TABLE platform_admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'admin',
                    -- 'platform_owner', 'super_admin', 'admin'
    mfa_enabled     BOOLEAN DEFAULT FALSE,
    mfa_secret      TEXT,
    status          TEXT DEFAULT 'active',
                    -- 'active', 'locked', 'deactivated'
    last_login_at   TIMESTAMPTZ,
    last_login_ip   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- PLATFORM EMPLOYEES (Team users)
CREATE TABLE platform_employees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL,
                    -- 'support_lead', 'support_agent', 'moderator',
                    -- 'marketing', 'operations_manager'
    status          TEXT DEFAULT 'invited',
                    -- 'invited', 'active', 'deactivated'
    invited_by      UUID REFERENCES platform_admins(id),
    invite_token    TEXT,
    invite_expires  TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- EMPLOYEE STORE ASSIGNMENTS
CREATE TABLE employee_store_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     UUID REFERENCES platform_employees(id) ON DELETE CASCADE,
    store_id        UUID REFERENCES sites(id) ON DELETE CASCADE,
    assigned_by     UUID REFERENCES platform_admins(id),
    assigned_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, store_id)
);

-- ADMIN AUDIT LOG
CREATE TABLE admin_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        UUID,
    actor_email     TEXT NOT NULL,
    actor_role      TEXT NOT NULL,
    actor_ip        TEXT,
    actor_user_agent TEXT,
    app             TEXT NOT NULL,    -- 'console' or 'team'
    action          TEXT NOT NULL,    -- 'store.suspended', 'user.deleted', etc.
    target_type     TEXT,             -- 'store', 'user', 'ticket', etc.
    target_id       UUID,
    target_name     TEXT,
    context         JSONB,            -- additional details
    severity        TEXT DEFAULT 'info',
                    -- 'info', 'warning', 'critical'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- SUPPORT TICKETS
CREATE TABLE support_tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number   SERIAL,
    subject         TEXT NOT NULL,
    status          TEXT DEFAULT 'open',
                    -- 'open', 'in_progress', 'waiting_customer',
                    -- 'escalated', 'resolved', 'closed'
    priority        TEXT DEFAULT 'medium',
                    -- 'critical', 'high', 'medium', 'low'
    category        TEXT,
                    -- 'billing', 'technical', 'account', 'content', 'other'
    store_id        UUID REFERENCES sites(id),
    user_id         UUID REFERENCES users(id),
    assigned_to     UUID REFERENCES platform_employees(id),
    ai_triage       JSONB,            -- AI categorization results
    sla_deadline    TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    csat_rating     INTEGER,          -- 1-5 post-resolution
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- MODERATION QUEUE
CREATE TABLE moderation_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type    TEXT NOT NULL,    -- 'product', 'review', 'blog', 'image'
    content_id      UUID NOT NULL,
    store_id        UUID REFERENCES sites(id),
    ai_score        DECIMAL(5,2),     -- 0-100
    ai_flags        JSONB,            -- specific flags from AI scan
    ai_model        TEXT,             -- which model scanned it
    status          TEXT DEFAULT 'pending',
                    -- 'pending', 'approved', 'rejected', 'escalated'
    reviewed_by     UUID REFERENCES platform_employees(id),
    review_notes    TEXT,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. Admin API Endpoints

### 2.1 Console API Routes

| Method | Endpoint | Description | Permission |
|---|---|---|---|
| **Auth** | | | |
| POST | `/api/auth/login` | Admin login | Public |
| POST | `/api/auth/mfa/verify` | Verify MFA token | Authenticated |
| POST | `/api/auth/logout` | Destroy session | Authenticated |
| **Users** | | | |
| GET | `/api/users` | List all platform users (paginated) | `users.read` |
| GET | `/api/users/[id]` | Get user details | `users.read` |
| PATCH | `/api/users/[id]` | Update user (suspend, unsuspend) | `users.write` |
| DELETE | `/api/users/[id]` | Delete user account | `users.delete` |
| POST | `/api/users/[id]/impersonate` | Start impersonation session | `impersonate` |
| **Stores** | | | |
| GET | `/api/stores` | List all stores (paginated, filterable) | `stores.read` |
| GET | `/api/stores/[id]` | Get store details | `stores.read` |
| PATCH | `/api/stores/[id]` | Update store status | `stores.write` |
| POST | `/api/stores/[id]/suspend` | Suspend store | `stores.suspend` |
| DELETE | `/api/stores/[id]` | Delete store permanently | `stores.delete` |
| **Billing** | | | |
| GET | `/api/billing/subscriptions` | List all subscriptions | `billing.read` |
| POST | `/api/billing/[id]/override` | Override plan/pricing | `billing.override` |
| POST | `/api/billing/[id]/refund` | Process refund | `billing.refund` |
| GET | `/api/billing/revenue` | Revenue dashboard data | `billing.read` |
| **Employees** | | | |
| GET | `/api/employees` | List team members | `team.manage` |
| POST | `/api/employees/invite` | Send team invite | `team.manage` |
| PATCH | `/api/employees/[id]` | Update role/stores | `team.manage` |
| DELETE | `/api/employees/[id]` | Deactivate team member | `team.manage` |
| **Analytics** | | | |
| GET | `/api/analytics/overview` | Platform-wide metrics | `analytics.read` |
| GET | `/api/analytics/revenue` | Revenue breakdown | `analytics.read` |
| GET | `/api/analytics/ai-usage` | AI model usage stats | `analytics.read` |
| POST | `/api/analytics/export` | Export report | `analytics.export` |
| **Audit** | | | |
| GET | `/api/audit-logs` | Query audit events | `audit.read` |
| POST | `/api/audit-logs/export` | Export audit data | `audit.export` |
| **Settings** | | | |
| GET | `/api/settings` | Get platform settings | `settings.read` |
| PATCH | `/api/settings` | Update platform settings | `settings.write` |

### 2.2 Team API Routes

| Method | Endpoint | Description | Permission |
|---|---|---|---|
| **Auth** | | | |
| POST | `/api/auth/login` | Team member login | Public |
| POST | `/api/auth/invite/accept` | Accept invite, set password | Public (with token) |
| **Support** | | | |
| GET | `/api/support/tickets` | List assigned tickets | `tickets.read` |
| GET | `/api/support/tickets/[id]` | Get ticket details | `tickets.read` |
| POST | `/api/support/tickets/[id]/reply` | Reply to ticket | `tickets.reply` |
| PATCH | `/api/support/tickets/[id]` | Update status/priority | `tickets.write` |
| POST | `/api/support/tickets/[id]/escalate` | Escalate to Console | `tickets.escalate` |
| **Operations** | | | |
| GET | `/api/moderation/queue` | Get moderation queue | `moderation.read` |
| POST | `/api/moderation/[id]/action` | Approve/reject content | `moderation.action` |
| **Marketing** | | | |
| GET | `/api/marketing/campaigns` | List campaigns | `marketing.read` |
| POST | `/api/marketing/campaigns` | Create campaign | `marketing.write` |
| POST | `/api/marketing/campaigns/[id]/send` | Send campaign | `marketing.send` |
| **Stores** | | | |
| GET | `/api/stores` | List assigned stores | `stores.read` |
| GET | `/api/stores/[id]` | Store details (assigned only) | `stores.read` |
| **Users** | | | |
| GET | `/api/users/search` | Search customers (masked PII) | `users.read` |

---

## 3. Implementation Roadmap

### 3.1 Phased Implementation Plan

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ADMIN APPS IMPLEMENTATION ROADMAP                     │
│                                                                         │
│  PHASE 1: FOUNDATION (Weeks 1-2)                                       │
│  ├── Sprint 1.1: Database schema creation                              │
│  │   ├── Create all 21 admin tables                                    │
│  │   ├── Set up RLS policies                                           │
│  │   ├── Seed initial platform_admin account                          │
│  │   └── Create indexes for audit_log queries                         │
│  ├── Sprint 1.2: Auth system                                          │
│  │   ├── Console login + MFA (TOTP)                                   │
│  │   ├── Team login (password only)                                   │
│  │   ├── Team invite flow                                             │
│  │   ├── Session management (httpOnly cookies)                        │
│  │   └── Middleware for route protection                              │
│  └── Sprint 1.3: Shared layout                                        │
│       ├── Sidebar navigation (Console layout)                         │
│       ├── Sidebar navigation (Team layout)                            │
│       ├── Header with user menu                                       │
│       └── Permission-based route rendering                            │
│                                                                         │
│  PHASE 2: CORE FEATURES (Weeks 3-5)                                   │
│  ├── Sprint 2.1: User & store management (Console)                    │
│  │   ├── User list with search, filter, pagination                    │
│  │   ├── User detail view with action buttons                         │
│  │   ├── Store list with status indicators                            │
│  │   ├── Store detail view with lifecycle management                  │
│  │   └── Impersonation flow                                           │
│  ├── Sprint 2.2: Billing dashboard (Console)                          │
│  │   ├── Subscription list view                                       │
│  │   ├── Revenue charts (Chart.js / Recharts)                        │
│  │   ├── Refund processing                                            │
│  │   └── Plan override controls                                      │
│  └── Sprint 2.3: Support system (Team)                                │
│       ├── Ticket list view with filters                               │
│       ├── Ticket detail with conversation thread                      │
│       ├── AI triage integration (Gemini 2.5 Flash)                    │
│       ├── KB article management                                       │
│       └── SLA tracking with alerts                                    │
│                                                                         │
│  PHASE 3: MODERATION & OPERATIONS (Weeks 6-7)                         │
│  ├── Sprint 3.1: Content moderation pipeline                          │
│  │   ├── Moderation queue UI                                           │
│  │   ├── AI scan integration (text + images)                          │
│  │   ├── Approve/reject workflows                                     │
│  │   └── Moderation analytics                                         │
│  └── Sprint 3.2: Employee management                                  │
│       ├── Employee list (Console view)                                │
│       ├── Invite flow with email                                      │
│       ├── Role & permission management                                │
│       └── Store assignment UI                                         │
│                                                                         │
│  PHASE 4: ANALYTICS & MARKETPLACE (Weeks 8-10)                        │
│  ├── Sprint 4.1: Analytics dashboards                                 │
│  │   ├── Growth metrics                                                │
│  │   ├── Revenue breakdown                                            │
│  │   ├── AI usage monitoring                                          │
│  │   └── System health dashboard                                      │
│  ├── Sprint 4.2: App Store admin                                      │
│  │   ├── Developer management                                        │
│  │   ├── App review queue                                             │
│  │   ├── Payout management                                            │
│  │   └── Marketplace analytics                                       │
│  └── Sprint 4.3: Theme marketplace admin                              │
│       ├── Theme review queue                                          │
│       ├── Theme catalog management                                    │
│       └── Designer payouts                                            │
│                                                                         │
│  PHASE 5: SECURITY & COMPLIANCE (Weeks 11-12)                         │
│  ├── Sprint 5.1: Audit log system                                     │
│  │   ├── Structured event logging                                     │
│  │   ├── Audit log viewer with filters                                │
│  │   ├── Export functionality                                         │
│  │   └── Retention policy implementation                              │
│  ├── Sprint 5.2: Privacy & compliance                                 │
│  │   ├── GDPR request processing                                     │
│  │   ├── Data deletion workflows                                     │
│  │   ├── Compliance dashboard                                        │
│  │   └── Incident response tools                                     │
│  └── Sprint 5.3: Security hardening                                   │
│       ├── IP allowlisting                                              │
│       ├── Session monitoring                                           │
│       ├── API key rotation automation                                 │
│       └── Penetration testing                                         │
│                                                                         │
│  PHASE 6: POLISH & LAUNCH (Weeks 13-14)                               │
│  ├── Sprint 6.1: Marketing tools (Team)                               │
│  │   ├── Email campaign builder                                       │
│  │   ├── Campaign analytics                                          │
│  │   └── Template management                                         │
│  ├── Sprint 6.2: Notification system                                  │
│  │   ├── In-app notifications                                         │
│  │   ├── Email alerts                                                  │
│  │   ├── Slack/Discord webhook integration                            │
│  │   └── SMS for critical alerts                                      │
│  └── Sprint 6.3: Final QA & deployment                               │
│       ├── End-to-end testing                                          │
│       ├── Performance optimization                                    │
│       ├── Documentation review                                        │
│       └── Production deployment                                       │
│                                                                         │
│  TOTAL: 14 weeks, 6 phases, 15 sprints                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Tech Stack Summary

| Component | Console | Team | Shared |
|---|---|---|---|
| **Framework** | Next.js 15 (App Router) | Next.js 15 (App Router) | — |
| **Language** | TypeScript | TypeScript | — |
| **Styling** | Tailwind CSS | Tailwind CSS | Shared design tokens |
| **Database** | — | — | Supabase (PostgreSQL) |
| **Auth** | Custom (email + MFA) | Custom (email + invite) | Shared session format |
| **Hosting** | Vercel | Vercel | — |
| **CDN** | — | — | Cloudflare |
| **Email** | — | — | Resend |
| **Payments** | — | — | Razorpay |
| **AI** | — | — | Google Gemini, Anthropic Claude |
| **Cache** | — | — | Upstash Redis |
| **Storage** | — | — | Cloudflare R2 |

---

## 4. Environment & Configuration

### 4.1 Shared Environment Variables

```
# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Auth
SESSION_SECRET=<32-byte-random-hex>
SESSION_COOKIE_NAME=_letbuyy_admin_session
SESSION_MAX_AGE=28800

# AI
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...

# Email
RESEND_API_KEY=re_...

# Payments
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Storage
CLOUDFLARE_R2_BUCKET=letbuyy-assets
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...

# Cache
UPSTASH_REDIS_URL=https://...
UPSTASH_REDIS_TOKEN=...
```

### 4.2 Console-Specific Variables

```
# Console only
NEXT_PUBLIC_APP_URL=https://console.letbuyy.store
ADMIN_MFA_ISSUER=LetBuyy Console
ADMIN_IP_ALLOWLIST=49.x.x.x/32,103.x.x.x/24
```

### 4.3 Team-Specific Variables

```
# Team only
NEXT_PUBLIC_APP_URL=https://team.letbuyy.store
CONSOLE_API_URL=https://console.letbuyy.store/api
```

---

## 5. Cross-References

This 8-part admin documentation references and extends the following consumer documentation files:

| Admin Doc Part | Consumer Doc Reference | Topics Extended |
|---|---|---|
| Part 1 (Overview) | `02_Auth_and_Security.md` | Auth flows, RBAC |
| Part 1 (Overview) | `11_Super_Admin_and_Team.md` | Admin architecture |
| Part 2 (Users/Billing) | `04_Admin_Dashboard.md` | Store management |
| Part 2 (Users/Billing) | `05_Ecommerce_and_Payments.md` | Plans/billing |
| Part 3 (E-commerce) | `05_Ecommerce_and_Payments.md` | Product/order oversight |
| Part 3 (E-commerce) | `07_AI_Features.md` | AI moderation |
| Part 4 (Marketplace) | `15_App_Store_Implementation.md` | App Store admin |
| Part 4 (Marketplace) | `14_Themes_and_Customization.md` | Theme marketplace |
| Part 5 (Analytics/AI) | `07_AI_Features.md` | AI model orchestration |
| Part 5 (Analytics/AI) | `09_API_and_Database.md` | System health |
| Part 6 (Team App) | `11_Super_Admin_and_Team.md` | Employee management |
| Part 7 (Security) | `02_Auth_and_Security.md` | Security architecture |
| Part 8 (Database) | `09_API_and_Database.md` | DB schema extensions |

---

## 6. Document History

| Version | Date | Changes |
|---|---|---|
| 1.0 | Feb 16, 2026 | Initial version — 5 sections covering admin database schema (21 tables with SQL definitions for 6 key tables), admin API endpoints (27 Console routes, 14 Team routes), 6-phase 14-week implementation roadmap with 15 sprints, environment configuration, and full cross-reference matrix to consumer documentation |

---

*[← Back to Index](./README.md)*
