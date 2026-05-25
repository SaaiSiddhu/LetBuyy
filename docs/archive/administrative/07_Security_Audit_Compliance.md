# LetBuyy Administrative Apps — Security, Audit & Compliance

> **Part 7 of 8** | Security Controls, Audit Logging, GDPR/Privacy Compliance, Data Governance
>
> **Version:** 1.0 | **Date:** February 16, 2026
>
> **Scope:** This document covers security infrastructure, audit logging, compliance frameworks, data governance, and incident response procedures managed through the Console and Team apps.

---

## Table of Contents

1. [Security Architecture](#1-security-architecture)
2. [Audit Log System](#2-audit-log-system)
3. [GDPR & Privacy Compliance](#3-gdpr--privacy-compliance)
4. [Data Governance](#4-data-governance)
5. [Incident Response](#5-incident-response)
6. [Compliance Dashboard](#6-compliance-dashboard)
7. [Document History](#7-document-history)

---

## 1. Security Architecture

### 1.1 Security Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PLATFORM SECURITY ARCHITECTURE                       │
│                                                                         │
│  LAYER 1: EDGE (Cloudflare)                                            │
│  ├── DDoS protection (automatic)                                       │
│  ├── WAF rules (managed + custom)                                      │
│  ├── Rate limiting (configurable per endpoint)                         │
│  ├── Bot management (challenge suspicious clients)                     │
│  ├── SSL/TLS termination (minimum TLS 1.2)                            │
│  └── IP reputation filtering                                           │
│                                                                         │
│  LAYER 2: APPLICATION (Vercel + Next.js)                               │
│  ├── Middleware auth validation (every request)                        │
│  ├── CSRF protection (same-origin policy)                              │
│  ├── Session management (httpOnly, SameSite=Strict cookies)           │
│  ├── Input sanitization (all API routes)                               │
│  ├── Output encoding (XSS prevention)                                  │
│  └── Content Security Policy headers                                   │
│                                                                         │
│  LAYER 3: DATA (Supabase / PostgreSQL)                                 │
│  ├── Row-Level Security (RLS) policies                                 │
│  ├── Encrypted at rest (AES-256)                                       │
│  ├── Encrypted in transit (TLS)                                        │
│  ├── Database access via Supabase client only (no direct connections) │
│  ├── Parameterized queries (SQL injection prevention)                  │
│  └── Regular automated backups (point-in-time recovery)               │
│                                                                         │
│  LAYER 4: ADMIN ACCESS CONTROLS                                        │
│  ├── Console: email + password + MFA (TOTP)                           │
│  ├── Team: email + password (invite-only accounts)                    │
│  ├── Session timeout: 8 hours (configurable)                          │
│  ├── IP allowlisting (optional, Console only)                         │
│  └── All admin actions audit-logged                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Security Settings (Console)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Security Settings                                                      │
│                                                                          │
│  AUTHENTICATION                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ MFA Requirement         [Console: ✅ Required] [Team: ☐ Optional]│ │
│  │ Session Timeout          [8 hours     ▾]                          │ │
│  │ Max Failed Logins        [5 attempts  ▾] → Lock for [30 min ▾]  │ │
│  │ Password Requirements    [Min 12 chars ▾] [Symbols: Required ▾] │ │
│  │ Password Expiry          [90 days     ▾]                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ACCESS CONTROLS                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ IP Allowlist (Console)   [☐ Enable]                               │ │
│  │ Allowed IPs:             [Add IP or CIDR range...]               │ │
│  │                                                                    │ │
│  │ Active Sessions                                                    │ │
│  │ ┌──────────────┬──────────┬──────────┬──────────┬────────────┐   │ │
│  │ │ User         │ IP       │ Location │ Started  │ Action     │   │ │
│  │ ├──────────────┼──────────┼──────────┼──────────┼────────────┤   │ │
│  │ │ Admin (you)  │ 49.x.x.x│ Chennai  │ 2h ago   │ Current    │   │ │
│  │ │ Sarah L.     │ 103.x.x.x│ Mumbai  │ 45m ago  │ [Revoke]   │   │ │
│  │ │ Amit K.      │ 182.x.x.x│ Delhi   │ 3h ago   │ [Revoke]   │   │ │
│  │ └──────────────┴──────────┴──────────┴──────────┴────────────┘   │ │
│  │                                                          [Revoke All]│ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  API SECURITY                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ API Key Rotation         [Last rotated: 15 days ago] [🔄 Rotate] │ │
│  │ Webhook Signing Secret   [Last rotated: 30 days ago] [🔄 Rotate] │ │
│  │ OAuth App Store          [2 active apps] [View All →]            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [💾 Save Changes]                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Audit Log System

### 2.1 Audit Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AUDIT LOGGING SYSTEM                                  │
│                                                                         │
│  WHAT IS LOGGED:                                                        │
│  ├── Every admin action (Console + Team)                               │
│  ├── Authentication events (login, logout, MFA, failed attempts)      │
│  ├── Data access events (who viewed what, when)                       │
│  ├── Configuration changes (settings, policies, rates)                │
│  ├── User/store management actions (create, suspend, delete)          │
│  ├── Billing actions (refunds, overrides, plan changes)               │
│  ├── Moderation decisions (approve, reject, flag)                     │
│  └── API key operations (create, revoke, rotate)                      │
│                                                                         │
│  LOG ENTRY STRUCTURE:                                                   │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ {                                                              │   │
│  │   "id": "evt_abc123",                                         │   │
│  │   "timestamp": "2026-02-14T10:30:00Z",                       │   │
│  │   "actor": {                                                   │   │
│  │     "id": "usr_xyz789",                                       │   │
│  │     "email": "admin@letbuyy.store",                           │   │
│  │     "role": "super_admin",                                    │   │
│  │     "ip": "49.xxx.xxx.xx",                                    │   │
│  │     "user_agent": "Chrome/120 macOS 14"                       │   │
│  │   },                                                           │   │
│  │   "action": "store.suspended",                                │   │
│  │   "target": {                                                  │   │
│  │     "type": "store",                                          │   │
│  │     "id": "store_456",                                        │   │
│  │     "name": "Fashion Hub"                                     │   │
│  │   },                                                           │   │
│  │   "context": {                                                 │   │
│  │     "reason": "Fraud detected — bulk fake orders",            │   │
│  │     "previous_state": "active",                               │   │
│  │     "new_state": "suspended"                                  │   │
│  │   },                                                           │   │
│  │   "app": "console"                                            │   │
│  │ }                                                              │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  RETENTION:                                                             │
│  ├── Hot storage (PostgreSQL): 90 days                                 │
│  ├── Warm storage (R2/S3 archive): 1 year                             │
│  └── Cold storage (compliance archive): 7 years (legal requirement)   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Audit Log Viewer (Console)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Audit Logs                                           Console Only 🔒   │
│                                                                          │
│  [🔍 Search...    ] [Actor ▾] [Action ▾] [Target ▾] [Date Range ▾]   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 2026-02-14 10:45 │ 👤 admin@letbuyy.store │ Console              │   │
│  │ 🔴 store.suspended │ Fashion Hub → SUSPENDED                     │   │
│  │ Reason: "Fraud detected — bulk fake orders"                      │   │
│  │ IP: 49.xxx.xxx.xx │ Chrome/macOS                                 │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ 2026-02-14 10:30 │ 👤 sarah@letbuyy.store │ Team                 │   │
│  │ 🟡 ticket.escalated │ Ticket #1045 → ESCALATED to Console       │   │
│  │ Note: "Razorpay webhooks failing, 3 stores affected"            │   │
│  │ IP: 103.xxx.xxx.xx │ Firefox/Windows                             │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ 2026-02-14 09:15 │ 👤 admin@letbuyy.store │ Console              │   │
│  │ 🟢 user.billing.override │ Quick Store plan: Free → Growth      │   │
│  │ Reason: "Partnership deal — 6-month free trial"                  │   │
│  │ IP: 49.xxx.xxx.xx │ Chrome/macOS                                 │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ 2026-02-14 08:00 │ 🤖 system │ Console                           │   │
│  │ 🟢 auth.login.success │ admin@letbuyy.store logged in           │   │
│  │ MFA: TOTP verified │ IP: 49.xxx.xxx.xx                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Showing 1-25 of 1,245 events │ [📥 Export CSV] [📥 Export JSON]      │
│  [← Prev] [1] [2] [3] ... [50] [Next →]                               │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Audited Action Categories

| Category | Example Actions | Severity | Retention |
|---|---|---|---|
| **Authentication** | Login, logout, MFA, failed attempts | Info/Warning | 7 years |
| **User management** | Create, suspend, delete, role change | High | 7 years |
| **Store management** | Create, suspend, delete, impersonate | Critical | 7 years |
| **Billing** | Refund, plan override, payout, commission change | Critical | 7 years |
| **Configuration** | Settings change, policy update, feature flag | High | 7 years |
| **Moderation** | Product approve/reject, review remove, app ban | Medium | 3 years |
| **Data access** | Customer data viewed, export initiated | High | 7 years |
| **API** | Key created, revoked, webhook configured | Medium | 3 years |

---

## 3. GDPR & Privacy Compliance

### 3.1 Privacy Request Management

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRIVACY REQUEST FLOW                                  │
│                                                                         │
│  REQUEST TYPES:                                                         │
│  ├── Data Access Request (SAR) — "What data do you have about me?"    │
│  ├── Data Deletion Request — "Delete all my data"                     │
│  ├── Data Portability Request — "Export my data in standard format"   │
│  └── Consent Withdrawal — "Stop processing my data for X"            │
│                                                                         │
│  PROCESSING FLOW:                                                       │
│  ┌───────────────────────────────────────────────────────────┐         │
│  │  1. Request received (via email/settings/support ticket)  │         │
│  │  2. Auto-ticket created with priority: HIGH               │         │
│  │  3. Identity verification (email + account confirmation)  │         │
│  │  4. Console: compliance officer reviews                   │         │
│  │  5. Data collection/deletion job queued                   │         │
│  │  6. Cross-system sweep:                                   │         │
│  │     ├── PostgreSQL (Supabase) — user tables               │         │
│  │     ├── Redis (Upstash) — session/cache data              │         │
│  │     ├── R2 (Cloudflare) — uploaded files                  │         │
│  │     ├── Email logs (Resend) — sent correspondence         │         │
│  │     └── Analytics logs — anonymized or deleted            │         │
│  │  7. Confirmation sent to requester                        │         │
│  │  8. Audit log entry (immutable, encrypted)               │         │
│  └───────────────────────────────────────────────────────────┘         │
│                                                                         │
│  SLA: 30 days (GDPR maximum)                                           │
│  Target: 7 business days                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Subject Request Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Privacy Requests                           Console Only 🔒            │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│  │ Open     │ │ In Prog. │ │ Completed│ │ Avg Time │                  │
│  │ Requests │ │          │ │ (30d)    │ │ to Close │                  │
│  │ 3        │ │ 2        │ │ 12       │ │ 4.2 days │                  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                  │
│                                                                          │
│  ACTIVE REQUESTS                                                        │
│  ┌────────┬──────────┬──────────────┬──────────┬──────────┬───────────┐│
│  │ ID     │ Type     │ Requester    │ Received │ Due Date │ Status    ││
│  ├────────┼──────────┼──────────────┼──────────┼──────────┼───────────┤│
│  │ PR-045 │ Deletion │ user@mail.in │ Feb 10   │ Mar 12   │ In Prog.  ││
│  │ PR-044 │ Access   │ shop@mail.in │ Feb 8    │ Mar 10   │ In Prog.  ││
│  │ PR-043 │ Export   │ dev@mail.in  │ Feb 14   │ Mar 16   │ Open      ││
│  └────────┴──────────┴──────────────┴──────────┴──────────┴───────────┘│
│                                                                          │
│  [📋 View Request] [📥 Export Report]                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Data Deletion Scope

| Data Store | What's Deleted | What's Retained | Retention Override |
|---|---|---|---|
| **User profile** | Name, email, phone, avatar | Anonymized ID (for references) | — |
| **Store data** | Store name, content, settings | Transaction records (legal) | 7 years |
| **Orders** | Customer details anonymized | Order amount, date, product (anonymized) | Tax law |
| **Payments** | Card details (already not stored) | Transaction ID, amount | 7 years |
| **Files (R2)** | All uploaded images, assets | None | Immediate |
| **Analytics** | Personal identifiers | Anonymized aggregate data | — |
| **Audit logs** | Personal details in entries | Anonymized action record | 7 years |
| **Support tickets** | Personal correspondence | Anonymized ticket metadata | 3 years |

---

## 4. Data Governance

### 4.1 Data Classification

| Classification | Examples | Admin Access | Encryption |
|---|---|---|---|
| **Public** | Published products, store pages | Everyone | In transit |
| **Internal** | Analytics aggregates, team notes | Console + Team | In transit |
| **Confidential** | User PII, payment data, API keys | Console only | At rest + transit |
| **Restricted** | Security keys, MFA seeds, admin credentials | Platform owner only | At rest + transit + key rotation |

### 4.2 Data Access Controls for Admin

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 DATA ACCESS CONTROLS                                    │
│                                                                         │
│  PII MASKING (default: ON for Team app)                                │
│  ├── Email: user@gm*****.com (full visible in Console only)           │
│  ├── Phone: +91 98***678 (last 3 digits shown)                        │
│  ├── Address: masked except city/state (Console: full)                │
│  └── Payment: never stored (Razorpay tokenized)                       │
│                                                                         │
│  UNMASKING REQUIREMENTS:                                                │
│  ├── Console: click "Reveal" → audit log entry created                │
│  ├── Team: not available (must request Console admin)                  │
│  └── Every unmasking event is logged with reason                      │
│                                                                         │
│  EXPORT CONTROLS:                                                       │
│  ├── Console: full export (CSV/JSON) with audit trail                 │
│  ├── Team: export without PII (aggregated data only)                  │
│  └── All exports are encrypted + watermarked                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Incident Response

### 5.1 Incident Categories

| Severity | Example | Response Time | Who's Notified |
|---|---|---|---|
| **SEV-1 (Critical)** | Platform-wide outage, data breach | Immediate | Platform owner (SMS + email + Slack) |
| **SEV-2 (High)** | Payment system down, multiple stores affected | 15 minutes | Super admins (email + Slack) |
| **SEV-3 (Medium)** | Single store outage, API degradation | 1 hour | Console admins (in-app + email) |
| **SEV-4 (Low)** | Feature bug, non-critical error | 4 hours | Console admins (in-app) |

### 5.2 Incident Response Playbook

```
INCIDENT DETECTED
  │
  ├── Automated: monitoring alert, error spike, health check failure
  └── Manual: merchant report, team member discovery
         │
         ▼
┌───────────────────────────────────────────────────┐
│  1. IDENTIFY & CLASSIFY                            │
│     ├── Severity assessment (SEV-1 to SEV-4)      │
│     ├── Scope: how many users/stores affected?     │
│     └── Root cause hypothesis                      │
└───────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────┐
│  2. CONTAIN                                        │
│     ├── Isolate affected system if needed          │
│     ├── Enable maintenance mode (if SEV-1)        │
│     ├── Redirect traffic (Cloudflare failover)     │
│     └── Preserve evidence (logs, snapshots)        │
└───────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────┐
│  3. COMMUNICATE                                    │
│     ├── Internal: Slack #incident channel          │
│     ├── External: status page update               │
│     └── Affected merchants: email notification     │
└───────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────┐
│  4. RESOLVE                                        │
│     ├── Deploy fix / rollback                      │
│     ├── Verify resolution                          │
│     └── Monitor for regression                     │
└───────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────┐
│  5. POST-MORTEM                                    │
│     ├── Root cause analysis (within 48 hours)      │
│     ├── Timeline of events                         │
│     ├── What went well / what didn't               │
│     ├── Action items to prevent recurrence         │
│     └── Filed in Console → Audit Logs → Incidents │
└───────────────────────────────────────────────────┘
```

---

## 6. Compliance Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Compliance Overview                                Console Only 🔒     │
│                                                                          │
│  DATA PRIVACY                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Open privacy requests: 3 │ Overdue: 0 │ Avg close time: 4.2d    │ │
│  │ 30-day compliance rate: 100% ✅                                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SECURITY                                                               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Active MFA %: 100% (Console) │ Failed logins (24h): 3           │ │
│  │ API key age: 15 days │ Last rotation: Jan 30                     │ │
│  │ Active sessions: 6 │ Suspicious: 0                               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  AUDIT                                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Audit events (30d): 1,245 │ Critical actions: 12                 │ │
│  │ Unreviewed critical events: 0 ✅                                  │ │
│  │ Last audit review: Feb 12, 2026                                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  INCIDENTS                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Open incidents: 0 ✅ │ Incidents (90d): 2 │ MTTR: 45 min         │ │
│  │ Post-mortems pending: 0 ✅                                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [📥 Generate Compliance Report] [📧 Send to Legal] [📆 Schedule Audit]│
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Document History

| Version | Date | Changes |
|---|---|---|
| 1.0 | Feb 16, 2026 | Initial version — 6 sections covering security architecture (4-layer defense), audit log system (structured logging, viewer UI, 8 action categories, 7-year retention), GDPR & privacy compliance (4 request types, processing flow, deletion scope), data governance (4 classification levels, PII masking, export controls), incident response (4 severity levels, 5-step playbook), compliance dashboard |

---

> **Next:** [Part 8 — Database Schema, API & Implementation Roadmap](./08_Database_API_Roadmap.md)

---

*[← Back to Index](./README.md)*
